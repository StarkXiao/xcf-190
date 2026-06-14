import {
  StoryChapter,
  ChapterEnding,
  ChapterProgress,
  CollectedPoem,
  StoryState,
  StoryStateChangeEvent,
  StoryStateChangeListener,
  EndingType,
  STORY_STATE_STORAGE_KEY,
  RATING_RANK,
  Difficulty,
  BestScore
} from '../types';
import { ScoreStorage } from './ScoreStorage';

const CHAPTER_DEFINITIONS: StoryChapter[] = [
  {
    id: 'chapter-1',
    title: '初见',
    subtitle: '书页间的邂逅',
    description: '在这座浮岛书屋里，你第一次翻开那本古老的诗集，字里行间似乎有光芒闪烁...',
    order: 1,
    levels: [
      {
        songId: 'love-poem',
        order: 1,
        poemReward: '愿我如星君如月',
        poemRewardCondition: { minRating: 'C', minAccuracy: 60 }
      }
    ],
    endings: [
      {
        type: 'good',
        title: '星辰闪耀',
        description: '你的指尖在书页上跳跃，每一个音符都如同星辰般闪耀。书屋中浮现出温柔的光芒，仿佛在回应你的心意。',
        poemFragment: '星月交辉映书屋，指尖流转绘诗图。',
        minAverageRating: 'A',
        minAverageAccuracy: 85
      },
      {
        type: 'normal',
        title: '书页微光',
        description: '书页间的文字随着你的演奏缓缓亮起，虽然还不够耀眼，但那份温暖已经悄然生根。',
        poemFragment: '微光初现纸上字，暖意渐生心底知。',
        minAverageRating: 'C',
        minAverageAccuracy: 60
      },
      {
        type: 'bad',
        title: '墨迹未干',
        description: '有些文字还在沉睡，墨迹未干的诗句等待着更用心的演奏才能苏醒。',
        poemFragment: '墨迹未干待谁书，字字沉睡盼复初。',
        minAverageRating: 'D',
        minAverageAccuracy: 0
      }
    ],
    prerequisiteChapterId: null,
    prerequisiteCondition: null,
    mapPosition: { x: 360, y: 800 },
    mapIcon: '📖'
  },
  {
    id: 'chapter-2',
    title: '相识',
    subtitle: '春风中的回忆',
    description: '书屋深处传来熟悉的旋律，仿佛春风拂过旧时的记忆。你需要更精湛的演奏来唤醒更多沉睡的诗句...',
    order: 2,
    levels: [
      {
        songId: 'love-poem',
        order: 1,
        poemReward: '夜夜流光相皎洁',
        poemRewardCondition: { minRating: 'B', minAccuracy: 75 }
      },
      {
        songId: 'spring-breeze',
        order: 2,
        poemReward: '春风十里不如你',
        poemRewardCondition: { minRating: 'C', minAccuracy: 60 }
      }
    ],
    endings: [
      {
        type: 'good',
        title: '花间醉语',
        description: '春风化作你的指尖之舞，花间诗语如梦似幻。书屋中的花朵为你盛开，每一瓣都承载着一个美好的记忆。',
        poemFragment: '春风化指花间舞，诗语如梦忆中留。',
        minAverageRating: 'A',
        minAverageAccuracy: 85
      },
      {
        type: 'normal',
        title: '风中低语',
        description: '春风虽至，花瓣却只微微颤动。需要更细腻的触感，才能让每朵花都为你绽放。',
        poemFragment: '风过花枝轻颤动，低语声声待细听。',
        minAverageRating: 'C',
        minAverageAccuracy: 60
      },
      {
        type: 'bad',
        title: '花落无声',
        description: '花瓣在风中飘落，无声无息。也许下一次演奏，你能捕捉到更多的春意。',
        poemFragment: '花落无声随风去，春意难留待再寻。',
        minAverageRating: 'D',
        minAverageAccuracy: 0
      }
    ],
    prerequisiteChapterId: 'chapter-1',
    prerequisiteCondition: { minRating: 'C', minAccuracy: 60 },
    mapPosition: { x: 360, y: 580 },
    mapIcon: '🌸'
  },
  {
    id: 'chapter-3',
    title: '共鸣',
    subtitle: '月光下的思念',
    description: '月光倾泻入书屋，古老的诗篇在月色中展现出从未有人见过的面貌。这是最终的考验，也是最深的共鸣...',
    order: 3,
    levels: [
      {
        songId: 'spring-breeze',
        order: 1,
        poemReward: '桃花流水窅然去',
        poemRewardCondition: { minRating: 'B', minAccuracy: 75 }
      },
      {
        songId: 'moonlight-sonata',
        order: 2,
        poemReward: '床前明月光',
        poemRewardCondition: { minRating: 'C', minAccuracy: 60 }
      }
    ],
    endings: [
      {
        type: 'good',
        title: '月华如练',
        description: '月光与你融为一体，诗篇在月色中彻底觉醒。书屋化为星河，你成为了浮岛书屋永远的守护者，诗句将永远为你闪耀。',
        poemFragment: '月华如练照长空，诗心共鸣映苍穹。浮岛书屋星河里，永恒守护此梦中。',
        minAverageRating: 'A',
        minAverageAccuracy: 85
      },
      {
        type: 'normal',
        title: '月下独酌',
        description: '月光洒落，诗篇渐渐浮现。虽然尚未完全觉醒，但书屋已认可了你的诚意，门扉为你留了一道缝隙。',
        poemFragment: '月下独酌诗半卷，书屋半开待余缘。',
        minAverageRating: 'C',
        minAverageAccuracy: 60
      },
      {
        type: 'bad',
        title: '月隐云遮',
        description: '月光被云层遮蔽，诗篇重新沉入黑暗。但你不会放弃，因为你知道，月终会再圆。',
        poemFragment: '月隐云遮诗渐暗，待到圆时再启卷。',
        minAverageRating: 'D',
        minAverageAccuracy: 0
      }
    ],
    prerequisiteChapterId: 'chapter-2',
    prerequisiteCondition: { minRating: 'B', minAccuracy: 70 },
    mapPosition: { x: 360, y: 360 },
    mapIcon: '🌙'
  }
];

