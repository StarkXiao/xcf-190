import * as PIXI from 'pixi.js';
import { ChartData } from '../types';
import { EditorStateManager } from './EditorState';
import { Timeline } from './components/Timeline';
import { Preview } from './components/Preview';
import { PropertyPanel } from './components/PropertyPanel';
import { sampleChart } from '../data/sampleChart';

interface EditorConfig {
  width: number;
  height: number;
  initialChart?: ChartData;
}

const DEFAULT_CONFIG: EditorConfig = {
  width: 1400,
  height: 700
};

export class ChartEditor {
  private app: PIXI.Application;
  private container: HTMLElement;
  private config: EditorConfig;
  private stateManager: EditorStateManager;
  
  private mainContainer: PIXI.Container;
  private timeline: Timeline;
  private preview: Preview;
  private propertyPanel: PropertyPanel;
  
  private header: PIXI.Container;
  private footer: PIXI.Container;

  constructor(container: HTMLElement, config?: Partial<EditorConfig>) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    const initialChart = this.config.initialChart || sampleChart;
    this.stateManager = new EditorStateManager(initialChart);
    
    this.app = new PIXI.Application({
      width: this.config.width,
      height: this.config.height,
      backgroundColor: 0x0f0f1a,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });
    
    this.container.appendChild(this.app.view as HTMLCanvasElement);
    
    this.mainContainer = new PIXI.Container();
    this.app.stage.addChild(this.mainContainer);
    
    this.header = new PIXI.Container();
    this.footer = new PIXI.Container();
    
    this.timeline = new Timeline(this.app, this.stateManager, {
      width: 700,
      height: 560,
      laneHeight: 175,
      judgeLineY: 450
    });
    
    this.preview = new Preview(this.app, this.stateManager, {
      width: 280,
      height: 400
    });
    
    this.propertyPanel = new PropertyPanel(this.app, this.stateManager, {
      width: 320,
      height: 560
    });
    
    (window as any).__editorTimeline = this.timeline;
    
