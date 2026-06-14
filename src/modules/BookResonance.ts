import {
  JudgeResult,
  ResonanceState,
  ResonanceLevel,
  RESONANCE_THRESHOLDS,
  RESONANCE_SCORE_MULTIPLIERS,
  RESONANCE_EFFECT_INTENSITY,
  HIGH_JUDGMENT_TYPES,
  RESONANCE_DECAY_RATE,
  RESONANCE_MISS_PENALTY
} from '../types';

export class BookResonance {
  private state: ResonanceState;
  private listeners: Set<(state: ResonanceState) => void> = new Set();

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): ResonanceState {
    return {
      level: 0,
      progress: 0,
      scoreMultiplier: 1.0,
      effectIntensity: 0,
      consecutiveHighJudgments: 0,
      isActive: false
    };
  }

  public onJudgeResult(result: JudgeResult): void {
    if (HIGH_JUDGMENT_TYPES.includes(result)) {
      this.state.consecutiveHighJudgments++;
      this.updateLevelFromConsecutive();
    } else if (result === 'good') {
      this.state.consecutiveHighJudgments = Math.max(0, this.state.consecutiveHighJudgments - 2);
      this.applyProgressDecay(0.05);
    } else if (result === 'miss') {
      this.state.consecutiveHighJudgments = 0;
      this.applyMissPenalty();
    }

    this.updateDerivedValues();
    this.notifyListeners();
  }

  private updateLevelFromConsecutive(): void {
    const consecutive = this.state.consecutiveHighJudgments;
    let newLevel: ResonanceLevel = 0;

    if (consecutive >= RESONANCE_THRESHOLDS.level5) {
      newLevel = 5;
    } else if (consecutive >= RESONANCE_THRESHOLDS.level4) {
      newLevel = 4;
    } else if (consecutive >= RESONANCE_THRESHOLDS.level3) {
      newLevel = 3;
    } else if (consecutive >= RESONANCE_THRESHOLDS.level2) {
      newLevel = 2;
    } else if (consecutive >= RESONANCE_THRESHOLDS.level1) {
      newLevel = 1;
    }

    if (newLevel > this.state.level) {
      this.state.level = newLevel;
      this.state.progress = 1.0;
    } else if (newLevel === this.state.level && this.state.level > 0) {
      this.state.progress = Math.min(1.0, this.state.progress + this.getProgressIncrement());
    }
  }

  private getProgressIncrement(): number {
    return 0.08;
  }

  private applyProgressDecay(amount: number): void {
    this.state.progress = Math.max(0, this.state.progress - amount);
    if (this.state.progress <= 0 && this.state.level > 0) {
      this.downgradeLevel();
    }
  }

  private applyMissPenalty(): void {
    this.state.progress -= RESONANCE_MISS_PENALTY;
    
    if (this.state.progress < 0) {
      const overflow = -this.state.progress;
      if (this.state.level > 0) {
        this.state.level = Math.max(0, this.state.level - 1) as ResonanceLevel;
        this.state.progress = 1.0 - overflow;
        if (this.state.progress < 0) {
          this.state.progress = 0;
        }
      } else {
        this.state.progress = 0;
      }
    }
  }

  private downgradeLevel(): void {
    if (this.state.level > 0) {
      this.state.level = Math.max(0, this.state.level - 1) as ResonanceLevel;
      this.state.progress = 1.0;
    }
  }

  private updateDerivedValues(): void {
    this.state.scoreMultiplier = RESONANCE_SCORE_MULTIPLIERS[this.state.level];
    this.state.effectIntensity = RESONANCE_EFFECT_INTENSITY[this.state.level];
    this.state.isActive = this.state.level > 0;
  }

  public update(deltaTime: number): void {
    if (this.state.level > 0 && this.state.progress > 0) {
      const decay = RESONANCE_DECAY_RATE * deltaTime;
      this.state.progress = Math.max(0, this.state.progress - decay);
      
      if (this.state.progress <= 0) {
        if (this.state.level > 0) {
          this.downgradeLevel();
        }
        this.updateDerivedValues();
        this.notifyListeners();
      }
    }
  }

  public getState(): ResonanceState {
    return { ...this.state };
  }

  public getScoreMultiplier(): number {
    return this.state.scoreMultiplier;
  }

  public getEffectIntensity(): number {
    return this.state.effectIntensity;
  }

  public getLevel(): ResonanceLevel {
    return this.state.level;
  }

  public addChangeListener(listener: (state: ResonanceState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  public reset(): void {
    this.state = this.createInitialState();
    this.notifyListeners();
  }
}
