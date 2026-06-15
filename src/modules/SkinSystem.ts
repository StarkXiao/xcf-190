import {
  PlayerCosmeticState,
  SkinConfig,
  CosmeticItem,
  CosmeticType,
  CosmeticFilter,
  CosmeticFilterType,
  CosmeticSortType,
  Rarity,
  ThemeSkin,
  TrackEffect,
  PoemFrame,
  NoteSkin,
  ComboEffect,
  JudgeEffect,
  CurrencyAmount,
  CosmeticUnlockCondition,
  SKIN_STATE_STORAGE_KEY,
  DEFAULT_SKIN_STATE,
  RARITY_RANK,
  BestScore,
  Difficulty
} from '../types';
import {
  ALL_COSMETICS,
  getCosmeticById,
  DEFAULT_THEMES,
  DEFAULT_TRACK_EFFECTS,
  DEFAULT_POEM_FRAMES,
  DEFAULT_NOTE_SKINS,
  DEFAULT_COMBO_EFFECTS,
  DEFAULT_JUDGE_EFFECTS
} from '../data/cosmetics';

export type SkinChangeListener = (config: SkinConfig) => void;
export type UnlockChangeListener = (cosmeticId: string, unlocked: boolean) => void;
export type CurrencyChangeListener = (currency: CurrencyAmount) => void;

export class SkinSystem {
  private static instance: SkinSystem;
  private static state: PlayerCosmeticState = { ...DEFAULT_SKIN_STATE };
  private static skinChangeListeners: SkinChangeListener[] = [];
  private static unlockChangeListeners: UnlockChangeListener[] = [];
  private static currencyChangeListeners: CurrencyChangeListener[] = [];

  private constructor() {}

  public static getInstance(): SkinSystem {
    if (!SkinSystem.instance) {
      SkinSystem.instance = new SkinSystem();
      SkinSystem.loadState();
    }
    return SkinSystem.instance;
  }

  private static loadState(): void {
    try {
      const data = localStorage.getItem(SKIN_STATE_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        SkinSystem.state = {
          unlockedCosmetics: parsed.unlockedCosmetics || [...DEFAULT_SKIN_STATE.unlockedCosmetics],
          purchases: parsed.purchases || [],
          currentSkin: {
            ...DEFAULT_SKIN_STATE.currentSkin,
            ...parsed.currentSkin
          },
          currency: {
            ...DEFAULT_SKIN_STATE.currency,
            ...parsed.currency
          },
          purchaseHistory: parsed.purchaseHistory || []
        };
      } else {
        SkinSystem.state = { ...DEFAULT_SKIN_STATE };
        SkinSystem.saveState();
      }
    } catch (e) {
      console.error('Failed to load skin state:', e);
      SkinSystem.state = { ...DEFAULT_SKIN_STATE };
    }
  }

  private static saveState(): void {
    try {
      localStorage.setItem(SKIN_STATE_STORAGE_KEY, JSON.stringify(SkinSystem.state));
    } catch (e) {
      console.error('Failed to save skin state:', e);
    }
  }

  public static initialize(): void {
    SkinSystem.getInstance();
  }

  public static getCurrentSkinConfig(): SkinConfig {
    const theme = this.getThemeById(SkinSystem.state.currentSkin.theme);
    const trackEffect = this.getTrackEffectById(SkinSystem.state.currentSkin.trackEffect);
    const poemFrame = this.getPoemFrameById(SkinSystem.state.currentSkin.poemFrame);
    const noteSkin = this.getNoteSkinById(SkinSystem.state.currentSkin.noteSkin);
    const comboEffect = this.getComboEffectById(SkinSystem.state.currentSkin.comboEffect);
    const judgeEffect = this.getJudgeEffectById(SkinSystem.state.currentSkin.judgeEffect);

    return {
      theme: theme || DEFAULT_THEMES[0],
      trackEffect: trackEffect || DEFAULT_TRACK_EFFECTS[0],
      poemFrame: poemFrame || DEFAULT_POEM_FRAMES[0],
      noteSkin: noteSkin || DEFAULT_NOTE_SKINS[0],
      comboEffect: comboEffect || DEFAULT_COMBO_EFFECTS[0],
      judgeEffect: judgeEffect || DEFAULT_JUDGE_EFFECTS[0]
    };
  }

