import {
  ThemeSkin,
  TrackEffect,
  PoemFrame,
  NoteSkin,
  ComboEffect,
  JudgeEffect,
  ShopItem,
  CosmeticItem
} from '../types';

export const DEFAULT_THEMES: ThemeSkin[] = [
  {
    id: 'default_theme',
    name: '墨韵书香',
    type: 'theme',
    rarity: 'common',
    description: '经典的水墨风格，书香气息',
    colors: {
      background: '#0a0a1a',
      backgroundGradient: ['#0a0a1a', '#1a1a3a'],
      laneBackgrounds: ['#1a0a1a', '#0a1a1a', '#0a0a2a', '#1a1a0a'],
      laneBorders: ['#ff6b9d', '#6bff9d', '#6b9dff', '#ffd93d'],
      judgeLine: '#ffffff',
      judgeLineGlow: '#6b9dff',
      uiPrimary: '#ffffff',
      uiSecondary: '#aaaaaa',
      uiAccent: '#ffd700'
    },
    particles: {
      ambientColor: '#ffd700',
      hitColor: '#ffffff',
      comboColor: '#ffd700'
    },
    unlockCondition: {
      type: 'purchase',
      description: '初始拥有'
    },
    isDefault: true
  },
  {
    id: 'cherry_blossom',
    name: '樱花浪漫',
    type: 'theme',
    rarity: 'rare',
    description: '粉樱飘落，浪漫诗意',
    colors: {
      background: '#1a0a1a',
      backgroundGradient: ['#2a1a2a', '#3a1a2a'],
      laneBackgrounds: ['#2a0a1a', '#2a1a1a', '#1a0a2a', '#2a1a2a'],
      laneBorders: ['#ff6b9d', '#ff9ec4', '#ffc4d9', '#ffb6c1'],
      judgeLine: '#ff6b9d',
      judgeLineGlow: '#ff9ec4',
      uiPrimary: '#ff6b9d',
      uiSecondary: '#ffc4d9',
      uiAccent: '#ffd700'
    },
    particles: {
      ambientColor: '#ffb6c1',
      hitColor: '#ff6b9d',
      comboColor: '#ffc4d9'
    },
    unlockCondition: {
      type: 'purchase',
      cost: { coin: 5000 },
      description: '5000 金币'
    },
    isDefault: false
  },
  {
    id: 'bamboo_forest',
    name: '翠竹幽篁',
    type: 'theme',
    rarity: 'rare',
    description: '竹林深处，清新自然',
    colors: {
      background: '#0a1a0a',
      backgroundGradient: ['#0a2a0a', '#1a3a1a'],
      laneBackgrounds: ['#0a1a1a', '#0a2a0a', '#1a2a1a', '#0a1a2a'],
      laneBorders: ['#6bff9d', '#9bffb3', '#6bffc4', '#9bffd9'],
      judgeLine: '#6bff9d',
      judgeLineGlow: '#9bffb3',
      uiPrimary: '#6bff9d',
      uiSecondary: '#9bffc4',
      uiAccent: '#ffd700'
    },
    particles: {
      ambientColor: '#9bffb3',
      hitColor: '#6bff9d',
      comboColor: '#9bffd9'
    },
    unlockCondition: {
      type: 'purchase',
      cost: { coin: 5000 },
      description: '5000 金币'
    },
    isDefault: false
  },
  {
    id: 'starry_night',
    name: '星空物语',
    type: 'theme',
    rarity: 'epic',
    description: '繁星点点，如梦如幻',
    colors: {
      background: '#0a0a2a',
      backgroundGradient: ['#0a0a3a', '#1a1a4a'],
      laneBackgrounds: ['#1a0a3a', '#0a1a3a', '#0a0a4a', '#1a1a4a'],
      laneBorders: ['#6b9dff', '#9bb3ff', '#b3c4ff', '#d9e6ff'],
      judgeLine: '#6b9dff',
      judgeLineGlow: '#9bb3ff',
      uiPrimary: '#9bb3ff',
      uiSecondary: '#b3c4ff',
      uiAccent: '#ffd700'
    },
    particles: {
      ambientColor: '#ffffff',
      hitColor: '#6b9dff',
      comboColor: '#ffd700'
    },
    unlockCondition: {
      type: 'purchase',
      cost: { coin: 8000, jade: 10 },
      description: '8000 金币 + 10 玉石'
    },
    isDefault: false
  },
  {
    id: 'autumn_glow',
    name: '金秋红叶',
    type: 'theme',
    rarity: 'epic',
    description: '金秋时节，红叶漫山',
    colors: {
      background: '#2a1a0a',
      backgroundGradient: ['#3a1a0a', '#4a2a0a'],
      laneBackgrounds: ['#2a0a0a', '#3a1a0a', '#2a1a0a', '#3a2a0a'],
      laneBorders: ['#ff9d5b', '#ffb36b', '#ffc47b', '#ffd98b'],
      judgeLine: '#ff9d5b',
      judgeLineGlow: '#ffc47b',
      uiPrimary: '#ff9d5b',
      uiSecondary: '#ffc47b',
      uiAccent: '#ffd700'
    },
    particles: {
      ambientColor: '#ffc47b',
      hitColor: '#ff9d5b',
      comboColor: '#ffd700'
    },
    unlockCondition: {
      type: 'rating',
      minRating: 'A',
      description: '任意歌曲获得 A 评级'
    },
    isDefault: false
  },
  {
    id: 'divine_peach',
    name: '桃源仙境',
    type: 'theme',
    rarity: 'legendary',
    description: '传说中的桃源仙境，如梦似幻',
    colors: {
      background: '#1a0a2a',
      backgroundGradient: ['#2a0a3a', '#3a1a4a'],
      laneBackgrounds: ['#2a0a2a', '#3a0a3a', '#2a1a3a', '#3a1a4a'],
      laneBorders: ['#ff6bff', '#ff9dff', '#ffb3ff', '#ffc4ff'],
      judgeLine: '#ffd700',
      judgeLineGlow: '#ff6bff',
      uiPrimary: '#ffd700',
      uiSecondary: '#ff9dff',
      uiAccent: '#ffd700'
    },
    particles: {
      ambientColor: '#ffd700',
      hitColor: '#ff6bff',
      comboColor: '#ffd700'
    },
    unlockCondition: {
      type: 'season_reward',
      seasonId: 's1',
      description: '赛季奖励'
    },
    isDefault: false
  }
];

