import * as PIXI from 'pixi.js';
import { JudgeResult, LANE_COUNT, NoteType } from '../types';

interface Particle {
  sprite: PIXI.Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface JudgeEffect {
  text: PIXI.Text;
  life: number;
  maxLife: number;
}

interface HoldEffect {
  glow: PIXI.Graphics;
  lane: number;
  startTime: number;
}

interface SlideTrail {
  graphics: PIXI.Container;
  points: { x: number; y: number }[];
  life: number;
}

interface AtmosphereState {
  overlay: PIXI.Graphics;
  currentColor: number;
  currentAlpha: number;
  targetColor: number;
  targetAlpha: number;
  transitionSpeed: number;
  ambientParticles: PIXI.Sprite[];
  ambientParticleData: { vx: number; vy: number; baseY: number; phase: number }[];
}

interface ResonanceEffect {
  baseContainer: PIXI.Container;
  burstContainer: PIXI.Container;
  pages: PIXI.Sprite[];
  pageData: { angle: number; speed: number; rotationSpeed: number; baseY: number; amplitude: number; phase: number }[];
  glowRing: PIXI.Graphics;
  glowIntensity: number;
}

interface LayerState {
  currentZBoost: number;
  targetZBoost: number;
  baseIndex: number;
}

const ATMOSPHERE_PRESETS = [
  { color: 0x0a0a1a, alpha: 0 },
  { color: 0x1a0a3a, alpha: 0.15 },
  { color: 0x2a1a0a, alpha: 0.18 },
  { color: 0x0a2a1a, alpha: 0.2 },
  { color: 0x2a2a0a, alpha: 0.22 },
];

export class EffectRenderer {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private burstLayer: PIXI.Container;
  private parentContainer: PIXI.Container | null = null;
  private particles: Particle[] = [];
  private judgeEffects: JudgeEffect[] = [];
  private holdEffects: HoldEffect[] = [];
  private slideTrails: SlideTrail[] = [];
  private laneColors: number[] = [0xff6b9d, 0x6bff9d, 0x6b9dff, 0xffd93d];
  private noteTypeColors: Record<NoteType, number> = {
    tap: 0xffffff,
    hold: 0x9b59b6,
    slide: 0xe74c3c
  };
  private litCharacters: PIXI.Text[] = [];
  private lyricContainer: PIXI.Container;
  private charCount: number = 0;
  private atmosphere: AtmosphereState;
  private resonance: ResonanceEffect;
  private resonanceIntensity: number = 0;
  private targetResonanceIntensity: number = 0;
  private layerState: LayerState = {
    currentZBoost: 0,
    targetZBoost: 0,
    baseIndex: 0
  };

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.app.stage.addChild(this.container);
    
    this.burstLayer = new PIXI.Container();
    this.app.stage.addChild(this.burstLayer);
    
    this.lyricContainer = new PIXI.Container();
    this.lyricContainer.x = this.app.screen.width / 2;
    this.lyricContainer.y = 100;
    this.app.stage.addChild(this.lyricContainer);

    this.atmosphere = this.createAtmosphere();
    this.resonance = this.createResonanceEffect();
  }

  private drawDashedLine(
    graphics: PIXI.Graphics,
    x1: number, y1: number, x2: number, y2: number,
    dashLength: number, gapLength: number
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const totalLength = Math.sqrt(dx * dx + dy * dy);
    
    const nx = dx / totalLength;
    const ny = dy / totalLength;
    
    let currentX = x1;
    let currentY = y1;
    let drawn = 0;
    
    while (drawn < totalLength) {
      const drawLen = Math.min(dashLength, totalLength - drawn);
      const endX = currentX + nx * drawLen;
      const endY = currentY + ny * drawLen;
      graphics.moveTo(currentX, currentY);
      graphics.lineTo(endX, endY);
      drawn += drawLen;
      const skipLen = Math.min(gapLength, totalLength - drawn);
      currentX = endX + nx * skipLen;
      currentY = endY + ny * skipLen;
      drawn += skipLen;
    }
  }

  private createAtmosphere(): AtmosphereState {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x0a0a1a, 0);
    overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    overlay.endFill();

    const ambientParticles: PIXI.Sprite[] = [];
    const ambientParticleData: { vx: number; vy: number; baseY: number; phase: number }[] = [];

