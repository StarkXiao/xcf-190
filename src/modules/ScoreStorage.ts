import { BestScore, BestScoreRecord, Difficulty, ScoreData, ScoreHistory, ScoreHistoryEntry } from '../types';
import { CloudSaveSystem } from './CloudSaveSystem';

const BEST_STORAGE_KEY = 'floating-island-bookstore-best-scores';
const HISTORY_STORAGE_KEY = 'floating-island-bookstore-score-history';
const MAX_HISTORY_ENTRIES = 100;

export class ScoreStorage {
  private static normalizeBestScore(raw: any): BestScore {
    return {
      score: raw.score ?? 0,
      rating: raw.rating ?? 'D',
      maxCombo: raw.maxCombo ?? 0,
      perfect: raw.perfect ?? 0,
      great: raw.great ?? 0,
      good: raw.good ?? 0,
      miss: raw.miss ?? 0,
      accuracy: raw.accuracy ?? this.computeAccuracyFallback(raw)
    };
  }

  private static computeAccuracyFallback(raw: any): number {
    const perfect = raw.perfect ?? 0;
    const great = raw.great ?? 0;
    const good = raw.good ?? 0;
    const miss = raw.miss ?? 0;
    const total = perfect + great + good + miss;
    if (total === 0) return 0;
    return (perfect * 100 + great * 70 + good * 30) / total;
  }

  private static normalizeHistoryEntry(raw: any): ScoreHistoryEntry {
    return {
      score: raw.score ?? 0,
      rating: raw.rating ?? 'D',
      maxCombo: raw.maxCombo ?? 0,
      perfect: raw.perfect ?? 0,
      great: raw.great ?? 0,
      good: raw.good ?? 0,
      miss: raw.miss ?? 0,
      accuracy: raw.accuracy ?? this.computeAccuracyFallback(raw),
      timestamp: raw.timestamp ?? 0,
      songId: raw.songId ?? '',
      songTitle: raw.songTitle ?? '',
      difficulty: raw.difficulty ?? 'normal'
    };
  }

  private static loadAllBest(): BestScoreRecord {
    try {
      const data = localStorage.getItem(BEST_STORAGE_KEY);
      if (data) {
        const raw = JSON.parse(data);
        const normalized: BestScoreRecord = {};
        for (const songId of Object.keys(raw)) {
          normalized[songId] = {
            easy: raw[songId].easy ? this.normalizeBestScore(raw[songId].easy) : null,
            normal: raw[songId].normal ? this.normalizeBestScore(raw[songId].normal) : null,
            hard: raw[songId].hard ? this.normalizeBestScore(raw[songId].hard) : null
          };
        }
        return normalized;
      }
    } catch (e) {
      console.error('Failed to load best scores:', e);
    }
    return {};
  }

  private static saveAllBest(scores: BestScoreRecord): void {
    try {
      localStorage.setItem(BEST_STORAGE_KEY, JSON.stringify(scores));
    } catch (e) {
      console.error('Failed to save best scores:', e);
    }
  }

  private static loadAllHistory(): ScoreHistory {
    try {
      const data = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (data) {
        const raw: any[] = JSON.parse(data);
        return raw.map(entry => this.normalizeHistoryEntry(entry));
      }
    } catch (e) {
      console.error('Failed to load score history:', e);
    }
    return [];
  }