export class StoryChapterSystem {
  private static instance: StoryChapterSystem | null = null;
  private state: StoryState;
  private listeners: Set<StoryStateChangeListener> = new Set();

  private constructor() {
    this.state = this.loadState();
    this.ensureAllChaptersInitialized();
  }

  public static getInstance(): StoryChapterSystem {
    if (!StoryChapterSystem.instance) {
      StoryChapterSystem.instance = new StoryChapterSystem();
    }
    return StoryChapterSystem.instance;
  }

  public getChapters(): StoryChapter[] {
    return [...CHAPTER_DEFINITIONS].sort((a, b) => a.order - b.order);
  }

  public getChapterById(chapterId: string): StoryChapter | undefined {
    return CHAPTER_DEFINITIONS.find(c => c.id === chapterId);
  }

  public getState(): StoryState {
    return { ...this.state, chapters: { ...this.state.chapters } };
  }

  public getChapterProgress(chapterId: string): ChapterProgress | undefined {
    return this.state.chapters[chapterId];
  }

  public getChapterMapData(): Array<StoryChapter & { progress: ChapterProgress }> {
    return this.getChapters().map(chapter => ({
      ...chapter,
      progress: this.state.chapters[chapter.id] || this.createInitialProgress(chapter.id)
    }));
  }

  public isChapterUnlocked(chapterId: string): boolean {
    const progress = this.state.chapters[chapterId];
    return progress?.isUnlocked ?? false;
  }

  public isLevelCompleted(chapterId: string, songId: string): boolean {
    const progress = this.state.chapters[chapterId];
    return progress?.levelsCompleted.includes(songId) ?? false;
  }

  public isPoemCollected(chapterId: string, poemLine: string): boolean {
    const progress = this.state.chapters[chapterId];
    return progress?.collectedPoems.some(p => p.poemLine === poemLine) ?? false;
  }

