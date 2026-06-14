import {
  CoverArt,
  COVER_PRESET_THEMES,
  DEFAULT_COVER_ART_SIZE,
  NoteData
} from '../types';

export type CoverTheme = typeof COVER_PRESET_THEMES[number];

interface PatternConfig {
  density: number;
  complexity: number;
  seed: string;
}

export class CoverArtManager {
  private static instance: CoverArtManager;
  private coverCache: Map<string, CoverArt> = new Map();

  private constructor() {}

  public static getInstance(): CoverArtManager {
    if (!CoverArtManager.instance) {
      CoverArtManager.instance = new CoverArtManager();
    }
    return CoverArtManager.instance;
  }

  public createGradientCover(
    songId: string,
    theme: CoverTheme,
    title: string,
    artist: string,
    poemLines: string[] = [],
    notes?: NoteData[]
  ): CoverArt {
    const cached = this.coverCache.get(`${songId}_${theme.name}`);
    if (cached) return cached;

    const seed = this.hashString(songId + title + artist);
    const angle = 30 + (seed % 300);
    const patternType = this.getPatternType(notes);
    const svg = this.buildGradientSVG(
      theme,
      title,
      artist,
      poemLines,
      angle,
      { density: 0.3 + (seed % 40) / 100, complexity: patternType.complexity, seed: songId }
    );

    const cover: CoverArt = {
      id: `${songId}_${theme.name}_${Date.now()}`,
      songId,
      type: 'svg',
      data: svg,
      width: DEFAULT_COVER_ART_SIZE.width,
      height: DEFAULT_COVER_ART_SIZE.height,
      primaryColor: theme.primary,
      secondaryColor: theme.secondary,
      accentColor: theme.accent,
      createdAt: Date.now()
    };

    this.coverCache.set(`${songId}_${theme.name}`, cover);
    return cover;
  }

  public createPresetCover(
    songId: string,
    presetIndex: number,
    title: string,
    artist: string,
    poemLines: string[] = [],
    notes?: NoteData[]
  ): CoverArt {
    const theme = COVER_PRESET_THEMES[presetIndex % COVER_PRESET_THEMES.length];
    return this.createGradientCover(songId, theme, title, artist, poemLines, notes);
  }

  public createCoverFromBPM(
    songId: string,
    bpm: number,
    title: string,
    artist: string,
    poemLines: string[] = [],
    notes?: NoteData[]
  ): CoverArt {
    const themeIndex = Math.floor(bpm / 30) % COVER_PRESET_THEMES.length;
    return this.createPresetCover(songId, themeIndex, title, artist, poemLines, notes);
  }

  public updateCoverColors(cover: CoverArt, primary: string, secondary: string, accent: string): CoverArt {
    const updated: CoverArt = {
      ...cover,
      primaryColor: primary,
      secondaryColor: secondary,
      accentColor: accent,
      id: `${cover.songId}_updated_${Date.now()}`,
      createdAt: Date.now()
    };
    return updated;
  }

  public getPresetThemes(): CoverTheme[] {
    return [...COVER_PRESET_THEMES];
  }

  public getDataURL(cover: CoverArt): string {
    if (cover.type === 'svg') {
      const encoded = encodeURIComponent(cover.data);
      return `data:image/svg+xml;charset=utf-8,${encoded}`;
    }
    return cover.data;
  }

  public getCoverColors(cover: CoverArt | null): { primary: string; secondary: string; accent: string } {
    if (!cover) {
      return {
        primary: COVER_PRESET_THEMES[0].primary,
        secondary: COVER_PRESET_THEMES[0].secondary,
        accent: COVER_PRESET_THEMES[0].accent
      };
    }
    return {
      primary: cover.primaryColor,
      secondary: cover.secondaryColor,
      accent: cover.accentColor
    };
  }

  public clearCache(): void {
    this.coverCache.clear();
  }

  private buildGradientSVG(
    theme: CoverTheme,
    title: string,
    artist: string,
    poemLines: string[],
    angle: number,
    pattern: PatternConfig
  ): string {
    const { width, height } = DEFAULT_COVER_ART_SIZE;
    const patterns = this.generateDecorativePatterns(width, height, pattern);
    const displayPoem = poemLines.length > 0 ? poemLines[0] : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${theme.secondary}" />
      <stop offset="40%" stop-color="${this.mixColors(theme.secondary, theme.primary, 0.5)}" />
      <stop offset="100%" stop-color="${theme.primary}" />
    </linearGradient>
    <radialGradient id="glowGradient" cx="80%" cy="20%" r="50%">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowGradient2" cx="15%" cy="85%" r="45%">
      <stop offset="0%" stop-color="${theme.primary}" stop-opacity="0.25" />
      <stop offset="100%" stop-color="${theme.primary}" stop-opacity="0" />
    </radialGradient>
    <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <clipPath id="coverClip">
      <rect x="0" y="0" width="${width}" height="${height}" rx="16" ry="16"/>
    </clipPath>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgGradient)" rx="16" ry="16"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#glowGradient)" />
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#glowGradient2)" />

