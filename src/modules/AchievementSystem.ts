import {
  AchievementCategory,
  AchievementConditionType,
  AchievementDefinition,
  AchievementLogEntry,
  AchievementPlayerState,
  AchievementReward,
  AchievementUnlockState,
  MissionDefinition,
  MissionLogEntry,
  MissionPlayerState,
  MissionProgress,
  SettlementResult,
  Difficulty,
  ScoreData,
  RATING_RANK,
  ACHIEVEMENT_STATE_STORAGE_KEY,
  ACHIEVEMENT_LOG_STORAGE_KEY,
  MISSION_LOG_STORAGE_KEY,
  MISSION_STATE_STORAGE_KEY,
  MISSION_DAILY_COUNT,
  MISSION_WEEKLY_COUNT,
} from '../types';
import { ScoreStorage } from './ScoreStorage';

const MAX_LOG_ENTRIES = 500;
const DAILY_RESET_HOUR = 5;
const WEEKLY_RESET_INTERVAL = 7 * 24 * 60 * 60 * 1000;

export class AchievementSystem {
  private static instance: AchievementSystem;
  private achievements: AchievementDefinition[];
  private missionPool: MissionDefinition[];
  private playerState: AchievementPlayerState;
  private missionState: MissionPlayerState;
  private log: AchievementLogEntry[];
  private missionLog: MissionLogEntry[];
  private isInitialized: boolean = false;

  private constructor() {
    this.achievements = this.defineAchievements();
    this.missionPool = this.defineMissionPool();
    this.playerState = this.createDefaultPlayerState();
    this.missionState = this.createDefaultMissionState();
    this.log = [];
    this.missionLog = [];
    this.initialize();
  }

  public static getInstance(): AchievementSystem {
    if (!AchievementSystem.instance) {
      AchievementSystem.instance = new AchievementSystem();
    }
    return AchievementSystem.instance;
  }

