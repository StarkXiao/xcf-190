import { ChartData, NoteData } from '../types';

export class ChartParser {
  private chart: ChartData;

  constructor(chart: ChartData) {
    this.chart = chart;
  }

  public getNotes(): NoteData[] {
    return [...this.chart.notes].sort((a, b) => a.time - b.time);
  }

  public getBPM(): number {
    return this.chart.bpm;
  }

  public getNoteSpeed(): number {
    return this.chart.noteSpeed;
  }

  public getTitle(): string {
    return this.chart.title;
  }

  public getLyrics(): string {
    return this.chart.lyrics;
  }

  public getNoteCount(): number {
    return this.chart.notes.length;
  }

  public getTotalDuration(): number {
    if (this.chart.notes.length === 0) return 0;
    const lastNote = this.chart.notes.reduce((prev, curr) => 
      curr.time > prev.time ? curr : prev
    );
    return lastNote.time + 2000;
  }

  public getNotesInTimeRange(startTime: number, endTime: number): NoteData[] {
    return this.chart.notes.filter(
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
        lyricChar: chars[i]
      });
    }

    return notes;
  }

  public static createChartFromLyrics(
    title: string,
    lyrics: string,
    bpm: number = 120,
    noteSpeed: number = 400
  ): ChartData {
    return {
      title,
      bpm,
      noteSpeed,
      lyrics,
      notes: ChartParser.generateNotesFromLyrics(lyrics, bpm)
    };
  }
}