export const DEFAULT_TRACK_EFFECTS: TrackEffect[] = [
  {
    id: 'default_track',
    name: '经典特效',
    type: 'track_effect',
    rarity: 'common',
    description: '经典的轨道特效',
    laneGlow: {
      color: '#ffffff',
      alpha: 0.3,
      blur: 5
    },
    hitEffect: {
      particleCount: 12,
      particleColors: ['#ffffff', '#ffd700'],
      particleSpeed: 4,
      particleSize: [3, 8],
      ringColor: '#ffd700',
      ringExpandSpeed: 2
    },
    holdEffect: {
      color: '#ffffff',
      pulseSpeed: 100
    },
    slideEffect: {
      trailColor: '#ffffff',
      trailWidth: 4,
      trailAlpha: 0.8
    },
    unlockCondition: {
      type: 'purchase',
      description: '初始拥有'
    },
    isDefault: true
  },
  {
    id: 'fire_track',
    name: '烈焰燃烧',
    type: 'track_effect',
    rarity: 'rare',
    description: '火焰般的炽热特效',
    laneGlow: {
      color: '#ff4444',
      alpha: 0.4,
      blur: 8
    },
    hitEffect: {
      particleCount: 20,
      particleColors: ['#ff4444', '#ff8800', '#ffcc00'],
      particleSpeed: 6,
      particleSize: [4, 10],
      ringColor: '#ff4444',
      ringExpandSpeed: 3
    },
    holdEffect: {
      color: '#ff6600',
      pulseSpeed: 80
    },
    slideEffect: {
      trailColor: '#ff4444',
      trailWidth: 6,
      trailAlpha: 0.9
    },
    unlockCondition: {
      type: 'purchase',
      cost: { coin: 3000 },
      description: '3000 金币'
    },
    isDefault: false
  },
  {
    id: 'ice_track',
    name: '冰霜凝结',
    type: 'track_effect',
    rarity: 'rare',
    description: '冰晶般的清凉特效',
    laneGlow: {
      color: '#66ccff',
      alpha: 0.4,
      blur: 8
    },
    hitEffect: {
      particleCount: 18,
      particleColors: ['#66ccff', '#aaddff', '#ffffff'],
      particleSpeed: 3,
      particleSize: [3, 9],
      ringColor: '#66ccff',
      ringExpandSpeed: 2
    },
    holdEffect: {
      color: '#aaddff',
      pulseSpeed: 120
    },
    slideEffect: {
      trailColor: '#66ccff',
      trailWidth: 5,
      trailAlpha: 0.85
    },
    unlockCondition: {
      type: 'purchase',
      cost: { coin: 3000 },
      description: '3000 金币'
    },
    isDefault: false
  },
  {
    id: 'thunder_track',
    name: '雷霆万钧',
    type: 'track_effect',
    rarity: 'epic',
    description: '雷电般的震撼特效',
    laneGlow: {
      color: '#ffff66',
      alpha: 0.5,
      blur: 10
    },
    hitEffect: {
      particleCount: 25,
      particleColors: ['#ffff66', '#ffffff', '#66ffff'],
      particleSpeed: 8,
      particleSize: [5, 12],
      ringColor: '#ffff66',
      ringExpandSpeed: 4
    },
    holdEffect: {
      color: '#ffff66',
      pulseSpeed: 60
    },
    slideEffect: {
      trailColor: '#ffff66',
      trailWidth: 7,
      trailAlpha: 0.95
    },
    unlockCondition: {
      type: 'combo',
      minCombo: 100,
      description: '达成 100 连击'
    },
    isDefault: false
  },
  {
    id: 'cosmic_track',
    name: '星河璀璨',
    type: 'track_effect',
    rarity: 'legendary',
    description: '宇宙星河般的梦幻特效',
    laneGlow: {
      color: '#9966ff',
      alpha: 0.5,
      blur: 12
    },
    hitEffect: {
      particleCount: 30,
      particleColors: ['#9966ff', '#ff66ff', '#66ffff', '#ffff66'],
      particleSpeed: 5,
      particleSize: [4, 14],
      ringColor: '#9966ff',
      ringExpandSpeed: 3
    },
    holdEffect: {
      color: '#ff66ff',
      pulseSpeed: 70
    },
    slideEffect: {
      trailColor: '#9966ff',
      trailWidth: 8,
      trailAlpha: 1.0
    },
    unlockCondition: {
      type: 'season_reward',
      seasonId: 's1',
      description: '赛季奖励'
    },
    isDefault: false
  }
];

