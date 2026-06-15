import {
  CalibrationTestStatus,
  CalibrationSample,
  CalibrationResult,
  CalibrationData,
  BeatVisualSample,
  CALIBRATION_STORAGE_KEY,
  DEFAULT_CALIBRATION_DATA,
  CALIBRATION_TAP_COUNT,
  CALIBRATION_BEAT_INTERVAL,
  CALIBRATION_MAX_OFFSET_MS,
  CALIBRATION_CONFIDENCE_THRESHOLD
} from '../types';

type CalibrationChangeListener = (data: CalibrationData) => void;

export class AudioBeatCalibrator {
  private static instance: AudioBeatCalibrator;

  private data: CalibrationData;
  private listeners: Set<CalibrationChangeListener> = new Set();

  private audioContext: AudioContext | null = null;
  private testStatus: CalibrationTestStatus = 'idle';
  private samples: CalibrationSample[] = [];
  private currentBeatIndex: number = 0;
  private beatScheduleStart: number = 0;
  private nextBeatTime: number = 0;
  private beatTimeoutIds: number[] = [];
  private verificationSamples: BeatVisualSample[] = [];

  private constructor() {
    this.data = this.loadFromStorage();
  }

  public static getInstance(): AudioBeatCalibrator {
    if (!AudioBeatCalibrator.instance) {
      AudioBeatCalibrator.instance = new AudioBeatCalibrator();
    }
    return AudioBeatCalibrator.instance;
  }

