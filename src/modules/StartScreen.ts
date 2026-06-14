import * as PIXI from 'pixi.js';
import {
  Difficulty,
  LANE_COUNT,
  PracticeConfig,
  DEFAULT_PRACTICE_CONFIG,
  SongLibraryEntry,
  SongLibraryFilterType,
  SongLibrarySortType,
  CoverArt,
  DEFAULT_COVER_ART_SIZE,
  SongChartEntry,
  ChartDifficultyConfig
} from '../types';
import { ScoreStorage } from './ScoreStorage';
import { InputConfigManager } from './InputConfigManager';
import { ChapterUnlockManager } from './ChapterUnlockManager';
import { SongLibrary } from './SongLibrary';
import { CoverArtManager } from './CoverArtManager';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难'
};

export class StartScreen {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private onStartCallback?: (songId: string, difficulty: Difficulty, practiceConfig: PracticeConfig) => void;
  private onPreloadCallback?: (songId: string, difficulty: Difficulty) => void;

  private songLibrary: SongLibrary;
  private coverArtManager: CoverArtManager;
  private libraryEntries: SongLibraryEntry[] = [];
  private selectedSongIndex: number = 0;
  private selectedDifficulty: Difficulty = 'normal';
  private preloadDebounceTimer?: number;
  
  private practiceConfig: PracticeConfig = { ...DEFAULT_PRACTICE_CONFIG };
  
  private practicePanel: PIXI.Container;
  private practicePanelVisible: boolean = false;
  private practiceStatusText?: PIXI.Text;

  private songInfoContainer: PIXI.Container;
  private difficultyButtons: PIXI.Graphics[] = [];

  private prevSongBtn?: PIXI.Graphics;
  private nextSongBtn?: PIXI.Graphics;

  private leaderboardPanel: PIXI.Container;
  private leaderboardVisible: boolean = false;
  private leaderboardContent: PIXI.Container;

  private settingsPanel: PIXI.Container;
  private settingsVisible: boolean = false;
  private settingsContent: PIXI.Container;
  private settingsTab: 'keys' | 'gestures' | 'advanced' = 'keys';
  private keyBindingButtons: PIXI.Graphics[] = [];
  private capturingLane: number | null = null;
  private captureHint?: PIXI.Text;
  private statusMessage?: PIXI.Text;
  private previewLaneHints: PIXI.Text[] = [];

  private inputConfigManager: InputConfigManager;

