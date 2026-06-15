import * as PIXI from 'pixi.js';
import {
  CollectedPoem,
  StoryStateChangeEvent
} from '../types';
import { StoryChapterSystem } from './StoryChapterSystem';

export class PoemCollectionView {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private storySystem: StoryChapterSystem;
  private onCloseCallback?: () => void;
  private removeStoryListener?: () => void;
  private poemCards: PIXI.Container[] = [];
  private contentContainer: PIXI.Container | null = null;
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private dragStartScroll: number = 0;

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
    this.poemCards = [];
    this.createBackground();
    this.createHeader();
    this.createPoemList();
    this.createCloseButton();
    this.setupStoryListener();
    this.setupScroll();
    this.animateIn();
  }

  public hide(): void {
    this.animateOut(() => {
      this.container.visible = false;
      this.container.removeChildren();
      this.poemCards = [];
      this.contentContainer = null;
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
      if (event.type === 'poem_collected') {
        this.refreshPoemList();
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
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * this.app.screen.width;
      const y = Math.random() * this.app.screen.height;
      const size = Math.random() * 1.5 + 0.5;
      gradientBg.beginFill(0xffd700, 0.2 + Math.random() * 0.3);
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

    const title = new PIXI.Text('📜 诗句收集', titleStyle);
    title.anchor.set(0.5);
    headerContainer.addChild(title);

    const state = this.storySystem.getState();
    const allPoems = this.getAllPoems();
    const collectedCount = state.totalCollectedPoems;
    const totalCount = allPoems.length;
    const percentage = totalCount > 0 ? (collectedCount / totalCount * 100).toFixed(0) : '0';

    const subtitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0xaaaaaa,
      align: 'center'
    });
    const subtitle = new PIXI.Text(
      `已收集 ${collectedCount}/${totalCount} 句  (${percentage}%)`,
      subtitleStyle
    );
    subtitle.anchor.set(0.5);
    subtitle.y = 30;
    headerContainer.addChild(subtitle);

    const progressBg = new PIXI.Graphics();
    progressBg.beginFill(0x333344, 0.8);
    progressBg.drawRoundedRect(-150, 48, 300, 8, 4);
    progressBg.endFill();
    headerContainer.addChild(progressBg);

    const progressWidth = totalCount > 0 ? 300 * (collectedCount / totalCount) : 0;
    if (progressWidth > 0) {
      const progressBar = new PIXI.Graphics();
      progressBar.beginFill(0xffd700, 0.9);
      progressBar.drawRoundedRect(-150, 48, progressWidth, 8, 4);
      progressBar.endFill();
      headerContainer.addChild(progressBar);
    }

    this.container.addChild(headerContainer);
  }

  private getAllPoems(): Array<{ poemLine: string; chapterId: string; songId: string; collected: boolean; chapterTitle: string }> {
    const chapters = this.storySystem.getChapters();
    const poems: Array<{ poemLine: string; chapterId: string; songId: string; collected: boolean; chapterTitle: string }> = [];

    for (const chapter of chapters) {
      const progress = this.storySystem.getChapterProgress(chapter.id);
      for (const level of chapter.levels) {
        const collected = progress?.collectedPoems.some(p => p.poemLine === level.poemReward) ?? false;
        poems.push({
          poemLine: level.poemReward,
          chapterId: chapter.id,
          songId: level.songId,
          collected,
          chapterTitle: chapter.title
        });
      }
    }

    return poems;
  }

  private createPoemList(): void {
    const scrollMask = new PIXI.Graphics();
    const maskTop = 90;
    const maskHeight = this.app.screen.height - maskTop - 60;
    scrollMask.beginFill(0x000000, 1);
    scrollMask.drawRect(20, maskTop, this.app.screen.width - 40, maskHeight);
    scrollMask.endFill();
    this.container.addChild(scrollMask);

    this.contentContainer = new PIXI.Container();
    this.contentContainer.x = 20;
    this.contentContainer.y = maskTop;
    this.contentContainer.mask = scrollMask;
    this.container.addChild(this.contentContainer);

    const allPoems = this.getAllPoems();
    const collectedPoems = this.storySystem.getAllCollectedPoems();

    const cardWidth = Math.min(340, (this.app.screen.width - 60) / 2);
    const cardHeight = 100;
    const cardsPerRow = Math.floor((this.app.screen.width - 40) / (cardWidth + 10));
    const hSpacing = (this.app.screen.width - 40 - cardsPerRow * cardWidth) / (cardsPerRow - 1 || 1);

    allPoems.forEach((poemInfo, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      const x = col * (cardWidth + hSpacing);
      const y = row * (cardHeight + 12);

      const card = this.createPoemCard(poemInfo, collectedPoems.find(p => p.poemLine === poemInfo.poemLine), cardWidth, cardHeight);
      card.x = x;
      card.y = y;
      this.contentContainer!.addChild(card);
      this.poemCards.push(card);
    });

    const totalHeight = Math.ceil(allPoems.length / cardsPerRow) * (cardHeight + 12);
    this.maxScrollY = Math.max(0, totalHeight - maskHeight + 20);
    this.scrollY = 0;
  }

  private createPoemCard(
    poemInfo: { poemLine: string; chapterId: string; songId: string; collected: boolean; chapterTitle: string },
    collectedData: CollectedPoem | undefined,
    width: number,
    height: number
  ): PIXI.Container {
    const container = new PIXI.Container();

    const bg = new PIXI.Graphics();
    if (poemInfo.collected) {
      bg.beginFill(0x1a2a1a, 0.95);
      bg.lineStyle(2, 0xffd700, 0.7);
    } else {
      bg.beginFill(0x1a1a2a, 0.6);
      bg.lineStyle(1, 0x444455, 0.4);
    }
    bg.drawRoundedRect(0, 0, width, height, 12);
    bg.endFill();
    container.addChild(bg);

    const iconStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 24,
      align: 'center'
    });
    const icon = new PIXI.Text(poemInfo.collected ? '📜' : '🔒', iconStyle);
    icon.x = 15;
    icon.y = 12;
    container.addChild(icon);

    const poemStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: poemInfo.collected ? 0xffd700 : 0x555555,
      stroke: 0x000000,
      strokeThickness: 1,
      wordWrap: true,
      wordWrapWidth: width - 70,
      align: 'left'
    });

    const displayText = poemInfo.collected ? poemInfo.poemLine : '??? ??? ???';
    const poemText = new PIXI.Text(displayText, poemStyle);
    poemText.x = 50;
    poemText.y = 14;
    container.addChild(poemText);

    if (poemInfo.collected && collectedData) {
      const metaStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 11,
        fill: 0x88ccaa,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'left'
      });
      const date = new Date(collectedData.collectedAt);
      const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
      const metaText = new PIXI.Text(
        `《${poemInfo.chapterTitle}》 · ${collectedData.rating} · ${collectedData.accuracy.toFixed(1)}% · ${dateStr}`,
        metaStyle
      );
      metaText.x = 50;
      metaText.y = height - 22;
      container.addChild(metaText);
    } else {
      const hintStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 11,
        fill: 0x666666,
        align: 'left'
      });
      const hintText = new PIXI.Text(
        `《${poemInfo.chapterTitle}》· 完成对应曲目即可解锁`,
        hintStyle
      );
      hintText.x = 50;
      hintText.y = height - 22;
      container.addChild(hintText);
    }

    if (poemInfo.collected) {
      const sparkleCount = 3;
      for (let i = 0; i < sparkleCount; i++) {
        const sparkle = new PIXI.Graphics();
        sparkle.beginFill(0xffd700, 0.6);
        sparkle.drawCircle(0, 0, 2);
        sparkle.endFill();
        sparkle.x = width - 20 - i * 15;
        sparkle.y = 15 + Math.sin(i) * 10;
        sparkle.alpha = 0.5 + Math.random() * 0.5;
        container.addChild(sparkle);
      }
    }

    return container;
  }

  private refreshPoemList(): void {
    if (this.contentContainer) {
      this.contentContainer.removeChildren();
      this.poemCards = [];
    }
    this.createPoemList();
  }

  private setupScroll(): void {
    const scrollArea = new PIXI.Graphics();
    scrollArea.beginFill(0x000000, 0.001);
    scrollArea.drawRect(0, 90, this.app.screen.width, this.app.screen.height - 150);
    scrollArea.endFill();
    scrollArea.interactive = true;
    this.container.addChild(scrollArea);

    scrollArea.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this.isDragging = true;
      this.dragStartY = e.global.y;
      this.dragStartScroll = this.scrollY;
    });

    scrollArea.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!this.isDragging || !this.contentContainer) return;
      const deltaY = e.global.y - this.dragStartY;
      this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.dragStartScroll - deltaY));
      this.contentContainer.y = 90 - this.scrollY;
    });

    scrollArea.on('pointerup', () => {
      this.isDragging = false;
    });

    scrollArea.on('pointerupoutside', () => {
      this.isDragging = false;
    });

    this.app.stage.on('wheel', (e: WheelEvent) => {
      if (!this.container.visible || !this.contentContainer) return;
      e.preventDefault();
      this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + e.deltaY * 0.5));
      this.contentContainer.y = 90 - this.scrollY;
    });
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
