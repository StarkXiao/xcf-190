import {
  UnlockCondition,
  SongUnlockInfo,
  RATING_RANK,
  CHAPTER_UNLOCK_KEY,
  Difficulty,
  BestScore
} from '../types';
import { songs, getSongById, SongWithUnlock } from '../data/songs';
import { ScoreStorage } from './ScoreStorage';

interface UnlockRecord {
  unlockedSongs: string[];
  unlockedAt: Record<string, number>;
}

export class ChapterUnlockManager {
  private static loadUnlockRecord(): UnlockRecord {
    try {
      const data = localStorage.getItem(CHAPTER_UNLOCK_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load unlock record:', e);
    }
    return {
      unlockedSongs: [],
      unlockedAt: {}
    };
  }

  private static saveUnlockRecord(record: UnlockRecord): void {
    try {
      localStorage.setItem(CHAPTER_UNLOCK_KEY, JSON.stringify(record));
    } catch (e) {
      console.error('Failed to save unlock record:', e);
    }
  }

  public static isRatingSufficient(currentRating: string, minRating: string): boolean {
    const currentRank = RATING_RANK[currentRating] ?? 0;
    const minRank = RATING_RANK[minRating] ?? 0;
    return currentRank >= minRank;
  }

  public static checkConditionMet(
    condition: UnlockCondition,
    prerequisiteSongId: string
  ): { met: boolean; ratingMet: boolean; accuracyMet: boolean; bestScore?: BestScore } {
    const checkDifficulty: Difficulty = condition.difficulty || 'normal';
    const bestScore = ScoreStorage.getBestScore(prerequisiteSongId, checkDifficulty);

    if (!bestScore) {
      return { met: false, ratingMet: false, accuracyMet: false };
    }

    let ratingMet = true;
    let accuracyMet = true;

    if (condition.type === 'rating' || condition.type === 'both') {
      if (condition.minRating) {
        ratingMet = this.isRatingSufficient(bestScore.rating, condition.minRating);
      }
    }

    if (condition.type === 'accuracy' || condition.type === 'both') {
      if (condition.minAccuracy !== undefined) {
        accuracyMet = bestScore.accuracy >= condition.minAccuracy;
      }
    }

    let met = false;
    switch (condition.type) {
      case 'rating':
        met = ratingMet;
        break;
      case 'accuracy':
        met = accuracyMet;
        break;
      case 'both':
        met = ratingMet && accuracyMet;
        break;
    }

    return { met, ratingMet, accuracyMet, bestScore };
  }

  public static getUnlockInfo(songId: string): SongUnlockInfo {
    const song = getSongById(songId);
    if (!song) {
      return {
        songId,
        unlockCondition: null,
        isUnlocked: true
      };
    }

    const unlockRecord = this.loadUnlockRecord();
    const isUnlocked = this.isSongUnlocked(songId, unlockRecord);

    const info: SongUnlockInfo = {
      songId,
      unlockCondition: song.unlockCondition,
      isUnlocked
    };

    if (song.unlockCondition && song.prerequisiteSongId && !isUnlocked) {
      const checkResult = this.checkConditionMet(song.unlockCondition, song.prerequisiteSongId);
      const bestScore = checkResult.bestScore;

      let overallProgress = 0;
      let progressParts = 0;

      if (song.unlockCondition.type === 'rating' || song.unlockCondition.type === 'both') {
        progressParts++;
        if (bestScore && song.unlockCondition.minRating) {
          const currentRank = RATING_RANK[bestScore.rating] ?? 0;
          const minRank = RATING_RANK[song.unlockCondition.minRating] ?? 0;
          const maxRank = 4;
          overallProgress += Math.min(1, currentRank / Math.max(1, minRank)) * (minRank / maxRank);
          if (checkResult.ratingMet) {
            overallProgress += (1 - minRank / maxRank);
          }
        }
      }

      if (song.unlockCondition.type === 'accuracy' || song.unlockCondition.type === 'both') {
        progressParts++;
        if (bestScore && song.unlockCondition.minAccuracy !== undefined) {
          const accProgress = Math.min(1, bestScore.accuracy / song.unlockCondition.minAccuracy);
          overallProgress += accProgress;
        }
      }

      if (progressParts > 0) {
        overallProgress = overallProgress / progressParts;
      }

      info.progress = {
        currentRating: bestScore?.rating,
        currentAccuracy: bestScore?.accuracy,
        ratingMet: checkResult.ratingMet,
        accuracyMet: checkResult.accuracyMet,
        overallProgress
      };
    }

    return info;
  }

  public static isSongUnlocked(songId: string, record?: UnlockRecord): boolean {
    const song = getSongById(songId);
    if (!song) return false;

    if (!song.unlockCondition) {
      return true;
    }

    const unlockRecord = record || this.loadUnlockRecord();
    if (unlockRecord.unlockedSongs.includes(songId)) {
      return true;
    }

    if (song.unlockCondition && song.prerequisiteSongId) {
      const result = this.checkConditionMet(song.unlockCondition, song.prerequisiteSongId);
      if (result.met) {
        this.unlockSong(songId, unlockRecord);
        return true;
      }
    }

    return false;
  }

  private static unlockSong(songId: string, record?: UnlockRecord): void {
    const unlockRecord = record || this.loadUnlockRecord();
    if (!unlockRecord.unlockedSongs.includes(songId)) {
      unlockRecord.unlockedSongs.push(songId);
      unlockRecord.unlockedAt[songId] = Date.now();
      this.saveUnlockRecord(unlockRecord);
    }
  }

  public static evaluateAndUnlockAll(): { newlyUnlocked: string[]; allUnlockInfo: Map<string, SongUnlockInfo> } {
    const newlyUnlocked: string[] = [];
    const allUnlockInfo = new Map<string, SongUnlockInfo>();

    for (const song of songs) {
      const wasUnlockedBefore = this.isSongUnlocked(song.id);
      const info = this.getUnlockInfo(song.id);
      allUnlockInfo.set(song.id, info);

      if (info.isUnlocked && !wasUnlockedBefore) {
        newlyUnlocked.push(song.id);
      }
    }

    return { newlyUnlocked, allUnlockInfo };
  }

  public static evaluateAfterScore(
    songId: string,
    difficulty: Difficulty
  ): { newlyUnlocked: string[]; unlockedSongs: SongWithUnlock[] } {
    const newlyUnlocked: string[] = [];
    const unlockedSongs: SongWithUnlock[] = [];

    for (const song of songs) {
      if (song.prerequisiteSongId === songId && song.unlockCondition) {
        const checkDiff = song.unlockCondition.difficulty || 'normal';
        if (checkDiff === difficulty) {
          const result = this.checkConditionMet(song.unlockCondition, songId);
          if (result.met && !this.isSongUnlocked(song.id)) {
            this.unlockSong(song.id);
            newlyUnlocked.push(song.id);
            unlockedSongs.push(song);
          }
        } else {
          const checkResult = this.checkConditionMet(song.unlockCondition, songId);
          if (checkResult.met && !this.isSongUnlocked(song.id)) {
            this.unlockSong(song.id);
            newlyUnlocked.push(song.id);
            unlockedSongs.push(song);
          }
        }
      }
    }

    const cascaded = this.evaluateCascadeUnlock();
    for (const id of cascaded) {
      if (!newlyUnlocked.includes(id)) {
        newlyUnlocked.push(id);
        const song = getSongById(id);
        if (song) {
          unlockedSongs.push(song);
        }
      }
    }

    return { newlyUnlocked, unlockedSongs };
  }

  private static evaluateCascadeUnlock(): string[] {
    const newlyUnlocked: string[] = [];
    let changed = true;
    let iterations = 0;
    const maxIterations = songs.length;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const song of songs) {
        if (!this.isSongUnlocked(song.id) && song.unlockCondition && song.prerequisiteSongId) {
          if (this.isSongUnlocked(song.prerequisiteSongId)) {
            const result = this.checkConditionMet(song.unlockCondition, song.prerequisiteSongId);
            if (result.met) {
              this.unlockSong(song.id);
              newlyUnlocked.push(song.id);
              changed = true;
            }
          }
        }
      }
    }

