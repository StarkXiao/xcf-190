import * as PIXI from 'pixi.js';
import { ScoreData, CharHitRecord, NoteType, NoteTypeStats } from '../types';

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  tap: '点击',
  hold: '长按',
  slide: '滑键'
};

const NOTE_TYPE_COLORS: Record<NoteType, number> = {
  tap: 0x6b9dff,
  hold: 0x9b59b6,
  slide: 0xe74c3c
};

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

  public show(
    score: ScoreData,
    _poemLines: string[],
    charRecords: CharHitRecord[],
    _songId?: string,
    _difficulty?: string,
    isNewRecord?: boolean
  ): void {
    this.container.visible = true;
    this.container.removeChildren();
    
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.85);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    this.container.addChild(mask);
    
    this.createPoemDisplay(charRecords);
    this.createScoreDisplay(score);
    this.createTypeStatsDisplay(score.typeStats);
    if (isNewRecord) {
      this.createNewRecordBadge();
    }
    this.createRestartButton();
    this.animateIn();
  }

  private createNewRecordBadge(): void {
    const badgeContainer = new PIXI.Container();
    badgeContainer.x = this.app.screen.width / 2;
    badgeContainer.y = this.app.screen.height / 2 - 10;
    badgeContainer.rotation = -0.2;

    const badgeBg = new PIXI.Graphics();
    badgeBg.beginFill(0xffd700);
    badgeBg.lineStyle(4, 0xff8c00, 1);
    badgeBg.drawRoundedRect(-100, -25, 200, 50, 10);
    badgeBg.endFill();
    badgeContainer.addChild(badgeBg);

    const badgeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0x8b4513,
      stroke: 0xffffff,
      strokeThickness: 2,
      align: 'center'
    });

    const badgeText = new PIXI.Text('★ NEW RECORD! ★', badgeStyle);
    badgeText.anchor.set(0.5);
    badgeContainer.addChild(badgeText);

    badgeContainer.scale.set(0);
    badgeContainer.alpha = 0;
    this.container.addChild(badgeContainer);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 800;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        badgeContainer.scale.set(eased);
        badgeContainer.alpha = eased;
        badgeContainer.rotation = -0.2 + Math.sin(elapsed / 100) * 0.05;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    }, 1500);
  }

  private createPoemDisplay(charRecords: CharHitRecord[]): void {
    const poemContainer = new PIXI.Container();
    poemContainer.x = this.app.screen.width / 2;
    poemContainer.y = 120;
    
    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 32,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      align: 'center'
    });
    
    const title = new PIXI.Text('~ 演奏结果 ~', titleStyle);
    title.anchor.set(0.5);
    title.y = -50;
    poemContainer.addChild(title);
    
    const typeHintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0x888888,
      align: 'center'
    });
    
    const typeHint = new PIXI.Text('[蓝=点击 紫=长按 红=滑键]', typeHintStyle);
    typeHint.anchor.set(0.5);
    typeHint.y = -20;
    poemContainer.addChild(typeHint);
    
    const charsPerLine = 8;
    const charSpacing = 36;
    const lineHeight = 46;
    
    for (let i = 0; i < charRecords.length; i++) {
      const record = charRecords[i];
      const lineIndex = Math.floor(i / charsPerLine);
      const colIndex = i % charsPerLine;
      const lineCharCount = Math.min(charsPerLine, charRecords.length - lineIndex * charsPerLine);
      const lineStartX = -(lineCharCount - 1) * charSpacing / 2;
      
      const typeColor = NOTE_TYPE_COLORS[record.noteType];
      const charStyle = record.hit
        ? new PIXI.TextStyle({
            fontFamily: 'serif',
            fontSize: 26,
            fill: 0xffd700,
            fontWeight: 'bold',
            stroke: typeColor,
            strokeThickness: 3,
            dropShadow: true,
            dropShadowColor: typeColor,
            dropShadowBlur: 6,
            align: 'center'
          })
        : new PIXI.TextStyle({
            fontFamily: 'serif',
            fontSize: 26,
            fill: 0x555555,
            stroke: typeColor,
            strokeThickness: 2,
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
      
      this.animateCharReveal(charText, record.hit, 500 + i * 80);
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
    const startY = this.app.screen.height / 2 + 20;
    
    const ratingStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 100,
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
      fontSize: 28,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    
    const scoreText = new PIXI.Text(`得分: ${score.score}`, scoreStyle);
    scoreText.anchor.set(0.5);
    scoreText.x = this.app.screen.width / 2;
    scoreText.y = startY + 70;
    scoreText.alpha = 0;
    this.container.addChild(scoreText);
    setTimeout(() => this.animateFadeIn(scoreText), 1200);
    
    const statsContainer = new PIXI.Container();
    statsContainer.x = this.app.screen.width / 2;
    statsContainer.y = startY + 115;
    
    const statStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
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
      text.x = (index - 2) * 90;
      text.alpha = 0;
      statsContainer.addChild(text);
      setTimeout(() => this.animateFadeIn(text), 1400 + index * 100);
    });
    
    this.container.addChild(statsContainer);
  }

  private createTypeStatsDisplay(typeStats: NoteTypeStats): void {
    const statsY = this.app.screen.height / 2 + 170;
    
    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    
    const title = new PIXI.Text('─ 分型统计 ─', titleStyle);
    title.anchor.set(0.5);
    title.x = this.app.screen.width / 2;
    title.y = statsY;
    title.alpha = 0;
    this.container.addChild(title);
    setTimeout(() => this.animateFadeIn(title), 1800);
    
    const types: NoteType[] = ['tap', 'hold', 'slide'];
    types.forEach((type, index) => {
      const stats = typeStats[type];
      const total = stats.perfect + stats.great + stats.good + stats.miss;
      
      if (total === 0) return;
      
      const container = new PIXI.Container();
      container.x = this.app.screen.width / 2;
      container.y = statsY + 40 + index * 55;
      
      const typeColor = NOTE_TYPE_COLORS[type];
      
      const typeBg = new PIXI.Graphics();
      typeBg.beginFill(typeColor, 0.15);
      typeBg.lineStyle(2, typeColor, 0.5);
      typeBg.drawRoundedRect(-280, -22, 560, 44, 8);
      typeBg.endFill();
      container.addChild(typeBg);
      
      const typeLabelStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 16,
        fontWeight: 'bold',
        fill: typeColor,
        stroke: 0x000000,
        strokeThickness: 2,
        align: 'left'
      });
      
      const typeLabel = new PIXI.Text(`${NOTE_TYPE_LABELS[type]} (${total})`, typeLabelStyle);
      typeLabel.anchor.set(0, 0.5);
      typeLabel.x = -270;
      container.addChild(typeLabel);
      
      const accuracy = ((stats.perfect * 100 + stats.great * 70 + stats.good * 30) / (total * 100)) * 100;
      const accuracyText = `${accuracy.toFixed(1)}%`;
      const accuracyStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: accuracy >= 90 ? 0xffd700 : accuracy >= 70 ? 0x6bff9d : 0xff6b6b,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'right'
      });
      
      const accuracyLabel = new PIXI.Text(accuracyText, accuracyStyle);
      accuracyLabel.anchor.set(1, 0.5);
      accuracyLabel.x = 270;
      container.addChild(accuracyLabel);
      
      const barBg = new PIXI.Graphics();
      barBg.beginFill(0x333333, 0.8);
      barBg.drawRoundedRect(-120, -8, 240, 16, 4);
      barBg.endFill();
      container.addChild(barBg);
      
      const barWidth = 240;
      const perfectWidth = (stats.perfect / total) * barWidth;
      const greatWidth = (stats.great / total) * barWidth;
      const goodWidth = (stats.good / total) * barWidth;
      
      let currentX = -120;
      
      if (perfectWidth > 0) {
        const perfectBar = new PIXI.Graphics();
        perfectBar.beginFill(0xffd700, 1);
        perfectBar.drawRoundedRect(currentX, -8, perfectWidth, 16, 4);
        perfectBar.endFill();
        container.addChild(perfectBar);
        currentX += perfectWidth;
      }
      
      if (greatWidth > 0) {
        const greatBar = new PIXI.Graphics();
        greatBar.beginFill(0x00ff00, 1);
        greatBar.drawRoundedRect(currentX, -8, greatWidth, 16, 4);
        greatBar.endFill();
        container.addChild(greatBar);
        currentX += greatWidth;
      }
      
      if (goodWidth > 0) {
        const goodBar = new PIXI.Graphics();
        goodBar.beginFill(0x00bfff, 1);
        goodBar.drawRoundedRect(currentX, -8, goodWidth, 16, 4);
        goodBar.endFill();
        container.addChild(goodBar);
      }
      
      const statNumbersStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fill: 0x888888,
        align: 'left'
      });
      
      const statNumbers = `P:${stats.perfect} G:${stats.great} O:${stats.good} M:${stats.miss}`;
      const statNumbersLabel = new PIXI.Text(statNumbers, statNumbersStyle);
      statNumbersLabel.anchor.set(0, 0.5);
      statNumbersLabel.x = -120;
      statNumbersLabel.y = 18;
      container.addChild(statNumbersLabel);
      
      container.alpha = 0;
      this.container.addChild(container);
      setTimeout(() => this.animateFadeIn(container), 2000 + index * 150);
    });
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
    buttonContainer.y = this.app.screen.height - 60;
    
    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x6b9dff);
    buttonBg.drawRoundedRect(-100, -28, 200, 56, 10);
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
      fontSize: 22,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    
    const buttonText = new PIXI.Text('再来一次', buttonStyle);
    buttonText.anchor.set(0.5);
    buttonContainer.addChild(buttonText);
    
    buttonContainer.alpha = 0;
    this.container.addChild(buttonContainer);
    
    setTimeout(() => this.animateFadeIn(buttonContainer), 2800);
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