  public getAllCollectedPoems(): CollectedPoem[] {
    const poems: CollectedPoem[] = [];
    for (const progress of Object.values(this.state.chapters)) {
      poems.push(...progress.collectedPoems);
    }
    return poems;
  }

  public getChapterEnding(chapterId: string): EndingType | undefined {
    return this.state.chapters[chapterId]?.currentEnding;
  }

  public getChapterForSong(songId: string): StoryChapter | undefined {
    return CHAPTER_DEFINITIONS.find(ch =>
      ch.levels.some(lvl => lvl.songId === songId)
    );
  }

  public processScoreResult(
    songId: string,
    _difficulty: string,
    rating: string,
    accuracy: number
  ): StoryStateChangeEvent[] {
    const events: StoryStateChangeEvent[] = [];

    const chapter = this.getChapterForSong(songId);
    if (!chapter) return events;

    const level = chapter.levels.find(l => l.songId === songId);
    if (!level) return events;

    this.state.lastPlayedSongId = songId;
    this.state.lastPlayedAt = Date.now();

    const ratingRank = RATING_RANK[rating] ?? 0;
    const requiredRank = RATING_RANK[level.poemRewardCondition.minRating] ?? 0;
    const ratingMet = ratingRank >= requiredRank;
    const accuracyMet = level.poemRewardCondition.minAccuracy !== undefined
      ? accuracy >= level.poemRewardCondition.minAccuracy
      : true;

    if (ratingMet && accuracyMet) {
      const alreadyCollected = this.isPoemCollected(chapter.id, level.poemReward);
      if (!alreadyCollected) {
        const poem: CollectedPoem = {
          poemLine: level.poemReward,
          songId,
          chapterId: chapter.id,
          collectedAt: Date.now(),
          rating,
          accuracy
        };
        const progress = this.state.chapters[chapter.id];
        if (progress) {
          progress.collectedPoems.push(poem);
          this.state.totalCollectedPoems++;
        }
        events.push({
          type: 'poem_collected',
          chapterId: chapter.id,
          data: { songId, poemLine: level.poemReward, rating, accuracy },
          timestamp: Date.now()
        });
      }
    }

    const progress = this.state.chapters[chapter.id];
    if (progress && !progress.levelsCompleted.includes(songId)) {
      progress.levelsCompleted.push(songId);
      events.push({
        type: 'level_completed',
        chapterId: chapter.id,
        data: { songId, rating, accuracy },
        timestamp: Date.now()
      });
    }

    const allLevelsCompleted = chapter.levels.every(lvl =>
      this.isLevelCompleted(chapter.id, lvl.songId)
    );

    if (allLevelsCompleted) {
      const ending = this.determineEnding(chapter);
      if (ending) {
        const prevEnding = progress?.currentEnding;
        progress.currentEnding = ending.type;

        this.updateChapterBestStats(chapter.id, rating, accuracy);

        if (prevEnding !== ending.type) {
          events.push({
            type: 'ending_reached',
            chapterId: chapter.id,
            data: { endingType: ending.type, rating, accuracy },
            timestamp: Date.now()
          });
        }

        if (progress) {
          progress.completionCount++;
        }

        const wasCompleted = progress?.completionCount > 1;
        if (!wasCompleted) {
          events.push({
            type: 'chapter_completed',
            chapterId: chapter.id,
            data: { endingType: ending.type, rating, accuracy },
            timestamp: Date.now()
          });
        }
      }
    }

    this.evaluateChapterUnlocks();

    this.saveState();
    this.notifyListeners(events);

    return events;
  }

