import * as PIXI from 'pixi.js';
import {
  StoryChapter,
  ChapterProgress,
  StoryStateChangeEvent
} from '../types';
import { StoryChapterSystem } from './StoryChapterSystem';

interface ChapterNode {
  chapter: StoryChapter;
  progress: ChapterProgress;
  container: PIXI.Container;
  icon: PIXI.Text;
  title: PIXI.Text;
  statusBadge: PIXI.Text;
  isSelected: boolean;
}

interface ChapterDetailPanel {
  container: PIXI.Container;
  title: PIXI.Text;
  subtitle: PIXI.Text;
  description: PIXI.Text;
  levelsContainer: PIXI.Container;
  endingsContainer: PIXI.Container;
}

export class ChapterMapView {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private storySystem: StoryChapterSystem;
  private nodes: ChapterNode[] = [];
  private detailPanel: ChapterDetailPanel | null = null;
  private selectedChapterId: string | null = null;
  private onCloseCallback?: () => void;
  private onStartSongCallback?: (songId: string) => void;
  private removeStoryListener?: () => void;

  private readonly MAP_PADDING_TOP = 80;
  private readonly MAP_PADDING_SIDE = 60;
  private readonly NODE_SIZE = 100;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.container.visible = false;
    this.storySystem = StoryChapterSystem.getInstance();
    this.app.stage.addChild(this.container);
  }

  public show(): void {
    this.container.visible = true;
    this.container.removeChildren();
    this.createMapBackground();
    this.createMapNodes();
    this.createHeader();
    this.createCloseButton();
    this.setupStoryListener();
    this.animateIn();
  }

  public hide(): void {
    this.animateOut(() => {
      this.container.visible = false;
      this.container.removeChildren();
      this.nodes = [];
      this.detailPanel = null;
      this.selectedChapterId = null;
      if (this.removeStoryListener) {
        this.removeStoryListener();
        this.removeStoryListener = undefined;
      }
    });
  }

  private setupStoryListener(): void {
    if (this.removeStoryListener) {
      this.removeStoryListener();
    }
    this.removeStoryListener = this.storySystem.addChangeListener((event: StoryStateChangeEvent) => {
      this.updateNodeProgress(event.chapterId);
    });
  }

  private createMapBackground(): void {
    const mask = new PIXI.Graphics();
    mask.beginFill(0x0a0a1a, 0.95);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    this.container.addChild(mask);

    const gradientBg = new PIXI.Graphics();
    const starCount = 50;
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * this.app.screen.width;
      const y = Math.random() * this.app.screen.height;
      const size = Math.random() * 2 + 1;
      gradientBg.beginFill(0xffd700, 0.3 + Math.random() * 0.4);
      gradientBg.drawCircle(x, y, size);
      gradientBg.endFill();
    }
    this.container.addChild(gradientBg);
  }

  private createHeader(): void {
    const headerContainer = new PIXI.Container();
    headerContainer.x = this.app.screen.width / 2;
    headerContainer.y = 40;

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 32,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center'
    });

    const title = new PIXI.Text('📖 章节地图', titleStyle);
    title.anchor.set(0.5);
    headerContainer.addChild(title);

    const state = this.storySystem.getState();
    const totalChapters = this.storySystem.getChapters().length;
    const completedChapters = Object.values(state.chapters).filter(c => c.completionCount > 0).length;

    const subtitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0xaaaaaa,
      align: 'center'
    });
    const subtitle = new PIXI.Text(
      `已解锁 ${completedChapters}/${totalChapters} 章  ·  诗句收集 ${state.totalCollectedPoems}`,
      subtitleStyle
    );
    subtitle.anchor.set(0.5);
    subtitle.y = 30;
    headerContainer.addChild(subtitle);

    this.container.addChild(headerContainer);
  }

  private createMapNodes(): void {
    const chapters = this.storySystem.getChapterMapData();
    
    const mapAreaHeight = this.app.screen.height - this.MAP_PADDING_TOP - 120;
    const mapAreaWidth = this.app.screen.width - this.MAP_PADDING_SIDE * 2;

    const lineGraphics = new PIXI.Graphics();
    lineGraphics.lineStyle(3, 0x444466, 0.6);
    
    for (let i = 0; i < chapters.length - 1; i++) {
      const current = chapters[i];
      const next = chapters[i + 1];
      const x1 = this.MAP_PADDING_SIDE + current.mapPosition.x / 720 * mapAreaWidth;
      const y1 = this.MAP_PADDING_TOP + current.mapPosition.y / 1000 * mapAreaHeight;
      const x2 = this.MAP_PADDING_SIDE + next.mapPosition.x / 720 * mapAreaWidth;
      const y2 = this.MAP_PADDING_TOP + next.mapPosition.y / 1000 * mapAreaHeight;
      
      lineGraphics.moveTo(x1, y1);
      lineGraphics.lineTo(x2, y2);
    }
    this.container.addChild(lineGraphics);

    for (const chapterData of chapters) {
      const x = this.MAP_PADDING_SIDE + chapterData.mapPosition.x / 720 * mapAreaWidth;
      const y = this.MAP_PADDING_TOP + chapterData.mapPosition.y / 1000 * mapAreaHeight;
      
      const node = this.createChapterNode(chapterData, x, y);
      this.nodes.push(node);
      this.container.addChild(node.container);
    }

    const firstUnlocked = chapters.find(c => c.progress.isUnlocked && c.progress.completionCount === 0);
    if (firstUnlocked) {
      this.selectChapter(firstUnlocked.id);
    } else if (chapters[0]) {
      this.selectChapter(chapters[0].id);
    }
  }

  private createChapterNode(
    chapterData: StoryChapter & { progress: ChapterProgress },
    x: number,
    y: number
  ): ChapterNode {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;

    const isUnlocked = chapterData.progress.isUnlocked;
    const isCompleted = chapterData.progress.completionCount > 0;

    const bg = new PIXI.Graphics();
    if (isUnlocked) {
      bg.beginFill(isCompleted ? 0x1a3a2a : 0x1a2a3a, 0.95);
      bg.lineStyle(3, isCompleted ? 0x6bff9d : 0x6b9dff, 0.8);
    } else {
      bg.beginFill(0x222233, 0.8);
      bg.lineStyle(2, 0x666666, 0.5);
    }
    bg.drawRoundedRect(-this.NODE_SIZE / 2, -this.NODE_SIZE / 2, this.NODE_SIZE, this.NODE_SIZE, 16);
    bg.endFill();
    bg.interactive = true;
    bg.cursor = isUnlocked ? 'pointer' : 'not-allowed';
    bg.name = 'nodeBg';
    container.addChild(bg);

    const iconStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 36,
      align: 'center'
    });
    const icon = new PIXI.Text(
      isUnlocked ? chapterData.mapIcon : '🔒',
      iconStyle
    );
    icon.anchor.set(0.5);
    icon.y = -8;
    icon.alpha = isUnlocked ? 1 : 0.5;
    container.addChild(icon);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: isUnlocked ? 0xffffff : 0x888888,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    const title = new PIXI.Text(chapterData.title, titleStyle);
    title.anchor.set(0.5);
    title.y = 28;
    container.addChild(title);

    const statusStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: 'bold',
      align: 'center'
    });
    let statusText = '';
    let statusColor = 0x888888;
    if (!isUnlocked) {
      statusText = '未解锁';
      statusColor = 0x888888;
    } else if (isCompleted) {
      statusText = `✓ ${chapterData.progress.currentEnding ? 
        chapterData.endings.find(e => e.type === chapterData.progress.currentEnding)?.title ?? '已完成' : 
        '已完成'}`;
      statusColor = 0x6bff9d;
    } else {
      const completed = chapterData.progress.levelsCompleted.length;
      const total = chapterData.levels.length;
      statusText = `${completed}/${total} 关`;
      statusColor = 0xffd700;
    }
    statusStyle.fill = statusColor;

    const statusBadge = new PIXI.Text(statusText, statusStyle);
    statusBadge.anchor.set(0.5);
    statusBadge.y = 44;
    container.addChild(statusBadge);

    if (isUnlocked) {
      bg.on('pointerdown', () => {
        this.selectChapter(chapterData.id);
      });
    }

    return {
      chapter: chapterData,
      progress: chapterData.progress,
      container,
      icon,
      title,
      statusBadge,
      isSelected: false
    };
  }

  private selectChapter(chapterId: string): void {
    this.selectedChapterId = chapterId;

    for (const node of this.nodes) {
      const bg = node.container.getChildByName('nodeBg') as PIXI.Graphics;
      if (bg) {
        bg.lineStyle(
          3,
          node.chapter.id === chapterId
            ? 0xffd700
            : node.progress.isUnlocked
              ? (node.progress.completionCount > 0 ? 0x6bff9d : 0x6b9dff)
              : 0x666666,
          0.8
        );
      }
      node.isSelected = node.chapter.id === chapterId;
    }

    this.showChapterDetail(chapterId);
  }

  private showChapterDetail(chapterId: string): void {
    if (this.detailPanel) {
      this.container.removeChild(this.detailPanel.container);
      this.detailPanel.container.destroy();
      this.detailPanel = null;
    }

    const chapter = this.storySystem.getChapterById(chapterId);
    const progress = this.storySystem.getChapterProgress(chapterId);
    if (!chapter || !progress) return;

    const panelWidth = Math.min(500, this.app.screen.width - 40);
    const panelHeight = Math.min(520, this.app.screen.height - 180);
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = 140;

    const container = new PIXI.Container();
    container.x = panelX;
    container.y = panelY;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x151530, 0.98);
    bg.lineStyle(3, 0xffd700, 0.6);
    bg.drawRoundedRect(0, 0, panelWidth, panelHeight, 16);
    bg.endFill();
    container.addChild(bg);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    const title = new PIXI.Text(`${chapter.mapIcon} ${chapter.title}`, titleStyle);
    title.anchor.set(0.5);
    title.x = panelWidth / 2;
    title.y = 35;
    container.addChild(title);

    const subtitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0xaaaaaa,
      align: 'center'
    });
    const subtitle = new PIXI.Text(chapter.subtitle, subtitleStyle);
    subtitle.anchor.set(0.5);
    subtitle.x = panelWidth / 2;
    subtitle.y = 65;
    container.addChild(subtitle);

    const descStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: 0xcccccc,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: panelWidth - 60
    });
    const description = new PIXI.Text(chapter.description, descStyle);
    description.anchor.set(0.5, 0);
    description.x = panelWidth / 2;
    description.y = 90;
    container.addChild(description);

    const levelsContainer = new PIXI.Container();
    levelsContainer.y = 170;
    container.addChild(levelsContainer);

    const levelsTitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0x6b9dff,
      stroke: 0x000000,
      strokeThickness: 1
    });
    const levelsTitle = new PIXI.Text('🎵 章节曲目', levelsTitleStyle);
    levelsTitle.x = 25;
    levelsContainer.addChild(levelsTitle);

    chapter.levels.forEach((level, index) => {
      const levelY = 35 + index * 50;
      const isCompleted = progress.levelsCompleted.includes(level.songId);
      const poemCollected = progress.collectedPoems.some(p => p.poemLine === level.poemReward);

      const levelBg = new PIXI.Graphics();
      levelBg.beginFill(isCompleted ? 0x1a3a2a : 0x1a2535, 0.8);
      levelBg.lineStyle(1, isCompleted ? 0x6bff9d : 0x333355, 0.6);
      levelBg.drawRoundedRect(20, levelY, panelWidth - 40, 44, 8);
      levelBg.endFill();
      levelsContainer.addChild(levelBg);

      const iconStyle = new PIXI.TextStyle({ fontFamily: 'sans-serif', fontSize: 18 });
      const levelIcon = new PIXI.Text(isCompleted ? '✓' : `${index + 1}`, iconStyle);
      levelIcon.anchor.set(0, 0.5);
      levelIcon.x = 32;
      levelIcon.y = levelY + 22;
      levelIcon.style.fill = isCompleted ? 0x6bff9d : 0x888888;
      levelsContainer.addChild(levelIcon);

      const songStyle = new PIXI.TextStyle({
        fontFamily: 'serif',
        fontSize: 15,
        fontWeight: 'bold',
        fill: isCompleted ? 0xffffff : 0xaaaaaa,
        stroke: 0x000000,
        strokeThickness: 1
      });
      const songName = this.getSongTitle(level.songId);
      const songText = new PIXI.Text(songName, songStyle);
      songText.anchor.set(0, 0.5);
      songText.x = 60;
      songText.y = levelY + 22;
      levelsContainer.addChild(songText);

      const poemStyle = new PIXI.TextStyle({
        fontFamily: 'serif',
        fontSize: 12,
        fill: poemCollected ? 0xffd700 : 0x666666,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'right'
      });
      const poemIcon = poemCollected ? '📜' : '🔒';
      const poemText = new PIXI.Text(`${poemIcon} ${level.poemReward}`, poemStyle);
      poemText.anchor.set(1, 0.5);
      poemText.x = panelWidth - 30;
      poemText.y = levelY + 22;
      levelsContainer.addChild(poemText);

      if (progress.isUnlocked) {
        levelBg.interactive = true;
        levelBg.cursor = 'pointer';
        levelBg.on('pointerdown', () => {
          if (this.onStartSongCallback) {
            this.onStartSongCallback(level.songId);
            this.hide();
          }
        });
      }
    });

    const endingsContainer = new PIXI.Container();
    endingsContainer.y = 170 + 35 + chapter.levels.length * 50 + 20;
    container.addChild(endingsContainer);

    const endingsTitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xff6b9d,
      stroke: 0x000000,
      strokeThickness: 1
    });
    const endingsTitle = new PIXI.Text('🎭 章节结局', endingsTitleStyle);
    endingsTitle.x = 25;
    endingsContainer.addChild(endingsTitle);

    const endingTypeIcons: Record<string, string> = {
      good: '🌟',
      normal: '✨',
      bad: '💫'
    };
    const endingColors: Record<string, number> = {
      good: 0xffd700,
      normal: 0x6b9dff,
      bad: 0x999999
    };

    chapter.endings.forEach((ending, index) => {
      const endingY = 35 + index * 36;
      const isAchieved = progress.currentEnding === ending.type || 
        (progress.currentEnding === 'good' && ending.type !== 'bad') ||
        (progress.currentEnding === 'normal' && ending.type === 'bad');

      const endingStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: isAchieved ? endingColors[ending.type] : 0x555555,
        stroke: 0x000000,
        strokeThickness: 1
      });

      const statusIcon = isAchieved ? endingTypeIcons[ending.type] : '🔒';
      const endingText = new PIXI.Text(
        `${statusIcon} ${ending.title}${isAchieved ? ` - ${ending.poemFragment}` : ' - ???'}`,
        endingStyle
      );
      endingText.x = 35;
      endingText.y = endingY;
      endingsContainer.addChild(endingText);
    });

    if (!progress.isUnlocked && chapter.prerequisiteCondition) {
      const lockHintStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fill: 0xff9999,
        align: 'center'
      });
      const prereqChapter = chapter.prerequisiteChapterId 
        ? this.storySystem.getChapterById(chapter.prerequisiteChapterId)
        : null;
      const hintText = `🔒 需要完成「${prereqChapter?.title ?? '前置章节'}」${chapter.prerequisiteCondition.minRating ? ` 评级≥${chapter.prerequisiteCondition.minRating}` : ''}${chapter.prerequisiteCondition.minAccuracy ? ` 准确率≥${chapter.prerequisiteCondition.minAccuracy}%` : ''}`;
      const lockHint = new PIXI.Text(hintText, lockHintStyle);
      lockHint.anchor.set(0.5);
      lockHint.x = panelWidth / 2;
      lockHint.y = panelHeight - 40;
      container.addChild(lockHint);
    } else if (progress.isUnlocked && !progress.levelsCompleted.includes(chapter.levels[0]?.songId || '')) {
      const startHintStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fill: 0xffd700,
        align: 'center'
      });
      const startHint = new PIXI.Text('💡 点击曲目即可开始演奏', startHintStyle);
      startHint.anchor.set(0.5);
      startHint.x = panelWidth / 2;
      startHint.y = panelHeight - 40;
      container.addChild(startHint);
    }

    this.detailPanel = {
      container,
      title,
      subtitle,
      description,
      levelsContainer,
      endingsContainer
    };

    this.container.addChild(container);

    container.alpha = 0;
    container.scale.set(0.9);
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / 300, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      container.alpha = eased;
      container.scale.set(0.9 + eased * 0.1);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  private getSongTitle(songId: string): string {
    const { SongLibrary } = require('./SongLibrary');
    const library = SongLibrary.getInstance();
    const entry = library.getSongEntry(songId);
    return entry?.chart.metadata.title ?? songId;
  }

  private updateNodeProgress(chapterId: string): void {
    const node = this.nodes.find(n => n.chapter.id === chapterId);
    if (!node) return;

    const progress = this.storySystem.getChapterProgress(chapterId);
    if (!progress) return;

    node.progress = progress;

    const bg = node.container.getChildByName('nodeBg') as PIXI.Graphics;
    if (bg) {
      const isUnlocked = progress.isUnlocked;
      const isCompleted = progress.completionCount > 0;
      bg.clear();
      if (isUnlocked) {
        bg.beginFill(isCompleted ? 0x1a3a2a : 0x1a2a3a, 0.95);
        bg.lineStyle(3, isCompleted ? 0x6bff9d : 0x6b9dff, 0.8);
      } else {
        bg.beginFill(0x222233, 0.8);
        bg.lineStyle(2, 0x666666, 0.5);
      }
      bg.drawRoundedRect(-this.NODE_SIZE / 2, -this.NODE_SIZE / 2, this.NODE_SIZE, this.NODE_SIZE, 16);
      bg.endFill();
    }

    node.icon.text = progress.isUnlocked ? node.chapter.mapIcon : '🔒';
    node.icon.alpha = progress.isUnlocked ? 1 : 0.5;
    node.title.style.fill = progress.isUnlocked ? 0xffffff : 0x888888;

    let statusText = '';
    let statusColor = 0x888888;
    if (!progress.isUnlocked) {
      statusText = '未解锁';
      statusColor = 0x888888;
    } else if (progress.completionCount > 0) {
      statusText = `✓ ${progress.currentEnding ? 
        node.chapter.endings.find(e => e.type === progress.currentEnding)?.title ?? '已完成' : 
        '已完成'}`;
      statusColor = 0x6bff9d;
    } else {
      const completed = progress.levelsCompleted.length;
      const total = node.chapter.levels.length;
      statusText = `${completed}/${total} 关`;
      statusColor = 0xffd700;
    }
    node.statusBadge.text = statusText;
    node.statusBadge.style.fill = statusColor;

    if (this.selectedChapterId === chapterId) {
      this.showChapterDetail(chapterId);
    }
  }

  private createCloseButton(): void {
    const btnBg = new PIXI.Graphics();
    btnBg.x = this.app.screen.width - 50;
    btnBg.y = 30;
    btnBg.beginFill(0x666677, 0.9);
    btnBg.lineStyle(2, 0x888899, 0.6);
    btnBg.drawRoundedRect(-25, -20, 50, 40, 10);
    btnBg.endFill();
    btnBg.interactive = true;
    btnBg.cursor = 'pointer';
    btnBg.on('pointerdown', () => {
      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
      this.hide();
    });

    const btnStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    const btnText = new PIXI.Text('✕', btnStyle);
    btnText.anchor.set(0.5);
    btnBg.addChild(btnText);

    this.container.addChild(btnBg);
  }

  private animateIn(): void {
    this.container.alpha = 0;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / 400, 1);
      this.container.alpha = progress;
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  private animateOut(onComplete: () => void): void {
    const startTime = Date.now();
    const startAlpha = this.container.alpha;
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / 300, 1);
      this.container.alpha = startAlpha * (1 - progress);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };
    animate();
  }

  public setOnCloseCallback(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  public setOnStartSongCallback(callback: (songId: string) => void): void {
    this.onStartSongCallback = callback;
  }

  public destroy(): void {
    if (this.removeStoryListener) {
      this.removeStoryListener();
    }
    this.container.destroy();
  }
}
