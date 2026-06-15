import * as PIXI from 'pixi.js';
import { RhythmJudge } from './modules/RhythmJudge';
import { ScoreSystem } from './modules/ScoreSystem';
import { EffectRenderer } from './modules/EffectRenderer';
import { ResultScreen } from './modules/ResultScreen';
import { StartScreen } from './modules/StartScreen';
import { ScoreStorage } from './modules/ScoreStorage';
import { LyricProgress } from './modules/LyricProgress';
import { InputConfigManager } from './modules/InputConfigManager';
import { BookResonance } from './modules/BookResonance';
import { ChapterUnlockManager } from './modules/ChapterUnlockManager';
import { StoryChapterSystem } from './modules/StoryChapterSystem';
import { SongLibrary } from './modules/SongLibrary';
import { ChapterMapView } from './modules/ChapterMapView';
import { PoemCollectionView } from './modules/PoemCollectionView';
import { EndingGallery } from './modules/EndingGallery';
import { FriendBattle } from './modules/FriendBattle';
import { SkinSystem } from './modules/SkinSystem';
import { ShopSystem } from './modules/ShopSystem';
import { SkinRenderer } from './modules/SkinRenderer';
import { ShopView } from './modules/ShopView';
import { SkinView } from './modules/SkinView';
import { getSongById, SongWithUnlock } from './data/songs';
import { ChartData, CharHitRecord, Difficulty, JudgeEvent, JudgeResult, LANE_COUNT, NoteData, NoteType, InputConfig, ResonanceState, PracticeConfig, DEFAULT_PRACTICE_CONFIG, BarInfo, PreloadedChart, SongChartEntry, ChartDifficultyConfig, StoryStateChangeEvent, SkinConfig } from './types';

interface NoteSprite {
  container: PIXI.Container;
  noteData: NoteData;
  noteId: number;
  noteType: NoteType;
}

interface PooledNoteSprite {
  container: PIXI.Container;
  inUse: boolean;
  lastUsedNoteType?: NoteType;
  lastUsedLane?: number;
}

type GameState = 'start' | 'playing' | 'paused' | 'result';

interface RuntimeChart {
  song: ChartData;
  chartEntry: SongChartEntry;
  difficulty: Difficulty;
  notes: NoteData[];
  noteSpeed: number;
  poemLines: string[];
  difficultyConfig: ChartDifficultyConfig;
}

type TouchGestureType = 'unknown' | 'tap' | 'hold' | 'swipe';

interface TouchInfo {
  pointerId: number;
  startLane: number;
  currentLane: number;
  startX: number;
  currentX: number;
  startY: number;
  startTime: number;
  gestureType: TouchGestureType;
  isGestureDetermined: boolean;
  holdTimer?: number;
  inputTriggered: boolean;
}

export class Game {
  private app: PIXI.Application;
  private container: HTMLElement;
  private gameState: GameState = 'start';
  
  private currentChart?: RuntimeChart;
  
  private rhythmJudge: RhythmJudge;
  private scoreSystem: ScoreSystem;
  private effectRenderer: EffectRenderer;
  private skinRenderer: SkinRenderer;
  private resultScreen: ResultScreen;
  private startScreen: StartScreen;
  private lyricProgress: LyricProgress;
  private bookResonance: BookResonance;
  private resonanceDisplay?: PIXI.Container;
  private removeResonanceListener?: () => void;
  private removeSkinListener?: () => void;
  
  private chapterMapView: ChapterMapView;
  private poemCollectionView: PoemCollectionView;
  private endingGallery: EndingGallery;
  private shopView: ShopView;
  private skinView: SkinView;
  
  private gameContainer: PIXI.Container;
  private noteSprites: Map<number, NoteSprite> = new Map();
  private noteLayer: PIXI.Container;
  private uiLayer: PIXI.Container;
  
  private startTime: number = 0;
  private currentTime: number = 0;
  private pausedTime: number = 0;
  private pauseStartTime: number = 0;
  private charRecords: CharHitRecord[] = [];
  private judgeEventRecords: JudgeEvent[] = [];
  private activeChallengeId?: string;
  private gameEndTimer?: number;
  
  private pauseMenu?: PIXI.Container;
  private pauseButton?: PIXI.Container;
  
  private comboDisplay: PIXI.Text;
  private scoreDisplay: PIXI.Text;
  private songInfoDisplay?: PIXI.Container;
  private laneWidth: number;
  private judgeLineY: number = 600;
  
  private keyMap: Record<string, number>;
  private laneHintTexts: PIXI.Text[] = [];
  private swipeThreshold: number;
  private holdThreshold: number;
  private gestureEnabled: Record<string, boolean> = {};
  
  private pressedKeys: Set<number> = new Set();
  private laneTouchAreas: PIXI.Graphics[] = [];
  private activeTouches: Map<number, TouchInfo> = new Map();
  
  private inputConfigManager: InputConfigManager;
  private songLibrary: SongLibrary;
  private storyChapterSystem: StoryChapterSystem;
  private removeConfigListener?: () => void;

  private practiceConfig: PracticeConfig = { ...DEFAULT_PRACTICE_CONFIG };
  private earlyJudgeLine?: PIXI.Graphics;
  private barBoundaries: PIXI.Container[] = [];
  private loopIndicators: PIXI.Graphics[] = [];
  private practiceModeIndicator?: PIXI.Container;
  private practiceSpeedDisplay?: PIXI.Text;

  private preloadedCharts: Map<string, PreloadedChart> = new Map();
  private noteSpritePool: PooledNoteSprite[] = [];
  private readonly MAX_POOL_SIZE = 200;
  private readonly PRELOAD_KEY = (songId: string, diff: Difficulty) => `${songId}_${diff}`;

