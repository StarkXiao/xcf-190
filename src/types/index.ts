export interface NoteData {
  time: number;
  lane: number;
  lyricChar: string;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface JudgeTiming {
  perfect: number;
  great: number;
  good: number;
  miss: number;
}

export interface DifficultyConfig {
  difficulty: Difficulty;
  label: string;
  noteSpeed: number;
  judgeTiming: JudgeTiming;
  starLevel: number;
}

export interface ChartData {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  lyrics: string;
  poemLines: string[];
  difficulties: {
    easy?: NoteData[];
    normal: NoteData[];
    hard?: NoteData[];
  };
  difficultyConfigs: {
    easy: DifficultyConfig;
    normal: DifficultyConfig;
    hard: DifficultyConfig;
  };
}

export interface BestScore {
  score: number;
  rating: string;
  maxCombo: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
}

export type BestScoreRecord = Record<string, Record<Difficulty, BestScore | null>>;

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

export const DEFAULT_JUDGE_TIMING: JudgeTiming = {
  perfect: 50,
  great: 100,
  good: 150,
  miss: 200
};

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    difficulty: 'easy',
    label: '简单',
    noteSpeed: 300,
    judgeTiming: {
      perfect: 80,
      great: 140,
      good: 200,
      miss: 260
    },
    starLevel: 2
  },
  normal: {
    difficulty: 'normal',
    label: '普通',
    noteSpeed: 400,
    judgeTiming: {
      perfect: 50,
      great: 100,
      good: 150,
      miss: 200
    },
    starLevel: 4
  },
  hard: {
    difficulty: 'hard',
    label: '困难',
    noteSpeed: 550,
    judgeTiming: {
      perfect: 35,
      great: 70,
      good: 110,
      miss: 160
    },
    starLevel: 6
  }
};

export const SCORE_VALUE = {
  perfect: 1000,
  great: 700,
  good: 300,
  miss: 0
} as const;

export const LANE_COUNT = 4;
