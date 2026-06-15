import * as PIXI from 'pixi.js';
import { Difficulty, NoteType, LANE_COUNT } from '../../types';
import { EditorStateManager } from '../EditorState';
import { NOTE_TYPE_COLORS, NOTE_TYPE_LABELS } from '../types';
import { importChartFromJSON, exportChartToJSON, getNoteCountByType, getTotalDuration, getBeatInterval } from '../utils/chartUtils';

interface PanelConfig {
  width: number;
  height: number;
}

const DEFAULT_CONFIG: PanelConfig = {
  width: 320,
  height: 600
};

export class PropertyPanel {
  private app: PIXI.Application;
  private stateManager: EditorStateManager;
  private container: PIXI.Container;
  private config: PanelConfig;
  private contentContainer: PIXI.Container;
  
  private removeStateListener?: () => void;
  private removePlaybackListener?: () => void;

  constructor(
    app: PIXI.Application,
    stateManager: EditorStateManager,
    config?: Partial<PanelConfig>
  ) {
    this.app = app;
    this.stateManager = stateManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.container = new PIXI.Container();
    this.contentContainer = new PIXI.Container();
    
    this.setupContainer();
    this.setupListeners();
    this.render();
  }

  getContainer(): PIXI.Container {
    return this.container;
  }

