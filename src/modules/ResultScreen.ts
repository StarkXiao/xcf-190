import * as PIXI from 'pixi.js';
import { ScoreData, CharHitRecord, NoteType, NoteTypeStats, Difficulty, BestScore, StoryStateChangeEvent, JudgeEvent, CosmeticItem } from '../types';
import { ScoreStorage } from './ScoreStorage';
import { SongWithUnlock } from '../data/songs';
import { StoryChapterSystem } from './StoryChapterSystem';
import { SeasonSystem } from './SeasonSystem';
import { FriendBattle } from './FriendBattle';
import { SkinSystem } from './SkinSystem';

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  tap: '点击',
  hold: '长按',
  slide: '滑键'
};

const NOTE_TYPE_COLORS: Record<NoteType, number> = {
  tap: 0x6b9dff,
  hold: 0x9b59b6,
  slide: 0xe74c3c
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难'
};

const RATING_COLORS: Record<string, number> = {
  S: 0xffd700,
  A: 0x6bff9d,
  B: 0x6b9dff,
  C: 0xff9d5b,
  D: 0xff6b6b
};

export class ResultScreen {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private onRestartCallback?: () => void;
  private onBackToStartCallback?: () => void;

  private miniLeaderboardPanel: PIXI.Container;
  private miniLeaderboardVisible: boolean = false;

  private battleComparisonPanel: PIXI.Container;

  private animationComplete: boolean = false;
  private animationCompleteTimer?: number;
  private pendingAction?: 'restart' | 'back';
  private isTransitioningOut: boolean = false;

