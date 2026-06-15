import {
  GameConfig,
  SongOnlineConfig,
  ActivityConfig,
  RewardConfig,
  AnnouncementConfig,
  GAME_CONFIG_STORAGE_KEY,
  GAME_CONFIG_VERSION_KEY,
  DEFAULT_GAME_CONFIG,
  Difficulty
} from '../types';

export type ConfigChangeListener = (config: GameConfig) => void;

export class ConfigSystem {
  private static instance: ConfigSystem;
  private currentConfig: GameConfig;
  private localConfig: GameConfig;
  private changeListeners: ConfigChangeListener[] = [];
  private isInitialized: boolean = false;
  private lastFetchTime: number = 0;
  private fetchInterval: number = 5 * 60 * 1000;

  private constructor() {
    this.currentConfig = { ...DEFAULT_GAME_CONFIG };
    this.localConfig = { ...DEFAULT_GAME_CONFIG };
  }

  public static getInstance(): ConfigSystem {
    if (!ConfigSystem.instance) {
      ConfigSystem.instance = new ConfigSystem();
    }
    return ConfigSystem.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.loadLocalConfig();
    await this.fetchConfig();
    this.isInitialized = true;
  }

  private loadLocalConfig(): void {
    try {
      const stored = localStorage.getItem(GAME_CONFIG_STORAGE_KEY);
      if (stored) {
        this.localConfig = JSON.parse(stored);
        this.currentConfig = { ...this.localConfig };
      }
    } catch (err) {
      console.warn('加载本地配置失败，使用默认配置:', err);
      this.localConfig = { ...DEFAULT_GAME_CONFIG };
      this.currentConfig = { ...DEFAULT_GAME_CONFIG };
    }
  }

  private saveLocalConfig(): void {
    try {
      localStorage.setItem(GAME_CONFIG_STORAGE_KEY, JSON.stringify(this.localConfig));
      localStorage.setItem(GAME_CONFIG_VERSION_KEY, String(this.localConfig.version));
    } catch (err) {
      console.error('保存本地配置失败:', err);
    }
  }

  public async fetchConfig(force: boolean = false): Promise<{ success: boolean; updated: boolean; message?: string }> {
    const now = Date.now();
    
    if (!force && (now - this.lastFetchTime) < this.fetchInterval) {
      return { success: true, updated: false };
    }

    try {
      const clientVersion = this.getClientVersion();
      const response = await this.fetchConfigFromServer(clientVersion);
      
      if (response.success && response.config) {
        const updated = response.config.version > this.currentConfig.version;
        
        if (updated || force) {
          this.currentConfig = response.config;
          this.localConfig = response.config;
          this.saveLocalConfig();
          this.notifyListeners();
        }
        
        this.lastFetchTime = now;
        return { success: true, updated, message: response.message };
      }
      
      return { success: false, updated: false, message: response.message || '获取配置失败' };
    } catch (err) {
      console.warn('从服务器获取配置失败，使用本地缓存:', err);
      return { success: true, updated: false, message: '使用本地缓存配置' };
    }
  }

