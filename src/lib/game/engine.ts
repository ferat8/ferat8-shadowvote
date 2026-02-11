import { prisma } from "@/lib/prisma";
import { Role, ROLE_DISTRIBUTION, REP_REWARDS, ANTICHEAT, ROLE_INFO } from "./types";
import crypto from "crypto";

/**
 * Assign roles to players based on player count
 */
export function assignRoles(playerCount: number): Role[] {
  const distribution = ROLE_DISTRIBUTION[playerCount] || ROLE_DISTRIBUTION[6];
  const roles: Role[] = [];

  // Add impostors
  for (let i = 0; i < distribution.impostors; i++) {
    roles.push("impostor");
  }

  // Add detectives
  for (let i = 0; i < distribution.detectives; i++) {
    roles.push("detective");
  }

  // Add doctors
  for (let i = 0; i < distribution.doctors; i++) {
    roles.push("doctor");
  }

  // Add jesters
  for (let i = 0; i < distribution.jesters; i++) {
    roles.push("jester");
  }

  // Add mayors
  for (let i = 0; i < distribution.mayors; i++) {
    roles.push("mayor");
  }

  // Fill rest with citizens
  while (roles.length < playerCount) {
    roles.push("citizen");
  }

  // Shuffle roles
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  return roles;
}

/**
 * Start the game - assign roles and transition to night
 */
export async function startGame(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { players: true },
  });

  if (!room) throw new Error("Room not found");
  if (room.status !== "lobby") throw new Error("Game already started");
  if (room.players.length < 6) throw new Error("Need at least 6 players");
  if (room.players.length > 10) throw new Error("Max 10 players");

  const roles = assignRoles(room.players.length);

  // Assign roles to players
  await Promise.all(
    room.players.map((player, index) =>
      prisma.player.update({
        where: { id: player.id },
        data: { role: roles[index] },
      })
    )
  );

  // Transition to night phase
  await prisma.room.update({
    where: { id: roomId },
    data: { status: "night", phase: 1 },
  });

  return { success: true };
}

/**
 * Process night actions and transition to day
 */
export async function processNight(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      players: true,
      actions: { where: { phase: { equals: undefined } } },
    },
  });

  if (!room) throw new Error("Room not found");

  // Get actions for this phase
  const actions = await prisma.action.findMany({
    where: { roomId, phase: room.phase },
  });

  // Find kill target (majority vote among impostors)
  const killVotes: Record<string, number> = {};
  actions
    .filter((a) => a.actionType === "kill" && a.targetId)
    .forEach((a) => {
      killVotes[a.targetId!] = (killVotes[a.targetId!] || 0) + 1;
    });

  let killedPlayerId: string | null = null;
  let maxVotes = 0;
  for (const [targetId, votes] of Object.entries(killVotes)) {
    if (votes > maxVotes) {
      maxVotes = votes;
      killedPlayerId = targetId;
    }
  }

  // Check if Doctor protected the target
  const protectAction = actions.find((a) => a.actionType === "protect");
  let wasProtected = false;
  if (protectAction && protectAction.targetId === killedPlayerId) {
    wasProtected = true;
    killedPlayerId = null; // Doctor saved them!
    
    // Update doctor's stats
    const doctor = room.players.find((p) => p.id === protectAction.playerId);
    if (doctor) {
      await updatePlayerStats(doctor.wallet, { savesAsDoctor: 1 });
    }
  }

  // Kill the player (if not protected)
  if (killedPlayerId) {
    await prisma.player.update({
      where: { id: killedPlayerId },
      data: { isAlive: false },
    });

    // Update impostor stats
    const killAction = actions.find((a) => a.actionType === "kill" && a.targetId === killedPlayerId);
    if (killAction) {
      const impostor = room.players.find((p) => p.id === killAction.playerId);
      if (impostor) {
        await updatePlayerStats(impostor.wallet, { killsAsImpostor: 1 });
      }
    }
  }

  // Process detective investigation
  const investigateAction = actions.find((a) => a.actionType === "investigate");
  if (investigateAction && investigateAction.targetId) {
    const target = room.players.find((p) => p.id === investigateAction.targetId);
    if (target) {
      const isImpostor = target.role === "impostor";
      await prisma.action.update({
        where: { id: investigateAction.id },
        data: { result: isImpostor ? "impostor" : "innocent" },
      });
      
      // Update detective stats if correct
      if (isImpostor) {
        const detective = room.players.find((p) => p.id === investigateAction.playerId);
        if (detective) {
          await updatePlayerStats(detective.wallet, { correctDetects: 1 });
        }
      }
    }
  }

  // Check win condition
  const gameEnded = await checkWinCondition(roomId);
  if (gameEnded) return gameEnded;

  // Transition to day
  await prisma.room.update({
    where: { id: roomId },
    data: { status: "day" },
  });

  return { killedPlayerId, wasProtected };
}

