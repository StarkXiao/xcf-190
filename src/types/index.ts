export type NoteType = 'tap' | 'hold' | 'slide';

export interface NoteData {
  time: number;
  lane: number;
  lyricChar: string;
  type: NoteType;
  duration?: number;
  endLane?: number;
}

export interface NoteTypeStats {
  tap: { perfect: number; great: number; good: number; miss: number };
  hold: { perfect: number; great: number; good: number; miss: number };
  slide: { perfect: number; great: number; good: number; miss: number };
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
  accuracy: number;
  isPractice?: boolean;
}

export interface ScoreHistoryEntry {
  score: number;
  rating: string;
  maxCombo: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
  accuracy: number;
  timestamp: number;
  songId: string;
  songTitle: string;
  difficulty: Difficulty;
  isPractice?: boolean;
  practiceSpeed?: number;
}

export type BestScoreRecord = Record<string, Record<Difficulty, BestScore | null>>;
export type ScoreHistory = ScoreHistoryEntry[];

export type JudgeResult = 'perfect' | 'great' | 'good' | 'miss';

export interface JudgeEvent {
  result: JudgeResult;
  time: number;
  lane: number;
  lyricChar: string;
  noteType: NoteType;
  noteId: number;
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
  typeStats: NoteTypeStats;
}

