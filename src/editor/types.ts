import { NoteData, NoteType, Difficulty, ChartData, DifficultyConfig } from '../types';

export interface EditorNote extends NoteData {
  id: string;
  selected: boolean;
}

export interface EditorState {
  chart: ChartData;
  currentDifficulty: Difficulty;
  notes: EditorNote[];
  selectedNoteId: string | null;
  currentTime: number;
  isPlaying: boolean;
  zoom: number;
  scrollOffset: number;
  snapToGrid: boolean;
  gridInterval: number;
}

export interface TimelineConfig {
  width: number;
  height: number;
  laneHeight: number;
  noteWidth: number;
  noteHeight: number;
  timeScale: number;
  judgeLineY: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
  loopEnabled: boolean;
  loopStartTime: number;
  loopEndTime: number;
}

export interface EditorAction {
  type: 'ADD_NOTE' | 'DELETE_NOTE' | 'UPDATE_NOTE' | 'SELECT_NOTE' |
        'SET_TIME' | 'SET_PLAYING' | 'SET_ZOOM' | 'SET_SCROLL' |
        'SET_DIFFICULTY' | 'IMPORT_CHART' | 'UNDO' | 'REDO';
  payload?: any;
}

export interface EditorConfig {
  bpm: number;
  title: string;
  artist: string;
  lyrics: string;
  poemLines: string[];
  difficultyConfigs: Record<Difficulty, DifficultyConfig>;
}

export const DEFAULT_TIMELINE_CONFIG: TimelineConfig = {
  width: 800,
  height: 600,
  laneHeight: 60,
  noteWidth: 50,
  noteHeight: 20,
  timeScale: 0.1,
  judgeLineY: 500
};

export const NOTE_TYPE_COLORS: Record<NoteType, number> = {
  tap: 0x6b9dff,
  hold: 0x9b59b6,
  slide: 0xe74c3c
};

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  tap: '点击',
  hold: '长按',
  slide: '滑键'
};

export const generateNoteId = (): string => {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
