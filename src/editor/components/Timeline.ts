import * as PIXI from 'pixi.js';
import { LANE_COUNT, NoteType } from '../../types';
import { EditorStateManager } from '../EditorState';
import { EditorNote, TimelineConfig, DEFAULT_TIMELINE_CONFIG, NOTE_TYPE_COLORS } from '../types';
import { getTimeFromPosition, getPositionFromTime, getLaneFromX, getXFromLane, getBeatInterval } from '../utils/chartUtils';

interface DragState {
  isDragging: boolean;
  noteId: string | null;
  startX: number;
  startY: number;
  startNoteTime: number;
  startNoteLane: number;
}

export class Timeline {
  private stateManager: EditorStateManager;
  private container: PIXI.Container;
  private config: TimelineConfig;
  private noteSprites: Map<string, PIXI.Container> = new Map();
  private gridLines: PIXI.Container;
  private laneDividers: PIXI.Container;
  private noteLayer: PIXI.Container;
  private judgeLine: PIXI.Graphics;
  private currentTimeLine: PIXI.Graphics;
  private timeLabels: PIXI.Container;
  private laneLabels: PIXI.Container;
  
  private dragState: DragState = {
    isDragging: false,
    noteId: null,
    startX: 0,
    startY: 0,
    startNoteTime: 0,
    startNoteLane: 0
  };

  private selectedNoteType: NoteType = 'tap';
  private removeStateListener?: () => void;
  private removePlaybackListener?: () => void;

  constructor(
    _app: PIXI.Application,
    stateManager: EditorStateManager,
    config?: Partial<TimelineConfig>
  ) {
    this.stateManager = stateManager;
    this.config = { ...DEFAULT_TIMELINE_CONFIG, ...config };

    this.container = new PIXI.Container();
    this.gridLines = new PIXI.Container();
    this.laneDividers = new PIXI.Container();
    this.noteLayer = new PIXI.Container();
    this.timeLabels = new PIXI.Container();
    this.laneLabels = new PIXI.Container();

    this.judgeLine = this.createJudgeLine();
    this.currentTimeLine = this.createCurrentTimeLine();

    this.setupContainer();
    this.setupEvents();
    this.setupListeners();
    this.render();
  }

  getContainer(): PIXI.Container {
    return this.container;
  }

  setNoteType(type: NoteType): void {
    this.selectedNoteType = type;
  }

  getNoteType(): NoteType {
    return this.selectedNoteType;
  }

  private setupContainer(): void {
    this.container.addChild(this.gridLines);
    this.container.addChild(this.laneDividers);
    this.container.addChild(this.noteLayer);
    this.container.addChild(this.judgeLine);
    this.container.addChild(this.currentTimeLine);
    this.container.addChild(this.timeLabels);
    this.container.addChild(this.laneLabels);

    this.container.x = 20;
    this.container.y = 20;
    this.container.interactive = true;
    this.container.hitArea = new PIXI.Rectangle(0, 0, this.config.width, this.config.height);
  }

  private setupEvents(): void {
    this.container.on('pointerdown', this.onPointerDown.bind(this));
    this.container.on('pointermove', this.onPointerMove.bind(this));
    this.container.on('pointerup', this.onPointerUp.bind(this));
    this.container.on('pointerupoutside', this.onPointerUp.bind(this));
    this.container.on('wheel', this.onWheel.bind(this));
  }

  private setupListeners(): void {
    this.removeStateListener = this.stateManager.subscribe(() => this.render());
    this.removePlaybackListener = this.stateManager.subscribePlayback(() => this.updateCurrentTimeLine());
  }

  private createJudgeLine(): PIXI.Graphics {
    const line = new PIXI.Graphics();
    line.lineStyle(3, 0xffd700, 0.8);
    line.moveTo(0, this.config.judgeLineY);
    line.lineTo(this.config.width, this.config.judgeLineY);
    
    const indicator = new PIXI.Graphics();
    indicator.beginFill(0xffd700, 0.8);
    indicator.moveTo(this.config.width - 20, this.config.judgeLineY - 10);
    indicator.lineTo(this.config.width, this.config.judgeLineY);
    indicator.lineTo(this.config.width - 20, this.config.judgeLineY + 10);
    indicator.closePath();
    indicator.endFill();
    line.addChild(indicator);

    return line;
  }

