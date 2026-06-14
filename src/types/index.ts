export interface NoteData {
  time: number;
  lane: number;
  lyricChar: string;
}

export interface ChartData {
  title: string;
  bpm: number;
  noteSpeed: number;
  lyrics: string;
  notes: NoteData[];
}

export type JudgeResult = 'perfect' | 'great' | 'good' | 'miss';

export interface JudgeEvent {
  result: JudgeResult;
  time: number;
  lane: number;
  lyricChar: string;
}

export interface ScoreData {
  perfect: number;
  great: number;
  good: number;
  miss: number;
  combo: number;
  maxCombo: number;
  score: number;
  rating: string;
}

export interface CharHitRecord {
  char: string;
  hit: boolean;
  result: JudgeResult;
}

export interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  score: ScoreData;
  litChars: string[];
  charRecords: CharHitRecord[];
}

export const JUDGE_TIMING = {
  perfect: 50,
  great: 100,
  good: 150,
  miss: 200
} as const;

export const SCORE_VALUE = {
  perfect: 1000,
  great: 700,
  good: 300,
  miss: 0
} as const;

export const LANE_COUNT = 4;
