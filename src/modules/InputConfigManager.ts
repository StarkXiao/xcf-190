import {
  InputConfig,
  DEFAULT_INPUT_CONFIG,
  DEFAULT_KEY_MAP,
  DEFAULT_GESTURES,
  RESERVED_KEYS,
  ValidationResult,
  LANE_COUNT,
  GestureConfig
} from '../types';

type ConfigChangeListener = (config: InputConfig) => void;

const STORAGE_KEY = 'floating-island-bookstore-input-config';

export class InputConfigManager {
  private static instance: InputConfigManager;
  private config: InputConfig;
  private listeners: Set<ConfigChangeListener> = new Set();

  private constructor() {
    this.config = this.loadFromStorage();
  }

  public static getInstance(): InputConfigManager {
    if (!InputConfigManager.instance) {
      InputConfigManager.instance = new InputConfigManager();
    }
    return InputConfigManager.instance;
  }

  private loadFromStorage(): InputConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return this.mergeWithDefaults(parsed);
      }
    } catch (e) {
      console.warn('Failed to load input config from storage, using defaults:', e);
    }
    return { ...DEFAULT_INPUT_CONFIG };
  }

  private mergeWithDefaults(stored: Partial<InputConfig>): InputConfig {
    return {
      keyMap: stored.keyMap ? { ...stored.keyMap } : { ...DEFAULT_KEY_MAP },
      gestures: stored.gestures ? [...stored.gestures] : [...DEFAULT_GESTURES],
      swipeThreshold: stored.swipeThreshold ?? DEFAULT_INPUT_CONFIG.swipeThreshold,
      holdThreshold: stored.holdThreshold ?? DEFAULT_INPUT_CONFIG.holdThreshold
    };
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save input config to storage:', e);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (e) {
        console.error('Error in config change listener:', e);
      }
    });
  }

  public addChangeListener(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.config);
    return () => this.listeners.delete(listener);
  }

  public removeChangeListener(listener: ConfigChangeListener): void {
    this.listeners.delete(listener);
  }

  public getConfig(): InputConfig {
    return {
      keyMap: { ...this.config.keyMap },
      gestures: [...this.config.gestures],
      swipeThreshold: this.config.swipeThreshold,
      holdThreshold: this.config.holdThreshold
    };
  }

  public getKeyMap(): Record<string, number> {
    return { ...this.config.keyMap };
  }

  public getGestures(): GestureConfig[] {
    return [...this.config.gestures];
  }

  public getSwipeThreshold(): number {
    return this.config.swipeThreshold;
  }

  public getHoldThreshold(): number {
    return this.config.holdThreshold;
  }

  public getKeysForLane(lane: number): string[] {
    const keys: string[] = [];
    for (const [key, l] of Object.entries(this.config.keyMap)) {
      if (l === lane && key.length === 1) {
        keys.push(key.toUpperCase());
      }
    }
    return [...new Set(keys)];
  }

  public getKeyDisplayForLane(lane: number): string {
    const keys = this.getKeysForLane(lane);
    return keys.length > 0 ? keys[0] : '?';
  }

  public validateKeyMap(keyMap: Record<string, number>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenKeys = new Set<string>();

    for (const [rawKey, lane] of Object.entries(keyMap)) {
      const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;

      if (RESERVED_KEYS.has(key) || RESERVED_KEYS.has(rawKey)) {
        errors.push(`按键 "${rawKey}" 是保留键，不能使用`);
        continue;
      }

      if (lane < 0 || lane >= LANE_COUNT) {
        errors.push(`按键 "${rawKey}" 映射到无效轨道 ${lane}`);
        continue;
      }

      const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
      if (seenKeys.has(normalizedKey)) {
        errors.push(`按键 "${rawKey}" 重复映射`);
      }
      seenKeys.add(normalizedKey);

      if (rawKey.length > 1 && !['Shift', 'Control', 'Alt', 'Meta'].includes(rawKey)) {
        warnings.push(`按键 "${rawKey}" 建议使用单字符键`);
      }
    }

    for (let i = 0; i < LANE_COUNT; i++) {
      const hasKey = Object.entries(keyMap).some(([_, l]) => l === i);
      if (!hasKey) {
        warnings.push(`轨道 ${i + 1} 没有绑定任何按键`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  public setKeyMap(newKeyMap: Record<string, number>): ValidationResult {
    const validation = this.validateKeyMap(newKeyMap);
    if (!validation.valid) {
      return validation;
    }

    const normalizedMap: Record<string, number> = {};
    for (const [key, lane] of Object.entries(newKeyMap)) {
      normalizedMap[key] = lane;
      if (key.length === 1) {
        normalizedMap[key.toLowerCase()] = lane;
        normalizedMap[key.toUpperCase()] = lane;
      }
    }

    this.config.keyMap = normalizedMap;
    this.saveToStorage();
    this.notifyListeners();
    return validation;
  }

  public setKeyForLane(key: string, lane: number): ValidationResult {
    const newKeyMap = { ...this.config.keyMap };

    const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
    for (const k of Object.keys(newKeyMap)) {
      if (k.toLowerCase() === normalizedKey) {
        delete newKeyMap[k];
      }
    }

    for (const [k, l] of Object.entries(newKeyMap)) {
      if (l === lane && k.length === 1) {
        delete newKeyMap[k];
        delete newKeyMap[k.toLowerCase()];
        delete newKeyMap[k.toUpperCase()];
      }
    }

    newKeyMap[key] = lane;
    if (key.length === 1) {
      newKeyMap[key.toLowerCase()] = lane;
      newKeyMap[key.toUpperCase()] = lane;
    }

    return this.setKeyMap(newKeyMap);
  }

  public setGestures(gestures: GestureConfig[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    gestures.forEach((gesture, index) => {
      if (!['tap', 'swipe', 'hold'].includes(gesture.gesture)) {
        errors.push(`手势配置 ${index + 1}: 无效的手势类型 "${gesture.gesture}"`);
      }
      if (gesture.gesture === 'swipe' && !gesture.direction) {
        errors.push(`手势配置 ${index + 1}: 滑动手势需要指定方向`);
      }
      if (gesture.lane < -1 || gesture.lane >= LANE_COUNT) {
        errors.push(`手势配置 ${index + 1}: 无效的轨道 ${gesture.lane}`);
      }
    });

    const valid = errors.length === 0;
    if (valid) {
      this.config.gestures = [...gestures];
      this.saveToStorage();
      this.notifyListeners();
    }

    return { valid, errors, warnings };
  }

  public setSwipeThreshold(threshold: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (threshold < 10) {
      errors.push('滑动阈值不能小于 10 像素');
    } else if (threshold > 200) {
      warnings.push('滑动阈值过大，可能导致手势难以触发');
    }

    if (errors.length === 0) {
      this.config.swipeThreshold = threshold;
      this.saveToStorage();
      this.notifyListeners();
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  public setHoldThreshold(threshold: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (threshold < 50) {
      errors.push('长按阈值不能小于 50 毫秒');
    } else if (threshold > 1000) {
      warnings.push('长按阈值过大，可能导致长按难以触发');
    }

    if (errors.length === 0) {
      this.config.holdThreshold = threshold;
      this.saveToStorage();
      this.notifyListeners();
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  public resetToDefaults(): void {
    this.config = {
      keyMap: { ...DEFAULT_KEY_MAP },
      gestures: [...DEFAULT_GESTURES],
      swipeThreshold: DEFAULT_INPUT_CONFIG.swipeThreshold,
      holdThreshold: DEFAULT_INPUT_CONFIG.holdThreshold
    };
    this.saveToStorage();
    this.notifyListeners();
  }

  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  public importConfig(jsonString: string): ValidationResult {
    try {
      const parsed = JSON.parse(jsonString);
      const merged = this.mergeWithDefaults(parsed);

      const keyValidation = this.validateKeyMap(merged.keyMap);
      if (!keyValidation.valid) {
        return keyValidation;
      }

      this.config = merged;
      this.saveToStorage();
      this.notifyListeners();

      return { valid: true, errors: [], warnings: [] };
    } catch (e) {
      return {
        valid: false,
        errors: ['配置格式无效，请检查 JSON 格式'],
        warnings: []
      };
    }
  }
}