  private readonly TOTAL_ANIMATION_DURATION = 3200;
  private readonly TRANSITION_OUT_DURATION = 400;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.container.visible = false;
    this.miniLeaderboardPanel = new PIXI.Container();
    this.battleComparisonPanel = new PIXI.Container();
    this.app.stage.addChild(this.container);
  }

  public show(
    score: ScoreData,
    _poemLines: string[],
    charRecords: CharHitRecord[],
    songId?: string,
    difficulty?: Difficulty,
    isNewRecord?: boolean,
    previousBest?: BestScore | null,
    accuracy: number = 0,
    isPractice: boolean = false,
    practiceSpeed: number = 1.0,
    newlyUnlockedSongs: SongWithUnlock[] = [],
    storyEvents: StoryStateChangeEvent[] = [],
    songTitle: string = '',
    challengeId?: string,
    judgeEvents?: JudgeEvent[],
    newlyUnlockedCosmetics: string[] = []
  ): void {
    this.animationComplete = false;
    this.pendingAction = undefined;
    this.isTransitioningOut = false;
    if (this.animationCompleteTimer) {
      clearTimeout(this.animationCompleteTimer);
      this.animationCompleteTimer = undefined;
    }

    this.container.visible = true;
    this.container.removeChildren();
    this.miniLeaderboardVisible = false;
    this.miniLeaderboardPanel.removeChildren();

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.85);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    this.container.addChild(mask);

    let seasonResult = null;
    if (!isPractice && songId && difficulty) {
      const seasonSystem = SeasonSystem.getInstance();
      seasonResult = seasonSystem.onGameComplete(
        songId,
        songTitle,
        difficulty,
        score,
        accuracy,
        isPractice
      );
    }

    this.createPoemDisplay(charRecords);
    this.createScoreDisplay(score, accuracy, previousBest, isPractice, practiceSpeed);
    this.createTypeStatsDisplay(score.typeStats);
    if (isNewRecord && !isPractice) {
      this.createNewRecordBadge();
    }
    if (isPractice) {
      this.createPracticeModeBadge(practiceSpeed);
    }
    if (newlyUnlockedSongs && newlyUnlockedSongs.length > 0) {
      this.createUnlockNotification(newlyUnlockedSongs);
    }
    if (storyEvents && storyEvents.length > 0) {
      this.createStoryProgressNotifications(storyEvents);
    }
    if (seasonResult && (seasonResult.pointsGained > 0 || seasonResult.completedTasks.length > 0 || seasonResult.isNewWeeklyBest)) {
      this.createSeasonProgressNotification(seasonResult);
    }
    if (newlyUnlockedCosmetics && newlyUnlockedCosmetics.length > 0) {
      this.createCosmeticUnlockNotification(newlyUnlockedCosmetics);
    }
    this.createSongInfoFooter(songId, difficulty, isPractice);
    this.createMiniLeaderboardButton(songId, difficulty);
    if (challengeId && !isPractice && judgeEvents) {
      this.createBattleSubmitButton(score, accuracy, challengeId, judgeEvents);
    }
    this.createRestartButton();
    this.createBackToStartButton();
    this.container.addChild(this.miniLeaderboardPanel);
    this.container.addChild(this.battleComparisonPanel);
    this.animateIn();

    this.animationCompleteTimer = window.setTimeout(() => {
      this.animationComplete = true;
      this.animationCompleteTimer = undefined;
      if (this.pendingAction && !this.isTransitioningOut) {
        this.executePendingAction();
      }
    }, this.TOTAL_ANIMATION_DURATION);
  }

  private createPracticeModeBadge(practiceSpeed: number): void {
    const badgeContainer = new PIXI.Container();
    badgeContainer.x = this.app.screen.width / 2;
    badgeContainer.y = 70;

    const badgeBg = new PIXI.Graphics();
    badgeBg.beginFill(0xff6b9d, 0.9);
    badgeBg.lineStyle(3, 0xffd700, 0.8);
    badgeBg.drawRoundedRect(-160, -22, 320, 44, 12);
    badgeBg.endFill();
    badgeContainer.addChild(badgeBg);

    const badgeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });

    const badgeText = new PIXI.Text(
      `🎯 练习模式  (速度 ${practiceSpeed.toFixed(2)}x)  ·  成绩不计入记录`,
      badgeStyle
    );
    badgeText.anchor.set(0.5);
    badgeContainer.addChild(badgeText);

    badgeContainer.scale.set(0);
    badgeContainer.alpha = 0;
    this.container.addChild(badgeContainer);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 600;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        badgeContainer.scale.set(eased);
        badgeContainer.alpha = eased;
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }, 300);
  }

  private createUnlockNotification(unlockedSongs: SongWithUnlock[]): void {
    if (unlockedSongs.length === 0) return;

    const notificationContainer = new PIXI.Container();
    notificationContainer.x = this.app.screen.width / 2;
    notificationContainer.y = 130;

    const totalWidth = 420;
    const cardHeight = 60 + unlockedSongs.length * 50;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a3a1a, 0.95);
    bg.lineStyle(3, 0xffd700, 1);
    bg.drawRoundedRect(-totalWidth / 2, -cardHeight / 2, totalWidth, cardHeight, 16);
    bg.endFill();
    notificationContainer.addChild(bg);

    const sparkleCount = 8;
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (i / sparkleCount) * Math.PI * 2;
      const radius = totalWidth / 2 + 8;
      const spark = new PIXI.Graphics();
      spark.beginFill(0xffd700, 0.8);
      spark.drawCircle(0, 0, 3);
      spark.endFill();
      spark.x = Math.cos(angle) * radius;
      spark.y = Math.sin(angle) * (cardHeight / 2 + 8);
      spark.name = `spark_${i}`;
      notificationContainer.addChild(spark);
    }

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center'
    });
    const header = new PIXI.Text('🎉 新诗篇解锁！', headerStyle);
    header.anchor.set(0.5);
    header.y = -cardHeight / 2 + 28;
    notificationContainer.addChild(header);

    unlockedSongs.forEach((song, index) => {
      const songY = -cardHeight / 2 + 58 + index * 50;

      const songBg = new PIXI.Graphics();
      songBg.beginFill(0x6bff9d, 0.15);
      songBg.lineStyle(1, 0x6bff9d, 0.5);
      songBg.drawRoundedRect(-totalWidth / 2 + 20, songY - 18, totalWidth - 40, 40, 8);
      songBg.endFill();
      notificationContainer.addChild(songBg);

      const unlockIconStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 18,
        align: 'center'
      });
      const unlockIcon = new PIXI.Text('🔓', unlockIconStyle);
      unlockIcon.anchor.set(0, 0.5);
      unlockIcon.x = -totalWidth / 2 + 32;
      unlockIcon.y = songY + 2;
      notificationContainer.addChild(unlockIcon);

      const songTitleStyle = new PIXI.TextStyle({
        fontFamily: 'serif',
        fontSize: 18,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'left'
      });
      const songTitle = new PIXI.Text(song.title, songTitleStyle);
      songTitle.anchor.set(0, 0.5);
      songTitle.x = -totalWidth / 2 + 62;
      songTitle.y = songY + 2;
      notificationContainer.addChild(songTitle);

      const artistStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: 0x88ccaa,
        align: 'right'
      });
      const artistText = new PIXI.Text(song.artist, artistStyle);
      artistText.anchor.set(1, 0.5);
      artistText.x = totalWidth / 2 - 20;
      artistText.y = songY + 2;
      notificationContainer.addChild(artistText);
    });

    notificationContainer.scale.set(0);
    notificationContainer.alpha = 0;
    this.container.addChild(notificationContainer);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 800;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        notificationContainer.scale.set(eased);
        notificationContainer.alpha = eased;
        notificationContainer.rotation = (1 - eased) * 0.15;

        for (let i = 0; i < sparkleCount; i++) {
          const spark = notificationContainer.getChildByName(`spark_${i}`) as PIXI.Graphics;
          if (spark) {
            const angle = (i / sparkleCount) * Math.PI * 2 + elapsed / 500;
            const baseRadius = totalWidth / 2 + 8;
            const pulseRadius = baseRadius + Math.sin(elapsed / 150 + i) * 4;
            spark.x = Math.cos(angle) * pulseRadius;
            spark.y = Math.sin(angle) * (cardHeight / 2 + 8 + Math.sin(elapsed / 150 + i) * 4);
            spark.alpha = 0.5 + Math.sin(elapsed / 200 + i * 0.8) * 0.5;
          }
        }

        if (progress < 1 || elapsed < duration + 2000) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }, 1200);
  }

  private createStoryProgressNotifications(events: StoryStateChangeEvent[]): void {
    const poemEvents = events.filter(e => e.type === 'poem_collected');
    const endingEvents = events.filter(e => e.type === 'ending_reached');
    const chapterUnlockEvents = events.filter(e => e.type === 'chapter_unlocked');
    const chapterCompleteEvents = events.filter(e => e.type === 'chapter_completed');

    let currentY = 200;

    for (const event of poemEvents) {
      this.createPoemCollectedNotification(event, currentY);
      currentY += 110;
    }

    for (const event of chapterUnlockEvents) {
      this.createChapterUnlockedNotification(event, currentY);
      currentY += 120;
    }

    for (const event of chapterCompleteEvents) {
      this.createChapterCompleteNotification(event, currentY);
      currentY += 130;
    }

    for (const event of endingEvents) {
      this.createEndingReachedNotification(event, currentY);
      currentY += 140;
    }
  }

  private createPoemCollectedNotification(event: StoryStateChangeEvent, baseY: number): void {
    const notificationContainer = new PIXI.Container();
    notificationContainer.x = this.app.screen.width / 2;
    notificationContainer.y = baseY;

    const totalWidth = 400;
    const cardHeight = 90;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x2a1a3a, 0.95);
    bg.lineStyle(3, 0xffd700, 1);
    bg.drawRoundedRect(-totalWidth / 2, -cardHeight / 2, totalWidth, cardHeight, 14);
    bg.endFill();
    notificationContainer.addChild(bg);

    const sparkleCount = 10;
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (i / sparkleCount) * Math.PI * 2;
      const radius = totalWidth / 2 + 10;
      const spark = new PIXI.Graphics();
      spark.beginFill(0xffd700, 0.9);
      spark.drawCircle(0, 0, 2.5);
      spark.endFill();
      spark.x = Math.cos(angle) * radius;
      spark.y = Math.sin(angle) * (cardHeight / 2 + 10);
      spark.name = `spark_${i}`;
      notificationContainer.addChild(spark);
    }

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center'
    });
    const header = new PIXI.Text('📜 新诗句收集！', headerStyle);
    header.anchor.set(0.5);
    header.y = -cardHeight / 2 + 22;
    notificationContainer.addChild(header);

    const poemStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffffcc,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    const poemText = new PIXI.Text(`「${event.data?.poemLine ?? ''}」`, poemStyle);
    poemText.anchor.set(0.5);
    poemText.y = 8;
    notificationContainer.addChild(poemText);

    const metaStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 11,
      fill: 0xaaaaaa,
      align: 'center'
    });
    const metaText = new PIXI.Text(
      `${event.data?.rating ?? ''} · ${(event.data?.accuracy ?? 0).toFixed(1)}%`,
      metaStyle
    );
    metaText.anchor.set(0.5);
    metaText.y = cardHeight / 2 - 18;
    notificationContainer.addChild(metaText);

    notificationContainer.scale.set(0);
    notificationContainer.alpha = 0;
    this.container.addChild(notificationContainer);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 700;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        notificationContainer.scale.set(eased);
        notificationContainer.alpha = eased;

        for (let i = 0; i < sparkleCount; i++) {
          const spark = notificationContainer.getChildByName(`spark_${i}`) as PIXI.Graphics;
          if (spark) {
            const angle = (i / sparkleCount) * Math.PI * 2 + elapsed / 400;
            const baseRadius = totalWidth / 2 + 10;
            const pulseRadius = baseRadius + Math.sin(elapsed / 120 + i) * 5;
            spark.x = Math.cos(angle) * pulseRadius;
            spark.y = Math.sin(angle) * (cardHeight / 2 + 10 + Math.sin(elapsed / 120 + i) * 5);
            spark.alpha = 0.6 + Math.sin(elapsed / 150 + i * 0.8) * 0.4;
          }
        }

        if (progress < 1 || elapsed < duration + 2500) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }, 1600);
  }

  private createChapterUnlockedNotification(event: StoryStateChangeEvent, baseY: number): void {
    const storySystem = StoryChapterSystem.getInstance();
    const chapter = storySystem.getChapterById(event.chapterId);
    if (!chapter) return;

    const notificationContainer = new PIXI.Container();
    notificationContainer.x = this.app.screen.width / 2;
    notificationContainer.y = baseY;

    const totalWidth = 420;
    const cardHeight = 100;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a3a2a, 0.95);
    bg.lineStyle(3, 0x6bff9d, 1);
    bg.drawRoundedRect(-totalWidth / 2, -cardHeight / 2, totalWidth, cardHeight, 14);
    bg.endFill();
    notificationContainer.addChild(bg);

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0x6bff9d,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center'
    });
    const header = new PIXI.Text('🔓 新篇章解锁！', headerStyle);
    header.anchor.set(0.5);
    header.y = -cardHeight / 2 + 24;
    notificationContainer.addChild(header);

    const chapterStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    const chapterText = new PIXI.Text(`${chapter.mapIcon} ${chapter.title}`, chapterStyle);
    chapterText.anchor.set(0.5);
    chapterText.y = 10;
    notificationContainer.addChild(chapterText);

    const subtitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x88ccaa,
      align: 'center'
    });
    const subtitleText = new PIXI.Text(chapter.subtitle, subtitleStyle);
    subtitleText.anchor.set(0.5);
    subtitleText.y = cardHeight / 2 - 18;
    notificationContainer.addChild(subtitleText);

    notificationContainer.scale.set(0);
    notificationContainer.alpha = 0;
    this.container.addChild(notificationContainer);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 800;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        notificationContainer.scale.set(eased);
        notificationContainer.alpha = eased;
        notificationContainer.rotation = (1 - eased) * 0.1;

        if (progress < 1 || elapsed < duration + 2500) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }, 2000);
  }

  private createChapterCompleteNotification(event: StoryStateChangeEvent, baseY: number): void {
    const storySystem = StoryChapterSystem.getInstance();
    const chapter = storySystem.getChapterById(event.chapterId);
    if (!chapter) return;

    const notificationContainer = new PIXI.Container();
    notificationContainer.x = this.app.screen.width / 2;
    notificationContainer.y = baseY;

    const totalWidth = 440;
    const cardHeight = 110;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x3a2a1a, 0.95);
    bg.lineStyle(3, 0xffd700, 1);
    bg.drawRoundedRect(-totalWidth / 2, -cardHeight / 2, totalWidth, cardHeight, 14);
    bg.endFill();
    notificationContainer.addChild(bg);

    const starCount = 5;
    for (let i = 0; i < starCount; i++) {
      const angle = (i / starCount) * Math.PI * 2;
      const radius = totalWidth / 2 + 12;
      const star = new PIXI.Graphics();
      star.beginFill(0xffd700, 1);
      this.drawStar(star, 0, 0, 5, 6, 3);
      star.endFill();
      star.x = Math.cos(angle) * radius;
      star.y = Math.sin(angle) * (cardHeight / 2 + 12);
      star.name = `star_${i}`;
      notificationContainer.addChild(star);
    }

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center'
    });
    const header = new PIXI.Text('🎉 章节完成！', headerStyle);
    header.anchor.set(0.5);
    header.y = -cardHeight / 2 + 26;
    notificationContainer.addChild(header);

    const chapterStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    const chapterText = new PIXI.Text(`${chapter.mapIcon} ${chapter.title}`, chapterStyle);
    chapterText.anchor.set(0.5);
    chapterText.y = 8;
    notificationContainer.addChild(chapterText);

    const ending = chapter.endings.find(e => e.type === event.data?.endingType);
    if (ending) {
      const endingStyle = new PIXI.TextStyle({
        fontFamily: 'serif',
        fontSize: 14,
        fill: 0xffd700,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'center'
      });
      const endingText = new PIXI.Text(`结局：${ending.title}`, endingStyle);
      endingText.anchor.set(0.5);
      endingText.y = cardHeight / 2 - 20;
      notificationContainer.addChild(endingText);
    }

    notificationContainer.scale.set(0);
    notificationContainer.alpha = 0;
    this.container.addChild(notificationContainer);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 900;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        notificationContainer.scale.set(eased);
        notificationContainer.alpha = eased;
        notificationContainer.rotation = Math.sin(elapsed / 200) * 0.03 * (1 - progress);

        for (let i = 0; i < starCount; i++) {
          const star = notificationContainer.getChildByName(`star_${i}`) as PIXI.Graphics;
          if (star) {
            const angle = (i / starCount) * Math.PI * 2 + elapsed / 300;
            const baseRadius = totalWidth / 2 + 12;
            const pulseRadius = baseRadius + Math.sin(elapsed / 100 + i) * 6;
            star.x = Math.cos(angle) * pulseRadius;
            star.y = Math.sin(angle) * (cardHeight / 2 + 12 + Math.sin(elapsed / 100 + i) * 6);
            star.rotation += 0.02;
            star.alpha = 0.7 + Math.sin(elapsed / 120 + i) * 0.3;
          }
        }

        if (progress < 1 || elapsed < duration + 3000) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }, 2400);
  }

  private createEndingReachedNotification(event: StoryStateChangeEvent, baseY: number): void {
    const storySystem = StoryChapterSystem.getInstance();
    const chapter = storySystem.getChapterById(event.chapterId);
    if (!chapter) return;

    const ending = chapter.endings.find(e => e.type === event.data?.endingType);
    if (!ending) return;

    const notificationContainer = new PIXI.Container();
    notificationContainer.x = this.app.screen.width / 2;
    notificationContainer.y = baseY;

    const totalWidth = 460;
    const cardHeight = 120;

    const endingColor = event.data?.endingType === 'good' ? 0xffd700 : 
                      event.data?.endingType === 'normal' ? 0x6b9dff : 0x888888;
    const endingIcon = event.data?.endingType === 'good' ? '🌟' : 
                       event.data?.endingType === 'normal' ? '✨' : '💫';

    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a1a3a, 0.95);
    bg.lineStyle(4, endingColor, 1);
    bg.drawRoundedRect(-totalWidth / 2, -cardHeight / 2, totalWidth, cardHeight, 16);
    bg.endFill();
    notificationContainer.addChild(bg);

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: endingColor,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center'
    });
    const header = new PIXI.Text(`${endingIcon} 达成新结局！`, headerStyle);
    header.anchor.set(0.5);
    header.y = -cardHeight / 2 + 26;
    notificationContainer.addChild(header);

    const endingStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    const endingText = new PIXI.Text(ending.title, endingStyle);
    endingText.anchor.set(0.5);
    endingText.y = 5;
    notificationContainer.addChild(endingText);

    const poemStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 14,
      fill: endingColor,
      stroke: 0x000000,
      strokeThickness: 1,
      align: 'center'
    });
    const poemText = new PIXI.Text(`「${ending.poemFragment}」`, poemStyle);
    poemText.anchor.set(0.5);
    poemText.y = 35;
    notificationContainer.addChild(poemText);

    const metaStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 11,
      fill: 0xaaaaaa,
      align: 'center'
    });
    const metaText = new PIXI.Text(
      `${chapter.mapIcon} ${chapter.title}`,
      metaStyle
    );
    metaText.anchor.set(0.5);
    metaText.y = cardHeight / 2 - 18;
    notificationContainer.addChild(metaText);

    notificationContainer.scale.set(0);
    notificationContainer.alpha = 0;
    this.container.addChild(notificationContainer);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 1000;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        notificationContainer.scale.set(eased);
        notificationContainer.alpha = eased;
        notificationContainer.rotation = Math.sin(elapsed / 250) * 0.02 * (1 - progress);

        if (progress < 1 || elapsed < duration + 3500) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }, 2800);
  }

  private createCosmeticUnlockNotification(cosmeticIds: string[]): void {
    if (cosmeticIds.length === 0) return;

    const cosmetics: CosmeticItem[] = [];
    for (const id of cosmeticIds) {
      const cosmetic = SkinSystem.getAllCosmetics().find(c => c.id === id);
      if (cosmetic) {
        cosmetics.push(cosmetic);
      }
    }
    if (cosmetics.length === 0) return;

    const notificationContainer = new PIXI.Container();
    notificationContainer.x = this.app.screen.width / 2;
    notificationContainer.y = 180;

    const totalWidth = 440;
    const cardHeight = 80 + cosmetics.length * 55;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x2a1a3a, 0.95);
    bg.lineStyle(3, 0xffd700, 1);
    bg.drawRoundedRect(-totalWidth / 2, -cardHeight / 2, totalWidth, cardHeight, 16);
    bg.endFill();
    notificationContainer.addChild(bg);

    const sparkleCount = 12;
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (i / sparkleCount) * Math.PI * 2;
      const radius = totalWidth / 2 + 10;
      const spark = new PIXI.Graphics();
      spark.beginFill(0xffd700, 0.9);
      spark.drawCircle(0, 0, 3);
      spark.endFill();
      spark.x = Math.cos(angle) * radius;
      spark.y = Math.sin(angle) * (cardHeight / 2 + 10);
      spark.name = `spark_${i}`;
      notificationContainer.addChild(spark);
    }

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center'
    });
    const header = new PIXI.Text('🎨 新装扮解锁！', headerStyle);
    header.anchor.set(0.5);
    header.y = -cardHeight / 2 + 28;
    notificationContainer.addChild(header);

    cosmetics.forEach((cosmetic, index) => {
      const itemY = -cardHeight / 2 + 60 + index * 55;

      const itemBg = new PIXI.Graphics();
      itemBg.beginFill(0xffd700, 0.1);
      itemBg.lineStyle(1, 0xffd700, 0.5);
      itemBg.drawRoundedRect(-totalWidth / 2 + 20, itemY - 22, totalWidth - 40, 44, 8);
      itemBg.endFill();
      notificationContainer.addChild(itemBg);

      const typeLabels: Record<string, string> = {
        theme: '主题',
        track_effect: '轨道',
        poem_frame: '边框',
        note_skin: '音符',
        combo_effect: '连击',
        judge_effect: '判定'
      };
      const typeLabel = typeLabels[cosmetic.type] || cosmetic.type;

      const rarityColors: Record<string, number> = {
        common: 0x9ca3af,
        rare: 0x3b82f6,
        epic: 0x8b5cf6,
        legendary: 0xf59e0b
      };
      const rarityColor = rarityColors[cosmetic.rarity] || 0xffffff;

      const itemStyle = new PIXI.TextStyle({
        fontFamily: 'serif',
        fontSize: 18,
        fontWeight: 'bold',
        fill: rarityColor,
        stroke: 0x000000,
        strokeThickness: 2,
        align: 'left'
      });
      const itemText = new PIXI.Text(`[${typeLabel}] ${cosmetic.name}`, itemStyle);
      itemText.anchor.set(0, 0.5);
      itemText.x = -totalWidth / 2 + 35;
      itemText.y = itemY;
      notificationContainer.addChild(itemText);

      const iconStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 16,
        align: 'center'
      });
      const icon = new PIXI.Text('✨', iconStyle);
      icon.anchor.set(0, 0.5);
      icon.x = -totalWidth / 2 + 15;
      icon.y = itemY;
      notificationContainer.addChild(icon);
    });

    notificationContainer.scale.set(0);
    notificationContainer.alpha = 0;
    this.container.addChild(notificationContainer);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 800;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        notificationContainer.scale.set(eased);
        notificationContainer.alpha = eased;
        notificationContainer.rotation = (1 - eased) * 0.15;

        for (let i = 0; i < sparkleCount; i++) {
          const spark = notificationContainer.getChildByName(`spark_${i}`) as PIXI.Graphics;
          if (spark) {
            const angle = (i / sparkleCount) * Math.PI * 2 + elapsed / 400;
            const baseRadius = totalWidth / 2 + 10;
            const pulseRadius = baseRadius + Math.sin(elapsed / 120 + i) * 5;
            spark.x = Math.cos(angle) * pulseRadius;
            spark.y = Math.sin(angle) * (cardHeight / 2 + 10 + Math.sin(elapsed / 120 + i) * 5);
            spark.alpha = 0.6 + Math.sin(elapsed / 150 + i * 0.8) * 0.4;
          }
        }

        if (progress < 1 || elapsed < duration + 3000) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }, 2200);
  }

  private createSeasonProgressNotification(seasonResult: {
    pointsGained: number;
    completedTasks: string[];
    isNewWeeklyBest: boolean;
  }): void {
    const seasonSystem = SeasonSystem.getInstance();
    const progressInfo = seasonSystem.getProgressInfo();
    const tasks = seasonSystem.getAllTasks();
    const completedTaskInfos = tasks.filter(t => seasonResult.completedTasks.includes(t.id));

    const notificationContainer = new PIXI.Container();
    notificationContainer.x = this.app.screen.width / 2;
    notificationContainer.y = 150;

    const totalWidth = 400;
    const hasTasks = completedTaskInfos.length > 0;
    const cardHeight = 80 + (hasTasks ? completedTaskInfos.length * 32 : 0) + (seasonResult.isNewWeeklyBest ? 40 : 0);

    const bg = new PIXI.Graphics();
    bg.beginFill(0x2a1a3a, 0.95);
    bg.lineStyle(3, 0xffd700, 1);
    bg.drawRoundedRect(-totalWidth / 2, -cardHeight / 2, totalWidth, cardHeight, 14);
    bg.endFill();
    notificationContainer.addChild(bg);

    const sparkleCount = 6;
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (i / sparkleCount) * Math.PI * 2;
      const radius = totalWidth / 2 + 8;
      const spark = new PIXI.Graphics();
      spark.beginFill(0xffd700, 0.8);
      spark.drawCircle(0, 0, 3);
      spark.endFill();
      spark.x = Math.cos(angle) * radius;
      spark.y = Math.sin(angle) * (cardHeight / 2 + 8);
      spark.name = `spark_${i}`;
      notificationContainer.addChild(spark);
    }

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    const header = new PIXI.Text('🏆 赛季活动更新', headerStyle);
    header.anchor.set(0.5);
    header.y = -cardHeight / 2 + 24;
    notificationContainer.addChild(header);

    let currentY = -cardHeight / 2 + 50;

    if (seasonResult.pointsGained > 0) {
      const pointsStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 16,
        fontWeight: 'bold',
        fill: 0x6bff9d,
        align: 'center'
      });
      const pointsText = new PIXI.Text(
        `+${seasonResult.pointsGained} 积分  Lv.${progressInfo.currentLevel}`,
        pointsStyle
      );
      pointsText.anchor.set(0.5);
      pointsText.y = currentY;
      notificationContainer.addChild(pointsText);
      currentY += 28;
    }

    if (hasTasks) {
      const taskLabelStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fill: 0xaaaaaa,
        align: 'left'
      });
      const taskLabel = new PIXI.Text('完成任务:', taskLabelStyle);
      taskLabel.anchor.set(0, 0);
      taskLabel.x = -totalWidth / 2 + 20;
      taskLabel.y = currentY;
      notificationContainer.addChild(taskLabel);
      currentY += 22;

      completedTaskInfos.forEach(task => {
        const taskStyle = new PIXI.TextStyle({
          fontFamily: 'sans-serif',
          fontSize: 13,
          fill: 0xffffff,
          align: 'left'
        });
        const taskText = new PIXI.Text(
          `✓ ${task.title}  (+${task.rewardPoints})`,
          taskStyle
        );
        taskText.anchor.set(0, 0);
        taskText.x = -totalWidth / 2 + 30;
        taskText.y = currentY;
        notificationContainer.addChild(taskText);
        currentY += 26;
      });
    }

    if (seasonResult.isNewWeeklyBest) {
      const bestStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0xff6b9d,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'center'
      });
      const bestText = new PIXI.Text('🌟 新周榜最佳成绩！', bestStyle);
      bestText.anchor.set(0.5);
      bestText.y = currentY + 10;
      notificationContainer.addChild(bestText);
    }

    notificationContainer.scale.set(0);
    notificationContainer.alpha = 0;
    this.container.addChild(notificationContainer);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 700;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        notificationContainer.scale.set(eased);
        notificationContainer.alpha = eased;

        for (let i = 0; i < sparkleCount; i++) {
          const spark = notificationContainer.getChildByName(`spark_${i}`) as PIXI.Graphics;
          if (spark) {
            const angle = (i / sparkleCount) * Math.PI * 2 + elapsed / 500;
            const baseRadius = totalWidth / 2 + 10;
            const pulseRadius = baseRadius + Math.sin(elapsed / 150 + i) * 4;
            spark.x = Math.cos(angle) * pulseRadius;
            spark.y = Math.sin(angle) * (cardHeight / 2 + 10 + Math.sin(elapsed / 150 + i) * 4);
            spark.alpha = 0.6 + Math.sin(elapsed / 180 + i * 0.7) * 0.4;
          }
        }

        if (progress < 1 || elapsed < duration + 4000) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }, 2000);
  }

  private drawStar(graphics: PIXI.Graphics, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): void {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;

    graphics.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      graphics.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      graphics.lineTo(x, y);
      rot += step;
    }
    graphics.lineTo(cx, cy - outerRadius);
  }

  private createNewRecordBadge(): void {
    const badgeContainer = new PIXI.Container();
    badgeContainer.x = this.app.screen.width / 2;
    badgeContainer.y = this.app.screen.height / 2 - 10;
    badgeContainer.rotation = -0.2;

    const badgeBg = new PIXI.Graphics();
    badgeBg.beginFill(0xffd700);
    badgeBg.lineStyle(4, 0xff8c00, 1);
    badgeBg.drawRoundedRect(-100, -25, 200, 50, 10);
    badgeBg.endFill();
    badgeContainer.addChild(badgeBg);

    const badgeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0x8b4513,
      stroke: 0xffffff,
      strokeThickness: 2,
      align: 'center'
    });

    const badgeText = new PIXI.Text('★ NEW RECORD! ★', badgeStyle);
    badgeText.anchor.set(0.5);
    badgeContainer.addChild(badgeText);

    badgeContainer.scale.set(0);
    badgeContainer.alpha = 0;
    this.container.addChild(badgeContainer);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 800;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        badgeContainer.scale.set(eased);
        badgeContainer.alpha = eased;
        badgeContainer.rotation = -0.2 + Math.sin(elapsed / 100) * 0.05;

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }, 1500);
  }

  private createPoemDisplay(charRecords: CharHitRecord[]): void {
    const poemContainer = new PIXI.Container();
    poemContainer.x = this.app.screen.width / 2;
    poemContainer.y = 110;

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      align: 'center'
    });

    const title = new PIXI.Text('~ 演奏结果 ~', titleStyle);
    title.anchor.set(0.5);
    title.y = -40;
    poemContainer.addChild(title);

    const typeHintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'center'
    });

    const typeHint = new PIXI.Text('[蓝=点击 紫=长按 红=滑键]', typeHintStyle);
    typeHint.anchor.set(0.5);
    typeHint.y = -14;
    poemContainer.addChild(typeHint);

    const charsPerLine = 8;
    const charSpacing = 34;
    const lineHeight = 42;

    for (let i = 0; i < charRecords.length; i++) {
      const record = charRecords[i];
      const lineIndex = Math.floor(i / charsPerLine);
      const colIndex = i % charsPerLine;
      const lineCharCount = Math.min(charsPerLine, charRecords.length - lineIndex * charsPerLine);
      const lineStartX = -(lineCharCount - 1) * charSpacing / 2;

      const typeColor = NOTE_TYPE_COLORS[record.noteType];
      const charStyle = record.hit
        ? new PIXI.TextStyle({
            fontFamily: 'serif',
            fontSize: 24,
            fill: 0xffd700,
            fontWeight: 'bold',
            stroke: typeColor,
            strokeThickness: 3,
            dropShadow: true,
            dropShadowColor: typeColor,
            dropShadowBlur: 6,
            align: 'center'
          })
        : new PIXI.TextStyle({
            fontFamily: 'serif',
            fontSize: 24,
            fill: 0x555555,
            stroke: typeColor,
            strokeThickness: 2,
            align: 'center'
          });

      const displayChar = record.hit ? record.char : '＿';
      const charText = new PIXI.Text(displayChar, charStyle);
      charText.anchor.set(0.5);
      charText.x = lineStartX + colIndex * charSpacing;
      charText.y = lineIndex * lineHeight;
      charText.alpha = 0;
      charText.scale.set(0);
      poemContainer.addChild(charText);

      this.animateCharReveal(charText, record.hit, 400 + i * 60);
    }

    this.container.addChild(poemContainer);
  }

  private animateCharReveal(text: PIXI.Text, hit: boolean, delay: number): void {
    setTimeout(() => {
      const startTime = Date.now();
      const duration = hit ? 500 : 350;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (hit) {
          const eased = 1 - Math.pow(1 - progress, 3);
          text.scale.set(eased);
          text.alpha = eased;
          if (progress >= 0.5 && progress < 0.55) {
            text.scale.set(1.2);
          }
        } else {
          text.alpha = progress * 0.7;
          text.scale.set(progress * 0.9);
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          if (hit) {
            text.scale.set(1);
            text.alpha = 1;
          } else {
            text.scale.set(0.9);
            text.alpha = 0.7;
          }
        }
      };

      animate();
    }, delay);
  }

  private createScoreDisplay(
    score: ScoreData,
    accuracy: number,
    previousBest?: BestScore | null,
    isPractice: boolean = false,
    practiceSpeed: number = 1.0
  ): void {
    const startY = this.app.screen.height / 2 + 10;

    const ratingStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 90,
      fontWeight: 'bold',
      fill: RATING_COLORS[score.rating] || 0xffffff,
      stroke: 0x000000,
      strokeThickness: 6,
      align: 'center'
    });

    const rating = new PIXI.Text(score.rating, ratingStyle);
    rating.anchor.set(0.5);
    rating.x = this.app.screen.width / 2;
    rating.y = startY;
    rating.scale.set(0);
    this.container.addChild(rating);

    setTimeout(() => this.animateRatingIn(rating), 700);

    const scoreStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 26,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });

    const scoreText = new PIXI.Text(`得分: ${score.score}`, scoreStyle);
    scoreText.anchor.set(0.5);
    scoreText.x = this.app.screen.width / 2;
    scoreText.y = startY + 62;
    scoreText.alpha = 0;
    this.container.addChild(scoreText);
    setTimeout(() => this.animateFadeIn(scoreText), 1000);

    const accColor = accuracy >= 95 ? 0xffd700 : accuracy >= 85 ? 0x6bff9d : accuracy >= 70 ? 0x6b9dff : 0xff6b6b;
    const accStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: accColor,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    const accText = new PIXI.Text(`准确率: ${accuracy.toFixed(2)}%`, accStyle);
    accText.anchor.set(0.5);
    accText.x = this.app.screen.width / 2;
    accText.y = startY + 94;
    accText.alpha = 0;
    this.container.addChild(accText);
    setTimeout(() => this.animateFadeIn(accText), 1050);

    if (!isPractice) {
      if (previousBest && previousBest.score < score.score) {
        const scoreDiff = score.score - previousBest.score;
        const accDiff = accuracy - previousBest.accuracy;
        const improveStyle = new PIXI.TextStyle({
          fontFamily: 'sans-serif',
          fontSize: 14,
          fontWeight: 'bold',
          fill: 0x6bff9d,
          stroke: 0x000000,
          strokeThickness: 1,
          align: 'center'
        });
        const improveText = new PIXI.Text(
          `↑ 历史最佳 +${scoreDiff}分  +${accDiff >= 0 ? accDiff.toFixed(1) : accDiff.toFixed(1)}%`,
          improveStyle
        );
        improveText.anchor.set(0.5);
        improveText.x = this.app.screen.width / 2;
        improveText.y = startY + 122;
        improveText.alpha = 0;
        this.container.addChild(improveText);
        setTimeout(() => this.animateFadeIn(improveText), 1300);
      } else if (previousBest && previousBest.score >= score.score) {
        const scoreDiff = previousBest.score - score.score;
        const gapStyle = new PIXI.TextStyle({
          fontFamily: 'sans-serif',
          fontSize: 13,
          fill: 0xaaaaaa,
          stroke: 0x000000,
          strokeThickness: 1,
          align: 'center'
        });
        const gapText = new PIXI.Text(
          `距历史最佳还差 ${scoreDiff} 分`,
          gapStyle
        );
        gapText.anchor.set(0.5);
        gapText.x = this.app.screen.width / 2;
        gapText.y = startY + 122;
        gapText.alpha = 0;
        this.container.addChild(gapText);
        setTimeout(() => this.animateFadeIn(gapText), 1300);
      }
    } else {
      const practiceHintStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fill: 0x88ccff,
        fontStyle: 'italic',
        align: 'center',
        stroke: 0x000000,
        strokeThickness: 1
      });
      const practiceHint = new PIXI.Text(
        '💡 练习模式成绩仅保存在历史记录中，可随时对比查看进步',
        practiceHintStyle
      );
      practiceHint.anchor.set(0.5);
      practiceHint.x = this.app.screen.width / 2;
      practiceHint.y = startY + 122;
      practiceHint.alpha = 0;
      this.container.addChild(practiceHint);
      setTimeout(() => this.animateFadeIn(practiceHint), 1300);
    }

    const statsContainer = new PIXI.Container();
    statsContainer.x = this.app.screen.width / 2;
    statsContainer.y = startY + 150;

    const statStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fill: 0xaaaaaa,
      stroke: 0x000000,
      strokeThickness: 1,
      align: 'center'
    });

    const stats = [
      `Perfect: ${score.perfect}`,
      `Great: ${score.great}`,
      `Good: ${score.good}`,
      `Miss: ${score.miss}`,
      `MaxCombo: ${score.maxCombo}`
    ];

    if (isPractice && practiceSpeed !== 1.0) {
      stats.push(`速度: ${practiceSpeed.toFixed(2)}x`);
    }

    const spacing = Math.min(90, (this.app.screen.width - 120) / stats.length);
    stats.forEach((stat, index) => {
      const text = new PIXI.Text(stat, statStyle);
      text.anchor.set(0.5);
      text.x = (index - (stats.length - 1) / 2) * spacing;
      text.alpha = 0;
      statsContainer.addChild(text);
      setTimeout(() => this.animateFadeIn(text), 1400 + index * 80);
    });

    this.container.addChild(statsContainer);
  }

  private createTypeStatsDisplay(typeStats: NoteTypeStats): void {
    const statsY = this.app.screen.height / 2 + 210;

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });

    const title = new PIXI.Text('─ 分型统计 ─', titleStyle);
    title.anchor.set(0.5);
    title.x = this.app.screen.width / 2;
    title.y = statsY;
    title.alpha = 0;
    this.container.addChild(title);
    setTimeout(() => this.animateFadeIn(title), 1700);

    const types: NoteType[] = ['tap', 'hold', 'slide'];
    types.forEach((type, index) => {
      const stats = typeStats[type];
      const total = stats.perfect + stats.great + stats.good + stats.miss;

      if (total === 0) return;

      const container = new PIXI.Container();
      container.x = this.app.screen.width / 2;
      container.y = statsY + 35 + index * 48;

      const typeColor = NOTE_TYPE_COLORS[type];

      const typeBg = new PIXI.Graphics();
      typeBg.beginFill(typeColor, 0.12);
      typeBg.lineStyle(2, typeColor, 0.5);
      typeBg.drawRoundedRect(-260, -20, 520, 40, 8);
      typeBg.endFill();
      container.addChild(typeBg);

      const typeLabelStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        fill: typeColor,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'left'
      });

      const typeLabel = new PIXI.Text(`${NOTE_TYPE_LABELS[type]} (${total})`, typeLabelStyle);
      typeLabel.anchor.set(0, 0.5);
      typeLabel.x = -250;
      container.addChild(typeLabel);

      const accuracy = ((stats.perfect * 100 + stats.great * 70 + stats.good * 30) / (total * 100)) * 100;
      const accuracyText = `${accuracy.toFixed(1)}%`;
      const accuracyStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fill: accuracy >= 90 ? 0xffd700 : accuracy >= 70 ? 0x6bff9d : 0xff6b6b,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'right'
      });

      const accuracyLabel = new PIXI.Text(accuracyText, accuracyStyle);
      accuracyLabel.anchor.set(1, 0.5);
      accuracyLabel.x = 250;
      container.addChild(accuracyLabel);

      const barBg = new PIXI.Graphics();
      barBg.beginFill(0x333333, 0.8);
      barBg.drawRoundedRect(-110, -7, 220, 14, 4);
      barBg.endFill();
      container.addChild(barBg);

      const barWidth = 220;
      const perfectWidth = (stats.perfect / total) * barWidth;
      const greatWidth = (stats.great / total) * barWidth;
      const goodWidth = (stats.good / total) * barWidth;

      let currentX = -110;

      if (perfectWidth > 0) {
        const perfectBar = new PIXI.Graphics();
        perfectBar.beginFill(0xffd700, 1);
        perfectBar.drawRoundedRect(currentX, -7, perfectWidth, 14, 4);
        perfectBar.endFill();
        container.addChild(perfectBar);
        currentX += perfectWidth;
      }

      if (greatWidth > 0) {
        const greatBar = new PIXI.Graphics();
        greatBar.beginFill(0x00ff00, 1);
        greatBar.drawRoundedRect(currentX, -7, greatWidth, 14, 4);
        greatBar.endFill();
        container.addChild(greatBar);
        currentX += greatWidth;
      }

      if (goodWidth > 0) {
        const goodBar = new PIXI.Graphics();
        goodBar.beginFill(0x00bfff, 1);
        goodBar.drawRoundedRect(currentX, -7, goodWidth, 14, 4);
        goodBar.endFill();
        container.addChild(goodBar);
      }

      const statNumbersStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 10,
        fill: 0x888888,
        align: 'left'
      });

      const statNumbers = `P:${stats.perfect} G:${stats.great} O:${stats.good} M:${stats.miss}`;
      const statNumbersLabel = new PIXI.Text(statNumbers, statNumbersStyle);
      statNumbersLabel.anchor.set(0, 0.5);
      statNumbersLabel.x = -110;
      statNumbersLabel.y = 16;
      container.addChild(statNumbersLabel);

      container.alpha = 0;
      this.container.addChild(container);
      setTimeout(() => this.animateFadeIn(container), 1800 + index * 120);
    });
  }

  private createSongInfoFooter(songId?: string, difficulty?: Difficulty, isPractice: boolean = false): void {
    if (!songId || !difficulty) return;

    const footerStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x666688,
      align: 'center'
    });

    const history = ScoreStorage.getScoreHistoryForDifficulty(songId, difficulty);
    const practiceLabel = isPractice ? '  |  [练习模式]' : '  |  [正式成绩]';
    const footerText = new PIXI.Text(
      `曲目: ${songId}  |  难度: ${DIFFICULTY_LABELS[difficulty]}${practiceLabel}  |  已游玩 ${history.length} 次`,
      footerStyle
    );
    footerText.anchor.set(0.5);
    footerText.x = this.app.screen.width / 2;
    footerText.y = this.app.screen.height - 130;
    footerText.alpha = 0;
    this.container.addChild(footerText);
    setTimeout(() => this.animateFadeIn(footerText), 2600);
  }

  private createMiniLeaderboardButton(songId?: string, difficulty?: Difficulty): void {
    const btnContainer = new PIXI.Graphics();
    btnContainer.x = 60;
    btnContainer.y = this.app.screen.height - 60;

    btnContainer.beginFill(0x9b59b6, 0.9);
    btnContainer.lineStyle(2, 0xffd700, 0.6);
    btnContainer.drawRoundedRect(-45, -22, 90, 44, 10);
    btnContainer.endFill();

    const btnStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const text = new PIXI.Text('🏆 看排行', btnStyle);
    text.anchor.set(0.5);
    btnContainer.addChild(text);

    btnContainer.interactive = true;
    btnContainer.cursor = 'pointer';
    btnContainer.alpha = 0;
    btnContainer.on('pointerdown', () => this.toggleMiniLeaderboard(songId, difficulty));

    this.container.addChild(btnContainer);
    setTimeout(() => this.animateFadeIn(btnContainer), 2700);
  }

  private toggleMiniLeaderboard(songId?: string, difficulty?: Difficulty): void {
    this.miniLeaderboardVisible = !this.miniLeaderboardVisible;
    this.miniLeaderboardPanel.removeChildren();

    if (!this.miniLeaderboardVisible) return;
    if (!songId || !difficulty) return;

    const panelWidth = Math.min(480, this.app.screen.width - 60);
    const panelHeight = Math.min(420, this.app.screen.height - 160);
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = (this.app.screen.height - panelHeight) / 2;

    const panelMask = new PIXI.Graphics();
    panelMask.beginFill(0x000000, 0.7);
    panelMask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    panelMask.endFill();
    panelMask.interactive = true;
    panelMask.on('pointerdown', () => this.toggleMiniLeaderboard());
    this.miniLeaderboardPanel.addChild(panelMask);

    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0x151530, 0.98);
    panelBg.lineStyle(3, 0xffd700, 0.8);
    panelBg.drawRoundedRect(panelX, panelY, panelWidth, panelHeight, 14);
    panelBg.endFill();
    this.miniLeaderboardPanel.addChild(panelBg);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 22,
      fill: 0xffd700,
      fontWeight: 'bold',
      align: 'center'
    });
    const title = new PIXI.Text('🏆 TOP 10 成绩榜', titleStyle);
    title.anchor.set(0.5);
    title.x = this.app.screen.width / 2;
    title.y = panelY + 30;
    this.miniLeaderboardPanel.addChild(title);

    const closeBtn = new PIXI.Graphics();
    closeBtn.x = panelX + panelWidth - 35;
    closeBtn.y = panelY + 28;
    closeBtn.beginFill(0xff6b6b, 0.9);
    closeBtn.drawRoundedRect(-16, -16, 32, 32, 6);
    closeBtn.endFill();
    closeBtn.interactive = true;
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.toggleMiniLeaderboard());

    const closeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    const closeText = new PIXI.Text('✕', closeStyle);
    closeText.anchor.set(0.5);
    closeBtn.addChild(closeText);
    this.miniLeaderboardPanel.addChild(closeBtn);

    const startX = panelX + 25;
    const contentWidth = panelWidth - 50;

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'left'
    });
    const colHeaders = ['#', '评级', '分数', '连击', '准确率', '日期'];
    const colXs = [0, 35, 75, 165, 230, 310];

    colHeaders.forEach((header, i) => {
      const text = new PIXI.Text(header, headerStyle);
      text.anchor.set(0, 0);
      text.x = startX + colXs[i];
      text.y = panelY + 55;
      this.miniLeaderboardPanel.addChild(text);
    });

    const divider = new PIXI.Graphics();
    divider.lineStyle(1, 0x444466, 0.6);
    divider.moveTo(startX, panelY + 74);
    divider.lineTo(startX + contentWidth, panelY + 74);
    this.miniLeaderboardPanel.addChild(divider);

    const topScores = ScoreStorage.getTopScores(songId, difficulty, 10);

    if (topScores.length === 0) {
      const emptyStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0x666666,
        fontStyle: 'italic',
        align: 'center'
      });
      const emptyText = new PIXI.Text('还没有其他成绩~', emptyStyle);
      emptyText.anchor.set(0.5);
      emptyText.x = this.app.screen.width / 2;
      emptyText.y = panelY + 120;
      this.miniLeaderboardPanel.addChild(emptyText);
      return;
    }

    const rowHeight = 28;
    topScores.forEach((entry, index) => {
      const rowY = panelY + 80 + index * rowHeight;
      const isTopThree = index < 3;

      if (isTopThree) {
        const rowBg = new PIXI.Graphics();
        const bgColor = index === 0 ? 0xffd700 : index === 1 ? 0xc0c0c0 : 0xcd7f32;
        rowBg.beginFill(bgColor, 0.1);
        rowBg.drawRoundedRect(startX - 3, rowY - 2, contentWidth + 6, rowHeight - 4, 4);
        rowBg.endFill();
        this.miniLeaderboardPanel.addChild(rowBg);
      }

      const rankColor = index === 0 ? 0xffd700 : index === 1 ? 0xe0e0e0 : index === 2 ? 0xcd7f32 : 0x888888;
      const rankStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: isTopThree ? 13 : 12,
        fontWeight: isTopThree ? 'bold' : 'normal',
        fill: rankColor,
        align: 'left'
      });
      const rankLabel = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
      const rankText = new PIXI.Text(rankLabel, rankStyle);
      rankText.anchor.set(0, 0.5);
      rankText.x = startX + colXs[0];
      rankText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(rankText);

      const ratingColor = RATING_COLORS[entry.rating] || 0xffffff;
      const ratingStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: ratingColor,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'left'
      });
      const ratingText = new PIXI.Text(entry.rating, ratingStyle);
      ratingText.anchor.set(0, 0.5);
      ratingText.x = startX + colXs[1];
      ratingText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(ratingText);

      const scoreStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: 0x6b9dff,
        align: 'left'
      });
      const scoreText = new PIXI.Text(entry.score.toLocaleString(), scoreStyle);
      scoreText.anchor.set(0, 0.5);
      scoreText.x = startX + colXs[2];
      scoreText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(scoreText);

      const comboStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 11,
        fill: 0xff9d5b,
        align: 'left'
      });
      const comboText = new PIXI.Text(`${entry.maxCombo}x`, comboStyle);
      comboText.anchor.set(0, 0.5);
      comboText.x = startX + colXs[3];
      comboText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(comboText);

      const accColor = entry.accuracy >= 95 ? 0xffd700 : entry.accuracy >= 85 ? 0x6bff9d : entry.accuracy >= 70 ? 0x6b9dff : 0xff6b6b;
      const accStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 11,
        fill: accColor,
        align: 'left'
      });
      const accText = new PIXI.Text(`${entry.accuracy.toFixed(1)}%`, accStyle);
      accText.anchor.set(0, 0.5);
      accText.x = startX + colXs[4];
      accText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(accText);

      const date = new Date(entry.timestamp);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      const dateStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 10,
        fill: 0x888888,
        align: 'left'
      });
      const dateText = new PIXI.Text(dateStr, dateStyle);
      dateText.anchor.set(0, 0.5);
      dateText.x = startX + colXs[5];
      dateText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(dateText);
    });
  }

  private animateRatingIn(rating: PIXI.Text): void {
    const startTime = Date.now();
    const duration = 600;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const scale = Math.sin(progress * Math.PI) * 0.5 + 0.5;
      const finalScale = 1 + (1 - progress) * 0.3;

      rating.scale.set(scale * finalScale);
      rating.rotation = (1 - progress) * 0.3;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  private animateFadeIn(container: PIXI.Container | PIXI.Text, delay: number = 0): void {
    setTimeout(() => {
      const startTime = Date.now();
      const duration = 450;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        container.alpha = progress;

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }, delay);
  }

  private executePendingAction(): void {
    if (!this.pendingAction) return;
    const action = this.pendingAction;
    this.pendingAction = undefined;

    this.animateOutAndHide(() => {
      if (action === 'restart' && this.onRestartCallback) {
        this.onRestartCallback();
      } else if (action === 'back' && this.onBackToStartCallback) {
        this.onBackToStartCallback();
      }
    });
  }

  private requestAction(action: 'restart' | 'back'): void {
    if (this.isTransitioningOut) return;

    if (this.animationComplete) {
      this.pendingAction = action;
      this.executePendingAction();
    } else {
      this.pendingAction = action;
      this.showActionWaitingIndicator(action);
    }
  }

  private showActionWaitingIndicator(action: 'restart' | 'back'): void {
    const indicator = new PIXI.Container();
    indicator.x = this.app.screen.width / 2;
    indicator.y = this.app.screen.height / 2 + 80;
    indicator.name = 'waitingIndicator';

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.7);
    bg.lineStyle(2, 0xffd700, 0.8);
    bg.drawRoundedRect(-140, -20, 280, 40, 8);
    bg.endFill();
    indicator.addChild(bg);

    const label = action === 'restart' ? '⏳ 等待动画播放完毕后重新开始...' : '⏳ 等待动画播放完毕后返回菜单...';
    const style = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 1,
      align: 'center'
    });
    const text = new PIXI.Text(label, style);
    text.anchor.set(0.5);
    indicator.addChild(text);

    const existing = this.container.getChildByName('waitingIndicator');
    if (existing) {
      this.container.removeChild(existing);
      existing.destroy();
    }

    let dots = 0;
    indicator.alpha = 0;
    const startTime = Date.now();
    const fadeIn = () => {
      const elapsed = Date.now() - startTime;
      indicator.alpha = Math.min(elapsed / 300, 1);
      dots = (dots + 1) % 4;
      text.text = label.replace('...', '.'.repeat(dots + 1));
      if (elapsed < 300 || this.pendingAction === action) {
        requestAnimationFrame(fadeIn);
      }
    };
    this.container.addChild(indicator);
    requestAnimationFrame(fadeIn);
  }

  private animateOutAndHide(onComplete: () => void): void {
    if (this.isTransitioningOut) return;
    this.isTransitioningOut = true;

    const existing = this.container.getChildByName('waitingIndicator');
    if (existing) {
      this.container.removeChild(existing);
      existing.destroy();
    }

    const startTime = Date.now();
    const startAlpha = this.container.alpha;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.TRANSITION_OUT_DURATION, 1);
      this.container.alpha = startAlpha * (1 - progress);
      this.container.scale.set(1 + progress * 0.05);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.container.scale.set(1);
        this.doHide();
        onComplete();
      }
    };

    animate();
  }

  private doHide(): void {
    this.container.visible = false;
    this.container.alpha = 1;
    this.container.removeChildren();
    this.miniLeaderboardVisible = false;
    this.miniLeaderboardPanel.removeChildren();
    this.battleComparisonPanel.removeChildren();
    this.isTransitioningOut = false;
  }

  private createRestartButton(): void {
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = this.app.screen.width / 2 + 80;
    buttonContainer.y = this.app.screen.height - 60;

    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x6b9dff);
    buttonBg.drawRoundedRect(-85, -25, 170, 50, 10);
    buttonBg.endFill();

    buttonBg.interactive = true;
    buttonBg.cursor = 'pointer';

    buttonBg.on('pointerdown', () => {
      this.requestAction('restart');
    });

    buttonContainer.addChild(buttonBg);

    const buttonStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const buttonText = new PIXI.Text('再来一次', buttonStyle);
    buttonText.anchor.set(0.5);
    buttonContainer.addChild(buttonText);

    buttonContainer.alpha = 0;
    this.container.addChild(buttonContainer);

    setTimeout(() => this.animateFadeIn(buttonContainer), 2700);
  }

  private createBackToStartButton(): void {
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = this.app.screen.width / 2 - 80;
    buttonContainer.y = this.app.screen.height - 60;

    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x666677);
    buttonBg.drawRoundedRect(-85, -25, 170, 50, 10);
    buttonBg.endFill();

    buttonBg.interactive = true;
    buttonBg.cursor = 'pointer';

    buttonBg.on('pointerdown', () => {
      this.requestAction('back');
    });

    buttonContainer.addChild(buttonBg);

    const buttonStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const buttonText = new PIXI.Text('返回主菜单', buttonStyle);
    buttonText.anchor.set(0.5);
    buttonContainer.addChild(buttonText);

    buttonContainer.alpha = 0;
    this.container.addChild(buttonContainer);

    setTimeout(() => this.animateFadeIn(buttonContainer), 2750);
  }

  private createBattleSubmitButton(
    score: ScoreData,
    accuracy: number,
    challengeId: string,
    judgeEvents: JudgeEvent[]
  ): void {
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = this.app.screen.width / 2;
    buttonContainer.y = this.app.screen.height - 120;

    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0xff6b9d);
    buttonBg.lineStyle(2, 0xffd700, 0.8);
    buttonBg.drawRoundedRect(-130, -25, 260, 50, 12);
    buttonBg.endFill();

    buttonBg.interactive = true;
    buttonBg.cursor = 'pointer';

    const cid = challengeId;
    const sc = score;
    const acc = accuracy;
    const je = judgeEvents;
    const totalNotes = score.perfect + score.great + score.good + score.miss;
    const self = this;

    buttonBg.on('pointerdown', () => {
      const result = FriendBattle.submitBattleResult(cid, sc, acc, je, totalNotes);
      if (result) {
        buttonBg.off('pointerdown');
        buttonBg.clear();
        buttonBg.beginFill(0x6bff9d, 0.8);
        buttonBg.drawRoundedRect(-130, -25, 260, 50, 12);
        buttonBg.endFill();

        buttonText.text = '✓ 成绩已提交';
        buttonText.style.fill = 0x000000;

        const comparison = FriendBattle.getBattleComparison(cid);
        if (comparison) {
          self.showBattleComparisonPanel(comparison);
        }
      }
    });

    buttonContainer.addChild(buttonBg);

    const buttonStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const buttonText = new PIXI.Text('⚔ 提交对战成绩', buttonStyle);
    buttonText.anchor.set(0.5);
    buttonContainer.addChild(buttonText);

    buttonContainer.alpha = 0;
    this.container.addChild(buttonContainer);

    setTimeout(() => this.animateFadeIn(buttonContainer), 2800);
  }

  private showBattleComparisonPanel(comparison: import('../types').BattleComparison): void {
    this.battleComparisonPanel.removeChildren();

    const panelWidth = Math.min(600, this.app.screen.width - 40);
    const panelHeight = 380;
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = 100;

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.85);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    mask.interactive = true;
    mask.on('pointerdown', () => {
      this.battleComparisonPanel.visible = false;
    });
    this.battleComparisonPanel.addChild(mask);

    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0x151530, 0.98);
    panelBg.lineStyle(3, 0xff6b9d, 0.8);
    panelBg.drawRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
    panelBg.endFill();
    this.battleComparisonPanel.addChild(panelBg);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 24,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      align: 'center'
    });

    const titleText = new PIXI.Text('⚔ 对战结算对比', titleStyle);
    titleText.anchor.set(0.5);
    titleText.x = this.app.screen.width / 2;
    titleText.y = panelY + 30;
    this.battleComparisonPanel.addChild(titleText);

    const closeBtn = new PIXI.Graphics();
    closeBtn.x = panelX + panelWidth - 40;
    closeBtn.y = panelY + 25;
    closeBtn.beginFill(0xff6b6b, 0.9);
    closeBtn.drawRoundedRect(-15, -15, 30, 30, 8);
    closeBtn.endFill();
    closeBtn.interactive = true;
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => {
      this.battleComparisonPanel.visible = false;
    });

    const closeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    const closeText = new PIXI.Text('✕', closeStyle);
    closeText.anchor.set(0.5);
    closeBtn.addChild(closeText);
    this.battleComparisonPanel.addChild(closeBtn);

    const songStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0xaaaaaa,
      align: 'center'
    });
    const songText = new PIXI.Text(
      `${comparison.songTitle} [${DIFFICULTY_LABELS[comparison.difficulty]}]`,
      songStyle
    );
    songText.anchor.set(0.5);
    songText.x = this.app.screen.width / 2;
    songText.y = panelY + 60;
    this.battleComparisonPanel.addChild(songText);

    const leftX = panelX + 20;
    const rightX = panelX + panelWidth / 2 + 10;
    const colWidth = panelWidth / 2 - 30;
    const startY = panelY + 85;

    if (comparison.challengerResult) {
      this.renderPlayerResultCard(comparison.challengerResult, leftX, startY, colWidth, comparison.winnerId === comparison.challengerResult.playerId);
    }
    if (comparison.challengedResult) {
      this.renderPlayerResultCard(comparison.challengedResult, rightX, startY, colWidth, comparison.winnerId === comparison.challengedResult.playerId);
    }

    const vsStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center'
    });
    const vsText = new PIXI.Text('VS', vsStyle);
    vsText.anchor.set(0.5);
    vsText.x = this.app.screen.width / 2;
    vsText.y = startY + 70;
    this.battleComparisonPanel.addChild(vsText);

    const resultY = startY + 210;
    const resultStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: comparison.isDraw ? 0xffd700 : 0x6bff9d,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });

    let resultLabel = '等待对手...';
    if (comparison.challengerResult && comparison.challengedResult) {
      resultLabel = comparison.isDraw ? '平局！' : '🎉 胜利！';
      if (!comparison.isDraw && comparison.winnerId) {
        const winner = comparison.winnerId === comparison.challengerResult.playerId
          ? comparison.challengerResult.displayName
          : comparison.challengedResult.displayName;
        resultLabel = `${winner} 获胜！`;
        resultStyle.fill = comparison.isDraw ? 0xffd700 : 0x6bff9d;
      }
    }

    const resultText = new PIXI.Text(resultLabel, resultStyle);
    resultText.anchor.set(0.5);
    resultText.x = this.app.screen.width / 2;
    resultText.y = resultY;
    this.battleComparisonPanel.addChild(resultText);

    if (comparison.challengerResult && comparison.challengedResult) {
      const diffStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fill: 0x88ccff,
        align: 'center'
      });
      const diffText = new PIXI.Text(
        `分差: ${comparison.scoreDiff}  |  连击差: ${Math.abs(comparison.challengerResult.maxCombo - comparison.challengedResult.maxCombo)}`,
        diffStyle
      );
      diffText.anchor.set(0.5);
      diffText.x = this.app.screen.width / 2;
      diffText.y = resultY + 30;
      this.battleComparisonPanel.addChild(diffText);
    }

    this.battleComparisonPanel.visible = true;
  }

  private renderPlayerResultCard(result: import('../types').BattlePlayerResult, x: number, y: number, width: number, isWinner: boolean): void {
    const cardHeight = 200;

    const bg = new PIXI.Graphics();
    bg.beginFill(isWinner ? 0x2a3a2a : 0x1a1a2a, 0.8);
    bg.lineStyle(2, isWinner ? 0xffd700 : 0x666688, 0.7);
    bg.drawRoundedRect(x, y, width, cardHeight, 10);
    bg.endFill();
    this.battleComparisonPanel.addChild(bg);

    if (isWinner) {
      const crownStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 20,
        align: 'center'
      });
      const crown = new PIXI.Text('👑', crownStyle);
      crown.anchor.set(0.5);
      crown.x = x + width / 2;
      crown.y = y + 15;
      this.battleComparisonPanel.addChild(crown);
    }

    const nameStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: isWinner ? 0xffd700 : 0xffffff,
      align: 'center'
    });
    const name = new PIXI.Text(result.displayName, nameStyle);
    name.anchor.set(0.5);
    name.x = x + width / 2;
    name.y = y + (isWinner ? 38 : 18);
    this.battleComparisonPanel.addChild(name);

    const statStyle = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 13,
      fill: 0xcccccc,
      align: 'left'
    });

    const stats = [
      `分数: ${result.score}`,
      `评级: ${result.rating}`,
      `连击: ${result.maxCombo}x`,
      `准确率: ${result.accuracy.toFixed(1)}%`,
      `Perfect: ${result.perfect}`,
      `Great: ${result.great}`,
      `Good: ${result.good}`,
      `Miss: ${result.miss}`
    ];

    stats.forEach((stat, i) => {
      const text = new PIXI.Text(stat, statStyle);
      text.anchor.set(0, 0);
      text.x = x + 15;
      text.y = y + (isWinner ? 55 : 35) + i * 18;
      this.battleComparisonPanel.addChild(text);
    });
  }

  private animateIn(): void {
    this.container.alpha = 0;
    const startTime = Date.now();
    const duration = 450;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      this.container.alpha = progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  public setOnRestartCallback(callback: () => void): void {
    this.onRestartCallback = callback;
  }

  public setOnBackToStartCallback(callback: () => void): void {
    this.onBackToStartCallback = callback;
  }

  public hide(): void {
    if (this.animationCompleteTimer) {
      clearTimeout(this.animationCompleteTimer);
      this.animationCompleteTimer = undefined;
    }
    this.pendingAction = undefined;
    this.doHide();
  }

  public destroy(): void {
    if (this.animationCompleteTimer) {
      clearTimeout(this.animationCompleteTimer);
      this.animationCompleteTimer = undefined;
    }
    this.container.destroy();
    this.miniLeaderboardPanel.destroy();
  }
}