  private async fetchConfigFromServer(clientVersion: string): Promise<{
    success: boolean;
    config?: GameConfig;
    message?: string;
  }> {
    try {
      const url = this.getConfigApiUrl(clientVersion);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': clientVersion
        },
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return { success: true, config: data.data };
        }
        return { success: false, message: data.message || '配置数据格式错误' };
      }
      
      return { success: false, message: `服务器响应错误: ${response.status}` };
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        return { success: false, message: '获取配置超时' };
      }
      throw err;
    }
  }

  private getConfigApiUrl(clientVersion: string): string {
    const baseUrl = '/api/config';
    return `${baseUrl}?version=${encodeURIComponent(clientVersion)}&t=${Date.now()}`;
  }

  private getClientVersion(): string {
    return '1.0.0';
  }

  public getConfig(): GameConfig {
    return { ...this.currentConfig };
  }

  public getConfigVersion(): number {
    return this.currentConfig.version;
  }

  public isMaintenanceMode(): boolean {
    return this.currentConfig.globalSettings.maintenanceMode;
  }

  public getMaintenanceMessage(): string | undefined {
    return this.currentConfig.globalSettings.maintenanceMessage;
  }

  public isSongOnline(songId: string): boolean {
    const now = Date.now();
    const songConfig = this.currentConfig.songs.find(s => s.songId === songId);
    
    if (!songConfig) return true;
    if (!songConfig.isOnline) return false;
    
    if (songConfig.onlineTime && now < songConfig.onlineTime) return false;
    if (songConfig.offlineTime && now > songConfig.offlineTime) return false;
    
    return true;
  }

  public getOnlineSongs(): string[] {
    const now = Date.now();
    return this.currentConfig.songs
      .filter(s => {
        if (!s.isOnline) return false;
        if (s.onlineTime && now < s.onlineTime) return false;
        if (s.offlineTime && now > s.offlineTime) return false;
        return true;
      })
      .sort((a, b) => b.sortPriority - a.sortPriority)
      .map(s => s.songId);
  }

  public getSongConfig(songId: string): SongOnlineConfig | undefined {
    return this.currentConfig.songs.find(s => s.songId === songId);
  }

  public getActiveActivities(): ActivityConfig[] {
    const now = Date.now();
    return this.currentConfig.activities
      .filter(a => {
        if (!a.isEnabled) return false;
        if (now < a.startTime) return false;
        if (now > a.endTime) return false;
        return true;
      })
      .sort((a, b) => b.startTime - a.startTime);
  }

  public getActivityById(activityId: string): ActivityConfig | undefined {
    return this.currentConfig.activities.find(a => a.id === activityId);
  }

  public isActivityActive(activityId: string): boolean {
    const activity = this.getActivityById(activityId);
    if (!activity) return false;
    
    const now = Date.now();
    return activity.isEnabled && now >= activity.startTime && now <= activity.endTime;
  }

  public getActiveRewards(): RewardConfig[] {
    return this.currentConfig.rewards
      .filter(r => r.isEnabled)
      .sort((a, b) => b.value - a.value);
  }

  public getRewardById(rewardId: string): RewardConfig | undefined {
    return this.currentConfig.rewards.find(r => r.id === rewardId);
  }

  public checkRewardConditions(
    rewardId: string,
    context: {
      songId?: string;
      difficulty?: Difficulty;
      rating?: string;
      accuracy?: number;
      combo?: number;
      perfectCount?: number;
      playCount?: number;
      isFirstClear?: boolean;
    }
  ): boolean {
    const reward = this.getRewardById(rewardId);
    if (!reward || !reward.isEnabled) return false;

    return reward.conditions.every(condition => {
      switch (condition.type) {
        case 'play_count':
          return (context.playCount || 0) >= condition.targetValue;
        case 'perfect_count':
          return (context.perfectCount || 0) >= condition.targetValue;
        case 'combo':
          return (context.combo || 0) >= condition.targetValue;
        case 'rating':
          if (!context.rating || !condition.minRating) return false;
          return this.compareRatings(context.rating, condition.minRating) >= 0;
        case 'accuracy':
          return (context.accuracy || 0) >= (condition.minAccuracy || condition.targetValue);
        case 'first_clear':
          return context.isFirstClear === true;
        default:
          return false;
      }
    });
  }

  private compareRatings(rating1: string, rating2: string): number {
    const order = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
    const index1 = order.indexOf(rating1);
    const index2 = order.indexOf(rating2);
    return index1 - index2;
  }

  public getActiveAnnouncements(showOnStartOnly: boolean = false): AnnouncementConfig[] {
    const now = Date.now();
    return this.currentConfig.announcements
      .filter(a => {
        if (!a.isEnabled) return false;
        if (showOnStartOnly && !a.showOnStart) return false;
        if (now < a.startTime) return false;
        if (now > a.endTime) return false;
        return true;
      })
      .sort((a, b) => b.priority - a.priority || b.startTime - a.startTime);
  }

  public getAnnouncementById(announcementId: string): AnnouncementConfig | undefined {
    return this.currentConfig.announcements.find(a => a.id === announcementId);
  }

  public async updateSongConfig(songId: string, updates: Partial<SongOnlineConfig>): Promise<boolean> {
    try {
      const response = await fetch('/api/config/songs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId, ...updates })
      });

      if (response.ok) {
        await this.fetchConfig(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新曲目配置失败:', err);
      return false;
    }
  }

  public async updateActivityConfig(activityId: string, updates: Partial<ActivityConfig>): Promise<boolean> {
    try {
      const response = await fetch('/api/config/activities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, ...updates })
      });

      if (response.ok) {
        await this.fetchConfig(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新活动配置失败:', err);
      return false;
    }
  }

  public async updateRewardConfig(rewardId: string, updates: Partial<RewardConfig>): Promise<boolean> {
    try {
      const response = await fetch('/api/config/rewards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId, ...updates })
      });

      if (response.ok) {
        await this.fetchConfig(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新奖励配置失败:', err);
      return false;
    }
  }

  public async updateAnnouncementConfig(announcementId: string, updates: Partial<AnnouncementConfig>): Promise<boolean> {
    try {
      const response = await fetch('/api/config/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId, ...updates })
      });

      if (response.ok) {
        await this.fetchConfig(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新公告配置失败:', err);
      return false;
    }
  }

  public setConfigForTesting(config: GameConfig): void {
    this.currentConfig = config;
    this.localConfig = config;
    this.saveLocalConfig();
    this.notifyListeners();
  }

  public addChangeListener(listener: ConfigChangeListener): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    const configCopy = { ...this.currentConfig };
    this.changeListeners.forEach(listener => {
      try {
        listener(configCopy);
      } catch (err) {
        console.error('配置变更监听器执行失败:', err);
      }
    });
  }

  public resetToDefault(): void {
    this.currentConfig = { ...DEFAULT_GAME_CONFIG };
    this.localConfig = { ...DEFAULT_GAME_CONFIG };
    localStorage.removeItem(GAME_CONFIG_STORAGE_KEY);
    localStorage.removeItem(GAME_CONFIG_VERSION_KEY);
    this.notifyListeners();
  }

  public getFetchInterval(): number {
    return this.fetchInterval;
  }

  public setFetchInterval(interval: number): void {
    this.fetchInterval = Math.max(60000, interval);
  }
}
