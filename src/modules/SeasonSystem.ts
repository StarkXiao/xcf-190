import {
  SeasonTask,
  SeasonReward,
  SeasonData,
  PlayerSeasonState,
  SeasonProgressInfo,
  WeeklyRankEntry,
  SEASON_STATE_STORAGE_KEY,
  SEASON_DATA_STORAGE_KEY,
  WEEKLY_RESET_INTERVAL,
  DAILY_RESET_HOUR,
  Difficulty,
  ScoreData,
  RATING_RANK
} from '../types';
import { ScoreStorage } from './ScoreStorage';
import { ConfigSystem } from './ConfigSystem';

const DEFAULT_SEASON_ID = 'season-spring-2026';
const LEVEL_POINTS_STEP = 500;
const MAX_LEVEL = 50;

export class SeasonSystem {
  private static instance: SeasonSystem;
  private seasonData: SeasonData;
  private playerState: PlayerSeasonState;
  private isInitialized: boolean = false;

  private constructor() {
    this.seasonData = this.createDefaultSeasonData();
    this.playerState = this.createDefaultPlayerState();
    this.initialize();
  }

  public static getInstance(): SeasonSystem {
    if (!SeasonSystem.instance) {
      SeasonSystem.instance = new SeasonSystem();
    }
    return SeasonSystem.instance;
  }