  constructor(container: HTMLElement) {
    this.container = container;
    
    this.inputConfigManager = InputConfigManager.getInstance();
    this.songLibrary = SongLibrary.getInstance();
    this.storyChapterSystem = StoryChapterSystem.getInstance();
    this.keyMap = this.inputConfigManager.getKeyMap();
    this.swipeThreshold = this.inputConfigManager.getSwipeThreshold();
    this.holdThreshold = this.inputConfigManager.getHoldThreshold();
    this.updateGestureEnabled();
    
    const width = Math.min(window.innerWidth, 720);
    const height = Math.min(window.innerHeight, 1080);
    this.laneWidth = width / LANE_COUNT;
    
    this.app = new PIXI.Application({
      width,
      height,
      backgroundColor: 0x0a0a1a,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });
    
    this.container.appendChild(this.app.view as HTMLCanvasElement);
    
    const testChartData = localStorage.getItem('active_test_chart');
    let defaultChartEntry = this.songLibrary.getSong('love-poem')!;
    let defaultSong = getSongById('love-poem')!;
    let defaultNotes = this.songLibrary.getNotesForDifficulty(defaultChartEntry, 'normal');
    let defaultDifficultyConfig = defaultChartEntry.difficultyConfigs.normal;
    
    if (testChartData) {
      try {
        const testChart = JSON.parse(testChartData) as ChartData;
        this.songLibrary.registerSong({
          metadata: {
            id: testChart.id,
            title: testChart.title,
            artist: testChart.artist,
            bpm: testChart.bpm,
            lyrics: testChart.lyrics,
            poemLines: testChart.poemLines,
            genre: '自定义',
            tags: ['编辑器测试'],
            description: '从谱面编辑器导入的测试谱面',
            duration: 0
          },
          difficulties: testChart.difficulties,
          difficultyOverrides: {
            easy: { ...testChart.difficultyConfigs.easy, noteCount: (testChart.difficulties.easy || []).length, maxCombo: (testChart.difficulties.easy || []).length },
            normal: { ...testChart.difficultyConfigs.normal, noteCount: (testChart.difficulties.normal || []).length, maxCombo: (testChart.difficulties.normal || []).length },
            hard: { ...testChart.difficultyConfigs.hard, noteCount: (testChart.difficulties.hard || []).length, maxCombo: (testChart.difficulties.hard || []).length }
          },
          unlockCondition: null,
          prerequisiteSongId: null,
          coverThemeIndex: 0
        });
        
        defaultChartEntry = this.songLibrary.getSong(testChart.id)!;
        defaultSong = {
          ...testChart,
          unlockCondition: null,
          prerequisiteSongId: null
        };
        defaultNotes = defaultChartEntry.difficulties.normal || [];
        defaultDifficultyConfig = defaultChartEntry.difficultyConfigs.normal;
        
        console.log('已加载测试谱面:', testChart.title);
        localStorage.removeItem('active_test_chart');
        localStorage.removeItem('editor_test_chart');
      } catch (err) {
        console.error('加载测试谱面失败:', err);
        localStorage.removeItem('active_test_chart');
        localStorage.removeItem('editor_test_chart');
      }
    }
    
    this.currentChart = {
      song: defaultSong,
      chartEntry: defaultChartEntry,
      difficulty: 'normal',
      notes: defaultNotes,
      noteSpeed: defaultDifficultyConfig.noteSpeed,
      poemLines: defaultChartEntry.metadata.poemLines,
      difficultyConfig: defaultDifficultyConfig
    };
    
    this.rhythmJudge = new RhythmJudge(
      defaultDifficultyConfig.noteSpeed,
      this.judgeLineY,
      defaultDifficultyConfig.judgeTiming
    );
    this.scoreSystem = new ScoreSystem(defaultNotes.length);
    this.bookResonance = new BookResonance();
    
    SkinSystem.initialize();
    ShopSystem.initialize();
    
    this.skinRenderer = new SkinRenderer(this.app);
    this.effectRenderer = new EffectRenderer(this.app, this.skinRenderer);
    this.resultScreen = new ResultScreen(this.app, this.skinRenderer);
    this.startScreen = new StartScreen(this.app);
    this.lyricProgress = new LyricProgress(this.app);
    this.chapterMapView = new ChapterMapView(this.app);
    this.poemCollectionView = new PoemCollectionView(this.app);
    this.endingGallery = new EndingGallery(this.app);
    this.shopView = new ShopView(this.app);
    this.skinView = new SkinView(this.app);
    
    this.gameContainer = new PIXI.Container();
    this.noteLayer = new PIXI.Container();
    this.uiLayer = new PIXI.Container();
    
    this.app.stage.addChild(this.gameContainer);
    this.gameContainer.addChild(this.noteLayer);
    this.gameContainer.addChild(this.uiLayer);
    
    this.comboDisplay = this.effectRenderer.createComboDisplay();
    this.uiLayer.addChild(this.comboDisplay);
    
    this.scoreDisplay = this.createScoreDisplay();
    this.uiLayer.addChild(this.scoreDisplay);
    
    this.setupInput();
    this.setupUI();
    this.setupCallbacks();
    this.setupConfigListener();
    
    this.app.ticker.add(this.update.bind(this));
    
    this.preloadChart('love-poem', 'normal');
    this.preloadAdjacentCharts('love-poem', 'normal');
    const allDifficulties: Difficulty[] = ['easy', 'normal', 'hard'];
    allDifficulties.forEach(d => {
      if (d !== 'normal') {
        this.preloadChart('love-poem', d);
      }
    });
    
    this.showStartScreen();
  }

  private setupUI(): void {
    const bg = this.effectRenderer.createBackground();
    this.gameContainer.addChildAt(bg, 0);
    
    this.effectRenderer.initAtmosphere(this.gameContainer);
    this.effectRenderer.initResonanceEffect(this.gameContainer);
    
    const laneBg = this.effectRenderer.createLaneBackground(LANE_COUNT);
    this.gameContainer.addChildAt(laneBg, 1);
    
    const judgeLine = this.effectRenderer.createJudgeLine(this.judgeLineY);
    this.gameContainer.addChildAt(judgeLine, 2);

    this.earlyJudgeLine = this.effectRenderer.createEarlyJudgeLine(this.judgeLineY, 150);
    this.gameContainer.addChildAt(this.earlyJudgeLine, 3);
    
    this.createLaneTouchAreas();
    this.createLaneHints();
    this.createPauseButton();
    this.createPauseMenu();
    this.createResonanceDisplay();
    this.createPracticeModeIndicator();
  }

