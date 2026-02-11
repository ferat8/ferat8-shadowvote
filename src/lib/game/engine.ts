import { prisma } from "@/lib/prisma";
import { Role, ROLE_DISTRIBUTION, REP_REWARDS } from "./types";
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

  // Kill the player
  if (killedPlayerId) {
    await prisma.player.update({
      where: { id: killedPlayerId },
      data: { isAlive: false },
    });
  }

  // Process detective investigation
  const investigateAction = actions.find((a) => a.actionType === "investigate");
  if (investigateAction && investigateAction.targetId) {
    const target = room.players.find((p) => p.id === investigateAction.targetId);
    if (target) {
      await prisma.action.update({
        where: { id: investigateAction.id },
        data: { result: target.role === "impostor" ? "impostor" : "innocent" },
      });
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

  return { killedPlayerId };
}

/**
 * Process day voting and transition
 */
export async function processVoting(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { players: { where: { isAlive: true } } },
  });

  if (!room) throw new Error("Room not found");

  // Get votes for this phase
  const votes = await prisma.vote.findMany({
    where: { roomId, phase: room.phase },
  });

  // Count votes
  const voteCount: Record<string, number> = {};
  let skipCount = 0;

  votes.forEach((v) => {
    if (v.targetId) {
      voteCount[v.targetId] = (voteCount[v.targetId] || 0) + 1;
    } else {
      skipCount++;
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

  // Eliminate player if voted out (not skipped)
  if (votedOutId) {
    await prisma.player.update({
      where: { id: votedOutId },
      data: { isAlive: false },
    });
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
 * Check if game has ended
 */
export async function checkWinCondition(roomId: string) {
  const players = await prisma.player.findMany({
    where: { roomId },
  });

  const alivePlayers = players.filter((p) => p.isAlive);
  const aliveImpostors = alivePlayers.filter((p) => p.role === "impostor");
  const aliveCitizens = alivePlayers.filter((p) => p.role !== "impostor");

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