  private determineEnding(chapter: StoryChapter): ChapterEnding | null {
    const progress = this.state.chapters[chapter.id];
    if (!progress) return null;

    const ratings: number[] = [];
    const accuracies: number[] = [];

    for (const level of chapter.levels) {
      const bestScore = this.getBestScoreAcrossDifficulties(level.songId);
      if (bestScore) {
        ratings.push(RATING_RANK[bestScore.rating] ?? 0);
        accuracies.push(bestScore.accuracy);
      } else {
        ratings.push(0);
        accuracies.push(0);
      }
    }

    const avgRatingRank = ratings.reduce((a, b) => a + b, 0) / Math.max(1, ratings.length);
    const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / Math.max(1, accuracies.length);

    const sortedEndings = [...chapter.endings].sort((a, b) => {
      const rankA = RATING_RANK[a.minAverageRating] ?? 0;
      const rankB = RATING_RANK[b.minAverageRating] ?? 0;
      return rankB - rankA;
    });

    for (const ending of sortedEndings) {
      const requiredRank = RATING_RANK[ending.minAverageRating] ?? 0;
      if (avgRatingRank >= requiredRank && avgAccuracy >= ending.minAverageAccuracy) {
        return ending;
      }
    }

    return chapter.endings.find(e => e.type === 'bad') || null;
  }

  private getBestScoreAcrossDifficulties(songId: string): BestScore | null {
    const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
    let best: BestScore | null = null;

    for (const diff of difficulties) {
      const score = ScoreStorage.getBestScore(songId, diff);
      if (score) {
        if (!best || RATING_RANK[score.rating] > RATING_RANK[best.rating]) {
          best = score;
        }
      }
    }

    return best;
  }

  private evaluateChapterUnlocks(): void {
    for (const chapter of CHAPTER_DEFINITIONS) {
      const progress = this.state.chapters[chapter.id];
      if (!progress || progress.isUnlocked) continue;

      if (!chapter.prerequisiteChapterId || !chapter.prerequisiteCondition) {
        progress.isUnlocked = true;
        progress.unlockedAt = Date.now();
        continue;
      }

      const prereqProgress = this.state.chapters[chapter.prerequisiteChapterId];
      if (!prereqProgress || !prereqProgress.isUnlocked) continue;

      const allPrereqLevelsCompleted = this.getChapterById(chapter.prerequisiteChapterId)
        ?.levels.every(lvl => prereqProgress.levelsCompleted.includes(lvl.songId)) ?? false;

      if (!allPrereqLevelsCompleted) continue;

      const requiredRank = RATING_RANK[chapter.prerequisiteCondition.minRating] ?? 0;
      let conditionMet = true;

      if (prereqProgress.bestAverageRating) {
        const currentRank = RATING_RANK[prereqProgress.bestAverageRating] ?? 0;
        if (currentRank < requiredRank) conditionMet = false;
      } else {
        conditionMet = false;
      }

      if (conditionMet && chapter.prerequisiteCondition.minAccuracy !== undefined) {
        if ((prereqProgress.bestAverageAccuracy ?? 0) < chapter.prerequisiteCondition.minAccuracy) {
          conditionMet = false;
        }
      }

      if (conditionMet) {
        progress.isUnlocked = true;
        progress.unlockedAt = Date.now();
        this.notifyListeners([{
          type: 'chapter_unlocked',
          chapterId: chapter.id,
          timestamp: Date.now()
        }]);
      }
    }
  }

  private updateChapterBestStats(chapterId: string, latestRating: string, latestAccuracy: number): void {
    const progress = this.state.chapters[chapterId];
    if (!progress) return;

    const latestRank = RATING_RANK[latestRating] ?? 0;
    const currentBestRank = RATING_RANK[progress.bestAverageRating ?? 'D'] ?? 0;

    if (latestRank > currentBestRank) {
      progress.bestAverageRating = latestRating;
    }
    if (latestAccuracy > (progress.bestAverageAccuracy ?? 0)) {
      progress.bestAverageAccuracy = latestAccuracy;
    }
  }

