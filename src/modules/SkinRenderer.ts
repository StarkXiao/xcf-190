import * as PIXI from 'pixi.js';
import {
  SkinConfig,
  NoteType,
  LANE_COUNT,
  JudgeResult,
  JudgeEffectStyle,
  NoteSkin,
  ThemeSkin,
  TrackEffect,
  PoemFrame,
  ComboEffect
} from '../types';
import { SkinSystem } from './SkinSystem';

interface SkinTextureCache {
  tapNote: Map<string, PIXI.Texture>;
  holdNote: Map<string, PIXI.Texture>;
  slideNote: Map<string, PIXI.Texture>;
  particles: Map<string, PIXI.Texture>;
}

export class SkinRenderer {
  private app: PIXI.Application;
  private currentConfig: SkinConfig;
  private textureCache: SkinTextureCache;
  private removeSkinListener?: () => void;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.currentConfig = SkinSystem.getCurrentSkinConfig();
    this.textureCache = {
      tapNote: new Map(),
      holdNote: new Map(),
      slideNote: new Map(),
      particles: new Map()
    };

    this.removeSkinListener = SkinSystem.addSkinChangeListener((config) => {
      this.currentConfig = config;
      this.clearTextureCache();
    });
  }

  public getCurrentConfig(): SkinConfig {
    return { ...this.currentConfig };
  }

  public updateConfig(config: SkinConfig): void {
    this.currentConfig = config;
    this.clearTextureCache();
  }

  private clearTextureCache(): void {
    Object.values(this.textureCache).forEach(map => {
      map.forEach((texture: PIXI.Texture) => texture.destroy());
      map.clear();
    });
  }

  private hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  public createBackground(): PIXI.Container {
    const { theme } = this.currentConfig;
    const bgContainer = new PIXI.Container();

    const gradient = new PIXI.Graphics();
    
    if (theme.colors.backgroundGradient) {
      const bgColor = this.hexToNumber(theme.colors.background);
      gradient.beginFill(bgColor);
      gradient.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
      gradient.endFill();
    } else {
      const bgColor = this.hexToNumber(theme.colors.background);
      gradient.beginFill(bgColor);
      gradient.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
      gradient.endFill();
    }
    
    bgContainer.addChild(gradient);

    const starCount = 100;
    const particleColor = theme.particles?.ambientColor || '#ffffff';
    for (let i = 0; i < starCount; i++) {
      const star = new PIXI.Graphics();
      star.beginFill(this.hexToNumber(particleColor), Math.random() * 0.8 + 0.2);
      star.drawCircle(0, 0, Math.random() * 2 + 1);
      star.endFill();
      star.x = Math.random() * this.app.screen.width;
      star.y = Math.random() * this.app.screen.height;
      bgContainer.addChild(star);
    }

    const island = this.createFloatingIsland(theme);
    island.x = this.app.screen.width / 2;
    island.y = this.app.screen.height - 150;
    bgContainer.addChild(island);

    return bgContainer;
  }

  private createFloatingIsland(theme: ThemeSkin): PIXI.Container {
    const island = new PIXI.Container();
    
    const primaryColor = this.hexToNumber(theme.colors.uiAccent);
    const secondaryColor = this.hexToNumber(theme.colors.uiSecondary);
    
    const islandBody = new PIXI.Graphics();
    islandBody.beginFill(secondaryColor);
    islandBody.moveTo(-150, 0);
    islandBody.quadraticCurveTo(-100, 50, 0, 60);
    islandBody.quadraticCurveTo(100, 50, 150, 0);
    islandBody.lineTo(120, -20);
    islandBody.lineTo(-120, -20);
    islandBody.closePath();
    islandBody.endFill();
    
    islandBody.beginFill(primaryColor, 0.5);
    islandBody.moveTo(-120, -20);
    islandBody.lineTo(120, -20);
    islandBody.lineTo(100, -40);
    islandBody.lineTo(-100, -40);
    islandBody.closePath();
    islandBody.endFill();
    
    island.addChild(islandBody);
    
    const house = new PIXI.Graphics();
    house.beginFill(secondaryColor);
    house.drawRect(-30, -80, 60, 50);
    house.endFill();
    
    house.beginFill(primaryColor);
    house.moveTo(-40, -80);
    house.lineTo(0, -110);
    house.lineTo(40, -80);
    house.closePath();
    house.endFill();
    
    house.beginFill(primaryColor, 0.8);
    house.drawRect(-10, -60, 20, 30);
    house.endFill();
    
    island.addChild(house);
    
    const glow = new PIXI.Graphics();
    glow.beginFill(primaryColor, 0.1);
    glow.drawEllipse(0, 0, 180, 80);
    glow.endFill();
    island.addChildAt(glow, 0);
    
    return island;
  }

  public createLaneBackground(laneCount: number): PIXI.Graphics {
    const { theme } = this.currentConfig;
    const graphics = new PIXI.Graphics();
    const laneWidth = this.app.screen.width / laneCount;
    
    for (let i = 0; i < laneCount; i++) {
      const bgColor = this.hexToNumber(theme.colors.laneBackgrounds[i % theme.colors.laneBackgrounds.length]);
      const borderColor = this.hexToNumber(theme.colors.laneBorders[i % theme.colors.laneBorders.length]);
      
      graphics.beginFill(bgColor, i % 2 === 0 ? 0.05 : 0.08);
      graphics.drawRect(i * laneWidth, 0, laneWidth, this.app.screen.height);
      graphics.endFill();
      
      graphics.lineStyle(1, borderColor, 0.1);
      graphics.moveTo(i * laneWidth, 0);
      graphics.lineTo(i * laneWidth, this.app.screen.height);
    }
    
    return graphics;
  }

  public createJudgeLine(y: number): PIXI.Graphics {
    const { theme } = this.currentConfig;
    const line = new PIXI.Graphics();
    const lineColor = this.hexToNumber(theme.colors.judgeLine);
    const glowColor = this.hexToNumber(theme.colors.judgeLineGlow);
    
    line.beginFill(lineColor, 0.3);
    line.drawRect(0, y - 3, this.app.screen.width, 6);
    line.endFill();
    
    const glow = new PIXI.Graphics();
    glow.beginFill(glowColor, 0.2);
    glow.drawRect(0, y - 15, this.app.screen.width, 30);
    glow.endFill();
    
    const container = new PIXI.Container();
    container.addChild(glow);
    container.addChild(line);
    
    return line;
  }

  public createPageNote(
    text: string,
    lane: number,
    noteType: NoteType = 'tap',
    duration?: number,
    noteSpeed: number = 400
  ): PIXI.Container {
    const { noteSkin, theme } = this.currentConfig;
    const noteContainer = new PIXI.Container();
    
    const laneColor = this.hexToNumber(theme.colors.laneBorders[lane % LANE_COUNT]);
    const borderColor = noteSkin.tap.useLaneColor 
      ? laneColor 
      : this.hexToNumber(noteSkin.tap.borderColor);

    if (noteType === 'hold' && duration) {
      noteContainer.addChild(this.createHoldNote(lane, duration, noteSpeed, noteSkin, laneColor));
      noteContainer.addChild(this.createHoldHead(noteSkin, borderColor));
    } else if (noteType === 'slide') {
      noteContainer.addChild(this.createSlideNote(noteSkin, borderColor));
    } else {
      noteContainer.addChild(this.createTapNote(noteSkin, borderColor));
    }
    
    const textStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: noteType === 'hold' ? 20 : 28,
      fill: noteType === 'tap' ? laneColor : 0xffffff,
      fontWeight: 'bold',
      align: 'center'
    });
    
    const textSprite = new PIXI.Text(text, textStyle);
    textSprite.anchor.set(0.5);
    noteContainer.addChild(textSprite);
    
    return noteContainer;
  }

  private createTapNote(noteSkin: NoteSkin, borderColor: number): PIXI.Graphics {
    const page = new PIXI.Graphics();
    const { width, height, cornerRadius, fillColor } = noteSkin.tap;
    
    page.beginFill(this.hexToNumber(fillColor), 0.9);
    page.drawRoundedRect(-width / 2, -height / 2, width, height, cornerRadius);
    page.endFill();
    
    page.lineStyle(noteSkin.tap.borderWidth, borderColor, 0.8);
    page.drawRoundedRect(-width / 2, -height / 2, width, height, cornerRadius);
    
    return page;
  }

  private createHoldNote(
    _lane: number,
    duration: number,
    noteSpeed: number,
    noteSkin: NoteSkin,
    _laneColor: number
  ): PIXI.Graphics {
    const holdHeight = (duration / 1000) * noteSpeed;
    const holdBody = new PIXI.Graphics();
    const pageWidth = noteSkin.tap.width;
    
    const bodyColor = this.hexToNumber(noteSkin.hold.bodyColor);
    const borderColor = this.hexToNumber(noteSkin.hold.borderColor);
    const stripeColor = this.hexToNumber(noteSkin.hold.stripeColor);
    
    holdBody.beginFill(bodyColor, noteSkin.hold.bodyAlpha);
    holdBody.drawRoundedRect(-pageWidth / 2, -holdHeight, pageWidth, holdHeight, 5);
    holdBody.endFill();
    
    holdBody.lineStyle(2, borderColor, 0.8);
    holdBody.drawRoundedRect(-pageWidth / 2, -holdHeight, pageWidth, holdHeight, 5);
    
    const stripeCount = Math.floor(holdHeight / noteSkin.hold.stripeInterval);
    for (let i = 0; i < stripeCount; i++) {
      holdBody.beginFill(stripeColor, 0.2);
      holdBody.drawRect(-pageWidth / 2 + 5, -holdHeight + i * noteSkin.hold.stripeInterval + 10, pageWidth - 10, 3);
      holdBody.endFill();
    }
    
    return holdBody;
  }

  private createHoldHead(noteSkin: NoteSkin, _borderColor: number): PIXI.Graphics {
    const head = new PIXI.Graphics();
    const pageWidth = noteSkin.tap.width;
    const headColor = this.hexToNumber(noteSkin.hold.headColor);
    const holdBorderColor = this.hexToNumber(noteSkin.hold.borderColor);
    
    head.beginFill(headColor, 0.95);
    head.drawRoundedRect(-pageWidth / 2, -pageWidth * 0.35, pageWidth, pageWidth * 0.7, 5);
    head.endFill();
    head.lineStyle(2, holdBorderColor, 0.9);
    head.drawRoundedRect(-pageWidth / 2, -pageWidth * 0.35, pageWidth, pageWidth * 0.7, 5);
    
    return head;
  }

  private createSlideNote(noteSkin: NoteSkin, _borderColor: number): PIXI.Container {
    const container = new PIXI.Container();
    const pageWidth = noteSkin.tap.width;
    const pageHeight = noteSkin.tap.height;
    
    const bodyColor = this.hexToNumber(noteSkin.slide.bodyColor);
    const slideBorderColor = this.hexToNumber(noteSkin.slide.borderColor);
    const arrowColor = this.hexToNumber(noteSkin.slide.arrowColor);
    
    const slideBody = new PIXI.Graphics();
    slideBody.beginFill(bodyColor, noteSkin.slide.bodyAlpha);
    slideBody.drawRoundedRect(-pageWidth / 2, -pageHeight / 2, pageWidth, pageHeight, 5);
    slideBody.endFill();
    
    slideBody.lineStyle(3, slideBorderColor, 0.9);
    slideBody.drawRoundedRect(-pageWidth / 2, -pageHeight / 2, pageWidth, pageHeight, 5);
    
    const arrow = new PIXI.Graphics();
    arrow.beginFill(arrowColor, 0.9);
    arrow.moveTo(0, -8);
    arrow.lineTo(12, 0);
    arrow.lineTo(0, 8);
    arrow.lineTo(3, 0);
    arrow.lineTo(0, -8);
    arrow.closePath();
    arrow.endFill();
    arrow.x = pageWidth / 4;
    
    container.addChild(slideBody);
    container.addChild(arrow);
    
    return container;
  }

  public createComboDisplay(): PIXI.Text {
    const { comboEffect } = this.currentConfig;
    const style = this.createComboTextStyle(comboEffect, 0);
    
    const text = new PIXI.Text('0 COMBO', style);
    text.anchor.set(0.5);
    text.x = this.app.screen.width / 2;
    text.y = this.app.screen.height / 2 - 50;
    text.visible = false;
    
    return text;
  }

  public updateComboDisplay(text: PIXI.Text, combo: number): void {
    const { comboEffect } = this.currentConfig;
    
    if (combo > 0) {
      text.text = `${combo} COMBO`;
      text.visible = true;
      
      const comboScale = 1 + Math.min(combo * 0.01, 0.3);
      const resonanceScale = 1;
      
      const stage = this.getComboStage(combo);
      const color = this.getColorForStage(comboEffect.textStyle.colorStages, stage);
      const shadowColor = comboEffect.textStyle.shadowColorStages
        ? this.getColorForStage(comboEffect.textStyle.shadowColorStages, stage)
        : color;
      
      text.style = this.createComboTextStyle(comboEffect, combo);
      text.style.fill = color;
      
      if (comboEffect.textStyle.shadow) {
        text.style.dropShadow = true;
        text.style.dropShadowColor = shadowColor;
        text.style.dropShadowBlur = comboEffect.textStyle.shadowBlur * comboEffect.animation.glowIntensity;
        text.style.dropShadowDistance = 0;
      }
      
      text.scale.set(comboScale * resonanceScale);
    } else {
      text.visible = false;
    }
  }

  private getComboStage(combo: number): string {
    if (combo >= 50) return '50';
    if (combo >= 20) return '20';
    return '0';
  }

  private getColorForStage(colorStages: Record<string, string>, stage: string): number {
    const colors = Object.keys(colorStages).sort((a, b) => parseInt(b) - parseInt(a));
    for (const threshold of colors) {
      if (parseInt(stage) >= parseInt(threshold)) {
        return this.hexToNumber(colorStages[threshold]);
      }
    }
    return this.hexToNumber(colorStages['0'] || '#ffffff');
  }

  private createComboTextStyle(comboEffect: ComboEffect, combo: number): PIXI.TextStyle {
    const [minSize, maxSize] = comboEffect.textStyle.fontSize;
    const size = minSize + Math.min(combo * 0.1, maxSize - minSize);
    
    return new PIXI.TextStyle({
      fontFamily: comboEffect.textStyle.fontFamily,
      fontSize: size,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: this.hexToNumber(comboEffect.textStyle.strokeColor),
      strokeThickness: comboEffect.textStyle.strokeWidth,
      align: 'center'
    });
  }

  public spawnJudgeText(x: number, y: number, result: JudgeResult, noteType: NoteType = 'tap'): PIXI.Text {
    const { judgeEffect } = this.currentConfig;
    const styleConfig = judgeEffect[result] as JudgeEffectStyle;
    
    const typeLabels: Record<NoteType, string> = {
      tap: '',
      hold: 'HOLD ',
      slide: 'SLIDE '
    };
    
    const displayText = (styleConfig.prefix || '') + typeLabels[noteType] + result.toUpperCase();
    
    const style = new PIXI.TextStyle({
      fontFamily: styleConfig.fontFamily,
      fontSize: styleConfig.fontSize,
      fontWeight: 'bold',
      fill: this.hexToNumber(styleConfig.color),
      stroke: this.hexToNumber(styleConfig.strokeColor),
      strokeThickness: styleConfig.strokeWidth,
      align: 'center',
      dropShadow: styleConfig.shadow,
      dropShadowColor: this.hexToNumber(styleConfig.shadowColor),
      dropShadowBlur: styleConfig.shadowBlur,
      dropShadowDistance: 0
    });
    
    const text = new PIXI.Text(displayText, style);
    text.anchor.set(0.5);
    text.x = x;
    text.y = y - 50;
    
    return text;
  }

  public getJudgeEffectStyle(result: JudgeResult): JudgeEffectStyle {
    return this.currentConfig.judgeEffect[result] as JudgeEffectStyle;
  }

  public getTrackEffect(): TrackEffect {
    return { ...this.currentConfig.trackEffect };
  }

  public getPoemFrameStyle(): PoemFrame['frameStyle'] {
    return { ...this.currentConfig.poemFrame.frameStyle };
  }

  public getPoemTextStyle(): PoemFrame['textStyle'] {
    return { ...this.currentConfig.poemFrame.textStyle };
  }

  public addLyricChar(char: string, _index: number, hit: boolean): PIXI.Text {
    const { poemFrame } = this.currentConfig;
    const textStyle = poemFrame.textStyle;
    
    const style = hit
      ? new PIXI.TextStyle({
          fontFamily: textStyle.fontFamily,
          fontSize: textStyle.fontSize,
          fill: this.hexToNumber(textStyle.color),
          fontWeight: 'bold',
          stroke: textStyle.strokeColor ? this.hexToNumber(textStyle.strokeColor) : 0x8b4513,
          strokeThickness: textStyle.strokeWidth || 2,
          dropShadow: textStyle.shadow || true,
          dropShadowColor: textStyle.shadowColor ? this.hexToNumber(textStyle.shadowColor) : 0xffd700,
          dropShadowBlur: textStyle.shadowBlur || 8
        })
      : new PIXI.TextStyle({
          fontFamily: textStyle.fontFamily,
          fontSize: textStyle.fontSize,
          fill: 0x555555,
          fontWeight: 'bold',
          stroke: 0x333333,
          strokeThickness: 1
        });
    
    const displayChar = hit ? char : '＿';
    const text = new PIXI.Text(displayChar, style);
    text.anchor.set(0.5);
    text.scale.set(0);
    text.alpha = 0;
    
    return text;
  }

  public createPoemFrameContainer(width: number, height: number): PIXI.Container {
    const { poemFrame } = this.currentConfig;
    const container = new PIXI.Container();
    const { frameStyle } = poemFrame;
    
    const bg = new PIXI.Graphics();
    bg.beginFill(this.hexToNumber(frameStyle.backgroundColor), frameStyle.backgroundAlpha);
    bg.drawRoundedRect(0, 0, width, height, frameStyle.cornerRadius);
    bg.endFill();
    
    bg.lineStyle(frameStyle.borderWidth, this.hexToNumber(frameStyle.borderColor), 1);
    bg.drawRoundedRect(0, 0, width, height, frameStyle.cornerRadius);
    
    container.addChild(bg);
    
    if (frameStyle.decoration) {
      const decoration = this.createFrameDecoration(frameStyle, width, height);
      container.addChild(decoration);
    }
    
    return container;
  }

  private createFrameDecoration(
    frameStyle: PoemFrame['frameStyle'],
    width: number,
    height: number
  ): PIXI.Graphics {
    const decoration = new PIXI.Graphics();
    const color = this.hexToNumber(frameStyle.decoration!.color);
    const size = 10;
    
    switch (frameStyle.decoration!.type) {
      case 'corner':
        decoration.beginFill(color, 0.8);
        decoration.drawPolygon([0, 0, size, 0, 0, size]);
        decoration.drawPolygon([width, 0, width - size, 0, width, size]);
        decoration.drawPolygon([0, height, size, height, 0, height - size]);
        decoration.drawPolygon([width, height, width - size, height, width, height - size]);
        decoration.endFill();
        break;
        
      case 'border':
        decoration.lineStyle(2, color, 0.6);
        decoration.drawRoundedRect(5, 5, width - 10, height - 10, frameStyle.cornerRadius - 2);
        break;
        
      case 'pattern':
        decoration.beginFill(color, 0.3);
        for (let i = 0; i < width; i += 30) {
          for (let j = 0; j < height; j += 30) {
            decoration.drawCircle(i + 15, j + 15, 3);
          }
        }
        decoration.endFill();
        break;
    }
    
    return decoration;
  }

  public getAmbientParticleColor(): number {
    return this.hexToNumber(this.currentConfig.theme.particles?.ambientColor || '#ffd700');
  }

  public getHitParticleColor(): number {
    return this.hexToNumber(this.currentConfig.theme.particles?.hitColor || '#ffffff');
  }

  public getComboParticleColor(): number {
    return this.hexToNumber(this.currentConfig.theme.particles?.comboColor || '#ffd700');
  }

  public getLaneColor(lane: number): number {
    const colors = this.currentConfig.theme.colors.laneBorders;
    return this.hexToNumber(colors[lane % colors.length]);
  }

  public getThemeColors(): ThemeSkin['colors'] {
    return { ...this.currentConfig.theme.colors };
  }

  public destroy(): void {
    if (this.removeSkinListener) {
      this.removeSkinListener();
    }
    this.clearTextureCache();
  }
}
