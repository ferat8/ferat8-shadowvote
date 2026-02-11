// Game Types

export type Role = "impostor" | "detective" | "citizen";
export type RoomStatus = "lobby" | "night" | "day" | "voting" | "ended";
export type Outcome = "loss" | "win" | "draw";

export interface Player {
  id: string;
  wallet: string;
  nickname: string;
  role?: Role;
  isAlive: boolean;
  isReady: boolean;
  isHost: boolean;
}

export interface RoomState {
  id: string;
  code: string;
  status: RoomStatus;
  phase: number;
  players: Player[];
  hostWallet: string;
  // For current player only
  myRole?: Role;
  myId?: string;
  // Phase-specific
  nightDeadline?: number;
  dayDeadline?: number;
  votingDeadline?: number;
  // Results
  lastKilled?: string; // player id killed last night
  lastVoted?: string; // player id voted out
  winnerTeam?: "impostors" | "citizens";
  gameId?: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  nickname: string;
  content: string;
  createdAt: string;
}

export interface NightAction {
  type: "kill" | "investigate";
  targetId: string;
}

export interface VoteAction {
  targetId: string | null; // null = skip
}

export interface GameResultPlayer {
  wallet: string;
  nickname: string;
  role: Role;
  won: boolean;
  repDelta: number;
}

export interface SSEMessage {
  type: "room_update" | "chat" | "phase_change" | "player_died" | "vote_result" | "game_end" | "error";
  data: unknown;
}

// Role distribution for different player counts
export const ROLE_DISTRIBUTION: Record<number, { impostors: number; detectives: number }> = {
  6: { impostors: 2, detectives: 1 },
  7: { impostors: 2, detectives: 1 },
  8: { impostors: 2, detectives: 1 },
  9: { impostors: 3, detectives: 1 },
  10: { impostors: 3, detectives: 1 },
};

// Phase timers (ms)
export const PHASE_TIMERS = {
  night: 30000, // 30 seconds
  day: 90000, // 90 seconds
  voting: 30000, // 30 seconds
};

// Reputation rewards
export const REP_REWARDS = {
  win: 10,
  loss: -5,
  surviveAsImpostor: 5,
  killAsImpostor: 2,
  correctInvestigation: 3,
  votedOutImpostor: 2,
};
