import * as PIXI from 'pixi.js';
import { JudgeResult, LANE_COUNT } from '../types';

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

export class EffectRenderer {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private particles: Particle[] = [];
  private judgeEffects: JudgeEffect[] = [];
  private laneColors: number[] = [0xff6b9d, 0x6bff9d, 0x6b9dff, 0xffd93d];
  private litCharacters: PIXI.Text[] = [];
  private lyricContainer: PIXI.Container;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.app.stage.addChild(this.container);
    
    this.lyricContainer = new PIXI.Container();
    this.lyricContainer.x = this.app.screen.width / 2;
    this.lyricContainer.y = 100;
    this.app.stage.addChild(this.lyricContainer);
  }

  public createPageNote(text: string, lane: number): PIXI.Container {
    const noteContainer = new PIXI.Container();
    
    const page = new PIXI.Graphics();
    const pageWidth = 80;
    const pageHeight = 60;
    
    page.beginFill(0xffffff, 0.9);
    page.drawRoundedRect(-pageWidth / 2, -pageHeight / 2, pageWidth, pageHeight, 5);
    page.endFill();
    
    page.lineStyle(2, this.laneColors[lane % LANE_COUNT], 0.8);
    page.drawRoundedRect(-pageWidth / 2, -pageHeight / 2, pageWidth, pageHeight, 5);
    
    noteContainer.addChild(page);
    
    const textStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fill: this.laneColors[lane % LANE_COUNT],
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

  public spawnHitEffect(x: number, y: number, lane: number, result: JudgeResult): void {
    this.spawnParticles(x, y, lane);
    this.spawnJudgeText(x, y, result);
  }

  private spawnParticles(x: number, y: number, lane: number): void {
    const particleCount = 12;
    const color = this.laneColors[lane % LANE_COUNT];
    
    for (let i = 0; i < particleCount; i++) {
      const graphics = new PIXI.Graphics();
      graphics.beginFill(color, 1);
      graphics.drawCircle(0, 0, 3 + Math.random() * 4);
      graphics.endFill();
      
      const texture = this.app.renderer.generateTexture(graphics);
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.x = x;
      sprite.y = y;
      
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      
      this.container.addChild(sprite);
      this.particles.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 60,
        maxLife: 60
      });
    }
  }

  private spawnJudgeText(x: number, y: number, result: JudgeResult): void {
    const colors: Record<JudgeResult, number> = {
      perfect: 0xffd700,
      great: 0x00ff00,
      good: 0x00bfff,
      miss: 0xff4444
    };
    
    const style = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 32,
      fontWeight: 'bold',
      fill: colors[result],
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center'
    });
    
    const text = new PIXI.Text(result.toUpperCase(), style);
    text.anchor.set(0.5);
    text.x = x;
    text.y = y - 50;
    
    this.container.addChild(text);
    this.judgeEffects.push({
      text,
      life: 45,
      maxLife: 45
    });
  }

  public addLitCharacter(char: string, index: number): void {
    const style = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 36,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      dropShadow: true,
      dropShadowColor: 0xffd700,
      dropShadowBlur: 10
    });
    
    const text = new PIXI.Text(char, style);
    text.anchor.set(0.5);
    text.x = index * 40 - (this.litCharacters.length * 40) / 2;
    text.y = 0;
    text.scale.set(0);
    text.alpha = 0;
    
    this.lyricContainer.addChild(text);
    this.litCharacters.push(text);
    
    this.repositionLyrics();
    this.animateCharacterIn(text, index);
  }

  private repositionLyrics(): void {
    const totalWidth = this.litCharacters.length * 40;
    this.litCharacters.forEach((text, index) => {
      text.x = index * 40 - totalWidth / 2 + 20;
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
      
      const scale = 1 + Math.min(combo * 0.01, 0.3);
      text.scale.set(scale);
      
      if (combo >= 50) {
        text.style.fill = 0xffd700;
      } else if (combo >= 20) {
        text.style.fill = 0xff6b9d;
      } else {
        text.style.fill = 0xffffff;
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
    
    this.clearLitCharacters();
    this.container.destroy();
    this.lyricContainer.destroy();
  }
}
