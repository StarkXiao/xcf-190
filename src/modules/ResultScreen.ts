import * as PIXI from 'pixi.js';
import { ScoreData, CharHitRecord, NoteType, NoteTypeStats, Difficulty, BestScore } from '../types';
import { ScoreStorage } from './ScoreStorage';

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

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难'
};

const RATING_COLORS: Record<string, number> = {
  S: 0xffd700,
  A: 0x6bff9d,
  B: 0x6b9dff,
  C: 0xff9d5b,
  D: 0xff6b6b
};

export class ResultScreen {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private onRestartCallback?: () => void;
  private onBackToStartCallback?: () => void;

  private miniLeaderboardPanel: PIXI.Container;
  private miniLeaderboardVisible: boolean = false;

  private animationComplete: boolean = false;
  private animationCompleteTimer?: number;
  private pendingAction?: 'restart' | 'back';
  private isTransitioningOut: boolean = false;

  private readonly TOTAL_ANIMATION_DURATION = 3200;
  private readonly TRANSITION_OUT_DURATION = 400;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.container.visible = false;
    this.miniLeaderboardPanel = new PIXI.Container();
    this.app.stage.addChild(this.container);
  }

  public show(
    score: ScoreData,
    _poemLines: string[],
    charRecords: CharHitRecord[],
    songId?: string,
    difficulty?: Difficulty,
    isNewRecord?: boolean,
    previousBest?: BestScore | null,
    accuracy: number = 0,
    isPractice: boolean = false,
    practiceSpeed: number = 1.0
  ): void {
    this.animationComplete = false;
    this.pendingAction = undefined;
    this.isTransitioningOut = false;
    if (this.animationCompleteTimer) {
      clearTimeout(this.animationCompleteTimer);
      this.animationCompleteTimer = undefined;
    }

    this.container.visible = true;
    this.container.removeChildren();
    this.miniLeaderboardVisible = false;
    this.miniLeaderboardPanel.removeChildren();

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.85);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    this.container.addChild(mask);

    this.createPoemDisplay(charRecords);
    this.createScoreDisplay(score, accuracy, previousBest, isPractice, practiceSpeed);
    this.createTypeStatsDisplay(score.typeStats);
    if (isNewRecord && !isPractice) {
      this.createNewRecordBadge();
    }
    if (isPractice) {
      this.createPracticeModeBadge(practiceSpeed);
    }
    this.createSongInfoFooter(songId, difficulty, isPractice);
    this.createMiniLeaderboardButton(songId, difficulty);
    this.createRestartButton();
    this.createBackToStartButton();
    this.container.addChild(this.miniLeaderboardPanel);
    this.animateIn();

    this.animationCompleteTimer = window.setTimeout(() => {
      this.animationComplete = true;
      this.animationCompleteTimer = undefined;
      if (this.pendingAction && !this.isTransitioningOut) {
        this.executePendingAction();
      }
    }, this.TOTAL_ANIMATION_DURATION);
  }

  private createPracticeModeBadge(practiceSpeed: number): void {
    const badgeContainer = new PIXI.Container();
    badgeContainer.x = this.app.screen.width / 2;
    badgeContainer.y = 70;

    const badgeBg = new PIXI.Graphics();
    badgeBg.beginFill(0xff6b9d, 0.9);
    badgeBg.lineStyle(3, 0xffd700, 0.8);
    badgeBg.drawRoundedRect(-160, -22, 320, 44, 12);
    badgeBg.endFill();
    badgeContainer.addChild(badgeBg);

    const badgeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });

    const badgeText = new PIXI.Text(
      `🎯 练习模式  (速度 ${practiceSpeed.toFixed(2)}x)  ·  成绩不计入记录`,
      badgeStyle
    );
    badgeText.anchor.set(0.5);
    badgeContainer.addChild(badgeText);

    badgeContainer.scale.set(0);
    badgeContainer.alpha = 0;
    this.container.addChild(badgeContainer);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 600;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        badgeContainer.scale.set(eased);
        badgeContainer.alpha = eased;
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }, 300);
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
    poemContainer.y = 110;

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      align: 'center'
    });

    const title = new PIXI.Text('~ 演奏结果 ~', titleStyle);
    title.anchor.set(0.5);
    title.y = -40;
    poemContainer.addChild(title);

    const typeHintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'center'
    });

    const typeHint = new PIXI.Text('[蓝=点击 紫=长按 红=滑键]', typeHintStyle);
    typeHint.anchor.set(0.5);
    typeHint.y = -14;
    poemContainer.addChild(typeHint);

    const charsPerLine = 8;
    const charSpacing = 34;
    const lineHeight = 42;

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
            fontSize: 24,
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
            fontSize: 24,
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

      this.animateCharReveal(charText, record.hit, 400 + i * 60);
    }

    this.container.addChild(poemContainer);
  }

  private animateCharReveal(text: PIXI.Text, hit: boolean, delay: number): void {
    setTimeout(() => {
      const startTime = Date.now();
      const duration = hit ? 500 : 350;

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

  private createScoreDisplay(
    score: ScoreData,
    accuracy: number,
    previousBest?: BestScore | null,
    isPractice: boolean = false,
    practiceSpeed: number = 1.0
  ): void {
    const startY = this.app.screen.height / 2 + 10;

    const ratingStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 90,
      fontWeight: 'bold',
      fill: RATING_COLORS[score.rating] || 0xffffff,
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

    setTimeout(() => this.animateRatingIn(rating), 700);

    const scoreStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 26,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });

    const scoreText = new PIXI.Text(`得分: ${score.score}`, scoreStyle);
    scoreText.anchor.set(0.5);
    scoreText.x = this.app.screen.width / 2;
    scoreText.y = startY + 62;
    scoreText.alpha = 0;
    this.container.addChild(scoreText);
    setTimeout(() => this.animateFadeIn(scoreText), 1000);

    const accColor = accuracy >= 95 ? 0xffd700 : accuracy >= 85 ? 0x6bff9d : accuracy >= 70 ? 0x6b9dff : 0xff6b6b;
    const accStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: accColor,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    const accText = new PIXI.Text(`准确率: ${accuracy.toFixed(2)}%`, accStyle);
    accText.anchor.set(0.5);
    accText.x = this.app.screen.width / 2;
    accText.y = startY + 94;
    accText.alpha = 0;
    this.container.addChild(accText);
    setTimeout(() => this.animateFadeIn(accText), 1050);

    if (!isPractice) {
      if (previousBest && previousBest.score < score.score) {
        const scoreDiff = score.score - previousBest.score;
        const accDiff = accuracy - previousBest.accuracy;
        const improveStyle = new PIXI.TextStyle({
          fontFamily: 'sans-serif',
          fontSize: 14,
          fontWeight: 'bold',
          fill: 0x6bff9d,
          stroke: 0x000000,
          strokeThickness: 1,
          align: 'center'
        });
        const improveText = new PIXI.Text(
          `↑ 历史最佳 +${scoreDiff}分  +${accDiff >= 0 ? accDiff.toFixed(1) : accDiff.toFixed(1)}%`,
          improveStyle
        );
        improveText.anchor.set(0.5);
        improveText.x = this.app.screen.width / 2;
        improveText.y = startY + 122;
        improveText.alpha = 0;
        this.container.addChild(improveText);
        setTimeout(() => this.animateFadeIn(improveText), 1300);
      } else if (previousBest && previousBest.score >= score.score) {
        const scoreDiff = previousBest.score - score.score;
        const gapStyle = new PIXI.TextStyle({
          fontFamily: 'sans-serif',
          fontSize: 13,
          fill: 0xaaaaaa,
          stroke: 0x000000,
          strokeThickness: 1,
          align: 'center'
        });
        const gapText = new PIXI.Text(
          `距历史最佳还差 ${scoreDiff} 分`,
          gapStyle
        );
        gapText.anchor.set(0.5);
        gapText.x = this.app.screen.width / 2;
        gapText.y = startY + 122;
        gapText.alpha = 0;
        this.container.addChild(gapText);
        setTimeout(() => this.animateFadeIn(gapText), 1300);
      }
    } else {
      const practiceHintStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fill: 0x88ccff,
        fontStyle: 'italic',
        align: 'center',
        stroke: 0x000000,
        strokeThickness: 1
      });
      const practiceHint = new PIXI.Text(
        '💡 练习模式成绩仅保存在历史记录中，可随时对比查看进步',
        practiceHintStyle
      );
      practiceHint.anchor.set(0.5);
      practiceHint.x = this.app.screen.width / 2;
      practiceHint.y = startY + 122;
      practiceHint.alpha = 0;
      this.container.addChild(practiceHint);
      setTimeout(() => this.animateFadeIn(practiceHint), 1300);
    }

    const statsContainer = new PIXI.Container();
    statsContainer.x = this.app.screen.width / 2;
    statsContainer.y = startY + 150;

    const statStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
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
      `MaxCombo: ${score.maxCombo}`
    ];

    if (isPractice && practiceSpeed !== 1.0) {
      stats.push(`速度: ${practiceSpeed.toFixed(2)}x`);
    }

    const spacing = Math.min(90, (this.app.screen.width - 120) / stats.length);
    stats.forEach((stat, index) => {
      const text = new PIXI.Text(stat, statStyle);
      text.anchor.set(0.5);
      text.x = (index - (stats.length - 1) / 2) * spacing;
      text.alpha = 0;
      statsContainer.addChild(text);
      setTimeout(() => this.animateFadeIn(text), 1400 + index * 80);
    });

    this.container.addChild(statsContainer);
  }

  private createTypeStatsDisplay(typeStats: NoteTypeStats): void {
    const statsY = this.app.screen.height / 2 + 210;

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
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
    setTimeout(() => this.animateFadeIn(title), 1700);

    const types: NoteType[] = ['tap', 'hold', 'slide'];
    types.forEach((type, index) => {
      const stats = typeStats[type];
      const total = stats.perfect + stats.great + stats.good + stats.miss;

      if (total === 0) return;

      const container = new PIXI.Container();
      container.x = this.app.screen.width / 2;
      container.y = statsY + 35 + index * 48;

      const typeColor = NOTE_TYPE_COLORS[type];

      const typeBg = new PIXI.Graphics();
      typeBg.beginFill(typeColor, 0.12);
      typeBg.lineStyle(2, typeColor, 0.5);
      typeBg.drawRoundedRect(-260, -20, 520, 40, 8);
      typeBg.endFill();
      container.addChild(typeBg);

      const typeLabelStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        fill: typeColor,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'left'
      });

      const typeLabel = new PIXI.Text(`${NOTE_TYPE_LABELS[type]} (${total})`, typeLabelStyle);
      typeLabel.anchor.set(0, 0.5);
      typeLabel.x = -250;
      container.addChild(typeLabel);

      const accuracy = ((stats.perfect * 100 + stats.great * 70 + stats.good * 30) / (total * 100)) * 100;
      const accuracyText = `${accuracy.toFixed(1)}%`;
      const accuracyStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fill: accuracy >= 90 ? 0xffd700 : accuracy >= 70 ? 0x6bff9d : 0xff6b6b,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'right'
      });

      const accuracyLabel = new PIXI.Text(accuracyText, accuracyStyle);
      accuracyLabel.anchor.set(1, 0.5);
      accuracyLabel.x = 250;
      container.addChild(accuracyLabel);

      const barBg = new PIXI.Graphics();
      barBg.beginFill(0x333333, 0.8);
      barBg.drawRoundedRect(-110, -7, 220, 14, 4);
      barBg.endFill();
      container.addChild(barBg);

      const barWidth = 220;
      const perfectWidth = (stats.perfect / total) * barWidth;
      const greatWidth = (stats.great / total) * barWidth;
      const goodWidth = (stats.good / total) * barWidth;

      let currentX = -110;

      if (perfectWidth > 0) {
        const perfectBar = new PIXI.Graphics();
        perfectBar.beginFill(0xffd700, 1);
        perfectBar.drawRoundedRect(currentX, -7, perfectWidth, 14, 4);
        perfectBar.endFill();
        container.addChild(perfectBar);
        currentX += perfectWidth;
      }

      if (greatWidth > 0) {
        const greatBar = new PIXI.Graphics();
        greatBar.beginFill(0x00ff00, 1);
        greatBar.drawRoundedRect(currentX, -7, greatWidth, 14, 4);
        greatBar.endFill();
        container.addChild(greatBar);
        currentX += greatWidth;
      }

      if (goodWidth > 0) {
        const goodBar = new PIXI.Graphics();
        goodBar.beginFill(0x00bfff, 1);
        goodBar.drawRoundedRect(currentX, -7, goodWidth, 14, 4);
        goodBar.endFill();
        container.addChild(goodBar);
      }

      const statNumbersStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 10,
        fill: 0x888888,
        align: 'left'
      });

      const statNumbers = `P:${stats.perfect} G:${stats.great} O:${stats.good} M:${stats.miss}`;
      const statNumbersLabel = new PIXI.Text(statNumbers, statNumbersStyle);
      statNumbersLabel.anchor.set(0, 0.5);
      statNumbersLabel.x = -110;
      statNumbersLabel.y = 16;
      container.addChild(statNumbersLabel);

      container.alpha = 0;
      this.container.addChild(container);
      setTimeout(() => this.animateFadeIn(container), 1800 + index * 120);
    });
  }

  private createSongInfoFooter(songId?: string, difficulty?: Difficulty, isPractice: boolean = false): void {
    if (!songId || !difficulty) return;

    const footerStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x666688,
      align: 'center'
    });

    const history = ScoreStorage.getScoreHistoryForDifficulty(songId, difficulty);
    const practiceLabel = isPractice ? '  |  [练习模式]' : '  |  [正式成绩]';
    const footerText = new PIXI.Text(
      `曲目: ${songId}  |  难度: ${DIFFICULTY_LABELS[difficulty]}${practiceLabel}  |  已游玩 ${history.length} 次`,
      footerStyle
    );
    footerText.anchor.set(0.5);
    footerText.x = this.app.screen.width / 2;
    footerText.y = this.app.screen.height - 130;
    footerText.alpha = 0;
    this.container.addChild(footerText);
    setTimeout(() => this.animateFadeIn(footerText), 2600);
  }

  private createMiniLeaderboardButton(songId?: string, difficulty?: Difficulty): void {
    const btnContainer = new PIXI.Graphics();
    btnContainer.x = 60;
    btnContainer.y = this.app.screen.height - 60;

    btnContainer.beginFill(0x9b59b6, 0.9);
    btnContainer.lineStyle(2, 0xffd700, 0.6);
    btnContainer.drawRoundedRect(-45, -22, 90, 44, 10);
    btnContainer.endFill();

    const btnStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const text = new PIXI.Text('🏆 看排行', btnStyle);
    text.anchor.set(0.5);
    btnContainer.addChild(text);

    btnContainer.interactive = true;
    btnContainer.cursor = 'pointer';
    btnContainer.alpha = 0;
    btnContainer.on('pointerdown', () => this.toggleMiniLeaderboard(songId, difficulty));

    this.container.addChild(btnContainer);
    setTimeout(() => this.animateFadeIn(btnContainer), 2700);
  }

  private toggleMiniLeaderboard(songId?: string, difficulty?: Difficulty): void {
    this.miniLeaderboardVisible = !this.miniLeaderboardVisible;
    this.miniLeaderboardPanel.removeChildren();

    if (!this.miniLeaderboardVisible) return;
    if (!songId || !difficulty) return;

    const panelWidth = Math.min(480, this.app.screen.width - 60);
    const panelHeight = Math.min(420, this.app.screen.height - 160);
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = (this.app.screen.height - panelHeight) / 2;

    const panelMask = new PIXI.Graphics();
    panelMask.beginFill(0x000000, 0.7);
    panelMask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    panelMask.endFill();
    panelMask.interactive = true;
    panelMask.on('pointerdown', () => this.toggleMiniLeaderboard());
    this.miniLeaderboardPanel.addChild(panelMask);

    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0x151530, 0.98);
    panelBg.lineStyle(3, 0xffd700, 0.8);
    panelBg.drawRoundedRect(panelX, panelY, panelWidth, panelHeight, 14);
    panelBg.endFill();
    this.miniLeaderboardPanel.addChild(panelBg);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 22,
      fill: 0xffd700,
      fontWeight: 'bold',
      align: 'center'
    });
    const title = new PIXI.Text('🏆 TOP 10 成绩榜', titleStyle);
    title.anchor.set(0.5);
    title.x = this.app.screen.width / 2;
    title.y = panelY + 30;
    this.miniLeaderboardPanel.addChild(title);

    const closeBtn = new PIXI.Graphics();
    closeBtn.x = panelX + panelWidth - 35;
    closeBtn.y = panelY + 28;
    closeBtn.beginFill(0xff6b6b, 0.9);
    closeBtn.drawRoundedRect(-16, -16, 32, 32, 6);
    closeBtn.endFill();
    closeBtn.interactive = true;
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.toggleMiniLeaderboard());

    const closeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    const closeText = new PIXI.Text('✕', closeStyle);
    closeText.anchor.set(0.5);
    closeBtn.addChild(closeText);
    this.miniLeaderboardPanel.addChild(closeBtn);

    const startX = panelX + 25;
    const contentWidth = panelWidth - 50;

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'left'
    });
    const colHeaders = ['#', '评级', '分数', '连击', '准确率', '日期'];
    const colXs = [0, 35, 75, 165, 230, 310];

    colHeaders.forEach((header, i) => {
      const text = new PIXI.Text(header, headerStyle);
      text.anchor.set(0, 0);
      text.x = startX + colXs[i];
      text.y = panelY + 55;
      this.miniLeaderboardPanel.addChild(text);
    });

    const divider = new PIXI.Graphics();
    divider.lineStyle(1, 0x444466, 0.6);
    divider.moveTo(startX, panelY + 74);
    divider.lineTo(startX + contentWidth, panelY + 74);
    this.miniLeaderboardPanel.addChild(divider);

    const topScores = ScoreStorage.getTopScores(songId, difficulty, 10);

    if (topScores.length === 0) {
      const emptyStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0x666666,
        fontStyle: 'italic',
        align: 'center'
      });
      const emptyText = new PIXI.Text('还没有其他成绩~', emptyStyle);
      emptyText.anchor.set(0.5);
      emptyText.x = this.app.screen.width / 2;
      emptyText.y = panelY + 120;
      this.miniLeaderboardPanel.addChild(emptyText);
      return;
    }

    const rowHeight = 28;
    topScores.forEach((entry, index) => {
      const rowY = panelY + 80 + index * rowHeight;
      const isTopThree = index < 3;

      if (isTopThree) {
        const rowBg = new PIXI.Graphics();
        const bgColor = index === 0 ? 0xffd700 : index === 1 ? 0xc0c0c0 : 0xcd7f32;
        rowBg.beginFill(bgColor, 0.1);
        rowBg.drawRoundedRect(startX - 3, rowY - 2, contentWidth + 6, rowHeight - 4, 4);
        rowBg.endFill();
        this.miniLeaderboardPanel.addChild(rowBg);
      }

      const rankColor = index === 0 ? 0xffd700 : index === 1 ? 0xe0e0e0 : index === 2 ? 0xcd7f32 : 0x888888;
      const rankStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: isTopThree ? 13 : 12,
        fontWeight: isTopThree ? 'bold' : 'normal',
        fill: rankColor,
        align: 'left'
      });
      const rankLabel = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
      const rankText = new PIXI.Text(rankLabel, rankStyle);
      rankText.anchor.set(0, 0.5);
      rankText.x = startX + colXs[0];
      rankText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(rankText);

      const ratingColor = RATING_COLORS[entry.rating] || 0xffffff;
      const ratingStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: ratingColor,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'left'
      });
      const ratingText = new PIXI.Text(entry.rating, ratingStyle);
      ratingText.anchor.set(0, 0.5);
      ratingText.x = startX + colXs[1];
      ratingText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(ratingText);

      const scoreStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: 0x6b9dff,
        align: 'left'
      });
      const scoreText = new PIXI.Text(entry.score.toLocaleString(), scoreStyle);
      scoreText.anchor.set(0, 0.5);
      scoreText.x = startX + colXs[2];
      scoreText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(scoreText);

      const comboStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 11,
        fill: 0xff9d5b,
        align: 'left'
      });
      const comboText = new PIXI.Text(`${entry.maxCombo}x`, comboStyle);
      comboText.anchor.set(0, 0.5);
      comboText.x = startX + colXs[3];
      comboText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(comboText);

      const accColor = entry.accuracy >= 95 ? 0xffd700 : entry.accuracy >= 85 ? 0x6bff9d : entry.accuracy >= 70 ? 0x6b9dff : 0xff6b6b;
      const accStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 11,
        fill: accColor,
        align: 'left'
      });
      const accText = new PIXI.Text(`${entry.accuracy.toFixed(1)}%`, accStyle);
      accText.anchor.set(0, 0.5);
      accText.x = startX + colXs[4];
      accText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(accText);

      const date = new Date(entry.timestamp);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      const dateStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 10,
        fill: 0x888888,
        align: 'left'
      });
      const dateText = new PIXI.Text(dateStr, dateStyle);
      dateText.anchor.set(0, 0.5);
      dateText.x = startX + colXs[5];
      dateText.y = rowY + rowHeight / 2 - 3;
      this.miniLeaderboardPanel.addChild(dateText);
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
      const duration = 450;

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

  private executePendingAction(): void {
    if (!this.pendingAction) return;
    const action = this.pendingAction;
    this.pendingAction = undefined;

    this.animateOutAndHide(() => {
      if (action === 'restart' && this.onRestartCallback) {
        this.onRestartCallback();
      } else if (action === 'back' && this.onBackToStartCallback) {
        this.onBackToStartCallback();
      }
    });
  }

  private requestAction(action: 'restart' | 'back'): void {
    if (this.isTransitioningOut) return;

    if (this.animationComplete) {
      this.pendingAction = action;
      this.executePendingAction();
    } else {
      this.pendingAction = action;
      this.showActionWaitingIndicator(action);
    }
  }

  private showActionWaitingIndicator(action: 'restart' | 'back'): void {
    const indicator = new PIXI.Container();
    indicator.x = this.app.screen.width / 2;
    indicator.y = this.app.screen.height / 2 + 80;
    indicator.name = 'waitingIndicator';

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.7);
    bg.lineStyle(2, 0xffd700, 0.8);
    bg.drawRoundedRect(-140, -20, 280, 40, 8);
    bg.endFill();
    indicator.addChild(bg);

    const label = action === 'restart' ? '⏳ 等待动画播放完毕后重新开始...' : '⏳ 等待动画播放完毕后返回菜单...';
    const style = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 1,
      align: 'center'
    });
    const text = new PIXI.Text(label, style);
    text.anchor.set(0.5);
    indicator.addChild(text);

    const existing = this.container.getChildByName('waitingIndicator');
    if (existing) {
      this.container.removeChild(existing);
      existing.destroy();
    }

    let dots = 0;
    indicator.alpha = 0;
    const startTime = Date.now();
    const fadeIn = () => {
      const elapsed = Date.now() - startTime;
      indicator.alpha = Math.min(elapsed / 300, 1);
      dots = (dots + 1) % 4;
      text.text = label.replace('...', '.'.repeat(dots + 1));
      if (elapsed < 300 || this.pendingAction === action) {
        requestAnimationFrame(fadeIn);
      }
    };
    this.container.addChild(indicator);
    requestAnimationFrame(fadeIn);
  }

  private animateOutAndHide(onComplete: () => void): void {
    if (this.isTransitioningOut) return;
    this.isTransitioningOut = true;

    const existing = this.container.getChildByName('waitingIndicator');
    if (existing) {
      this.container.removeChild(existing);
      existing.destroy();
    }

    const startTime = Date.now();
    const startAlpha = this.container.alpha;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.TRANSITION_OUT_DURATION, 1);
      this.container.alpha = startAlpha * (1 - progress);
      this.container.scale.set(1 + progress * 0.05);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.container.scale.set(1);
        this.doHide();
        onComplete();
      }
    };

    animate();
  }

  private doHide(): void {
    this.container.visible = false;
    this.container.alpha = 1;
    this.container.removeChildren();
    this.miniLeaderboardVisible = false;
    this.miniLeaderboardPanel.removeChildren();
    this.isTransitioningOut = false;
  }

  private createRestartButton(): void {
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = this.app.screen.width / 2 + 80;
    buttonContainer.y = this.app.screen.height - 60;

    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x6b9dff);
    buttonBg.drawRoundedRect(-85, -25, 170, 50, 10);
    buttonBg.endFill();

    buttonBg.interactive = true;
    buttonBg.cursor = 'pointer';

    buttonBg.on('pointerdown', () => {
      this.requestAction('restart');
    });

    buttonContainer.addChild(buttonBg);

    const buttonStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const buttonText = new PIXI.Text('再来一次', buttonStyle);
    buttonText.anchor.set(0.5);
    buttonContainer.addChild(buttonText);

    buttonContainer.alpha = 0;
    this.container.addChild(buttonContainer);

    setTimeout(() => this.animateFadeIn(buttonContainer), 2700);
  }

  private createBackToStartButton(): void {
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = this.app.screen.width / 2 - 80;
    buttonContainer.y = this.app.screen.height - 60;

    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x666677);
    buttonBg.drawRoundedRect(-85, -25, 170, 50, 10);
    buttonBg.endFill();

    buttonBg.interactive = true;
    buttonBg.cursor = 'pointer';

    buttonBg.on('pointerdown', () => {
      this.requestAction('back');
    });

    buttonContainer.addChild(buttonBg);

    const buttonStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const buttonText = new PIXI.Text('返回主菜单', buttonStyle);
    buttonText.anchor.set(0.5);
    buttonContainer.addChild(buttonText);

    buttonContainer.alpha = 0;
    this.container.addChild(buttonContainer);

    setTimeout(() => this.animateFadeIn(buttonContainer), 2750);
  }

  private animateIn(): void {
    this.container.alpha = 0;
    const startTime = Date.now();
    const duration = 450;

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

  public setOnBackToStartCallback(callback: () => void): void {
    this.onBackToStartCallback = callback;
  }

  public hide(): void {
    if (this.animationCompleteTimer) {
      clearTimeout(this.animationCompleteTimer);
      this.animationCompleteTimer = undefined;
    }
    this.pendingAction = undefined;
    this.doHide();
  }

  public destroy(): void {
    if (this.animationCompleteTimer) {
      clearTimeout(this.animationCompleteTimer);
      this.animationCompleteTimer = undefined;
    }
    this.container.destroy();
    this.miniLeaderboardPanel.destroy();
  }
}