  private setupContainer(): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a1a2e, 0.95);
    bg.drawRoundedRect(0, 0, this.config.width, this.config.height, 8);
    bg.endFill();
    bg.lineStyle(2, 0x333355, 0.8);
    bg.drawRoundedRect(0, 0, this.config.width, this.config.height, 8);
    this.container.addChild(bg);
    
    const title = new PIXI.Text('属性面板', {
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xffffff
    });
    title.anchor.set(0.5, 0);
    title.x = this.config.width / 2;
    title.y = 12;
    this.container.addChild(title);
    
    const scrollMask = new PIXI.Graphics();
    scrollMask.beginFill(0xffffff);
    scrollMask.drawRect(10, 40, this.config.width - 20, this.config.height - 50);
    scrollMask.endFill();
    
    this.contentContainer.mask = scrollMask;
    this.contentContainer.y = 40;
    this.contentContainer.x = 10;
    
    this.container.addChild(scrollMask);
    this.container.addChild(this.contentContainer);
  }

  private setupListeners(): void {
    this.removeStateListener = this.stateManager.subscribe(() => this.render());
    this.removePlaybackListener = this.stateManager.subscribePlayback(() => this.render());
  }

  private render(): void {
    this.contentContainer.removeChildren();
    
    let y = 0;
    const sectionSpacing = 15;
    
    y = this.renderChartInfo(y);
    y += sectionSpacing;
    
    y = this.renderDifficultySelector(y);
    y += sectionSpacing;
    
    y = this.renderNoteTypeSelector(y);
    y += sectionSpacing;
    
    y = this.renderGridSettings(y);
    y += sectionSpacing;
    
    y = this.renderPlaybackControls(y);
    y += sectionSpacing;
    
    y = this.renderSelectedNoteProperties(y);
    y += sectionSpacing;
    
    y = this.renderStatistics(y);
    y += sectionSpacing;
    
    y = this.renderActionButtons(y);
  }

  private renderChartInfo(y: number): number {
    const state = this.stateManager.getState();
    
    this.createSectionTitle('谱面信息', y);
    y += 25;
    
    y = this.createInputField('标题', state.chart.title, y, (value) => {
      this.stateManager.updateChartConfig({ title: value });
    });
    
    y = this.createInputField('艺术家', state.chart.artist, y, (value) => {
      this.stateManager.updateChartConfig({ artist: value });
    });
    
    y = this.createNumberInput('BPM', state.chart.bpm, y, 60, 300, (value) => {
      this.stateManager.updateChartConfig({ bpm: value });
    });
    
    y = this.createTextArea('歌词', state.chart.lyrics, y, (value) => {
      this.stateManager.updateChartConfig({ lyrics: value });
    });
    
    return y;
  }

  private renderDifficultySelector(y: number): number {
    const state = this.stateManager.getState();
    const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
    const labels = { easy: '简单', normal: '普通', hard: '困难' };
    
    this.createSectionTitle('难度选择', y);
    y += 25;
    
    const buttonContainer = new PIXI.Container();
    buttonContainer.y = y;
    
    difficulties.forEach((diff, i) => {
      const isActive = state.currentDifficulty === diff;
      const button = this.createButton(
        labels[diff],
        i * 95,
        0,
        90,
        30,
        isActive ? 0x6b9dff : 0x333355,
        () => this.stateManager.setDifficulty(diff)
      );
      buttonContainer.addChild(button);
    });
    
    this.contentContainer.addChild(buttonContainer);
    y += 38;
    
    const config = state.chart.difficultyConfigs[state.currentDifficulty];
    if (config) {
      y = this.createNumberInput('音符速度', config.noteSpeed, y, 100, 800, (value) => {
        const newConfigs = { ...state.chart.difficultyConfigs };
        newConfigs[state.currentDifficulty] = { ...config, noteSpeed: value };
        this.stateManager.updateChartConfig({ difficultyConfigs: newConfigs });
      });
      
      y = this.createNumberInput('星级', config.starLevel, y, 1, 10, (value) => {
        const newConfigs = { ...state.chart.difficultyConfigs };
        newConfigs[state.currentDifficulty] = { ...config, starLevel: value };
        this.stateManager.updateChartConfig({ difficultyConfigs: newConfigs });
      });
    }
    
    return y;
  }

  private renderNoteTypeSelector(y: number): number {
    const types: NoteType[] = ['tap', 'hold', 'slide'];
    
    this.createSectionTitle('音符类型（点击时间轴添加）', y);
    y += 25;
    
    const buttonContainer = new PIXI.Container();
    buttonContainer.y = y;
    
    types.forEach((type, i) => {
      const color = NOTE_TYPE_COLORS[type];
      const button = this.createButton(
        NOTE_TYPE_LABELS[type],
        i * 95,
        0,
        90,
        30,
        color,
        () => {
          const timeline = (window as any).__editorTimeline;
          if (timeline) {
            timeline.setNoteType(type);
          }
        }
      );
      buttonContainer.addChild(button);
    });
    
    this.contentContainer.addChild(buttonContainer);
    y += 38;
    
    const lyricInput = this.createInputField(
      '默认歌词字符',
      '♪',
      y,
      (_value) => {
        // 可以在这里设置默认歌词字符
      }
    );
    
    return lyricInput;
  }

  private renderGridSettings(y: number): number {
    const state = this.stateManager.getState();
    
    this.createSectionTitle('网格设置', y);
    y += 25;
    
    y = this.createCheckbox('对齐网格', state.snapToGrid, y, (checked) => {
      this.stateManager.setSnapToGrid(checked);
    });
    
    const gridOptions = [
      { label: '1/1 拍', value: 1 },
      { label: '1/2 拍', value: 0.5 },
      { label: '1/4 拍', value: 0.25 },
      { label: '1/8 拍', value: 0.125 }
    ];
    
    this.createLabel('网格间隔', y);
    y += 20;
    
    const optionContainer = new PIXI.Container();
    optionContainer.y = y;
    
    gridOptions.forEach((opt, i) => {
      const isActive = Math.abs(state.gridInterval - opt.value) < 0.001;
      const button = this.createButton(
        opt.label,
        i * 72,
        0,
        68,
        24,
        isActive ? 0xffd700 : 0x333355,
        () => this.stateManager.setGridInterval(opt.value),
        11
      );
      optionContainer.addChild(button);
    });
    
    this.contentContainer.addChild(optionContainer);
    y += 32;
    
    y = this.createSlider('缩放', state.zoom, 0.25, 3, y, (value) => {
      this.stateManager.setZoom(value);
    });
    
    return y;
  }

  private renderPlaybackControls(y: number): number {
    const playbackState = this.stateManager.getPlaybackState();
    
    this.createSectionTitle('回放控制', y);
    y += 25;
    
    const buttonContainer = new PIXI.Container();
    buttonContainer.y = y;
    
    const playButton = this.createButton(
      playbackState.isPlaying ? '⏸ 暂停' : '▶ 播放',
      0,
      0,
      80,
      32,
      playbackState.isPlaying ? 0xffd700 : 0x6bff9d,
      () => {
        if (playbackState.isPlaying) {
          this.stateManager.setPlaying(false);
        } else {
          this.stateManager.setPlaybackTime(0);
          this.stateManager.setPlaying(true);
        }
      }
    );
    buttonContainer.addChild(playButton);
    
    const stopButton = this.createButton(
      '⏹ 停止',
      85,
      0,
      70,
      32,
      0xff6b6b,
      () => {
        this.stateManager.setPlaying(false);
        this.stateManager.setPlaybackTime(0);
      }
    );
    buttonContainer.addChild(stopButton);
    
    this.contentContainer.addChild(buttonContainer);
    y += 40;
    
    y = this.createSlider(
      '播放速度',
      playbackState.playbackSpeed,
      0.25,
      2,
      y,
      (value) => this.stateManager.setPlaybackSpeed(value),
      'x'
    );
    
    y = this.createCheckbox('循环播放', playbackState.loopEnabled, y, (checked) => {
      this.stateManager.setLoopEnabled(checked);
    });
    
    if (playbackState.loopEnabled) {
      const beatInterval = getBeatInterval(this.stateManager.getState().chart.bpm);
      y = this.createNumberInput(
        '循环开始(拍)',
        playbackState.loopStartTime / beatInterval,
        y,
        0,
        100,
        (value) => {
          const end = this.stateManager.getPlaybackState().loopEndTime;
          this.stateManager.setLoopRange(value * beatInterval, Math.max(value * beatInterval, end));
        }
      );
      
      y = this.createNumberInput(
        '循环结束(拍)',
        playbackState.loopEndTime / beatInterval,
        y,
        0,
        100,
        (value) => {
          const start = this.stateManager.getPlaybackState().loopStartTime;
          this.stateManager.setLoopRange(Math.min(start, value * beatInterval), value * beatInterval);
        }
      );
    }
    
    const timeLabel = new PIXI.Text(
      `当前时间: ${(playbackState.currentTime / 1000).toFixed(2)}s`,
      {
        fontFamily: 'monospace',
        fontSize: 12,
        fill: 0x88ccff
      }
    );
    timeLabel.y = y;
    this.contentContainer.addChild(timeLabel);
    y += 20;
    
    return y;
  }

  private renderSelectedNoteProperties(y: number): number {
    const selectedNote = this.stateManager.getSelectedNote();
    
    this.createSectionTitle('选中音符属性', y);
    y += 25;
    
    if (!selectedNote) {
      const hint = new PIXI.Text('请在时间轴上选择一个音符', {
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: 0x888888,
        fontStyle: 'italic'
      });
      hint.y = y;
      this.contentContainer.addChild(hint);
      return y + 25;
    }
    
    y = this.createNumberInput(
      '时间 (ms)',
      selectedNote.time,
      y,
      0,
      100000,
      (value) => {
        this.stateManager.updateNote(selectedNote.id, { time: value });
      }
    );
    
    y = this.createNumberInput(
      '轨道',
      selectedNote.lane,
      y,
      0,
      LANE_COUNT - 1,
      (value) => {
        this.stateManager.updateNote(selectedNote.id, { lane: value });
      }
    );
    
    y = this.createInputField(
      '歌词字符',
      selectedNote.lyricChar,
      y,
      (value) => {
        this.stateManager.updateNote(selectedNote.id, { lyricChar: value.charAt(0) || '♪' });
      }
    );
    
    if (selectedNote.type === 'hold' || selectedNote.type === 'slide') {
      y = this.createNumberInput(
        '持续时间 (ms)',
        selectedNote.duration || 0,
        y,
        50,
        5000,
        (value) => {
          this.stateManager.updateNote(selectedNote.id, { duration: value });
        }
      );
    }
    
    if (selectedNote.type === 'slide') {
      y = this.createNumberInput(
        '结束轨道',
        selectedNote.endLane || 0,
        y,
        0,
        LANE_COUNT - 1,
        (value) => {
          this.stateManager.updateNote(selectedNote.id, { endLane: value });
        }
      );
    }
    
    const deleteButton = this.createButton(
      '🗑 删除音符',
      0,
      y,
      this.config.width - 20,
      30,
      0xff6b6b,
      () => {
        this.stateManager.deleteNote(selectedNote.id);
      }
    );
    this.contentContainer.addChild(deleteButton);
    y += 38;
    
    return y;
  }

  private renderStatistics(y: number): number {
    const state = this.stateManager.getState();
    const notes = this.stateManager.getCurrentNoteData();
    const typeCounts = getNoteCountByType(notes);
    const totalDuration = getTotalDuration(notes, state.chart.bpm);
    
    this.createSectionTitle('统计信息', y);
    y += 25;
    
    const stats = [
      { label: '总音符数', value: notes.length.toString() },
      { label: '点击 (tap)', value: (typeCounts.tap || 0).toString(), color: NOTE_TYPE_COLORS.tap },
      { label: '长按 (hold)', value: (typeCounts.hold || 0).toString(), color: NOTE_TYPE_COLORS.hold },
      { label: '滑键 (slide)', value: (typeCounts.slide || 0).toString(), color: NOTE_TYPE_COLORS.slide },
      { label: '总时长', value: `${(totalDuration / 1000).toFixed(1)}s` }
    ];
    
    stats.forEach(stat => {
      const label = new PIXI.Text(`${stat.label}:`, {
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: 0xaaaaaa
      });
      label.y = y;
      this.contentContainer.addChild(label);
      
      const value = new PIXI.Text(stat.value, {
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: stat.color || 0xffffff
      });
      value.anchor.set(1, 0);
      value.x = this.config.width - 20;
      value.y = y;
      this.contentContainer.addChild(value);
      
      y += 20;
    });
    
    return y;
  }

  private renderActionButtons(y: number): number {
    this.createSectionTitle('操作', y);
    y += 25;
    
    const generateButton = this.createButton(
      '✨ 从歌词生成',
      0,
      y,
      this.config.width - 20,
      30,
      0x9b59b6,
      () => {
        const lyrics = this.stateManager.getState().chart.lyrics;
        if (lyrics) {
          this.stateManager.generateNotesFromLyrics(lyrics);
        }
      }
    );
    this.contentContainer.addChild(generateButton);
    y += 38;
    
    const clearButton = this.createButton(
      '🗑 清空所有音符',
      0,
      y,
      this.config.width - 20,
      30,
      0xff6b6b,
      () => {
        if (confirm('确定要清空所有音符吗？此操作可撤销。')) {
          this.stateManager.clearAllNotes();
        }
      }
    );
    this.contentContainer.addChild(clearButton);
    y += 38;
    
    const undoButton = this.createButton(
      '↶ 撤销 (Ctrl+Z)',
      0,
      y,
      140,
      30,
      0x666688,
      () => this.stateManager.undo()
    );
    this.contentContainer.addChild(undoButton);
    
    const redoButton = this.createButton(
      '↷ 重做 (Ctrl+Y)',
      150,
      y,
      140,
      30,
      0x666688,
      () => this.stateManager.redo()
    );
    this.contentContainer.addChild(redoButton);
    y += 38;
    
    const importButton = this.createButton(
      '📂 导入谱面',
      0,
      y,
      140,
      30,
      0x6b9dff,
      () => this.handleImport()
    );
    this.contentContainer.addChild(importButton);
    
    const exportButton = this.createButton(
      '💾 导出谱面',
      150,
      y,
      140,
      30,
      0x6bff9d,
      () => this.handleExport()
    );
    this.contentContainer.addChild(exportButton);
    y += 38;
    
    return y;
  }

  private createSectionTitle(text: string, y: number): void {
    const title = new PIXI.Text(text, {
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffd700
    });
    title.y = y;
    this.contentContainer.addChild(title);
    
    const line = new PIXI.Graphics();
    line.lineStyle(1, 0x444466, 0.5);
    line.moveTo(0, y + 18);
    line.lineTo(this.config.width - 20, y + 18);
    this.contentContainer.addChild(line);
  }

  private createLabel(text: string, y: number): void {
    const label = new PIXI.Text(text, {
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0xcccccc
    });
    label.y = y;
    this.contentContainer.addChild(label);
  }

  private createInputField(
    label: string,
    value: string,
    y: number,
    onChange: (value: string) => void
  ): number {
    this.createLabel(label, y);
    y += 20;
    
    const inputBg = new PIXI.Graphics();
    inputBg.beginFill(0x2a2a4a);
    inputBg.drawRoundedRect(0, y, this.config.width - 20, 26, 4);
    inputBg.endFill();
    inputBg.lineStyle(1, 0x444466, 0.8);
    inputBg.drawRoundedRect(0, y, this.config.width - 20, 26, 4);
    this.contentContainer.addChild(inputBg);
    
    const text = new PIXI.Text(value, {
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0xffffff
    });
    text.anchor.set(0, 0.5);
    text.x = 8;
    text.y = y + 13;
    this.contentContainer.addChild(text);
    
    inputBg.interactive = true;
    inputBg.cursor = 'text';
    inputBg.on('pointerdown', () => {
      const newValue = prompt(`输入${label}:`, value);
      if (newValue !== null) {
        onChange(newValue);
      }
    });
    
    return y + 34;
  }

  private createTextArea(
    label: string,
    value: string,
    y: number,
    onChange: (value: string) => void
  ): number {
    this.createLabel(label, y);
    y += 20;
    
    const inputBg = new PIXI.Graphics();
    inputBg.beginFill(0x2a2a4a);
    inputBg.drawRoundedRect(0, y, this.config.width - 20, 60, 4);
    inputBg.endFill();
    inputBg.lineStyle(1, 0x444466, 0.8);
    inputBg.drawRoundedRect(0, y, this.config.width - 20, 60, 4);
    this.contentContainer.addChild(inputBg);
    
    const displayText = value.length > 30 ? value.substring(0, 30) + '...' : value;
    const text = new PIXI.Text(displayText, {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fill: 0xffffff,
      wordWrap: true,
      wordWrapWidth: this.config.width - 40
    });
    text.anchor.set(0, 0);
    text.x = 8;
    text.y = y + 8;
    this.contentContainer.addChild(text);
    
    inputBg.interactive = true;
    inputBg.cursor = 'text';
    inputBg.on('pointerdown', () => {
      const newValue = prompt(`输入${label}:`, value);
      if (newValue !== null) {
        onChange(newValue);
      }
    });
    
    return y + 68;
  }

  private createNumberInput(
    label: string,
    value: number,
    y: number,
    min: number,
    max: number,
    onChange: (value: number) => void
  ): number {
    this.createLabel(label, y);
    y += 20;
    
    const container = new PIXI.Container();
    container.y = y;
    
    const inputBg = new PIXI.Graphics();
    inputBg.beginFill(0x2a2a4a);
    inputBg.drawRoundedRect(30, 0, this.config.width - 80, 26, 4);
    inputBg.endFill();
    inputBg.lineStyle(1, 0x444466, 0.8);
    inputBg.drawRoundedRect(30, 0, this.config.width - 80, 26, 4);
    container.addChild(inputBg);
    
    const text = new PIXI.Text(value.toString(), {
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0xffffff
    });
    text.anchor.set(0, 0.5);
    text.x = 38;
    text.y = 13;
    container.addChild(text);
    
    const minusBtn = this.createButton('-', 0, 0, 26, 26, 0x666688, () => {
      onChange(Math.max(min, value - 1));
    });
    container.addChild(minusBtn);
    
    const plusBtn = this.createButton('+', this.config.width - 50, 0, 26, 26, 0x666688, () => {
      onChange(Math.min(max, value + 1));
    });
    container.addChild(plusBtn);
    
    inputBg.interactive = true;
    inputBg.cursor = 'text';
    inputBg.on('pointerdown', () => {
      const newValue = prompt(`输入${label} (${min}-${max}):`, value.toString());
      if (newValue !== null) {
        const num = parseFloat(newValue);
        if (!isNaN(num)) {
          onChange(Math.max(min, Math.min(max, num)));
        }
      }
    });
    
    this.contentContainer.addChild(container);
    return y + 34;
  }

  private createCheckbox(
    label: string,
    checked: boolean,
    y: number,
    onChange: (checked: boolean) => void
  ): number {
    const container = new PIXI.Container();
    container.y = y;
    container.interactive = true;
    container.cursor = 'pointer';
    
    const box = new PIXI.Graphics();
    box.beginFill(checked ? 0x6bff9d : 0x2a2a4a);
    box.drawRoundedRect(0, 0, 18, 18, 3);
    box.endFill();
    box.lineStyle(1, 0x444466, 0.8);
    box.drawRoundedRect(0, 0, 18, 18, 3);
    container.addChild(box);
    
    if (checked) {
      const check = new PIXI.Text('✓', {
        fontFamily: 'sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0x000000
      });
      check.anchor.set(0.5);
      check.x = 9;
      check.y = 9;
      container.addChild(check);
    }
    
    const text = new PIXI.Text(label, {
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0xcccccc
    });
    text.x = 26;
    text.y = 1;
    container.addChild(text);
    
    container.on('pointerdown', () => onChange(!checked));
    
    this.contentContainer.addChild(container);
    return y + 26;
  }

  private createSlider(
    label: string,
    value: number,
    min: number,
    max: number,
    y: number,
    onChange: (value: number) => void,
    suffix: string = ''
  ): number {
    this.createLabel(`${label}: ${value.toFixed(2)}${suffix}`, y);
    y += 20;
    
    const sliderWidth = this.config.width - 20;
    const track = new PIXI.Graphics();
    track.beginFill(0x2a2a4a);
    track.drawRoundedRect(0, y, sliderWidth, 8, 4);
    track.endFill();
    this.contentContainer.addChild(track);
    
    const progress = (value - min) / (max - min);
    const fill = new PIXI.Graphics();
    fill.beginFill(0x6b9dff);
    fill.drawRoundedRect(0, y, sliderWidth * progress, 8, 4);
    fill.endFill();
    this.contentContainer.addChild(fill);
    
    const thumb = new PIXI.Graphics();
    thumb.beginFill(0xffffff);
    thumb.drawCircle(sliderWidth * progress, y + 4, 8);
    thumb.endFill();
    thumb.interactive = true;
    thumb.cursor = 'pointer';
    this.contentContainer.addChild(thumb);
    
    let isDragging = false;
    
    const updateValue = (x: number) => {
      const newProgress = Math.max(0, Math.min(1, (x - thumb.x + sliderWidth * progress) / sliderWidth));
      const newValue = min + newProgress * (max - min);
      onChange(Math.round(newValue * 100) / 100);
    };
    
    thumb.on('pointerdown', () => {
      isDragging = true;
    });
    
    this.app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (isDragging) {
        const localPos = this.contentContainer.toLocal({ x: e.global.x, y: e.global.y });
        updateValue(localPos.x);
      }
    });
    
    this.app.stage.on('pointerup', () => {
      isDragging = false;
    });
    
    return y + 24;
  }

  private createButton(
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    onClick: () => void,
    fontSize: number = 12
  ): PIXI.Container {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.interactive = true;
    container.cursor = 'pointer';
    
    const bg = new PIXI.Graphics();
    bg.beginFill(color, 0.85);
    bg.drawRoundedRect(0, 0, width, height, 6);
    bg.endFill();
    container.addChild(bg);
    
    const text = new PIXI.Text(label, {
      fontFamily: 'sans-serif',
      fontSize,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 1
    });
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = height / 2;
    container.addChild(text);
    
    container.on('pointerover', () => {
      bg.alpha = 0.7;
    });
    
    container.on('pointerout', () => {
      bg.alpha = 1;
    });
    
    container.on('pointerdown', onClick);
    
    return container;
  }

  private handleImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            const chart = importChartFromJSON(content);
            this.stateManager.importChart(chart);
            alert('谱面导入成功！');
          } catch (err) {
            alert(`导入失败: ${err}`);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  private handleExport(): void {
    const state = this.stateManager.getState();
    const allNotes: Record<Difficulty, any> = {
      easy: state.chart.difficulties.easy || [],
      normal: this.stateManager.getCurrentNoteData(),
      hard: state.chart.difficulties.hard || []
    };
    
    allNotes[state.currentDifficulty] = this.stateManager.getCurrentNoteData();
    
    const config = {
      bpm: state.chart.bpm,
      title: state.chart.title,
      artist: state.chart.artist,
      lyrics: state.chart.lyrics,
      poemLines: state.chart.poemLines,
      difficultyConfigs: state.chart.difficultyConfigs
    };
    
    const json = exportChartToJSON(config, allNotes);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.chart.title || 'chart'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  destroy(): void {
    if (this.removeStateListener) this.removeStateListener();
    if (this.removePlaybackListener) this.removePlaybackListener();
    this.container.destroy();
  }
}
