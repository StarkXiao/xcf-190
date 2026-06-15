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

export type TaskType = 'daily' | 'weekly';
export type TaskConditionType = 'play_count' | 'perfect_count' | 'combo' | 'rating' | 'accuracy' | 'score' | 'unique_songs';

export interface SeasonTask {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  conditionType: TaskConditionType;
  targetValue: number;
  currentValue: number;
  rewardPoints: number;
  isCompleted: boolean;
  isClaimed: boolean;
  songId?: string;
  difficulty?: Difficulty;
  minRating?: string;
  minAccuracy?: number;
}

export interface SeasonReward {
  id: string;
  title: string;
  description: string;
  requiredPoints: number;
  rewardType: 'title' | 'frame' | 'song' | 'currency' | 'avatar';
  rewardValue: string;
  isClaimed: boolean;
}

export interface SeasonSong {
  songId: string;
  isUnlocked: boolean;
  unlockCondition: string;
}

export interface WeeklyRankEntry {
  rank: number;
  playerName: string;
  score: number;
  songId: string;
  songTitle: string;
  difficulty: Difficulty;
  rating: string;
  accuracy: number;
  maxCombo: number;
  timestamp: number;
}

export interface SeasonData {
  id: string;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  theme: string;
  accentColor: string;
  tasks: SeasonTask[];
  rewards: SeasonReward[];
  limitedSongs: SeasonSong[];
  weeklyRank: WeeklyRankEntry[];
  weeklyRankRefreshTime: number;
}

export interface PlayerSeasonState {
  seasonId: string;
  currentPoints: number;
  totalPoints: number;
  completedTasks: string[];
  claimedTasks: string[];
  claimedRewards: string[];
  unlockedSongs: string[];
  weeklyBestScore: number;
  weeklyBestSongId?: string;
  weeklyBestDifficulty?: Difficulty;
  lastWeeklyReset: number;
  dailyResetDate: string;
  playStats: {
    totalPlayCount: number;
    totalPerfectCount: number;
    totalMaxCombo: number;
    uniqueSongsPlayed: string[];
    songPlayCounts: Record<string, number>;
  };
}

export interface SeasonProgressInfo {
  currentPoints: number;
  totalPoints: number;
  completedTasks: number;
  totalTasks: number;
  unlockedRewards: number;
  totalRewards: number;
  currentLevel: number;
  levelProgress: number;
  nextLevelPoints: number;
}

export const SEASON_STATE_STORAGE_KEY = 'floating-island-bookstore-season-state';
export const SEASON_DATA_STORAGE_KEY = 'floating-island-bookstore-season-data';

export const SEASON_TASK_TYPES = {
  DAILY: 'daily' as const,
  WEEKLY: 'weekly' as const
};

export const WEEKLY_RESET_INTERVAL = 7 * 24 * 60 * 60 * 1000;
export const DAILY_RESET_HOUR = 5;

export type AccountType = 'guest' | 'registered';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  lastLoginAt: number;
  isCurrentDevice: boolean;
}

export interface AccountProfile {
  accountId: string;
  accountType: AccountType;
  username?: string;
  email?: string;
  displayName: string;
  avatar?: string;
  createdAt: number;
  lastLoginAt: number;
  devices: DeviceInfo[];
}

export interface GuestUpgradeState {
  isUpgrading: boolean;
  progress: number;
  error?: string;
}