  private currentFilterType: SongLibraryFilterType = 'all';
  private currentSortType: SongLibrarySortType = 'default';
  private filterPanel: PIXI.Container;
  private filterPanelVisible: boolean = false;
  private coverArtContainer: PIXI.Container;
  private loadedCoverTextures: Map<string, PIXI.Texture> = new Map();
  private removeLibraryListener?: () => void;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.songInfoContainer = new PIXI.Container();
    this.leaderboardPanel = new PIXI.Container();
    this.leaderboardContent = new PIXI.Container();
    this.settingsPanel = new PIXI.Container();
    this.settingsContent = new PIXI.Container();
    this.practicePanel = new PIXI.Container();
    this.filterPanel = new PIXI.Container();
    this.coverArtContainer = new PIXI.Container();
    this.inputConfigManager = InputConfigManager.getInstance();
    this.songLibrary = SongLibrary.getInstance();
    this.coverArtManager = CoverArtManager.getInstance();
    this.app.stage.addChild(this.container);
    this.initializeLibrary();
    this.createScreen();
    this.setupLibraryListener();
  }

  private createScreen(): void {
    this.createBackground();
    this.createTitle();
    this.createSongNavigation();
    this.createCoverArtDisplay();
    this.createSongInfo();
    this.createDifficultySelector();
    this.createStartButton();
    this.createControlsHint();
    this.createLeaderboardToggle();
    this.createLeaderboardPanel();
    this.createSettingsToggle();
    this.createSettingsPanel();
    this.createPracticeToggle();
    this.createPracticePanel();
    this.createFilterToggle();
    this.createFilterPanel();
    this.setupConfigChangeListener();
    this.setupKeyCaptureListener();
  }

  private initializeLibrary(): void {
    this.refreshLibraryEntries();
  }

  private refreshLibraryEntries(): void {
    this.libraryEntries = this.songLibrary.filterAndSort(
      { type: this.currentFilterType },
      { type: this.currentSortType, ascending: true }
    );
    if (this.selectedSongIndex >= this.libraryEntries.length) {
      this.selectedSongIndex = Math.max(0, this.libraryEntries.length - 1);
    }
  }

  private getCurrentEntry(): SongLibraryEntry | undefined {
    return this.libraryEntries[this.selectedSongIndex];
  }

  private getCurrentChart(): SongChartEntry | undefined {
    return this.getCurrentEntry()?.chart;
  }

  private getCurrentDifficultyConfig(): ChartDifficultyConfig | undefined {
    const chart = this.getCurrentChart();
    if (!chart) return undefined;
    return chart.difficultyConfigs[this.selectedDifficulty];
  }

  private setupLibraryListener(): void {
    this.removeLibraryListener = this.songLibrary.addChangeListener(() => {
      this.refreshLibraryEntries();
      this.updateSongInfo();
      this.updateStartButtonState();
    });
  }

  private createCoverArtDisplay(): void {
    this.coverArtContainer.x = this.app.screen.width / 2;
    this.coverArtContainer.y = 140;
    this.container.addChild(this.coverArtContainer);
    this.updateCoverArtDisplay();
  }

  private updateCoverArtDisplay(): void {
    this.coverArtContainer.removeChildren();

    const entry = this.getCurrentEntry();
    if (!entry) return;

    const coverArt = entry.chart.metadata.coverArt;
    const coverWidth = Math.min(400, this.app.screen.width - 80);
    const coverHeight = (coverWidth / DEFAULT_COVER_ART_SIZE.width) * DEFAULT_COVER_ART_SIZE.height;

    if (coverArt) {
      this.renderCoverArt(coverArt, coverWidth, coverHeight);
    } else {
      this.renderPlaceholderCover(coverWidth, coverHeight, entry.chart.metadata.title);
    }
  }

  private async renderCoverArt(coverArt: CoverArt, width: number, height: number): Promise<void> {
    try {
      const dataURL = this.coverArtManager.getDataURL(coverArt);
      const cacheKey = `${coverArt.id}_${width}_${height}`;

      let texture = this.loadedCoverTextures.get(cacheKey);
      if (!texture) {
        texture = await PIXI.Texture.from(dataURL);
        this.loadedCoverTextures.set(cacheKey, texture);
      }

      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0);
      sprite.width = width;
      sprite.height = height;
      this.coverArtContainer.addChild(sprite);

      const colors = this.coverArtManager.getCoverColors(coverArt);
      const border = new PIXI.Graphics();
      border.lineStyle(3, parseInt(colors.accent.replace('#', ''), 16), 0.6);
      border.drawRoundedRect(-width / 2, 0, width, height, 16);
      border.endFill();
      this.coverArtContainer.addChild(border);
    } catch (e) {
      console.warn('Failed to render cover art, falling back to placeholder:', e);
      const entry = this.getCurrentEntry();
      this.renderPlaceholderCover(width, height, entry?.chart.metadata.title || '');
    }
  }

  private renderPlaceholderCover(width: number, height: number, title: string): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a1a3a);
    bg.drawRoundedRect(-width / 2, 0, width, height, 16);
    bg.endFill();

    const textStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x8b4513,
      strokeThickness: 2,
      align: 'center'
    });

    const text = new PIXI.Text(title, textStyle);
    text.anchor.set(0.5);
    text.y = height / 2;
    bg.addChild(text);

    this.coverArtContainer.addChild(bg);
  }

  private createFilterToggle(): void {
    const btnContainer = new PIXI.Graphics() as PIXI.Graphics & { labelText?: PIXI.Text };
    btnContainer.x = this.app.screen.width - 70;
    btnContainer.y = 170;

    btnContainer.beginFill(0xf39c12, 0.85);
    btnContainer.lineStyle(2, 0xffd700, 0.6);
    btnContainer.drawRoundedRect(-40, -20, 80, 40, 10);
    btnContainer.endFill();

    const btnStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const text = new PIXI.Text('🔍 筛选', btnStyle);
    text.anchor.set(0.5);
    btnContainer.addChild(text);

    btnContainer.interactive = true;
    btnContainer.cursor = 'pointer';
    btnContainer.on('pointerdown', () => this.toggleFilterPanel());

    this.container.addChild(btnContainer);
  }

  private createFilterPanel(): void {
    this.filterPanel.x = 0;
    this.filterPanel.y = 0;
    this.filterPanel.visible = false;

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.85);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    mask.interactive = true;
    this.filterPanel.addChild(mask);

    const panelWidth = Math.min(520, this.app.screen.width - 40);
    const panelHeight = 520;
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = (this.app.screen.height - panelHeight) / 2;

    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0x151530, 0.98);
    panelBg.lineStyle(3, 0xf39c12, 0.8);
    panelBg.drawRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
    panelBg.endFill();
    this.filterPanel.addChild(panelBg);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0xffd700,
      align: 'center'
    });

    const title = new PIXI.Text('🔍 曲库筛选与排序', titleStyle);
    title.anchor.set(0.5);
    title.x = this.app.screen.width / 2;
    title.y = panelY + 30;
    this.filterPanel.addChild(title);

    const closeBtn = new PIXI.Graphics();
    closeBtn.x = panelX + panelWidth - 40;
    closeBtn.y = panelY + 30;
    closeBtn.beginFill(0xff6b6b, 0.9);
    closeBtn.drawRoundedRect(-18, -18, 36, 36, 8);
    closeBtn.endFill();
    closeBtn.interactive = true;
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.toggleFilterPanel());

    const closeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    const closeText = new PIXI.Text('✕', closeStyle);
    closeText.anchor.set(0.5);
    closeBtn.addChild(closeText);
    this.filterPanel.addChild(closeBtn);

    const contentX = panelX + 30;
    const contentWidth = panelWidth - 60;
    let contentY = panelY + 70;

    contentY = this.createFilterSection(contentX, contentY, contentWidth, '筛选方式', [
      { key: 'all' as const, label: '全部曲目' },
      { key: 'unlocked' as const, label: '已解锁' },
      { key: 'locked' as const, label: '未解锁' },
      { key: 'favorites' as const, label: '收藏' },
      { key: 'unplayed' as const, label: '未游玩' }
    ], this.currentFilterType, (type) => {
      this.currentFilterType = type;
      this.refreshLibraryEntries();
      this.selectedSongIndex = Math.min(this.selectedSongIndex, Math.max(0, this.libraryEntries.length - 1));
      this.updateSongInfo();
      this.updateCoverArtDisplay();
      this.updateStartButtonState();
      this.updateFilterPanelContent();
    });

    contentY = this.createFilterSection(contentX, contentY + 20, contentWidth, '排序方式', [
      { key: 'default' as const, label: '默认顺序' },
      { key: 'title' as const, label: '曲名' },
      { key: 'artist' as const, label: '艺术家' },
      { key: 'bpm' as const, label: 'BPM' },
      { key: 'difficulty' as const, label: '难度' },
      { key: 'score' as const, label: '最高分' },
      { key: 'recent' as const, label: '最近游玩' }
    ], this.currentSortType, (type) => {
      this.currentSortType = type;
      this.refreshLibraryEntries();
      this.selectedSongIndex = 0;
      this.updateSongInfo();
      this.updateCoverArtDisplay();
      this.updateStartButtonState();
      this.updateFilterPanelContent();
    });

    this.updateFilterStats(panelX, panelWidth, panelY, panelHeight);

    this.container.addChild(this.filterPanel);
  }

  private createFilterSection<T extends string>(
    x: number,
    y: number,
    width: number,
    label: string,
    options: Array<{ key: T; label: string }>,
    currentValue: T,
    onChange: (value: T) => void
  ): number {
    const sectionTitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 15,
      fontWeight: 'bold',
      fill: 0xffd700,
      align: 'left'
    });

    const sectionTitle = new PIXI.Text(label, sectionTitleStyle);
    sectionTitle.anchor.set(0, 0);
    sectionTitle.x = x;
    sectionTitle.y = y;
    this.filterPanel.addChild(sectionTitle);

    const btnHeight = 36;
    const btnPadding = 8;
    const columns = options.length <= 4 ? options.length : Math.ceil(options.length / 2);
    const btnWidth = (width - (columns - 1) * btnPadding) / columns;
    const rows = Math.ceil(options.length / columns);

    options.forEach((opt, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const btnX = x + col * (btnWidth + btnPadding);
      const btnY = y + 30 + row * (btnHeight + btnPadding);

      const btn = new PIXI.Graphics();
      const isSelected = currentValue === opt.key;

      if (isSelected) {
        btn.lineStyle(2, 0xffd700, 1);
        btn.beginFill(0xf39c12, 1);
      } else {
        btn.lineStyle(1, 0x666688, 0.6);
        btn.beginFill(0x2a2a4a, 0.8);
      }
      btn.drawRoundedRect(btnX, btnY, btnWidth, btnHeight, 8);
      btn.endFill();

      const btnStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: isSelected ? 0x000000 : 0xcccccc,
        align: 'center'
      });

      const btnText = new PIXI.Text(opt.label, btnStyle);
      btnText.anchor.set(0.5);
      btnText.x = btnX + btnWidth / 2;
      btnText.y = btnY + btnHeight / 2;
      this.filterPanel.addChild(btnText);

      btn.interactive = true;
      btn.cursor = 'pointer';
      btn.on('pointerdown', () => onChange(opt.key));

      this.filterPanel.addChild(btn);
    });

    return y + 30 + rows * (btnHeight + btnPadding);
  }

  private updateFilterPanelContent(): void {
    const children = this.filterPanel.children.slice();
    children.forEach(c => this.filterPanel.removeChild(c));
    this.createFilterPanel();
  }

  private updateFilterStats(panelX: number, panelWidth: number, panelY: number, panelHeight: number): void {
    const total = this.songLibrary.getSongCount();
    const filtered = this.libraryEntries.length;
    const active = this.songLibrary.getActiveSongCount();

    const statsStyle = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0x888888,
      align: 'center'
    });

    const stats = new PIXI.Text(
      `共 ${total} 首曲目 | 激活: ${active} | 当前筛选: ${filtered} 首`,
      statsStyle
    );
    stats.anchor.set(0.5);
    stats.x = panelX + panelWidth / 2;
    stats.y = panelY + panelHeight - 30;
    this.filterPanel.addChild(stats);
  }

  private toggleFilterPanel(): void {
    this.filterPanelVisible = !this.filterPanelVisible;
    this.filterPanel.visible = this.filterPanelVisible;
    if (this.filterPanelVisible) {
      this.refreshLibraryEntries();
    }
  }

  private createBackground(): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0a0a1a);
    bg.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    bg.endFill();
    this.container.addChild(bg);

    for (let i = 0; i < 30; i++) {
      const star = new PIXI.Graphics();
      const x = Math.random() * this.app.screen.width;
      const y = Math.random() * this.app.screen.height;
      const size = Math.random() * 2 + 1;
      star.beginFill(0xffffff, Math.random() * 0.5 + 0.3);
      star.drawCircle(x, y, size);
      star.endFill();
      this.container.addChild(star);
    }
  }

  private createTitle(): void {
    const titleContainer = new PIXI.Container();
    titleContainer.x = this.app.screen.width / 2;
    titleContainer.y = 50;

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 36,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 10,
      align: 'center'
    });

    const title = new PIXI.Text('浮岛书屋', titleStyle);
    title.anchor.set(0.5);
    titleContainer.addChild(title);

    const subtitleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 18,
      fill: 0xaaaaaa,
      stroke: 0x000000,
      strokeThickness: 1,
      align: 'center'
    });

    const subtitle = new PIXI.Text('~ 古韵诗章节奏游戏 ~', subtitleStyle);
    subtitle.anchor.set(0.5);
    subtitle.y = 40;
    titleContainer.addChild(subtitle);

    this.container.addChild(titleContainer);
  }

  private createSongNavigation(): void {
    const navY = 260;

    this.prevSongBtn = this.createArrowButton('◀', 50, navY);
    this.prevSongBtn.on('pointerdown', () => this.prevSong());
    this.container.addChild(this.prevSongBtn);

    this.nextSongBtn = this.createArrowButton('▶', this.app.screen.width - 50, navY);
    this.nextSongBtn.on('pointerdown', () => this.nextSong());
    this.container.addChild(this.nextSongBtn);
  }

  private createArrowButton(label: string, x: number, y: number): PIXI.Graphics {
    const container = new PIXI.Graphics() as PIXI.Graphics & { labelText?: PIXI.Text };

    container.beginFill(0x2a2a4a, 0.8);
    container.drawRoundedRect(-30, -25, 60, 50, 10);
    container.endFill();

    const btnStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const text = new PIXI.Text(label, btnStyle);
    text.anchor.set(0.5);
    container.addChild(text);
    (container as any).labelText = text;

    container.x = x;
    container.y = y;
    container.interactive = true;
    container.cursor = 'pointer';

    return container;
  }

  private createSongInfo(): void {
    this.songInfoContainer.x = this.app.screen.width / 2;
    this.songInfoContainer.y = 140;
    this.container.addChild(this.songInfoContainer);
    this.updateSongInfo();
  }

  private updateSongInfo(): void {
    this.songInfoContainer.removeChildren();

    const entry = this.getCurrentEntry();
    if (!entry) return;

    const chart = entry.chart;
    const metadata = chart.metadata;
    const difficultyConfig = this.getCurrentDifficultyConfig();
    if (!difficultyConfig) return;

    const bestScore = entry.bestScore;
    const unlockInfo = ChapterUnlockManager.getUnlockInfo(metadata.id);

    const bgPanel = new PIXI.Graphics();
    const panelHeight = unlockInfo.isUnlocked ? 230 : 320;
    bgPanel.beginFill(0x1a1a3a, 0.9);
    bgPanel.drawRoundedRect(-240, 0, 480, panelHeight, 16);
    bgPanel.endFill();
    bgPanel.lineStyle(2, unlockInfo.isUnlocked ? 0x6b9dff : 0x888888, 0.6);
    bgPanel.drawRoundedRect(-240, 0, 480, panelHeight, 16);
    this.songInfoContainer.addChild(bgPanel);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 30,
      fill: unlockInfo.isUnlocked ? 0xffd700 : 0x888888,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 5,
      align: 'center'
    });

    const title = new PIXI.Text(
      unlockInfo.isUnlocked ? metadata.title : `🔒 ${metadata.title}`,
      titleStyle
    );
    title.anchor.set(0.5);
    title.y = 25;
    this.songInfoContainer.addChild(title);

    const artistStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fill: 0xaaaaaa,
      align: 'center'
    });

    const artist = new PIXI.Text(`艺术家: ${metadata.artist}`, artistStyle);
    artist.anchor.set(0.5);
    artist.y = 58;
    this.songInfoContainer.addChild(artist);

    const infoStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0xcccccc,
      align: 'left'
    });

    const bpmText = new PIXI.Text(`♪ BPM: ${metadata.bpm}`, infoStyle);
    bpmText.anchor.set(0, 0.5);
    bpmText.x = -210;
    bpmText.y = 90;
    this.songInfoContainer.addChild(bpmText);

    const stars = this.getStarDisplay(difficultyConfig.starLevel);
    const starText = new PIXI.Text(`难度: ${stars}`, infoStyle);
    starText.anchor.set(0, 0.5);
    starText.x = -210;
    starText.y = 114;
    this.songInfoContainer.addChild(starText);

    const notes = this.songLibrary.getNotesForDifficulty(chart, this.selectedDifficulty);
    const noteText = new PIXI.Text(`音符数: ${notes.length}`, infoStyle);
    noteText.anchor.set(0, 0.5);
    noteText.x = -210;
    noteText.y = 138;
    this.songInfoContainer.addChild(noteText);

    const speedText = new PIXI.Text(`落速: ${difficultyConfig.noteSpeed}`, infoStyle);
    speedText.anchor.set(0, 0.5);
    speedText.x = 30;
    speedText.y = 90;
    this.songInfoContainer.addChild(speedText);

    const diffLabelText = new PIXI.Text(`模式: ${difficultyConfig.label}`, infoStyle);
    diffLabelText.anchor.set(0, 0.5);
    diffLabelText.x = 30;
    diffLabelText.y = 114;
    this.songInfoContainer.addChild(diffLabelText);

    const playCount = ScoreStorage.getScoreHistoryForDifficulty(metadata.id, this.selectedDifficulty).length;
    const playCountText = new PIXI.Text(`游玩次数: ${playCount}`, infoStyle);
    playCountText.anchor.set(0, 0.5);
    playCountText.x = 30;
    playCountText.y = 138;
    this.songInfoContainer.addChild(playCountText);

    let bestScoreY = 168;
    if (bestScore) {
      const bestLabelStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0xffd700,
        fontWeight: 'bold',
        align: 'left'
      });

      const bestLabel = new PIXI.Text('★ 最佳成绩', bestLabelStyle);
      bestLabel.anchor.set(0, 0.5);
      bestLabel.x = -210;
      bestLabel.y = bestScoreY;
      this.songInfoContainer.addChild(bestLabel);

      const bestScoreStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 16,
        fill: 0x6b9dff,
        fontWeight: 'bold',
        align: 'left'
      });

      const bestScoreText = new PIXI.Text(
        `${bestScore.score}  [${bestScore.rating}]`,
        bestScoreStyle
      );
      bestScoreText.anchor.set(0, 0.5);
      bestScoreText.x = -210;
      bestScoreText.y = bestScoreY + 22;
      this.songInfoContainer.addChild(bestScoreText);

      const bestDetailStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: 0x88ccff,
        align: 'left'
      });

      const bestDetailText = new PIXI.Text(
        `连击:${bestScore.maxCombo}  准确率:${bestScore.accuracy.toFixed(1)}%`,
        bestDetailStyle
      );
      bestDetailText.anchor.set(0, 0.5);
      bestDetailText.x = -210;
      bestDetailText.y = bestScoreY + 44;
      this.songInfoContainer.addChild(bestDetailText);
    } else {
      const noScoreStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0x666666,
        fontStyle: 'italic',
        align: 'center'
      });

      const noScoreText = new PIXI.Text(
        unlockInfo.isUnlocked ? '暂无记录 - 来挑战吧！' : '章节尚未解锁',
        noScoreStyle
      );
      noScoreText.anchor.set(0.5);
      noScoreText.y = bestScoreY + 12;
      this.songInfoContainer.addChild(noScoreText);
    }

    if (!unlockInfo.isUnlocked && chart.unlockCondition) {
      const unlockY = bestScore ? bestScoreY + 75 : bestScoreY + 40;

      const unlockHeaderStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0xff9d5b,
        fontWeight: 'bold',
        align: 'center'
      });
      const unlockHeader = new PIXI.Text('🔒 解锁条件', unlockHeaderStyle);
      unlockHeader.anchor.set(0.5);
      unlockHeader.y = unlockY;
      this.songInfoContainer.addChild(unlockHeader);

      const unlockDescStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: 0xcccccc,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 440,
        lineHeight: 18
      });
      const unlockDesc = new PIXI.Text(chart.unlockCondition.description, unlockDescStyle);
      unlockDesc.anchor.set(0.5);
      unlockDesc.y = unlockY + 22;
      this.songInfoContainer.addChild(unlockDesc);

      const progressText = ChapterUnlockManager.getProgressText(chart.unlockCondition, unlockInfo.progress);
      const progressStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fill: unlockInfo.progress?.overallProgress && unlockInfo.progress.overallProgress >= 1
          ? 0x6bff9d
          : 0x888888,
        align: 'center'
      });
      const progressLabel = new PIXI.Text(progressText, progressStyle);
      progressLabel.anchor.set(0.5);
      progressLabel.y = unlockY + 56;
      this.songInfoContainer.addChild(progressLabel);

      if (unlockInfo.progress) {
        const barBg = new PIXI.Graphics();
        barBg.beginFill(0x333355, 0.8);
        barBg.drawRoundedRect(-200, unlockY + 70, 400, 10, 5);
        barBg.endFill();
        this.songInfoContainer.addChild(barBg);

        const progress = unlockInfo.progress.overallProgress;
        if (progress > 0) {
          const barColor = progress >= 1 ? 0x6bff9d : progress >= 0.5 ? 0xffd700 : 0xff9d5b;
          const bar = new PIXI.Graphics();
          bar.beginFill(barColor, 1);
          bar.drawRoundedRect(-200, unlockY + 70, 400 * progress, 10, 5);
          bar.endFill();
          this.songInfoContainer.addChild(bar);
        }

        const percentStyle = new PIXI.TextStyle({
          fontFamily: 'monospace',
          fontSize: 11,
          fill: 0x888888,
          align: 'center'
        });
        const percentLabel = new PIXI.Text(`完成度: ${(progress * 100).toFixed(0)}%`, percentStyle);
        percentLabel.anchor.set(0.5);
        percentLabel.y = unlockY + 88;
        this.songInfoContainer.addChild(percentLabel);
      }
    } else if (unlockInfo.isUnlocked) {
      const unlockStatusStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: 0x6bff9d,
        fontWeight: 'bold',
        align: 'center'
      });
      const unlockStatus = new PIXI.Text('✓ 章节已解锁', unlockStatusStyle);
      unlockStatus.anchor.set(0.5);
      unlockStatus.y = bestScore ? bestScoreY + 72 : bestScoreY + 40;
      this.songInfoContainer.addChild(unlockStatus);
    }

    const poemLabelStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'center'
    });

    const poemPreview = metadata.poemLines.slice(0, 1).join('  ');
    const poemText = new PIXI.Text(`「${poemPreview}...」`, poemLabelStyle);
    poemText.anchor.set(0.5);
    poemText.y = panelHeight - 8;
    this.songInfoContainer.addChild(poemText);
  }

  private getStarDisplay(level: number): string {
    const fullStars = '★'.repeat(level);
    const emptyStars = '☆'.repeat(Math.max(0, 7 - level));
    return fullStars + emptyStars;
  }

  private createDifficultySelector(): void {
    const container = new PIXI.Container();
    container.x = this.app.screen.width / 2;
    container.y = Math.min(420, this.app.screen.height - 280);
    this.container.addChild(container);

    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fill: 0xaaaaaa,
      align: 'center'
    });

    const label = new PIXI.Text('选择难度', labelStyle);
    label.anchor.set(0.5);
    label.y = -22;
    container.addChild(label);

    const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
    const labels = ['简单', '普通', '困难'];
    const colors = [0x4caf50, 0x2196f3, 0xf44336];

    difficulties.forEach((diff, index) => {
      const btnWidth = 100;
      const btnHeight = 44;
      const spacing = 120;
      const startX = -spacing;

      const button = new PIXI.Graphics();
      const x = startX + index * spacing;
      button.x = x;

      this.drawDifficultyButton(button, colors[index], labels[index], btnWidth, btnHeight, diff === this.selectedDifficulty);

      button.interactive = true;
      button.cursor = 'pointer';
      button.on('pointerdown', () => this.selectDifficulty(diff));

      container.addChild(button);
      this.difficultyButtons.push(button);
    });
  }

  private drawDifficultyButton(
    button: PIXI.Graphics,
    color: number,
    label: string,
    width: number,
    height: number,
    selected: boolean
  ): void {
    button.clear();
    button.removeChildren();

    if (selected) {
      button.lineStyle(4, 0xffffff, 1);
      button.beginFill(color, 1);
    } else {
      button.lineStyle(2, color, 0.6);
      button.beginFill(color, 0.3);
    }
    button.drawRoundedRect(-width / 2, -height / 2, width, height, 10);
    button.endFill();

    const textStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: selected ? 0xffffff : 0xdddddd,
      align: 'center'
    });

    const text = new PIXI.Text(label, textStyle);
    text.anchor.set(0.5);
    button.addChild(text);
  }

  private selectDifficulty(difficulty: Difficulty): void {
    this.selectedDifficulty = difficulty;
    this.updateDifficultyButtons();
    this.updateSongInfo();
    this.updateCoverArtDisplay();
    this.updateStartButtonState();
    this.triggerPreload();
    if (this.leaderboardVisible) {
      this.updateLeaderboardContent();
    }
  }

  private updateDifficultyButtons(): void {
    const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
    const labels = ['简单', '普通', '困难'];
    const colors = [0x4caf50, 0x2196f3, 0xf44336];

    this.difficultyButtons.forEach((btn, index) => {
      this.drawDifficultyButton(btn, colors[index], labels[index], 100, 44, difficulties[index] === this.selectedDifficulty);
    });
  }

  private prevSong(): void {
    const total = this.libraryEntries.length;
    if (total === 0) return;
    this.selectedSongIndex = (this.selectedSongIndex - 1 + total) % total;
    this.updateSongInfo();
    this.updateCoverArtDisplay();
    this.updateStartButtonState();
    this.triggerPreload();
    if (this.leaderboardVisible) {
      this.updateLeaderboardContent();
    }
  }

  private nextSong(): void {
    const total = this.libraryEntries.length;
    if (total === 0) return;
    this.selectedSongIndex = (this.selectedSongIndex + 1) % total;
    this.updateSongInfo();
    this.updateCoverArtDisplay();
    this.updateStartButtonState();
    this.triggerPreload();
    if (this.leaderboardVisible) {
      this.updateLeaderboardContent();
    }
  }

  private startButtonBg?: PIXI.Graphics;
  private startButtonText?: PIXI.Text;

  private createStartButton(): void {
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = this.app.screen.width / 2;
    buttonContainer.y = Math.min(this.app.screen.height - 100, 560);

    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x6b9dff);
    buttonBg.drawRoundedRect(-120, -32, 240, 64, 16);
    buttonBg.endFill();

    buttonBg.interactive = true;
    buttonBg.cursor = 'pointer';

    buttonBg.on('pointerdown', () => this.startGame());

    buttonContainer.addChild(buttonBg);
    this.startButtonBg = buttonBg;

    const buttonStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const buttonText = new PIXI.Text('开始游戏', buttonStyle);
    buttonText.anchor.set(0.5);
    buttonContainer.addChild(buttonText);
    this.startButtonText = buttonText;

    this.container.addChild(buttonContainer);

    this.updateStartButtonState();
    this.animateButton(buttonBg);
  }

  private updateStartButtonState(): void {
    if (!this.startButtonBg || !this.startButtonText) return;

    const chart = this.getCurrentChart();
    if (!chart) return;
    const unlockInfo = ChapterUnlockManager.getUnlockInfo(chart.metadata.id);
    const isUnlocked = unlockInfo.isUnlocked;

    this.startButtonBg.clear();
    if (isUnlocked) {
      this.startButtonBg.beginFill(0x6b9dff);
      this.startButtonText.text = '开始游戏';
      this.startButtonText.style.fill = 0xffffff;
      this.startButtonBg.interactive = true;
      this.startButtonBg.cursor = 'pointer';
    } else {
      this.startButtonBg.beginFill(0x555566, 0.8);
      this.startButtonText.text = '🔒 章节未解锁';
      this.startButtonText.style.fill = 0xaaaaaa;
      this.startButtonBg.interactive = false;
      this.startButtonBg.cursor = 'default';
    }
    this.startButtonBg.drawRoundedRect(-120, -32, 240, 64, 16);
    this.startButtonBg.endFill();
  }

  private animateButton(button: PIXI.Graphics): void {
    let time = 0;
    const animate = () => {
      time += 0.05;
      const scale = 1 + Math.sin(time) * 0.03;
      button.scale.set(scale);
      if (this.container.visible) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  private createControlsHint(): void {
    const hintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: 0x666666,
      align: 'center',
      lineHeight: 20
    });

    const keys = [];
    for (let i = 0; i < LANE_COUNT; i++) {
      keys.push(this.inputConfigManager.getKeyDisplayForLane(i));
    }
    const keyHint = keys.join(' ');

    const hint = new PIXI.Text(`操作说明: 键盘 ${keyHint} 对应四个轨道\n或直接点击屏幕轨道区域`, hintStyle);
    hint.anchor.set(0.5);
    hint.x = this.app.screen.width / 2;
    hint.y = Math.min(this.app.screen.height - 35, 610);
    hint.name = 'controlsHint';
    this.container.addChild(hint);
  }

  private createLeaderboardToggle(): void {
    const btnContainer = new PIXI.Graphics() as PIXI.Graphics & { labelText?: PIXI.Text };
    btnContainer.x = this.app.screen.width - 70;
    btnContainer.y = 120;

    btnContainer.beginFill(0x9b59b6, 0.85);
    btnContainer.lineStyle(2, 0xffd700, 0.6);
    btnContainer.drawRoundedRect(-40, -20, 80, 40, 10);
    btnContainer.endFill();

    const btnStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const text = new PIXI.Text('🏆 榜', btnStyle);
    text.anchor.set(0.5);
    btnContainer.addChild(text);

    btnContainer.interactive = true;
    btnContainer.cursor = 'pointer';
    btnContainer.on('pointerdown', () => this.toggleLeaderboard());

    this.container.addChild(btnContainer);
  }

  private createLeaderboardPanel(): void {
    this.leaderboardPanel.x = 0;
    this.leaderboardPanel.y = 0;
    this.leaderboardPanel.visible = false;

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.85);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    mask.interactive = true;
    this.leaderboardPanel.addChild(mask);

    const panelWidth = Math.min(640, this.app.screen.width - 40);
    const panelHeight = Math.min(680, this.app.screen.height - 80);
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = (this.app.screen.height - panelHeight) / 2;

    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0x151530, 0.98);
    panelBg.lineStyle(3, 0xffd700, 0.8);
    panelBg.drawRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
    panelBg.endFill();
    this.leaderboardPanel.addChild(panelBg);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      align: 'center'
    });

    const title = new PIXI.Text('🏆 历史成绩榜', titleStyle);
    title.anchor.set(0.5);
    title.x = this.app.screen.width / 2;
    title.y = panelY + 35;
    this.leaderboardPanel.addChild(title);

    const closeBtn = new PIXI.Graphics();
    closeBtn.x = panelX + panelWidth - 40;
    closeBtn.y = panelY + 30;
    closeBtn.beginFill(0xff6b6b, 0.9);
    closeBtn.drawRoundedRect(-18, -18, 36, 36, 8);
    closeBtn.endFill();
    closeBtn.interactive = true;
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.toggleLeaderboard());

    const closeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    const closeText = new PIXI.Text('✕', closeStyle);
    closeText.anchor.set(0.5);
    closeBtn.addChild(closeText);
    this.leaderboardPanel.addChild(closeBtn);

    this.leaderboardContent.x = 0;
    this.leaderboardContent.y = panelY + 60;
    this.leaderboardPanel.addChild(this.leaderboardContent);

    this.container.addChild(this.leaderboardPanel);
  }

  private toggleLeaderboard(): void {
    this.leaderboardVisible = !this.leaderboardVisible;
    this.leaderboardPanel.visible = this.leaderboardVisible;
    if (this.leaderboardVisible) {
      this.updateLeaderboardContent();
    }
  }

  private updateLeaderboardContent(): void {
    this.leaderboardContent.removeChildren();

    const chart = this.getCurrentChart();
    if (!chart) return;
    const panelWidth = Math.min(640, this.app.screen.width - 40);
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const contentWidth = panelWidth - 60;
    const startX = panelX + 30;

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0xaaaaaa,
      align: 'left'
    });

    const songLabelStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 16,
      fill: 0xffd700,
      fontWeight: 'bold',
      align: 'left'
    });

    const songLabel = new PIXI.Text(`${chart.metadata.title} - ${DIFFICULTY_LABELS[this.selectedDifficulty]}`, songLabelStyle);
    songLabel.anchor.set(0, 0);
    songLabel.x = startX;
    songLabel.y = 10;
    this.leaderboardContent.addChild(songLabel);

    const colHeaders = ['排名', '评级', '分数', '连击', '准确率', '日期'];
    const colXs = [0, 55, 100, 210, 290, 380];

    colHeaders.forEach((header, i) => {
      const text = new PIXI.Text(header, headerStyle);
      text.anchor.set(0, 0);
      text.x = startX + colXs[i];
      text.y = 40;
      this.leaderboardContent.addChild(text);
    });

    const divider = new PIXI.Graphics();
    divider.lineStyle(1, 0x444466, 0.6);
    divider.moveTo(startX, 62);
    divider.lineTo(startX + contentWidth, 62);
    this.leaderboardContent.addChild(divider);

    const topScores = ScoreStorage.getTopScores(chart.metadata.id, this.selectedDifficulty, 15);

    if (topScores.length === 0) {
      const emptyStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 16,
        fill: 0x666666,
        fontStyle: 'italic',
        align: 'center'
      });
      const emptyText = new PIXI.Text('还没有成绩记录~ 快去挑战吧！', emptyStyle);
      emptyText.anchor.set(0.5);
      emptyText.x = this.app.screen.width / 2;
      emptyText.y = 110;
      this.leaderboardContent.addChild(emptyText);
      return;
    }

    const rowHeight = 36;
    topScores.forEach((entry, index) => {
      const rowY = 70 + index * rowHeight;
      const isTopThree = index < 3;

      if (isTopThree) {
        const rowBg = new PIXI.Graphics();
        const bgColor = index === 0 ? 0xffd700 : index === 1 ? 0xc0c0c0 : 0xcd7f32;
        rowBg.beginFill(bgColor, 0.12);
        rowBg.drawRoundedRect(startX - 5, rowY - 4, contentWidth + 10, rowHeight - 4, 6);
        rowBg.endFill();
        this.leaderboardContent.addChild(rowBg);
      }

      const rankStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: isTopThree ? 16 : 14,
        fontWeight: isTopThree ? 'bold' : 'normal',
        fill: index === 0 ? 0xffd700 : index === 1 ? 0xe0e0e0 : index === 2 ? 0xcd7f32 : 0x888888,
        align: 'left'
      });

      const rankLabel = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
      const rankText = new PIXI.Text(rankLabel, rankStyle);
      rankText.anchor.set(0, 0.5);
      rankText.x = startX + colXs[0];
      rankText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(rankText);

      const ratingColor = this.getRatingColor(entry.rating);
      const ratingStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 16,
        fontWeight: 'bold',
        fill: ratingColor,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'left'
      });
      const ratingText = new PIXI.Text(entry.rating, ratingStyle);
      ratingText.anchor.set(0, 0.5);
      ratingText.x = startX + colXs[1];
      ratingText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(ratingText);

      const scoreStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0x6b9dff,
        align: 'left'
      });
      const scoreText = new PIXI.Text(entry.score.toLocaleString(), scoreStyle);
      scoreText.anchor.set(0, 0.5);
      scoreText.x = startX + colXs[2];
      scoreText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(scoreText);

      const comboStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 13,
        fill: 0xff9d5b,
        align: 'left'
      });
      const comboText = new PIXI.Text(`${entry.maxCombo}x`, comboStyle);
      comboText.anchor.set(0, 0.5);
      comboText.x = startX + colXs[3];
      comboText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(comboText);

      const accColor = entry.accuracy >= 95 ? 0xffd700 : entry.accuracy >= 85 ? 0x6bff9d : entry.accuracy >= 70 ? 0x6b9dff : 0xff6b6b;
      const accStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 13,
        fill: accColor,
        align: 'left'
      });
      const accText = new PIXI.Text(`${entry.accuracy.toFixed(1)}%`, accStyle);
      accText.anchor.set(0, 0.5);
      accText.x = startX + colXs[4];
      accText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(accText);

      const date = new Date(entry.timestamp);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      const dateStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fill: 0x888888,
        align: 'left'
      });
      const dateText = new PIXI.Text(dateStr, dateStyle);
      dateText.anchor.set(0, 0.5);
      dateText.x = startX + colXs[5];
      dateText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(dateText);
    });

    const allHistory = ScoreStorage.getScoreHistory();
    const totalStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x666688,
      align: 'center'
    });
    const totalText = new PIXI.Text(`总游玩记录: ${allHistory.length} 次  |  当前曲目: ${topScores.length} 次`, totalStyle);
    totalText.anchor.set(0.5);
    totalText.x = this.app.screen.width / 2;
    totalText.y = 70 + Math.min(topScores.length, 15) * rowHeight + 15;
    this.leaderboardContent.addChild(totalText);
  }

  private getRatingColor(rating: string): number {
    switch (rating) {
      case 'S': return 0xffd700;
      case 'A': return 0x6bff9d;
      case 'B': return 0x6b9dff;
      case 'C': return 0xff9d5b;
      case 'D': return 0xff6b6b;
      default: return 0xffffff;
    }
  }

  private startGame(): void {
    const chart = this.getCurrentChart();
    if (!chart || !this.onStartCallback) return;
    this.onStartCallback(chart.metadata.id, this.selectedDifficulty, { ...this.practiceConfig });
  }

  public setOnStartCallback(callback: (songId: string, difficulty: Difficulty, practiceConfig: PracticeConfig) => void): void {
    this.onStartCallback = callback;
  }

  public setOnPreloadCallback(callback: (songId: string, difficulty: Difficulty) => void): void {
    this.onPreloadCallback = callback;
  }

  private triggerPreload(): void {
    if (!this.onPreloadCallback) return;
    if (this.preloadDebounceTimer) {
      clearTimeout(this.preloadDebounceTimer);
    }
    this.preloadDebounceTimer = window.setTimeout(() => {
      const chart = this.getCurrentChart();
      if (chart && this.onPreloadCallback) {
        this.onPreloadCallback(chart.metadata.id, this.selectedDifficulty);
      }
      this.preloadDebounceTimer = undefined;
    }, 100);
  }

  public show(): void {
    this.container.visible = true;
    ChapterUnlockManager.evaluateAndUnlockAll();
    this.refreshLibraryEntries();
    this.updateSongInfo();
    this.updateCoverArtDisplay();
    this.updateStartButtonState();
    this.triggerPreload();
    if (this.leaderboardVisible) {
      this.updateLeaderboardContent();
    }
  }

  public hide(): void {
    this.container.visible = false;
    this.leaderboardVisible = false;
    this.leaderboardPanel.visible = false;
    this.filterPanelVisible = false;
    this.filterPanel.visible = false;
  }

  public destroy(): void {
    if (this.removeLibraryListener) {
      this.removeLibraryListener();
    }
    this.loadedCoverTextures.forEach((tex) => {
      if (!tex.destroyed) {
        tex.destroy();
      }
    });
    this.loadedCoverTextures.clear();
    this.container.destroy();
  }

  private createSettingsToggle(): void {
    const btnContainer = new PIXI.Graphics() as PIXI.Graphics & { labelText?: PIXI.Text };
    btnContainer.x = 70;
    btnContainer.y = 120;

    btnContainer.beginFill(0x3498db, 0.85);
    btnContainer.lineStyle(2, 0xffd700, 0.6);
    btnContainer.drawRoundedRect(-40, -20, 80, 40, 10);
    btnContainer.endFill();

    const btnStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const text = new PIXI.Text('⚙ 设置', btnStyle);
    text.anchor.set(0.5);
    btnContainer.addChild(text);

    btnContainer.interactive = true;
    btnContainer.cursor = 'pointer';
    btnContainer.on('pointerdown', () => this.toggleSettings());

    this.container.addChild(btnContainer);
  }

  private createSettingsPanel(): void {
    this.settingsPanel.x = 0;
    this.settingsPanel.y = 0;
    this.settingsPanel.visible = false;

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.9);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    mask.interactive = true;
    this.settingsPanel.addChild(mask);

    const panelWidth = Math.min(680, this.app.screen.width - 40);
    const panelHeight = Math.min(720, this.app.screen.height - 60);
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = (this.app.screen.height - panelHeight) / 2;

    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0x151530, 0.98);
    panelBg.lineStyle(3, 0x3498db, 0.8);
    panelBg.drawRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
    panelBg.endFill();
    this.settingsPanel.addChild(panelBg);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      align: 'center'
    });

    const title = new PIXI.Text('⚙ 操作设置', titleStyle);
    title.anchor.set(0.5);
    title.x = this.app.screen.width / 2;
    title.y = panelY + 35;
    this.settingsPanel.addChild(title);

    const closeBtn = new PIXI.Graphics();
    closeBtn.x = panelX + panelWidth - 40;
    closeBtn.y = panelY + 30;
    closeBtn.beginFill(0xff6b6b, 0.9);
    closeBtn.drawRoundedRect(-18, -18, 36, 36, 8);
    closeBtn.endFill();
    closeBtn.interactive = true;
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.toggleSettings());

    const closeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    const closeText = new PIXI.Text('✕', closeStyle);
    closeText.anchor.set(0.5);
    closeBtn.addChild(closeText);
    this.settingsPanel.addChild(closeBtn);

    this.settingsContent.x = 0;
    this.settingsContent.y = panelY + 70;
    this.settingsPanel.addChild(this.settingsContent);

    this.container.addChild(this.settingsPanel);
  }

  private toggleSettings(): void {
    this.settingsVisible = !this.settingsVisible;
    this.settingsPanel.visible = this.settingsVisible;
    this.capturingLane = null;
    if (this.settingsVisible) {
      this.updateSettingsContent();
    }
  }

  private updateSettingsContent(): void {
    this.settingsContent.removeChildren();
    this.keyBindingButtons = [];

    const panelWidth = Math.min(680, this.app.screen.width - 40);
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const contentWidth = panelWidth - 60;
    const startX = panelX + 30;

    this.createSettingsTabs(startX, contentWidth);

    if (this.settingsTab === 'keys') {
      this.createKeyBindingSettings(startX, contentWidth);
    } else if (this.settingsTab === 'gestures') {
      this.createGestureSettings(startX, contentWidth);
    } else {
      this.createAdvancedSettings(startX, contentWidth);
    }
  }

  private createSettingsTabs(startX: number, contentWidth: number): void {
    const tabs = [
      { key: 'keys' as const, label: '按键设置', color: 0x3498db },
      { key: 'gestures' as const, label: '手势设置', color: 0x2ecc71 },
      { key: 'advanced' as const, label: '高级设置', color: 0xe67e22 }
    ];

    const tabWidth = contentWidth / 3 - 10;
    const tabHeight = 44;

    tabs.forEach((tab, index) => {
      const tabBtn = new PIXI.Graphics();
      const x = startX + index * (tabWidth + 15);
      tabBtn.x = x;
      tabBtn.y = 0;

      const isSelected = this.settingsTab === tab.key;

      if (isSelected) {
        tabBtn.lineStyle(3, 0xffffff, 1);
        tabBtn.beginFill(tab.color, 1);
      } else {
        tabBtn.lineStyle(2, tab.color, 0.6);
        tabBtn.beginFill(tab.color, 0.3);
      }
      tabBtn.drawRoundedRect(0, 0, tabWidth, tabHeight, 8);
      tabBtn.endFill();

      const textStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 16,
        fontWeight: 'bold',
        fill: isSelected ? 0xffffff : 0xdddddd,
        align: 'center'
      });

      const text = new PIXI.Text(tab.label, textStyle);
      text.anchor.set(0.5);
      text.x = tabWidth / 2;
      text.y = tabHeight / 2;
      tabBtn.addChild(text);

      tabBtn.interactive = true;
      tabBtn.cursor = 'pointer';
      tabBtn.on('pointerdown', () => {
        this.settingsTab = tab.key;
        this.updateSettingsContent();
      });

      this.settingsContent.addChild(tabBtn);
    });
  }

  private createKeyBindingSettings(startX: number, contentWidth: number): void {
    const sectionY = 70;

    const sectionTitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffd700,
      align: 'left'
    });

    const sectionTitle = new PIXI.Text('键盘按键映射', sectionTitleStyle);
    sectionTitle.anchor.set(0, 0);
    sectionTitle.x = startX;
    sectionTitle.y = sectionY;
    this.settingsContent.addChild(sectionTitle);

    const hintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'left'
    });
    const hint = new PIXI.Text('点击按键按钮，然后按下新的按键进行绑定', hintStyle);
    hint.anchor.set(0, 0);
    hint.x = startX;
    hint.y = sectionY + 30;
    this.settingsContent.addChild(hint);

    const btnWidth = 100;
    const btnHeight = 50;
    const btnSpacing = (contentWidth - LANE_COUNT * btnWidth) / (LANE_COUNT - 1);

    for (let i = 0; i < LANE_COUNT; i++) {
      const btnX = startX + i * (btnWidth + btnSpacing);
      const btnY = sectionY + 60;

      const laneLabelStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0xaaaaaa,
        align: 'center'
      });
      const laneLabel = new PIXI.Text(`轨道 ${i + 1}`, laneLabelStyle);
      laneLabel.anchor.set(0.5);
      laneLabel.x = btnX + btnWidth / 2;
      laneLabel.y = btnY - 20;
      this.settingsContent.addChild(laneLabel);

      const keyBtn = this.createKeyBindingButton(i, btnX, btnY, btnWidth, btnHeight);
      this.keyBindingButtons.push(keyBtn);
      this.settingsContent.addChild(keyBtn);
    }

    this.captureHint = new PIXI.Text('', hintStyle);
    this.captureHint.anchor.set(0, 0);
    this.captureHint.x = startX;
    this.captureHint.y = sectionY + 140;
    this.settingsContent.addChild(this.captureHint);

    this.statusMessage = new PIXI.Text('', hintStyle);
    this.statusMessage.anchor.set(0, 0);
    this.statusMessage.x = startX;
    this.statusMessage.y = sectionY + 160;
    this.settingsContent.addChild(this.statusMessage);

    this.createPreviewSection(startX, sectionY + 190, contentWidth);

    const resetBtn = this.createActionButton(
      '恢复默认按键',
      startX + contentWidth / 2 - 110,
      sectionY + 340,
      220,
      44,
      0xe74c3c,
      () => {
        this.inputConfigManager.resetToDefaults();
        this.showStatus('已恢复默认设置', 0x2ecc71);
      }
    );
    this.settingsContent.addChild(resetBtn);
  }

  private createKeyBindingButton(lane: number, x: number, y: number, width: number, height: number): PIXI.Graphics {
    const btn = new PIXI.Graphics() as PIXI.Graphics & { keyText?: PIXI.Text };
    btn.x = x;
    btn.y = y;

    const currentKey = this.inputConfigManager.getKeyDisplayForLane(lane);
    this.drawKeyButton(btn, width, height, currentKey, false);

    btn.interactive = true;
    btn.cursor = 'pointer';
    btn.on('pointerdown', () => {
      if (this.capturingLane === lane) {
        this.capturingLane = null;
        this.updateCaptureHint();
        this.updateKeyBindingButtons();
      } else {
        this.capturingLane = lane;
        this.updateCaptureHint();
        this.updateKeyBindingButtons();
      }
    });

    return btn;
  }

  private drawKeyButton(btn: PIXI.Graphics & { keyText?: PIXI.Text }, width: number, height: number, key: string, isCapturing: boolean): void {
    btn.clear();
    btn.removeChildren();

    if (isCapturing) {
      btn.lineStyle(3, 0xffd700, 1);
      btn.beginFill(0x9b59b6, 0.8);
    } else {
      btn.lineStyle(2, 0x3498db, 0.8);
      btn.beginFill(0x2a2a4a, 0.9);
    }
    btn.drawRoundedRect(0, 0, width, height, 10);
    btn.endFill();

    const textStyle = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 28,
      fontWeight: 'bold',
      fill: isCapturing ? 0xffd700 : 0xffffff,
      align: 'center'
    });

    const text = new PIXI.Text(key.toUpperCase(), textStyle);
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = height / 2;
    btn.addChild(text);
    (btn as any).keyText = text;
  }

  private updateKeyBindingButtons(): void {
    const btnWidth = 100;
    const btnHeight = 50;

    for (let i = 0; i < LANE_COUNT; i++) {
      const btn = this.keyBindingButtons[i] as PIXI.Graphics & { keyText?: PIXI.Text };
      if (btn) {
        const currentKey = this.inputConfigManager.getKeyDisplayForLane(i);
        const isCapturing = this.capturingLane === i;
        this.drawKeyButton(btn, btnWidth, btnHeight, isCapturing ? '...' : currentKey, isCapturing);
      }
    }
  }

  private updateCaptureHint(): void {
    if (this.captureHint) {
      if (this.capturingLane !== null) {
        this.captureHint.text = `正在监听按键... 按下任意键绑定到轨道 ${this.capturingLane + 1}，按 ESC 取消`;
        this.captureHint.style.fill = 0xffd700;
      } else {
        this.captureHint.text = '';
      }
    }
  }

  private showStatus(message: string, color: number = 0xffffff): void {
    if (this.statusMessage) {
      this.statusMessage.text = message;
      this.statusMessage.style.fill = color;
      setTimeout(() => {
        if (this.statusMessage) {
          this.statusMessage.text = '';
        }
      }, 3000);
    }
  }

  private createPreviewSection(startX: number, y: number, contentWidth: number): void {
    const previewTitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xaaaaaa,
      align: 'left'
    });

    const previewTitle = new PIXI.Text('实时预览 - 轨道标识', previewTitleStyle);
    previewTitle.anchor.set(0, 0);
    previewTitle.x = startX;
    previewTitle.y = y;
    this.settingsContent.addChild(previewTitle);

    const previewBg = new PIXI.Graphics();
    previewBg.beginFill(0x0a0a1a, 0.8);
    previewBg.lineStyle(2, 0x444466, 0.5);
    previewBg.drawRoundedRect(startX, y + 30, contentWidth, 80, 8);
    previewBg.endFill();
    this.settingsContent.addChild(previewBg);

    const laneWidth = contentWidth / LANE_COUNT;
    const hintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });

    this.previewLaneHints = [];
    for (let i = 0; i < LANE_COUNT; i++) {
      const key = this.inputConfigManager.getKeyDisplayForLane(i);
      const keyHint = new PIXI.Text(key, hintStyle);
      keyHint.anchor.set(0.5);
      keyHint.x = startX + i * laneWidth + laneWidth / 2;
      keyHint.y = y + 70;
      keyHint.alpha = 0.8;
      this.settingsContent.addChild(keyHint);
      this.previewLaneHints.push(keyHint);
    }

    const dividerStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0x666666,
      align: 'center'
    });
    for (let i = 1; i < LANE_COUNT; i++) {
      const divider = new PIXI.Text('│', dividerStyle);
      divider.anchor.set(0.5);
      divider.x = startX + i * laneWidth;
      divider.y = y + 70;
      this.settingsContent.addChild(divider);
    }
  }

  private createGestureSettings(startX: number, contentWidth: number): void {
    const sectionY = 70;

    const sectionTitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffd700,
      align: 'left'
    });

    const sectionTitle = new PIXI.Text('移动端手势方案', sectionTitleStyle);
    sectionTitle.anchor.set(0, 0);
    sectionTitle.x = startX;
    sectionTitle.y = sectionY;
    this.settingsContent.addChild(sectionTitle);

    const hintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'left',
      lineHeight: 18
    });
    const hint = new PIXI.Text('配置在移动设备上的触控手势操作。点击右侧开关可启用/禁用对应手势。', hintStyle);
    hint.anchor.set(0, 0);
    hint.x = startX;
    hint.y = sectionY + 30;
    this.settingsContent.addChild(hint);

    const gestures = this.inputConfigManager.getGestures();
    const itemHeight = 50;
    const itemY = sectionY + 70;

    const iconMap: Record<string, string> = {
      tap: '👆',
      swipe: '👉',
      hold: '✊'
    };

    gestures.forEach((gesture, index) => {
      const y = itemY + index * (itemHeight + 10);

      const itemBg = new PIXI.Graphics();
      itemBg.beginFill(gesture.enabled ? 0x1a1a3a : 0x1a1a1a, gesture.enabled ? 0.6 : 0.3);
      itemBg.lineStyle(1, gesture.enabled ? 0x3498db : 0x444444, gesture.enabled ? 0.3 : 0.2);
      itemBg.drawRoundedRect(startX, y, contentWidth, itemHeight, 8);
      itemBg.endFill();
      this.settingsContent.addChild(itemBg);

      const iconStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 24,
        align: 'center'
      });
      const icon = new PIXI.Text(iconMap[gesture.gesture] || '?', iconStyle);
      icon.anchor.set(0, 0.5);
      icon.x = startX + 15;
      icon.y = y + itemHeight / 2;
      icon.alpha = gesture.enabled ? 1 : 0.4;
      this.settingsContent.addChild(icon);

      const labelStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 16,
        fill: gesture.enabled ? 0xffffff : 0x666666,
        align: 'left'
      });
      let labelText = gesture.label;
      if (gesture.lane >= 0) {
        labelText += ` → 轨道 ${gesture.lane + 1}`;
      }
      if (gesture.direction) {
        const dirMap: Record<string, string> = { left: '←', right: '→', up: '↑', down: '↓' };
        labelText += ` ${dirMap[gesture.direction] || ''}`;
      }
      const label = new PIXI.Text(labelText, labelStyle);
      label.anchor.set(0, 0.5);
      label.x = startX + 55;
      label.y = y + itemHeight / 2;
      this.settingsContent.addChild(label);

      const toggleBtn = this.createToggleSwitch(
        gesture.enabled,
        startX + contentWidth - 70,
        y + 10,
        60,
        30,
        () => {
          const result = this.inputConfigManager.toggleGestureEnabled(
            gesture.gesture,
            gesture.lane,
            gesture.direction
          );
          if (result.valid) {
            if (result.warnings.length > 0) {
              this.showStatus(result.warnings[0], 0xffaa00);
            }
            this.updateSettingsContent();
          } else {
            this.showStatus(result.errors[0], 0xe74c3c);
          }
        }
      );
      this.settingsContent.addChild(toggleBtn);
    });

    const gestureInfoY = itemY + gestures.length * (itemHeight + 10) + 20;
    const infoStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: 0x88ccff,
      align: 'left',
      lineHeight: 20
    });
    const info = new PIXI.Text(
      '💡 提示：\n• 点击轨道区域：触发普通音符 (Tap)\n• 按住轨道不放：触发长按音符 (Hold)\n• 在轨道间滑动：触发滑键音符 (Slide)\n• 设置修改后立即生效，无需重启游戏',
      infoStyle
    );
    info.anchor.set(0, 0);
    info.x = startX;
    info.y = gestureInfoY;
    this.settingsContent.addChild(info);
  }

  private createToggleSwitch(enabled: boolean, x: number, y: number, width: number, height: number, onToggle: () => void): PIXI.Graphics {
    const btn = new PIXI.Graphics();
    btn.x = x;
    btn.y = y;

    const bgColor = enabled ? 0x2ecc71 : 0x555555;
    const knobX = enabled ? width - height + 4 : 4;

    btn.beginFill(bgColor, 0.9);
    btn.drawRoundedRect(0, 0, width, height, height / 2);
    btn.endFill();

    btn.beginFill(0xffffff, 1);
    btn.drawCircle(knobX + (height - 8) / 2, height / 2, (height - 8) / 2);
    btn.endFill();

    btn.interactive = true;
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onToggle();
    });

    return btn;
  }

  private createAdvancedSettings(startX: number, contentWidth: number): void {
    const sectionY = 70;

    const sectionTitleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffd700,
      align: 'left'
    });

    const sectionTitle = new PIXI.Text('高级设置', sectionTitleStyle);
    sectionTitle.anchor.set(0, 0);
    sectionTitle.x = startX;
    sectionTitle.y = sectionY;
    this.settingsContent.addChild(sectionTitle);

    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0xcccccc,
      align: 'left'
    });

    const valueStyle = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0x6b9dff,
      align: 'center'
    });

    const swipeY = sectionY + 40;
    const swipeLabel = new PIXI.Text('滑动阈值 (像素)', labelStyle);
    swipeLabel.anchor.set(0, 0.5);
    swipeLabel.x = startX;
    swipeLabel.y = swipeY + 20;
    this.settingsContent.addChild(swipeLabel);

    const swipeValue = new PIXI.Text(`${this.inputConfigManager.getSwipeThreshold()} px`, valueStyle);
    swipeValue.anchor.set(0, 0.5);
    swipeValue.x = startX + 180;
    swipeValue.y = swipeY + 20;
    this.settingsContent.addChild(swipeValue);

    const swipeDecBtn = this.createStepperButton(
      '-',
      startX + 280,
      swipeY,
      40,
      40,
      0xe74c3c,
      () => {
        const current = this.inputConfigManager.getSwipeThreshold();
        const result = this.inputConfigManager.setSwipeThreshold(current - 10);
        if (result.valid) {
          swipeValue.text = `${this.inputConfigManager.getSwipeThreshold()} px`;
        } else {
          this.showStatus(result.errors[0], 0xe74c3c);
        }
      }
    );
    this.settingsContent.addChild(swipeDecBtn);

    const swipeIncBtn = this.createStepperButton(
      '+',
      startX + 330,
      swipeY,
      40,
      40,
      0x2ecc71,
      () => {
        const current = this.inputConfigManager.getSwipeThreshold();
        const result = this.inputConfigManager.setSwipeThreshold(current + 10);
        if (result.valid) {
          swipeValue.text = `${this.inputConfigManager.getSwipeThreshold()} px`;
        } else {
          this.showStatus(result.errors[0], 0xe74c3c);
        }
      }
    );
    this.settingsContent.addChild(swipeIncBtn);

    const swipeHintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 11,
      fill: 0x666666,
      align: 'left'
    });
    const swipeHint = new PIXI.Text('滑动手势需要移动的最小距离', swipeHintStyle);
    swipeHint.anchor.set(0, 0);
    swipeHint.x = startX;
    swipeHint.y = swipeY + 45;
    this.settingsContent.addChild(swipeHint);

    const holdY = sectionY + 110;
    const holdLabel = new PIXI.Text('长按阈值 (毫秒)', labelStyle);
    holdLabel.anchor.set(0, 0.5);
    holdLabel.x = startX;
    holdLabel.y = holdY + 20;
    this.settingsContent.addChild(holdLabel);

    const holdValue = new PIXI.Text(`${this.inputConfigManager.getHoldThreshold()} ms`, valueStyle);
    holdValue.anchor.set(0, 0.5);
    holdValue.x = startX + 180;
    holdValue.y = holdY + 20;
    this.settingsContent.addChild(holdValue);

    const holdDecBtn = this.createStepperButton(
      '-',
      startX + 280,
      holdY,
      40,
      40,
      0xe74c3c,
      () => {
        const current = this.inputConfigManager.getHoldThreshold();
        const result = this.inputConfigManager.setHoldThreshold(current - 50);
        if (result.valid) {
          holdValue.text = `${this.inputConfigManager.getHoldThreshold()} ms`;
        } else {
          this.showStatus(result.errors[0], 0xe74c3c);
        }
      }
    );
    this.settingsContent.addChild(holdDecBtn);

    const holdIncBtn = this.createStepperButton(
      '+',
      startX + 330,
      holdY,
      40,
      40,
      0x2ecc71,
      () => {
        const current = this.inputConfigManager.getHoldThreshold();
        const result = this.inputConfigManager.setHoldThreshold(current + 50);
        if (result.valid) {
          holdValue.text = `${this.inputConfigManager.getHoldThreshold()} ms`;
        } else {
          this.showStatus(result.errors[0], 0xe74c3c);
        }
      }
    );
    this.settingsContent.addChild(holdIncBtn);

    const holdHint = new PIXI.Text('判定为长按手势需要按住的最小时间', swipeHintStyle);
    holdHint.anchor.set(0, 0);
    holdHint.x = startX;
    holdHint.y = holdY + 45;
    this.settingsContent.addChild(holdHint);

    const resetAllBtn = this.createActionButton(
      '恢复所有默认设置',
      startX + contentWidth / 2 - 110,
      sectionY + 220,
      220,
      44,
      0xe74c3c,
      () => {
        this.inputConfigManager.resetToDefaults();
        this.showStatus('已恢复所有默认设置', 0x2ecc71);
        this.updateSettingsContent();
      }
    );
    this.settingsContent.addChild(resetAllBtn);
  }

  private createStepperButton(label: string, x: number, y: number, width: number, height: number, color: number, onClick: () => void): PIXI.Graphics {
    const btn = new PIXI.Graphics();
    btn.x = x;
    btn.y = y;

    btn.beginFill(color, 0.8);
    btn.drawRoundedRect(0, 0, width, height, 8);
    btn.endFill();

    const textStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const text = new PIXI.Text(label, textStyle);
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = height / 2;
    btn.addChild(text);

    btn.interactive = true;
    btn.cursor = 'pointer';
    btn.on('pointerdown', onClick);

    return btn;
  }

  private createActionButton(label: string, x: number, y: number, width: number, height: number, color: number, onClick: () => void): PIXI.Graphics {
    const btn = new PIXI.Graphics();
    btn.x = x;
    btn.y = y;

    btn.beginFill(color, 0.9);
    btn.drawRoundedRect(0, 0, width, height, 10);
    btn.endFill();

    const textStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const text = new PIXI.Text(label, textStyle);
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = height / 2;
    btn.addChild(text);

    btn.interactive = true;
    btn.cursor = 'pointer';
    btn.on('pointerdown', onClick);

    return btn;
  }

  private setupConfigChangeListener(): void {
    this.inputConfigManager.addChangeListener(() => {
      this.updateKeyBindingButtons();
      this.updatePreviewLaneHints();
      this.updateControlsHint();
      if (this.settingsVisible && this.settingsTab === 'keys') {
        this.updateSettingsContent();
      }
    });
  }

  private updatePreviewLaneHints(): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const hint = this.previewLaneHints[i];
      if (hint) {
        hint.text = this.inputConfigManager.getKeyDisplayForLane(i);
      }
    }
  }

  private updateControlsHint(): void {
    const oldHint = this.container.getChildByName('controlsHint') as PIXI.Text;
    if (oldHint) {
      this.container.removeChild(oldHint);
      oldHint.destroy();
    }
    this.createControlsHint();
  }

  private setupKeyCaptureListener(): void {
    window.addEventListener('keydown', (e) => {
      if (this.capturingLane !== null && this.settingsVisible) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
          this.capturingLane = null;
          this.updateCaptureHint();
          this.updateKeyBindingButtons();
          return;
        }

        const key = e.key.length === 1 ? e.key : e.key;
        const result = this.inputConfigManager.setKeyForLane(key, this.capturingLane);

        if (result.valid) {
          this.showStatus(`已将按键 "${key.toUpperCase()}" 绑定到轨道 ${this.capturingLane + 1}`, 0x2ecc71);
          this.capturingLane = null;
          this.updateCaptureHint();
        } else {
          this.showStatus(result.errors[0], 0xe74c3c);
        }
      }
    });
  }

  private createPracticeToggle(): void {
    const toggleContainer = new PIXI.Container();
    toggleContainer.x = this.app.screen.width - 180;
    toggleContainer.y = 80;
    
    const btn = new PIXI.Graphics();
    btn.x = 0;
    btn.y = 0;
    
    const updateBtn = () => {
      btn.clear();
      if (this.practiceConfig.enabled) {
        btn.beginFill(0xff6b9d, 0.9);
        btn.lineStyle(2, 0xffd700, 0.9);
      } else {
        btn.beginFill(0x555566, 0.8);
        btn.lineStyle(2, 0xaaaaaa, 0.7);
      }
      btn.drawRoundedRect(0, 0, 140, 36, 10);
      btn.endFill();
    };
    updateBtn();
    
    btn.interactive = true;
    btn.cursor = 'pointer';
    
    const btnStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    
    const updateText = () => {
      const statusText = this.practiceConfig.enabled ? '🎯 练习中' : '📖 练习模式';
      if (this.practiceStatusText) {
        this.practiceStatusText.destroy();
      }
      this.practiceStatusText = new PIXI.Text(statusText, btnStyle);
      this.practiceStatusText.x = 70;
      this.practiceStatusText.y = 18;
      this.practiceStatusText.anchor.set(0.5);
      toggleContainer.addChild(this.practiceStatusText);
    };
    updateText();
    
    btn.on('pointerdown', () => {
      this.practiceConfig.enabled = !this.practiceConfig.enabled;
      this.practicePanelVisible = this.practiceConfig.enabled;
      this.practicePanel.visible = this.practicePanelVisible;
      updateBtn();
      updateText();
    });
    
    toggleContainer.addChild(btn);
    this.container.addChild(toggleContainer);
  }

  private createPracticePanel(): void {
    this.practicePanel.visible = false;
    this.container.addChild(this.practicePanel);
    
    const panel = new PIXI.Graphics();
    const panelX = 50;
    const panelY = 200;
    const panelW = this.app.screen.width - 100;
    const panelH = 280;
    
    panel.beginFill(0x151530, 0.96);
    panel.lineStyle(2, 0xff6b9d, 0.7);
    panel.drawRoundedRect(panelX, panelY, panelW, panelH, 16);
    panel.endFill();
    this.practicePanel.addChild(panel);
    
    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffd700,
      align: 'center'
    });
    const title = new PIXI.Text('🎯 新手练习设置', titleStyle);
    title.x = this.app.screen.width / 2;
    title.y = panelY + 24;
    title.anchor.set(0.5);
    this.practicePanel.addChild(title);
    
    this.createSpeedSelector(panelX + 40, panelY + 65, panelW - 80);
    this.createEarlyJudgeLineToggle(panelX + 40, panelY + 130, panelW - 80);
    this.createLoopSettings(panelX + 40, panelY + 190, panelW - 80);
  }

  private createSpeedSelector(startX: number, startY: number, width: number): void {
    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'left'
    });
    
    const label = new PIXI.Text('⏱️ 游戏速度 (音符下落速度)', labelStyle);
    label.x = startX;
    label.y = startY;
    this.practicePanel.addChild(label);
    
    const speedOptions = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
    const btnW = (width - 60) / speedOptions.length;
    const btnH = 36;
    const gap = 12;
    
    speedOptions.forEach((speed, index) => {
      const btn = new PIXI.Graphics();
      const x = startX + index * (btnW + gap);
      btn.x = x;
      btn.y = startY + 28;
      
      const updateBtn = () => {
        btn.clear();
        if (Math.abs(this.practiceConfig.speedMultiplier - speed) < 0.001) {
          btn.beginFill(0xff6b9d, 1);
          btn.lineStyle(2, 0xffd700, 0.9);
        } else {
          btn.beginFill(0x3a3a55, 0.9);
          btn.lineStyle(1, 0x666688, 0.7);
        }
        btn.drawRoundedRect(0, 0, btnW, btnH, 8);
        btn.endFill();
      };
      updateBtn();
      
      btn.interactive = true;
      btn.cursor = 'pointer';
      
      const textStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: 0xffffff,
        align: 'center'
      });
      const txt = new PIXI.Text(`${speed.toFixed(2)}x`, textStyle);
      txt.x = btnW / 2;
      txt.y = btnH / 2;
      txt.anchor.set(0.5);
      btn.addChild(txt);
      
      btn.on('pointerdown', () => {
        this.practiceConfig.speedMultiplier = speed;
        this.practicePanel.children.forEach(child => {
          if (child instanceof PIXI.Graphics && child.name) {
          }
        });
        this.practicePanel.removeChildren();
        const parent = this.practicePanel.parent;
        this.practicePanel.destroy();
        this.practicePanel = new PIXI.Container();
        parent.addChild(this.practicePanel);
        this.createPracticePanel();
        this.practicePanel.visible = this.practiceConfig.enabled;
      });
      
      this.practicePanel.addChild(btn);
    });
  }

  private createEarlyJudgeLineToggle(startX: number, startY: number, width: number): void {
    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'left'
    });
    
    const label = new PIXI.Text('✨ 显示提前判定线 (辅助判断)', labelStyle);
    label.x = startX;
    label.y = startY;
    this.practicePanel.addChild(label);
    
    const descStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 11,
      fill: 0xaaaaaa,
      align: 'left'
    });
    const desc = new PIXI.Text('在判定线上方显示辅助线，帮助新手提前判断音符落点', descStyle);
    desc.x = startX;
    desc.y = startY + 24;
    this.practicePanel.addChild(desc);
    
    const toggleBtn = new PIXI.Graphics();
    toggleBtn.x = startX + width - 100;
    toggleBtn.y = startY - 2;
    
    const updateBtn = () => {
      toggleBtn.clear();
      if (this.practiceConfig.showEarlyJudgeLine) {
        toggleBtn.beginFill(0x2ecc71, 1);
        toggleBtn.lineStyle(2, 0xffd700, 0.8);
        toggleBtn.drawRoundedRect(0, 0, 100, 40, 20);
        toggleBtn.endFill();
        
        toggleBtn.beginFill(0xffffff, 1);
        toggleBtn.drawCircle(76, 20, 13);
        toggleBtn.endFill();
      } else {
        toggleBtn.beginFill(0x555566, 1);
        toggleBtn.lineStyle(2, 0x888899, 0.7);
        toggleBtn.drawRoundedRect(0, 0, 100, 40, 20);
        toggleBtn.endFill();
        
        toggleBtn.beginFill(0xffffff, 1);
        toggleBtn.drawCircle(24, 20, 13);
        toggleBtn.endFill();
      }
    };
    updateBtn();
    
    toggleBtn.interactive = true;
    toggleBtn.cursor = 'pointer';
    toggleBtn.on('pointerdown', () => {
      this.practiceConfig.showEarlyJudgeLine = !this.practiceConfig.showEarlyJudgeLine;
      updateBtn();
    });
    
    this.practicePanel.addChild(toggleBtn);
  }

  private createLoopSettings(startX: number, startY: number, width: number): void {
    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'left'
    });
    
    const label = new PIXI.Text('🔄 按小节循环练习', labelStyle);
    label.x = startX;
    label.y = startY;
    this.practicePanel.addChild(label);
    
    const descStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 11,
      fill: 0xaaaaaa,
      align: 'left'
    });
    const desc = new PIXI.Text('开启后可在暂停菜单中选择循环的小节范围，反复练习难点段落', descStyle);
    desc.x = startX;
    desc.y = startY + 24;
    this.practicePanel.addChild(desc);
    
    const toggleBtn = new PIXI.Graphics();
    toggleBtn.x = startX + width - 100;
    toggleBtn.y = startY - 2;
    
    const updateBtn = () => {
      toggleBtn.clear();
      if (this.practiceConfig.loopEnabled) {
        toggleBtn.beginFill(0x3498db, 1);
        toggleBtn.lineStyle(2, 0xffd700, 0.8);
        toggleBtn.drawRoundedRect(0, 0, 100, 40, 20);
        toggleBtn.endFill();
        
        toggleBtn.beginFill(0xffffff, 1);
        toggleBtn.drawCircle(76, 20, 13);
        toggleBtn.endFill();
      } else {
        toggleBtn.beginFill(0x555566, 1);
        toggleBtn.lineStyle(2, 0x888899, 0.7);
        toggleBtn.drawRoundedRect(0, 0, 100, 40, 20);
        toggleBtn.endFill();
        
        toggleBtn.beginFill(0xffffff, 1);
        toggleBtn.drawCircle(24, 20, 13);
        toggleBtn.endFill();
      }
    };
    updateBtn();
    
    toggleBtn.interactive = true;
    toggleBtn.cursor = 'pointer';
    toggleBtn.on('pointerdown', () => {
      this.practiceConfig.loopEnabled = !this.practiceConfig.loopEnabled;
      updateBtn();
    });
    
    this.practicePanel.addChild(toggleBtn);
  }
}
