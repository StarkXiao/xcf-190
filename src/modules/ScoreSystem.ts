import { JudgeResult, ScoreData, SCORE_VALUE, NoteType, NOTE_TYPE_SCORE_MULTIPLIER, createInitialNoteTypeStats, NoteTypeStats } from '../types';

export class ScoreSystem {
  private scoreData: ScoreData;
  private totalNotes: number;

  constructor(totalNotes: number) {
    this.totalNotes = totalNotes;
    this.scoreData = this.createInitialScore();
  }

  private createInitialScore(): ScoreData {
    return {
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0,
      combo: 0,
      maxCombo: 0,
      score: 0,
      rating: 'C',
      typeStats: createInitialNoteTypeStats()
    };
  }

  public addJudgeResult(result: JudgeResult, noteType: NoteType = 'tap'): void {
    this.scoreData[result]++;
    this.scoreData.typeStats[noteType][result]++;
    this.updateCombo(result);
    this.updateScore(result, noteType);
    this.updateRating();
  }

  private updateCombo(result: JudgeResult): void {
    if (result === 'miss') {
      this.scoreData.combo = 0;
    } else {
      this.scoreData.combo++;
      if (this.scoreData.combo > this.scoreData.maxCombo) {
        this.scoreData.maxCombo = this.scoreData.combo;
      }
    }
  }

  private updateScore(result: JudgeResult, noteType: NoteType): void {
    const baseScore = SCORE_VALUE[result];
    const typeMultiplier = NOTE_TYPE_SCORE_MULTIPLIER[noteType];
    const comboBonus = Math.floor(this.scoreData.combo / 10) * 10;
    this.scoreData.score += Math.floor(baseScore * typeMultiplier) + comboBonus;
  }

  private updateRating(): void {
    const accuracy = this.calculateAccuracy();
    
    if (accuracy >= 95) this.scoreData.rating = 'S';
    else if (accuracy >= 90) this.scoreData.rating = 'A';
    else if (accuracy >= 80) this.scoreData.rating = 'B';
    else if (accuracy >= 70) this.scoreData.rating = 'C';
    else this.scoreData.rating = 'D';
  }

  public calculateAccuracy(): number {
    if (this.getTotalJudged() === 0) return 100;
    
    const weightedScore = 
      this.scoreData.perfect * 100 +
      this.scoreData.great * 70 +
      this.scoreData.good * 30;
    
    const maxPossibleScore = this.getTotalJudged() * 100;
    return (weightedScore / maxPossibleScore) * 100;
  }

  public calculateTypeAccuracy(type: NoteType): number {
    const stats = this.scoreData.typeStats[type];
    const total = stats.perfect + stats.great + stats.good + stats.miss;
    if (total === 0) return 100;
    
    const weightedScore = 
      stats.perfect * 100 +
      stats.great * 70 +
      stats.good * 30;
    
    return (weightedScore / (total * 100)) * 100;
  }

  private getTotalJudged(): number {
    return this.scoreData.perfect + this.scoreData.great + this.scoreData.good + this.scoreData.miss;
  }

  public getScore(): ScoreData {
    return { ...this.scoreData, typeStats: { ...this.scoreData.typeStats } };
  }

  public getTypeStats(): NoteTypeStats {
    return { ...this.scoreData.typeStats };
  }

  public getMaxPossibleScore(): number {
    return this.totalNotes * SCORE_VALUE.perfect;
  }

  public getProgress(): number {
    return this.getTotalJudged() / this.totalNotes;
  }

  public isAllJudged(): boolean {
    return this.getTotalJudged() >= this.totalNotes;
  }

  public reset(): void {
    this.scoreData = this.createInitialScore();
  }

  public getCombo(): number {
    return this.scoreData.combo;
  }

  public getScoreValue(): number {
    return this.scoreData.score;
  }

  public getRating(): string {
    return this.scoreData.rating;
  }
}