  private initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.loadPlayerState();
    this.checkAndResetDaily();
    this.checkAndResetWeekly();
    this.updateTaskProgress();
    this.savePlayerState();
  }

  private createDefaultSeasonData(): SeasonData {
    const now = Date.now();
    const threeMonths = 90 * 24 * 60 * 60 * 1000;

    return {
      id: DEFAULT_SEASON_ID,
      name: '春日诗章赛季',
      description: '在春日的诗章中，挑战自我，收集赛季积分，解锁限定曲目！',
      startTime: now - 7 * 24 * 60 * 60 * 1000,
      endTime: now + threeMonths,
      theme: 'spring',
      accentColor: '#ff6b9d',
      tasks: this.createDefaultTasks(),
      rewards: this.createDefaultRewards(),
      limitedSongs: this.createDefaultLimitedSongs(),
      weeklyRank: this.generateMockWeeklyRank(),
      weeklyRankRefreshTime: now
    };
  }

  private createDefaultTasks(): SeasonTask[] {
    const dailyTasks: SeasonTask[] = [
      {
        id: 'daily-play-3',
        type: 'daily',
        title: '每日演奏',
        description: '完成3场游戏',
        conditionType: 'play_count',
        targetValue: 3,
        currentValue: 0,
        rewardPoints: 100,
        isCompleted: false,
        isClaimed: false
      },
      {
        id: 'daily-perfect-50',
        type: 'daily',
        title: '完美演奏',
        description: '累计获得50个Perfect判定',
        conditionType: 'perfect_count',
        targetValue: 50,
        currentValue: 0,
        rewardPoints: 150,
        isCompleted: false,
        isClaimed: false
      },
      {
        id: 'daily-combo-30',
        type: 'daily',
        title: '连击达人',
        description: '单局最高连击达到30',
        conditionType: 'combo',
        targetValue: 30,
        currentValue: 0,
        rewardPoints: 120,
        isCompleted: false,
        isClaimed: false
      },
      {
        id: 'daily-rating-c',
        type: 'daily',
        title: '合格演奏',
        description: '任意曲目达成C级及以上评价',
        conditionType: 'rating',
        targetValue: 1,
        currentValue: 0,
        rewardPoints: 80,
        isCompleted: false,
        isClaimed: false,
        minRating: 'C'
      }
    ];

    const weeklyTasks: SeasonTask[] = [
      {
        id: 'weekly-play-15',
        type: 'weekly',
        title: '周常演奏',
        description: '本周完成15场游戏',
        conditionType: 'play_count',
        targetValue: 15,
        currentValue: 0,
        rewardPoints: 500,
        isCompleted: false,
        isClaimed: false
      },
      {
        id: 'weekly-unique-5',
        type: 'weekly',
        title: '博览群诗',
        description: '游玩5首不同的曲目',
        conditionType: 'unique_songs',
        targetValue: 5,
        currentValue: 0,
        rewardPoints: 400,
        isCompleted: false,
        isClaimed: false
      },
      {
        id: 'weekly-rating-a',
        type: 'weekly',
        title: 'A级挑战',
        description: '任意曲目达成A级及以上评价',
        conditionType: 'rating',
        targetValue: 1,
        currentValue: 0,
        rewardPoints: 300,
        isCompleted: false,
        isClaimed: false,
        minRating: 'A'
      },
      {
        id: 'weekly-accuracy-90',
        type: 'weekly',
        title: '精准演奏',
        description: '单局准确率达到90%以上',
        conditionType: 'accuracy',
        targetValue: 90,
        currentValue: 0,
        rewardPoints: 350,
        isCompleted: false,
        isClaimed: false
      },
      {
        id: 'weekly-combo-100',
        type: 'weekly',
        title: '百连击大师',
        description: '单局最高连击达到100',
        conditionType: 'combo',
        targetValue: 100,
        currentValue: 0,
        rewardPoints: 450,
        isCompleted: false,
        isClaimed: false
      }
    ];

    return [...dailyTasks, ...weeklyTasks];
  }

  private createDefaultRewards(): SeasonReward[] {
    return [
      {
        id: 'reward-1',
        title: '新手上路',
        description: '赛季初体验奖励',
        requiredPoints: 200,
        rewardType: 'title',
        rewardValue: '诗韵新手',
        isClaimed: false
      },
      {
        id: 'reward-2',
        title: '限定曲目一',
        description: '解锁限定曲目「春晓」',
        requiredPoints: 800,
        rewardType: 'song',
        rewardValue: 'spring-dawn',
        isClaimed: false
      },
      {
        id: 'reward-3',
        title: '金色边框',
        description: '获得金色谱面边框',
        requiredPoints: 1500,
        rewardType: 'frame',
        rewardValue: 'golden-frame',
        isClaimed: false
      },
      {
        id: 'reward-4',
        title: '限定曲目二',
        description: '解锁限定曲目「春江花月夜」',
        requiredPoints: 2500,
        rewardType: 'song',
        rewardValue: 'spring-river-night',
        isClaimed: false
      },
      {
        id: 'reward-5',
        title: '诗章大师',
        description: '赛季大师称号',
        requiredPoints: 4000,
        rewardType: 'title',
        rewardValue: '诗章大师',
        isClaimed: false
      },
      {
        id: 'reward-6',
        title: '限定曲目三',
        description: '解锁隐藏限定曲目「蝶恋花」',
        requiredPoints: 6000,
        rewardType: 'song',
        rewardValue: 'butterfly-love',
        isClaimed: false
      }
    ];
  }

  private createDefaultLimitedSongs() {
    return [
      {
        songId: 'spring-dawn',
        isUnlocked: false,
        unlockCondition: '累计800赛季积分解锁'
      },
      {
        songId: 'spring-river-night',
        isUnlocked: false,
        unlockCondition: '累计2500赛季积分解锁'
      },
      {
        songId: 'butterfly-love',
        isUnlocked: false,
        unlockCondition: '累计6000赛季积分解锁'
      }
    ];
  }

  private generateMockWeeklyRank(): WeeklyRankEntry[] {
    const mockNames = ['诗词达人', '韵律大师', '音符精灵', '古风爱好者', '诗韵行者', '墨香琴韵', '流云诗客', '月下独酌', '清风徐来', '水墨丹青'];
    const songTitles = ['告白诗篇', '春风十里', '月光奏鸣'];
    const songIds = ['love-poem', 'spring-breeze', 'moonlight-sonata'];
    const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
    const ratings = ['S', 'A', 'B', 'C'];

    return mockNames.map((name, index) => {
      const songIndex = index % 3;
      const diffIndex = Math.min(Math.floor(index / 3), 2);
      return {
        rank: index + 1,
        playerName: name,
        score: Math.floor(100000 - index * 8000 + Math.random() * 3000),
        songId: songIds[songIndex],
        songTitle: songTitles[songIndex],
        difficulty: difficulties[diffIndex],
        rating: ratings[Math.min(Math.floor(index / 3), 3)],
        accuracy: 98 - index * 1.5 + Math.random() * 2,
        maxCombo: Math.floor(100 - index * 8 + Math.random() * 10),
        timestamp: Date.now() - Math.random() * 24 * 60 * 60 * 1000
      };
    });
  }

  private createDefaultPlayerState(): PlayerSeasonState {
    return {
      seasonId: DEFAULT_SEASON_ID,
      currentPoints: 0,
      totalPoints: 0,
      completedTasks: [],
      claimedTasks: [],
      claimedRewards: [],
      unlockedSongs: [],
      weeklyBestScore: 0,
      lastWeeklyReset: Date.now(),
      dailyResetDate: this.getTodayDateString(),
      playStats: {
        totalPlayCount: 0,
        totalPerfectCount: 0,
        totalMaxCombo: 0,
        uniqueSongsPlayed: [],
        songPlayCounts: {}
      }
    };
  }

  private getTodayDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  private checkAndResetDaily(): void {
    const now = new Date();
    const currentHour = now.getHours();
    const today = this.getTodayDateString();
    const lastReset = this.playerState.dailyResetDate;

    if (lastReset !== today && currentHour >= DAILY_RESET_HOUR) {
      this.resetDailyTasks();
      this.playerState.dailyResetDate = today;
      this.savePlayerState();
    }
  }

  private resetDailyTasks(): void {
    this.seasonData.tasks.forEach(task => {
      if (task.type === 'daily') {
        task.currentValue = 0;
        task.isCompleted = false;
        task.isClaimed = false;
      }
    });
    this.playerState.completedTasks = this.playerState.completedTasks.filter(
      id => !this.seasonData.tasks.find(t => t.id === id && t.type === 'daily')
    );
    this.playerState.claimedTasks = this.playerState.claimedTasks.filter(
      id => !this.seasonData.tasks.find(t => t.id === id && t.type === 'daily')
    );
  }

  private checkAndResetWeekly(): void {
    const now = Date.now();
    const timeSinceReset = now - this.playerState.lastWeeklyReset;

    if (timeSinceReset >= WEEKLY_RESET_INTERVAL) {
      this.resetWeekly();
    }
  }

  private resetWeekly(): void {
    this.seasonData.tasks.forEach(task => {
      if (task.type === 'weekly') {
        task.currentValue = 0;
        task.isCompleted = false;
        task.isClaimed = false;
      }
    });
    this.playerState.completedTasks = this.playerState.completedTasks.filter(
      id => !this.seasonData.tasks.find(t => t.id === id && t.type === 'weekly')
    );
    this.playerState.claimedTasks = this.playerState.claimedTasks.filter(
      id => !this.seasonData.tasks.find(t => t.id === id && t.type === 'weekly')
    );

    this.playerState.weeklyBestScore = 0;
    this.playerState.weeklyBestSongId = undefined;
    this.playerState.weeklyBestDifficulty = undefined;

    this.playerState.playStats.totalPlayCount = 0;
    this.playerState.playStats.totalPerfectCount = 0;
    this.playerState.playStats.totalMaxCombo = 0;
    this.playerState.playStats.uniqueSongsPlayed = [];
    this.playerState.playStats.songPlayCounts = {};

    this.playerState.lastWeeklyReset = Date.now();
    this.seasonData.weeklyRank = this.generateMockWeeklyRank();
    this.seasonData.weeklyRankRefreshTime = Date.now();
  }

  private updateTaskProgress(): void {
    const { playStats } = this.playerState;

    this.seasonData.tasks.forEach(task => {
      if (task.isCompleted) return;

      let currentValue = 0;

      switch (task.conditionType) {
        case 'play_count':
          currentValue = playStats.totalPlayCount;
          break;
        case 'perfect_count':
          currentValue = playStats.totalPerfectCount;
          break;
        case 'combo':
          currentValue = playStats.totalMaxCombo;
          break;
        case 'unique_songs':
          currentValue = playStats.uniqueSongsPlayed.length;
          break;
        case 'rating':
          if (task.minRating) {
            const minRank = RATING_RANK[task.minRating] ?? 0;
            const history = ScoreStorage.getScoreHistory();
            const hasRating = history.some(h => {
              const rank = RATING_RANK[h.rating] ?? 0;
              if (task.songId && h.songId !== task.songId) return false;
              if (task.difficulty && h.difficulty !== task.difficulty) return false;
              return rank >= minRank;
            });
            currentValue = hasRating ? 1 : 0;
          }
          break;
        case 'accuracy':
          if (task.targetValue > 0) {
            const history = ScoreStorage.getScoreHistory();
            const maxAcc = Math.max(...history.map(h => h.accuracy), 0);
            currentValue = Math.floor(maxAcc);
          }
          break;
      }

      task.currentValue = Math.min(currentValue, task.targetValue);

      if (task.currentValue >= task.targetValue && !task.isCompleted) {
        task.isCompleted = true;
        if (!this.playerState.completedTasks.includes(task.id)) {
          this.playerState.completedTasks.push(task.id);
        }
      }
    });
  }

  public onGameComplete(
    songId: string,
    songTitle: string,
    difficulty: Difficulty,
    scoreData: ScoreData,
    accuracy: number,
    isPractice: boolean = false
  ): { pointsGained: number; completedTasks: string[]; isNewWeeklyBest: boolean; earnedRewards: any[]; activityMultipliers: any[] } {
    if (isPractice) {
      return { pointsGained: 0, completedTasks: [], isNewWeeklyBest: false, earnedRewards: [], activityMultipliers: [] };
    }

    const configSystem = ConfigSystem.getInstance();
    const { playStats } = this.playerState;

    playStats.totalPlayCount++;
    playStats.totalPerfectCount += scoreData.perfect;
    playStats.totalMaxCombo = Math.max(playStats.totalMaxCombo, scoreData.maxCombo);

    if (!playStats.uniqueSongsPlayed.includes(songId)) {
      playStats.uniqueSongsPlayed.push(songId);
    }
    playStats.songPlayCounts[songId] = (playStats.songPlayCounts[songId] || 0) + 1;

    const isNewWeeklyBest = scoreData.score > this.playerState.weeklyBestScore;
    if (isNewWeeklyBest) {
      this.playerState.weeklyBestScore = scoreData.score;
      this.playerState.weeklyBestSongId = songId;
      this.playerState.weeklyBestDifficulty = difficulty;
      this.updateWeeklyRank(songId, songTitle, difficulty, scoreData, accuracy);
    }

    let basePoints = this.calculateScorePoints(scoreData.score, accuracy);

    const activeActivities = configSystem.getActiveActivities();
    const activityMultipliers: any[] = [];

    activeActivities.forEach(activity => {
      if (activity.type === 'double_reward') {
        const multiplier = activity.config?.rewardMultiplier || 1;
        if (multiplier > 1) {
          activityMultipliers.push({
          activityName: activity.name, multiplier });
          basePoints = Math.floor(basePoints * multiplier);
        }
      }
    });

    this.updateTaskProgress();

    const newlyCompletedTasks: string[] = [];
    let taskRewardPoints = 0;

    this.seasonData.tasks.forEach(task => {
      if (task.isCompleted && !this.playerState.claimedTasks.includes(task.id) && !task.isClaimed) {
        task.isClaimed = true;
        this.playerState.claimedTasks.push(task.id);
        newlyCompletedTasks.push(task.id);
        taskRewardPoints += task.rewardPoints;
      }
    });

    let totalPointsGained = basePoints + taskRewardPoints;

    const rewardCheckContext = {
      songId,
      difficulty,
      rating: scoreData.rating,
      accuracy,
      combo: scoreData.maxCombo,
      perfectCount: scoreData.perfect,
      playCount: playStats.totalPlayCount,
      isFirstClear: playStats.songPlayCounts[songId] === 1
    };

    const earnedRewards: any[] = [];
    const activeRewards = configSystem.getActiveRewards();
    activeRewards.forEach(reward => {
      if (configSystem.checkRewardConditions(reward.id, rewardCheckContext)) {
        if (!this.playerState.claimedRewards.includes(reward.id)) {
          earnedRewards.push({
            id: reward.id,
            name: reward.name,
            type: reward.type,
            value: reward.value
          });
        }
      }
    });

    this.playerState.currentPoints += totalPointsGained;
    this.playerState.totalPoints += totalPointsGained;

    this.checkAndUnlockRewards();

    this.savePlayerState();
    this.saveSeasonData();

    return {
      pointsGained: totalPointsGained,
      completedTasks: newlyCompletedTasks,
      isNewWeeklyBest,
      earnedRewards,
      activityMultipliers
    };
  }

  private calculateScorePoints(score: number, accuracy: number): number {
    const basePoints = Math.floor(score / 1000);
    const accuracyBonus = Math.floor(accuracy / 10) * 5;
    return Math.max(10, basePoints + accuracyBonus);
  }

  private updateWeeklyRank(
    songId: string,
    songTitle: string,
    difficulty: Difficulty,
    scoreData: ScoreData,
    accuracy: number
  ): void {
    const playerEntry: WeeklyRankEntry = {
      rank: 0,
      playerName: '我',
      score: scoreData.score,
      songId,
      songTitle,
      difficulty,
      rating: scoreData.rating,
      accuracy,
      maxCombo: scoreData.maxCombo,
      timestamp: Date.now()
    };

    const rank = [...this.seasonData.weeklyRank, playerEntry]
      .sort((a, b) => b.score - a.score)
      .findIndex(e => e.playerName === '我') + 1;

    playerEntry.rank = rank;

    const existingIndex = this.seasonData.weeklyRank.findIndex(e => e.playerName === '我');
    if (existingIndex >= 0) {
      this.seasonData.weeklyRank.splice(existingIndex, 1);
    }

    this.seasonData.weeklyRank.push(playerEntry);
    this.seasonData.weeklyRank.sort((a, b) => b.score - a.score);
    this.seasonData.weeklyRank.forEach((e, i) => {
      e.rank = i + 1;
    });
    this.seasonData.weeklyRank = this.seasonData.weeklyRank.slice(0, 20);
  }

  private checkAndUnlockRewards(): void {
    const { currentPoints } = this.playerState;

    this.seasonData.rewards.forEach(reward => {
      if (currentPoints >= reward.requiredPoints && !reward.isClaimed) {
        if (reward.rewardType === 'song') {
          if (!this.playerState.unlockedSongs.includes(reward.rewardValue)) {
            this.playerState.unlockedSongs.push(reward.rewardValue);
          }
          const limitedSong = this.seasonData.limitedSongs.find(s => s.songId === reward.rewardValue);
          if (limitedSong) {
            limitedSong.isUnlocked = true;
          }
        }
      }
    });
  }

  public claimReward(rewardId: string): boolean {
    const reward = this.seasonData.rewards.find(r => r.id === rewardId);
    if (!reward) return false;
    if (reward.isClaimed) return false;
    if (this.playerState.currentPoints < reward.requiredPoints) return false;

    reward.isClaimed = true;
    this.playerState.claimedRewards.push(rewardId);

    if (reward.rewardType === 'song') {
      if (!this.playerState.unlockedSongs.includes(reward.rewardValue)) {
        this.playerState.unlockedSongs.push(reward.rewardValue);
      }
      const limitedSong = this.seasonData.limitedSongs.find(s => s.songId === reward.rewardValue);
      if (limitedSong) {
        limitedSong.isUnlocked = true;
      }
    }

    this.savePlayerState();
    this.saveSeasonData();
    return true;
  }

  public getProgressInfo(): SeasonProgressInfo {
    const { currentPoints, totalPoints } = this.playerState;
    const tasks = this.seasonData.tasks;
    const rewards = this.seasonData.rewards;

    const completedTaskCount = tasks.filter(t => t.isCompleted).length;
    const unlockedRewardCount = rewards.filter(r => currentPoints >= r.requiredPoints).length;

    const currentLevel = Math.min(MAX_LEVEL, Math.floor(currentPoints / LEVEL_POINTS_STEP) + 1);
    const levelProgress = (currentPoints % LEVEL_POINTS_STEP) / LEVEL_POINTS_STEP;
    const nextLevelPoints = currentLevel * LEVEL_POINTS_STEP;

    return {
      currentPoints,
      totalPoints,
      completedTasks: completedTaskCount,
      totalTasks: tasks.length,
      unlockedRewards: unlockedRewardCount,
      totalRewards: rewards.length,
      currentLevel,
      levelProgress,
      nextLevelPoints
    };
  }

  public getDailyTasks(): SeasonTask[] {
    this.checkAndResetDaily();
    return this.seasonData.tasks.filter(t => t.type === 'daily');
  }

  public getWeeklyTasks(): SeasonTask[] {
    this.checkAndResetWeekly();
    return this.seasonData.tasks.filter(t => t.type === 'weekly');
  }

  public checkAndResetTasks(): void {
    this.checkAndResetDaily();
    this.checkAndResetWeekly();
  }

  public getAllTasks(): SeasonTask[] {
    this.checkAndResetDaily();
    this.checkAndResetWeekly();
    return [...this.seasonData.tasks];
  }

  public getRewards(): SeasonReward[] {
    return this.seasonData.rewards;
  }

  public getLimitedSongs() {
    return this.seasonData.limitedSongs;
  }

  public isSongUnlocked(songId: string): boolean {
    return this.playerState.unlockedSongs.includes(songId);
  }

  public getWeeklyRank(): WeeklyRankEntry[] {
    return this.seasonData.weeklyRank;
  }

  public getWeeklyRankRefreshTime(): number {
    return this.seasonData.weeklyRankRefreshTime;
  }

  public getPlayerWeeklyBest(): { score: number; songId?: string; difficulty?: Difficulty } {
    return {
      score: this.playerState.weeklyBestScore,
      songId: this.playerState.weeklyBestSongId,
      difficulty: this.playerState.weeklyBestDifficulty
    };
  }

  public getSeasonName(): string {
    return this.seasonData.name;
  }

  public getSeasonDescription(): string {
    return this.seasonData.description;
  }

  public getSeasonAccentColor(): string {
    return this.seasonData.accentColor;
  }

  public getSeasonEndTime(): number {
    return this.seasonData.endTime;
  }

  public getTimeUntilSeasonEnd(): number {
    return Math.max(0, this.seasonData.endTime - Date.now());
  }

  private loadPlayerState(): void {
    try {
      const data = localStorage.getItem(SEASON_STATE_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.seasonId === DEFAULT_SEASON_ID) {
          this.playerState = { ...this.playerState, ...parsed };
        }
      }
    } catch (e) {
      console.error('Failed to load season player state:', e);
    }
  }

  private savePlayerState(): void {
    try {
      localStorage.setItem(SEASON_STATE_STORAGE_KEY, JSON.stringify(this.playerState));
    } catch (e) {
      console.error('Failed to save season player state:', e);
    }
  }

  private saveSeasonData(): void {
    try {
      localStorage.setItem(SEASON_DATA_STORAGE_KEY, JSON.stringify(this.seasonData));
    } catch (e) {
      console.error('Failed to save season data:', e);
    }
  }

  public resetAll(): void {
    this.playerState = this.createDefaultPlayerState();
    this.seasonData = this.createDefaultSeasonData();
    this.savePlayerState();
    this.saveSeasonData();
  }
}