export const DEFAULT_POEM_FRAMES: PoemFrame[] = [
  {
    id: 'default_frame',
    name: '经典边框',
    type: 'poem_frame',
    rarity: 'common',
    description: '经典的诗句边框',
    frameStyle: {
      borderColor: '#8b4513',
      borderWidth: 2,
      backgroundColor: '#000000',
      backgroundAlpha: 0.5,
      cornerRadius: 5
    },
    textStyle: {
      fontFamily: 'serif',
      fontSize: 30,
      color: '#ffd700',
      strokeColor: '#8b4513',
      strokeWidth: 2,
      shadow: true,
      shadowColor: '#ffd700',
      shadowBlur: 8
    },
    unlockCondition: {
      type: 'purchase',
      description: '初始拥有'
    },
    isDefault: true
  },
  {
    id: 'jade_frame',
    name: '玉璧边框',
    type: 'poem_frame',
    rarity: 'rare',
    description: '精美的玉石装饰边框',
    frameStyle: {
      borderColor: '#6bff9d',
      borderWidth: 3,
      backgroundColor: '#0a1a0a',
      backgroundAlpha: 0.6,
      cornerRadius: 8,
      decoration: {
        type: 'corner',
        color: '#9bffb3'
      }
    },
    textStyle: {
      fontFamily: 'serif',
      fontSize: 32,
      color: '#9bffb3',
      strokeColor: '#2d5016',
      strokeWidth: 2,
      shadow: true,
      shadowColor: '#6bff9d',
      shadowBlur: 10
    },
    unlockCondition: {
      type: 'purchase',
      cost: { jade: 20 },
      description: '20 玉石'
    },
    isDefault: false
  },
  {
    id: 'gold_frame',
    name: '黄金边框',
    type: 'poem_frame',
    rarity: 'epic',
    description: '华丽的黄金装饰边框',
    frameStyle: {
      borderColor: '#ffd700',
      borderWidth: 4,
      backgroundColor: '#1a1a0a',
      backgroundAlpha: 0.7,
      cornerRadius: 10,
      decoration: {
        type: 'border',
        color: '#ffd700',
        pattern: '*****'
      }
    },
    textStyle: {
      fontFamily: 'serif',
      fontSize: 34,
      color: '#ffd700',
      strokeColor: '#8b6914',
      strokeWidth: 3,
      shadow: true,
      shadowColor: '#ffd700',
      shadowBlur: 12
    },
    unlockCondition: {
      type: 'poem_collect',
      poemCount: 10,
      description: '收集 10 首诗句'
    },
    isDefault: false
  },
  {
    id: 'dragon_frame',
    name: '龙凤呈祥',
    type: 'poem_frame',
    rarity: 'legendary',
    description: '传说中的龙凤边框',
    frameStyle: {
      borderColor: '#ff6b9d',
      borderWidth: 5,
      backgroundColor: '#1a0a1a',
      backgroundAlpha: 0.8,
      cornerRadius: 12,
      decoration: {
        type: 'pattern',
        color: '#ffd700',
        pattern: '龙'
      }
    },
    textStyle: {
      fontFamily: 'serif',
      fontSize: 36,
      color: '#ffd700',
      strokeColor: '#8b0000',
      strokeWidth: 3,
      shadow: true,
      shadowColor: '#ff6b9d',
      shadowBlur: 15
    },
    unlockCondition: {
      type: 'season_reward',
      seasonId: 's1',
      description: '赛季奖励'
    },
    isDefault: false
  }
];

