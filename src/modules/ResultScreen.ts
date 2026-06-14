import * as PIXI from 'pixi.js';
import { ScoreData, CharHitRecord } from '../types';

export class ResultScreen {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private onRestartCallback?: () => void;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.container.visible = false;
    this.app.stage.addChild(this.container);
  }

  public show(score: ScoreData, _poemLines: string[], charRecords: CharHitRecord[]): void {
    this.container.visible = true;
    this.container.removeChildren();
    
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.85);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    this.container.addChild(mask);
    
    this.createPoemDisplay(charRecords);
    this.createScoreDisplay(score);
    this.createRestartButton();
    this.animateIn();
  }

  private createPoemDisplay(charRecords: CharHitRecord[]): void {
    const poemContainer = new PIXI.Container();
    poemContainer.x = this.app.screen.width / 2;
    poemContainer.y = 150;
    
    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 36,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      align: 'center'
    });
    
    const title = new PIXI.Text('~ 告白诗篇 ~', titleStyle);
    title.anchor.set(0.5);
    title.y = -60;
    poemContainer.addChild(title);
    
    const charsPerLine = 8;
    const charSpacing = 36;
    const lineHeight = 50;
    
    for (let i = 0; i < charRecords.length; i++) {
      const record = charRecords[i];
      const lineIndex = Math.floor(i / charsPerLine);
      const colIndex = i % charsPerLine;
      const lineCharCount = Math.min(charsPerLine, charRecords.length - lineIndex * charsPerLine);
      const lineStartX = -(lineCharCount - 1) * charSpacing / 2;
      
      const charStyle = record.hit
        ? new PIXI.TextStyle({
            fontFamily: 'serif',
            fontSize: 28,
            fill: 0xffd700,
            fontWeight: 'bold',
            stroke: 0x8b4513,
            strokeThickness: 2,
            dropShadow: true,
            dropShadowColor: 0xffd700,
            dropShadowBlur: 8,
            align: 'center'
          })
        : new PIXI.TextStyle({
            fontFamily: 'serif',
            fontSize: 28,
            fill: 0x555555,
            stroke: 0x333333,
            strokeThickness: 1,
            align: 'center'
          });
      
      const displayChar = record.hit ? record.char : '＿';
      const charText = new PIXI.Text(displayChar, charStyle);
      charText.anchor.set(0.5);
      charText.x = lineStartX + colIndex * charSpacing;
      charText.y = lineIndex * lineHeight;
      charText.alpha = 0;
      charText.scale.set(0);
      poemContainer.addChild(charText);
      
      this.animateCharReveal(charText, record.hit, 500 + i * 120);
    }
    
    this.container.addChild(poemContainer);
  }

  private animateCharReveal(text: PIXI.Text, hit: boolean, delay: number): void {
    setTimeout(() => {
      const startTime = Date.now();
      const duration = hit ? 600 : 400;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        if (hit) {
          const eased = 1 - Math.pow(1 - progress, 3);
          text.scale.set(eased);
          text.alpha = eased;
          if (progress >= 0.5 && progress < 0.55) {
            text.scale.set(1.2);
          }
        } else {
          text.alpha = progress * 0.7;
          text.scale.set(progress * 0.9);
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          if (hit) {
            text.scale.set(1);
            text.alpha = 1;
          } else {
            text.scale.set(0.9);
            text.alpha = 0.7;
          }
        }
      };
      
      animate();
    }, delay);
  }

  private createScoreDisplay(score: ScoreData): void {
    const startY = this.app.screen.height / 2 + 50;
    
    const ratingStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 120,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 6,
      align: 'center'
    });
    
    const rating = new PIXI.Text(score.rating, ratingStyle);
    rating.anchor.set(0.5);
    rating.x = this.app.screen.width / 2;
    rating.y = startY;
    rating.scale.set(0);
    this.container.addChild(rating);
    
    setTimeout(() => this.animateRatingIn(rating), 800);
    
    const scoreStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 32,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    
    const scoreText = new PIXI.Text(`得分: ${score.score}`, scoreStyle);
    scoreText.anchor.set(0.5);
    scoreText.x = this.app.screen.width / 2;
    scoreText.y = startY + 80;
    scoreText.alpha = 0;
    this.container.addChild(scoreText);
    setTimeout(() => this.animateFadeIn(scoreText), 1200);
    
    const statsContainer = new PIXI.Container();
    statsContainer.x = this.app.screen.width / 2;
    statsContainer.y = startY + 130;
    
    const statStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 20,
      fill: 0xaaaaaa,
      stroke: 0x000000,
      strokeThickness: 1,
      align: 'center'
    });
    
    const stats = [
      `Perfect: ${score.perfect}`,
      `Great: ${score.great}`,
      `Good: ${score.good}`,
      `Miss: ${score.miss}`,
      `Max Combo: ${score.maxCombo}`
    ];
    
    stats.forEach((stat, index) => {
      const text = new PIXI.Text(stat, statStyle);
      text.anchor.set(0.5);
      text.x = (index - 2) * 100;
      text.alpha = 0;
      statsContainer.addChild(text);
      setTimeout(() => this.animateFadeIn(text), 1400 + index * 100);
    });
    
    this.container.addChild(statsContainer);
  }

  private animateRatingIn(rating: PIXI.Text): void {
    const startTime = Date.now();
    const duration = 600;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const scale = Math.sin(progress * Math.PI) * 0.5 + 0.5;
      const finalScale = 1 + (1 - progress) * 0.3;
      
      rating.scale.set(scale * finalScale);
      rating.rotation = (1 - progress) * 0.3;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  private animateFadeIn(container: PIXI.Container | PIXI.Text, delay: number = 0): void {
    setTimeout(() => {
      const startTime = Date.now();
      const duration = 500;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        container.alpha = progress;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    }, delay);
  }

  private createRestartButton(): void {
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = this.app.screen.width / 2;
    buttonContainer.y = this.app.screen.height - 100;
    
    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x6b9dff);
    buttonBg.drawRoundedRect(-100, -30, 200, 60, 10);
    buttonBg.endFill();
    
    buttonBg.interactive = true;
    buttonBg.cursor = 'pointer';
    
    buttonBg.on('pointerdown', () => {
      this.hide();
      if (this.onRestartCallback) {
        this.onRestartCallback();
      }
    });
    
    buttonContainer.addChild(buttonBg);
    
    const buttonStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    
    const buttonText = new PIXI.Text('再来一次', buttonStyle);
    buttonText.anchor.set(0.5);
    buttonContainer.addChild(buttonText);
    
    buttonContainer.alpha = 0;
    this.container.addChild(buttonContainer);
    
    setTimeout(() => this.animateFadeIn(buttonContainer), 2000);
  }

  private animateIn(): void {
    this.container.alpha = 0;
    const startTime = Date.now();
    const duration = 500;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      this.container.alpha = progress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  public setOnRestartCallback(callback: () => void): void {
    this.onRestartCallback = callback;
  }

  public hide(): void {
    this.container.visible = false;
    this.container.removeChildren();
  }

  public destroy(): void {
    this.container.destroy();
  }
}
