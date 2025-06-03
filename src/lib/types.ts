
export interface Player {
  id: string;
  name: string;
  jerseyNumber?: string;
  position?: string;
}

export interface PlayerTimeSegment {
  id: string; // Unique ID for this segment instance
  playerId: string | null;
  minutes: number;
}

export type CourtPositionSegments = PlayerTimeSegment[]; // An array of player segments for one court position

// Represents 5 court positions, each with an array of player segments
export type OnCourtPositions = [
  CourtPositionSegments,
  CourtPositionSegments,
  CourtPositionSegments,
  CourtPositionSegments,
  CourtPositionSegments
];

export interface QuarterSchedule {
  Q1: OnCourtPositions;
  Q2: OnCourtPositions;
  Q3: OnCourtPositions;
  Q4: OnCourtPositions;
}

export type QuarterKey = keyof QuarterSchedule;

export const QUARTERS: QuarterKey[] = ["Q1", "Q2", "Q3", "Q4"];
export const PLAYERS_ON_COURT = 5; // This now represents the number of distinct court positions
export const QUARTER_DURATION_MINUTES = 10;

export interface GamePlan {
  id: string;
  name: string;
  players: Player[];
  schedule: QuarterSchedule;
}

export interface DraggedPlayerInfo {
  playerId: string;
  sourceType: 'list' | 'timeline';
  sourceQuarter?: QuarterKey;
  sourcePositionIndex?: number; // Index of the court position (0-4)
  sourceSegmentId?: string;     // ID of the specific PlayerTimeSegment being dragged
}

