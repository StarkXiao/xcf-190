import { NoteData, JudgeResult, JudgeEvent, DEFAULT_JUDGE_TIMING, JudgeTiming, LANE_COUNT, NoteType } from '../types';

interface ActiveNote extends NoteData {
  id: number;
  isJudged: boolean;
  y: number;
  judgeResult?: JudgeResult;
  holdPressed: boolean;
  holdStartTime?: number;
  slideStartTime?: number;
  slideCurrentLane: number;
}

export class RhythmJudge {
  private notes: ActiveNote[] = [];
  private noteIdCounter: number = 0;
  private currentTime: number = 0;
  private noteSpeed: number = 400;
  private judgeLineY: number = 600;
  private judgeTiming: JudgeTiming = DEFAULT_JUDGE_TIMING;
  private pressedLanes: Set<number> = new Set();
  private laneHoldMap: Map<number, number> = new Map();

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
      y: -100,
      holdPressed: false,
      slideCurrentLane: note.lane
    }));
  }

  public update(currentTime: number): JudgeEvent[] {
    this.currentTime = currentTime;
    const events: JudgeEvent[] = [];

    this.notes.forEach(note => {
      if (note.isJudged) return;

      const timeUntilJudge = note.time - currentTime;
      note.y = this.judgeLineY - (timeUntilJudge / 1000) * this.noteSpeed;

      if (note.type === 'slide' && note.slideStartTime !== undefined) {
        const slideProgress = Math.min(1, (currentTime - note.slideStartTime) / (note.duration || 500));
        const startLane = note.lane;
        const endLane = note.endLane ?? note.lane;
        note.slideCurrentLane = startLane + (endLane - startLane) * slideProgress;
      }

      if (timeUntilJudge < -this.judgeTiming.miss && !note.isJudged) {
        if (note.type === 'hold' && note.holdPressed) {
          const holdDuration = currentTime - (note.holdStartTime || note.time);
          const expectedDuration = note.duration || 1000;
          const holdRatio = holdDuration / expectedDuration;
          
          let result: JudgeResult = 'miss';
          if (holdRatio >= 0.9) result = 'perfect';
          else if (holdRatio >= 0.7) result = 'great';
          else if (holdRatio >= 0.5) result = 'good';
          
          note.isJudged = true;
          note.judgeResult = result;
          this.laneHoldMap.delete(note.lane);
          events.push({
            result,
            time: this.currentTime,
            lane: note.lane,
            lyricChar: note.lyricChar,
            noteType: note.type,
            noteId: note.id
          });
        } else if (note.type === 'slide' && note.slideStartTime !== undefined) {
          const slideDuration = currentTime - note.slideStartTime;
          const expectedDuration = note.duration || 500;
          const slideRatio = slideDuration / expectedDuration;
          
          let result: JudgeResult = 'miss';
          if (slideRatio >= 0.9) result = 'perfect';
          else if (slideRatio >= 0.7) result = 'great';
          else if (slideRatio >= 0.5) result = 'good';
          
          note.isJudged = true;
          note.judgeResult = result;
          events.push({
            result,
            time: this.currentTime,
            lane: note.endLane ?? note.lane,
            lyricChar: note.lyricChar,
            noteType: note.type,
            noteId: note.id
          });
        } else if (note.type === 'tap' || !note.holdPressed) {
          note.isJudged = true;
          note.judgeResult = 'miss';
          events.push({
            result: 'miss',
            time: this.currentTime,
            lane: note.lane,
            lyricChar: note.lyricChar,
            noteType: note.type,
            noteId: note.id
          });
        }
      }
    });

    return events;
  }

  public handleInput(lane: number, isPress: boolean = true): JudgeEvent | null {
    if (isPress) {
      this.pressedLanes.add(lane);

      const slideCompleteEvent = this.tryCompleteSlideByKeyPress(lane);
      if (slideCompleteEvent) {
        return slideCompleteEvent;
      }
      
      const activeHoldNote = this.laneHoldMap.get(lane);
      if (activeHoldNote !== undefined) {
        const holdNote = this.notes.find(n => n.id === activeHoldNote);
        if (holdNote && holdNote.type === 'hold' && holdNote.holdPressed && !holdNote.isJudged) {
          return null;
        }
      }

      const targetNote = this.findClosestNote(lane);
      if (!targetNote) return null;

      const timeDiff = Math.abs(targetNote.time - this.currentTime);
      const result = this.getJudgeResult(timeDiff);

      if (result) {
        if (targetNote.type === 'hold') {
          targetNote.holdPressed = true;
          targetNote.holdStartTime = this.currentTime;
          this.laneHoldMap.set(lane, targetNote.id);
          return null;
        } else if (targetNote.type === 'slide') {
          targetNote.slideStartTime = this.currentTime;
          return null;
        } else {
          targetNote.isJudged = true;
          targetNote.judgeResult = result;
          return {
            result,
            time: this.currentTime,
            lane,
            lyricChar: targetNote.lyricChar,
            noteType: targetNote.type,
            noteId: targetNote.id
          };
        }
      }
    } else {
      this.pressedLanes.delete(lane);
      
      const holdNoteId = this.laneHoldMap.get(lane);
      if (holdNoteId !== undefined) {
        const holdNote = this.notes.find(n => n.id === holdNoteId);
        if (holdNote && holdNote.type === 'hold' && holdNote.holdPressed && !holdNote.isJudged) {
          const holdDuration = this.currentTime - (holdNote.holdStartTime || holdNote.time);
          const expectedDuration = holdNote.duration || 1000;
          const holdRatio = holdDuration / expectedDuration;
          
          let result: JudgeResult = 'miss';
          if (holdRatio >= 0.9) result = 'perfect';
          else if (holdRatio >= 0.7) result = 'great';
          else if (holdRatio >= 0.5) result = 'good';
          
          holdNote.isJudged = true;
          holdNote.judgeResult = result;
          this.laneHoldMap.delete(lane);
          
          return {
            result,
            time: this.currentTime,
            lane: holdNote.lane,
            lyricChar: holdNote.lyricChar,
            noteType: holdNote.type,
            noteId: holdNote.id
          };
        }
      }
    }

    return null;
  }

  public handleSlideMove(fromLane: number, toLane: number): JudgeEvent | null {
    const slideNote = this.notes.find(n => 
      !n.isJudged && 
      n.type === 'slide' && 
      n.slideStartTime !== undefined &&
      n.lane === fromLane &&
      n.endLane === toLane
    );

    if (slideNote && !slideNote.isJudged) {
      const slideDuration = this.currentTime - (slideNote.slideStartTime || slideNote.time);
      const expectedDuration = slideNote.duration || 500;
      const slideRatio = slideDuration / expectedDuration;
      
      let result: JudgeResult = 'miss';
      if (slideRatio >= 0.9) result = 'perfect';
      else if (slideRatio >= 0.7) result = 'great';
      else if (slideRatio >= 0.5) result = 'good';
      
      slideNote.isJudged = true;
      slideNote.judgeResult = result;
      
      return {
        result,
        time: this.currentTime,
        lane: toLane,
        lyricChar: slideNote.lyricChar,
        noteType: slideNote.type,
        noteId: slideNote.id
      };
    }

    return null;
  }

  private tryCompleteSlideByKeyPress(toLane: number): JudgeEvent | null {
    const activeSlideNote = this.notes.find(n => 
      !n.isJudged && 
      n.type === 'slide' && 
      n.slideStartTime !== undefined &&
      n.endLane === toLane &&
      n.lane !== toLane
    );

    if (activeSlideNote && !activeSlideNote.isJudged) {
      const slideDuration = this.currentTime - (activeSlideNote.slideStartTime || activeSlideNote.time);
      const expectedDuration = activeSlideNote.duration || 500;
      const slideRatio = slideDuration / expectedDuration;
      
      let result: JudgeResult = 'miss';
      if (slideRatio >= 0.9) result = 'perfect';
      else if (slideRatio >= 0.7) result = 'great';
      else if (slideRatio >= 0.5) result = 'good';
      
      activeSlideNote.isJudged = true;
      activeSlideNote.judgeResult = result;
      
      return {
        result,
        time: this.currentTime,
        lane: toLane,
        lyricChar: activeSlideNote.lyricChar,
        noteType: activeSlideNote.type,
        noteId: activeSlideNote.id
      };
    }

    return null;
  }

  public getActiveSlideNoteByEndLane(endLane: number): ActiveNote | undefined {
    return this.notes.find(n => 
      !n.isJudged && 
      n.type === 'slide' && 
      n.slideStartTime !== undefined &&
      n.endLane === endLane
    );
  }

  public hasActiveSlideStartingFrom(lane: number): boolean {
    return this.notes.some(n => 
      !n.isJudged && 
      n.type === 'slide' && 
      n.slideStartTime !== undefined &&
      n.lane === lane
    );
  }

  private findClosestNote(lane: number): ActiveNote | null {
    const unjudgedNotes = this.notes
      .filter(note => 
        !note.isJudged && 
        note.lane === lane &&
        !note.holdPressed &&
        note.slideStartTime === undefined &&
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
    return this.notes.filter(note => !note.isJudged && note.y > -100 && note.y < this.judgeLineY + 400);
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
    this.pressedLanes.clear();
    this.laneHoldMap.clear();
  }

  public getJudgeLineY(): number {
    return this.judgeLineY;
  }

  public getLaneCount(): number {
    return LANE_COUNT;
  }

  public isLanePressed(lane: number): boolean {
    return this.pressedLanes.has(lane);
  }

  public getActiveHoldNote(lane: number): ActiveNote | undefined {
    const noteId = this.laneHoldMap.get(lane);
    if (noteId !== undefined) {
      return this.notes.find(n => n.id === noteId);
    }
    return undefined;
  }

  public getNoteType(noteId: number): NoteType | undefined {
    return this.notes.find(n => n.id === noteId)?.type;
  }

  public getNoteStartLane(noteId: number): number | undefined {
    return this.notes.find(n => n.id === noteId)?.lane;
  }

  public getNoteEndLane(noteId: number): number | undefined {
    return this.notes.find(n => n.id === noteId)?.endLane;
  }
}