    return newlyUnlocked;
  }

  public static getAllSongsWithUnlockInfo(): SongUnlockInfo[] {
    return songs.map(song => this.getUnlockInfo(song.id));
  }

  public static resetAllUnlocks(): void {
    this.saveUnlockRecord({
      unlockedSongs: [],
      unlockedAt: {}
    });
  }

  public static getProgressText(condition: UnlockCondition, progress?: SongUnlockInfo['progress']): string {
    if (!progress) return '尚未开始挑战前置章节';

    const parts: string[] = [];

    if (condition.type === 'rating' || condition.type === 'both') {
      if (condition.minRating) {
        const status = progress.ratingMet ? '✓' : '✗';
        const current = progress.currentRating || '无';
        parts.push(`评级${status} (当前:${current} 需≥${condition.minRating})`);
      }
    }

    if (condition.type === 'accuracy' || condition.type === 'both') {
      if (condition.minAccuracy !== undefined) {
        const status = progress.accuracyMet ? '✓' : '✗';
        const current = progress.currentAccuracy !== undefined ? `${progress.currentAccuracy.toFixed(1)}%` : '无';
        parts.push(`准确率${status} (当前:${current} 需≥${condition.minAccuracy}%)`);
      }
    }

    return parts.join('  ');
  }

  public static forceUnlock(songId: string): boolean {
    const song = getSongById(songId);
    if (!song) return false;
    if (!this.isSongUnlocked(songId)) {
      this.unlockSong(songId);
      return true;
    }
    return false;
  }
}
