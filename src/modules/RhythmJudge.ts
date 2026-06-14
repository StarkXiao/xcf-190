import { NoteData, JudgeResult, JudgeEvent, JUDGE_TIMING, LANE_COUNT } from '../types';

interface ActiveNote extends NoteData {
  id: number;
  isJudged: boolean;
  y: number;
}

export class RhythmJudge {
  private notes: ActiveNote[] = [];
  private noteIdCounter: number = 0;
  private currentTime: number = 0;
  private noteSpeed: number = 400;
  private judgeLineY: number = 600;
  private onJudgeCallback?: (event: JudgeEvent) => void;

  constructor(noteSpeed: number, judgeLineY: number) {
    this.noteSpeed = noteSpeed;
    this.judgeLineY = judgeLineY;
  }

  public setOnJudgeCallback(callback: (event: JudgeEvent) => void): void {
    this.onJudgeCallback = callback;
  }

  public setNotes(notes: NoteData[]): void {
    this.notes = notes.map(note => ({
      ...note,
      id: this.noteIdCounter++,
      isJudged: false,
      y: -100
    }));
  }

  public update(_deltaTime: number, currentTime: number): void {
    this.currentTime = currentTime;

    this.notes.forEach(note => {
      if (note.isJudged) return;

      const timeUntilJudge = note.time - currentTime;
      note.y = this.judgeLineY - (timeUntilJudge / 1000) * this.noteSpeed;

      if (timeUntilJudge < -JUDGE_TIMING.miss && !note.isJudged) {
        this.judgeNote(note, 'miss');
      }
    });
  }

  public handleInput(lane: number): JudgeEvent | null {
    const targetNote = this.findClosestNote(lane);
    
    if (!targetNote) {
      return null;
    }

    const timeDiff = Math.abs(targetNote.time - this.currentTime);
    const result = this.getJudgeResult(timeDiff);

    if (result) {
      this.judgeNote(targetNote, result);
      return {
        result,
        time: this.currentTime,
        lane,
        lyricChar: targetNote.lyricChar
      };
    }

    return null;
  }

  private findClosestNote(lane: number): ActiveNote | null {
    const unjudgedNotes = this.notes
      .filter(note => 
        !note.isJudged && 
        note.lane === lane &&
        Math.abs(note.time - this.currentTime) <= JUDGE_TIMING.miss
      )
      .sort((a, b) => Math.abs(a.time - this.currentTime) - Math.abs(b.time - this.currentTime));

    return unjudgedNotes[0] || null;
  }

  private getJudgeResult(timeDiff: number): JudgeResult | null {
    if (timeDiff <= JUDGE_TIMING.perfect) return 'perfect';
    if (timeDiff <= JUDGE_TIMING.great) return 'great';
    if (timeDiff <= JUDGE_TIMING.good) return 'good';
    if (timeDiff <= JUDGE_TIMING.miss) return 'miss';
    return null;
  }

  private judgeNote(note: ActiveNote, result: JudgeResult): void {
    note.isJudged = true;
    
    if (this.onJudgeCallback) {
      this.onJudgeCallback({
        result,
        time: this.currentTime,
        lane: note.lane,
        lyricChar: note.lyricChar
      });
    }
  }

  public getActiveNotes(): ActiveNote[] {
    return this.notes.filter(note => !note.isJudged && note.y > -100 && note.y < this.judgeLineY + 200);
  }

  public getNoteY(note: ActiveNote): number {
    return note.y;
  }

  public isAllNotesJudged(): boolean {
    return this.notes.every(note => note.isJudged);
  }

  public reset(): void {
    this.notes = [];
    this.currentTime = 0;
    this.noteIdCounter = 0;
  }

  public getJudgeLineY(): number {
    return this.judgeLineY;
  }

  public getLaneCount(): number {
    return LANE_COUNT;
  }
}