export const DEFAULT_NOTE_SKINS: NoteSkin[] = [
  {
    id: 'default_note',
    name: '书香书页',
    type: 'note_skin',
    rarity: 'common',
    description: '经典的书页造型',
    tap: {
      width: 80,
      height: 60,
      cornerRadius: 5,
      fillColor: '#ffffff',
      borderColor: '#6b9dff',
      borderWidth: 2,
      useLaneColor: true
    },
    hold: {
      bodyColor: '#9b59b6',
      bodyAlpha: 0.4,
      headColor: '#ffffff',
      borderColor: '#9b59b6',
      stripeColor: '#6b9dff',
      stripeInterval: 30
    },
    slide: {
      bodyColor: '#e74c3c',
      bodyAlpha: 0.6,
      borderColor: '#e74c3c',
      arrowColor: '#ffffff'
    },
    unlockCondition: {
      type: 'purchase',
      description: '初始拥有'
    },
    isDefault: true
  },
  {
    id: 'petal_note',
    name: '花瓣飘零',
    type: 'note_skin',
    rarity: 'rare',
    description: '花瓣造型的音符',
    tap: {
      width: 70,
      height: 70,
      cornerRadius: 35,
      fillColor: '#ffb6c1',
      borderColor: '#ff6b9d',
      borderWidth: 2,
      useLaneColor: false
    },
    hold: {
      bodyColor: '#ff6b9d',
      bodyAlpha: 0.3,
      headColor: '#ffb6c1',
      borderColor: '#ff6b9d',
      stripeColor: '#ffc4d9',
      stripeInterval: 25
    },
    slide: {
      bodyColor: '#ff6b9d',
      bodyAlpha: 0.5,
      borderColor: '#ff6b9d',
      arrowColor: '#ffffff'
    },
    unlockCondition: {
      type: 'purchase',
      cost: { coin: 2000 },
      description: '2000 金币'
    },
    isDefault: false
  },
  {
    id: 'jade_note',
    name: '翡翠玉石',
    type: 'note_skin',
    rarity: 'epic',
    description: '翡翠玉石造型的音符',
    tap: {
      width: 75,
      height: 55,
      cornerRadius: 8,
      fillColor: '#9bffb3',
      borderColor: '#6bff9d',
      borderWidth: 3,
      useLaneColor: false
    },
    hold: {
      bodyColor: '#6bff9d',
      bodyAlpha: 0.35,
      headColor: '#9bffb3',
      borderColor: '#6bff9d',
      stripeColor: '#ffffff',
      stripeInterval: 28
    },
    slide: {
      bodyColor: '#6bff9d',
      bodyAlpha: 0.55,
      borderColor: '#6bff9d',
      arrowColor: '#ffffff'
    },
    unlockCondition: {
      type: 'accuracy',
      minAccuracy: 95,
      description: '任意歌曲准确率 95%+'
    },
    isDefault: false
  },
  {
    id: 'crystal_note',
    name: '水晶流光',
    type: 'note_skin',
    rarity: 'legendary',
    description: '水晶般闪耀的音符',
    tap: {
      width: 85,
      height: 65,
      cornerRadius: 10,
      fillColor: '#ffffff',
      borderColor: '#9bb3ff',
      borderWidth: 3,
      useLaneColor: false
    },
    hold: {
      bodyColor: '#9bb3ff',
      bodyAlpha: 0.4,
      headColor: '#ffffff',
      borderColor: '#6b9dff',
      stripeColor: '#ffd700',
      stripeInterval: 25
    },
    slide: {
      bodyColor: '#9bb3ff',
      bodyAlpha: 0.6,
      borderColor: '#6b9dff',
      arrowColor: '#ffd700'
    },
    unlockCondition: {
      type: 'season_reward',
      seasonId: 's1',
      description: '赛季奖励'
    },
    isDefault: false
  }
];