    this.setupLayout();
    this.setupHeader();
    this.setupFooter();
    this.setupKeyboardShortcuts();
    this.setupResize();
  }

  private setupLayout(): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0f0f1a);
    bg.drawRect(0, 0, this.config.width, this.config.height);
    bg.endFill();
    this.mainContainer.addChild(bg);
    
    const editorTitle = new PIXI.Text('🎼 谱面编辑器', {
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffffff
    });
    editorTitle.anchor.set(0, 0.5);
    editorTitle.x = 20;
    editorTitle.y = 35;
    this.mainContainer.addChild(editorTitle);
    
    this.header.y = 0;
    this.mainContainer.addChild(this.header);
    
    this.timeline.getContainer().x = 20;
    this.timeline.getContainer().y = 70;
    this.mainContainer.addChild(this.timeline.getContainer());
    
    this.preview.getContainer().x = 740;
    this.preview.getContainer().y = 70;
    this.mainContainer.addChild(this.preview.getContainer());
    
    this.propertyPanel.getContainer().x = 1040;
    this.propertyPanel.getContainer().y = 70;
    this.mainContainer.addChild(this.propertyPanel.getContainer());
    
    this.footer.y = this.config.height - 60;
    this.mainContainer.addChild(this.footer);
  }

  private setupHeader(): void {
    const headerBg = new PIXI.Graphics();
    headerBg.beginFill(0x1a1a2e, 0.9);
    headerBg.drawRect(0, 0, this.config.width, 60);
    headerBg.endFill();
    headerBg.lineStyle(1, 0x333355, 0.5);
    headerBg.moveTo(0, 60);
    headerBg.lineTo(this.config.width, 60);
    this.header.addChild(headerBg);
    
    const buttonConfigs = [
      { label: '📂 新建', x: 200, color: 0x6b9dff, action: () => this.newChart() },
      { label: '📂 打开', x: 290, color: 0x6b9dff, action: () => this.openChart() },
      { label: '💾 保存', x: 380, color: 0x6bff9d, action: () => this.saveChart() },
      { label: '↶ 撤销', x: 470, color: 0x666688, action: () => this.stateManager.undo() },
      { label: '↷ 重做', x: 550, color: 0x666688, action: () => this.stateManager.redo() },
      { label: '🎵 测试', x: 630, color: 0xffd700, action: () => this.testInGame() }
    ];
    
    buttonConfigs.forEach(btn => {
      const button = this.createButton(btn.label, btn.x, 15, 80, 30, btn.color, btn.action);
      this.header.addChild(button);
    });
  }

  private setupFooter(): void {
    const footerBg = new PIXI.Graphics();
    footerBg.beginFill(0x1a1a2e, 0.9);
    footerBg.drawRect(0, 0, this.config.width, 60);
    footerBg.endFill();
    footerBg.lineStyle(1, 0x333355, 0.5);
    footerBg.moveTo(0, 0);
    footerBg.lineTo(this.config.width, 0);
    this.footer.addChild(footerBg);
    
    this.updateStatusBar();
    
    this.stateManager.subscribe(() => this.updateStatusBar());
    this.stateManager.subscribePlayback(() => this.updateStatusBar());
  }

  private updateStatusBar(): void {
    const statusContainer = this.footer.getChildByName('status');
    if (statusContainer) {
      this.footer.removeChild(statusContainer);
      statusContainer.destroy();
    }
    
    const container = new PIXI.Container();
    container.name = 'status';
    
    const state = this.stateManager.getState();
    const playbackState = this.stateManager.getPlaybackState();
    const noteCount = this.stateManager.getNoteCount();
    const selectedNote = this.stateManager.getSelectedNote();
    
    const statusItems = [
      { label: '音符数:', value: noteCount.toString(), color: 0x6b9dff },
      { label: '难度:', value: state.currentDifficulty, color: 0xffd700 },
      { label: 'BPM:', value: state.chart.bpm.toString(), color: 0x6bff9d },
      { label: '缩放:', value: `${(state.zoom * 100).toFixed(0)}%`, color: 0xffffff },
      { label: '时间:', value: `${(playbackState.currentTime / 1000).toFixed(2)}s`, color: 0x88ccff }
    ];
    
    if (selectedNote) {
      statusItems.push({
        label: '选中:',
        value: `${NOTE_TYPE_LABELS[selectedNote.type]} @ ${(selectedNote.time / 1000).toFixed(2)}s`,
        color: 0xffd700
      });
    }
    
    let x = 20;
    statusItems.forEach(item => {
      const label = new PIXI.Text(item.label, {
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: 0x888888
      });
      label.anchor.set(0, 0.5);
      label.x = x;
      label.y = 30;
      container.addChild(label);
      x += label.width + 5;
      
      const value = new PIXI.Text(item.value, {
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: item.color
      });
      value.anchor.set(0, 0.5);
      value.x = x;
      value.y = 30;
      container.addChild(value);
      x += value.width + 20;
    });
    
    const hint = new PIXI.Text(
      '快捷键: Ctrl+Z 撤销 | Ctrl+Y 重做 | Ctrl+S 保存 | 滚轮滚动/缩放 | 点击添加音符 | 拖拽移动音符 | Delete 删除选中',
      {
        fontFamily: 'sans-serif',
        fontSize: 11,
        fill: 0x666666
      }
    );
    hint.anchor.set(1, 0.5);
    hint.x = this.config.width - 20;
    hint.y = 30;
    container.addChild(hint);
    
    this.footer.addChild(container);
  }

  private createButton(
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    onClick: () => void
  ): PIXI.Container {
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.interactive = true;
    container.cursor = 'pointer';
    
    const bg = new PIXI.Graphics();
    bg.beginFill(color, 0.8);
    bg.drawRoundedRect(0, 0, width, height, 6);
    bg.endFill();
    container.addChild(bg);
    
    const text = new PIXI.Text(label, {
      fontFamily: 'sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 1
    });
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = height / 2;
    container.addChild(text);
    
    container.on('pointerover', () => { bg.alpha = 0.7; });
    container.on('pointerout', () => { bg.alpha = 1; });
    container.on('pointerdown', onClick);
    
    return container;
  }

  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              this.stateManager.redo();
            } else {
              this.stateManager.undo();
            }
            break;
          case 'y':
            e.preventDefault();
            this.stateManager.redo();
            break;
          case 's':
            e.preventDefault();
            this.saveChart();
            break;
          case 'n':
            e.preventDefault();
            this.newChart();
            break;
          case 'o':
            e.preventDefault();
            this.openChart();
            break;
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNote = this.stateManager.getSelectedNote();
        if (selectedNote) {
          e.preventDefault();
          this.stateManager.deleteNote(selectedNote.id);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        const playbackState = this.stateManager.getPlaybackState();
        if (playbackState.isPlaying) {
          this.stateManager.setPlaying(false);
        } else {
          this.stateManager.setPlaying(true);
        }
      } else if (e.key === 'Escape') {
        this.stateManager.selectNote(null);
      }
    });
  }

  private setupResize(): void {
    window.addEventListener('resize', () => {
      const width = Math.min(window.innerWidth, 1600);
      const height = Math.min(window.innerHeight, 900);
      this.resize(width, height);
    });
  }

  private newChart(): void {
    if (confirm('确定要新建谱面吗？当前未保存的更改将丢失。')) {
      const emptyChart = {
        id: `chart_${Date.now()}`,
        title: '新谱面',
        artist: '',
        bpm: 120,
        lyrics: '',
        poemLines: [],
        difficulties: { normal: [] },
        difficultyConfigs: {
          easy: { ...DIFFICULTY_CONFIGS.easy },
          normal: { ...DIFFICULTY_CONFIGS.normal },
          hard: { ...DIFFICULTY_CONFIGS.hard }
        }
      };
      this.stateManager.importChart(emptyChart);
    }
  }

  private openChart(): void {
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
          } catch (err) {
            alert(`导入失败: ${err}`);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  private saveChart(): void {
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

  private testInGame(): void {
    const chart = this.stateManager.exportChart();
    const chartDataStr = JSON.stringify(chart);
    localStorage.setItem('editor_test_chart', chartDataStr);
    
    alert('谱面已保存到测试缓存！切换到游戏界面即可测试。\n\n提示：在游戏主界面按 Ctrl+E 可快速返回编辑器。');
  }

  getStateManager(): EditorStateManager {
    return this.stateManager;
  }

  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.app.renderer.resize(width, height);
    
    this.mainContainer.children[0].destroy();
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0f0f1a);
    bg.drawRect(0, 0, width, height);
    bg.endFill();
    this.mainContainer.addChildAt(bg, 0);
    
    const timelineWidth = Math.max(500, width - 660);
    this.timeline.resize(timelineWidth, height - 140);
    
    this.propertyPanel.getContainer().x = width - 340;
    this.preview.getContainer().x = width - 640;
    
    this.footer.y = height - 60;
    
    const headerBg = this.header.children[0] as PIXI.Graphics;
    headerBg.clear();
    headerBg.beginFill(0x1a1a2e, 0.9);
    headerBg.drawRect(0, 0, width, 60);
    headerBg.endFill();
    headerBg.lineStyle(1, 0x333355, 0.5);
    headerBg.moveTo(0, 60);
    headerBg.lineTo(width, 60);
    
    const footerBg = this.footer.children[0] as PIXI.Graphics;
    footerBg.clear();
    footerBg.beginFill(0x1a1a2e, 0.9);
    footerBg.drawRect(0, 0, width, 60);
    footerBg.endFill();
    footerBg.lineStyle(1, 0x333355, 0.5);
    footerBg.moveTo(0, 0);
    footerBg.lineTo(width, 0);
  }

  destroy(): void {
    this.timeline.destroy();
    this.preview.destroy();
    this.propertyPanel.destroy();
    this.app.destroy(true);
    this.container.removeChild(this.app.view as HTMLCanvasElement);
    delete (window as any).__editorTimeline;
  }
}

import { importChartFromJSON, exportChartToJSON } from './utils/chartUtils';
import { DIFFICULTY_CONFIGS, Difficulty } from '../types';
import { NOTE_TYPE_LABELS } from './types';
