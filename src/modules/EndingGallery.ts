import * as PIXI from 'pixi.js';
import {
  ChapterEnding,
  EndingType,
  StoryStateChangeEvent
} from '../types';
import { StoryChapterSystem } from './StoryChapterSystem';

interface EndingCard {
  chapterId: string;
  ending: ChapterEnding;
  isUnlocked: boolean;
  container: PIXI.Container;
}

export class EndingGallery {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private storySystem: StoryChapterSystem;
  private onCloseCallback?: () => void;
  private removeStoryListener?: () => void;
  private cards: EndingCard[] = [];
  private selectedEnding: EndingCard | null = null;
  private detailPanel: PIXI.Container | null = null;

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
    this.cards = [];
    this.selectedEnding = null;
    this.detailPanel = null;
    this.createBackground();
    this.createHeader();
    this.createEndingGrid();
    this.createCloseButton();
    this.setupStoryListener();
    this.animateIn();
  }

  public hide(): void {
    this.animateOut(() => {
      this.container.visible = false;
      this.container.removeChildren();
      this.cards = [];
      this.selectedEnding = null;
      this.detailPanel = null;
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
      if (event.type === 'ending_reached' || event.type === 'chapter_completed') {
        this.refreshEndingGrid();
      }
    });
  }

  private createBackground(): void {
    const mask = new PIXI.Graphics();
    mask.beginFill(0x0a0a1a, 0.95);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    this.container.addChild(mask);

    const gradientBg = new PIXI.Graphics();
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * this.app.screen.width;
      const y = Math.random() * this.app.screen.height;
      const size = Math.random() * 2 + 0.5;
      gradientBg.beginFill(0xff6b9d, 0.15 + Math.random() * 0.25);
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
      fill: 0xff6b9d,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center'
    });

    const title = new PIXI.Text('🎭 结局画廊', titleStyle);
    title.anchor.set(0.5);
    headerContainer.addChild(title);

    const allEndings = this.getAllEndings();
    const unlockedCount = allEndings.filter(e => e.isUnlocked).length;
    const totalCount = allEndings.length;
    const percentage = totalCount > 0 ? (unlockedCount / totalCount * 100).toFixed(0) : '0';

    const subtitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0xaaaaaa,
      align: 'center'
    });
    const subtitle = new PIXI.Text(
      `已解锁 ${unlockedCount}/${totalCount} 个结局  (${percentage}%)`,
      subtitleStyle
    );
    subtitle.anchor.set(0.5);
    subtitle.y = 30;
    headerContainer.addChild(subtitle);

    const hintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x666666,
      align: 'center',
      fontStyle: 'italic'
    });
    const hint = new PIXI.Text(
      '每个章节根据平均评级与准确率解锁不同结局',
      hintStyle
    );
    hint.anchor.set(0.5);
    hint.y = 52;
    headerContainer.addChild(hint);

    this.container.addChild(headerContainer);
  }

  private getAllEndings(): Array<{ chapterId: string; chapterTitle: string; ending: ChapterEnding; isUnlocked: boolean }> {
    const chapters = this.storySystem.getChapters();
    const endings: Array<{ chapterId: string; chapterTitle: string; ending: ChapterEnding; isUnlocked: boolean }> = [];

    for (const chapter of chapters) {
      const progress = this.storySystem.getChapterProgress(chapter.id);
      const currentEnding = progress?.currentEnding;
      
      for (const ending of chapter.endings) {
        let isUnlocked = false;
        if (currentEnding) {
          const endingRank = this.getEndingRank(ending.type);
          const currentRank = this.getEndingRank(currentEnding);
          isUnlocked = currentRank >= endingRank;
        }
        endings.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          ending,
          isUnlocked
        });
      }
    }

    return endings;
  }

  private getEndingRank(type: EndingType): number {
    switch (type) {
      case 'good': return 3;
      case 'normal': return 2;
      case 'bad': return 1;
      default: return 0;
    }
  }

  private getEndingIcon(type: EndingType): string {
    switch (type) {
      case 'good': return '🌟';
      case 'normal': return '✨';
      case 'bad': return '💫';
      default: return '🔒';
    }
  }

  private getEndingColor(type: EndingType): number {
    switch (type) {
      case 'good': return 0xffd700;
      case 'normal': return 0x6b9dff;
      case 'bad': return 0x888888;
      default: return 0x666666;
    }
  }

  private createEndingGrid(): void {
    const allEndings = this.getAllEndings();
    
    const cardWidth = Math.min(220, (this.app.screen.width - 80) / 3);
    const cardHeight = 130;
    const cardsPerRow = Math.floor((this.app.screen.width - 40) / (cardWidth + 15));
    const hSpacing = (this.app.screen.width - 40 - cardsPerRow * cardWidth) / (cardsPerRow - 1 || 1);
    const gridStartY = 120;

    allEndings.forEach((endingInfo, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      const x = 20 + col * (cardWidth + hSpacing);
      const y = gridStartY + row * (cardHeight + 15);

      const card = this.createEndingCard(endingInfo, cardWidth, cardHeight);
      card.container.x = x;
      card.container.y = y;
      this.cards.push(card);
      this.container.addChild(card.container);
    });
  }

  private createEndingCard(
    endingInfo: { chapterId: string; chapterTitle: string; ending: ChapterEnding; isUnlocked: boolean },
    width: number,
    height: number
  ): EndingCard {
    const container = new PIXI.Container();

    const bg = new PIXI.Graphics();
    if (endingInfo.isUnlocked) {
      bg.beginFill(0x1a2030, 0.95);
      bg.lineStyle(2, this.getEndingColor(endingInfo.ending.type), 0.7);
    } else {
      bg.beginFill(0x151520, 0.6);
      bg.lineStyle(1, 0x444455, 0.4);
    }
    bg.drawRoundedRect(0, 0, width, height, 12);
    bg.endFill();
    bg.interactive = true;
    bg.cursor = endingInfo.isUnlocked ? 'pointer' : 'default';
    bg.name = 'cardBg';
    container.addChild(bg);

    const iconStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 28,
      align: 'center'
    });
    const icon = new PIXI.Text(
      endingInfo.isUnlocked ? this.getEndingIcon(endingInfo.ending.type) : '🔒',
      iconStyle
    );
    icon.x = 12;
    icon.y = 12;
    icon.alpha = endingInfo.isUnlocked ? 1 : 0.5;
    container.addChild(icon);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: endingInfo.isUnlocked ? this.getEndingColor(endingInfo.ending.type) : 0x555555,
      stroke: 0x000000,
      strokeThickness: 1,
      wordWrap: true,
      wordWrapWidth: width - 55
    });
    const displayTitle = endingInfo.isUnlocked ? endingInfo.ending.title : '??? 结局';
    const titleText = new PIXI.Text(displayTitle, titleStyle);
    titleText.x = 50;
    titleText.y = 12;
    container.addChild(titleText);

    const chapterStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 11,
      fill: 0x888899,
      align: 'left'
    });
    const chapterText = new PIXI.Text(`《${endingInfo.chapterTitle}》`, chapterStyle);
    chapterText.x = 50;
    chapterText.y = 40;
    container.addChild(chapterText);

    if (endingInfo.isUnlocked) {
      const poemStyle = new PIXI.TextStyle({
        fontFamily: 'serif',
        fontSize: 12,
        fill: 0xffd700,
        stroke: 0x000000,
        strokeThickness: 1,
        wordWrap: true,
        wordWrapWidth: width - 25,
        align: 'center'
      });
      const poemText = new PIXI.Text(`「${endingInfo.ending.poemFragment}」`, poemStyle);
      poemText.anchor.set(0.5, 0);
      poemText.x = width / 2;
      poemText.y = 62;
      container.addChild(poemText);
    } else {
      const lockStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 11,
        fill: 0x666666,
        align: 'left',
        wordWrap: true,
        wordWrapWidth: width - 25
      });
      const lockText = new PIXI.Text(
        `解锁条件：评级≥${endingInfo.ending.minAverageRating} 准确率≥${endingInfo.ending.minAverageAccuracy}%`,
        lockStyle
      );
      lockText.x = 12;
      lockText.y = 65;
      container.addChild(lockText);
    }

    if (endingInfo.isUnlocked) {
      bg.on('pointerdown', () => {
        this.selectEnding({ chapterId: endingInfo.chapterId, ending: endingInfo.ending, isUnlocked: true, container });
      });
    }

    return {
      chapterId: endingInfo.chapterId,
      ending: endingInfo.ending,
      isUnlocked: endingInfo.isUnlocked,
      container
    };
  }

  private selectEnding(card: EndingCard): void {
    if (this.selectedEnding === card) return;
    
    for (const c of this.cards) {
      const bg = c.container.getChildByName('cardBg') as PIXI.Graphics;
      if (bg) {
        const isSelected = c === card;
        const color = isSelected ? 0xff6b9d : 
          c.isUnlocked ? this.getEndingColor(c.ending.type) : 0x444455;
        bg.lineStyle(isSelected ? 3 : 2, color, isSelected ? 1 : 0.7);
      }
    }
    
    this.selectedEnding = card;
    this.showEndingDetail(card);
  }

  private showEndingDetail(card: EndingCard): void {
    if (this.detailPanel) {
      this.container.removeChild(this.detailPanel);
      this.detailPanel.destroy();
      this.detailPanel = null;
    }

    const panelWidth = Math.min(480, this.app.screen.width - 40);
    const panelHeight = 280;
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = this.app.screen.height - panelHeight - 30;

    const container = new PIXI.Container();
    container.x = panelX;
    container.y = panelY;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x151530, 0.98);
    bg.lineStyle(3, this.getEndingColor(card.ending.type), 0.8);
    bg.drawRoundedRect(0, 0, panelWidth, panelHeight, 16);
    bg.endFill();
    container.addChild(bg);

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: this.getEndingColor(card.ending.type),
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    const headerText = new PIXI.Text(
      `${this.getEndingIcon(card.ending.type)} ${card.ending.title}`,
      headerStyle
    );
    headerText.anchor.set(0.5);
    headerText.x = panelWidth / 2;
    headerText.y = 35;
    container.addChild(headerText);

    const poemStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 20,
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: panelWidth - 60
    });
    const poemText = new PIXI.Text(`「${card.ending.poemFragment}」`, poemStyle);
    poemText.anchor.set(0.5);
    poemText.x = panelWidth / 2;
    poemText.y = 75;
    container.addChild(poemText);

    const descStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: 0xcccccc,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: panelWidth - 60,
      lineHeight: 18
    });
    const descText = new PIXI.Text(card.ending.description, descStyle);
    descText.anchor.set(0.5, 0);
    descText.x = panelWidth / 2;
    descText.y = 120;
    container.addChild(descText);

    const conditionStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'center'
    });
    const conditionText = new PIXI.Text(
      `解锁条件：平均评级≥${card.ending.minAverageRating} · 平均准确率≥${card.ending.minAverageAccuracy}%`,
      conditionStyle
    );
    conditionText.anchor.set(0.5);
    conditionText.x = panelWidth / 2;
    conditionText.y = panelHeight - 30;
    container.addChild(conditionText);

    this.detailPanel = container;
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

  private refreshEndingGrid(): void {
    this.container.removeChildren();
    this.cards = [];
    this.selectedEnding = null;
    this.detailPanel = null;
    this.createBackground();
    this.createHeader();
    this.createEndingGrid();
    this.createCloseButton();
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

  public destroy(): void {
    if (this.removeStoryListener) {
      this.removeStoryListener();
    }
    this.container.destroy();
  }
}
