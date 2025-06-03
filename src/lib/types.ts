
export interface Player {
  id: string;
  name: string;
  jerseyNumber?: string;
  position?: string;
}

export interface PlayerTimeSlot {
  playerId: string | null;
  minutes: number;
}

// Represents 5 player time slots
export type OnCourtPlayerSlots = [
  PlayerTimeSlot,
  PlayerTimeSlot,
  PlayerTimeSlot,
  PlayerTimeSlot,
  PlayerTimeSlot
];

export interface QuarterSchedule {
  Q1: OnCourtPlayerSlots;
  Q2: OnCourtPlayerSlots;
  Q3: OnCourtPlayerSlots;
  Q4: OnCourtPlayerSlots;
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