export const DEFAULT_COMBO_EFFECTS: ComboEffect[] = [
  {
    id: 'default_combo',
    name: '经典连击',
    type: 'combo_effect',
    rarity: 'common',
    description: '经典的连击显示效果',
    textStyle: {
      fontFamily: 'sans-serif',
      fontSize: [48, 60],
      colorStages: { '0': '#ffffff', '20': '#ff6b9d', '50': '#ffd700' },
      strokeColor: '#000000',
      strokeWidth: 4,
      shadow: true,
      shadowColorStages: { '0': '#000000', '50': '#ffd700' },
      shadowBlur: 0
    },
    animation: {
      scaleBoost: 1.3,
      bounceIntensity: 0.1,
      glowIntensity: 0.0
    },
    unlockCondition: {
      type: 'purchase',
      description: '初始拥有'
    },
    isDefault: true
  },
  {
    id: 'fire_combo',
    name: '烈焰连击',
    type: 'combo_effect',
    rarity: 'rare',
    description: '火焰燃烧的连击效果',
    textStyle: {
      fontFamily: 'sans-serif',
      fontSize: [52, 65],
      colorStages: { '0': '#ff8800', '20': '#ff4444', '50': '#ff0000' },
      strokeColor: '#880000',
      strokeWidth: 4,
      shadow: true,
      shadowColorStages: { '0': '#ff4444', '50': '#ff0000' },
      shadowBlur: 10
    },
    animation: {
      scaleBoost: 1.4,
      bounceIntensity: 0.15,
      glowIntensity: 0.5
    },
    unlockCondition: {
      type: 'purchase',
      cost: { coin: 2500 },
      description: '2500 金币'
    },
    isDefault: false
  },
  {
    id: 'crystal_combo',
    name: '水晶连击',
    type: 'combo_effect',
    rarity: 'epic',
    description: '水晶般闪耀的连击效果',
    textStyle: {
      fontFamily: 'sans-serif',
      fontSize: [55, 70],
      colorStages: { '0': '#66ccff', '20': '#9999ff', '50': '#ffffff' },
      strokeColor: '#0066cc',
      strokeWidth: 4,
      shadow: true,
      shadowColorStages: { '0': '#66ccff', '50': '#ffffff' },
      shadowBlur: 15
    },
    animation: {
      scaleBoost: 1.5,
      bounceIntensity: 0.2,
      glowIntensity: 0.8
    },
    unlockCondition: {
      type: 'purchase',
      cost: { jade: 15 },
      description: '15 玉石'
    },
    isDefault: false
  },
  {
    id: 'golden_combo',
    name: '黄金连击',
    type: 'combo_effect',
    rarity: 'legendary',
    description: '黄金光辉的连击效果',
    textStyle: {
      fontFamily: 'serif',
      fontSize: [60, 80],
      colorStages: { '0': '#ffd700', '20': '#ffaa00', '50': '#ffffff' },
      strokeColor: '#8b6914',
      strokeWidth: 5,
      shadow: true,
      shadowColorStages: { '0': '#ffd700', '50': '#ffffff' },
      shadowBlur: 20
    },
    animation: {
      scaleBoost: 1.6,
      bounceIntensity: 0.25,
      glowIntensity: 1.0
    },
    unlockCondition: {
      type: 'season_reward',
      seasonId: 's1',
      description: '赛季奖励'
    },
    isDefault: false
  }
];

