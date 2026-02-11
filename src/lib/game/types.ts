// Game Types

export type Role = "impostor" | "detective" | "citizen" | "doctor" | "jester" | "mayor";
export type RoomStatus = "lobby" | "night" | "day" | "voting" | "ended";
export type Outcome = "loss" | "win" | "draw";

// Role descriptions
export const ROLE_INFO: Record<Role, { name: string; team: string; description: string; emoji: string }> = {
  impostor: { name: "Impostor", team: "impostor", description: "Eliminate citizens to win", emoji: "🔪" },
  detective: { name: "Detective", team: "citizen", description: "Investigate one player each night", emoji: "🔍" },
  citizen: { name: "Citizen", team: "citizen", description: "Find and vote out impostors", emoji: "👤" },
  doctor: { name: "Doctor", team: "citizen", description: "Protect one player each night", emoji: "💉" },
  jester: { name: "Jester", team: "neutral", description: "Get voted out to win alone", emoji: "🃏" },
  mayor: { name: "Mayor", team: "citizen", description: "Your vote counts as 2", emoji: "👑" },
};

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
  winnerTeam?: "impostors" | "citizens" | "jester";
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
  type: "kill" | "investigate" | "protect";
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
export const ROLE_DISTRIBUTION: Record<number, { 
  impostors: number; 
  detectives: number;
  doctors: number;
  jesters: number;
  mayors: number;
}> = {
  6: { impostors: 2, detectives: 1, doctors: 0, jesters: 0, mayors: 0 },
  7: { impostors: 2, detectives: 1, doctors: 1, jesters: 0, mayors: 0 },
  8: { impostors: 2, detectives: 1, doctors: 1, jesters: 1, mayors: 0 },
  9: { impostors: 3, detectives: 1, doctors: 1, jesters: 1, mayors: 1 },
  10: { impostors: 3, detectives: 1, doctors: 1, jesters: 1, mayors: 1 },
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
  successfulProtect: 3,
  jesterWin: 15,
  mayorSurvive: 3,
};

// Achievement types
export const ACHIEVEMENTS = {
  FIRST_BLOOD: { id: 1, name: "First Blood", description: "Get your first kill as impostor" },
  SHERLOCK: { id: 2, name: "Sherlock", description: "Correctly identify all impostors" },
  SURVIVOR: { id: 3, name: "Survivor", description: "Survive 5 games in a row" },
  SAVIOR: { id: 4, name: "Savior", description: "Save 3 players as doctor in one game" },
  TRICKSTER: { id: 5, name: "Trickster", description: "Win as jester" },
  LEADER: { id: 6, name: "Leader", description: "Win 3 games as mayor" },
  PERFECT_GAME: { id: 7, name: "Perfect Game", description: "Win without losing any teammates" },
  TOURNAMENT_WINNER: { id: 8, name: "Champion", description: "Win a tournament" },
};

// Anti-cheat thresholds
export const ANTICHEAT = {
  MIN_VOTE_TIME_MS: 2000, // Minimum time before voting (prevent instant votes)
  MAX_SAME_TARGET_STREAK: 3, // Max times voting same person consecutively
  COLLUSION_VOTE_THRESHOLD: 0.9, // % of same votes to flag collusion
  MIN_CHAT_INTERVAL_MS: 500, // Minimum time between messages
};
