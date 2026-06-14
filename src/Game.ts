import * as PIXI from 'pixi.js';
import { RhythmJudge } from './modules/RhythmJudge';
import { ScoreSystem } from './modules/ScoreSystem';
import { EffectRenderer } from './modules/EffectRenderer';
import { ResultScreen } from './modules/ResultScreen';
import { StartScreen } from './modules/StartScreen';
import { ScoreStorage } from './modules/ScoreStorage';
import { getSongById, getNotesForDifficulty } from './data/songs';
import { ChartData, CharHitRecord, Difficulty, JudgeEvent, JudgeResult, LANE_COUNT, NoteData, NoteType } from './types';

interface NoteSprite {
  container: PIXI.Container;
  noteData: NoteData;
  noteId: number;
  noteType: NoteType;
}

type GameState = 'start' | 'playing' | 'paused' | 'result';

interface RuntimeChart {
  song: ChartData;
  difficulty: Difficulty;
  notes: NoteData[];
  noteSpeed: number;
  poemLines: string[];
}

interface TouchInfo {
  pointerId: number;
  startLane: number;
  currentLane: number;
  startX: number;
  currentX: number;
}

export class Game {
  private app: PIXI.Application;
  private container: HTMLElement;
  private gameState: GameState = 'start';
  
  private currentChart?: RuntimeChart;
  
  private rhythmJudge: RhythmJudge;
  private scoreSystem: ScoreSystem;
  private effectRenderer: EffectRenderer;
  private resultScreen: ResultScreen;
  private startScreen: StartScreen;
  
  private gameContainer: PIXI.Container;
  private noteSprites: Map<number, NoteSprite> = new Map();
  private noteLayer: PIXI.Container;
  private uiLayer: PIXI.Container;
  
  private startTime: number = 0;
  private currentTime: number = 0;
  private pausedTime: number = 0;
  private pauseStartTime: number = 0;
  private charRecords: CharHitRecord[] = [];
  private gameEndTimer?: number;
  
  private pauseMenu?: PIXI.Container;
  private pauseButton?: PIXI.Container;
  
  private comboDisplay: PIXI.Text;
  private scoreDisplay: PIXI.Text;
  private songInfoDisplay?: PIXI.Container;
  private laneWidth: number;
  private judgeLineY: number = 600;
  
  private keyMap: Record<string, number> = {
    'd': 0, 'D': 0,
    'f': 1, 'F': 1,
    'j': 2, 'J': 2,
    'k': 3, 'K': 3
  };
  
  private pressedKeys: Set<number> = new Set();
  private laneTouchAreas: PIXI.Graphics[] = [];
  private activeTouches: Map<number, TouchInfo> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
    
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
    
    const defaultSong = getSongById('love-poem')!;
    const defaultNotes = getNotesForDifficulty(defaultSong, 'normal');
    this.currentChart = {
      song: defaultSong,
      difficulty: 'normal',
      notes: defaultNotes,
      noteSpeed: defaultSong.difficultyConfigs.normal.noteSpeed,
      poemLines: defaultSong.poemLines
    };
    
    this.rhythmJudge = new RhythmJudge(
      defaultSong.difficultyConfigs.normal.noteSpeed,
      this.judgeLineY,
      defaultSong.difficultyConfigs.normal.judgeTiming
    );
    this.scoreSystem = new ScoreSystem(defaultNotes.length);
    
    this.effectRenderer = new EffectRenderer(this.app);
    this.resultScreen = new ResultScreen(this.app);
    this.startScreen = new StartScreen(this.app);
    
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
    
    this.app.ticker.add(this.update.bind(this));
    