export const DEFAULT_JUDGE_EFFECTS: JudgeEffect[] = [
  {
    id: 'default_judge',
    name: '经典判定',
    type: 'judge_effect',
    rarity: 'common',
    description: '经典的判定特效',
    perfect: {
      fontFamily: 'sans-serif',
      fontSize: 32,
      color: '#ffd700',
      strokeColor: '#000000',
      strokeWidth: 3,
      shadow: true,
      shadowColor: '#ffd700',
      shadowBlur: 10,
      animation: {
        floatSpeed: 1.5,
        floatDistance: 50,
        scaleBoost: 1.3,
        fadeDuration: 45
      }
    },
    great: {
      fontFamily: 'sans-serif',
      fontSize: 32,
      color: '#00ff00',
      strokeColor: '#000000',
      strokeWidth: 3,
      shadow: true,
      shadowColor: '#00ff00',
      shadowBlur: 8,
      animation: {
        floatSpeed: 1.5,
        floatDistance: 45,
        scaleBoost: 1.2,
        fadeDuration: 40
      }
    },
    good: {
      fontFamily: 'sans-serif',
      fontSize: 32,
      color: '#00bfff',
      strokeColor: '#000000',
      strokeWidth: 3,
      shadow: true,
      shadowColor: '#00bfff',
      shadowBlur: 6,
      animation: {
        floatSpeed: 1.2,
        floatDistance: 40,
        scaleBoost: 1.1,
        fadeDuration: 35
      }
    },
    miss: {
      fontFamily: 'sans-serif',
      fontSize: 32,
      color: '#ff4444',
      strokeColor: '#000000',
      strokeWidth: 3,
      shadow: true,
      shadowColor: '#ff4444',
      shadowBlur: 5,
      animation: {
        floatSpeed: 1.0,
        floatDistance: 30,
        scaleBoost: 1.0,
        fadeDuration: 30
      }
    },
    unlockCondition: {
      type: 'purchase',
      description: '初始拥有'
    },
    isDefault: true
  },
  {
    id: 'elegant_judge',
    name: '优雅判定',
    type: 'judge_effect',
    rarity: 'rare',
    description: '优雅的判定特效',
    perfect: {
      fontFamily: 'serif',
      fontSize: 36,
      color: '#ffd700',
      strokeColor: '#8b6914',
      strokeWidth: 2,
      shadow: true,
      shadowColor: '#ffd700',
      shadowBlur: 12,
      prefix: '♪ ',
      animation: {
        floatSpeed: 1.3,
        floatDistance: 55,
        scaleBoost: 1.35,
        fadeDuration: 50
      }
    },
    great: {
      fontFamily: 'serif',
      fontSize: 34,
      color: '#9bffb3',
      strokeColor: '#2d5016',
      strokeWidth: 2,
      shadow: true,
      shadowColor: '#9bffb3',
      shadowBlur: 10,
      prefix: '♪ ',
      animation: {
        floatSpeed: 1.3,
        floatDistance: 50,
        scaleBoost: 1.25,
        fadeDuration: 45
      }
    },
    good: {
      fontFamily: 'serif',
      fontSize: 32,
      color: '#9bb3ff',
      strokeColor: '#1a3a5a',
      strokeWidth: 2,
      shadow: true,
      shadowColor: '#9bb3ff',
      shadowBlur: 8,
      prefix: '♪ ',
      animation: {
        floatSpeed: 1.1,
        floatDistance: 45,
        scaleBoost: 1.15,
        fadeDuration: 40
      }
    },
    miss: {
      fontFamily: 'serif',
      fontSize: 30,
      color: '#ff9999',
      strokeColor: '#5a1a1a',
      strokeWidth: 2,
      shadow: true,
      shadowColor: '#ff9999',
      shadowBlur: 6,
      prefix: '♪ ',
      animation: {
        floatSpeed: 0.9,
        floatDistance: 35,
        scaleBoost: 1.05,
        fadeDuration: 35
      }
    },
    unlockCondition: {
      type: 'purchase',
      cost: { coin: 3500 },
      description: '3500 金币'
    },
    isDefault: false
  },
  {
    id: 'legendary_judge',
    name: '传说判定',
    type: 'judge_effect',
    rarity: 'legendary',
    description: '传说级的判定特效',
    perfect: {
      fontFamily: 'serif',
      fontSize: 40,
      color: '#ffd700',
      strokeColor: '#ff6b9d',
      strokeWidth: 4,
      shadow: true,
      shadowColor: '#ffd700',
      shadowBlur: 20,
      prefix: '★ ',
      animation: {
        floatSpeed: 1.6,
        floatDistance: 60,
        scaleBoost: 1.5,
        fadeDuration: 60
      }
    },
    great: {
      fontFamily: 'serif',
      fontSize: 38,
      color: '#ff6bff',
      strokeColor: '#8b008b',
      strokeWidth: 4,
      shadow: true,
      shadowColor: '#ff6bff',
      shadowBlur: 18,
      prefix: '★ ',
      animation: {
        floatSpeed: 1.5,
        floatDistance: 55,
        scaleBoost: 1.4,
        fadeDuration: 55
      }
    },
    good: {
      fontFamily: 'serif',
      fontSize: 36,
      color: '#66ffff',
      strokeColor: '#008b8b',
      strokeWidth: 4,
      shadow: true,
      shadowColor: '#66ffff',
      shadowBlur: 16,
      prefix: '★ ',
      animation: {
        floatSpeed: 1.3,
        floatDistance: 50,
        scaleBoost: 1.3,
        fadeDuration: 50
      }
    },
    miss: {
      fontFamily: 'serif',
      fontSize: 34,
      color: '#ff6666',
      strokeColor: '#8b0000',
      strokeWidth: 4,
      shadow: true,
      shadowColor: '#ff6666',
      shadowBlur: 12,
      prefix: '★ ',
      animation: {
        floatSpeed: 1.1,
        floatDistance: 40,
        scaleBoost: 1.2,
        fadeDuration: 45
      }
    },
    unlockCondition: {
      type: 'season_reward',
      seasonId: 's1',
      description: '赛季奖励'
    },
    isDefault: false
  }
];

