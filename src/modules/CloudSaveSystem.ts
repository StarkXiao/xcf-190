import {
  CloudSaveData,
  LocalSaveCache,
  SaveConflict,
  SyncStatus,
  SyncResult,
  ConflictResolutionStrategy,
  RecoveryCheckpoint,
  LOCAL_SAVE_CACHE_KEY,
  RECOVERY_CHECKPOINTS_KEY,
  SAVE_VERSION_INITIAL,
  MAX_RECOVERY_CHECKPOINTS,
  MIGRATION_CODE_EXPIRY_HOURS,
  BestScoreRecord,
  ScoreHistory,
  Difficulty,
  BestScore
} from '../types';
import { AccountSystem } from './AccountSystem';
import { ScoreStorage } from './ScoreStorage';

const BEST_STORAGE_KEY = 'floating-island-bookstore-best-scores';
const HISTORY_STORAGE_KEY = 'floating-island-bookstore-score-history';
const MIGRATION_CODES_CLOUD_KEY = 'floating-island-bookstore-migration-codes-cloud';

export class CloudSaveSystem {
  private static localCache: LocalSaveCache | null = null;
  private static autoSyncEnabled: boolean = true;
  private static syncInProgress: boolean = false;
  private static pendingSyncTimeout: number | null = null;
  private static currentAccountId: string | null = null;

  private static getAccountCacheKey(accountId: string): string {
    return `${LOCAL_SAVE_CACHE_KEY}_${accountId}`;
  }

  private static getAccountCheckpointsKey(accountId: string): string {
    return `${RECOVERY_CHECKPOINTS_KEY}_${accountId}`;
  }

