import { BestScore, BestScoreRecord, Difficulty, ScoreData } from '../types';

const STORAGE_KEY = 'floating-island-bookstore-best-scores';

export class ScoreStorage {
  private static loadAll(): BestScoreRecord {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load best scores:', e);
    }
    return {};
  }

  private static saveAll(scores: BestScoreRecord): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch (e) {
      console.error('Failed to save best scores:', e);
    }
  }

  public static getBestScore(songId: string, difficulty: Difficulty): BestScore | null {
    const allScores = this.loadAll();
    if (allScores[songId] && allScores[songId][difficulty]) {
      return allScores[songId][difficulty];
    }
    return null;
  }

  public static getAllBestScores(): BestScoreRecord {
    return this.loadAll();
  }

  public static saveBestScore(songId: string, difficulty: Difficulty, scoreData: ScoreData): BestScore {
    const allScores = this.loadAll();
    
    if (!allScores[songId]) {
      allScores[songId] = {
        easy: null,
        normal: null,
        hard: null
      };
    }

    const newScore: BestScore = {
      score: scoreData.score,
      rating: scoreData.rating,
      maxCombo: scoreData.maxCombo,
      perfect: scoreData.perfect,
      great: scoreData.great,
      good: scoreData.good,
      miss: scoreData.miss
    };

    const currentBest = allScores[songId][difficulty];
    if (!currentBest || newScore.score > currentBest.score) {
      allScores[songId][difficulty] = newScore;
      this.saveAll(allScores);
    }

    return newScore;
  }

  public static isNewBestScore(songId: string, difficulty: Difficulty, scoreData: ScoreData): boolean {
    const currentBest = this.getBestScore(songId, difficulty);
    if (!currentBest) return true;
    return scoreData.score > currentBest.score;
  }

  public static clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