  private initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.loadPlayerState();
    this.loadMissionState();
    this.loadLog();
    this.loadMissionLog();
    this.checkAndResetMissions();
    this.rebuildCumulativeStats();
    this.savePlayerState();
    this.saveMissionState();
  }

  private defineAchievements(): AchievementDefinition[] {
    return [
      {
        id: 'ach-combo-10',
        category: 'combo',
        rarity: 'bronze',
        title: '初露锋芒',
        description: '单局最高连击达到10',
        conditions: [{ type: 'max_combo', targetValue: 10 }],
        reward: { coin: 100 }
      },
      {
        id: 'ach-combo-30',
        category: 'combo',
        rarity: 'bronze',
        title: '连击新星',
        description: '单局最高连击达到30',
        conditions: [{ type: 'max_combo', targetValue: 30 }],
        reward: { coin: 200, jade: 5 }
      },
      {
        id: 'ach-combo-50',
        category: 'combo',
        rarity: 'silver',
        title: '连击达人',
        description: '单局最高连击达到50',
        conditions: [{ type: 'max_combo', targetValue: 50 }],
        reward: { coin: 500, jade: 10 }
      },
      {
        id: 'ach-combo-100',
        category: 'combo',
        rarity: 'gold',
        title: '百连击',
        description: '单局最高连击达到100',
        conditions: [{ type: 'max_combo', targetValue: 100 }],
        reward: { coin: 1000, jade: 30, star: 1 }
      },
      {
        id: 'ach-combo-200',
        category: 'combo',
        rarity: 'diamond',
        title: '连击传说',
        description: '单局最高连击达到200',
        conditions: [{ type: 'max_combo', targetValue: 200 }],
        reward: { coin: 2000, jade: 50, star: 3 }
      },
      {
        id: 'ach-combo-500',
        category: 'combo',
        rarity: 'diamond',
        title: '连击之神',
        description: '单局最高连击达到500',
        conditions: [{ type: 'max_combo', targetValue: 500 }],
        reward: { coin: 5000, jade: 100, star: 5 },
        hidden: true
      },
      {
        id: 'ach-rating-c',
        category: 'rating',
        rarity: 'bronze',
        title: '初学乍练',
        description: '达成C级评价',
        conditions: [{ type: 'rating_achieved', targetValue: 1, minRating: 'C' }],
        reward: { coin: 50 }
      },
      {
        id: 'ach-rating-b',
        category: 'rating',
        rarity: 'bronze',
        title: '渐入佳境',
        description: '达成B级评价',
        conditions: [{ type: 'rating_achieved', targetValue: 1, minRating: 'B' }],
        reward: { coin: 150, jade: 5 }
      },
      {
        id: 'ach-rating-a',
        category: 'rating',
        rarity: 'silver',
        title: '技艺精湛',
        description: '达成A级评价',
        conditions: [{ type: 'rating_achieved', targetValue: 1, minRating: 'A' }],
        reward: { coin: 400, jade: 15 }
      },
      {
        id: 'ach-rating-s',
        category: 'rating',
        rarity: 'gold',
        title: '诗篇大师',
        description: '达成S级评价',
        conditions: [{ type: 'rating_achieved', targetValue: 1, minRating: 'S' }],
        reward: { coin: 800, jade: 30, star: 1 }
      },
      {
        id: 'ach-accuracy-70',
        category: 'accuracy',
        rarity: 'bronze',
        title: '及格线',
        description: '单局准确率达到70%',
        conditions: [{ type: 'accuracy_threshold', targetValue: 70 }],
        reward: { coin: 100 }
      },
      {
        id: 'ach-accuracy-80',
        category: 'accuracy',
        rarity: 'bronze',
        title: '稳步前行',
        description: '单局准确率达到80%',
        conditions: [{ type: 'accuracy_threshold', targetValue: 80 }],
        reward: { coin: 200, jade: 5 }
      },
      {
        id: 'ach-accuracy-90',
        category: 'accuracy',
        rarity: 'silver',
        title: '精准演奏',
        description: '单局准确率达到90%',
        conditions: [{ type: 'accuracy_threshold', targetValue: 90 }],
        reward: { coin: 500, jade: 15 }
      },
      {
        id: 'ach-accuracy-95',
        category: 'accuracy',
        rarity: 'gold',
        title: '近乎完美',
        description: '单局准确率达到95%',
        conditions: [{ type: 'accuracy_threshold', targetValue: 95 }],
        reward: { coin: 1000, jade: 30, star: 1 }
      },
      {
        id: 'ach-accuracy-100',
        category: 'accuracy',
        rarity: 'diamond',
        title: '完美无瑕',
        description: '单局准确率达到100%',
        conditions: [{ type: 'accuracy_threshold', targetValue: 100 }],
        reward: { coin: 3000, jade: 80, star: 5 },
        hidden: true
      },
      {
        id: 'ach-song-1',
        category: 'song_completion',
        rarity: 'bronze',
        title: '诗篇初启',
        description: '完成1首不同曲目',
        conditions: [{ type: 'unique_songs_played', targetValue: 1 }],
        reward: { coin: 100 }
      },
      {
        id: 'ach-song-5',
        category: 'song_completion',
        rarity: 'bronze',
        title: '博闻强记',
        description: '完成5首不同曲目',
        conditions: [{ type: 'unique_songs_played', targetValue: 5 }],
        reward: { coin: 300, jade: 10 }
      },
      {
        id: 'ach-song-10',
        category: 'song_completion',
        rarity: 'silver',
        title: '诗海遨游',
        description: '完成10首不同曲目',
        conditions: [{ type: 'unique_songs_played', targetValue: 10 }],
        reward: { coin: 600, jade: 20 }
      },
      {
        id: 'ach-song-20',
        category: 'song_completion',
        rarity: 'gold',
        title: '诗篇集大成',
        description: '完成20首不同曲目',
        conditions: [{ type: 'unique_songs_played', targetValue: 20 }],
        reward: { coin: 1500, jade: 40, star: 2 }
      },
      {
        id: 'ach-perfect-30',
        category: 'perfect',
        rarity: 'bronze',
        title: '完美瞬间',
        description: '单局获得30个Perfect',
        conditions: [{ type: 'perfect_count_single', targetValue: 30 }],
        reward: { coin: 200, jade: 5 }
      },
      {
        id: 'ach-perfect-50',
        category: 'perfect',
        rarity: 'silver',
        title: '完美乐章',
        description: '单局获得50个Perfect',
        conditions: [{ type: 'perfect_count_single', targetValue: 50 }],
        reward: { coin: 500, jade: 15 }
      },
      {
        id: 'ach-perfect-100',
        category: 'perfect',
        rarity: 'gold',
        title: '完美风暴',
        description: '单局获得100个Perfect',
        conditions: [{ type: 'perfect_count_single', targetValue: 100 }],
        reward: { coin: 1000, jade: 30, star: 1 }
      },
      {
        id: 'ach-fc',
        category: 'perfect',
        rarity: 'gold',
        title: '全连击',
        description: '一局中无任何Miss完成曲目',
        conditions: [{ type: 'full_combo', targetValue: 1 }],
        reward: { coin: 800, jade: 25, star: 1 }
      },
      {
        id: 'ach-ap',
        category: 'perfect',
        rarity: 'diamond',
        title: '全部完美',
        description: '一局中全部判定均为Perfect',
        conditions: [{ type: 'all_perfect_single', targetValue: 1 }],
        reward: { coin: 3000, jade: 80, star: 5 },
        hidden: true
      },
      {
        id: 'ach-score-50k',
        category: 'score',
        rarity: 'bronze',
        title: '半万之师',
        description: '单局得分达到50000',
        conditions: [{ type: 'score_threshold', targetValue: 50000 }],
        reward: { coin: 200 }
      },
      {
        id: 'ach-score-100k',
        category: 'score',
        rarity: 'silver',
        title: '十万里程',
        description: '单局得分达到100000',
        conditions: [{ type: 'score_threshold', targetValue: 100000 }],
        reward: { coin: 500, jade: 15 }
      },
      {
        id: 'ach-score-200k',
        category: 'score',
        rarity: 'gold',
        title: '二十万高峰',
        description: '单局得分达到200000',
        conditions: [{ type: 'score_threshold', targetValue: 200000 }],
        reward: { coin: 1000, jade: 30, star: 1 }
      },
      {
        id: 'ach-play-10',
        category: 'play_count',
        rarity: 'bronze',
        title: '初次登台',
        description: '累计完成10场演奏',
        conditions: [{ type: 'total_play_count', targetValue: 10 }],
        reward: { coin: 150, jade: 5 }
      },
      {
        id: 'ach-play-50',
        category: 'play_count',
        rarity: 'silver',
        title: '常客驾到',
        description: '累计完成50场演奏',
        conditions: [{ type: 'total_play_count', targetValue: 50 }],
        reward: { coin: 500, jade: 15 }
      },
      {
        id: 'ach-play-100',
        category: 'play_count',
        rarity: 'gold',
        title: '演奏狂人',
        description: '累计完成100场演奏',
        conditions: [{ type: 'total_play_count', targetValue: 100 }],
        reward: { coin: 1000, jade: 30, star: 1 }
      },
      {
        id: 'ach-play-500',
        category: 'play_count',
        rarity: 'diamond',
        title: '不朽乐章',
        description: '累计完成500场演奏',
        conditions: [{ type: 'total_play_count', targetValue: 500 }],
        reward: { coin: 3000, jade: 80, star: 3 }
      },
      {
        id: 'ach-hard-clear',
        category: 'difficulty',
        rarity: 'gold',
        title: '勇者无畏',
        description: '通关困难难度曲目',
        conditions: [{ type: 'clear_difficulty', targetValue: 1, difficulty: 'hard' }],
        reward: { coin: 800, jade: 25, star: 1 }
      },
      {
        id: 'ach-hard-s',
        category: 'difficulty',
        rarity: 'diamond',
        title: '困难征服者',
        description: '困难难度达成S级评价',
        conditions: [
          { type: 'clear_difficulty', targetValue: 1, difficulty: 'hard' },
          { type: 'rating_achieved', targetValue: 1, minRating: 'S' }
        ],
        reward: { coin: 2000, jade: 60, star: 3 }
      },
      {
        id: 'ach-chapter-1',
        category: 'story',
        rarity: 'silver',
        title: '诗篇启程',
        description: '完成1个章节',
        conditions: [{ type: 'chapter_completed', targetValue: 1 }],
        reward: { coin: 500, jade: 15 }
      },
      {
        id: 'ach-chapter-3',
        category: 'story',
        rarity: 'gold',
        title: '故事探索者',
        description: '完成3个章节',
        conditions: [{ type: 'chapter_completed', targetValue: 3 }],
        reward: { coin: 1000, jade: 30, star: 1 }
      },
      {
        id: 'ach-poem-5',
        category: 'collection',
        rarity: 'bronze',
        title: '诗行拾遗',
        description: '收集5句诗',
        conditions: [{ type: 'poems_collected', targetValue: 5 }],
        reward: { coin: 200, jade: 5 }
      },
      {
        id: 'ach-poem-15',
        category: 'collection',
        rarity: 'silver',
        title: '诗集编撰',
        description: '收集15句诗',
        conditions: [{ type: 'poems_collected', targetValue: 15 }],
        reward: { coin: 500, jade: 15 }
      },
      {
        id: 'ach-poem-30',
        category: 'collection',
        rarity: 'gold',
        title: '诗词大家',
        description: '收集30句诗',
        conditions: [{ type: 'poems_collected', targetValue: 30 }],
        reward: { coin: 1000, jade: 30, star: 1 }
      },
      {
        id: 'ach-total-perfect-500',
        category: 'perfect',
        rarity: 'silver',
        title: '完美积累',
        description: '累计获得500个Perfect',
        conditions: [{ type: 'total_perfect_count', targetValue: 500 }],
        reward: { coin: 400, jade: 10 }
      },
      {
        id: 'ach-total-perfect-2000',
        category: 'perfect',
        rarity: 'gold',
        title: '完美之路',
        description: '累计获得2000个Perfect',
        conditions: [{ type: 'total_perfect_count', targetValue: 2000 }],
        reward: { coin: 1000, jade: 25, star: 1 }
      },
    ];
  }

  private defineMissionPool(): MissionDefinition[] {
    return [
      {
        id: 'mis-daily-play-1',
        type: 'daily',
        title: '每日初奏',
        description: '完成1场演奏',
        conditionType: 'play_count',
        targetValue: 1,
        reward: { coin: 80, jade: 3 }
      },
      {
        id: 'mis-daily-play-3',
        type: 'daily',
        title: '每日演奏',
        description: '完成3场演奏',
        conditionType: 'play_count',
        targetValue: 3,
        reward: { coin: 150, jade: 5 }
      },
      {
        id: 'mis-daily-perfect-30',
        type: 'daily',
        title: '完美追求',
        description: '单局获得30个Perfect',
        conditionType: 'perfect_count',
        targetValue: 30,
        reward: { coin: 120, jade: 4 }
      },
      {
        id: 'mis-daily-perfect-50',
        type: 'daily',
        title: '完美主义者',
        description: '单局获得50个Perfect',
        conditionType: 'perfect_count',
        targetValue: 50,
        reward: { coin: 200, jade: 8 }
      },
      {
        id: 'mis-daily-combo-20',
        type: 'daily',
        title: '连击热身',
        description: '单局最高连击达到20',
        conditionType: 'max_combo',
        targetValue: 20,
        reward: { coin: 100, jade: 3 }
      },
      {
        id: 'mis-daily-combo-50',
        type: 'daily',
        title: '连击突破',
        description: '单局最高连击达到50',
        conditionType: 'max_combo',
        targetValue: 50,
        reward: { coin: 180, jade: 6 }
      },
      {
        id: 'mis-daily-rating-b',
        type: 'daily',
        title: '出色发挥',
        description: '达成B级及以上评价',
        conditionType: 'rating',
        targetValue: 1,
        minRating: 'B',
        reward: { coin: 100, jade: 4 }
      },
      {
        id: 'mis-daily-rating-a',
        type: 'daily',
        title: '精英表现',
        description: '达成A级及以上评价',
        conditionType: 'rating',
        targetValue: 1,
        minRating: 'A',
        reward: { coin: 200, jade: 8 }
      },
      {
        id: 'mis-daily-accuracy-85',
        type: 'daily',
        title: '稳扎稳打',
        description: '单局准确率达到85%',
        conditionType: 'accuracy',
        targetValue: 85,
        reward: { coin: 120, jade: 4 }
      },
      {
        id: 'mis-daily-accuracy-90',
        type: 'daily',
        title: '精确打击',
        description: '单局准确率达到90%',
        conditionType: 'accuracy',
        targetValue: 90,
        reward: { coin: 200, jade: 8 }
      },
      {
        id: 'mis-daily-score-50k',
        type: 'daily',
        title: '半万目标',
        description: '单局得分达到50000',
        conditionType: 'score',
        targetValue: 50000,
        reward: { coin: 150, jade: 5 }
      },
      {
        id: 'mis-daily-fc',
        type: 'daily',
        title: '零失误挑战',
        description: '单局达成全连击(无Miss)',
        conditionType: 'full_combo',
        targetValue: 1,
        reward: { coin: 300, jade: 15 }
      },
      {
        id: 'mis-weekly-play-10',
        type: 'weekly',
        title: '周常修炼',
        description: '本周完成10场演奏',
        conditionType: 'play_count',
        targetValue: 10,
        reward: { coin: 400, jade: 15 }
      },
      {
        id: 'mis-weekly-play-20',
        type: 'weekly',
        title: '勤奋乐师',
        description: '本周完成20场演奏',
        conditionType: 'play_count',
        targetValue: 20,
        reward: { coin: 600, jade: 25 }
      },
      {
        id: 'mis-weekly-unique-3',
        type: 'weekly',
        title: '诗篇探索',
        description: '本周游玩3首不同曲目',
        conditionType: 'unique_songs',
        targetValue: 3,
        reward: { coin: 300, jade: 10 }
      },
      {
        id: 'mis-weekly-unique-5',
        type: 'weekly',
        title: '博览群诗',
        description: '本周游玩5首不同曲目',
        conditionType: 'unique_songs',
        targetValue: 5,
        reward: { coin: 500, jade: 20 }
      },
      {
        id: 'mis-weekly-rating-a',
        type: 'weekly',
        title: 'A级挑战',
        description: '达成A级及以上评价',
        conditionType: 'rating',
        targetValue: 1,
        minRating: 'A',
        reward: { coin: 300, jade: 12 }
      },
      {
        id: 'mis-weekly-rating-s',
        type: 'weekly',
        title: 'S级追求',
        description: '达成S级评价',
        conditionType: 'rating',
        targetValue: 1,
        minRating: 'S',
        reward: { coin: 600, jade: 30, star: 1 }
      },
      {
        id: 'mis-weekly-combo-80',
        type: 'weekly',
        title: '连击风暴',
        description: '单局最高连击达到80',
        conditionType: 'max_combo',
        targetValue: 80,
        reward: { coin: 400, jade: 15 }
      },
      {
        id: 'mis-weekly-accuracy-92',
        type: 'weekly',
        title: '精准大师',
        description: '单局准确率达到92%',
        conditionType: 'accuracy',
        targetValue: 92,
        reward: { coin: 450, jade: 18 }
      },
      {
        id: 'mis-weekly-score-100k',
        type: 'weekly',
        title: '十万挑战',
        description: '单局得分达到100000',
        conditionType: 'score',
        targetValue: 100000,
        reward: { coin: 500, jade: 20 }
      },
      {
        id: 'mis-weekly-fc',
        type: 'weekly',
        title: '全连击周挑战',
        description: '单局达成全连击(无Miss)',
        conditionType: 'full_combo',
        targetValue: 1,
        reward: { coin: 500, jade: 25, star: 1 }
      },
    ];
  }

  private createDefaultPlayerState(): AchievementPlayerState {
    return {
      unlockedAchievements: {},
      totalAchievementPoints: 0,
      cumulativeStats: {
        totalPlayCount: 0,
        totalPerfectCount: 0,
        totalMaxCombo: 0,
        uniqueSongsPlayed: [],
        highestAccuracy: 0,
        highestScore: 0,
        chaptersCompleted: [],
        poemsCollected: 0,
        ratingsAchieved: [],
        difficultiesCleared: [],
      }
    };
  }

  private createDefaultMissionState(): MissionPlayerState {
    return {
      dailyMissions: [],
      weeklyMissions: [],
      dailyResetDate: this.getTodayDateString(),
      weeklyResetTime: Date.now(),
      dailyStats: {
        playCount: 0,
        perfectCount: 0,
        maxCombo: 0,
        uniqueSongs: [],
      },
      weeklyStats: {
        playCount: 0,
        perfectCount: 0,
        maxCombo: 0,
        uniqueSongs: [],
      }
    };
  }

  private getTodayDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  private rebuildCumulativeStats(): void {
    const history = ScoreStorage.getScoreHistory();

    this.playerState.cumulativeStats.totalPlayCount = history.length;

    let totalPerfect = 0;
    let maxCombo = 0;
    let highestAccuracy = 0;
    let highestScore = 0;
    const uniqueSongs = new Set<string>();
    const ratings = new Set<string>();
    const difficulties = new Set<Difficulty>();

    for (const entry of history) {
      totalPerfect += entry.perfect;
      maxCombo = Math.max(maxCombo, entry.maxCombo);
      highestAccuracy = Math.max(highestAccuracy, entry.accuracy);
      highestScore = Math.max(highestScore, entry.score);
      uniqueSongs.add(entry.songId);
      ratings.add(entry.rating);
      difficulties.add(entry.difficulty);
    }

    this.playerState.cumulativeStats.totalPerfectCount = totalPerfect;
    this.playerState.cumulativeStats.totalMaxCombo = maxCombo;
    this.playerState.cumulativeStats.uniqueSongsPlayed = [...uniqueSongs];
    this.playerState.cumulativeStats.highestAccuracy = highestAccuracy;
    this.playerState.cumulativeStats.highestScore = highestScore;
    this.playerState.cumulativeStats.ratingsAchieved = [...ratings];
    this.playerState.cumulativeStats.difficultiesCleared = [...difficulties];
  }

  private checkAndResetMissions(): void {
    this.checkAndResetDailyMissions();
    this.checkAndResetWeeklyMissions();
  }

  private checkAndResetDailyMissions(): void {
    const now = new Date();
    const today = this.getTodayDateString();
    const currentHour = now.getHours();

    if (this.missionState.dailyResetDate !== today && currentHour >= DAILY_RESET_HOUR) {
      this.generateDailyMissions();
      this.missionState.dailyResetDate = today;
      this.missionState.dailyStats = {
        playCount: 0,
        perfectCount: 0,
        maxCombo: 0,
        uniqueSongs: [],
      };
      this.saveMissionState();
    }

    if (this.missionState.dailyMissions.length === 0) {
      this.generateDailyMissions();
      this.saveMissionState();
    }
  }

  private checkAndResetWeeklyMissions(): void {
    const now = Date.now();
    const timeSinceReset = now - this.missionState.weeklyResetTime;

    if (timeSinceReset >= WEEKLY_RESET_INTERVAL) {
      this.generateWeeklyMissions();
      this.missionState.weeklyResetTime = now;
      this.missionState.weeklyStats = {
        playCount: 0,
        perfectCount: 0,
        maxCombo: 0,
        uniqueSongs: [],
      };
      this.saveMissionState();
    }

    if (this.missionState.weeklyMissions.length === 0) {
      this.generateWeeklyMissions();
      this.saveMissionState();
    }
  }

  private generateDailyMissions(): void {
    const dailyPool = this.missionPool.filter(m => m.type === 'daily');
    const selected = this.randomSelect(dailyPool, MISSION_DAILY_COUNT);

    this.missionState.dailyMissions = selected.map(m => ({
      missionId: m.id,
      currentValue: 0,
      isCompleted: false,
      isClaimed: false,
    }));
  }

  private generateWeeklyMissions(): void {
    const weeklyPool = this.missionPool.filter(m => m.type === 'weekly');
    const selected = this.randomSelect(weeklyPool, MISSION_WEEKLY_COUNT);

    this.missionState.weeklyMissions = selected.map(m => ({
      missionId: m.id,
      currentValue: 0,
      isCompleted: false,
      isClaimed: false,
    }));
  }

  private randomSelect<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  public onGameComplete(
    songId: string,
    difficulty: Difficulty,
    scoreData: ScoreData,
    accuracy: number,
    isPractice: boolean,
    chaptersCompleted: string[] = [],
    poemsCollected: number = 0
  ): SettlementResult {
    if (isPractice) {
      return {
        newlyUnlockedAchievements: [],
        completedMissions: [],
        totalRewards: {},
        achievementLogEntries: [],
        missionLogEntries: [],
      };
    }

    const stats = this.playerState.cumulativeStats;
    stats.totalPlayCount++;
    stats.totalPerfectCount += scoreData.perfect;
    stats.totalMaxCombo = Math.max(stats.totalMaxCombo, scoreData.maxCombo);
    stats.highestAccuracy = Math.max(stats.highestAccuracy, accuracy);
    stats.highestScore = Math.max(stats.highestScore, scoreData.score);

    if (!stats.uniqueSongsPlayed.includes(songId)) {
      stats.uniqueSongsPlayed.push(songId);
    }
    if (!stats.ratingsAchieved.includes(scoreData.rating)) {
      stats.ratingsAchieved.push(scoreData.rating);
    }
    if (!stats.difficultiesCleared.includes(difficulty)) {
      stats.difficultiesCleared.push(difficulty);
    }
    for (const ch of chaptersCompleted) {
      if (!stats.chaptersCompleted.includes(ch)) {
        stats.chaptersCompleted.push(ch);
      }
    }
    stats.poemsCollected = Math.max(stats.poemsCollected, poemsCollected);

    this.missionState.dailyStats.playCount++;
    this.missionState.dailyStats.perfectCount += scoreData.perfect;
    this.missionState.dailyStats.maxCombo = Math.max(
      this.missionState.dailyStats.maxCombo,
      scoreData.maxCombo
    );
    if (!this.missionState.dailyStats.uniqueSongs.includes(songId)) {
      this.missionState.dailyStats.uniqueSongs.push(songId);
    }

    this.missionState.weeklyStats.playCount++;
    this.missionState.weeklyStats.perfectCount += scoreData.perfect;
    this.missionState.weeklyStats.maxCombo = Math.max(
      this.missionState.weeklyStats.maxCombo,
      scoreData.maxCombo
    );
    if (!this.missionState.weeklyStats.uniqueSongs.includes(songId)) {
      this.missionState.weeklyStats.uniqueSongs.push(songId);
    }

    const newlyUnlockedAchievements = this.evaluateAchievements(
      songId, difficulty, scoreData, accuracy
    );

    const completedMissions = this.evaluateMissions(
      songId, difficulty, scoreData, accuracy
    );

    const totalRewards = this.aggregateRewards(
      newlyUnlockedAchievements,
      completedMissions
    );

    this.playerState.totalAchievementPoints += newlyUnlockedAchievements.length * 10;

    const achievementLogEntries: AchievementLogEntry[] = newlyUnlockedAchievements.map(ach => ({
      achievementId: ach.id,
      category: ach.category,
      title: ach.title,
      unlockedAt: Date.now(),
      rewards: ach.reward,
      triggerContext: {
        songId,
        difficulty,
        rating: scoreData.rating,
        accuracy,
        maxCombo: scoreData.maxCombo,
        score: scoreData.score,
      },
    }));

    const missionLogEntries: MissionLogEntry[] = completedMissions.map(mis => ({
      missionId: mis.id,
      missionType: mis.type,
      title: mis.title,
      completedAt: Date.now(),
      rewards: mis.reward,
      triggerContext: {
        songId,
        difficulty,
        rating: scoreData.rating,
        accuracy,
        maxCombo: scoreData.maxCombo,
        score: scoreData.score,
      },
    }));

    this.log.push(...achievementLogEntries);
    if (this.log.length > MAX_LOG_ENTRIES) {
      this.log = this.log.slice(-MAX_LOG_ENTRIES);
    }

    this.missionLog.push(...missionLogEntries);
    if (this.missionLog.length > MAX_LOG_ENTRIES) {
      this.missionLog = this.missionLog.slice(-MAX_LOG_ENTRIES);
    }

    this.savePlayerState();
    this.saveMissionState();
    this.saveLog();
    this.saveMissionLog();

    return {
      newlyUnlockedAchievements,
      completedMissions,
      totalRewards,
      achievementLogEntries,
      missionLogEntries,
    };
  }

  private evaluateAchievements(
    songId: string,
    difficulty: Difficulty,
    scoreData: ScoreData,
    accuracy: number
  ): AchievementDefinition[] {
    const newlyUnlocked: AchievementDefinition[] = [];
    const stats = this.playerState.cumulativeStats;
    const isFullCombo = scoreData.miss === 0;
    const isAllPerfect = scoreData.perfect > 0 && scoreData.great === 0 && scoreData.good === 0 && scoreData.miss === 0;

    for (const ach of this.achievements) {
      const existing = this.playerState.unlockedAchievements[ach.id];
      if (existing && existing.isUnlocked) continue;

      let progress = 0;
      let met = true;

      for (const cond of ach.conditions) {
        const condMet = this.evaluateCondition(
          cond, songId, difficulty, scoreData, accuracy,
          stats, isFullCombo, isAllPerfect
        );
        if (!condMet) {
          met = false;
          break;
        }
      }

      if (met) {
        progress = 1;
        this.playerState.unlockedAchievements[ach.id] = {
          achievementId: ach.id,
          isUnlocked: true,
          unlockedAt: Date.now(),
          progress: 1,
        };
        newlyUnlocked.push(ach);
      } else {
        const primaryCond = ach.conditions[0];
        if (primaryCond) {
          progress = this.calculateProgress(
            primaryCond, songId, difficulty, scoreData, accuracy,
            stats, isFullCombo, isAllPerfect
          );
        }

        if (!existing || !existing.isUnlocked) {
          this.playerState.unlockedAchievements[ach.id] = {
            achievementId: ach.id,
            isUnlocked: false,
            progress: Math.min(progress, 0.99),
          };
        }
      }
    }

    return newlyUnlocked;
  }

  private evaluateCondition(
    cond: { type: AchievementConditionType; targetValue: number; difficulty?: Difficulty; minRating?: string },
    _songId: string,
    _difficulty: Difficulty,
    scoreData: ScoreData,
    accuracy: number,
    stats: AchievementPlayerState['cumulativeStats'],
    isFullCombo: boolean,
    isAllPerfect: boolean
  ): boolean {
    switch (cond.type) {
      case 'max_combo':
        return scoreData.maxCombo >= cond.targetValue;
      case 'rating_achieved':
        if (cond.minRating) {
          const minRank = RATING_RANK[cond.minRating] ?? 0;
          return stats.ratingsAchieved.some(r => (RATING_RANK[r] ?? 0) >= minRank);
        }
        return scoreData.rating !== 'D';
      case 'accuracy_threshold':
        return accuracy >= cond.targetValue;
      case 'unique_songs_played':
        return stats.uniqueSongsPlayed.length >= cond.targetValue;
      case 'perfect_count_single':
        return scoreData.perfect >= cond.targetValue;
      case 'full_combo':
        return isFullCombo && scoreData.perfect + scoreData.great + scoreData.good > 0;
      case 'all_perfect_single':
        return isAllPerfect;
      case 'score_threshold':
        return scoreData.score >= cond.targetValue;
      case 'total_play_count':
        return stats.totalPlayCount >= cond.targetValue;
      case 'clear_difficulty':
        if (cond.difficulty) {
          return stats.difficultiesCleared.includes(cond.difficulty);
        }
        return true;
      case 'chapter_completed':
        return stats.chaptersCompleted.length >= cond.targetValue;
      case 'poems_collected':
        return stats.poemsCollected >= cond.targetValue;
      case 'total_perfect_count':
        return stats.totalPerfectCount >= cond.targetValue;
      default:
        return false;
    }
  }

  private calculateProgress(
    cond: { type: AchievementConditionType; targetValue: number; difficulty?: Difficulty; minRating?: string },
    _songId: string,
    _difficulty: Difficulty,
    scoreData: ScoreData,
    accuracy: number,
    stats: AchievementPlayerState['cumulativeStats'],
    isFullCombo: boolean,
    _isAllPerfect: boolean
  ): number {
    switch (cond.type) {
      case 'max_combo':
        return Math.min(scoreData.maxCombo / cond.targetValue, 1);
      case 'accuracy_threshold':
        return Math.min(accuracy / cond.targetValue, 1);
      case 'unique_songs_played':
        return Math.min(stats.uniqueSongsPlayed.length / cond.targetValue, 1);
      case 'perfect_count_single':
        return Math.min(scoreData.perfect / cond.targetValue, 1);
      case 'score_threshold':
        return Math.min(scoreData.score / cond.targetValue, 1);
      case 'total_play_count':
        return Math.min(stats.totalPlayCount / cond.targetValue, 1);
      case 'chapter_completed':
        return Math.min(stats.chaptersCompleted.length / cond.targetValue, 1);
      case 'poems_collected':
        return Math.min(stats.poemsCollected / cond.targetValue, 1);
      case 'total_perfect_count':
        return Math.min(stats.totalPerfectCount / cond.targetValue, 1);
      case 'full_combo':
      case 'all_perfect_single':
        return isFullCombo ? 1 : 0;
      case 'rating_achieved':
        if (cond.minRating) {
          const minRank = RATING_RANK[cond.minRating] ?? 0;
          return stats.ratingsAchieved.some(r => (RATING_RANK[r] ?? 0) >= minRank) ? 1 : 0;
        }
        return scoreData.rating !== 'D' ? 1 : 0;
      case 'clear_difficulty':
        if (cond.difficulty) {
          return stats.difficultiesCleared.includes(cond.difficulty) ? 1 : 0;
        }
        return 1;
      default:
        return 0;
    }
  }

  private evaluateMissions(
    _songId: string,
    _difficulty: Difficulty,
    scoreData: ScoreData,
    accuracy: number
  ): MissionDefinition[] {
    const completed: MissionDefinition[] = [];
    const isFullCombo = scoreData.miss === 0;

    const evaluateMissionProgress = (
      missionDef: MissionDefinition,
      currentValue: number,
      isDaily: boolean
    ): number => {
      const periodStats = isDaily ? this.missionState.dailyStats : this.missionState.weeklyStats;
      switch (missionDef.conditionType) {
        case 'play_count':
          return periodStats.playCount;
        case 'perfect_count':
          return scoreData.perfect;
        case 'max_combo':
          return scoreData.maxCombo;
        case 'rating':
          if (missionDef.minRating) {
            const minRank = RATING_RANK[missionDef.minRating] ?? 0;
            return (RATING_RANK[scoreData.rating] ?? 0) >= minRank ? 1 : 0;
          }
          return scoreData.rating !== 'D' ? 1 : 0;
        case 'accuracy':
          return accuracy;
        case 'score':
          return scoreData.score;
        case 'unique_songs':
          return periodStats.uniqueSongs.length;
        case 'clear_song':
          return 1;
        case 'full_combo':
          return isFullCombo ? 1 : 0;
        default:
          return currentValue;
      }
    };

    const checkMissionList = (missions: MissionProgress[], isDaily: boolean): void => {
      for (const progress of missions) {
        const missionDef = this.missionPool.find(m => m.id === progress.missionId);
        if (!missionDef) continue;
        if (progress.isCompleted && progress.isClaimed) continue;

        const newValue = evaluateMissionProgress(missionDef, progress.currentValue, isDaily);
        progress.currentValue = Math.max(progress.currentValue, newValue);

        if (progress.currentValue >= missionDef.targetValue && !progress.isCompleted) {
          progress.isCompleted = true;
          progress.completedAt = Date.now();
          if (!progress.isClaimed) {
            progress.isClaimed = true;
            completed.push(missionDef);
          }
        }
      }
    };

    checkMissionList(this.missionState.dailyMissions, true);
    checkMissionList(this.missionState.weeklyMissions, false);

    return completed;
  }

  private aggregateRewards(
    achievements: AchievementDefinition[],
    missions: MissionDefinition[]
  ): AchievementReward {
    const total: AchievementReward = {};

    for (const ach of achievements) {
      if (ach.reward.coin) total.coin = (total.coin || 0) + ach.reward.coin;
      if (ach.reward.jade) total.jade = (total.jade || 0) + ach.reward.jade;
      if (ach.reward.star) total.star = (total.star || 0) + ach.reward.star;
    }

    for (const mis of missions) {
      if (mis.reward.coin) total.coin = (total.coin || 0) + mis.reward.coin;
      if (mis.reward.jade) total.jade = (total.jade || 0) + mis.reward.jade;
      if (mis.reward.star) total.star = (total.star || 0) + mis.reward.star;
    }

    return total;
  }

  public getAllAchievements(): AchievementDefinition[] {
    return [...this.achievements];
  }

  public getAchievementState(achievementId: string): AchievementUnlockState | null {
    return this.playerState.unlockedAchievements[achievementId] || null;
  }

  public getUnlockedAchievementIds(): string[] {
    return Object.entries(this.playerState.unlockedAchievements)
      .filter(([_, state]) => state.isUnlocked)
      .map(([id]) => id);
  }

  public getAchievementsByCategory(category: AchievementCategory): AchievementDefinition[] {
    return this.achievements.filter(a => a.category === category);
  }

  public getAchievementProgress(achievementId: string): number {
    const state = this.playerState.unlockedAchievements[achievementId];
    if (!state) return 0;
    return state.isUnlocked ? 1 : state.progress;
  }

  public getDailyMissions(): { definition: MissionDefinition; progress: MissionProgress }[] {
    this.checkAndResetDailyMissions();
    return this.missionState.dailyMissions.map(mp => ({
      definition: this.missionPool.find(m => m.id === mp.missionId)!,
      progress: mp,
    })).filter(m => m.definition);
  }

  public getWeeklyMissions(): { definition: MissionDefinition; progress: MissionProgress }[] {
    this.checkAndResetWeeklyMissions();
    return this.missionState.weeklyMissions.map(mp => ({
      definition: this.missionPool.find(m => m.id === mp.missionId)!,
      progress: mp,
    })).filter(m => m.definition);
  }

  public getAchievementPoints(): number {
    return this.playerState.totalAchievementPoints;
  }

  public getLog(): AchievementLogEntry[] {
    return [...this.log];
  }

  public getMissionLog(): MissionLogEntry[] {
    return [...this.missionLog];
  }

  public getLogForAchievement(achievementId: string): AchievementLogEntry | null {
    return this.log.find(l => l.achievementId === achievementId) || null;
  }

  public getPlayerState(): AchievementPlayerState {
    return { ...this.playerState };
  }

  public getMissionState(): MissionPlayerState {
    return { ...this.missionState };
  }

  public getCumulativeStats(): AchievementPlayerState['cumulativeStats'] {
    return { ...this.playerState.cumulativeStats };
  }

  private loadPlayerState(): void {
    try {
      const data = localStorage.getItem(ACHIEVEMENT_STATE_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.playerState = {
          ...this.createDefaultPlayerState(),
          ...parsed,
          cumulativeStats: {
            ...this.createDefaultPlayerState().cumulativeStats,
            ...(parsed.cumulativeStats || {}),
          },
        };
      }
    } catch (e) {
      console.error('Failed to load achievement state:', e);
    }
  }

  private savePlayerState(): void {
    try {
      localStorage.setItem(ACHIEVEMENT_STATE_STORAGE_KEY, JSON.stringify(this.playerState));
    } catch (e) {
      console.error('Failed to save achievement state:', e);
    }
  }

  private loadMissionState(): void {
    try {
      const data = localStorage.getItem(MISSION_STATE_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const defaultState = this.createDefaultMissionState();
        this.missionState = {
          ...defaultState,
          ...parsed,
          dailyStats: {
            ...defaultState.dailyStats,
            ...(parsed.dailyStats || {}),
          },
          weeklyStats: {
            ...defaultState.weeklyStats,
            ...(parsed.weeklyStats || {}),
          },
        };
      }
    } catch (e) {
      console.error('Failed to load mission state:', e);
    }
  }

  private saveMissionState(): void {
    try {
      localStorage.setItem(MISSION_STATE_STORAGE_KEY, JSON.stringify(this.missionState));
    } catch (e) {
      console.error('Failed to save mission state:', e);
    }
  }

  private loadLog(): void {
    try {
      const data = localStorage.getItem(ACHIEVEMENT_LOG_STORAGE_KEY);
      if (data) {
        this.log = JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load achievement log:', e);
    }
  }

  private saveLog(): void {
    try {
      localStorage.setItem(ACHIEVEMENT_LOG_STORAGE_KEY, JSON.stringify(this.log));
    } catch (e) {
      console.error('Failed to save achievement log:', e);
    }
  }

  private loadMissionLog(): void {
    try {
      const data = localStorage.getItem(MISSION_LOG_STORAGE_KEY);
      if (data) {
        this.missionLog = JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load mission log:', e);
    }
  }

  private saveMissionLog(): void {
    try {
      localStorage.setItem(MISSION_LOG_STORAGE_KEY, JSON.stringify(this.missionLog));
    } catch (e) {
      console.error('Failed to save mission log:', e);
    }
  }

  public resetAll(): void {
    this.playerState = this.createDefaultPlayerState();
    this.missionState = this.createDefaultMissionState();
    this.log = [];
    this.missionLog = [];
    this.generateDailyMissions();
    this.generateWeeklyMissions();
    this.savePlayerState();
    this.saveMissionState();
    this.saveLog();
    this.saveMissionLog();
  }
}