    this.showStartScreen();
  }

  private setupUI(): void {
    const bg = this.effectRenderer.createBackground();
    this.gameContainer.addChildAt(bg, 0);
    
    const laneBg = this.effectRenderer.createLaneBackground(LANE_COUNT);
    this.gameContainer.addChildAt(laneBg, 1);
    
    const judgeLine = this.effectRenderer.createJudgeLine(this.judgeLineY);
    this.gameContainer.addChildAt(judgeLine, 2);
    
    this.createLaneTouchAreas();
    this.createLaneHints();
    this.createPauseButton();
    this.createPauseMenu();
  }

  private createSongInfoOverlay(): void {
    if (this.songInfoDisplay) {
      this.uiLayer.removeChild(this.songInfoDisplay);
      this.songInfoDisplay.destroy();
    }
    
    if (!this.currentChart) return;
    
    this.songInfoDisplay = new PIXI.Container();
    
    const infoText = `${this.currentChart.song.title}  |  BPM: ${this.currentChart.song.bpm}  |  ${this.currentChart.song.difficultyConfigs[this.currentChart.difficulty].label}`;
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
          const touchInfo: TouchInfo = {
            pointerId: e.pointerId,
            startLane: i,
            currentLane: i,
            startX: e.global.x,
            currentX: e.global.x
          };
          this.activeTouches.set(e.pointerId, touchInfo);
          this.handleInput(i, true);
        }
      });
      
      area.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
        if (this.gameState !== 'playing') return;
        const touch = this.activeTouches.get(e.pointerId);
        if (!touch) return;
        
        const newLane = Math.floor(e.global.x / this.laneWidth);
        if (newLane >= 0 && newLane < LANE_COUNT && newLane !== touch.currentLane) {
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
          touch.currentLane = newLane;
        }
        touch.currentX = e.global.x;
      });
      
      area.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
        if (this.gameState === 'playing') {
          const touch = this.activeTouches.get(e.pointerId);
          if (touch) {
            this.handleInput(touch.currentLane, false);
            this.activeTouches.delete(e.pointerId);
          }
        }
      });
      
      area.on('pointerout', (e: PIXI.FederatedPointerEvent) => {
        if (this.gameState === 'playing') {
          const touch = this.activeTouches.get(e.pointerId);
          if (touch) {
            this.handleInput(touch.currentLane, false);
            this.activeTouches.delete(e.pointerId);
          }
        }
      });
      
      this.laneTouchAreas.push(area);
      this.gameContainer.addChild(area);
    }
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
    
    const keys = ['D', 'F', 'J', 'K'];
    const typeLabels = ['', '', '', ''];
    const hintY = this.judgeLineY + 80;
    
    for (let i = 0; i < LANE_COUNT; i++) {
      const keyHint = new PIXI.Text(keys[i] + typeLabels[i], hintStyle);
      keyHint.anchor.set(0.5);
      keyHint.x = i * this.laneWidth + this.laneWidth / 2;
      keyHint.y = hintY;
      keyHint.alpha = 0.5;
      this.uiLayer.addChild(keyHint);
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
    
    const buttonConfigs = [
      { label: '继续游戏', y: this.app.screen.height / 2, color: 0x6b9dff, action: () => this.resumeGame() },
      { label: '重新开始', y: this.app.screen.height / 2 + 80, color: 0xffd700, action: () => this.restartFromPause() },
      { label: '返回主菜单', y: this.app.screen.height / 2 + 160, color: 0xff6b6b, action: () => this.backToStartFromPause() }
    ];
    
    buttonConfigs.forEach(config => {
      const button = this.createPauseButtonItem(config.label, config.color, config.action);
      button.y = config.y;
      menuContainer.addChild(button);
    });
    
    this.pauseMenu = menuContainer;
    this.uiLayer.addChild(menuContainer);
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
    this.startScreen.setOnStartCallback((songId: string, difficulty: Difficulty) => {
      this.startGame(songId, difficulty);
    });
    
    this.resultScreen.setOnRestartCallback(() => {
      this.restartGame();
    });

    this.resultScreen.setOnBackToStartCallback(() => {
      this.backToStartScreen();
    });
  }

  private processJudgeEvent(event: JudgeEvent): void {
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
    this.effectRenderer.addLyricChar(event.lyricChar, this.charRecords.length - 1, hit);
    
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
    
    this.effectRenderer.update(delta);
    
    this.updateNoteSprites();
    this.checkGameEnd();
  }

  private updateNoteSprites(): void {
    const activeNotes = this.rhythmJudge.getActiveNotes();
    
    const activeNoteIds = new Set(activeNotes.map(n => n.id));
    
    this.noteSprites.forEach((sprite, id) => {
      if (!activeNoteIds.has(id)) {
        this.noteLayer.removeChild(sprite.container);
        sprite.container.destroy();
        this.noteSprites.delete(id);
      }
    });
    
    activeNotes.forEach(note => {
      if (!this.noteSprites.has(note.id)) {
        const noteContainer = this.effectRenderer.createPageNote(
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

  private showStartScreen(): void {
    this.gameState = 'start';
    this.gameContainer.visible = false;
    this.startScreen.show();
  }

  private startGame(songId: string, difficulty: Difficulty): void {
    const song = getSongById(songId);
    if (!song) return;
    
    const notes = getNotesForDifficulty(song, difficulty);
    const difficultyConfig = song.difficultyConfigs[difficulty];
    
    this.currentChart = {
      song,
      difficulty,
      notes,
      noteSpeed: difficultyConfig.noteSpeed,
      poemLines: song.poemLines
    };
    
    this.rhythmJudge.setConfig(difficultyConfig.noteSpeed, difficultyConfig.judgeTiming);
    this.scoreSystem = new ScoreSystem(notes.length);
    
    this.gameState = 'playing';
    this.startScreen.hide();
    this.gameContainer.visible = true;
    
    this.resetGame();
    this.createSongInfoOverlay();
    
    this.rhythmJudge.setNotes(notes);
    
    this.startTime = performance.now();
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
    this.pressedKeys.clear();
    this.activeTouches.clear();
    
    this.rhythmJudge.reset();
    if (this.scoreSystem) {
      this.scoreSystem.reset();
    }
    this.effectRenderer.clearLitCharacters();
    this.effectRenderer.clearHoldEffects();
    this.effectRenderer.clearSlideTrails();
    
    this.noteSprites.forEach(sprite => {
      this.noteLayer.removeChild(sprite.container);
      sprite.container.destroy();
    });
    this.noteSprites.clear();
    
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

    const score = this.scoreSystem.getScore();
    const accuracy = this.scoreSystem.calculateAccuracy();

    let isNewRecord = false;
    let previousBest = null;
    if (this.currentChart) {
      previousBest = ScoreStorage.getBestScore(
        this.currentChart.song.id,
        this.currentChart.difficulty
      );
      isNewRecord = ScoreStorage.isNewBestScore(
        this.currentChart.song.id,
        this.currentChart.difficulty,
        score
      );
      ScoreStorage.saveBestScore(
        this.currentChart.song.id,
        this.currentChart.difficulty,
        score,
        accuracy
      );
      ScoreStorage.addHistoryEntry(
        this.currentChart.song.id,
        this.currentChart.song.title,
        this.currentChart.difficulty,
        score,
        accuracy
      );
    }

    const poemLines = this.currentChart?.poemLines || [];
    this.resultScreen.show(
      score,
      poemLines,
      this.charRecords,
      this.currentChart?.song.id,
      this.currentChart?.difficulty,
      isNewRecord,
      previousBest,
      accuracy
    );
  }

  private backToStartScreen(): void {
    this.resetGame();
    this.showStartScreen();
  }

  private restartGame(): void {
    this.resetGame();
    this.showStartScreen();
  }

  public destroy(): void {
    this.app.destroy(true);
  }
}