/**
 * Process day voting and transition
 */
export async function processVoting(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { players: true },
  });

  if (!room) throw new Error("Room not found");

  const alivePlayers = room.players.filter((p) => p.isAlive);

  // Get votes for this phase
  const votes = await prisma.vote.findMany({
    where: { roomId, phase: room.phase },
    include: { player: true },
  });

  // Count votes (Mayor's vote counts as 2)
  const voteCount: Record<string, number> = {};
  let skipCount = 0;

  votes.forEach((v) => {
    const voteWeight = v.player.role === "mayor" ? 2 : 1;
    if (v.targetId) {
      voteCount[v.targetId] = (voteCount[v.targetId] || 0) + voteWeight;
    } else {
      skipCount += voteWeight;
    }
  });

  // Find player with most votes
  let votedOutId: string | null = null;
  let maxVotes = skipCount;

  for (const [targetId, count] of Object.entries(voteCount)) {
    if (count > maxVotes) {
      maxVotes = count;
      votedOutId = targetId;
    }
  }

  // Check if Jester was voted out - they win!
  let jesterWin = false;
  if (votedOutId) {
    const votedPlayer = room.players.find((p) => p.id === votedOutId);
    if (votedPlayer?.role === "jester") {
      jesterWin = true;
      await updatePlayerStats(votedPlayer.wallet, { jesterWins: 1 });
    }

    // Eliminate player
    await prisma.player.update({
      where: { id: votedOutId },
      data: { isAlive: false },
    });
  }

  // If Jester wins, game ends with special condition
  if (jesterWin) {
    await endGameWithJester(roomId, votedOutId!, room.players);
    return { votedOutId, jesterWin: true, gameEnded: true };
  }

  // Check win condition
  const gameEnded = await checkWinCondition(roomId);
  if (gameEnded) return { votedOutId, ...gameEnded };

  // Transition to next night
  await prisma.room.update({
    where: { id: roomId },
    data: { status: "night", phase: room.phase + 1 },
  });

  return { votedOutId };
}

/**
 * End game when Jester wins
 */
async function endGameWithJester(
  roomId: string,
  jesterId: string,
  players: { id: string; wallet: string; role: string | null; isAlive: boolean }[]
) {
  const gameId = crypto.randomBytes(32).toString("hex");

  const playerResults = players.map((p) => {
    const isJester = p.id === jesterId;
    const won = isJester;

    let repDelta = isJester ? REP_REWARDS.jesterWin : REP_REWARDS.loss;

    return {
      wallet: p.wallet,
      odId: p.id,
      role: p.role as Role,
      won,
      repDelta,
    };
  });

  await prisma.gameResult.create({
    data: {
      roomId,
      gameId: `0x${gameId}`,
      winnerTeam: "jester",
      playerResults: JSON.stringify(playerResults),
    },
  });

  await prisma.room.update({
    where: { id: roomId },
    data: { status: "ended" },
  });
}

/**
 * Check if game has ended
 */
export async function checkWinCondition(roomId: string) {
  const players = await prisma.player.findMany({
    where: { roomId },
  });

  const alivePlayers = players.filter((p) => p.isAlive);
  const aliveImpostors = alivePlayers.filter((p) => p.role === "impostor");
  // Citizens = everyone except impostors and jester
  const aliveCitizens = alivePlayers.filter((p) => 
    p.role !== "impostor" && p.role !== "jester"
  );

  let winnerTeam: "impostors" | "citizens" | null = null;

  // Impostors win if they equal or outnumber citizens
  if (aliveImpostors.length >= aliveCitizens.length) {
    winnerTeam = "impostors";
  }
  // Citizens win if all impostors are eliminated
  else if (aliveImpostors.length === 0) {
    winnerTeam = "citizens";
  }

  if (winnerTeam) {
    await endGame(roomId, winnerTeam, players);
    return { gameEnded: true, winnerTeam };
  }

  return null;
}

/**
 * End the game and create result record
 */
async function endGame(
  roomId: string,
  winnerTeam: "impostors" | "citizens",
  players: { id: string; wallet: string; role: string | null; isAlive: boolean }[]
) {
  const gameId = crypto.randomBytes(32).toString("hex");

  // Calculate player results
  const playerResults = players.map((p) => {
    const isImpostor = p.role === "impostor";
    const won = isImpostor ? winnerTeam === "impostors" : winnerTeam === "citizens";

    let repDelta = won ? REP_REWARDS.win : REP_REWARDS.loss;
    if (isImpostor && p.isAlive) {
      repDelta += REP_REWARDS.surviveAsImpostor;
    }

    return {
      wallet: p.wallet,
      odId: p.id,
      role: p.role as Role,
      won,
      repDelta,
    };
  });

  // Create game result
  await prisma.gameResult.create({
    data: {
      roomId,
      gameId: `0x${gameId}`,
      winnerTeam,
      playerResults: JSON.stringify(playerResults),
    },
  });

  // Update room status
  await prisma.room.update({
    where: { id: roomId },
    data: { status: "ended" },
  });
}