  private static generateChecksum(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private static createInitialSaveData(accountId: string): CloudSaveData {
    const deviceId = AccountSystem.getCurrentDeviceId();
    
    return {
      accountId,
      saveVersion: {
        version: SAVE_VERSION_INITIAL,
        timestamp: Date.now(),
        deviceId,
        checksum: ''
      },
      bestScores: {},
      scoreHistory: [],
      favorites: [],
      settings: {}
    };
  }

  private static loadLocalCache(): void {
    const account = AccountSystem.getCurrentAccount();
    if (!account) {
      this.localCache = null;
      return;
    }

    const cacheKey = this.getAccountCacheKey(account.accountId);
    this.currentAccountId = account.accountId;

    try {
      const data = localStorage.getItem(cacheKey);
      if (data) {
        this.localCache = JSON.parse(data);
      } else {
        this.localCache = {
          saveData: this.createInitialSaveData(account.accountId),
          lastSyncedAt: 0,
          syncStatus: 'idle',
          pendingChanges: [],
          conflicts: []
        };
      }
    } catch (e) {
      console.error('Failed to load local save cache:', e);
      this.localCache = {
        saveData: this.createInitialSaveData(account.accountId),
        lastSyncedAt: 0,
        syncStatus: 'idle',
        pendingChanges: [],
        conflicts: []
      };
    }
  }

  private static saveLocalCache(): void {
    if (!this.localCache || !this.currentAccountId) return;
    try {
      const cacheKey = this.getAccountCacheKey(this.currentAccountId);
      localStorage.setItem(cacheKey, JSON.stringify(this.localCache));
    } catch (e) {
      console.error('Failed to save local cache:', e);
    }
  }

  private static loadRecoveryCheckpoints(): RecoveryCheckpoint[] {
    if (!this.currentAccountId) return [];
    try {
      const key = this.getAccountCheckpointsKey(this.currentAccountId);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load recovery checkpoints:', e);
      return [];
    }
  }

  private static saveRecoveryCheckpoints(checkpoints: RecoveryCheckpoint[]): void {
    if (!this.currentAccountId) return;
    try {
      const key = this.getAccountCheckpointsKey(this.currentAccountId);
      localStorage.setItem(key, JSON.stringify(checkpoints));
    } catch (e) {
      console.error('Failed to save recovery checkpoints:', e);
    }
  }

  public static initialize(): void {
    this.switchToCurrentAccount();
  }

  public static switchToCurrentAccount(): void {
    const account = AccountSystem.getCurrentAccount();
    if (!account) return;

    if (this.pendingSyncTimeout !== null) {
      clearTimeout(this.pendingSyncTimeout);
      this.pendingSyncTimeout = null;
    }

    this.loadLocalCache();
    this.loadFromScoreStorage();

    if (this.autoSyncEnabled && navigator.onLine && account.accountType === 'registered') {
      this.syncWithCloud('merge');
    }
  }

  private static loadFromScoreStorage(): void {
    if (!this.localCache) return;

    const bestScores = ScoreStorage.getAllBestScores();
    const scoreHistory = ScoreStorage.getScoreHistory();

    this.localCache.saveData.bestScores = bestScores;
    this.localCache.saveData.scoreHistory = scoreHistory;

    this.saveLocalCache();
  }

  private static syncToScoreStorage(): void {
    if (!this.localCache) return;

    const { bestScores, scoreHistory } = this.localCache.saveData;

    try {
      localStorage.setItem(BEST_STORAGE_KEY, JSON.stringify(bestScores));
    } catch (e) {
      console.error('Failed to sync best scores to storage:', e);
    }

    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(scoreHistory));
    } catch (e) {
      console.error('Failed to sync score history to storage:', e);
    }
  }

  private static incrementVersion(): void {
    if (!this.localCache) return;
    
    const deviceId = AccountSystem.getCurrentDeviceId();
    this.localCache.saveData.saveVersion = {
      version: this.localCache.saveData.saveVersion.version + 1,
      timestamp: Date.now(),
      deviceId,
      checksum: this.generateChecksum(this.localCache.saveData)
    };
  }

  private static markPendingChange(field: string): void {
    if (!this.localCache) return;
    
    if (!this.localCache.pendingChanges.includes(field)) {
      this.localCache.pendingChanges.push(field);
    }
    
    this.incrementVersion();
    this.saveLocalCache();

    if (this.autoSyncEnabled && navigator.onLine) {
      this.scheduleAutoSync();
    }
  }

  private static scheduleAutoSync(): void {
    if (this.pendingSyncTimeout !== null) {
      clearTimeout(this.pendingSyncTimeout);
    }
    
    this.pendingSyncTimeout = window.setTimeout(() => {
      this.syncWithCloud('merge');
    }, 5000);
  }

  private static async fetchCloudSave(accountId: string): Promise<CloudSaveData | null> {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const cloudKey = 'cloud_save_' + accountId;
      const stored = localStorage.getItem(cloudKey);
      
      if (stored) {
        return JSON.parse(stored);
      }

      return null;
    } catch (e) {
      throw new Error('Failed to fetch cloud save');
    }
  }

  private static async pushCloudSave(data: CloudSaveData): Promise<void> {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const cloudKey = 'cloud_save_' + data.accountId;
      localStorage.setItem(cloudKey, JSON.stringify(data));
    } catch (e) {
      throw new Error('Failed to push cloud save');
    }
  }

  private static detectConflicts(local: CloudSaveData, cloud: CloudSaveData): SaveConflict[] {
    const conflicts: SaveConflict[] = [];

    if (local.saveVersion.version !== cloud.saveVersion.version) {
      if (local.bestScores && cloud.bestScores) {
        const allSongIds = new Set([
          ...Object.keys(local.bestScores),
          ...Object.keys(cloud.bestScores)
        ]);

        for (const songId of allSongIds) {
          for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) {
            const localScore = local.bestScores[songId]?.[difficulty];
            const cloudScore = cloud.bestScores[songId]?.[difficulty];

            if (localScore && cloudScore && localScore.score !== cloudScore.score) {
              conflicts.push({
                id: `score_${songId}_${difficulty}`,
                field: `bestScores.${songId}.${difficulty}`,
                localValue: localScore,
                cloudValue: cloudScore,
                resolved: false
              });
            }
          }
        }
      }

      if (local.scoreHistory.length !== cloud.scoreHistory.length) {
        conflicts.push({
          id: 'scoreHistory',
          field: 'scoreHistory',
          localValue: local.scoreHistory,
          cloudValue: cloud.scoreHistory,
          resolved: false
        });
      }

      if (JSON.stringify(local.favorites) !== JSON.stringify(cloud.favorites)) {
        conflicts.push({
          id: 'favorites',
          field: 'favorites',
          localValue: local.favorites,
          cloudValue: cloud.favorites,
          resolved: false
        });
      }
    }

    return conflicts;
  }

  private static mergeBestScores(
    local: BestScoreRecord,
    cloud: BestScoreRecord
  ): BestScoreRecord {
    const merged: BestScoreRecord = {};
    const allSongIds = new Set([...Object.keys(local), ...Object.keys(cloud)]);

    for (const songId of allSongIds) {
      merged[songId] = { easy: null, normal: null, hard: null };
      
      for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) {
        const localScore = local[songId]?.[difficulty];
        const cloudScore = cloud[songId]?.[difficulty];

        if (localScore && cloudScore) {
          merged[songId][difficulty] = localScore.score >= cloudScore.score ? localScore : cloudScore;
        } else if (localScore) {
          merged[songId][difficulty] = localScore;
        } else if (cloudScore) {
          merged[songId][difficulty] = cloudScore;
        }
      }
    }

    return merged;
  }

  private static mergeScoreHistory(
    local: ScoreHistory,
    cloud: ScoreHistory
  ): ScoreHistory {
    const seen = new Set<string>();
    const merged: ScoreHistory = [];

    const allEntries = [...local, ...cloud].sort((a, b) => b.timestamp - a.timestamp);

    for (const entry of allEntries) {
      const key = `${entry.songId}_${entry.difficulty}_${entry.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(entry);
      }
    }

    return merged.slice(0, 100);
  }

  private static mergeSaves(
    local: CloudSaveData,
    cloud: CloudSaveData,
    strategy: ConflictResolutionStrategy
  ): { merged: CloudSaveData; conflicts: SaveConflict[] } {
    const conflicts = this.detectConflicts(local, cloud);
    const merged: CloudSaveData = {
      ...local,
      saveVersion: {
        version: Math.max(local.saveVersion.version, cloud.saveVersion.version) + 1,
        timestamp: Date.now(),
        deviceId: AccountSystem.getCurrentDeviceId(),
        checksum: ''
      }
    };

    for (const conflict of conflicts) {
      if (conflict.field.startsWith('bestScores')) {
        merged.bestScores = this.mergeBestScores(local.bestScores, cloud.bestScores);
        conflict.resolved = true;
        conflict.resolution = 'merge';
      } else if (conflict.field === 'scoreHistory') {
        merged.scoreHistory = this.mergeScoreHistory(local.scoreHistory, cloud.scoreHistory);
        conflict.resolved = true;
        conflict.resolution = 'merge';
      } else if (conflict.field === 'favorites') {
        if (strategy === 'local_first' || strategy === 'merge') {
          const mergedFavorites = Array.from(new Set([...local.favorites, ...cloud.favorites]));
          merged.favorites = mergedFavorites;
          conflict.resolved = true;
          conflict.resolution = strategy === 'merge' ? 'merge' : 'local_first';
          conflict.resolvedValue = mergedFavorites;
        } else if (strategy === 'cloud_first') {
          merged.favorites = cloud.favorites;
          conflict.resolved = true;
          conflict.resolution = 'cloud_first';
          conflict.resolvedValue = cloud.favorites;
        }
      }
    }

    merged.saveVersion.checksum = this.generateChecksum(merged);

    return { merged, conflicts };
  }

  public static async syncWithCloud(
    strategy: ConflictResolutionStrategy = 'merge'
  ): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        status: 'error',
        mergedFields: [],
        conflicts: [],
        error: 'Sync already in progress'
      };
    }

    if (!this.localCache) {
      this.loadLocalCache();
    }

    const account = AccountSystem.getCurrentAccount();
    if (!account) {
      return {
        success: false,
        status: 'error',
        mergedFields: [],
        conflicts: [],
        error: 'Not logged in'
      };
    }

    if (!navigator.onLine) {
      return {
        success: false,
        status: 'error',
        mergedFields: [],
        conflicts: [],
        error: 'No internet connection'
      };
    }

    this.syncInProgress = true;
    if (this.localCache) {
      this.localCache.syncStatus = 'syncing';
      this.saveLocalCache();
    }

    try {
      this.createRecoveryCheckpoint('Pre-sync backup');

      const cloudSave = await this.fetchCloudSave(account.accountId);

      if (!cloudSave) {
        await this.pushCloudSave(this.localCache!.saveData);
        this.localCache!.lastSyncedAt = Date.now();
        this.localCache!.syncStatus = 'success';
        this.localCache!.pendingChanges = [];
        this.saveLocalCache();
        this.syncInProgress = false;

        return {
          success: true,
          status: 'success',
          mergedFields: [],
          conflicts: []
        };
      }

      const { merged, conflicts } = this.mergeSaves(
        this.localCache!.saveData,
        cloudSave,
        strategy
      );

      const unresolvedConflicts = conflicts.filter(c => !c.resolved);

      if (unresolvedConflicts.length > 0 && strategy === 'manual') {
        this.localCache!.syncStatus = 'error';
        this.localCache!.conflicts = unresolvedConflicts;
        this.saveLocalCache();
        this.syncInProgress = false;

        return {
          success: false,
          status: 'error',
          mergedFields: [],
          conflicts: unresolvedConflicts,
          error: 'Manual resolution required'
        };
      }

      this.localCache!.saveData = merged;
      this.localCache!.conflicts = conflicts;

      await this.pushCloudSave(merged);

      this.syncToScoreStorage();

      this.localCache!.lastSyncedAt = Date.now();
      this.localCache!.syncStatus = 'success';
      this.localCache!.pendingChanges = [];
      this.localCache!.lastSyncError = undefined;
      this.saveLocalCache();

      this.syncInProgress = false;

      const mergedFields = conflicts
        .filter(c => c.resolved)
        .map(c => c.field);

      return {
        success: true,
        status: 'success',
        mergedFields,
        conflicts
      };
    } catch (e) {
      if (this.localCache) {
        this.localCache.syncStatus = 'error';
        this.localCache.lastSyncError = e instanceof Error ? e.message : 'Sync failed';
        this.saveLocalCache();
      }
      this.syncInProgress = false;

      return {
        success: false,
        status: 'error',
        mergedFields: [],
        conflicts: [],
        error: e instanceof Error ? e.message : 'Sync failed'
      };
    }
  }

  public static updateBestScores(bestScores: BestScoreRecord): void {
    if (!this.localCache) return;
    
    this.localCache.saveData.bestScores = bestScores;
    this.markPendingChange('bestScores');
  }

  public static updateScoreHistory(scoreHistory: ScoreHistory): void {
    if (!this.localCache) return;
    
    this.localCache.saveData.scoreHistory = scoreHistory;
    this.markPendingChange('scoreHistory');
  }

  public static addFavorite(songId: string): void {
    if (!this.localCache) return;
    
    if (!this.localCache.saveData.favorites.includes(songId)) {
      this.localCache.saveData.favorites.push(songId);
      this.markPendingChange('favorites');
    }
  }

  public static removeFavorite(songId: string): void {
    if (!this.localCache) return;
    
    const index = this.localCache.saveData.favorites.indexOf(songId);
    if (index >= 0) {
      this.localCache.saveData.favorites.splice(index, 1);
      this.markPendingChange('favorites');
    }
  }

  public static getFavorites(): string[] {
    return this.localCache?.saveData.favorites || [];
  }

  public static isFavorite(songId: string): boolean {
    return this.getFavorites().includes(songId);
  }

  public static getSaveData(): CloudSaveData | null {
    return this.localCache?.saveData || null;
  }

  public static getSyncStatus(): SyncStatus {
    return this.localCache?.syncStatus || 'idle';
  }

  public static getLastSyncedAt(): number {
    return this.localCache?.lastSyncedAt || 0;
  }

  public static getConflicts(): SaveConflict[] {
    return this.localCache?.conflicts || [];
  }

  public static resolveConflict(
    conflictId: string,
    strategy: ConflictResolutionStrategy
  ): void {
    if (!this.localCache) return;
    
    const conflict = this.localCache.conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    if (strategy === 'local_first') {
      conflict.resolvedValue = conflict.localValue;
    } else if (strategy === 'cloud_first') {
      conflict.resolvedValue = conflict.cloudValue;
    } else if (strategy === 'merge') {
      if (conflict.field.startsWith('bestScores')) {
        const local = conflict.localValue as BestScore;
        const cloud = conflict.cloudValue as BestScore;
        conflict.resolvedValue = local.score >= cloud.score ? local : cloud;
      } else if (conflict.field === 'scoreHistory') {
        conflict.resolvedValue = this.mergeScoreHistory(
          conflict.localValue,
          conflict.cloudValue
        );
      } else if (conflict.field === 'favorites') {
        conflict.resolvedValue = Array.from(new Set([
          ...conflict.localValue,
          ...conflict.cloudValue
        ]));
      }
    }
    
    conflict.resolved = true;
    conflict.resolution = strategy;

    this.saveLocalCache();

    const allResolved = this.localCache.conflicts.every(c => c.resolved);
    if (allResolved && this.localCache.conflicts.length > 0) {
      this.applyResolvedConflicts();
    }
  }

  private static applyResolvedConflicts(): void {
    if (!this.localCache) return;

    for (const conflict of this.localCache.conflicts) {
      if (conflict.resolved && conflict.resolvedValue !== undefined) {
        const parts = conflict.field.split('.');
        let target: any = this.localCache.saveData;
        
        for (let i = 0; i < parts.length - 1; i++) {
          target = target[parts[i]];
        }
        
        target[parts[parts.length - 1]] = conflict.resolvedValue;
      }
    }

    this.incrementVersion();
    this.localCache.conflicts = [];
    this.saveLocalCache();

    this.syncToScoreStorage();

    if (navigator.onLine) {
      this.syncWithCloud('local_first');
    }
  }

  public static createRecoveryCheckpoint(description: string): RecoveryCheckpoint {
    if (!this.localCache) {
      throw new Error('Local cache not initialized');
    }

    const checkpoint: RecoveryCheckpoint = {
      id: 'ckpt_' + Date.now(),
      timestamp: Date.now(),
      saveData: JSON.parse(JSON.stringify(this.localCache.saveData)),
      description
    };

    const checkpoints = this.loadRecoveryCheckpoints();
    checkpoints.unshift(checkpoint);
    
    if (checkpoints.length > MAX_RECOVERY_CHECKPOINTS) {
      checkpoints.length = MAX_RECOVERY_CHECKPOINTS;
    }

    this.saveRecoveryCheckpoints(checkpoints);
    return checkpoint;
  }

  public static getRecoveryCheckpoints(): RecoveryCheckpoint[] {
    return this.loadRecoveryCheckpoints();
  }

  public static restoreFromCheckpoint(checkpointId: string): boolean {
    const checkpoints = this.loadRecoveryCheckpoints();
    const checkpoint = checkpoints.find(c => c.id === checkpointId);
    
    if (!checkpoint || !this.localCache) {
      return false;
    }

    this.createRecoveryCheckpoint('Pre-restore backup');

    this.localCache.saveData = JSON.parse(JSON.stringify(checkpoint.saveData));
    this.incrementVersion();
    this.saveLocalCache();

    this.syncToScoreStorage();

    return true;
  }

  private static getMigrationCodesCloud(): Record<string, any> {
    try {
      const data = localStorage.getItem(MIGRATION_CODES_CLOUD_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Failed to load migration codes:', e);
      return {};
    }
  }

  private static saveMigrationCodesCloud(codes: Record<string, any>): void {
    try {
      localStorage.setItem(MIGRATION_CODES_CLOUD_KEY, JSON.stringify(codes));
    } catch (e) {
      console.error('Failed to save migration codes:', e);
    }
  }

  public static generateMigrationCode(): string {
    const account = AccountSystem.getCurrentAccount();
    if (!account) {
      throw new Error('Not logged in');
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const migrationData = {
      code,
      accountId: account.accountId,
      createdAt: Date.now(),
      expiresAt: Date.now() + MIGRATION_CODE_EXPIRY_HOURS * 60 * 60 * 1000,
      used: false
    };

    const codes = this.getMigrationCodesCloud();
    codes[code] = migrationData;
    this.saveMigrationCodesCloud(codes);

    return code;
  }

  public static async migrateFromCode(code: string): Promise<boolean> {
    try {
      const codes = this.getMigrationCodesCloud();
      const migrationData = codes[code];
      
      if (!migrationData) {
        throw new Error('Invalid or expired migration code');
      }

      if (migrationData.used || Date.now() > migrationData.expiresAt) {
        throw new Error('Migration code expired or already used');
      }

      this.createRecoveryCheckpoint('Pre-migration backup');

      const sourceCloudKey = 'cloud_save_' + migrationData.accountId;
      const sourceSave = localStorage.getItem(sourceCloudKey);
      
      if (sourceSave && this.localCache) {
        const sourceData: CloudSaveData = JSON.parse(sourceSave);
        
        const { merged } = this.mergeSaves(
          this.localCache.saveData,
          sourceData,
          'merge'
        );
        
        this.localCache.saveData = merged;
        this.incrementVersion();
        this.saveLocalCache();

        this.syncToScoreStorage();

        migrationData.used = true;
        codes[code] = migrationData;
        this.saveMigrationCodesCloud(codes);

        await this.pushCloudSave(merged);
      }

      return true;
    } catch (e) {
      console.error('Migration failed:', e);
      return false;
    }
  }

  public static setAutoSyncEnabled(enabled: boolean): void {
    this.autoSyncEnabled = enabled;
  }

  public static isAutoSyncEnabled(): boolean {
    return this.autoSyncEnabled;
  }

  public static hasPendingChanges(): boolean {
    return (this.localCache?.pendingChanges.length || 0) > 0;
  }

  public static getPendingChanges(): string[] {
    return this.localCache?.pendingChanges || [];
  }

  public static forceSync(): Promise<SyncResult> {
    return this.syncWithCloud('merge');
  }

  public static clearLocalCache(): void {
    if (this.currentAccountId) {
      const cacheKey = this.getAccountCacheKey(this.currentAccountId);
      localStorage.removeItem(cacheKey);
      const checkpointsKey = this.getAccountCheckpointsKey(this.currentAccountId);
      localStorage.removeItem(checkpointsKey);
    }
    this.localCache = null;
    this.loadLocalCache();
  }
}
