import * as PIXI from 'pixi.js';
import { LANE_COUNT, JudgeTiming } from '../../types';
import { EditorStateManager } from '../EditorState';
import { EditorNote, NOTE_TYPE_COLORS } from '../types';
import { getPositionFromTime, getXFromLane } from '../utils/chartUtils';

interface PreviewConfig {
  width: number;
  height: number;
  laneWidth: number;
  judgeLineY: number;
  noteSpeed: number;
}

const DEFAULT_CONFIG: PreviewConfig = {
  width: 280,
  height: 400,
  laneWidth: 60,
  judgeLineY: 320,
  noteSpeed: 400
};

export class Preview {
  private app: PIXI.Application;
  private stateManager: EditorStateManager;
  private container: PIXI.Container;
  private config: PreviewConfig;
  
  private noteLayer: PIXI.Container;
  private uiLayer: PIXI.Container;
  private effectLayer: PIXI.Container;
  
  private noteSprites: Map<string, PIXI.Container> = new Map();
  private judgeTiming?: JudgeTiming;
  
  private removeStateListener?: () => void;
  private removePlaybackListener?: () => void;
  
  private activeHoldEffects: Map<number, PIXI.Graphics> = new Map();
  private hitEffects: Array<{ sprite: PIXI.Container; life: number; maxLife: number }> = [];

  constructor(
    app: PIXI.Application,
    stateManager: EditorStateManager,
    config?: Partial<PreviewConfig>
  ) {
    this.app = app;
    this.stateManager = stateManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.container = new PIXI.Container();
    this.noteLayer = new PIXI.Container();
    this.uiLayer = new PIXI.Container();
    this.effectLayer = new PIXI.Container();
    
    this.setupContainer();
    this.setupBackground();
    this.setupJudgeLine();
    this.setupLanes();
    this.setupListeners();
    
    this.app.ticker.add(this.update.bind(this));
  }

  getContainer(): PIXI.Container {
    return this.container;
  }

  private setupContainer(): void {
    this.container.addChild(this.noteLayer);
    this.container.addChild(this.effectLayer);
    this.container.addChild(this.uiLayer);
    
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0a0a1a, 1);
    bg.drawRoundedRect(0, 0, this.config.width, this.config.height, 8);
    bg.endFill();
    bg.lineStyle(2, 0x333355, 0.8);
    bg.drawRoundedRect(0, 0, this.config.width, this.config.height, 8);
    this.container.addChildAt(bg, 0);
    