    for (let i = 0; i < 20; i++) {
      const g = new PIXI.Graphics();
      const size = 1 + Math.random() * 2;
      g.beginFill(0xffd700, 0);
      g.drawCircle(0, 0, size);
      g.endFill();

      const texture = this.app.renderer.generateTexture(g);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.x = Math.random() * this.app.screen.width;
      sprite.y = Math.random() * this.app.screen.height;
      sprite.alpha = 0;

      ambientParticles.push(sprite);
      ambientParticleData.push({
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.2 - Math.random() * 0.3,
        baseY: sprite.y,
        phase: Math.random() * Math.PI * 2,
      });
    }

    return {
      overlay,
      currentColor: 0x0a0a1a,
      currentAlpha: 0,
      targetColor: 0x0a0a1a,
      targetAlpha: 0,
      transitionSpeed: 0.02,
      ambientParticles,
      ambientParticleData,
    };
  }

  public initAtmosphere(parent: PIXI.Container): void {
    parent.addChildAt(this.atmosphere.overlay, 1);
    this.atmosphere.ambientParticles.forEach(p => {
      parent.addChild(p);
    });
  }

  private createResonanceEffect(): ResonanceEffect {
    const baseContainer = new PIXI.Container();
    const burstContainer = new PIXI.Container();

    const pages: PIXI.Sprite[] = [];
    const pageData: { angle: number; speed: number; rotationSpeed: number; baseY: number; amplitude: number; phase: number }[] = [];

    for (let i = 0; i < 15; i++) {
      const g = new PIXI.Graphics();
      g.beginFill(0xffffee, 0.9);
      g.drawRoundedRect(-15, -20, 30, 40, 3);
      g.endFill();
      g.lineStyle(1, 0xd4a574, 0.8);
      g.drawRoundedRect(-15, -20, 30, 40, 3);
      g.lineStyle(0.5, 0x8b7355, 0.4);
      g.moveTo(-12, -14);
      g.lineTo(12, -14);
      g.moveTo(-12, -6);
      g.lineTo(12, -6);
      g.moveTo(-12, 2);
      g.lineTo(12, 2);
      g.moveTo(-12, 10);
      g.lineTo(12, 10);

      const texture = this.app.renderer.generateTexture(g);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.alpha = 0;
      sprite.scale.set(0.8 + Math.random() * 0.4);

      pages.push(sprite);
      pageData.push({
        angle: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        baseY: Math.random() * this.app.screen.height,
        amplitude: 30 + Math.random() * 50,
        phase: Math.random() * Math.PI * 2
      });

      baseContainer.addChild(sprite);
    }

    const glowRing = new PIXI.Graphics();
    glowRing.alpha = 0;
    baseContainer.addChildAt(glowRing, 0);

    return {
      baseContainer,
      burstContainer,
      pages,
      pageData,
      glowRing,
      glowIntensity: 0
    };
  }

  public initResonanceEffect(parent: PIXI.Container): void {
    this.parentContainer = parent;
    const baseIndex = parent.children.length;
    this.layerState.baseIndex = baseIndex;
    parent.addChild(this.resonance.baseContainer);
    this.app.stage.addChild(this.resonance.burstContainer);
  }

  public setResonanceIntensity(intensity: number): void {
    this.targetResonanceIntensity = Math.max(0, Math.min(1, intensity));
    this.layerState.targetZBoost = this.targetResonanceIntensity > 0.4 ? 1 : 0;
  }

  public setAtmosphereLevel(lineIndex: number, _totalLines: number): void {
    const level = Math.min(lineIndex + 1, ATMOSPHERE_PRESETS.length - 1);
    const preset = ATMOSPHERE_PRESETS[level];
    this.atmosphere.targetColor = preset.color;
    this.atmosphere.targetAlpha = preset.alpha;
  }

  private updateAtmosphere(): void {
    const atm = this.atmosphere;

    atm.currentAlpha += (atm.targetAlpha - atm.currentAlpha) * atm.transitionSpeed;

    if (atm.currentAlpha > 0.001) {
      atm.overlay.clear();
      atm.overlay.beginFill(atm.targetColor, atm.currentAlpha);
      atm.overlay.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
      atm.overlay.endFill();
    }

    const now = Date.now() / 1000;
    atm.ambientParticles.forEach((sprite, i) => {
      const data = atm.ambientParticleData[i];
      sprite.x += data.vx;
      sprite.y += data.vy;
      sprite.alpha = atm.currentAlpha * (0.3 + Math.sin(now + data.phase) * 0.2);

      if (sprite.y < -20) {
        sprite.y = this.app.screen.height + 20;
        sprite.x = Math.random() * this.app.screen.width;
      }
      if (sprite.x < -20) sprite.x = this.app.screen.width + 20;
      if (sprite.x > this.app.screen.width + 20) sprite.x = -20;
    });
  }

  public resetAtmosphere(): void {
    this.atmosphere.targetAlpha = 0;
    this.atmosphere.currentAlpha = 0;
    this.atmosphere.overlay.clear();
    this.atmosphere.ambientParticles.forEach(p => {
      p.alpha = 0;
    });
  }

  private updateResonance(): void {
    this.resonanceIntensity += (this.targetResonanceIntensity - this.resonanceIntensity) * 0.05;

    const centerX = this.app.screen.width / 2;
    const centerY = this.app.screen.height / 2;
    const now = Date.now() / 1000;

    if (this.resonanceIntensity > 0.01) {
      const glowRadius = 100 + this.resonanceIntensity * 300 + Math.sin(now * 3) * 20;
      this.resonance.glowRing.clear();
      this.resonance.glowRing.beginFill(0xffd700, this.resonanceIntensity * 0.15);
      this.resonance.glowRing.drawCircle(centerX, centerY, glowRadius);
      this.resonance.glowRing.endFill();
      this.resonance.glowRing.lineStyle(3, 0xffd700, this.resonanceIntensity * 0.5);
      this.resonance.glowRing.drawCircle(centerX, centerY, glowRadius * 0.7);
      this.resonance.glowRing.alpha = this.resonanceIntensity;
    } else {
      this.resonance.glowRing.clear();
      this.resonance.glowRing.alpha = 0;
    }

    this.resonance.pages.forEach((page, i) => {
      const data = this.resonance.pageData[i];
      data.angle += data.speed * 0.008 * (0.5 + this.resonanceIntensity);
      const radius = 150 + this.resonanceIntensity * 200 + Math.sin(now * 2 + data.phase) * data.amplitude * 0.3;
      
      page.x = centerX + Math.cos(data.angle) * radius;
      page.y = data.baseY + Math.sin(now + data.phase) * data.amplitude * 0.5;
      page.rotation += data.rotationSpeed * (1 + this.resonanceIntensity);
      page.alpha = this.resonanceIntensity * (0.4 + Math.sin(now * 2 + data.phase) * 0.3);
      page.scale.set(0.6 + this.resonanceIntensity * 0.6 + Math.sin(now * 3 + data.phase) * 0.1);
    });
  }

  private updateLayerZBoost(): void {
    const ls = this.layerState;
    ls.currentZBoost += (ls.targetZBoost - ls.currentZBoost) * 0.08;

    const shouldBeBurst = ls.currentZBoost >= 0.5;
    const isBurst = this.resonance.baseContainer.parent === this.burstLayer;

    if (shouldBeBurst && !isBurst) {
      this.promoteResonanceToBurst();
    } else if (!shouldBeBurst && isBurst) {
      this.demoteResonanceFromBurst();
    }

    this.burstLayer.alpha = Math.max(0, Math.min(1, ls.currentZBoost));
    const baseLayerDim = 1 - Math.max(0, Math.min(1, ls.currentZBoost)) * 0.3;
    this.resonance.baseContainer.alpha = baseLayerDim;
  }

  private promoteResonanceToBurst(): void {
    if (!this.parentContainer) return;

    if (this.resonance.baseContainer.parent === this.parentContainer) {
      const idx = this.parentContainer.getChildIndex(this.resonance.baseContainer);
      if (idx >= 0) this.parentContainer.removeChildAt(idx);
    }

    this.burstLayer.addChildAt(this.resonance.baseContainer, 0);

    if (this.app.stage.getChildIndex(this.burstLayer) < 0) {
      this.app.stage.addChild(this.burstLayer);
    }
    if (this.app.stage.getChildIndex(this.lyricContainer) < 0) {
      this.app.stage.addChild(this.lyricContainer);
    }
  }

  private demoteResonanceFromBurst(): void {
    if (!this.parentContainer) return;

    if (this.resonance.baseContainer.parent === this.burstLayer) {
      const idx = this.burstLayer.getChildIndex(this.resonance.baseContainer);
      if (idx >= 0) this.burstLayer.removeChildAt(idx);
    }

    const targetIndex = Math.min(this.layerState.baseIndex, this.parentContainer.children.length);
    this.parentContainer.addChildAt(this.resonance.baseContainer, targetIndex);
  }

  public resetResonance(): void {
    this.targetResonanceIntensity = 0;
    this.resonanceIntensity = 0;
    this.layerState.targetZBoost = 0;
    this.layerState.currentZBoost = 0;
    this.resonance.glowRing.clear();
    this.resonance.pages.forEach(p => {
      p.alpha = 0;
    });
    this.burstLayer.alpha = 0;
    this.resonance.baseContainer.alpha = 1;
    if (this.resonance.baseContainer.parent === this.burstLayer) {
      const idx = this.burstLayer.getChildIndex(this.resonance.baseContainer);
      if (idx >= 0) this.burstLayer.removeChildAt(idx);
    }
    if (this.parentContainer && this.resonance.baseContainer.parent !== this.parentContainer) {
      this.parentContainer.addChildAt(this.resonance.baseContainer, Math.min(this.layerState.baseIndex, this.parentContainer.children.length));
    }
  }

  public createPageNote(text: string, lane: number, noteType: NoteType = 'tap', duration?: number, noteSpeed: number = 400): PIXI.Container {
    const noteContainer = new PIXI.Container();
    
    if (noteType === 'hold' && duration) {
      const holdHeight = (duration / 1000) * noteSpeed;
      const holdBody = new PIXI.Graphics();
      const pageWidth = 80;
      
      holdBody.beginFill(this.noteTypeColors.hold, 0.4);
      holdBody.drawRoundedRect(-pageWidth / 2, -holdHeight, pageWidth, holdHeight, 5);
      holdBody.endFill();
      
      holdBody.lineStyle(2, this.laneColors[lane % LANE_COUNT], 0.8);
      holdBody.drawRoundedRect(-pageWidth / 2, -holdHeight, pageWidth, holdHeight, 5);
      
      const stripeCount = Math.floor(holdHeight / 30);
      for (let i = 0; i < stripeCount; i++) {
        holdBody.beginFill(this.laneColors[lane % LANE_COUNT], 0.2);
        holdBody.drawRect(-pageWidth / 2 + 5, -holdHeight + i * 30 + 10, pageWidth - 10, 3);
        holdBody.endFill();
      }
      
      noteContainer.addChild(holdBody);
      
      const head = new PIXI.Graphics();
      head.beginFill(0xffffff, 0.95);
      head.drawRoundedRect(-pageWidth / 2, -pageWidth * 0.35, pageWidth, pageWidth * 0.7, 5);
      head.endFill();
      head.lineStyle(2, this.noteTypeColors.hold, 0.9);
      head.drawRoundedRect(-pageWidth / 2, -pageWidth * 0.35, pageWidth, pageWidth * 0.7, 5);
      noteContainer.addChild(head);
    } else if (noteType === 'slide') {
      const slideBody = new PIXI.Graphics();
      const pageWidth = 80;
      const pageHeight = 60;
      
      slideBody.beginFill(this.noteTypeColors.slide, 0.6);
      slideBody.drawRoundedRect(-pageWidth / 2, -pageHeight / 2, pageWidth, pageHeight, 5);
      slideBody.endFill();
      
      slideBody.lineStyle(3, this.laneColors[lane % LANE_COUNT], 0.9);
      slideBody.drawRoundedRect(-pageWidth / 2, -pageHeight / 2, pageWidth, pageHeight, 5);
      
      const arrow = new PIXI.Graphics();
      arrow.beginFill(0xffffff, 0.9);
      arrow.moveTo(0, -8);
      arrow.lineTo(12, 0);
      arrow.lineTo(0, 8);
      arrow.lineTo(3, 0);
      arrow.lineTo(0, -8);
      arrow.closePath();
      arrow.endFill();
      arrow.x = pageWidth / 4;
      noteContainer.addChild(slideBody);
      noteContainer.addChild(arrow);
    } else {
      const page = new PIXI.Graphics();
      const pageWidth = 80;
      const pageHeight = 60;
      
      page.beginFill(0xffffff, 0.9);
      page.drawRoundedRect(-pageWidth / 2, -pageHeight / 2, pageWidth, pageHeight, 5);
      page.endFill();
      
      page.lineStyle(2, this.laneColors[lane % LANE_COUNT], 0.8);
      page.drawRoundedRect(-pageWidth / 2, -pageHeight / 2, pageWidth, pageHeight, 5);
      
      noteContainer.addChild(page);
    }
    
    const textStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: noteType === 'hold' ? 20 : 28,
      fill: noteType === 'tap' ? this.laneColors[lane % LANE_COUNT] : 0xffffff,
      fontWeight: 'bold',
      align: 'center'
    });
    
    const textSprite = new PIXI.Text(text, textStyle);
    textSprite.anchor.set(0.5);
    noteContainer.addChild(textSprite);
    
    return noteContainer;
  }

  public createJudgeLine(y: number): PIXI.Graphics {
    const line = new PIXI.Graphics();
    line.beginFill(0xffffff, 0.3);
    line.drawRect(0, y - 3, this.app.screen.width, 6);
    line.endFill();
    
    const glow = new PIXI.Graphics();
    glow.beginFill(0x6b9dff, 0.2);
    glow.drawRect(0, y - 15, this.app.screen.width, 30);
    glow.endFill();
    
    const container = new PIXI.Container();
    container.addChild(glow);
    container.addChild(line);
    
    return line;
  }

  public createEarlyJudgeLine(judgeLineY: number, offsetPixels: number): PIXI.Graphics {
    const y = judgeLineY - offsetPixels;
    const line = new PIXI.Graphics();
    line.lineStyle(2, 0xffd700, 0.6);
    this.drawDashedLine(line, 0, y, this.app.screen.width, y, 10, 10);
    
    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0xffd700,
      fontWeight: 'bold',
      align: 'right'
    });
    const label = new PIXI.Text('提前判定', labelStyle);
    label.anchor.set(1, 0.5);
    label.x = this.app.screen.width - 10;
    label.y = y;
    line.addChild(label);
    
    const glow = new PIXI.Graphics();
    glow.beginFill(0xffd700, 0.08);
    glow.drawRect(0, y - 8, this.app.screen.width, 16);
    glow.endFill();
    line.addChildAt(glow, 0);
    
    line.visible = false;
    line.name = 'earlyJudgeLine';
    return line;
  }

  public createBarBoundary(startY: number, endY: number, barIndex: number): PIXI.Container {
    const container = new PIXI.Container();
    
    const barBg = new PIXI.Graphics();
    barBg.beginFill(0x6b9dff, 0.05);
    barBg.drawRect(0, startY, this.app.screen.width, endY - startY);
    barBg.endFill();
    container.addChild(barBg);
    
    const topLine = new PIXI.Graphics();
    topLine.lineStyle(1, 0x6b9dff, 0.3);
    this.drawDashedLine(topLine, 0, startY, this.app.screen.width, startY, 5, 5);
    container.addChild(topLine);
    
    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 10,
      fill: 0x6b9dff,
      align: 'left'
    });
    const label = new PIXI.Text(`第${barIndex + 1}小节`, labelStyle);
    label.x = 5;
    label.y = startY + 2;
    container.addChild(label);
    
    return container;
  }

  public createLoopIndicator(startY: number, endY: number, isStart: boolean): PIXI.Graphics {
    const y = isStart ? startY : endY;
    const graphic = new PIXI.Graphics();
    
    graphic.beginFill(isStart ? 0x2ecc71 : 0xe74c3c, 0.15);
    graphic.drawRect(0, y - 4, this.app.screen.width, 8);
    graphic.endFill();
    
    graphic.lineStyle(2, isStart ? 0x2ecc71 : 0xe74c3c, 0.9);
    graphic.moveTo(0, y);
    graphic.lineTo(this.app.screen.width, y);
    
    const arrowStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: isStart ? 0x2ecc71 : 0xe74c3c,
      stroke: 0x000000,
      strokeThickness: 2
    });
    const arrowText = isStart ? '⟲ 循环起' : '循环止 ⟳';
    const arrow = new PIXI.Text(arrowText, arrowStyle);
    arrow.anchor.set(isStart ? 0 : 1, 0.5);
    arrow.x = isStart ? 10 : this.app.screen.width - 10;
    arrow.y = y;
    graphic.addChild(arrow);
    
    return graphic;
  }

  public createLaneBackground(laneCount: number): PIXI.Graphics {
    const graphics = new PIXI.Graphics();
    const laneWidth = this.app.screen.width / laneCount;
    
    for (let i = 0; i < laneCount; i++) {
      const alpha = i % 2 === 0 ? 0.05 : 0.08;
      graphics.beginFill(this.laneColors[i], alpha);
      graphics.drawRect(i * laneWidth, 0, laneWidth, this.app.screen.height);
      graphics.endFill();
      
      graphics.lineStyle(1, 0xffffff, 0.1);
      graphics.moveTo(i * laneWidth, 0);
      graphics.lineTo(i * laneWidth, this.app.screen.height);
    }
    
    return graphics;
  }

  public spawnHitEffect(x: number, y: number, lane: number, result: JudgeResult, noteType: NoteType = 'tap'): void {
    this.spawnParticles(x, y, lane, noteType);
    this.spawnJudgeText(x, y, result, noteType);
  }

  public spawnHoldEffect(x: number, y: number, lane: number): void {
    const glow = new PIXI.Graphics();
    glow.beginFill(this.laneColors[lane % LANE_COUNT], 0.3);
    glow.drawCircle(0, 0, 60);
    glow.endFill();
    
    glow.x = x;
    glow.y = y;
    
    this.container.addChild(glow);
    this.holdEffects.push({
      glow,
      lane,
      startTime: Date.now()
    });
  }

  public removeHoldEffect(lane: number): void {
    this.holdEffects = this.holdEffects.filter(effect => {
      if (effect.lane === lane) {
        this.container.removeChild(effect.glow);
        effect.glow.destroy();
        return false;
      }
      return true;
    });
  }

  public addSlideTrail(startX: number, endX: number, y: number, lane: number): void {
    const graphics = new PIXI.Graphics();
    graphics.lineStyle(4, this.laneColors[lane % LANE_COUNT], 0.8);
    graphics.moveTo(startX, y);
    graphics.lineTo(endX, y);
    
    const gradient = new PIXI.Graphics();
    gradient.beginFill(this.laneColors[lane % LANE_COUNT], 0.4);
    gradient.drawRect(Math.min(startX, endX), y - 8, Math.abs(endX - startX), 16);
    gradient.endFill();
    
    const container = new PIXI.Container();
    container.addChild(gradient);
    container.addChild(graphics);
    
    this.container.addChild(container);
    this.slideTrails.push({
      graphics: container,
      points: [{ x: startX, y }, { x: endX, y }],
      life: 30
    });
  }

  private spawnParticles(x: number, y: number, lane: number, noteType: NoteType = 'tap'): void {
    const resonanceBoost = 1 + this.resonanceIntensity * 0.8;
    const particleCount = Math.floor((noteType === 'tap' ? 12 : noteType === 'hold' ? 20 : 24) * resonanceBoost);
    const color = this.laneColors[lane % LANE_COUNT];
    
    for (let i = 0; i < particleCount; i++) {
      const graphics = new PIXI.Graphics();
      const baseSize = noteType === 'tap' ? 3 + Math.random() * 4 : 4 + Math.random() * 6;
      const size = baseSize * (1 + this.resonanceIntensity * 0.5);
      
      if (this.resonanceIntensity > 0.3) {
        graphics.beginFill(0xffd700, this.resonanceIntensity * 0.5);
        graphics.drawCircle(0, 0, size * 1.5);
        graphics.endFill();
      }
      
      graphics.beginFill(color, 1);
      graphics.drawCircle(0, 0, size);
      graphics.endFill();
      
      const texture = this.app.renderer.generateTexture(graphics);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.x = x;
      sprite.y = y;
      
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const baseSpeed = noteType === 'tap' ? 2 + Math.random() * 4 : 3 + Math.random() * 5;
      const speed = baseSpeed * resonanceBoost;
      
      const useBurstLayer = this.layerState.currentZBoost > 0.3;
      if (useBurstLayer) {
        this.burstLayer.addChild(sprite);
      } else {
        this.container.addChild(sprite);
      }
      this.particles.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: noteType === 'tap' ? 60 : 80,
        maxLife: noteType === 'tap' ? 60 : 80
      });
    }
  }

  private spawnJudgeText(x: number, y: number, result: JudgeResult, noteType: NoteType = 'tap'): void {
    const colors: Record<JudgeResult, number> = {
      perfect: 0xffd700,
      great: 0x00ff00,
      good: 0x00bfff,
      miss: 0xff4444
    };
    
    const typeLabels: Record<NoteType, string> = {
      tap: '',
      hold: 'HOLD ',
      slide: 'SLIDE '
    };
    
    const baseFontSize = noteType === 'tap' ? 32 : 36;
    const fontSize = baseFontSize * (1 + this.resonanceIntensity * 0.3);
    const strokeThickness = 3 + this.resonanceIntensity * 2;
    
    const style = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: fontSize,
      fontWeight: 'bold',
      fill: colors[result],
      stroke: 0x000000,
      strokeThickness: strokeThickness,
      align: 'center',
      dropShadow: this.resonanceIntensity > 0.2,
      dropShadowColor: this.resonanceIntensity > 0.5 ? 0xffd700 : colors[result],
      dropShadowBlur: this.resonanceIntensity * 10,
      dropShadowDistance: 0
    });
    
    const displayText = typeLabels[noteType] + result.toUpperCase();
    const text = new PIXI.Text(displayText, style);
    text.anchor.set(0.5);
    text.x = x;
    text.y = y - 50;
    
    const useBurstLayer = this.layerState.currentZBoost > 0.3;
    if (useBurstLayer) {
      this.burstLayer.addChild(text);
    } else {
      this.container.addChild(text);
    }
    this.judgeEffects.push({
      text,
      life: noteType === 'tap' ? 45 : 55,
      maxLife: noteType === 'tap' ? 45 : 55
    });
  }

  public addLyricChar(char: string, index: number, hit: boolean): void {
    const style = hit
      ? new PIXI.TextStyle({
          fontFamily: 'serif',
          fontSize: 30,
          fill: 0xffd700,
          fontWeight: 'bold',
          stroke: 0x8b4513,
          strokeThickness: 2,
          dropShadow: true,
          dropShadowColor: 0xffd700,
          dropShadowBlur: 8
        })
      : new PIXI.TextStyle({
          fontFamily: 'serif',
          fontSize: 30,
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
    
    this.lyricContainer.addChild(text);
    this.litCharacters.push(text);
    this.charCount++;
    
    this.repositionLyrics();
    this.animateCharacterIn(text, index);
  }

  private repositionLyrics(): void {
    const charsPerLine = 8;
    const charSpacing = 34;
    const lineHeight = 42;
    
    this.litCharacters.forEach((text, index) => {
      const lineIndex = Math.floor(index / charsPerLine);
      const colIndex = index % charsPerLine;
      const lineLen = Math.min(charsPerLine, this.charCount - lineIndex * charsPerLine);
      const lineStartX = -(lineLen - 1) * charSpacing / 2;
      
      text.x = lineStartX + colIndex * charSpacing;
      text.y = lineIndex * lineHeight;
    });
  }

  private animateCharacterIn(text: PIXI.Text, index: number): void {
    const startTime = Date.now();
    const duration = 500;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      text.scale.set(eased);
      text.alpha = eased;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    setTimeout(animate, index * 50);
  }

  public update(_deltaTime: number): void {
    this.updateAtmosphere();
    this.updateLayerZBoost();
    this.updateResonance();

    this.particles = this.particles.filter(particle => {
      particle.sprite.x += particle.vx;
      particle.sprite.y += particle.vy;
      particle.vy += 0.15;
      particle.life--;
      
      const alpha = particle.life / particle.maxLife;
      particle.sprite.alpha = alpha;
      particle.sprite.scale.set(alpha);
      
      if (particle.life <= 0) {
        this.container.removeChild(particle.sprite);
        particle.sprite.texture.destroy();
        return false;
      }
      return true;
    });
    
    this.judgeEffects = this.judgeEffects.filter(effect => {
      effect.life--;
      effect.text.y -= 1.5;
      effect.text.alpha = effect.life / effect.maxLife;
      
      const scale = 1 + (1 - effect.life / effect.maxLife) * 0.3;
      effect.text.scale.set(scale);
      
      if (effect.life <= 0) {
        this.container.removeChild(effect.text);
        return false;
      }
      return true;
    });

    this.holdEffects.forEach(effect => {
      const elapsed = Date.now() - effect.startTime;
      const pulse = 0.8 + Math.sin(elapsed / 100) * 0.2;
      effect.glow.scale.set(pulse);
      effect.glow.alpha = 0.3 + Math.sin(elapsed / 80) * 0.1;
    });

    this.slideTrails = this.slideTrails.filter(trail => {
      trail.life--;
      trail.graphics.alpha = trail.life / 30;
      
      if (trail.life <= 0) {
        this.container.removeChild(trail.graphics);
        trail.graphics.destroy();
        return false;
      }
      return true;
    });
  }

  public createBackground(): PIXI.Container {
    const bgContainer = new PIXI.Container();
    
    const gradient = new PIXI.Graphics();
    gradient.beginFill(0x0a0a1a);
    gradient.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    gradient.endFill();
    bgContainer.addChild(gradient);
    
    const starCount = 100;
    for (let i = 0; i < starCount; i++) {
      const star = new PIXI.Graphics();
      star.beginFill(0xffffff, Math.random() * 0.8 + 0.2);
      star.drawCircle(0, 0, Math.random() * 2 + 1);
      star.endFill();
      star.x = Math.random() * this.app.screen.width;
      star.y = Math.random() * this.app.screen.height;
      bgContainer.addChild(star);
    }
    
    const island = this.createFloatingIsland();
    island.x = this.app.screen.width / 2;
    island.y = this.app.screen.height - 150;
    bgContainer.addChild(island);
    
    return bgContainer;
  }

  private createFloatingIsland(): PIXI.Container {
    const island = new PIXI.Container();
    
    const islandBody = new PIXI.Graphics();
    islandBody.beginFill(0x2d5016);
    islandBody.moveTo(-150, 0);
    islandBody.quadraticCurveTo(-100, 50, 0, 60);
    islandBody.quadraticCurveTo(100, 50, 150, 0);
    islandBody.lineTo(120, -20);
    islandBody.lineTo(-120, -20);
    islandBody.closePath();
    islandBody.endFill();
    
    islandBody.beginFill(0x3d7016);
    islandBody.moveTo(-120, -20);
    islandBody.lineTo(120, -20);
    islandBody.lineTo(100, -40);
    islandBody.lineTo(-100, -40);
    islandBody.closePath();
    islandBody.endFill();
    
    island.addChild(islandBody);
    
    const house = new PIXI.Graphics();
    house.beginFill(0x8b4513);
    house.drawRect(-30, -80, 60, 50);
    house.endFill();
    
    house.beginFill(0x654321);
    house.moveTo(-40, -80);
    house.lineTo(0, -110);
    house.lineTo(40, -80);
    house.closePath();
    house.endFill();
    
    house.beginFill(0xffd700, 0.8);
    house.drawRect(-10, -60, 20, 30);
    house.endFill();
    
    island.addChild(house);
    
    const glow = new PIXI.Graphics();
    glow.beginFill(0xffd700, 0.1);
    glow.drawEllipse(0, 0, 180, 80);
    glow.endFill();
    island.addChildAt(glow, 0);
    
    return island;
  }

  public createComboDisplay(): PIXI.Text {
    const style = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 48,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 4,
      align: 'center'
    });
    
    const text = new PIXI.Text('0 COMBO', style);
    text.anchor.set(0.5);
    text.x = this.app.screen.width / 2;
    text.y = this.app.screen.height / 2 - 50;
    text.visible = false;
    
    return text;
  }

  public updateComboDisplay(text: PIXI.Text, combo: number): void {
    if (combo > 0) {
      text.text = `${combo} COMBO`;
      text.visible = true;
      
      const comboScale = 1 + Math.min(combo * 0.01, 0.3);
      const resonanceScale = 1 + this.resonanceIntensity * 0.2;
      text.scale.set(comboScale * resonanceScale);
      
      if (this.resonanceIntensity > 0.3) {
        text.style.fill = 0xffd700;
        text.style.dropShadow = true;
        text.style.dropShadowColor = 0xffd700;
        text.style.dropShadowBlur = 10 + this.resonanceIntensity * 15;
        text.style.dropShadowDistance = 0;
      } else if (combo >= 50) {
        text.style.fill = 0xffd700;
        text.style.dropShadow = false;
      } else if (combo >= 20) {
        text.style.fill = 0xff6b9d;
        text.style.dropShadow = false;
      } else {
        text.style.fill = 0xffffff;
        text.style.dropShadow = false;
      }
    } else {
      text.visible = false;
    }
  }

  public clearLitCharacters(): void {
    this.litCharacters.forEach(text => {
      this.lyricContainer.removeChild(text);
      text.destroy();
    });
    this.litCharacters = [];
    this.charCount = 0;
  }

  public clearHoldEffects(): void {
    this.holdEffects.forEach(effect => {
      this.container.removeChild(effect.glow);
      effect.glow.destroy();
    });
    this.holdEffects = [];
  }

  public clearSlideTrails(): void {
    this.slideTrails.forEach(trail => {
      this.container.removeChild(trail.graphics);
      trail.graphics.destroy();
    });
    this.slideTrails = [];
  }

  public resetAllEffects(): void {
    this.clearLitCharacters();
    this.clearHoldEffects();
    this.clearSlideTrails();
    this.resetAtmosphere();
    this.resetResonance();
  }

  public destroy(): void {
    this.particles.forEach(p => {
      p.sprite.texture.destroy();
      p.sprite.destroy();
    });
    this.particles = [];
    
    this.judgeEffects.forEach(e => {
      e.text.destroy();
    });
    this.judgeEffects = [];
    
    this.resonance.pages.forEach(p => {
      p.texture.destroy();
      p.destroy();
    });
    this.resonance.glowRing.destroy();
    this.resonance.baseContainer.destroy();
    this.resonance.burstContainer.destroy();
    
    this.clearHoldEffects();
    this.clearSlideTrails();
    this.clearLitCharacters();
    this.container.destroy();
    this.burstLayer.destroy();
    this.lyricContainer.destroy();
  }
}
