import * as PIXI from 'pixi.js';
import { RhythmJudge } from './modules/RhythmJudge';
import { ScoreSystem } from './modules/ScoreSystem';
import { EffectRenderer } from './modules/EffectRenderer';
import { ResultScreen } from './modules/ResultScreen';
import { StartScreen } from './modules/StartScreen';
import { ScoreStorage } from './modules/ScoreStorage';
import { getSongById, getNotesForDifficulty } from './data/songs';
import { ChartData, CharHitRecord, Difficulty, JudgeEvent, JudgeResult, LANE_COUNT, NoteData } from './types';

interface NoteSprite {
  container: PIXI.Container;
  noteData: NoteData;
}

type GameState = 'start' | 'playing' | 'result';

interface RuntimeChart {
  song: ChartData;
  difficulty: Difficulty;
  notes: NoteData[];
  noteSpeed: number;
  poemLines: string[];
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
  private charRecords: CharHitRecord[] = [];
  
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
  
  private laneTouchAreas: PIXI.Graphics[] = [];

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
      
      area.on('pointerdown', () => {
        if (this.gameState === 'playing') {
          this.handleInput(i);
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
    const hintY = this.judgeLineY + 80;
    
    for (let i = 0; i < LANE_COUNT; i++) {
      const keyHint = new PIXI.Text(keys[i], hintStyle);
      keyHint.anchor.set(0.5);
      keyHint.x = i * this.laneWidth + this.laneWidth / 2;
      keyHint.y = hintY;
      keyHint.alpha = 0.5;
      this.uiLayer.addChild(keyHint);
    }
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
      if (this.gameState !== 'playing') return;
      
      const lane = this.keyMap[e.key];
      if (lane !== undefined) {
        e.preventDefault();
        this.handleInput(lane);
      }
    });
  }

  private handleInput(lane: number): void {
    if (this.gameState !== 'playing') return;
    
    const judgeEvent = this.rhythmJudge.handleInput(lane);
    if (judgeEvent) {
      this.processJudgeEvent(judgeEvent);
    }
    
    this.flashLane(lane);
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
  }

  private processJudgeEvent(event: JudgeEvent): void {
    this.scoreSystem.addJudgeResult(event.result);
    
    const x = event.lane * this.laneWidth + this.laneWidth / 2;
    this.effectRenderer.spawnHitEffect(x, this.judgeLineY, event.lane, event.result);
    
    const hit = event.result !== 'miss';
    this.charRecords.push({
      char: event.lyricChar,
      hit,
      result: event.result as JudgeResult
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
    
    this.currentTime = performance.now() - this.startTime;
    
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
        const noteContainer = this.effectRenderer.createPageNote(note.lyricChar, note.lane);
        this.noteLayer.addChild(noteContainer);
        this.noteSprites.set(note.id, {
          container: noteContainer,
          noteData: note
        });
      }
      
      const sprite = this.noteSprites.get(note.id);
      if (sprite) {
        sprite.container.x = note.lane * this.laneWidth + this.laneWidth / 2;
        sprite.container.y = this.rhythmJudge.getNoteY(note);
      }
    });
  }

  private checkGameEnd(): void {
    if (this.rhythmJudge.isAllNotesJudged() && this.scoreSystem.isAllJudged()) {
      setTimeout(() => {
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

  private resetGame(): void {
    this.currentTime = 0;
    this.charRecords = [];
    
    this.rhythmJudge.reset();
    if (this.scoreSystem) {
      this.scoreSystem.reset();
    }
    this.effectRenderer.clearLitCharacters();
    
    this.noteSprites.forEach(sprite => {
      this.noteLayer.removeChild(sprite.container);
      sprite.container.destroy();
    });
    this.noteSprites.clear();
    
    this.updateUI();
  }

  private endGame(): void {
    this.gameState = 'result';
    this.gameContainer.visible = false;
    
    const score = this.scoreSystem.getScore();
    
    let isNewRecord = false;
    if (this.currentChart) {
      isNewRecord = ScoreStorage.isNewBestScore(
        this.currentChart.song.id,
        this.currentChart.difficulty,
        score
      );
      ScoreStorage.saveBestScore(
        this.currentChart.song.id,
        this.currentChart.difficulty,
        score
      );
    }
    
    const poemLines = this.currentChart?.poemLines || [];
    this.resultScreen.show(
      score,
      poemLines,
      this.charRecords,
      this.currentChart?.song.id,
      this.currentChart?.difficulty,
      isNewRecord
    );
  }

  private restartGame(): void {
    this.resetGame();
    this.showStartScreen();
  }

  public destroy(): void {
    this.app.destroy(true);
  }
}
