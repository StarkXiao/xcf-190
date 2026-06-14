import { ChartData, Difficulty, NoteData, DIFFICULTY_CONFIGS } from '../types';
import { getNotesForDifficulty } from '../data/songs';

export class ChartParser {
  private chart: ChartData;
  private difficulty: Difficulty = 'normal';
  private cachedNotes?: NoteData[];

  constructor(chart: ChartData, difficulty: Difficulty = 'normal') {
    this.chart = chart;
    this.difficulty = difficulty;
  }

  public setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    this.cachedNotes = undefined;
  }

  public getNotes(): NoteData[] {
    if (!this.cachedNotes) {
      this.cachedNotes = getNotesForDifficulty(this.chart, this.difficulty);
    }
    return [...this.cachedNotes];
  }

  public getBPM(): number {
    return this.chart.bpm;
  }

  public getNoteSpeed(): number {
    return this.chart.difficultyConfigs[this.difficulty]?.noteSpeed || DIFFICULTY_CONFIGS.normal.noteSpeed;
  }

  public getTitle(): string {
    return this.chart.title;
  }

  public getArtist(): string {
    return this.chart.artist || '';
  }

  public getLyrics(): string {
    return this.chart.lyrics;
  }

  public getNoteCount(): number {
    return this.getNotes().length;
  }

  public getTotalDuration(): number {
    const notes = this.getNotes();
    if (notes.length === 0) return 0;
    const lastNote = notes.reduce((prev, curr) => 
      curr.time > prev.time ? curr : prev
    );
    return lastNote.time + 2000;
  }

  public getNotesInTimeRange(startTime: number, endTime: number): NoteData[] {
    return this.getNotes().filter(
      note => note.time >= startTime && note.time <= endTime
    );
  }

  public static generateNotesFromLyrics(
    lyrics: string,
    bpm: number,
    startDelay: number = 1000,
    intervalMs?: number
  ): NoteData[] {
    const interval = intervalMs || (60000 / bpm) / 2;
    const chars = lyrics.split('');
    const notes: NoteData[] = [];

    for (let i = 0; i < chars.length; i++) {
      notes.push({
        time: startDelay + i * interval,
        lane: i % 4,
        lyricChar: chars[i],
        type: 'tap'
      });
    }

    return notes;
  }
}