  private createCurrentTimeLine(): PIXI.Graphics {
    const line = new PIXI.Graphics();
    line.lineStyle(2, 0x6bff9d, 0.6);
    line.moveTo(0, 0);
    line.lineTo(this.config.width, 0);
    line.visible = false;
    return line;
  }

  private onPointerDown(e: PIXI.FederatedPointerEvent): void {
    const { x, y } = e.global;
    const localPos = this.container.toLocal({ x, y });
    
    const clickedNote = this.findNoteAtPosition(localPos.x, localPos.y);
    
    if (clickedNote) {
      this.startDrag(clickedNote, localPos.x, localPos.y);
    } else if (e.button === 0) {
      this.addNoteAtPosition(localPos.x, localPos.y);
    }
  }

  private onPointerMove(e: PIXI.FederatedPointerEvent): void {
    if (!this.dragState.isDragging || !this.dragState.noteId) return;

    const { x, y } = e.global;
    const localPos = this.container.toLocal({ x, y });
    
    const state = this.stateManager.getState();
    const noteSpeed = state.chart.difficultyConfigs[state.currentDifficulty]?.noteSpeed || 400;
    
    const deltaY = localPos.y - this.dragState.startY;
    const deltaTime = -(deltaY / noteSpeed) * 1000 / state.zoom;
    let newTime = this.dragState.startNoteTime + deltaTime;
    
    const newLane = getLaneFromX(localPos.x, this.config.laneHeight);
    
    this.stateManager.moveNote(this.dragState.noteId, newTime, newLane);
  }