    const title = new PIXI.Text('实时预览', {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xaaaaaa
    });
    title.anchor.set(0.5, 0);
    title.x = this.config.width / 2;
    title.y = 10;
    this.uiLayer.addChild(title);
  }

  private setupBackground(): void {
    const bgGradient = new PIXI.Graphics();
    bgGradient.beginFill(0x121225, 0.9);
    bgGradient.drawRect(10, 35, this.config.width - 20, this.config.judgeLineY + 60);
    bgGradient.endFill();
    this.noteLayer.addChild(bgGradient);
  }

  private setupJudgeLine(): void {
    const state = this.stateManager.getState();
    this.judgeTiming = state.chart.difficultyConfigs[state.currentDifficulty]?.judgeTiming;
    
    const judgeLine = new PIXI.Graphics();
    judgeLine.lineStyle(3, 0xffd700, 0.9);
    judgeLine.moveTo(10, this.config.judgeLineY + 35);
    judgeLine.lineTo(this.config.width - 10, this.config.judgeLineY + 35);
    
    const glow = new PIXI.Graphics();
    glow.lineStyle(6, 0xffd700, 0.3);
    glow.moveTo(10, this.config.judgeLineY + 35);
    glow.lineTo(this.config.width - 10, this.config.judgeLineY + 35);
    judgeLine.addChild(glow);
    
    const indicator = new PIXI.Graphics();
    indicator.beginFill(0xffd700, 0.8);
    indicator.moveTo(this.config.width - 25, this.config.judgeLineY + 25);
    indicator.lineTo(this.config.width - 10, this.config.judgeLineY + 35);
    indicator.lineTo(this.config.width - 25, this.config.judgeLineY + 45);
    indicator.closePath();
    indicator.endFill();
    judgeLine.addChild(indicator);
    
    this.uiLayer.addChild(judgeLine);
  }

  private setupLanes(): void {
    const laneContainer = new PIXI.Container();
    const totalWidth = LANE_COUNT * this.config.laneWidth;
    const startX = (this.config.width - totalWidth) / 2;
    
    for (let i = 0; i < LANE_COUNT; i++) {
      const laneBg = new PIXI.Graphics();
      const alpha = i % 2 === 0 ? 0.05 : 0.08;
      laneBg.beginFill(0x6b9dff, alpha);
      laneBg.drawRect(
        startX + i * this.config.laneWidth,
        35,
        this.config.laneWidth,
        this.config.judgeLineY + 60
      );
      laneBg.endFill();
      laneContainer.addChild(laneBg);
      
      if (i < LANE_COUNT - 1) {
        const divider = new PIXI.Graphics();
        divider.lineStyle(1, 0x444466, 0.5);
        divider.moveTo(startX + (i + 1) * this.config.laneWidth, 35);
        divider.lineTo(startX + (i + 1) * this.config.laneWidth, this.config.judgeLineY + 95);
        laneContainer.addChild(divider);
      }
    }
    
    this.noteLayer.addChild(laneContainer);
  }

  private setupListeners(): void {
    this.removeStateListener = this.stateManager.subscribe(() => this.render());
    this.removePlaybackListener = this.stateManager.subscribePlayback(() => this.render());
  }

  private update(delta: number): void {
    const playbackState = this.stateManager.getPlaybackState();
    
    if (playbackState.isPlaying) {
      const newTime = playbackState.currentTime + delta * 16.67 * playbackState.playbackSpeed;
      const totalDuration = this.stateManager.getTotalDuration();
      
      if (playbackState.loopEnabled) {
        if (newTime >= playbackState.loopEndTime) {
          this.stateManager.setPlaybackTime(playbackState.loopStartTime);
          this.spawnLoopEffect();
        } else {
          this.stateManager.setPlaybackTime(newTime);
        }
      } else if (newTime >= totalDuration) {
        this.stateManager.setPlaying(false);
        this.stateManager.setPlaybackTime(0);
      } else {
        this.stateManager.setPlaybackTime(newTime);
      }
      
      this.checkNoteJudgments();
    }
    
    this.updateEffects(delta);
    this.render();
  }

  private checkNoteJudgments(): void {
    const playbackState = this.stateManager.getPlaybackState();
    const state = this.stateManager.getState();
    const currentTime = playbackState.currentTime;
    
    const judgeTiming = this.judgeTiming;
    if (!judgeTiming) return;
    
    state.notes.forEach(note => {
      if (note.type !== 'tap') return;
      
      const timeDiff = currentTime - note.time;
      
      if (timeDiff >= -judgeTiming.perfect && timeDiff <= judgeTiming.perfect) {
        this.spawnHitEffect(note, 'perfect');
      } else if (timeDiff >= -judgeTiming.great && timeDiff <= judgeTiming.great) {
        this.spawnHitEffect(note, 'great');
      } else if (timeDiff >= -judgeTiming.good && timeDiff <= judgeTiming.good) {
        this.spawnHitEffect(note, 'good');
      } else if (timeDiff > judgeTiming.good && timeDiff <= judgeTiming.miss) {
        this.spawnHitEffect(note, 'miss');
      }
    });
  }

  private spawnHitEffect(note: EditorNote, result: string): void {
    const x = getXFromLane(note.lane, this.config.laneWidth) + (this.config.width - LANE_COUNT * this.config.laneWidth) / 2;
    const y = this.config.judgeLineY + 35;
    
    const colors: Record<string, number> = {
      perfect: 0xffd700,
      great: 0x6bff9d,
      good: 0x6b9dff,
      miss: 0xff6b6b
    };
    
    const effectContainer = new PIXI.Container();
    effectContainer.x = x;
    effectContainer.y = y;
    
    const circle = new PIXI.Graphics();
    circle.beginFill(colors[result], 0.8);
    circle.drawCircle(0, 0, 25);
    circle.endFill();
    effectContainer.addChild(circle);
    
    const text = new PIXI.Text(result.toUpperCase(), {
      fontFamily: 'sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2
    });
    text.anchor.set(0.5);
    effectContainer.addChild(text);
    
    this.effectLayer.addChild(effectContainer);
    this.hitEffects.push({
      sprite: effectContainer,
      life: 30,
      maxLife: 30
    });
    
    if (note.type === 'hold') {
      this.startHoldEffect(note.lane);
    }
  }

  private startHoldEffect(lane: number): void {
    if (this.activeHoldEffects.has(lane)) return;
    
    const x = getXFromLane(lane, this.config.laneWidth) + (this.config.width - LANE_COUNT * this.config.laneWidth) / 2;
    const y = this.config.judgeLineY + 35;
    
    const holdEffect = new PIXI.Graphics();
    holdEffect.beginFill(0x9b59b6, 0.5);
    holdEffect.drawCircle(0, 0, 30);
    holdEffect.endFill();
    holdEffect.x = x;
    holdEffect.y = y;
    
    this.effectLayer.addChild(holdEffect);
    this.activeHoldEffects.set(lane, holdEffect);
  }

  private updateEffects(delta: number): void {
    this.hitEffects = this.hitEffects.filter(effect => {
      effect.life -= delta;
      const alpha = effect.life / effect.maxLife;
      effect.sprite.alpha = alpha;
      effect.sprite.scale.set(1 + (1 - alpha) * 0.5);
      
      if (effect.life <= 0) {
        this.effectLayer.removeChild(effect.sprite);
        effect.sprite.destroy();
        return false;
      }
      return true;
    });
    
    this.activeHoldEffects.forEach((effect) => {
      effect.alpha = 0.3 + Math.sin(Date.now() / 100) * 0.2;
    });
  }

  private spawnLoopEffect(): void {
    const effect = new PIXI.Text('↻ LOOP', {
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0x9b59b6,
      stroke: 0xffffff,
      strokeThickness: 3
    });
    effect.anchor.set(0.5);
    effect.x = this.config.width / 2;
    effect.y = this.config.height / 2;
    
    this.effectLayer.addChild(effect);
    this.hitEffects.push({
      sprite: effect,
      life: 40,
      maxLife: 40
    });
  }

  private render(): void {
    this.clearNotes();
    
    const state = this.stateManager.getState();
    const playbackState = this.stateManager.getPlaybackState();
    const currentTime = playbackState.currentTime;
    const noteSpeed = state.chart.difficultyConfigs[state.currentDifficulty]?.noteSpeed || this.config.noteSpeed;
    
    const totalWidth = LANE_COUNT * this.config.laneWidth;
    const startX = (this.config.width - totalWidth) / 2;
    
    state.notes.forEach(note => {
      const y = getPositionFromTime(note.time, this.config.judgeLineY, noteSpeed, 0) + 35;
      const x = getXFromLane(note.lane, this.config.laneWidth) + startX;
      
      if (y < -50 || y > this.config.judgeLineY + 100) return;
      
      const sprite = this.createNoteSprite(note, x, y);
      if (sprite) {
        this.noteLayer.addChild(sprite);
        this.noteSprites.set(note.id, sprite);
      }
    });
    
    this.updatePlayhead(currentTime, noteSpeed);
  }

  private createNoteSprite(note: EditorNote, x: number, y: number): PIXI.Container | null {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    
    const color = NOTE_TYPE_COLORS[note.type];
    const size = 35;
    
    if (note.type === 'hold' && note.duration) {
      this.renderHoldNote(container, note, color, size);
    } else if (note.type === 'slide' && note.endLane !== undefined && note.duration) {
      this.renderSlideNote(container, note, color, size);
    } else {
      this.renderTapNote(container, note, color, size);
    }
    
    const text = new PIXI.Text(note.lyricChar, {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffffff
    });
    text.anchor.set(0.5);
    container.addChild(text);
    
    return container;
  }

  private renderTapNote(container: PIXI.Container, _note: EditorNote, color: number, size: number): void {
    const graphic = new PIXI.Graphics();
    graphic.lineStyle(2, 0xffffff, 0.5);
    graphic.beginFill(color, 0.9);
    graphic.drawRoundedRect(-size / 2, -size / 2, size, size, 6);
    graphic.endFill();
    container.addChild(graphic);
  }

  private renderHoldNote(container: PIXI.Container, note: EditorNote, color: number, size: number): void {
    const state = this.stateManager.getState();
    const noteSpeed = state.chart.difficultyConfigs[state.currentDifficulty]?.noteSpeed || this.config.noteSpeed;
    const endY = getPositionFromTime(note.time + (note.duration || 0), this.config.judgeLineY, noteSpeed, 0) + 35;
    const height = Math.abs(endY - container.y);
    
    const graphic = new PIXI.Graphics();
    graphic.beginFill(color, 0.5);
    graphic.drawRoundedRect(-size / 2 + 5, -height, size - 10, height + size, 4);
    graphic.endFill();
    
    const startCap = new PIXI.Graphics();
    startCap.lineStyle(2, 0xffffff, 0.5);
    startCap.beginFill(color, 0.9);
    startCap.drawRoundedRect(-size / 2, -size / 2, size, size, 6);
    startCap.endFill();
    graphic.addChild(startCap);
    
    container.addChild(graphic);
  }

  private renderSlideNote(container: PIXI.Container, note: EditorNote, color: number, size: number): void {
    const state = this.stateManager.getState();
    const noteSpeed = state.chart.difficultyConfigs[state.currentDifficulty]?.noteSpeed || this.config.noteSpeed;
    const totalWidth = LANE_COUNT * this.config.laneWidth;
    const startX = (this.config.width - totalWidth) / 2;
    
    const endY = getPositionFromTime(note.time + (note.duration || 0), this.config.judgeLineY, noteSpeed, 0) + 35;
    const endX = getXFromLane(note.endLane!, this.config.laneWidth) + startX;
    
    const graphic = new PIXI.Graphics();
    graphic.lineStyle(6, color, 0.6);
    graphic.moveTo(0, 0);
    graphic.lineTo(endX - container.x, endY - container.y);
    
    const startCircle = new PIXI.Graphics();
    startCircle.lineStyle(2, 0xffffff, 0.5);
    startCircle.beginFill(color, 0.9);
    startCircle.drawCircle(0, 0, size / 2);
    startCircle.endFill();
    graphic.addChild(startCircle);
    
    const endCircle = new PIXI.Graphics();
    endCircle.lineStyle(2, 0xffffff, 0.5);
    endCircle.beginFill(color, 0.9);
    endCircle.drawCircle(endX - container.x, endY - container.y, size / 2);
    endCircle.endFill();
    graphic.addChild(endCircle);
    
    container.addChild(graphic);
  }

  private updatePlayhead(currentTime: number, noteSpeed: number): void {
    const existingPlayhead = this.uiLayer.getChildByName('playhead');
    if (existingPlayhead) {
      this.uiLayer.removeChild(existingPlayhead);
      existingPlayhead.destroy();
    }
    
    const y = getPositionFromTime(currentTime, this.config.judgeLineY, noteSpeed, 0) + 35;
    
    const playhead = new PIXI.Graphics();
    playhead.name = 'playhead';
    playhead.lineStyle(2, 0x6bff9d, 0.8);
    playhead.moveTo(10, y);
    playhead.lineTo(this.config.width - 10, y);
    this.uiLayer.addChild(playhead);
    
    const timeText = new PIXI.Text(`${(currentTime / 1000).toFixed(2)}s`, {
      fontFamily: 'monospace',
      fontSize: 11,
      fill: 0x6bff9d
    });
    timeText.anchor.set(0, 0.5);
    timeText.x = 15;
    timeText.y = y - 10;
    playhead.addChild(timeText);
  }

  private clearNotes(): void {
    this.noteSprites.forEach(sprite => {
      this.noteLayer.removeChild(sprite);
      sprite.destroy();
    });
    this.noteSprites.clear();
  }

  clearHoldEffects(): void {
    this.activeHoldEffects.forEach(effect => {
      this.effectLayer.removeChild(effect);
      effect.destroy();
    });
    this.activeHoldEffects.clear();
  }

  destroy(): void {
    if (this.removeStateListener) this.removeStateListener();
    if (this.removePlaybackListener) this.removePlaybackListener();
    this.app.ticker.remove(this.update.bind(this));
    this.clearHoldEffects();
    this.clearNotes();
    this.container.destroy();
  }
}