export interface SaveVersion {
  version: number;
  timestamp: number;
  deviceId: string;
  checksum: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export type ConflictResolutionStrategy = 'local_first' | 'cloud_first' | 'manual' | 'merge';

export interface SaveConflict {
  id: string;
  field: string;
  localValue: any;
  cloudValue: any;
  resolved: boolean;
  resolution?: ConflictResolutionStrategy;
  resolvedValue?: any;
}

export interface CloudSaveData {
  accountId: string;
  saveVersion: SaveVersion;
  bestScores: BestScoreRecord;
  scoreHistory: ScoreHistory;
  storyState?: StoryState;
  seasonState?: PlayerSeasonState;
  inputConfig?: InputConfig;
  favorites: string[];
  settings: Record<string, any>;
}

export interface LocalSaveCache {
  saveData: CloudSaveData;
  lastSyncedAt: number;
  syncStatus: SyncStatus;
  pendingChanges: string[];
  conflicts: SaveConflict[];
  lastSyncError?: string;
}

export interface SyncResult {
  success: boolean;
  status: SyncStatus;
  mergedFields: string[];
  conflicts: SaveConflict[];
  error?: string;
}

export interface MigrationCode {
  code: string;
  accountId: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

export interface MigrationState {
  isMigrating: boolean;
  step: 'generate' | 'verify' | 'transfer' | 'complete';
  progress: number;
  error?: string;
  sourceDevice?: string;
  targetDevice?: string;
}

export interface RecoveryCheckpoint {
  id: string;
  timestamp: number;
  saveData: CloudSaveData;
  description: string;
}

export interface AccountState {
  isLoggedIn: boolean;
  currentAccount: AccountProfile | null;
  guestAccount: AccountProfile | null;
  upgradeState: GuestUpgradeState;
  migrationState: MigrationState;
}

export const ACCOUNT_STORAGE_KEY = 'floating-island-bookstore-account';
export const LOCAL_SAVE_CACHE_KEY = 'floating-island-bookstore-local-save';
export const RECOVERY_CHECKPOINTS_KEY = 'floating-island-bookstore-recovery-checkpoints';
export const MIGRATION_CODE_KEY = 'floating-island-bookstore-migration-code';

export const SAVE_VERSION_INITIAL = 1;
export const MIGRATION_CODE_EXPIRY_HOURS = 24;
export const MAX_RECOVERY_CHECKPOINTS = 10;

export type ChallengeStatus = 'pending' | 'accepted' | 'completed' | 'expired' | 'rejected';

export interface FriendInfo {
  playerId: string;
  displayName: string;
  avatar?: string;
  addedAt: number;
  lastActiveAt: number;
}

export interface ChallengeInvitation {
  challengeId: string;
  challengerId: string;
  challengerName: string;
  challengedId: string;
  challengedName: string;
  songId: string;
  songTitle: string;
  difficulty: Difficulty;
  status: ChallengeStatus;
  createdAt: number;
  expiresAt: number;
  acceptedAt?: number;
  completedAt?: number;
}

export interface BattlePlayerResult {
  playerId: string;
  displayName: string;
  score: number;
  rating: string;
  maxCombo: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
  accuracy: number;
  completedAt: number;
}

export interface BattleComparison {
  challengeId: string;
  songId: string;
  songTitle: string;
  difficulty: Difficulty;
  challengerResult: BattlePlayerResult | null;
  challengedResult: BattlePlayerResult | null;
  winnerId: string | null;
  scoreDiff: number;
  isDraw: boolean;
}

export interface ReplayJudgeEvent {
  result: JudgeResult;
  time: number;
  lane: number;
  lyricChar: string;
  noteType: NoteType;
  noteId: number;
}

export interface ReplayData {
  challengeId: string;
  playerId: string;
  songId: string;
  difficulty: Difficulty;
  judgeEvents: ReplayJudgeEvent[];
  totalNotes: number;
  recordedAt: number;
}

export interface FriendBattleState {
  friends: FriendInfo[];
  challenges: ChallengeInvitation[];
  battleResults: BattleComparison[];
  replayData: Record<string, ReplayData>;
}

export const FRIEND_BATTLE_STORAGE_KEY = 'floating-island-bookstore-friend-battle';
export const CHALLENGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_CHALLENGES = 50;
export const MAX_REPLAY_DATA = 20;

export type CosmeticType = 'theme' | 'track_effect' | 'poem_frame' | 'note_skin' | 'combo_effect' | 'judge_effect';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type CurrencyType = 'coin' | 'jade' | 'star';

export interface CurrencyAmount {
  coin: number;
  jade: number;
  star: number;
}

export interface CosmeticUnlockCondition {
  type: 'purchase' | 'rating' | 'accuracy' | 'combo' | 'chapter_complete' | 'poem_collect' | 'season_reward';
  cost?: Partial<CurrencyAmount>;
  minRating?: string;
  minAccuracy?: number;
  minCombo?: number;
  chapterId?: string;
  poemCount?: number;
  seasonId?: string;
  description: string;
}

export interface ThemeSkin {
  id: string;
  name: string;
  type: 'theme';
  rarity: Rarity;
  description: string;
  previewImage?: string;
  colors: {
    background: string;
    backgroundGradient?: [string, string];
    laneBackgrounds: string[];
    laneBorders: string[];
    judgeLine: string;
    judgeLineGlow: string;
    uiPrimary: string;
    uiSecondary: string;
    uiAccent: string;
  };
  particles?: {
    ambientColor?: string;
    hitColor?: string;
    comboColor?: string;
  };
  unlockCondition: CosmeticUnlockCondition;
  isDefault: boolean;
}

export interface TrackEffect {
  id: string;
  name: string;
  type: 'track_effect';
  rarity: Rarity;
  description: string;
  previewImage?: string;
  laneGlow: {
    color: string;
    alpha: number;
    blur: number;
  };
  hitEffect: {
    particleCount: number;
    particleColors: string[];
    particleSpeed: number;
    particleSize: [number, number];
    ringColor: string;
    ringExpandSpeed: number;
  };
  holdEffect: {
    color: string;
    pulseSpeed: number;
  };
  slideEffect: {
    trailColor: string;
    trailWidth: number;
    trailAlpha: number;
  };
  unlockCondition: CosmeticUnlockCondition;
  isDefault: boolean;
}

export interface PoemFrame {
  id: string;
  name: string;
  type: 'poem_frame';
  rarity: Rarity;
  description: string;
  previewImage?: string;
  frameStyle: {
    borderColor: string;
    borderWidth: number;
    backgroundColor: string;
    backgroundAlpha: number;
    cornerRadius: number;
    decoration?: {
      type: 'corner' | 'border' | 'pattern';
      color: string;
      pattern?: string;
    };
  };
  textStyle: {
    fontFamily: string;
    fontSize: number;
    color: string;
    strokeColor?: string;
    strokeWidth?: number;
    shadow?: boolean;
    shadowColor?: string;
    shadowBlur?: number;
  };
  unlockCondition: CosmeticUnlockCondition;
  isDefault: boolean;
}

export interface NoteSkin {
  id: string;
  name: string;
  type: 'note_skin';
  rarity: Rarity;
  description: string;
  previewImage?: string;
  tap: {
    width: number;
    height: number;
    cornerRadius: number;
    fillColor: string;
    borderColor: string;
    borderWidth: number;
    useLaneColor: boolean;
  };
  hold: {
    bodyColor: string;
    bodyAlpha: number;
    headColor: string;
    borderColor: string;
    stripeColor: string;
    stripeInterval: number;
  };
  slide: {
    bodyColor: string;
    bodyAlpha: number;
    borderColor: string;
    arrowColor: string;
  };
  unlockCondition: CosmeticUnlockCondition;
  isDefault: boolean;
}

export interface ComboEffect {
  id: string;
  name: string;
  type: 'combo_effect';
  rarity: Rarity;
  description: string;
  previewImage?: string;
  textStyle: {
    fontFamily: string;
    fontSize: [number, number];
    colorStages: Record<string, string>;
    strokeColor: string;
    strokeWidth: number;
    shadow: boolean;
    shadowColorStages?: Record<string, string>;
    shadowBlur: number;
  };
  animation: {
    scaleBoost: number;
    bounceIntensity: number;
    glowIntensity: number;
  };
  unlockCondition: CosmeticUnlockCondition;
  isDefault: boolean;
}

export interface JudgeEffect {
  id: string;
  name: string;
  type: 'judge_effect';
  rarity: Rarity;
  description: string;
  previewImage?: string;
  perfect: JudgeEffectStyle;
  great: JudgeEffectStyle;
  good: JudgeEffectStyle;
  miss: JudgeEffectStyle;
  unlockCondition: CosmeticUnlockCondition;
  isDefault: boolean;
}

export interface JudgeEffectStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  animation: {
    floatSpeed: number;
    floatDistance: number;
    scaleBoost: number;
    fadeDuration: number;
  };
  prefix?: string;
}

export type CosmeticItem = ThemeSkin | TrackEffect | PoemFrame | NoteSkin | ComboEffect | JudgeEffect;

export interface ShopItem {
  id: string;
  cosmeticId: string;
  cosmeticType: CosmeticType;
  price: Partial<CurrencyAmount>;
  discount?: number;
  discountEndTime?: number;
  isFeatured: boolean;
  featuredOrder?: number;
  isLimited: boolean;
  limitedEndTime?: number;
  stock?: number;
  soldCount: number;
}

export interface PurchaseRecord {
  cosmeticId: string;
  purchasedAt: number;
  price: Partial<CurrencyAmount>;
}

export interface PlayerCosmeticState {
  unlockedCosmetics: string[];
  purchases: PurchaseRecord[];
  currentSkin: {
    theme: string;
    trackEffect: string;
    poemFrame: string;
    noteSkin: string;
    comboEffect: string;
    judgeEffect: string;
  };
  currency: CurrencyAmount;
  purchaseHistory: string[];
}

export interface SkinConfig {
  theme: ThemeSkin;
  trackEffect: TrackEffect;
  poemFrame: PoemFrame;
  noteSkin: NoteSkin;
  comboEffect: ComboEffect;
  judgeEffect: JudgeEffect;
}

export type CosmeticFilterType = 'all' | 'unlocked' | 'locked' | 'equipped' | CosmeticType;
export type CosmeticSortType = 'rarity' | 'name' | 'type' | 'newest';

export interface CosmeticFilter {
  type: CosmeticFilterType;
  rarity?: Rarity[];
  searchQuery?: string;
}

export const SKIN_STATE_STORAGE_KEY = 'floating-island-bookstore-skin-state';
export const SHOP_DATA_STORAGE_KEY = 'floating-island-bookstore-shop-data';

export const DEFAULT_CURRENCY: CurrencyAmount = {
  coin: 1000,
  jade: 50,
  star: 0
};

export const DEFAULT_SKIN_STATE: PlayerCosmeticState = {
  unlockedCosmetics: ['default_theme', 'default_track', 'default_frame', 'default_note', 'default_combo', 'default_judge'],
  purchases: [],
  currentSkin: {
    theme: 'default_theme',
    trackEffect: 'default_track',
    poemFrame: 'default_frame',
    noteSkin: 'default_note',
    comboEffect: 'default_combo',
    judgeEffect: 'default_judge'
  },
  currency: { ...DEFAULT_CURRENCY },
  purchaseHistory: []
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B'
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说'
};

export const RARITY_RANK: Record<string, number> = {
  D: 0,
  C: 1,
  B: 2,
  A: 3,
  S: 4,
  SS: 5,
  SSS: 6,
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3
};

export const CURRENCY_LABELS: Record<CurrencyType, string> = {
  coin: '金币',
  jade: '玉石',
  star: '星辰'
};

export const CURRENCY_ICONS: Record<CurrencyType, string> = {
  coin: '🪙',
  jade: '💎',
  star: '⭐'
};

export const COSMETIC_TYPE_LABELS: Record<CosmeticType, string> = {
  theme: '主题皮肤',
  track_effect: '轨道特效',
  poem_frame: '诗句边框',
  note_skin: '音符外观',
  combo_effect: '连击特效',
  judge_effect: '判定特效'
};
