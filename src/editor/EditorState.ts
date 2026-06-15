import { ChartData, Difficulty, NoteData, NoteType, DIFFICULTY_CONFIGS } from '../types';
import { EditorNote, EditorState, generateNoteId, PlaybackState } from './types';
import {
  convertNotesToEditorNotes,
  convertEditorNotesToNotes,
  createEmptyChart,
  snapTimeToGrid
} from './utils/chartUtils';

type StateChangeListener = (state: EditorState) => void;
type PlaybackChangeListener = (state: PlaybackState) => void;

export class EditorStateManager {
  private state: EditorState;
  private playbackState: PlaybackState;
  private history: EditorState[] = [];
  private historyIndex: number = -1;
  private listeners: Set<StateChangeListener> = new Set();
  private playbackListeners: Set<PlaybackChangeListener> = new Set();
  private readonly MAX_HISTORY = 50;

  constructor(initialChart?: ChartData) {
    const chart = initialChart || createEmptyChart();
    const initialNotes = chart.difficulties.normal || [];

    this.state = {
      chart,
      currentDifficulty: 'normal',
      notes: convertNotesToEditorNotes(initialNotes),
      selectedNoteId: null,
      currentTime: 0,
      isPlaying: false,
      zoom: 1,
      scrollOffset: 0,
      snapToGrid: true,
      gridInterval: 0.25
    };

    this.playbackState = {
      isPlaying: false,
      currentTime: 0,
      playbackSpeed: 1,
      loopEnabled: false,
      loopStartTime: 0,
      loopEndTime: 10000
    };

    this.saveToHistory();
  }

  getState(): EditorState {
    return { ...this.state };
  }

  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribePlayback(listener: PlaybackChangeListener): () => void {
    this.playbackListeners.add(listener);
    return () => this.playbackListeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  private notifyPlaybackListeners(): void {
    this.playbackListeners.forEach(listener => listener({ ...this.playbackState }));
  }

  private saveToHistory(): void {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(JSON.parse(JSON.stringify(this.state)));
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      this.notifyListeners();
      return true;
    }
    return false;
  }

  redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      this.notifyListeners();
      return true;
    }
    return false;
  }

  setDifficulty(difficulty: Difficulty): void {
    const notes = this.state.chart.difficulties[difficulty] || [];
    this.state = {
      ...this.state,
      currentDifficulty: difficulty,
      notes: convertNotesToEditorNotes(notes),
      selectedNoteId: null
    };
    this.saveToHistory();
    this.notifyListeners();
  }

  setCurrentTime(time: number): void {
    this.state = { ...this.state, currentTime: Math.max(0, time) };
    this.notifyListeners();
  }

  setPlaybackTime(time: number): void {
    this.playbackState = { ...this.playbackState, currentTime: Math.max(0, time) };
    this.notifyPlaybackListeners();
  }

  setPlaying(isPlaying: boolean): void {
    this.state = { ...this.state, isPlaying };
    this.playbackState = { ...this.playbackState, isPlaying };
    this.notifyListeners();
    this.notifyPlaybackListeners();
  }

  setZoom(zoom: number): void {
    this.state = { ...this.state, zoom: Math.max(0.25, Math.min(3, zoom)) };
    this.notifyListeners();
  }

  setScrollOffset(offset: number): void {
    this.state = { ...this.state, scrollOffset: Math.max(0, offset) };
    this.notifyListeners();
  }

  setSnapToGrid(enabled: boolean): void {
    this.state = { ...this.state, snapToGrid: enabled };
    this.notifyListeners();
  }

  setGridInterval(interval: number): void {
    this.state = { ...this.state, gridInterval: interval };
    this.notifyListeners();
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackState = { ...this.playbackState, playbackSpeed: Math.max(0.25, Math.min(2, speed)) };
    this.notifyPlaybackListeners();
  }

  setLoopEnabled(enabled: boolean): void {
    this.playbackState = { ...this.playbackState, loopEnabled: enabled };
    this.notifyPlaybackListeners();
  }

  setLoopRange(start: number, end: number): void {
    this.playbackState = {
      ...this.playbackState,
      loopStartTime: Math.max(0, start),
      loopEndTime: Math.max(start, end)
    };
    this.notifyPlaybackListeners();
  }

  selectNote(noteId: string | null): void {
    this.state = { ...this.state, selectedNoteId: noteId };
    this.notifyListeners();
  }

  addNote(noteData: Omit<NoteData, 'id'>): EditorNote {
    const snappedTime = snapTimeToGrid(
      noteData.time,
      this.state.chart.bpm,
      this.state.snapToGrid,
      this.state.gridInterval
    );

    const newNote: EditorNote = {
      ...noteData,
      time: snappedTime,
      id: generateNoteId(),
      selected: false
    };

    const notes = [...this.state.notes, newNote].sort((a, b) => a.time - b.time);
    this.state = { ...this.state, notes, selectedNoteId: newNote.id };
    this.saveToHistory();
    this.notifyListeners();
    return newNote;
  }

  deleteNote(noteId: string): boolean {
    const notes = this.state.notes.filter(n => n.id !== noteId);
    if (notes.length === this.state.notes.length) return false;

    this.state = {
      ...this.state,
      notes,
      selectedNoteId: this.state.selectedNoteId === noteId ? null : this.state.selectedNoteId
    };
    this.saveToHistory();
    this.notifyListeners();
    return true;
  }

  updateNote(noteId: string, updates: Partial<NoteData>): boolean {
    const noteIndex = this.state.notes.findIndex(n => n.id === noteId);
    if (noteIndex === -1) return false;

    const notes = [...this.state.notes];
    const updatedNote = { ...notes[noteIndex], ...updates };

    if (updates.time !== undefined) {
      updatedNote.time = snapTimeToGrid(
        updates.time,
        this.state.chart.bpm,
        this.state.snapToGrid,
        this.state.gridInterval
      );
    }

    notes[noteIndex] = updatedNote;
    notes.sort((a, b) => a.time - b.time);

    this.state = { ...this.state, notes };
    this.saveToHistory();
    this.notifyListeners();
    return true;
  }

  moveNote(noteId: string, newTime: number, newLane?: number): boolean {
    const noteIndex = this.state.notes.findIndex(n => n.id === noteId);
    if (noteIndex === -1) return false;

    const notes = [...this.state.notes];
    const note = { ...notes[noteIndex] };
    
    note.time = snapTimeToGrid(
      newTime,
      this.state.chart.bpm,
      this.state.snapToGrid,
      this.state.gridInterval
    );
    
    if (newLane !== undefined) {
      note.lane = newLane;
    }

    notes[noteIndex] = note;
    notes.sort((a, b) => a.time - b.time);

    this.state = { ...this.state, notes };
    this.saveToHistory();
    this.notifyListeners();
    return true;
  }

  getSelectedNote(): EditorNote | null {
    if (!this.state.selectedNoteId) return null;
    return this.state.notes.find(n => n.id === this.state.selectedNoteId) || null;
  }

  getNotesForDifficulty(difficulty: Difficulty): NoteData[] {
    if (difficulty === this.state.currentDifficulty) {
      return convertEditorNotesToNotes(this.state.notes);
    }
    return this.state.chart.difficulties[difficulty] || [];
  }

  getCurrentNoteData(): NoteData[] {
    return convertEditorNotesToNotes(this.state.notes);
  }

  importChart(chart: ChartData): void {
    const notes = chart.difficulties[this.state.currentDifficulty] || chart.difficulties.normal || [];
    this.state = {
      ...this.state,
      chart,
      notes: convertNotesToEditorNotes(notes),
      selectedNoteId: null,
      currentTime: 0
    };
    this.history = [];
    this.historyIndex = -1;
    this.saveToHistory();
    this.notifyListeners();
  }

  exportChart(): ChartData {
    const allNotes: Record<Difficulty, NoteData[]> = {
      easy: this.state.chart.difficulties.easy || [],
      normal: this.getCurrentNoteData(),
      hard: this.state.chart.difficulties.hard || []
    };

    allNotes[this.state.currentDifficulty] = this.getCurrentNoteData();

    return {
      ...this.state.chart,
      difficulties: allNotes,
      lyrics: this.state.chart.lyrics || this.generateLyrics(),
      difficultyConfigs: this.state.chart.difficultyConfigs || {
        easy: { ...DIFFICULTY_CONFIGS.easy },
        normal: { ...DIFFICULTY_CONFIGS.normal },
        hard: { ...DIFFICULTY_CONFIGS.hard }
      }
    };
  }

  updateChartConfig(updates: Partial<ChartData>): void {
    this.state = {
      ...this.state,
      chart: { ...this.state.chart, ...updates }
    };
    this.saveToHistory();
    this.notifyListeners();
  }

  generateNotesFromLyrics(lyrics: string, startDelay: number = 1000): void {
    const { bpm } = this.state.chart;
    const beatInterval = 60000 / bpm;
    const interval = beatInterval * 0.75;
    const chars = lyrics.split('');
    
    const newNotes: EditorNote[] = chars.map((char, i) => ({
      time: startDelay + i * interval,
      lane: (i + Math.floor(i / 3)) % 4,
      lyricChar: char,
      type: 'tap' as NoteType,
      id: generateNoteId(),
      selected: false
    }));

    this.state = {
      ...this.state,
      notes: newNotes.sort((a, b) => a.time - b.time),
      chart: { ...this.state.chart, lyrics }
    };
    this.saveToHistory();
    this.notifyListeners();
  }

  private generateLyrics(): string {
    return this.state.notes
      .sort((a, b) => a.time - b.time)
      .map(n => n.lyricChar)
      .join('');
  }

  clearAllNotes(): void {
    this.state = {
      ...this.state,
      notes: [],
      selectedNoteId: null
    };
    this.saveToHistory();
    this.notifyListeners();
  }

  getNoteCount(): number {
    return this.state.notes.length;
  }

  getTotalDuration(): number {
    const notes = this.state.notes;
    if (notes.length === 0) return 0;
    const lastNote = notes.reduce((prev, curr) => 
      curr.time > prev.time ? curr : prev
    );
    const beatInterval = 60000 / this.state.chart.bpm;
    return lastNote.time + beatInterval * 4;
  }
}
