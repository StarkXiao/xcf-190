import { NoteData, JudgeResult, JudgeEvent, DEFAULT_JUDGE_TIMING, JudgeTiming, LANE_COUNT } from '../types';

interface ActiveNote extends NoteData {
  id: number;
  isJudged: boolean;
  y: number;
  judgeResult?: JudgeResult;
}

export class RhythmJudge {
  private notes: ActiveNote[] = [];
  private noteIdCounter: number = 0;
  private currentTime: number = 0;
  private noteSpeed: number = 400;
  private judgeLineY: number = 600;
  private judgeTiming: JudgeTiming = DEFAULT_JUDGE_TIMING;

  constructor(noteSpeed: number, judgeLineY: number, judgeTiming?: JudgeTiming) {
    this.noteSpeed = noteSpeed;
    this.judgeLineY = judgeLineY;
    if (judgeTiming) {
      this.judgeTiming = judgeTiming;
    }
  }

  public setConfig(noteSpeed: number, judgeTiming: JudgeTiming): void {
    this.noteSpeed = noteSpeed;
    this.judgeTiming = judgeTiming;
  }

  public setNotes(notes: NoteData[]): void {
    this.notes = notes.map(note => ({
      ...note,
      id: this.noteIdCounter++,
      isJudged: false,
      y: -100
    }));
  }

  public update(currentTime: number): JudgeEvent[] {
    this.currentTime = currentTime;
    const events: JudgeEvent[] = [];

    this.notes.forEach(note => {
      if (note.isJudged) return;

      const timeUntilJudge = note.time - currentTime;
      note.y = this.judgeLineY - (timeUntilJudge / 1000) * this.noteSpeed;

      if (timeUntilJudge < -this.judgeTiming.miss && !note.isJudged) {
        note.isJudged = true;
        note.judgeResult = 'miss';
        events.push({
          result: 'miss',
          time: this.currentTime,
          lane: note.lane,
          lyricChar: note.lyricChar
        });
      }
    });

    return events;
  }

  public handleInput(lane: number): JudgeEvent | null {
    const targetNote = this.findClosestNote(lane);
    
    if (!targetNote) {
      return null;
    }

    const timeDiff = Math.abs(targetNote.time - this.currentTime);
    const result = this.getJudgeResult(timeDiff);

    if (result) {
      targetNote.isJudged = true;
      targetNote.judgeResult = result;
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
        Math.abs(note.time - this.currentTime) <= this.judgeTiming.miss
      )
      .sort((a, b) => Math.abs(a.time - this.currentTime) - Math.abs(b.time - this.currentTime));

    return unjudgedNotes[0] || null;
  }

  private getJudgeResult(timeDiff: number): JudgeResult | null {
    if (timeDiff <= this.judgeTiming.perfect) return 'perfect';
    if (timeDiff <= this.judgeTiming.great) return 'great';
    if (timeDiff <= this.judgeTiming.good) return 'good';
    if (timeDiff <= this.judgeTiming.miss) return 'miss';
    return null;
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