  public static setSkin(type: CosmeticType, cosmeticId: string): boolean {
    if (!this.isUnlocked(cosmeticId)) {
      return false;
    }

    const cosmetic = getCosmeticById(cosmeticId);
    if (!cosmetic || cosmetic.type !== type) {
      return false;
    }

    const skinTypeMap: Record<CosmeticType, keyof PlayerCosmeticState['currentSkin']> = {
      theme: 'theme',
      track_effect: 'trackEffect',
      poem_frame: 'poemFrame',
      note_skin: 'noteSkin',
      combo_effect: 'comboEffect',
      judge_effect: 'judgeEffect'
    };

    SkinSystem.state.currentSkin[skinTypeMap[type]] = cosmeticId;
    SkinSystem.saveState();
    SkinSystem.notifySkinChangeListeners();
    return true;
  }

  public static isUnlocked(cosmeticId: string): boolean {
    return SkinSystem.state.unlockedCosmetics.includes(cosmeticId);
  }

  public static unlockCosmetic(cosmeticId: string, price?: Partial<CurrencyAmount>): boolean {
    const cosmetic = getCosmeticById(cosmeticId);
    if (!cosmetic) {
      return false;
    }

    if (this.isUnlocked(cosmeticId)) {
      return false;
    }

    if (price && !this.canAfford(price)) {
      return false;
    }

    if (price) {
      this.deductCurrency(price);
    }

    SkinSystem.state.unlockedCosmetics.push(cosmeticId);
    
    if (price) {
      SkinSystem.state.purchases.push({
        cosmeticId,
        purchasedAt: Date.now(),
        price
      });
    }

    SkinSystem.saveState();
    SkinSystem.notifyUnlockChangeListeners(cosmeticId, true);
    return true;
  }

  public static checkUnlockCondition(
    condition: CosmeticUnlockCondition,
    context?: {
      bestScores?: Record<string, Record<Difficulty, BestScore | null>>;
      maxCombo?: number;
      collectedPoems?: number;
      completedChapters?: string[];
    }
  ): boolean {
    switch (condition.type) {
      case 'purchase':
        return condition.cost ? this.canAfford(condition.cost) : true;

      case 'rating':
        if (!condition.minRating || !context?.bestScores) return false;
        const minRank = RARITY_RANK[condition.minRating] || 0;
        return Object.values(context.bestScores).some(difficultyScores =>
          Object.values(difficultyScores).some(score =>
            score && RARITY_RANK[score.rating] >= minRank
          )
        );

      case 'accuracy':
        if (!condition.minAccuracy || !context?.bestScores) return false;
        return Object.values(context.bestScores).some(difficultyScores =>
          Object.values(difficultyScores).some(score =>
            score && score.accuracy >= condition.minAccuracy!
          )
        );

      case 'combo':
        if (!condition.minCombo || !context?.maxCombo) return false;
        return context.maxCombo >= condition.minCombo;

      case 'chapter_complete':
        if (!condition.chapterId || !context?.completedChapters) return false;
        return context.completedChapters.includes(condition.chapterId);

      case 'poem_collect':
        if (!condition.poemCount || !context?.collectedPoems) return false;
        return context.collectedPoems >= condition.poemCount;

      case 'season_reward':
        return false;

      default:
        return false;
    }
  }

  public static canAfford(cost: Partial<CurrencyAmount>): boolean {
    const { currency } = SkinSystem.state;
    return (
      (cost.coin === undefined || currency.coin >= cost.coin) &&
      (cost.jade === undefined || currency.jade >= cost.jade) &&
      (cost.star === undefined || currency.star >= cost.star)
    );
  }