export interface CharHitRecord {
  char: string;
  hit: boolean;
  result: JudgeResult;
  noteType: NoteType;
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

export const NOTE_TYPE_SCORE_MULTIPLIER: Record<NoteType, number> = {
  tap: 1,
  hold: 1.5,
  slide: 2
} as const;

export const createInitialNoteTypeStats = (): NoteTypeStats => ({
  tap: { perfect: 0, great: 0, good: 0, miss: 0 },
  hold: { perfect: 0, great: 0, good: 0, miss: 0 },
  slide: { perfect: 0, great: 0, good: 0, miss: 0 }
});

export const LANE_COUNT = 4;

export type GestureType = 'tap' | 'swipe' | 'hold';
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface KeyConfig {
  key: string;
  lane: number;
}

export interface GestureConfig {
  gesture: GestureType;
  lane: number;
  direction?: SwipeDirection;
  label: string;
  enabled: boolean;
}

export interface InputConfig {
  keyMap: Record<string, number>;
  gestures: GestureConfig[];
  swipeThreshold: number;
  holdThreshold: number;
}

export const DEFAULT_KEY_MAP: Record<string, number> = {
  'd': 0, 'D': 0,
  'f': 1, 'F': 1,
  'j': 2, 'J': 2,
  'k': 3, 'K': 3
};

export const DEFAULT_GESTURES: GestureConfig[] = [
  { gesture: 'tap', lane: 0, label: '点击轨道1', enabled: true },
  { gesture: 'tap', lane: 1, label: '点击轨道2', enabled: true },
  { gesture: 'tap', lane: 2, label: '点击轨道3', enabled: true },
  { gesture: 'tap', lane: 3, label: '点击轨道4', enabled: true },
  { gesture: 'swipe', lane: -1, direction: 'left', label: '左滑', enabled: true },
  { gesture: 'swipe', lane: -1, direction: 'right', label: '右滑', enabled: true },
  { gesture: 'hold', lane: -1, label: '长按', enabled: true }
];

export const DEFAULT_INPUT_CONFIG: InputConfig = {
  keyMap: { ...DEFAULT_KEY_MAP },
  gestures: [...DEFAULT_GESTURES],
  swipeThreshold: 50,
  holdThreshold: 200
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const RESERVED_KEYS = new Set([
  'Escape', ' ', 'Spacebar',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Tab', 'Enter', 'Backspace', 'Delete',
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'
]);

export type ResonanceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface ResonanceState {
  level: ResonanceLevel;
  progress: number;
  scoreMultiplier: number;
  effectIntensity: number;
  consecutiveHighJudgments: number;
  isActive: boolean;
}

export const RESONANCE_THRESHOLDS = {
  level1: 5,
  level2: 12,
  level3: 20,
  level4: 30,
  level5: 45
} as const;

export const RESONANCE_SCORE_MULTIPLIERS: Record<ResonanceLevel, number> = {
  0: 1.0,
  1: 1.1,
  2: 1.25,
  3: 1.45,
  4: 1.7,
  5: 2.0
} as const;

export const RESONANCE_EFFECT_INTENSITY: Record<ResonanceLevel, number> = {
  0: 0,
  1: 0.2,
  2: 0.4,
  3: 0.6,
  4: 0.8,
  5: 1.0
} as const;

export const HIGH_JUDGMENT_TYPES: JudgeResult[] = ['perfect', 'great'];

export const RESONANCE_DECAY_RATE = 0.002;
export const RESONANCE_MISS_PENALTY = 0.3;

export interface PracticeConfig {
  enabled: boolean;
  speedMultiplier: number;
  loopEnabled: boolean;
  loopStartBar: number;
  loopEndBar: number;
  showEarlyJudgeLine: boolean;
  earlyJudgeOffset: number;
}

export const DEFAULT_PRACTICE_CONFIG: PracticeConfig = {
  enabled: false,
  speedMultiplier: 1.0,
  loopEnabled: false,
  loopStartBar: 0,
  loopEndBar: 0,
  showEarlyJudgeLine: false,
  earlyJudgeOffset: 300
};

export interface BarInfo {
  barIndex: number;
  startTime: number;
  endTime: number;
  noteCount: number;
}

export interface PreloadedChart {
  song: ChartData;
  difficulty: Difficulty;
  notes: NoteData[];
  noteSpeed: number;
  poemLines: string[];
  loadedAt: number;
}

export type UnlockConditionType = 'rating' | 'accuracy' | 'both';

export interface UnlockCondition {
  type: UnlockConditionType;
  minRating?: string;
  minAccuracy?: number;
  difficulty?: Difficulty;
  description: string;
}

export interface SongUnlockInfo {
  songId: string;
  unlockCondition: UnlockCondition | null;
  isUnlocked: boolean;
  progress?: {
    currentRating?: string;
    currentAccuracy?: number;
    ratingMet: boolean;
    accuracyMet: boolean;
    overallProgress: number;
  };
}

export type RATING_ORDER = ['D', 'C', 'B', 'A', 'S'];

export const RATING_RANK: Record<string, number> = {
  'D': 0,
  'C': 1,
  'B': 2,
  'A': 3,
  'S': 4
};

export const CHAPTER_UNLOCK_KEY = 'floating-island-bookstore-chapter-unlock';

export interface CoverArt {
  id: string;
  songId: string;
  type: 'gradient' | 'image' | 'svg';
  data: string;
  width: number;
  height: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  createdAt: number;
}

export interface SongMetadata {
  id: string;
  title: string;
  artist: string;
  album?: string;
  composer?: string;
  lyricist?: string;
  arranger?: string;
  vocal?: string;
  illustrator?: string;
  bpm: number;
  duration: number;
  genre: string;
  tags: string[];
  description: string;
  poemLines: string[];
  lyrics: string;
  coverArt: CoverArt | null;
  releaseDate?: string;
  chapter?: string;
}

export interface ChartDifficultyConfig {
  difficulty: Difficulty;
  label: string;
  noteSpeed: number;
  judgeTiming: JudgeTiming;
  starLevel: number;
  noteCount: number;
  maxCombo: number;
  designer?: string;
  description?: string;
}

export interface SongChartEntry {
  metadata: SongMetadata;
  difficulties: {
    easy?: NoteData[];
    normal: NoteData[];
    hard?: NoteData[];
  };
  difficultyConfigs: {
    easy: ChartDifficultyConfig;
    normal: ChartDifficultyConfig;
    hard: ChartDifficultyConfig;
  };
  unlockCondition: UnlockCondition | null;
  prerequisiteSongId: string | null;
  isActive: boolean;
  sortOrder: number;
}

export type SongLibraryFilterType = 'all' | 'unlocked' | 'locked' | 'favorites' | 'unplayed';
export type SongLibrarySortType = 'default' | 'title' | 'artist' | 'bpm' | 'difficulty' | 'score' | 'recent';

export interface SongLibraryFilter {
  type: SongLibraryFilterType;
  searchQuery?: string;
  minStarLevel?: number;
  maxStarLevel?: number;
  genres?: string[];
  tags?: string[];
}

export interface SongLibrarySort {
  type: SongLibrarySortType;
  ascending: boolean;
}

export interface SongLibraryEntry {
  chart: SongChartEntry;
  bestScore?: BestScore;
  isFavorite: boolean;
  isNew: boolean;
  lastPlayedAt?: number;
  playCount: number;
}

export interface LibraryChangeEvent {
  type: 'add' | 'remove' | 'update' | 'reorder';
  songId?: string;
  timestamp: number;
}

export type LibraryChangeListener = (event: LibraryChangeEvent) => void;

export const DEFAULT_COVER_ART_SIZE = { width: 480, height: 270 };

export const DEFAULT_GENRES = ['古风', '流行', '摇滚', '电子', '古典', '民谣', '爵士', '其他'];

export const COVER_PRESET_THEMES: Array<{
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}> = [
  { name: '暮色晚霞', primary: '#FF6B9D', secondary: '#1A1A3A', accent: '#FFD700' },
  { name: '碧波清流', primary: '#6B9DFF', secondary: '#0A0A1A', accent: '#6BFF9D' },
  { name: '秋日金黄', primary: '#FF9D5B', secondary: '#1A1008', accent: '#FFD700' },
  { name: '翠竹幽篁', primary: '#6BFF9D', secondary: '#0A1A0A', accent: '#9B59B6' },
  { name: '紫玉烟霞', primary: '#9B59B6', secondary: '#1A0A1A', accent: '#FF6B9D' },
  { name: '深海幽蓝', primary: '#3498DB', secondary: '#0A0A1A', accent: '#E74C3C' },
  { name: '墨韵书香', primary: '#C0C0C0', secondary: '#1A1A1A', accent: '#FFD700' },
  { name: '桃夭灼灼', primary: '#E74C3C', secondary: '#1A0A0A', accent: '#FFD700' }
];

export interface LegacySongWithUnlock extends ChartData {
  unlockCondition: UnlockCondition | null;
  prerequisiteSongId: string | null;
}

export type EndingType = 'good' | 'normal' | 'bad';

export interface ChapterEnding {
  type: EndingType;
  title: string;
  description: string;
  poemFragment: string;
  minAverageRating: string;
  minAverageAccuracy: number;
}

export interface ChapterLevel {
  songId: string;
  order: number;
  poemReward: string;
  poemRewardCondition: {
    minRating: string;
    minAccuracy?: number;
  };
}

export interface StoryChapter {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  order: number;
  levels: ChapterLevel[];
  endings: ChapterEnding[];
  prerequisiteChapterId: string | null;
  prerequisiteCondition: {
    minRating: string;
    minAccuracy?: number;
  } | null;
  mapPosition: { x: number; y: number };
  mapIcon: string;
}

export interface CollectedPoem {
  poemLine: string;
  songId: string;
  chapterId: string;
  collectedAt: number;
  rating: string;
  accuracy: number;
}

export interface ChapterProgress {
  chapterId: string;
  isUnlocked: boolean;
  unlockedAt?: number;
  levelsCompleted: string[];
  collectedPoems: CollectedPoem[];
  currentEnding?: EndingType;
  completionCount: number;
  bestAverageRating?: string;
  bestAverageAccuracy?: number;
}

export interface StoryState {
  currentChapterId: string;
  chapters: Record<string, ChapterProgress>;
  totalCollectedPoems: number;
  lastPlayedSongId?: string;
  lastPlayedAt?: number;
}

export interface StoryStateChangeEvent {
  type: 'chapter_unlocked' | 'poem_collected' | 'ending_reached' | 'chapter_completed' | 'level_completed';
  chapterId: string;
  data?: {
    songId?: string;
    endingType?: EndingType;
    poemLine?: string;
    rating?: string;
    accuracy?: number;
  };
  timestamp: number;
}

export type StoryStateChangeListener = (event: StoryStateChangeEvent) => void;

export const STORY_STATE_STORAGE_KEY = 'floating-island-bookstore-story-state';
