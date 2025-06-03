export interface Player {
  id: string;
  name: string;
  jerseyNumber?: string;
  position?: string;
}

// Represents 5 player IDs (string) or null if a slot is empty.
export type OnCourtPlayers = [
  string | null,
  string | null,
  string | null,
  string | null,
  string | null
];

export interface QuarterSchedule {
  Q1: OnCourtPlayers;
  Q2: OnCourtPlayers;
  Q3: OnCourtPlayers;
  Q4: OnCourtPlayers;
}

export type QuarterKey = keyof QuarterSchedule;

export const QUARTERS: QuarterKey[] = ["Q1", "Q2", "Q3", "Q4"];
export const PLAYERS_ON_COURT = 5;
export const QUARTER_DURATION_MINUTES = 12; // Assuming 12 minutes per quarter

export interface GamePlan {
  id: string;
  name: string;
  players: Player[];
  schedule: QuarterSchedule;
}

export interface DraggedPlayerInfo {
  playerId: string;
  sourceQuarter?: QuarterKey;
  sourceSlotIndex?: number;
}