  private static saveAllHistory(history: ScoreHistory): void {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save score history:', e);
    }
  }

  public static getBestScore(songId: string, difficulty: Difficulty): BestScore | null {
    const allScores = this.loadAllBest();
    if (allScores[songId] && allScores[songId][difficulty]) {
      return allScores[songId][difficulty];
    }
    return null;
  }

  public static getAllBestScores(): BestScoreRecord {
    return this.loadAllBest();
  }

  public static getBestScoresForSong(songId: string): Record<Difficulty, BestScore | null> {
    const allScores = this.loadAllBest();
    return allScores[songId] || { easy: null, normal: null, hard: null };
  }

  public static saveBestScore(
    songId: string,
    difficulty: Difficulty,
    scoreData: ScoreData,
    accuracy: number
  ): BestScore {
    const allScores = this.loadAllBest();

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
      miss: scoreData.miss,
      accuracy
    };

    const currentBest = allScores[songId][difficulty];
    if (!currentBest || newScore.score > currentBest.score) {
      allScores[songId][difficulty] = newScore;
      this.saveAllBest(allScores);
    }

    try {
      CloudSaveSystem.updateBestScores(allScores);
    } catch (e) {
      console.error('Failed to update cloud save with best scores:', e);
    }

    return newScore;
  }

  public static isNewBestScore(
    songId: string,
    difficulty: Difficulty,
    scoreData: ScoreData
  ): boolean {
    const currentBest = this.getBestScore(songId, difficulty);
    if (!currentBest) return true;
    return scoreData.score > currentBest.score;
  }

  public static addHistoryEntry(
    songId: string,
    songTitle: string,
    difficulty: Difficulty,
    scoreData: ScoreData,
    accuracy: number,
    isPractice: boolean = false,
    practiceSpeed: number = 1.0
  ): ScoreHistoryEntry {
    const history = this.loadAllHistory();

    const entry: ScoreHistoryEntry = {
      score: scoreData.score,
      rating: scoreData.rating,
      maxCombo: scoreData.maxCombo,
      perfect: scoreData.perfect,
      great: scoreData.great,
      good: scoreData.good,
      miss: scoreData.miss,
      accuracy,
      timestamp: Date.now(),
      songId,
      songTitle,
      difficulty,
      isPractice,
      practiceSpeed
    };

    history.unshift(entry);

    if (history.length > MAX_HISTORY_ENTRIES) {
      history.length = MAX_HISTORY_ENTRIES;
    }

    this.saveAllHistory(history);

    try {
      CloudSaveSystem.updateScoreHistory(history);
    } catch (e) {
      console.error('Failed to update cloud save with score history:', e);
    }

    return entry;
  }

  public static getScoreHistory(): ScoreHistory {
    return this.loadAllHistory();
  }

  public static getScoreHistoryForSong(songId: string): ScoreHistory {
    return this.loadAllHistory().filter(entry => entry.songId === songId);
  }

  public static getScoreHistoryForDifficulty(songId: string, difficulty: Difficulty): ScoreHistory {
    return this.loadAllHistory().filter(
      entry => entry.songId === songId && entry.difficulty === difficulty
    );
  }

  public static getTopScores(
    songId?: string,
    difficulty?: Difficulty,
    limit: number = 10
  ): ScoreHistory {
    let history = this.loadAllHistory();

    if (songId) {
      history = history.filter(entry => entry.songId === songId);
    }
    if (difficulty) {
      history = history.filter(entry => entry.difficulty === difficulty);
    }

    return history.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  public static getPreviousBestScore(
    songId: string,
    difficulty: Difficulty
  ): BestScore | null {
    const history = this.getScoreHistoryForDifficulty(songId, difficulty);
    if (history.length <= 1) {
      return this.getBestScore(songId, difficulty);
    }
    const sorted = [...history].sort((a, b) => b.score - a.score);
    if (sorted.length >= 2) {
      return {
        score: sorted[1].score,
        rating: sorted[1].rating,
        maxCombo: sorted[1].maxCombo,
        perfect: sorted[1].perfect,
        great: sorted[1].great,
        good: sorted[1].good,
        miss: sorted[1].miss,
        accuracy: sorted[1].accuracy
      };
    }
    return this.getBestScore(songId, difficulty);
  }

  public static clearAll(): void {
    localStorage.removeItem(BEST_STORAGE_KEY);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    
    try {
      CloudSaveSystem.updateBestScores({});
      CloudSaveSystem.updateScoreHistory([]);
    } catch (e) {
      console.error('Failed to update cloud save after clear:', e);
    }
  }

  public static clearHistory(): void {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    
    try {
      CloudSaveSystem.updateScoreHistory([]);
    } catch (e) {
      console.error('Failed to update cloud save after history clear:', e);
    }
  }
}