  private createSongInfoOverlay(): void {
    if (this.songInfoDisplay) {
      this.uiLayer.removeChild(this.songInfoDisplay);
      this.songInfoDisplay.destroy();
    }
    
    if (!this.currentChart) return;
    
    this.songInfoDisplay = new PIXI.Container();
    
    const { chartEntry, difficultyConfig } = this.currentChart;
    const infoText = `${chartEntry.metadata.title}  |  BPM: ${chartEntry.metadata.bpm}  |  ${difficultyConfig.label}`;
    const style = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fill: 0xaaaaaa,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'left'
    });
    
    const text = new PIXI.Text(infoText, style);
    text.anchor.set(0, 0);
    text.x = 20;
    text.y = 20;
    this.songInfoDisplay.addChild(text);
    
    this.uiLayer.addChild(this.songInfoDisplay);
  }

  private createLaneTouchAreas(): void {
    const laneHeight = this.app.screen.height;
    
    for (let i = 0; i < LANE_COUNT; i++) {
      const area = new PIXI.Graphics();
      area.beginFill(0xffffff, 0);
      area.drawRect(i * this.laneWidth, 0, this.laneWidth, laneHeight);
      area.endFill();
      area.interactive = true;
      
      area.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        if (this.gameState === 'playing') {
          const tapEnabled = this.isGestureEnabled('tap', i);
          const holdEnabled = this.isGestureEnabled('hold');
          const swipeEnabled = this.isGestureEnabled('swipe');
          
          if (!tapEnabled && !holdEnabled && !swipeEnabled) {
            return;
          }
          
          const now = performance.now();
          const touchInfo: TouchInfo = {
            pointerId: e.pointerId,
            startLane: i,
            currentLane: i,
            startX: e.global.x,
            currentX: e.global.x,
            startY: e.global.y,
            startTime: now,
            gestureType: 'unknown',
            isGestureDetermined: false,
            inputTriggered: false
          };
          
          if (holdEnabled) {
            touchInfo.holdTimer = window.setTimeout(() => {
              if (!touchInfo.isGestureDetermined && this.activeTouches.has(e.pointerId)) {
                touchInfo.gestureType = 'hold';
                touchInfo.isGestureDetermined = true;
                touchInfo.inputTriggered = true;
                this.handleInput(i, true);
              }
            }, this.holdThreshold);
          }
          
          this.activeTouches.set(e.pointerId, touchInfo);
        }
      });
      
      area.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
        if (this.gameState !== 'playing') return;
        const touch = this.activeTouches.get(e.pointerId);
        if (!touch) return;
        
        touch.currentX = e.global.x;
        const deltaX = e.global.x - touch.startX;
        const absDeltaX = Math.abs(deltaX);
        
        if (!touch.isGestureDetermined) {
          const direction = deltaX > 0 ? 'right' : 'left';
          const swipeDirectionEnabled = this.isGestureEnabled('swipe', touch.startLane, direction);
          
          if (absDeltaX >= this.swipeThreshold && swipeDirectionEnabled) {
            touch.isGestureDetermined = true;
            touch.gestureType = 'swipe';
            
            if (touch.holdTimer !== undefined) {
              clearTimeout(touch.holdTimer);
              touch.holdTimer = undefined;
            }
            
            const slideNote = this.rhythmJudge.getActiveNotes().find(n => 
              n.type === 'slide' && 
              n.lane === touch.startLane &&
              n.slideStartTime === undefined &&
              !n.isJudged
            );
            
            if (slideNote) {
              touch.inputTriggered = true;
              this.handleInput(touch.startLane, true);
            }
          }
        }
        
        const newLane = Math.floor(e.global.x / this.laneWidth);
        if (newLane >= 0 && newLane < LANE_COUNT && newLane !== touch.currentLane) {
          if (touch.gestureType === 'swipe' || touch.isGestureDetermined) {
            const slideEvent = this.rhythmJudge.handleSlideMove(touch.currentLane, newLane);
            if (slideEvent) {
              this.processJudgeEvent(slideEvent);
              this.effectRenderer.addSlideTrail(
                touch.currentLane * this.laneWidth + this.laneWidth / 2,
                newLane * this.laneWidth + this.laneWidth / 2,
                this.judgeLineY,
                touch.currentLane
              );
            }
          }
          touch.currentLane = newLane;
        }
      });
      
      area.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
        this.handleTouchEnd(e.pointerId);
      });
      
      area.on('pointerout', (e: PIXI.FederatedPointerEvent) => {
        this.handleTouchEnd(e.pointerId);
      });
      
      this.laneTouchAreas.push(area);
      this.gameContainer.addChild(area);
    }
  }

  private handleTouchEnd(pointerId: number): void {
    if (this.gameState !== 'playing') return;
    
    const touch = this.activeTouches.get(pointerId);
    if (!touch) return;
    
    if (touch.holdTimer !== undefined) {
      clearTimeout(touch.holdTimer);
      touch.holdTimer = undefined;
    }
    
    const tapEnabled = this.isGestureEnabled('tap', touch.currentLane);
    if (!touch.isGestureDetermined && tapEnabled) {
      touch.gestureType = 'tap';
      touch.isGestureDetermined = true;
      touch.inputTriggered = true;
      this.handleInput(touch.currentLane, true);
      setTimeout(() => {
        if (this.activeTouches.has(pointerId)) {
          this.handleInput(touch.currentLane, false);
          this.activeTouches.delete(pointerId);
        }
      }, 10);
      return;
    }
    
    if (touch.inputTriggered) {
      this.handleInput(touch.currentLane, false);
    }
    
    this.activeTouches.delete(pointerId);
  }

  private createLaneHints(): void {
    const hintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    
    const hintY = this.judgeLineY + 80;
    
    this.laneHintTexts = [];
    for (let i = 0; i < LANE_COUNT; i++) {
      const key = this.inputConfigManager.getKeyDisplayForLane(i);
      const keyHint = new PIXI.Text(key, hintStyle);
      keyHint.anchor.set(0.5);
      keyHint.x = i * this.laneWidth + this.laneWidth / 2;
      keyHint.y = hintY;
      keyHint.alpha = 0.5;
      this.uiLayer.addChild(keyHint);
      this.laneHintTexts.push(keyHint);
    }

    const legendStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'center'
    });
    
    const legendTexts = [
      { text: '■ 点击', color: 0x6b9dff },
      { text: '■ 长按', color: 0x9b59b6 },
      { text: '■ 滑键', color: 0xe74c3c }
    ];
    
    legendTexts.forEach((legend, i) => {
      const style = new PIXI.TextStyle({ ...legendStyle, fill: legend.color });
      const text = new PIXI.Text(legend.text, style);
      text.anchor.set(0, 0.5);
      text.x = 10 + i * 75;
      text.y = this.app.screen.height - 20;
      this.uiLayer.addChild(text);
    });
  }

  private updateLaneHints(): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const hint = this.laneHintTexts[i];
      if (hint) {
        hint.text = this.inputConfigManager.getKeyDisplayForLane(i);
      }
    }
  }

  private setupConfigListener(): void {
    this.removeConfigListener = this.inputConfigManager.addChangeListener((config: InputConfig) => {
      this.keyMap = { ...config.keyMap };
      this.swipeThreshold = config.swipeThreshold;
      this.holdThreshold = config.holdThreshold;
      this.updateGestureEnabled();
      this.updateLaneHints();
    });
  }

  private updateGestureEnabled(): void {
    this.gestureEnabled = {};
    const gestures = this.inputConfigManager.getGestures();
    gestures.forEach(g => {
      let key = g.gesture;
      if (g.lane >= 0) {
        key += '_lane' + g.lane;
      }
      if (g.direction) {
        key += '_' + g.direction;
      }
      this.gestureEnabled[key] = g.enabled;
    });
  }

  private isGestureEnabled(gesture: string, lane?: number, direction?: string): boolean {
    if (gesture === 'tap' && lane !== undefined && lane >= 0) {
      return this.inputConfigManager.isTapEnabledForLane(lane);
    }
    if (gesture === 'swipe' && direction) {
      return this.inputConfigManager.isSwipeEnabled(direction as any);
    }
    if (gesture === 'swipe' && !direction) {
      return this.inputConfigManager.isAnySwipeEnabled();
    }
    if (gesture === 'hold') {
      return this.inputConfigManager.isHoldEnabled();
    }
    return this.inputConfigManager.isGestureEnabled(gesture as any, lane, direction as any);
  }

  private createPauseButton(): void {
    const buttonContainer = new PIXI.Container();
    
    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0xffffff, 0.2);
    buttonBg.drawRoundedRect(0, 0, 44, 44, 8);
    buttonBg.endFill();
    buttonBg.interactive = true;
    buttonBg.cursor = 'pointer';
    
    buttonBg.on('pointerdown', () => {
      if (this.gameState === 'playing') {
        this.pauseGame();
      }
    });
    
    buttonContainer.addChild(buttonBg);
    
    const pauseIcon = new PIXI.Graphics();
    pauseIcon.beginFill(0xffffff, 0.9);
    pauseIcon.drawRect(14, 12, 5, 20);
    pauseIcon.drawRect(25, 12, 5, 20);
    pauseIcon.endFill();
    buttonContainer.addChild(pauseIcon);
    
    buttonContainer.x = this.app.screen.width - 64;
    buttonContainer.y = 60;
    
    this.pauseButton = buttonContainer;
    this.uiLayer.addChild(buttonContainer);
  }

  private createPracticeModeIndicator(): void {
    const container = new PIXI.Container();
    container.x = this.app.screen.width / 2;
    container.y = 46;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xff6b9d, 0.85);
    bg.lineStyle(2, 0xffd700, 0.6);
    bg.drawRoundedRect(-90, -20, 180, 40, 10);
    bg.endFill();
    container.addChild(bg);

    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    const label = new PIXI.Text('🎯 练习模式', labelStyle);
    label.anchor.set(0.5);
    container.addChild(label);

    const speedStyle = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffd700,
      align: 'center'
    });
    const speedText = new PIXI.Text('1.0x', speedStyle);
    speedText.anchor.set(0.5);
    speedText.y = 28;
    container.addChild(speedText);
    this.practiceSpeedDisplay = speedText;

    container.visible = false;
    this.practiceModeIndicator = container;
    this.uiLayer.addChild(container);
  }

  private updatePracticeModeIndicator(): void {
    if (!this.practiceModeIndicator || !this.practiceSpeedDisplay) return;
    
    this.practiceModeIndicator.visible = this.practiceConfig.enabled;
    if (this.practiceConfig.enabled) {
      this.practiceSpeedDisplay.text = `${this.practiceConfig.speedMultiplier.toFixed(2)}x`;
    }
  }

  private clearBarBoundaries(): void {
    this.barBoundaries.forEach(b => {
      this.gameContainer.removeChild(b);
      b.destroy();
    });
    this.barBoundaries = [];
  }

  private clearLoopIndicators(): void {
    this.loopIndicators.forEach(i => {
      this.gameContainer.removeChild(i);
      i.destroy();
    });
    this.loopIndicators = [];
  }

  private updateBarBoundaries(bars: BarInfo[]): void {
    this.clearBarBoundaries();
    if (bars.length === 0 || !this.practiceConfig.enabled) return;

    const noteSpeed = this.currentChart?.noteSpeed || 400;
    bars.forEach((bar, index) => {
      const timeUntilStart = bar.startTime - this.currentTime;
      const timeUntilEnd = bar.endTime - this.currentTime;
      const startY = this.judgeLineY - (timeUntilStart / 1000) * noteSpeed;
      const endY = this.judgeLineY - (timeUntilEnd / 1000) * noteSpeed;
      
      if (endY > -100 && startY < this.app.screen.height + 100) {
        const boundary = this.effectRenderer.createBarBoundary(
          Math.max(0, startY),
          Math.min(this.app.screen.height, endY),
          index
        );
        boundary.alpha = 0.4;
        this.gameContainer.addChildAt(boundary, 3);
        this.barBoundaries.push(boundary);
      }
    });
  }

  private updateLoopIndicators(): void {
    this.clearLoopIndicators();
    if (!this.practiceConfig.loopEnabled) return;

    const loopInfo = this.rhythmJudge.getLoopInfo();
    if (loopInfo.startTime < 0 || loopInfo.endTime < 0) return;

    const noteSpeed = this.currentChart?.noteSpeed || 400;
    const timeUntilStart = loopInfo.startTime - this.currentTime;
    const timeUntilEnd = loopInfo.endTime - this.currentTime;
    const startY = this.judgeLineY - (timeUntilStart / 1000) * noteSpeed;
    const endY = this.judgeLineY - (timeUntilEnd / 1000) * noteSpeed;

    if (startY > -50 && startY < this.app.screen.height + 50) {
      const startIndicator = this.effectRenderer.createLoopIndicator(startY, endY, true);
      this.gameContainer.addChildAt(startIndicator, 5);
      this.loopIndicators.push(startIndicator);
    }
    if (endY > -50 && endY < this.app.screen.height + 50) {
      const endIndicator = this.effectRenderer.createLoopIndicator(startY, endY, false);
      this.gameContainer.addChildAt(endIndicator, 5);
      this.loopIndicators.push(endIndicator);
    }
  }

  public setPracticeConfig(config: Partial<PracticeConfig>): void {
    this.practiceConfig = { ...this.practiceConfig, ...config };
    this.applyPracticeConfig();
  }

  private applyPracticeConfig(): void {
    if (this.practiceConfig.enabled) {
      this.rhythmJudge.setSpeedMultiplier(this.practiceConfig.speedMultiplier);
      this.rhythmJudge.setLoopEnabled(this.practiceConfig.loopEnabled);
      if (this.practiceConfig.loopEnabled) {
        this.rhythmJudge.setLoopBars(this.practiceConfig.loopStartBar, this.practiceConfig.loopEndBar);
      }
      if (this.earlyJudgeLine) {
        const offset = (this.practiceConfig.earlyJudgeOffset / 1000) * (this.currentChart?.noteSpeed || 400);
        this.earlyJudgeLine.y = -offset;
        this.earlyJudgeLine.visible = this.practiceConfig.showEarlyJudgeLine;
      }
    } else {
      this.rhythmJudge.setSpeedMultiplier(1.0);
      this.rhythmJudge.setLoopEnabled(false);
      if (this.earlyJudgeLine) {
        this.earlyJudgeLine.visible = false;
      }
      this.clearBarBoundaries();
      this.clearLoopIndicators();
    }
    this.updatePracticeModeIndicator();
  }

  private createPauseMenu(): void {
    const menuContainer = new PIXI.Container();
    menuContainer.visible = false;
    
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.75);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    menuContainer.addChild(mask);
    
    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 48,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 4,
      align: 'center'
    });
    
    const title = new PIXI.Text('游戏暂停', titleStyle);
    title.anchor.set(0.5);
    title.x = this.app.screen.width / 2;
    title.y = this.app.screen.height / 2 - 120;
    menuContainer.addChild(title);
    
    const hintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fill: 0xaaaaaa,
      align: 'center'
    });
    
    const hint = new PIXI.Text('按 ESC 或 空格 继续游戏', hintStyle);
    hint.anchor.set(0.5);
    hint.x = this.app.screen.width / 2;
    hint.y = this.app.screen.height / 2 - 60;
    menuContainer.addChild(hint);
    
    const practiceSettings = this.createPracticePauseSettings();
    practiceSettings.y = this.app.screen.height / 2 - 160;
    menuContainer.addChild(practiceSettings);

    const baseOffset = this.practiceConfig.enabled ? 30 : 0;
    const buttonConfigs = [
      { label: '继续游戏', y: this.app.screen.height / 2 + baseOffset, color: 0x6b9dff, action: () => this.resumeGame() },
      { label: '重新开始', y: this.app.screen.height / 2 + 80 + baseOffset, color: 0xffd700, action: () => this.restartFromPause() },
      { label: '返回主菜单', y: this.app.screen.height / 2 + 160 + baseOffset, color: 0xff6b6b, action: () => this.backToStartFromPause() }
    ];
    
    buttonConfigs.forEach(config => {
      const button = this.createPauseButtonItem(config.label, config.color, config.action);
      button.y = config.y;
      menuContainer.addChild(button);
    });
    
    this.pauseMenu = menuContainer;
    this.uiLayer.addChild(menuContainer);
  }

  private createPracticePauseSettings(): PIXI.Container {
    const container = new PIXI.Container();
    container.x = this.app.screen.width / 2;

    if (!this.practiceConfig.enabled) {
      return container;
    }

    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0x1a1a3a, 0.9);
    panelBg.lineStyle(2, 0xff6b9d, 0.5);
    panelBg.drawRoundedRect(-220, -5, 440, 160, 12);
    panelBg.endFill();
    container.addChild(panelBg);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xffd700,
      align: 'center'
    });
    const title = new PIXI.Text('⚙ 练习设置 (暂停中可调节)', titleStyle);
    title.anchor.set(0.5);
    title.y = 15;
    container.addChild(title);

    const speedLabelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: 0xcccccc,
      align: 'left'
    });
    const speedLabel = new PIXI.Text('速度调节:', speedLabelStyle);
    speedLabel.anchor.set(0, 0.5);
    speedLabel.x = -200;
    speedLabel.y = 50;
    container.addChild(speedLabel);

    const speedButtons = [
      { label: '0.5x', value: 0.5, x: -100 },
      { label: '0.75x', value: 0.75, x: -30 },
      { label: '1.0x', value: 1.0, x: 40 },
      { label: '1.25x', value: 1.25, x: 110 },
      { label: '1.5x', value: 1.5, x: 180 }
    ];

    speedButtons.forEach(btn => {
      const btnContainer = new PIXI.Container();
      btnContainer.x = btn.x;
      btnContainer.y = 50;

      const isActive = Math.abs(this.practiceConfig.speedMultiplier - btn.value) < 0.01;
      const bg = new PIXI.Graphics();
      bg.beginFill(isActive ? 0xffd700 : 0x333355, isActive ? 1 : 0.8);
      bg.lineStyle(1, isActive ? 0xffffff : 0x555577, 0.6);
      bg.drawRoundedRect(-28, -16, 56, 32, 6);
      bg.endFill();
      bg.interactive = true;
      bg.cursor = 'pointer';
      bg.on('pointerdown', () => {
        this.practiceConfig.speedMultiplier = btn.value;
        this.applyPracticeConfig();
        this.refreshPauseMenu();
      });
      btnContainer.addChild(bg);

      const btnStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: isActive ? 0x000000 : 0xffffff,
        align: 'center'
      });
      const btnText = new PIXI.Text(btn.label, btnStyle);
      btnText.anchor.set(0.5);
      btnContainer.addChild(btnText);

      container.addChild(btnContainer);
    });

    const judgeLineLabel = new PIXI.Text('提前判定线:', speedLabelStyle);
    judgeLineLabel.anchor.set(0, 0.5);
    judgeLineLabel.x = -200;
    judgeLineLabel.y = 95;
    container.addChild(judgeLineLabel);

    const judgeToggleContainer = new PIXI.Container();
    judgeToggleContainer.x = -80;
    judgeToggleContainer.y = 95;
    const toggleBg = new PIXI.Graphics();
    const judgeActive = this.practiceConfig.showEarlyJudgeLine;
    toggleBg.beginFill(judgeActive ? 0x2ecc71 : 0x555555, 0.9);
    toggleBg.lineStyle(1, judgeActive ? 0xffffff : 0x777777, 0.6);
    toggleBg.drawRoundedRect(-50, -16, 100, 32, 6);
    toggleBg.endFill();
    toggleBg.interactive = true;
    toggleBg.cursor = 'pointer';
    toggleBg.on('pointerdown', () => {
      this.practiceConfig.showEarlyJudgeLine = !this.practiceConfig.showEarlyJudgeLine;
      this.applyPracticeConfig();
      this.refreshPauseMenu();
    });
    judgeToggleContainer.addChild(toggleBg);
    const toggleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    const toggleText = new PIXI.Text(judgeActive ? '✓ 显示中' : '未显示', toggleStyle);
    toggleText.anchor.set(0.5);
    judgeToggleContainer.addChild(toggleText);
    container.addChild(judgeToggleContainer);

    const loopLabel = new PIXI.Text('小节循环:', speedLabelStyle);
    loopLabel.anchor.set(0, 0.5);
    loopLabel.x = 40;
    loopLabel.y = 95;
    container.addChild(loopLabel);

    const loopToggleContainer = new PIXI.Container();
    loopToggleContainer.x = 130;
    loopToggleContainer.y = 95;
    const loopBg = new PIXI.Graphics();
    const loopActive = this.practiceConfig.loopEnabled;
    loopBg.beginFill(loopActive ? 0x9b59b6 : 0x555555, 0.9);
    loopBg.lineStyle(1, loopActive ? 0xffffff : 0x777777, 0.6);
    loopBg.drawRoundedRect(-50, -16, 100, 32, 6);
    loopBg.endFill();
    loopBg.interactive = true;
    loopBg.cursor = 'pointer';
    loopBg.on('pointerdown', () => {
      this.practiceConfig.loopEnabled = !this.practiceConfig.loopEnabled;
      if (this.practiceConfig.loopEnabled) {
        const bars = this.rhythmJudge.getBars();
        if (bars.length > 0) {
          this.practiceConfig.loopStartBar = 0;
          this.practiceConfig.loopEndBar = Math.min(1, bars.length - 1);
        }
      }
      this.applyPracticeConfig();
      this.refreshPauseMenu();
    });
    loopToggleContainer.addChild(loopBg);
    const loopText = new PIXI.Text(loopActive ? `循环 ${this.practiceConfig.loopStartBar + 1}-${this.practiceConfig.loopEndBar + 1}` : '未启用', toggleStyle);
    loopText.anchor.set(0.5);
    loopToggleContainer.addChild(loopText);
    container.addChild(loopToggleContainer);

    const bars = this.rhythmJudge.getBars();
    if (loopActive && bars.length > 0) {
      const barHintStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 11,
        fill: 0x88ccff,
        align: 'center'
      });
      const barHint = new PIXI.Text(`(共 ${bars.length} 小节，可在开始界面调整循环范围)`, barHintStyle);
      barHint.anchor.set(0.5);
      barHint.y = 130;
      container.addChild(barHint);
    }

    return container;
  }

  private refreshPauseMenu(): void {
    if (this.gameState === 'paused') {
      const wasVisible = this.pauseMenu?.visible;
      if (this.pauseMenu) {
        this.uiLayer.removeChild(this.pauseMenu);
        this.pauseMenu.destroy();
      }
      this.createPauseMenu();
      if (wasVisible && this.pauseMenu) {
        this.pauseMenu.visible = true;
      }
    }
  }

  private createPauseButtonItem(label: string, color: number, onClick: () => void): PIXI.Container {
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = this.app.screen.width / 2;
    
    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(color);
    buttonBg.drawRoundedRect(-100, -28, 200, 56, 12);
    buttonBg.endFill();
    buttonBg.interactive = true;
    buttonBg.cursor = 'pointer';
    
    buttonBg.on('pointerdown', onClick);
    
    buttonContainer.addChild(buttonBg);
    
    const buttonStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    
    const buttonText = new PIXI.Text(label, buttonStyle);
    buttonText.anchor.set(0.5);
    buttonContainer.addChild(buttonText);
    
    return buttonContainer;
  }

  private createResonanceDisplay(): void {
    const container = new PIXI.Container();
    container.x = 20;
    container.y = 60;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.5);
    bg.drawRoundedRect(0, 0, 160, 36, 8);
    bg.endFill();
    bg.lineStyle(1, 0xffd700, 0.3);
    bg.drawRoundedRect(0, 0, 160, 36, 8);
    container.addChild(bg);

    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xaaaaaa,
      align: 'left'
    });
    const label = new PIXI.Text('书页共鸣', labelStyle);
    label.x = 10;
    label.y = 6;
    container.addChild(label);

    const levelText = new PIXI.Text('Lv.0', new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xffd700,
      align: 'right'
    }));
    levelText.anchor.set(1, 0);
    levelText.x = 150;
    levelText.y = 5;
    levelText.name = 'levelText';
    container.addChild(levelText);

    const progressBg = new PIXI.Graphics();
    progressBg.beginFill(0x333333, 0.8);
    progressBg.drawRoundedRect(10, 24, 140, 8, 4);
    progressBg.endFill();
    container.addChild(progressBg);

    const progressBar = new PIXI.Graphics();
    progressBar.name = 'progressBar';
    container.addChild(progressBar);

    const multiplierText = new PIXI.Text('x1.0', new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: 0x88ccff,
      align: 'right'
    }));
    multiplierText.anchor.set(1, 0);
    multiplierText.x = 150;
    multiplierText.y = -14;
    multiplierText.name = 'multiplierText';
    container.addChild(multiplierText);

    container.alpha = 0.6;
    this.resonanceDisplay = container;
    this.uiLayer.addChild(container);
  }

  private updateResonanceDisplay(state: ResonanceState): void {
    if (!this.resonanceDisplay) return;

    const levelText = this.resonanceDisplay.getChildByName('levelText') as PIXI.Text;
    const progressBar = this.resonanceDisplay.getChildByName('progressBar') as PIXI.Graphics;
    const multiplierText = this.resonanceDisplay.getChildByName('multiplierText') as PIXI.Text;

    if (levelText) {
      levelText.text = `Lv.${state.level}`;
      levelText.style.fill = state.level > 0 ? 0xffd700 : 0x666666;
    }

    if (progressBar) {
      progressBar.clear();
      const progressWidth = 140 * state.progress;
      if (progressWidth > 0) {
        const color = state.level >= 4 ? 0xff6b9d : state.level >= 2 ? 0xffd700 : 0x6b9dff;
        progressBar.beginFill(color, state.level > 0 ? 0.9 : 0.3);
        progressBar.drawRoundedRect(10, 24, progressWidth, 8, 4);
        progressBar.endFill();
      }
    }

    if (multiplierText) {
      multiplierText.text = `x${state.scoreMultiplier.toFixed(1)}`;
      multiplierText.style.fill = state.level > 0 ? 0xffd700 : 0x666666;
    }

    this.resonanceDisplay.alpha = state.isActive ? 0.95 : 0.5;
  }

  private createScoreDisplay(): PIXI.Text {
    const style = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'right'
    });
    
    const text = new PIXI.Text('0', style);
    text.anchor.set(1, 0);
    text.x = this.app.screen.width - 20;
    text.y = 20;
    
    return text;
  }

  private setupInput(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (this.gameState === 'playing') {
          this.pauseGame();
        } else if (this.gameState === 'paused') {
          this.resumeGame();
        }
        return;
      }
      
      if (this.gameState !== 'playing') return;
      
      const lane = this.keyMap[e.key];
      if (lane !== undefined) {
        e.preventDefault();
        if (!this.pressedKeys.has(lane)) {
          this.pressedKeys.add(lane);
          this.handleInput(lane, true);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.gameState !== 'playing') return;
      
      const lane = this.keyMap[e.key];
      if (lane !== undefined) {
        e.preventDefault();
        if (this.pressedKeys.has(lane)) {
          this.pressedKeys.delete(lane);
          this.handleInput(lane, false);
        }
      }
    });
  }

  private handleInput(lane: number, isPress: boolean): void {
    if (this.gameState !== 'playing') return;
    
    const isSlideStartPress = isPress && this.hasUnstartedSlideNoteOnLane(lane);
    
    const judgeEvent = this.rhythmJudge.handleInput(lane, isPress);
    
    if (isPress) {
      const holdNote = this.rhythmJudge.getActiveHoldNote(lane);
      if (holdNote) {
        const x = lane * this.laneWidth + this.laneWidth / 2;
        this.effectRenderer.spawnHoldEffect(x, this.judgeLineY, lane);
      }
      this.flashLane(lane);
    } else {
      this.effectRenderer.removeHoldEffect(lane);
    }
    
    if (judgeEvent) {
      if (judgeEvent.noteType === 'slide' && !isSlideStartPress) {
        const startLane = this.rhythmJudge.getNoteStartLane(judgeEvent.noteId);
        if (startLane !== undefined && startLane !== judgeEvent.lane) {
          const fromX = startLane * this.laneWidth + this.laneWidth / 2;
          const toX = judgeEvent.lane * this.laneWidth + this.laneWidth / 2;
          this.effectRenderer.addSlideTrail(fromX, toX, this.judgeLineY, startLane);
        }
      }
      this.processJudgeEvent(judgeEvent);
    }
  }

  private hasUnstartedSlideNoteOnLane(lane: number): boolean {
    const activeNotes = this.rhythmJudge.getActiveNotes();
    return activeNotes.some(n => 
      n.type === 'slide' && 
      n.lane === lane && 
      n.slideStartTime === undefined &&
      !n.isJudged
    );
  }

  private flashLane(lane: number): void {
    const flash = new PIXI.Graphics();
    flash.beginFill(0xffffff, 0.15);
    flash.drawRect(lane * this.laneWidth, 0, this.laneWidth, this.app.screen.height);
    flash.endFill();
    
    this.gameContainer.addChildAt(flash, 3);
    
    let life = 10;
    const animate = () => {
      life--;
      flash.alpha = life / 10;
      
      if (life <= 0) {
        this.gameContainer.removeChild(flash);
        flash.destroy();
      } else {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  private setupCallbacks(): void {
    this.startScreen.setOnStartCallback((songId: string, difficulty: Difficulty, config: PracticeConfig) => {
      this.setPracticeConfig(config);
      this.startGame(songId, difficulty);
    });

    this.startScreen.setOnPreloadCallback((songId: string, difficulty: Difficulty) => {
      this.preloadChart(songId, difficulty);
      this.preloadAdjacentCharts(songId, difficulty);
    });
    
    this.resultScreen.setOnRestartCallback(() => {
      this.restartGame();
    });

    this.resultScreen.setOnBackToStartCallback(() => {
      this.backToStartScreen();
    });

    this.lyricProgress.setOnLineCompleteCallback((lineIndex: number, totalLines: number) => {
      this.effectRenderer.setAtmosphereLevel(lineIndex, totalLines);
    });

    this.removeResonanceListener = this.bookResonance.addChangeListener((state: ResonanceState) => {
      this.scoreSystem.setScoreMultiplier(state.scoreMultiplier);
      this.effectRenderer.setResonanceIntensity(state.effectIntensity);
      this.updateResonanceDisplay(state);
    });

    this.startScreen.setOnShowChapterMapCallback(() => {
      this.hideAllScreens();
      this.chapterMapView.show();
    });

    this.startScreen.setOnShowPoemCollectionCallback(() => {
      this.hideAllScreens();
      this.poemCollectionView.show();
    });

    this.startScreen.setOnShowEndingGalleryCallback(() => {
      this.hideAllScreens();
      this.endingGallery.show();
    });

    this.startScreen.setOnShowShopCallback(() => {
      this.hideAllScreens();
      this.shopView.show();
    });

    this.startScreen.setOnShowSkinCallback(() => {
      this.hideAllScreens();
      this.skinView.show();
    });

    this.chapterMapView.setOnCloseCallback(() => {
      this.showStartScreen();
    });

    this.chapterMapView.setOnStartSongCallback((songId: string) => {
      this.startGame(songId, 'normal');
    });

    this.poemCollectionView.setOnCloseCallback(() => {
      this.showStartScreen();
    });

    this.endingGallery.setOnCloseCallback(() => {
      this.showStartScreen();
    });

    this.shopView.setOnCloseCallback(() => {
      this.showStartScreen();
    });

    this.skinView.setOnCloseCallback(() => {
      this.showStartScreen();
    });

    this.startScreen.setOnAcceptChallengeCallback((challengeId: string) => {
      const challenge = FriendBattle.getChallengeById(challengeId);
      if (!challenge) return;

      FriendBattle.acceptChallenge(challengeId);
      this.activeChallengeId = challengeId;
      this.startGame(challenge.songId, challenge.difficulty);
    });

    this.startScreen.setOnWatchReplayCallback((_challengeId: string, _playerId: string) => {
      // Replay viewing handled by FriendBattle.replayJudgeEvents()
    });

    FriendBattle.initialize();

    this.removeSkinListener = SkinSystem.addSkinChangeListener((config: SkinConfig) => {
      this.skinRenderer.updateConfig(config);
      this.refreshSkinRendering();
    });
  }

  private refreshSkinRendering(): void {
    this.effectRenderer.setUseSkinRendering(true);
    this.effectRenderer.refreshLyricFrame();
    
    if (this.gameState === 'playing' || this.gameState === 'paused') {
      this.setupUI();
      this.drainNoteSpritePool();
      
      const newComboDisplay = this.effectRenderer.createComboDisplay();
      newComboDisplay.x = this.comboDisplay.x;
      newComboDisplay.y = this.comboDisplay.y;
      this.uiLayer.removeChild(this.comboDisplay);
      this.comboDisplay.destroy();
      this.comboDisplay = newComboDisplay;
      this.uiLayer.addChild(this.comboDisplay);
    }
  }

  private hideAllScreens(): void {
    this.startScreen.hide();
    this.chapterMapView.hide();
    this.poemCollectionView.hide();
    this.endingGallery.hide();
    this.resultScreen.hide();
    this.shopView.hide();
    this.skinView.hide();
  }

  private showStartScreen(): void {
    this.hideAllScreens();
    this.gameState = 'start';
    this.startScreen.show();
  }

  private processJudgeEvent(event: JudgeEvent): void {
    this.bookResonance.onJudgeResult(event.result);
    this.scoreSystem.addJudgeResult(event.result, event.noteType);
    
    const x = event.lane * this.laneWidth + this.laneWidth / 2;
    this.effectRenderer.spawnHitEffect(x, this.judgeLineY, event.lane, event.result, event.noteType);
    
    if (event.noteType === 'hold') {
      this.effectRenderer.removeHoldEffect(event.lane);
    }
    
    const hit = event.result !== 'miss';
    this.charRecords.push({
      char: event.lyricChar,
      hit,
      result: event.result as JudgeResult,
      noteType: event.noteType
    });

    this.judgeEventRecords.push(event);

    this.lyricProgress.onNoteJudged(event.noteId, hit, event.result);
    
    this.updateUI();
  }

  private updateUI(): void {
    this.effectRenderer.updateComboDisplay(this.comboDisplay, this.scoreSystem.getCombo());
    this.scoreDisplay.text = this.scoreSystem.getScoreValue().toString();
  }

  private update(delta: number): void {
    if (this.gameState !== 'playing') return;
    
    this.currentTime = performance.now() - this.startTime - this.pausedTime;
    
    const missEvents = this.rhythmJudge.update(this.currentTime);
    missEvents.forEach(event => this.processJudgeEvent(event));
    
    this.bookResonance.update(delta);
    this.effectRenderer.update(delta);
    this.lyricProgress.update();
    
    this.updateNoteSprites();
    
    if (this.practiceConfig.enabled) {
      const bars = this.rhythmJudge.getBars();
      this.updateBarBoundaries(bars);
      this.updateLoopIndicators();
    }
    
    this.checkGameEnd();
  }

  private updateNoteSprites(): void {
    const activeNotes = this.rhythmJudge.getActiveNotes();
    
    const activeNoteIds = new Set(activeNotes.map(n => n.id));
    
    this.noteSprites.forEach((sprite, id) => {
      if (!activeNoteIds.has(id)) {
        this.releaseNoteSprite(sprite);
        this.noteSprites.delete(id);
      }
    });
    
    activeNotes.forEach(note => {
      if (!this.noteSprites.has(note.id)) {
        const noteContainer = this.acquireNoteSprite(
          note.lyricChar,
          note.lane,
          note.type,
          note.duration,
          this.currentChart?.noteSpeed || 400
        );
        this.noteLayer.addChild(noteContainer);
        this.noteSprites.set(note.id, {
          container: noteContainer,
          noteData: note,
          noteId: note.id,
          noteType: note.type
        });
      }
      
      const sprite = this.noteSprites.get(note.id);
      if (sprite) {
        if (note.type === 'slide' && note.slideStartTime !== undefined) {
          sprite.container.x = note.slideCurrentLane * this.laneWidth + this.laneWidth / 2;
        } else {
          sprite.container.x = note.lane * this.laneWidth + this.laneWidth / 2;
        }
        sprite.container.y = this.rhythmJudge.getNoteY(note);
      }
    });
  }

  private checkGameEnd(): void {
    if (this.gameEndTimer) return;
    if (this.rhythmJudge.isAllNotesJudged() && this.scoreSystem.isAllJudged()) {
      this.gameEndTimer = window.setTimeout(() => {
        this.gameEndTimer = undefined;
        this.endGame();
      }, 1000);
    }
  }

  private startGame(songId: string, difficulty: Difficulty): void {
    let preloaded = this.preloadedCharts.get(this.PRELOAD_KEY(songId, difficulty));
    
    if (!preloaded) {
      preloaded = this.preloadChart(songId, difficulty) || undefined;
    }
    
    if (!preloaded) return;
    
    const chartEntry = this.songLibrary.getSong(songId);
    if (!chartEntry) return;
    
    const { song, notes, noteSpeed, poemLines } = preloaded;
    const difficultyConfig = chartEntry.difficultyConfigs[difficulty];
    
    this.currentChart = {
      song,
      chartEntry,
      difficulty,
      notes,
      noteSpeed,
      poemLines,
      difficultyConfig
    };
    
    this.rhythmJudge.setConfig(noteSpeed, difficultyConfig.judgeTiming);
    this.rhythmJudge.setBPM(chartEntry.metadata.bpm);
    this.scoreSystem = new ScoreSystem(notes.length);
    
    this.gameState = 'playing';
    this.startScreen.hide();
    this.gameContainer.visible = true;

    this.songLibrary.markAsPlayed(songId);
    
    this.resetGame();
    this.createSongInfoOverlay();
    
    this.lyricProgress.initialize(notes, poemLines);
    this.lyricProgress.setVisible(true);
    
    this.rhythmJudge.setNotes(notes);
    this.applyPracticeConfig();
    
    if (this.practiceConfig.loopEnabled) {
      const bars = this.rhythmJudge.getBars();
      if (bars.length > 0) {
        this.practiceConfig.loopStartBar = Math.max(0, Math.min(this.practiceConfig.loopStartBar, bars.length - 1));
        this.practiceConfig.loopEndBar = Math.max(this.practiceConfig.loopStartBar, Math.min(this.practiceConfig.loopEndBar, bars.length - 1));
        this.applyPracticeConfig();
      }
    }
    
    this.startTime = performance.now();
    setTimeout(() => {
      this.preloadAdjacentCharts(songId, difficulty);
      this.preloadAdjacentSongs(songId, difficulty);
    }, 50);
  }

  private clearGameEndTimer(): void {
    if (this.gameEndTimer !== undefined) {
      clearTimeout(this.gameEndTimer);
      this.gameEndTimer = undefined;
    }
  }

  private resetGame(): void {
    this.clearGameEndTimer();
    this.currentTime = 0;
    this.pausedTime = 0;
    this.pauseStartTime = 0;
    this.charRecords = [];
    this.judgeEventRecords = [];
    this.activeChallengeId = undefined;
    this.pressedKeys.clear();
    
    this.activeTouches.forEach(touch => {
      if (touch.holdTimer !== undefined) {
        clearTimeout(touch.holdTimer);
      }
    });
    this.activeTouches.clear();
    
    this.rhythmJudge.reset();
    if (this.scoreSystem) {
      this.scoreSystem.reset();
    }
    this.bookResonance.reset();
    this.effectRenderer.resetAllEffects();
    
    this.lyricProgress.reset();
    this.lyricProgress.setVisible(false);
    
    this.noteSprites.forEach(sprite => {
      this.releaseNoteSprite(sprite);
    });
    this.noteSprites.clear();

    while (this.noteLayer.children.length > 0) {
      const child = this.noteLayer.children[0];
      this.noteLayer.removeChild(child);
    }
    
    this.clearBarBoundaries();
    this.clearLoopIndicators();
    if (this.earlyJudgeLine) {
      this.earlyJudgeLine.visible = false;
    }
    this.updatePracticeModeIndicator();
    
    this.hidePauseMenu();
    this.updateUI();
  }

  private pauseGame(): void {
    if (this.gameState !== 'playing') return;
    
    this.clearGameEndTimer();
    this.gameState = 'paused';
    this.pauseStartTime = performance.now();
    this.showPauseMenu();
  }

  private resumeGame(): void {
    if (this.gameState !== 'paused') return;
    
    this.pausedTime += performance.now() - this.pauseStartTime;
    this.pauseStartTime = 0;
    this.gameState = 'playing';
    this.hidePauseMenu();
    
    this.checkGameEnd();
  }

  private showPauseMenu(): void {
    if (this.pauseMenu) {
      this.pauseMenu.visible = true;
    }
    if (this.pauseButton) {
      this.pauseButton.visible = false;
    }
  }

  private hidePauseMenu(): void {
    if (this.pauseMenu) {
      this.pauseMenu.visible = false;
    }
    if (this.pauseButton) {
      this.pauseButton.visible = true;
    }
  }

  private restartFromPause(): void {
    if (!this.currentChart) return;
    
    this.hidePauseMenu();
    this.resetGame();
    
    const notes = this.currentChart.notes;
    this.rhythmJudge.setNotes(notes);

    this.lyricProgress.initialize(notes, this.currentChart.poemLines);
    this.lyricProgress.setVisible(true);
    
    this.gameState = 'playing';
    this.startTime = performance.now();
  }

  private backToStartFromPause(): void {
    this.hidePauseMenu();
    this.resetGame();
    this.showStartScreen();
  }

  private endGame(): void {
    this.clearGameEndTimer();
    this.gameState = 'result';
    this.gameContainer.visible = false;

    this.effectRenderer.clearHoldEffects();
    this.effectRenderer.clearSlideTrails();
    this.clearBarBoundaries();
    this.clearLoopIndicators();

    const score = this.scoreSystem.getScore();
    const accuracy = this.scoreSystem.calculateAccuracy();
    const isPractice = this.practiceConfig.enabled;

    let isNewRecord = false;
    let previousBest = null;
    let newlyUnlockedSongs: SongWithUnlock[] = [];
    let storyEvents: StoryStateChangeEvent[] = [];
    let newlyUnlockedCosmetics: string[] = [];

    if (this.currentChart) {
      const songId = this.currentChart.chartEntry.metadata.id;
      const songTitle = this.currentChart.chartEntry.metadata.title;
      const difficulty = this.currentChart.difficulty;

      previousBest = ScoreStorage.getBestScore(songId, difficulty);
      
      if (!isPractice) {
        isNewRecord = ScoreStorage.isNewBestScore(songId, difficulty, score);
        ScoreStorage.saveBestScore(songId, difficulty, score, accuracy);

        const unlockResult = ChapterUnlockManager.evaluateAfterScore(songId, difficulty);
        newlyUnlockedSongs = unlockResult.unlockedSongs;

        storyEvents = this.storyChapterSystem.processScoreResult(
          songId,
          difficulty,
          score.rating,
          accuracy
        );

        const coinReward = Math.floor(score.score / 100);
        const maxCombo = this.scoreSystem.getMaxCombo();
        if (maxCombo >= 50) {
          SkinSystem.addCurrency({ coin: coinReward, star: 1 });
        } else {
          SkinSystem.addCurrency({ coin: coinReward });
        }

        const bestScores = ScoreStorage.getAllBestScores();
        const allMaxCombo = ScoreStorage.getMaxCombo();
        const storyState = this.storyChapterSystem.getState();
        const collectedPoems = storyState.totalCollectedPoems;
        const completedChapters = Object.entries(storyState.chapters)
          .filter(([_, progress]) => progress.completionCount > 0)
          .map(([chapterId]) => chapterId);

        newlyUnlockedCosmetics = SkinSystem.checkAndGrantAchievementUnlocks({
          bestScores,
          maxCombo: allMaxCombo,
          collectedPoems,
          completedChapters
        });
      }
      
      ScoreStorage.addHistoryEntry(
        songId,
        songTitle,
        difficulty,
        score,
        accuracy,
        isPractice,
        this.practiceConfig.speedMultiplier
      );
    }

    const poemLines = this.currentChart?.chartEntry.metadata.poemLines || [];
    this.resultScreen.show(
      score,
      poemLines,
      this.charRecords,
      this.currentChart?.chartEntry.metadata.id,
      this.currentChart?.difficulty,
      isNewRecord,
      previousBest,
      accuracy,
      isPractice,
      this.practiceConfig.speedMultiplier,
      newlyUnlockedSongs,
      storyEvents,
      this.currentChart?.chartEntry.metadata.title || '',
      this.activeChallengeId,
      this.judgeEventRecords,
      newlyUnlockedCosmetics
    );
  }

  private backToStartScreen(): void {
    this.resetGame();
    this.resultScreen.hide();
    this.showStartScreen();
  }

  private restartGame(): void {
    if (!this.currentChart) {
      this.backToStartScreen();
      return;
    }

    const songId = this.currentChart.chartEntry.metadata.id;
    const difficulty = this.currentChart.difficulty;

    const chartEntry = this.songLibrary.getSong(songId);
    if (!chartEntry) {
      this.showStartScreen();
      return;
    }

    let preloaded = this.preloadedCharts.get(this.PRELOAD_KEY(songId, difficulty));
    if (!preloaded) {
      preloaded = this.preloadChart(songId, difficulty) || undefined;
    }

    this.resetGame();
    this.resultScreen.hide();

    if (preloaded) {
      const { song, notes, noteSpeed, poemLines } = preloaded;
      const difficultyConfig = chartEntry.difficultyConfigs[difficulty];

      this.currentChart = {
        song,
        chartEntry,
        difficulty,
        notes,
        noteSpeed,
        poemLines,
        difficultyConfig
      };

      this.rhythmJudge.setConfig(noteSpeed, difficultyConfig.judgeTiming);
      this.rhythmJudge.setBPM(chartEntry.metadata.bpm);
      this.scoreSystem = new ScoreSystem(notes.length);

      this.gameState = 'playing';
      this.gameContainer.visible = true;

      this.createSongInfoOverlay();
      this.lyricProgress.initialize(notes, poemLines);
      this.lyricProgress.setVisible(true);

      this.rhythmJudge.setNotes(notes);
      this.applyPracticeConfig();

      if (this.practiceConfig.loopEnabled) {
        const bars = this.rhythmJudge.getBars();
        if (bars.length > 0) {
          this.practiceConfig.loopStartBar = Math.max(0, Math.min(this.practiceConfig.loopStartBar, bars.length - 1));
          this.practiceConfig.loopEndBar = Math.max(this.practiceConfig.loopStartBar, Math.min(this.practiceConfig.loopEndBar, bars.length - 1));
          this.applyPracticeConfig();
        }
      }

      this.startTime = performance.now();
      this.preloadAdjacentCharts(songId, difficulty);
    } else {
      this.showStartScreen();
    }
  }

  public preloadChart(songId: string, difficulty: Difficulty): PreloadedChart | null {
    const key = this.PRELOAD_KEY(songId, difficulty);
    const existing = this.preloadedCharts.get(key);
    if (existing) {
      existing.loadedAt = Date.now();
      return existing;
    }

    const chart = this.songLibrary.getSong(songId);
    const legacySong = getSongById(songId);
    if (!chart || !legacySong) return null;

    const notes = this.songLibrary.getNotesForDifficulty(chart, difficulty);
    const difficultyConfig = chart.difficultyConfigs[difficulty];

    const preloaded: PreloadedChart = {
      song: legacySong,
      difficulty,
      notes,
      noteSpeed: difficultyConfig.noteSpeed,
      poemLines: chart.metadata.poemLines,
      loadedAt: Date.now()
    };

    this.preloadedCharts.set(key, preloaded);

    if (this.preloadedCharts.size > this.MAX_PRELOAD_COUNT) {
      const entries = [...this.preloadedCharts.entries()]
        .sort((a, b) => a[1].loadedAt - b[1].loadedAt);
      const removeCount = this.preloadedCharts.size - this.MAX_PRELOAD_COUNT;
      for (let i = 0; i < removeCount && i < entries.length; i++) {
        this.preloadedCharts.delete(entries[i][0]);
      }
    }

    const staleThreshold = 10 * 60 * 1000;
    const now = Date.now();
    for (const [k, v] of [...this.preloadedCharts.entries()]) {
      if (now - v.loadedAt > staleThreshold) {
        this.preloadedCharts.delete(k);
      }
    }

    return preloaded;
  }

  public preloadAdjacentCharts(currentSongId: string, currentDifficulty: Difficulty): void {
    const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
    const currentDiffIdx = difficulties.indexOf(currentDifficulty);
    const currentChart = this.songLibrary.getSong(currentSongId);
    
    if (!currentChart) return;
    
    const availableDiffs = this.songLibrary.getAvailableDifficulties(currentChart);
    
    if (currentDiffIdx > 0 && availableDiffs.includes(difficulties[currentDiffIdx - 1])) {
      this.preloadChart(currentSongId, difficulties[currentDiffIdx - 1]);
    }
    if (currentDiffIdx < difficulties.length - 1 && availableDiffs.includes(difficulties[currentDiffIdx + 1])) {
      this.preloadChart(currentSongId, difficulties[currentDiffIdx + 1]);
    }
  }

  public preloadAdjacentSongs(currentSongId: string, currentDifficulty: Difficulty): void {
    const activeSongs = this.songLibrary.getActiveSongs();
    const currentIdx = activeSongs.findIndex(s => s.metadata.id === currentSongId);
    if (currentIdx < 0) return;
    const count = activeSongs.length;
    const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
    const diffIdx = difficulties.indexOf(currentDifficulty);
    
    const neighbors: number[] = [];
    if (count > 1) neighbors.push((currentIdx + 1) % count);
    if (count > 2) neighbors.push((currentIdx - 1 + count) % count);

    neighbors.forEach((idx, depth) => {
      const chart = activeSongs[idx];
      if (!chart) return;
      setTimeout(() => {
        this.preloadChart(chart.metadata.id, currentDifficulty);
        if (diffIdx > 0) this.preloadChart(chart.metadata.id, difficulties[diffIdx - 1]);
        if (diffIdx < difficulties.length - 1) this.preloadChart(chart.metadata.id, difficulties[diffIdx + 1]);
      }, depth * 150 + 100);
    });
  }

  private readonly MAX_PRELOAD_COUNT = 12;

  public clearPreloadCache(): void {
    this.preloadedCharts.clear();
  }

  private acquireNoteSprite(
    lyricChar: string,
    lane: number,
    noteType: NoteType,
    duration: number | undefined,
    noteSpeed: number
  ): PIXI.Container {
    const reusable = this.noteSpritePool.find(
      p => !p.inUse && p.lastUsedNoteType === noteType && p.lastUsedLane === lane
    );

    if (reusable) {
      reusable.inUse = true;
      reusable.container.visible = true;
      reusable.container.alpha = 1;
      return reusable.container;
    }

    const anyFree = this.noteSpritePool.find(p => !p.inUse);
    if (anyFree) {
      this.noteLayer.removeChild(anyFree.container);
      anyFree.container.destroy();
      this.noteSpritePool = this.noteSpritePool.filter(p => p !== anyFree);
    }

    const newContainer = this.effectRenderer.createPageNote(
      lyricChar, lane, noteType, duration, noteSpeed
    );

    if (this.noteSpritePool.length < this.MAX_POOL_SIZE) {
      this.noteSpritePool.push({
        container: newContainer,
        inUse: true,
        lastUsedNoteType: noteType,
        lastUsedLane: lane
      });
    }

    return newContainer;
  }

  private releaseNoteSprite(sprite: NoteSprite): void {
    const pooled = this.noteSpritePool.find(p => p.container === sprite.container);
    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsedNoteType = sprite.noteType;
      pooled.lastUsedLane = sprite.noteData.lane;
    }
    this.noteLayer.removeChild(sprite.container);
    sprite.container.visible = false;
  }

  private drainNoteSpritePool(): void {
    this.noteSpritePool.forEach(p => {
      if (p.container.parent) {
        p.container.parent.removeChild(p.container);
      }
      p.container.destroy();
    });
    this.noteSpritePool = [];
  }

  public destroy(): void {
    if (this.removeConfigListener) {
      this.removeConfigListener();
    }
    if (this.removeResonanceListener) {
      this.removeResonanceListener();
    }
    if (this.removeSkinListener) {
      this.removeSkinListener();
    }
    this.clearPreloadCache();
    this.drainNoteSpritePool();
    this.skinRenderer.destroy();
    this.effectRenderer.destroy();
    this.app.destroy(true);
  }
}