  public static deductCurrency(cost: Partial<CurrencyAmount>): boolean {
    if (!this.canAfford(cost)) {
      return false;
    }

    if (cost.coin !== undefined) {
      SkinSystem.state.currency.coin -= cost.coin;
    }
    if (cost.jade !== undefined) {
      SkinSystem.state.currency.jade -= cost.jade;
    }
    if (cost.star !== undefined) {
      SkinSystem.state.currency.star -= cost.star;
    }

    SkinSystem.saveState();
    SkinSystem.notifyCurrencyChangeListeners();
    return true;
  }

  public static addCurrency(amount: Partial<CurrencyAmount>): void {
    if (amount.coin !== undefined) {
      SkinSystem.state.currency.coin += amount.coin;
    }
    if (amount.jade !== undefined) {
      SkinSystem.state.currency.jade += amount.jade;
    }
    if (amount.star !== undefined) {
      SkinSystem.state.currency.star += amount.star;
    }
    SkinSystem.saveState();
    SkinSystem.notifyCurrencyChangeListeners();
  }

  public static getCurrency(): CurrencyAmount {
    return { ...SkinSystem.state.currency };
  }

  public static getUnlockedCosmetics(): string[] {
    return [...SkinSystem.state.unlockedCosmetics];
  }

  public static getCurrentSkinIds(): PlayerCosmeticState['currentSkin'] {
    return { ...SkinSystem.state.currentSkin };
  }