export const DEFAULT_SHOP_ITEMS: ShopItem[] = [
  {
    id: 'shop_cherry_blossom',
    cosmeticId: 'cherry_blossom',
    cosmeticType: 'theme',
    price: { coin: 5000 },
    isFeatured: true,
    featuredOrder: 1,
    isLimited: false,
    soldCount: 0
  },
  {
    id: 'shop_bamboo_forest',
    cosmeticId: 'bamboo_forest',
    cosmeticType: 'theme',
    price: { coin: 5000 },
    isFeatured: false,
    isLimited: false,
    soldCount: 0
  },
  {
    id: 'shop_starry_night',
    cosmeticId: 'starry_night',
    cosmeticType: 'theme',
    price: { coin: 8000, jade: 10 },
    discount: 10,
    isFeatured: true,
    featuredOrder: 2,
    isLimited: false,
    soldCount: 0
  },
  {
    id: 'shop_fire_track',
    cosmeticId: 'fire_track',
    cosmeticType: 'track_effect',
    price: { coin: 3000 },
    isFeatured: false,
    isLimited: false,
    soldCount: 0
  },
  {
    id: 'shop_ice_track',
    cosmeticId: 'ice_track',
    cosmeticType: 'track_effect',
    price: { coin: 3000 },
    isFeatured: false,
    isLimited: false,
    soldCount: 0
  },
  {
    id: 'shop_thunder_track',
    cosmeticId: 'thunder_track',
    cosmeticType: 'track_effect',
    price: { coin: 6000, jade: 5 },
    isFeatured: true,
    featuredOrder: 3,
    isLimited: false,
    soldCount: 0
  },
  {
    id: 'shop_jade_frame',
    cosmeticId: 'jade_frame',
    cosmeticType: 'poem_frame',
    price: { jade: 20 },
    isFeatured: false,
    isLimited: false,
    soldCount: 0
  },
  {
    id: 'shop_petal_note',
    cosmeticId: 'petal_note',
    cosmeticType: 'note_skin',
    price: { coin: 2000 },
    isFeatured: false,
    isLimited: false,
    soldCount: 0
  },
  {
    id: 'shop_fire_combo',
    cosmeticId: 'fire_combo',
    cosmeticType: 'combo_effect',
    price: { coin: 2500 },
    isFeatured: false,
    isLimited: false,
    soldCount: 0
  },
  {
    id: 'shop_crystal_combo',
    cosmeticId: 'crystal_combo',
    cosmeticType: 'combo_effect',
    price: { jade: 15 },
    isFeatured: true,
    featuredOrder: 4,
    isLimited: false,
    soldCount: 0
  },
  {
    id: 'shop_elegant_judge',
    cosmeticId: 'elegant_judge',
    cosmeticType: 'judge_effect',
    price: { coin: 3500 },
    isFeatured: false,
    isLimited: false,
    soldCount: 0
  }
];

export const ALL_COSMETICS: CosmeticItem[] = [
  ...DEFAULT_THEMES,
  ...DEFAULT_TRACK_EFFECTS,
  ...DEFAULT_POEM_FRAMES,
  ...DEFAULT_NOTE_SKINS,
  ...DEFAULT_COMBO_EFFECTS,
  ...DEFAULT_JUDGE_EFFECTS
];

export const getCosmeticById = (id: string): CosmeticItem | undefined => {
  return ALL_COSMETICS.find(c => c.id === id);
};

export const getCosmeticsByType = (type: string): CosmeticItem[] => {
  return ALL_COSMETICS.filter(c => c.type === type);
};