  private loadFromStorage(): CalibrationData {
    try {
      const stored = localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          globalOffset: parsed.globalOffset ?? DEFAULT_CALIBRATION_DATA.globalOffset,
          deviceLatency: parsed.deviceLatency ?? DEFAULT_CALIBRATION_DATA.deviceLatency,
          songOffsets: Array.isArray(parsed.songOffsets) ? parsed.songOffsets : [],
          lastCalibratedAt: parsed.lastCalibratedAt ?? DEFAULT_CALIBRATION_DATA.lastCalibratedAt,
          calibrationResult: parsed.calibrationResult ?? null
        };
      }
    } catch (e) {
      console.warn('Failed to load calibration data:', e);
    }
    return { ...DEFAULT_CALIBRATION_DATA };
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save calibration data:', e);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.data);
      } catch (e) {
        console.error('Error in calibration change listener:', e);
      }
    });
  }

  public addChangeListener(listener: CalibrationChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.data);
    return () => this.listeners.delete(listener);
  }

  public getData(): CalibrationData {
    return { ...this.data, songOffsets: [...this.data.songOffsets] };
  }

  public getGlobalOffset(): number {
    return this.data.globalOffset;
  }

  public getDeviceLatency(): number {
    return this.data.deviceLatency;
  }

  public getEffectiveOffset(songId?: string): number {
    const songEntry = songId
      ? this.data.songOffsets.find(e => e.songId === songId)
      : undefined;
    const songOffset = songEntry ? songEntry.offset : 0;
    return this.data.globalOffset + this.data.deviceLatency + songOffset;
  }

  public getTestStatus(): CalibrationTestStatus {
    return this.testStatus;
  }

  public getSamples(): CalibrationSample[] {
    return [...this.samples];
  }

  public getCurrentBeatIndex(): number {
    return this.currentBeatIndex;
  }

  public getVerificationSamples(): BeatVisualSample[] {
    return [...this.verificationSamples];
  }

  private ensureAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  private playClick(audioCtx: AudioContext, time: number): void {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, time);
    oscillator.frequency.exponentialRampToValueAtTime(440, time + 0.05);

    gainNode.gain.setValueAtTime(0.5, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    oscillator.start(time);
    oscillator.stop(time + 0.1);
  }

  public startLatencyTest(): void {
    if (this.testStatus !== 'idle') return;

    this.samples = [];
    this.currentBeatIndex = 0;
    this.testStatus = 'playing';

    const audioCtx = this.ensureAudioContext();
    this.beatScheduleStart = audioCtx.currentTime * 1000;
    this.nextBeatTime = audioCtx.currentTime;

    this.scheduleBeats(audioCtx);
  }

  private scheduleBeats(audioCtx: AudioContext): void {
    const totalBeats = CALIBRATION_TAP_COUNT;
    const intervalSec = CALIBRATION_BEAT_INTERVAL / 1000;
    const scheduleAhead = 2;

    let scheduledCount = this.currentBeatIndex;
    const scheduleEnd = Math.min(scheduledCount + scheduleAhead, totalBeats);

    while (scheduledCount < scheduleEnd) {
      const beatTime = this.nextBeatTime + (scheduledCount - this.currentBeatIndex) * intervalSec;
      this.playClick(audioCtx, beatTime);
      scheduledCount++;
    }

    this.beatTimeoutIds.push(window.setTimeout(() => {
      this.currentBeatIndex++;
      if (this.currentBeatIndex >= totalBeats) {
        this.finalizeCalibration();
      } else {
        this.nextBeatTime += intervalSec;
        this.scheduleBeats(audioCtx);
      }
    }, CALIBRATION_BEAT_INTERVAL));
  }

  public recordTap(): void {
    if (this.testStatus !== 'playing' && this.testStatus !== 'waiting') return;

    const now = performance.now();
    const audioCtx = this.audioContext;
    if (!audioCtx) return;

    const audioTimeMs = audioCtx.currentTime * 1000;
    const currentBeatTimeMs = this.beatScheduleStart + this.currentBeatIndex * CALIBRATION_BEAT_INTERVAL;
    const offset = now - currentBeatTimeMs;

    if (Math.abs(offset) > CALIBRATION_MAX_OFFSET_MS) return;

    this.samples.push({
      audioTime: audioTimeMs,
      tapTime: now,
      offset
    });
  }

  private finalizeCalibration(): void {
    this.clearBeatTimeouts();
    this.testStatus = 'done';

    if (this.samples.length < 3) {
      this.data.calibrationResult = null;
      this.saveToStorage();
      this.notifyListeners();
      return;
    }

    const result = this.computeCalibrationResult(this.samples);
    this.data.calibrationResult = result;
    this.data.deviceLatency = Math.round(result.medianOffset);
    this.data.globalOffset = Math.round(result.medianOffset);
    this.data.lastCalibratedAt = Date.now();
    this.saveToStorage();
    this.notifyListeners();
  }

  private computeCalibrationResult(samples: CalibrationSample[]): CalibrationResult {
    const offsets = samples.map(s => s.offset).sort((a, b) => a - b);
    const n = offsets.length;

    const sum = offsets.reduce((acc, v) => acc + v, 0);
    const averageOffset = sum / n;

    const medianOffset = n % 2 === 0
      ? (offsets[n / 2 - 1] + offsets[n / 2]) / 2
      : offsets[Math.floor(n / 2)];

    const variance = offsets.reduce((acc, v) => acc + Math.pow(v - averageOffset, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    const maxAcceptableSD = 50;
    const confidence = Math.max(0, 1 - standardDeviation / maxAcceptableSD);

    return {
      averageOffset: Math.round(averageOffset * 10) / 10,
      medianOffset: Math.round(medianOffset * 10) / 10,
      sampleCount: n,
      standardDeviation: Math.round(standardDeviation * 10) / 10,
      confidence: Math.round(confidence * 100) / 100,
      samples: [...samples]
    };
  }

  public cancelTest(): void {
    this.clearBeatTimeouts();
    this.testStatus = 'idle';
    this.samples = [];
    this.currentBeatIndex = 0;
  }

  private clearBeatTimeouts(): void {
    this.beatTimeoutIds.forEach(id => clearTimeout(id));
    this.beatTimeoutIds = [];
  }

  public setGlobalOffset(offset: number): void {
    const clamped = Math.max(-CALIBRATION_MAX_OFFSET_MS, Math.min(CALIBRATION_MAX_OFFSET_MS, offset));
    this.data.globalOffset = Math.round(clamped);
    this.saveToStorage();
    this.notifyListeners();
  }

  public setDeviceLatency(latency: number): void {
    const clamped = Math.max(0, Math.min(CALIBRATION_MAX_OFFSET_MS, latency));
    this.data.deviceLatency = Math.round(clamped);
    this.saveToStorage();
    this.notifyListeners();
  }

  public setSongOffset(songId: string, offset: number): void {
    const clamped = Math.max(-CALIBRATION_MAX_OFFSET_MS, Math.min(CALIBRATION_MAX_OFFSET_MS, offset));
    const existingIndex = this.data.songOffsets.findIndex(e => e.songId === songId);

    if (existingIndex >= 0) {
      this.data.songOffsets[existingIndex].offset = Math.round(clamped);
      this.data.songOffsets[existingIndex].updatedAt = Date.now();
    } else {
      this.data.songOffsets.push({
        songId,
        offset: Math.round(clamped),
        updatedAt: Date.now()
      });
    }

    this.saveToStorage();
    this.notifyListeners();
  }

  public removeSongOffset(songId: string): void {
    this.data.songOffsets = this.data.songOffsets.filter(e => e.songId !== songId);
    this.saveToStorage();
    this.notifyListeners();
  }

  public getSongOffset(songId: string): number {
    const entry = this.data.songOffsets.find(e => e.songId === songId);
    return entry ? entry.offset : 0;
  }

  public startVisualVerification(bpm: number, durationMs: number = 10000): void {
    this.verificationSamples = [];
    this.testStatus = 'waiting';

    const audioCtx = this.ensureAudioContext();
    const beatInterval = 60000 / bpm;
    const totalBeats = Math.floor(durationMs / beatInterval);
    const startTime = audioCtx.currentTime * 1000;

    for (let i = 0; i < totalBeats; i++) {
      const beatTimeSec = startTime / 1000 + i * beatInterval / 1000;
      this.playClick(audioCtx, beatTimeSec);
    }

    this.beatTimeoutIds.push(window.setTimeout(() => {
      this.testStatus = 'done';
      this.notifyListeners();
    }, durationMs));
  }

  public recordVerificationTap(): BeatVisualSample | null {
    if (this.testStatus !== 'waiting') return null;

    const audioCtx = this.audioContext;
    if (!audioCtx) return null;

    const now = performance.now();
    const audioTimeMs = audioCtx.currentTime * 1000;

    const sample: BeatVisualSample = {
      expectedTime: audioTimeMs,
      actualTime: now,
      offset: now - audioTimeMs
    };

    this.verificationSamples.push(sample);
    return sample;
  }

  public getVerificationStats(): { averageOffset: number; hitCount: number; isGood: boolean } | null {
    if (this.verificationSamples.length === 0) return null;

    const avgOffset = this.verificationSamples.reduce((sum, s) => sum + s.offset, 0) / this.verificationSamples.length;
    const isGood = Math.abs(avgOffset) < 30;

    return {
      averageOffset: Math.round(avgOffset * 10) / 10,
      hitCount: this.verificationSamples.length,
      isGood
    };
  }

  public resetToDefaults(): void {
    this.data = { ...DEFAULT_CALIBRATION_DATA, songOffsets: [] };
    this.saveToStorage();
    this.notifyListeners();
  }

  public isCalibrated(): boolean {
    return this.data.lastCalibratedAt > 0 && this.data.calibrationResult !== null;
  }

  public isHighConfidence(): boolean {
    if (!this.data.calibrationResult) return false;
    return this.data.calibrationResult.confidence >= CALIBRATION_CONFIDENCE_THRESHOLD;
  }

  public getCalibrationQuality(): 'uncalibrated' | 'low' | 'medium' | 'high' {
    if (!this.isCalibrated()) return 'uncalibrated';

    const confidence = this.data.calibrationResult!.confidence;
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
  }

  public exportCalibrationData(): string {
    return JSON.stringify(this.data, null, 2);
  }

  public importCalibrationData(jsonString: string): { success: boolean; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);

      if (typeof parsed.globalOffset !== 'number' || typeof parsed.deviceLatency !== 'number') {
        return { success: false, error: '缺少必要字段 (globalOffset, deviceLatency)' };
      }

      if (!Array.isArray(parsed.songOffsets)) {
        return { success: false, error: 'songOffsets 必须是数组' };
      }

      for (const entry of parsed.songOffsets) {
        if (typeof entry.songId !== 'string' || typeof entry.offset !== 'number') {
          return { success: false, error: 'songOffsets 条目格式无效' };
        }
      }

      this.data = {
        globalOffset: Math.max(-CALIBRATION_MAX_OFFSET_MS, Math.min(CALIBRATION_MAX_OFFSET_MS, parsed.globalOffset)),
        deviceLatency: Math.max(0, Math.min(CALIBRATION_MAX_OFFSET_MS, parsed.deviceLatency)),
        songOffsets: parsed.songOffsets.map((e: any) => ({
          songId: String(e.songId),
          offset: Math.max(-CALIBRATION_MAX_OFFSET_MS, Math.min(CALIBRATION_MAX_OFFSET_MS, e.offset)),
          updatedAt: e.updatedAt ?? Date.now()
        })),
        lastCalibratedAt: parsed.lastCalibratedAt ?? Date.now(),
        calibrationResult: parsed.calibrationResult ?? null
      };

      this.saveToStorage();
      this.notifyListeners();
      return { success: true };
    } catch (e) {
      return { success: false, error: 'JSON 格式无效' };
    }
  }

  public destroy(): void {
    this.cancelTest();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.listeners.clear();
  }
}