/**
 * Generate a short room code
 */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Update player statistics
 */
export async function updatePlayerStats(
  wallet: string,
  updates: {
    gamesPlayed?: number;
    gamesWon?: number;
    killsAsImpostor?: number;
    savesAsDoctor?: number;
    correctDetects?: number;
    jesterWins?: number;
    mayorWins?: number;
    surviveStreak?: number;
  }
) {
  const normalizedWallet = wallet.toLowerCase();
  
  await prisma.playerStats.upsert({
    where: { wallet: normalizedWallet },
    create: {
      wallet: normalizedWallet,
      ...updates,
    },
    update: {
      gamesPlayed: updates.gamesPlayed ? { increment: updates.gamesPlayed } : undefined,
      gamesWon: updates.gamesWon ? { increment: updates.gamesWon } : undefined,
      killsAsImpostor: updates.killsAsImpostor ? { increment: updates.killsAsImpostor } : undefined,
      savesAsDoctor: updates.savesAsDoctor ? { increment: updates.savesAsDoctor } : undefined,
      correctDetects: updates.correctDetects ? { increment: updates.correctDetects } : undefined,
      jesterWins: updates.jesterWins ? { increment: updates.jesterWins } : undefined,
      mayorWins: updates.mayorWins ? { increment: updates.mayorWins } : undefined,
    },
  });
}

/**
 * Anti-cheat: Log suspicious activity
 */
export async function logAntiCheat(
  wallet: string,
  roomId: string,
  flagType: string,
  severity: number,
  details: object
) {
  await prisma.antiCheatLog.create({
    data: {
      wallet: wallet.toLowerCase(),
      roomId,
      flagType,
      severity,
      details: JSON.stringify(details),
    },
  });

  // Increment player flag count
  await prisma.playerStats.upsert({
    where: { wallet: wallet.toLowerCase() },
    create: { wallet: wallet.toLowerCase(), flagCount: 1 },
    update: { flagCount: { increment: 1 } },
  });
}

/**
 * Anti-cheat: Check vote patterns for collusion
 */
export async function checkVoteCollusion(roomId: string, votes: { playerId: string; targetId: string | null }[]) {
  // Group votes by target
  const targetVotes: Record<string, string[]> = {};
  votes.forEach((v) => {
    if (v.targetId) {
      if (!targetVotes[v.targetId]) targetVotes[v.targetId] = [];
      targetVotes[v.targetId].push(v.playerId);
    }
  });

  // Check if any target has suspiciously high vote concentration
  const totalVotes = votes.filter((v) => v.targetId).length;
  for (const [targetId, voterIds] of Object.entries(targetVotes)) {
    const ratio = voterIds.length / totalVotes;
    if (ratio >= ANTICHEAT.COLLUSION_VOTE_THRESHOLD && voterIds.length >= 3) {
      // Flag all voters for potential collusion
      for (const voterId of voterIds) {
        await logAntiCheat(voterId, roomId, "collusion_suspected", 2, {
          targetId,
          voteRatio: ratio,
          voterCount: voterIds.length,
        });
      }
    }
  }
}

/**
 * Anti-cheat: Track vote patterns between players
 */
export async function trackVotePattern(voterWallet: string, targetWallet: string) {
  await prisma.votePattern.upsert({
    where: {
      wallet_targetWallet: {
        wallet: voterWallet.toLowerCase(),
        targetWallet: targetWallet.toLowerCase(),
      },
    },
    create: {
      wallet: voterWallet.toLowerCase(),
      targetWallet: targetWallet.toLowerCase(),
      voteCount: 1,
    },
    update: {
      voteCount: { increment: 1 },
      lastVoteAt: new Date(),
    },
  });

  // Check if voting same person too many times
  const pattern = await prisma.votePattern.findUnique({
    where: {
      wallet_targetWallet: {
        wallet: voterWallet.toLowerCase(),
        targetWallet: targetWallet.toLowerCase(),
      },
    },
  });

  if (pattern && pattern.voteCount > ANTICHEAT.MAX_SAME_TARGET_STREAK) {
    return { flagged: true, reason: "repeated_target" };
  }

  return { flagged: false };
}