  private onPointerUp(): void {
    this.endDrag();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const state = this.stateManager.getState();
    
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      this.stateManager.setZoom(state.zoom + delta);
    } else {
      const scrollSpeed = 50;
      const newOffset = state.scrollOffset + e.deltaY * (scrollSpeed / 100);
      this.stateManager.setScrollOffset(newOffset);
    }
  }

  private findNoteAtPosition(x: number, y: number): EditorNote | null {
    const state = this.stateManager.getState();
    const noteSpeed = state.chart.difficultyConfigs[state.currentDifficulty]?.noteSpeed || 400;
    
    for (const note of state.notes) {
      const noteY = getPositionFromTime(note.time, this.config.judgeLineY, noteSpeed, state.scrollOffset) * state.zoom;
      const noteX = getXFromLane(note.lane, this.config.laneHeight);
      
      const halfWidth = this.config.noteWidth / 2;
      const halfHeight = this.config.noteHeight / 2;
      
      if (
        x >= noteX - halfWidth &&
        x <= noteX + halfWidth &&
        y >= noteY - halfHeight &&
        y <= noteY + halfHeight
      ) {
        return note;
      }
    }
    return null;
  }

  private startDrag(note: EditorNote, x: number, y: number): void {
    this.dragState = {
      isDragging: true,
      noteId: note.id,
      startX: x,
      startY: y,
      startNoteTime: note.time,
      startNoteLane: note.lane
    };
    this.stateManager.selectNote(note.id);
  }

  private endDrag(): void {
    this.dragState.isDragging = false;
    this.dragState.noteId = null;
  }

  private addNoteAtPosition(x: number, y: number): void {
    const state = this.stateManager.getState();
    const noteSpeed = state.chart.difficultyConfigs[state.currentDifficulty]?.noteSpeed || 400;
    
    const time = getTimeFromPosition(y / state.zoom, this.config.judgeLineY, noteSpeed, state.scrollOffset);
    const lane = getLaneFromX(x, this.config.laneHeight);
    
    const beatInterval = getBeatInterval(state.chart.bpm);
    
    this.stateManager.addNote({
      time,
      lane,
      lyricChar: '♪',
      type: this.selectedNoteType,
      duration: this.selectedNoteType === 'tap' ? undefined : beatInterval,
      endLane: this.selectedNoteType === 'slide' ? (lane + 1) % LANE_COUNT : undefined
    });
  }

  private updateCurrentTimeLine(): void {
    const playbackState = this.stateManager.getPlaybackState();
    const state = this.stateManager.getState();
    const noteSpeed = state.chart.difficultyConfigs[state.currentDifficulty]?.noteSpeed || 400;
    
    const y = getPositionFromTime(
      playbackState.currentTime,
      this.config.judgeLineY,
      noteSpeed,
      state.scrollOffset
    ) * state.zoom;
    
    this.currentTimeLine.y = y;
    this.currentTimeLine.visible = playbackState.isPlaying || playbackState.currentTime > 0;
  }

  private render(): void {
    this.clearAll();
    this.renderGridLines();
    this.renderLaneDividers();
    this.renderNotes();
    this.renderTimeLabels();
    this.renderLaneLabels();
    this.updateCurrentTimeLine();
  }

  private clearAll(): void {
    this.noteSprites.forEach(sprite => {
      this.noteLayer.removeChild(sprite);
      sprite.destroy();
    });
    this.noteSprites.clear();
    
    this.gridLines.removeChildren();
    this.laneDividers.removeChildren();
    this.timeLabels.removeChildren();
    this.laneLabels.removeChildren();
  }

  private renderGridLines(): void {
    const state = this.stateManager.getState();
    const beatInterval = getBeatInterval(state.chart.bpm);
    const noteSpeed = state.chart.difficultyConfigs[state.currentDifficulty]?.noteSpeed || 400;
    
    const gridIntervalMs = beatInterval * state.gridInterval;
    const pixelsPerGrid = (gridIntervalMs / 1000) * noteSpeed * state.zoom;
    
    const startY = -state.scrollOffset * state.zoom;
    const endY = this.config.height;
    
    let currentY = this.config.judgeLineY * state.zoom;
    let currentTime = 0;
    
    while (currentY < endY) {
      if (currentY > startY) {
        const isBeat = currentTime % beatInterval < 1;
        const isBar = currentTime % (beatInterval * 4) < 1;
        
        const line = new PIXI.Graphics();
        const alpha = isBar ? 0.4 : isBeat ? 0.2 : 0.1;
        const thickness = isBar ? 2 : isBeat ? 1 : 0.5;
        
        line.lineStyle(thickness, 0x666666, alpha);
        line.moveTo(0, currentY);
        line.lineTo(this.config.width, currentY);
        
        this.gridLines.addChild(line);
      }
      
      currentY += pixelsPerGrid;
      currentTime += gridIntervalMs;
    }
    
    currentY = this.config.judgeLineY * state.zoom - pixelsPerGrid;
    currentTime = -gridIntervalMs;
    
    while (currentY > startY) {
      if (currentY < endY) {
        const isBeat = Math.abs(currentTime) % beatInterval < 1;
        const isBar = Math.abs(currentTime) % (beatInterval * 4) < 1;
        
        const line = new PIXI.Graphics();
        const alpha = isBar ? 0.4 : isBeat ? 0.2 : 0.1;
        const thickness = isBar ? 2 : isBeat ? 1 : 0.5;
        
        line.lineStyle(thickness, 0x666666, alpha);
        line.moveTo(0, currentY);
        line.lineTo(this.config.width, currentY);
        
        this.gridLines.addChild(line);
      }
      
      currentY -= pixelsPerGrid;
      currentTime -= gridIntervalMs;
    }
  }

  private renderLaneDividers(): void {
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = i * this.config.laneHeight;
      const line = new PIXI.Graphics();
      line.lineStyle(1, 0x444444, 0.3);
      line.moveTo(x, 0);
      line.lineTo(x, this.config.height);
      this.laneDividers.addChild(line);
    }
  }

  private renderNotes(): void {
    const state = this.stateManager.getState();
    const noteSpeed = state.chart.difficultyConfigs[state.currentDifficulty]?.noteSpeed || 400;
    
    state.notes.forEach(note => {
      const sprite = this.createNoteSprite(note, noteSpeed, state.zoom, state.scrollOffset);
      if (sprite) {
        this.noteLayer.addChild(sprite);
        this.noteSprites.set(note.id, sprite);
      }
    });
  }

  private createNoteSprite(
    note: EditorNote,
    noteSpeed: number,
    zoom: number,
    scrollOffset: number
  ): PIXI.Container | null {
    const y = getPositionFromTime(note.time, this.config.judgeLineY, noteSpeed, scrollOffset) * zoom;
    
    if (y < -50 || y > this.config.height + 50) return null;
    
    const container = new PIXI.Container();
    const x = getXFromLane(note.lane, this.config.laneHeight);
    container.x = x;
    container.y = y;
    
    const color = NOTE_TYPE_COLORS[note.type];
    const isSelected = note.id === this.stateManager.getState().selectedNoteId;
    
    if (note.type === 'hold' && note.duration) {
      this.renderHoldNote(container, note, color, isSelected, noteSpeed, zoom, scrollOffset);
    } else if (note.type === 'slide' && note.endLane !== undefined && note.duration) {
      this.renderSlideNote(container, note, color, isSelected, noteSpeed, zoom, scrollOffset);
    } else {
      this.renderTapNote(container, note, color, isSelected);
    }
    
    const text = new PIXI.Text(note.lyricChar, {
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0xffffff,
      align: 'center'
    });
    text.anchor.set(0.5);
    text.y = -2;
    container.addChild(text);
    
    return container;
  }

  private renderTapNote(container: PIXI.Container, _note: EditorNote, color: number, isSelected: boolean): void {
    const graphic = new PIXI.Graphics();
    
    if (isSelected) {
      graphic.lineStyle(3, 0xffd700, 1);
    }
    
    graphic.beginFill(color, 0.8);
    graphic.drawRoundedRect(
      -this.config.noteWidth / 2,
      -this.config.noteHeight / 2,
      this.config.noteWidth,
      this.config.noteHeight,
      4
    );
    graphic.endFill();
    
    container.addChild(graphic);
  }

  private renderHoldNote(
    container: PIXI.Container,
    note: EditorNote,
    color: number,
    isSelected: boolean,
    noteSpeed: number,
    zoom: number,
    scrollOffset: number
  ): void {
    const endY = getPositionFromTime(note.time + (note.duration || 0), this.config.judgeLineY, noteSpeed, scrollOffset) * zoom;
    const height = Math.abs(endY - container.y);
    
    const graphic = new PIXI.Graphics();
    
    if (isSelected) {
      graphic.lineStyle(3, 0xffd700, 1);
    }
    
    graphic.beginFill(color, 0.6);
    graphic.drawRoundedRect(
      -this.config.noteWidth / 2 + 5,
      -height,
      this.config.noteWidth - 10,
      height + this.config.noteHeight,
      4
    );
    graphic.endFill();
    
    const endCap = new PIXI.Graphics();
    endCap.beginFill(color, 0.9);
    endCap.drawRoundedRect(
      -this.config.noteWidth / 2,
      -height - this.config.noteHeight / 2,
      this.config.noteWidth,
      this.config.noteHeight,
      4
    );
    endCap.endFill();
    graphic.addChild(endCap);
    
    const startCap = new PIXI.Graphics();
    startCap.beginFill(color, 0.9);
    startCap.drawRoundedRect(
      -this.config.noteWidth / 2,
      -this.config.noteHeight / 2,
      this.config.noteWidth,
      this.config.noteHeight,
      4
    );
    startCap.endFill();
    graphic.addChild(startCap);
    
    container.addChild(graphic);
  }

  private renderSlideNote(
    container: PIXI.Container,
    note: EditorNote,
    color: number,
    isSelected: boolean,
    noteSpeed: number,
    zoom: number,
    scrollOffset: number
  ): void {
    const endY = getPositionFromTime(note.time + (note.duration || 0), this.config.judgeLineY, noteSpeed, scrollOffset) * zoom;
    const endX = getXFromLane(note.endLane!, this.config.laneHeight);
    const startX = container.x;
    const startY = container.y;
    
    const graphic = new PIXI.Graphics();
    
    if (isSelected) {
      graphic.lineStyle(4, 0xffd700, 1);
    } else {
      graphic.lineStyle(8, color, 0.4);
    }
    
    graphic.moveTo(0, 0);
    graphic.lineTo(endX - startX, endY - startY);
    
    const arrowHead = new PIXI.Graphics();
    arrowHead.beginFill(color, 0.9);
    arrowHead.moveTo(endX - startX - 10, endY - startY - 5);
    arrowHead.lineTo(endX - startX, endY - startY);
    arrowHead.lineTo(endX - startX - 10, endY - startY + 5);
    arrowHead.closePath();
    arrowHead.endFill();
    graphic.addChild(arrowHead);
    
    const startCircle = new PIXI.Graphics();
    startCircle.beginFill(color, 0.9);
    startCircle.drawCircle(0, 0, 12);
    startCircle.endFill();
    graphic.addChild(startCircle);
    
    const endCircle = new PIXI.Graphics();
    endCircle.beginFill(color, 0.9);
    endCircle.drawCircle(endX - startX, endY - startY, 12);
    endCircle.endFill();
    graphic.addChild(endCircle);
    
    container.addChild(graphic);
  }

  private renderTimeLabels(): void {
    const state = this.stateManager.getState();
    const beatInterval = getBeatInterval(state.chart.bpm);
    const noteSpeed = state.chart.difficultyConfigs[state.currentDifficulty]?.noteSpeed || 400;
    
    const labelIntervalMs = beatInterval * 4;
    const pixelsPerLabel = (labelIntervalMs / 1000) * noteSpeed * state.zoom;
    
    const startY = -state.scrollOffset * state.zoom;
    const endY = this.config.height;
    
    let currentY = this.config.judgeLineY * state.zoom;
    let currentTime = 0;
    let barNumber = 0;
    
    while (currentY < endY) {
      if (currentY > startY) {
        const label = new PIXI.Text(`B${barNumber + 1}`, {
          fontFamily: 'monospace',
          fontSize: 10,
          fill: 0x888888
        });
        label.anchor.set(0, 0.5);
        label.x = 5;
        label.y = currentY;
        this.timeLabels.addChild(label);
      }
      
      currentY += pixelsPerLabel;
      currentTime += labelIntervalMs;
      barNumber++;
    }
    
    currentY = this.config.judgeLineY * state.zoom - pixelsPerLabel;
    barNumber = -1;
    
    while (currentY > startY) {
      if (currentY < endY && barNumber >= 0) {
        const label = new PIXI.Text(`B${barNumber + 1}`, {
          fontFamily: 'monospace',
          fontSize: 10,
          fill: 0x888888
        });
        label.anchor.set(0, 0.5);
        label.x = 5;
        label.y = currentY;
        this.timeLabels.addChild(label);
      }
      
      currentY -= pixelsPerLabel;
      barNumber--;
    }
  }

  private renderLaneLabels(): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const label = new PIXI.Text(`L${i + 1}`, {
        fontFamily: 'sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0x666666,
        align: 'center'
      });
      label.anchor.set(0.5);
      label.x = getXFromLane(i, this.config.laneHeight);
      label.y = this.config.height - 15;
      this.laneLabels.addChild(label);
    }
  }

  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.container.hitArea = new PIXI.Rectangle(0, 0, width, height);
    this.render();
  }

  destroy(): void {
    if (this.removeStateListener) this.removeStateListener();
    if (this.removePlaybackListener) this.removePlaybackListener();
    this.container.destroy();
  }
}