  public addChangeListener(listener: StoryStateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(events: StoryStateChangeEvent[]): void {
    for (const event of events) {
      this.listeners.forEach(listener => listener(event));
    }
  }

  private ensureAllChaptersInitialized(): void {
    for (const chapter of CHAPTER_DEFINITIONS) {
      if (!this.state.chapters[chapter.id]) {
        this.state.chapters[chapter.id] = this.createInitialProgress(chapter.id);
      }
    }

    const firstChapter = CHAPTER_DEFINITIONS.find(c => c.order === 1);
    if (firstChapter) {
      const progress = this.state.chapters[firstChapter.id];
      if (progress && !progress.isUnlocked) {
        progress.isUnlocked = true;
        progress.unlockedAt = Date.now();
      }
      this.state.currentChapterId = firstChapter.id;
    }

    this.saveState();
  }

  private createInitialProgress(chapterId: string): ChapterProgress {
    return {
      chapterId,
      isUnlocked: false,
      levelsCompleted: [],
      collectedPoems: [],
      completionCount: 0
    };
  }

  private loadState(): StoryState {
    try {
      const data = localStorage.getItem(STORY_STATE_STORAGE_KEY);
      if (data) {
        const raw = JSON.parse(data);
        return {
          currentChapterId: raw.currentChapterId || 'chapter-1',
          chapters: raw.chapters || {},
          totalCollectedPoems: raw.totalCollectedPoems || 0,
          lastPlayedSongId: raw.lastPlayedSongId,
          lastPlayedAt: raw.lastPlayedAt
        };
      }
    } catch (e) {
      console.error('Failed to load story state:', e);
    }
    return {
      currentChapterId: 'chapter-1',
      chapters: {},
      totalCollectedPoems: 0
    };
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORY_STATE_STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save story state:', e);
    }
  }

  public resetAll(): void {
    this.state = {
      currentChapterId: 'chapter-1',
      chapters: {},
      totalCollectedPoems: 0
    };
    this.ensureAllChaptersInitialized();
    this.saveState();
  }

  public forceUnlockChapter(chapterId: string): boolean {
    const chapter = this.getChapterById(chapterId);
    if (!chapter) return false;

    const progress = this.state.chapters[chapterId];
    if (!progress) return false;

    if (!progress.isUnlocked) {
      progress.isUnlocked = true;
      progress.unlockedAt = Date.now();
      this.saveState();
      this.notifyListeners([{
        type: 'chapter_unlocked',
        chapterId,
        timestamp: Date.now()
      }]);
      return true;
    }
    return false;
  }

  public getCompletionPercentage(): number {
    const totalLevels = CHAPTER_DEFINITIONS.reduce((sum, ch) => sum + ch.levels.length, 0);
    if (totalLevels === 0) return 0;

    const completedLevels = Object.values(this.state.chapters).reduce(
      (sum, p) => sum + p.levelsCompleted.length, 0
    );
    return (completedLevels / totalLevels) * 100;
  }

  public getPoemCollectionPercentage(): number {
    const totalPoems = CHAPTER_DEFINITIONS.reduce((sum, ch) => sum + ch.levels.length, 0);
    if (totalPoems === 0) return 0;
    return (this.state.totalCollectedPoems / totalPoems) * 100;
  }

  public getEndingSummary(): Record<string, EndingType | undefined> {
    const result: Record<string, EndingType | undefined> = {};
    for (const chapter of CHAPTER_DEFINITIONS) {
      result[chapter.id] = this.state.chapters[chapter.id]?.currentEnding;
    }
    return result;
  }

  public getStorySummaryText(): string {
    const lines: string[] = [];
    lines.push(`📖 剧情进度: ${this.getCompletionPercentage().toFixed(0)}%`);
    lines.push(`📜 诗句收集: ${this.state.totalCollectedPoems}/${CHAPTER_DEFINITIONS.reduce((s, c) => s + c.levels.length, 0)}`);

    for (const chapter of this.getChapters()) {
      const progress = this.state.chapters[chapter.id];
      const lockStatus = progress?.isUnlocked ? '🔓' : '🔒';
      const levelCount = chapter.levels.length;
      const completedCount = progress?.levelsCompleted.length ?? 0;
      const endingText = progress?.currentEnding
        ? ` → ${chapter.endings.find(e => e.type === progress.currentEnding)?.title ?? ''}`
        : '';
      lines.push(`${lockStatus} ${chapter.title}: ${completedCount}/${levelCount}${endingText}`);
    }

    return lines.join('\n');
  }
}
