import * as PIXI from 'pixi.js';
import { ChartParser } from './modules/ChartParser';
import { RhythmJudge } from './modules/RhythmJudge';
import { ScoreSystem } from './modules/ScoreSystem';
import { EffectRenderer } from './modules/EffectRenderer';
import { ResultScreen } from './modules/ResultScreen';
import { StartScreen } from './modules/StartScreen';
import { sampleChart, lovePoemLines } from './data/sampleChart';
import { JudgeEvent, LANE_COUNT, NoteData, CharHitRecord } from './types';

interface NoteSprite {
  container: PIXI.Container;
  noteData: NoteData;
}

type GameState = 'start' | 'playing' | 'result';

export class Game {
  private app: PIXI.Application;
  private container: HTMLElement;
  private gameState: GameState = 'start';
  
  private chartParser: ChartParser;
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
    
    this.chartParser = new ChartParser(sampleChart);
    this.rhythmJudge = new RhythmJudge(
      this.chartParser.getNoteSpeed(),
      this.judgeLineY
    );
    this.scoreSystem = new ScoreSystem(this.chartParser.getNoteCount());
    
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
    this.startScreen.setOnStartCallback(() => {
      this.startGame();
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
      result: event.result
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

  private startGame(): void {
    this.gameState = 'playing';
    this.startScreen.hide();
    this.gameContainer.visible = true;
    
    this.resetGame();
    
    const notes = this.chartParser.getNotes();
    this.rhythmJudge.setNotes(notes);
    
    this.startTime = performance.now();
  }

  private resetGame(): void {
    this.currentTime = 0;
    this.charRecords = [];
    
    this.rhythmJudge.reset();
    this.scoreSystem.reset();
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
    this.resultScreen.show(score, lovePoemLines, this.charRecords);
  }

  private restartGame(): void {
    this.resetGame();
    this.showStartScreen();
  }

  public destroy(): void {
    this.app.destroy(true);
  }
}