  <g clip-path="url(#coverClip)" opacity="0.25">
    ${patterns}
  </g>

  <g opacity="0.9">
    ${this.generateFloatingOrbs(width, height, theme, pattern.seed)}
  </g>

  <g filter="url(#softGlow)">
    <text x="${width / 2}" y="${height / 2 - 20}" 
      text-anchor="middle" 
      font-family="serif" 
      font-size="${Math.min(44, title.length > 8 ? 36 : 44)}" 
      font-weight="bold" 
      fill="${theme.accent}"
      stroke="${theme.secondary}"
      stroke-width="2"
      paint-order="stroke">
      ${this.escapeXML(title)}
    </text>
  </g>

  <text x="${width / 2}" y="${height / 2 + 20}" 
    text-anchor="middle" 
    font-family="sans-serif" 
    font-size="18" 
    fill="#cccccc"
    opacity="0.9">
    ${this.escapeXML(artist)}
  </text>

  ${displayPoem ? `
  <text x="${width / 2}" y="${height - 40}" 
    text-anchor="middle" 
    font-family="serif" 
    font-size="14" 
    fill="${theme.accent}"
    opacity="0.7">
    「${this.escapeXML(displayPoem)}」
  </text>
  ` : ''}

  <rect x="0" y="0" width="${width}" height="${height}" 
    fill="none" 
    stroke="${theme.accent}" 
    stroke-width="2" 
    stroke-opacity="0.4"
    rx="16" 
    ry="16"/>
</svg>`;
  }

  private generateDecorativePatterns(width: number, height: number, config: PatternConfig): string {
    const count = Math.floor(15 + config.density * 40);
    let paths = '';
    const seed = this.hashString(config.seed);

    for (let i = 0; i < count; i++) {
      const x = ((seed * (i + 1) * 7919) % 10000) / 10000 * width;
      const y = ((seed * (i + 1) * 6271) % 10000) / 10000 * height;
      const size = 2 + ((seed * (i + 1) * 131) % 10000) / 10000 * (8 + config.complexity * 6);
      const opacity = 0.15 + ((seed * (i + 1) * 439) % 10000) / 10000 * 0.35;
      const isCircle = (i % 3) !== 0;

      if (isCircle) {
        paths += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="white" opacity="${opacity.toFixed(2)}"/>`;
      } else {
        const rotation = ((seed * (i + 1) * 37) % 360).toFixed(0);
        paths += `<rect x="${(x - size).toFixed(1)}" y="${(y - size).toFixed(1)}" width="${(size * 2).toFixed(1)}" height="${(size * 0.6).toFixed(1)}" fill="white" opacity="${opacity.toFixed(2)}" transform="rotate(${rotation} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }
    }

    const lineCount = Math.floor(3 + config.complexity * 4);
    for (let i = 0; i < lineCount; i++) {
      const y1 = (height / (lineCount + 1)) * (i + 1);
      const wave = Math.sin(i) * 20;
      paths += `<path d="M 0 ${y1 + wave} Q ${width / 4} ${y1 - 30 + wave}, ${width / 2} ${y1} T ${width} ${y1 - wave}" stroke="white" stroke-width="1" fill="none" opacity="0.08"/>`;
    }

    return paths;
  }

  private generateFloatingOrbs(width: number, height: number, theme: CoverTheme, seed: string): string {
    const seedNum = this.hashString(seed + 'orbs');
    let orbs = '';
    const orbConfigs = [
      { cx: width * 0.15, cy: height * 0.3, r: 60, color: theme.primary, opacity: 0.15 },
      { cx: width * 0.85, cy: height * 0.7, r: 80, color: theme.accent, opacity: 0.12 },
      { cx: width * 0.7, cy: height * 0.15, r: 40, color: theme.primary, opacity: 0.2 },
      { cx: width * 0.25, cy: height * 0.8, r: 50, color: theme.accent, opacity: 0.1 }
    ];

    orbConfigs.forEach((orb, i) => {
      const offsetX = ((seedNum * (i + 1) * 53) % 100) / 100 * 30 - 15;
      const offsetY = ((seedNum * (i + 1) * 97) % 100) / 100 * 30 - 15;
      orbs += `<circle cx="${(orb.cx + offsetX).toFixed(1)}" cy="${(orb.cy + offsetY).toFixed(1)}" r="${orb.r}" fill="${orb.color}" opacity="${orb.opacity}" filter="blur(15px)"/>`;
    });

    return orbs;
  }

  private getPatternType(notes?: NoteData[]): { complexity: number } {
    if (!notes || notes.length === 0) {
      return { complexity: 1 };
    }
    const density = notes.length / 100;
    const slideCount = notes.filter(n => n.type === 'slide').length;
    const holdCount = notes.filter(n => n.type === 'hold').length;
    const complexity = Math.min(3, 1 + density * 0.5 + slideCount * 0.02 + holdCount * 0.01);
    return { complexity };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private mixColors(color1: string, color2: string, ratio: number): string {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
    const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
    const b = Math.round(b1 * (1 - ratio) + b2 * ratio);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