  public static filterCosmetics(filter: CosmeticFilter, sortBy: CosmeticSortType = 'rarity'): CosmeticItem[] {
    let result = [...ALL_COSMETICS];

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query)
      );
    }

    if (filter.rarity && filter.rarity.length > 0) {
      result = result.filter(c => filter.rarity!.includes(c.rarity));
    }

    switch (filter.type as CosmeticFilterType) {
      case 'all':
        break;
      case 'unlocked':
        result = result.filter(c => this.isUnlocked(c.id));
        break;
      case 'locked':
        result = result.filter(c => !this.isUnlocked(c.id));
        break;
      case 'equipped':
        const equipped = Object.values(SkinSystem.state.currentSkin);
        result = result.filter(c => equipped.includes(c.id));
        break;
      default:
        result = result.filter(c => c.type === filter.type);
        break;
    }

    const rarityOrder: Record<Rarity, number> = {
      legendary: 0,
      epic: 1,
      rare: 2,
      common: 3
    };

    result.sort((a, b) => {
      switch (sortBy) {
        case 'rarity':
          return rarityOrder[a.rarity] - rarityOrder[b.rarity];
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'newest':
          const aUnlocked = this.isUnlocked(a.id);
          const bUnlocked = this.isUnlocked(b.id);
          if (aUnlocked && !bUnlocked) return 1;
          if (!aUnlocked && bUnlocked) return -1;
          return 0;
        default:
          return 0;
      }
    });

    return result;
  }

  public static getAllCosmetics(): CosmeticItem[] {
    return [...ALL_COSMETICS];
  }

  public static getThemes(): ThemeSkin[] {
    return [...DEFAULT_THEMES];
  }

  public static getTrackEffects(): TrackEffect[] {
    return [...DEFAULT_TRACK_EFFECTS];
  }

  public static getPoemFrames(): PoemFrame[] {
    return [...DEFAULT_POEM_FRAMES];
  }

  public static getNoteSkins(): NoteSkin[] {
    return [...DEFAULT_NOTE_SKINS];
  }

  public static getComboEffects(): ComboEffect[] {
    return [...DEFAULT_COMBO_EFFECTS];
  }

  public static getJudgeEffects(): JudgeEffect[] {
    return [...DEFAULT_JUDGE_EFFECTS];
  }

  public static getThemeById(id: string): ThemeSkin | undefined {
    return DEFAULT_THEMES.find(t => t.id === id);
  }

  public static getTrackEffectById(id: string): TrackEffect | undefined {
    return DEFAULT_TRACK_EFFECTS.find(t => t.id === id);
  }

  public static getPoemFrameById(id: string): PoemFrame | undefined {
    return DEFAULT_POEM_FRAMES.find(f => f.id === id);
  }

  public static getNoteSkinById(id: string): NoteSkin | undefined {
    return DEFAULT_NOTE_SKINS.find(n => n.id === id);
  }

  public static getComboEffectById(id: string): ComboEffect | undefined {
    return DEFAULT_COMBO_EFFECTS.find(c => c.id === id);
  }

  public static getJudgeEffectById(id: string): JudgeEffect | undefined {
    return DEFAULT_JUDGE_EFFECTS.find(j => j.id === id);
  }

  public static isEquipped(cosmeticId: string): boolean {
    const equipped = Object.values(SkinSystem.state.currentSkin);
    return equipped.includes(cosmeticId);
  }

  public static addSkinChangeListener(listener: SkinChangeListener): () => void {
    SkinSystem.skinChangeListeners.push(listener);
    return () => {
      const index = SkinSystem.skinChangeListeners.indexOf(listener);
      if (index >= 0) {
        SkinSystem.skinChangeListeners.splice(index, 1);
      }
    };
  }

  public static addUnlockChangeListener(listener: UnlockChangeListener): () => void {
    SkinSystem.unlockChangeListeners.push(listener);
    return () => {
      const index = SkinSystem.unlockChangeListeners.indexOf(listener);
      if (index >= 0) {
        SkinSystem.unlockChangeListeners.splice(index, 1);
      }
    };
  }

  public static addCurrencyChangeListener(listener: CurrencyChangeListener): () => void {
    SkinSystem.currencyChangeListeners.push(listener);
    return () => {
      const index = SkinSystem.currencyChangeListeners.indexOf(listener);
      if (index >= 0) {
        SkinSystem.currencyChangeListeners.splice(index, 1);
      }
    };
  }

  private static notifySkinChangeListeners(): void {
    const config = this.getCurrentSkinConfig();
    SkinSystem.skinChangeListeners.forEach(listener => listener(config));
  }

  private static notifyUnlockChangeListeners(cosmeticId: string, unlocked: boolean): void {
    SkinSystem.unlockChangeListeners.forEach(listener => listener(cosmeticId, unlocked));
  }

  private static notifyCurrencyChangeListeners(): void {
    const currency = this.getCurrency();
    SkinSystem.currencyChangeListeners.forEach(listener => listener(currency));
  }

  public static getState(): PlayerCosmeticState {
    return JSON.parse(JSON.stringify(SkinSystem.state));
  }

  public static resetState(): void {
    SkinSystem.state = { ...DEFAULT_SKIN_STATE };
    SkinSystem.saveState();
    SkinSystem.notifySkinChangeListeners();
    SkinSystem.notifyCurrencyChangeListeners();
  }

  public static checkAndGrantAchievementUnlocks(context: {
    bestScores?: Record<string, Record<Difficulty, BestScore | null>>;
    maxCombo?: number;
    collectedPoems?: number;
    completedChapters?: string[];
  }): string[] {
    const newlyUnlocked: string[] = [];
    const lockedCosmetics = ALL_COSMETICS.filter(c => !this.isUnlocked(c.id));

    for (const cosmetic of lockedCosmetics) {
      if (cosmetic.unlockCondition.type !== 'purchase' &&
          cosmetic.unlockCondition.type !== 'season_reward') {
        if (this.checkUnlockCondition(cosmetic.unlockCondition, context)) {
          this.unlockCosmetic(cosmetic.id);
          newlyUnlocked.push(cosmetic.id);
        }
      }
    }

    return newlyUnlocked;
  }
}
