import * as PIXI from 'pixi.js';
import { ChartData, Difficulty } from '../types';
import { songs } from '../data/songs';
import { ScoreStorage } from './ScoreStorage';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难'
};

export class StartScreen {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private onStartCallback?: (songId: string, difficulty: Difficulty) => void;

  private songList: ChartData[] = songs;
  private selectedSongIndex: number = 0;
  private selectedDifficulty: Difficulty = 'normal';

  private songInfoContainer: PIXI.Container;
  private difficultyButtons: PIXI.Graphics[] = [];

  private prevSongBtn?: PIXI.Graphics;
  private nextSongBtn?: PIXI.Graphics;

  private leaderboardPanel: PIXI.Container;
  private leaderboardVisible: boolean = false;
  private leaderboardContent: PIXI.Container;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.songInfoContainer = new PIXI.Container();
    this.leaderboardPanel = new PIXI.Container();
    this.leaderboardContent = new PIXI.Container();
    this.app.stage.addChild(this.container);
    this.createScreen();
  }

  private createScreen(): void {
    this.createBackground();
    this.createTitle();
    this.createSongNavigation();
    this.createSongInfo();
    this.createDifficultySelector();
    this.createStartButton();
    this.createControlsHint();
    this.createLeaderboardToggle();
    this.createLeaderboardPanel();
  }

  private createBackground(): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x0a0a1a);
    bg.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    bg.endFill();
    this.container.addChild(bg);

    for (let i = 0; i < 30; i++) {
      const star = new PIXI.Graphics();
      const x = Math.random() * this.app.screen.width;
      const y = Math.random() * this.app.screen.height;
      const size = Math.random() * 2 + 1;
      star.beginFill(0xffffff, Math.random() * 0.5 + 0.3);
      star.drawCircle(x, y, size);
      star.endFill();
      this.container.addChild(star);
    }
  }

  private createTitle(): void {
    const titleContainer = new PIXI.Container();
    titleContainer.x = this.app.screen.width / 2;
    titleContainer.y = 50;

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 36,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 10,
      align: 'center'
    });

    const title = new PIXI.Text('浮岛书屋', titleStyle);
    title.anchor.set(0.5);
    titleContainer.addChild(title);

    const subtitleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 18,
      fill: 0xaaaaaa,
      stroke: 0x000000,
      strokeThickness: 1,
      align: 'center'
    });

    const subtitle = new PIXI.Text('~ 古韵诗章节奏游戏 ~', subtitleStyle);
    subtitle.anchor.set(0.5);
    subtitle.y = 40;
    titleContainer.addChild(subtitle);

    this.container.addChild(titleContainer);
  }

  private createSongNavigation(): void {
    const navY = 260;

    this.prevSongBtn = this.createArrowButton('◀', 50, navY);
    this.prevSongBtn.on('pointerdown', () => this.prevSong());
    this.container.addChild(this.prevSongBtn);

    this.nextSongBtn = this.createArrowButton('▶', this.app.screen.width - 50, navY);
    this.nextSongBtn.on('pointerdown', () => this.nextSong());
    this.container.addChild(this.nextSongBtn);
  }

  private createArrowButton(label: string, x: number, y: number): PIXI.Graphics {
    const container = new PIXI.Graphics() as PIXI.Graphics & { labelText?: PIXI.Text };

    container.beginFill(0x2a2a4a, 0.8);
    container.drawRoundedRect(-30, -25, 60, 50, 10);
    container.endFill();

    const btnStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const text = new PIXI.Text(label, btnStyle);
    text.anchor.set(0.5);
    container.addChild(text);
    (container as any).labelText = text;

    container.x = x;
    container.y = y;
    container.interactive = true;
    container.cursor = 'pointer';

    return container;
  }

  private createSongInfo(): void {
    this.songInfoContainer.x = this.app.screen.width / 2;
    this.songInfoContainer.y = 140;
    this.container.addChild(this.songInfoContainer);
    this.updateSongInfo();
  }

  private updateSongInfo(): void {
    this.songInfoContainer.removeChildren();

    const song = this.songList[this.selectedSongIndex];
    const difficultyConfig = song.difficultyConfigs[this.selectedDifficulty];
    const bestScore = ScoreStorage.getBestScore(song.id, this.selectedDifficulty);

    const bgPanel = new PIXI.Graphics();
    bgPanel.beginFill(0x1a1a3a, 0.9);
    bgPanel.drawRoundedRect(-240, 0, 480, 230, 16);
    bgPanel.endFill();
    bgPanel.lineStyle(2, 0x6b9dff, 0.6);
    bgPanel.drawRoundedRect(-240, 0, 480, 230, 16);
    this.songInfoContainer.addChild(bgPanel);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 30,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 5,
      align: 'center'
    });

    const title = new PIXI.Text(song.title, titleStyle);
    title.anchor.set(0.5);
    title.y = 25;
    this.songInfoContainer.addChild(title);

    const artistStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fill: 0xaaaaaa,
      align: 'center'
    });

    const artist = new PIXI.Text(`艺术家: ${song.artist}`, artistStyle);
    artist.anchor.set(0.5);
    artist.y = 58;
    this.songInfoContainer.addChild(artist);

    const infoStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0xcccccc,
      align: 'left'
    });

    const bpmText = new PIXI.Text(`♪ BPM: ${song.bpm}`, infoStyle);
    bpmText.anchor.set(0, 0.5);
    bpmText.x = -210;
    bpmText.y = 90;
    this.songInfoContainer.addChild(bpmText);

    const stars = this.getStarDisplay(difficultyConfig.starLevel);
    const starText = new PIXI.Text(`难度: ${stars}`, infoStyle);
    starText.anchor.set(0, 0.5);
    starText.x = -210;
    starText.y = 114;
    this.songInfoContainer.addChild(starText);

    const noteCount = (song.difficulties[this.selectedDifficulty] || song.difficulties.normal).length;
    const noteText = new PIXI.Text(`音符数: ${noteCount}`, infoStyle);
    noteText.anchor.set(0, 0.5);
    noteText.x = -210;
    noteText.y = 138;
    this.songInfoContainer.addChild(noteText);

    const speedText = new PIXI.Text(`落速: ${difficultyConfig.noteSpeed}`, infoStyle);
    speedText.anchor.set(0, 0.5);
    speedText.x = 30;
    speedText.y = 90;
    this.songInfoContainer.addChild(speedText);

    const diffLabelText = new PIXI.Text(`模式: ${difficultyConfig.label}`, infoStyle);
    diffLabelText.anchor.set(0, 0.5);
    diffLabelText.x = 30;
    diffLabelText.y = 114;
    this.songInfoContainer.addChild(diffLabelText);

    const playCount = ScoreStorage.getScoreHistoryForDifficulty(song.id, this.selectedDifficulty).length;
    const playCountText = new PIXI.Text(`游玩次数: ${playCount}`, infoStyle);
    playCountText.anchor.set(0, 0.5);
    playCountText.x = 30;
    playCountText.y = 138;
    this.songInfoContainer.addChild(playCountText);

    if (bestScore) {
      const bestLabelStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0xffd700,
        fontWeight: 'bold',
        align: 'left'
      });

      const bestLabel = new PIXI.Text('★ 最佳成绩', bestLabelStyle);
      bestLabel.anchor.set(0, 0.5);
      bestLabel.x = -210;
      bestLabel.y = 168;
      this.songInfoContainer.addChild(bestLabel);

      const bestScoreStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 16,
        fill: 0x6b9dff,
        fontWeight: 'bold',
        align: 'left'
      });

      const bestScoreText = new PIXI.Text(
        `${bestScore.score}  [${bestScore.rating}]`,
        bestScoreStyle
      );
      bestScoreText.anchor.set(0, 0.5);
      bestScoreText.x = -210;
      bestScoreText.y = 190;
      this.songInfoContainer.addChild(bestScoreText);

      const bestDetailStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: 0x88ccff,
        align: 'left'
      });

      const bestDetailText = new PIXI.Text(
        `连击:${bestScore.maxCombo}  准确率:${bestScore.accuracy.toFixed(1)}%`,
        bestDetailStyle
      );
      bestDetailText.anchor.set(0, 0.5);
      bestDetailText.x = -210;
      bestDetailText.y = 212;
      this.songInfoContainer.addChild(bestDetailText);
    } else {
      const noScoreStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0x666666,
        fontStyle: 'italic',
        align: 'center'
      });

      const noScoreText = new PIXI.Text('暂无记录 - 来挑战吧！', noScoreStyle);
      noScoreText.anchor.set(0.5);
      noScoreText.y = 190;
      this.songInfoContainer.addChild(noScoreText);
    }

    const poemLabelStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'center'
    });

    const poemPreview = song.poemLines.slice(0, 1).join('  ');
    const poemText = new PIXI.Text(`「${poemPreview}...」`, poemLabelStyle);
    poemText.anchor.set(0.5);
    poemText.y = 225;
    this.songInfoContainer.addChild(poemText);
  }

  private getStarDisplay(level: number): string {
    const fullStars = '★'.repeat(level);
    const emptyStars = '☆'.repeat(Math.max(0, 7 - level));
    return fullStars + emptyStars;
  }

  private createDifficultySelector(): void {
    const container = new PIXI.Container();
    container.x = this.app.screen.width / 2;
    container.y = Math.min(420, this.app.screen.height - 280);
    this.container.addChild(container);

    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fill: 0xaaaaaa,
      align: 'center'
    });

    const label = new PIXI.Text('选择难度', labelStyle);
    label.anchor.set(0.5);
    label.y = -22;
    container.addChild(label);

    const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
    const labels = ['简单', '普通', '困难'];
    const colors = [0x4caf50, 0x2196f3, 0xf44336];

    difficulties.forEach((diff, index) => {
      const btnWidth = 100;
      const btnHeight = 44;
      const spacing = 120;
      const startX = -spacing;

      const button = new PIXI.Graphics();
      const x = startX + index * spacing;
      button.x = x;

      this.drawDifficultyButton(button, colors[index], labels[index], btnWidth, btnHeight, diff === this.selectedDifficulty);

      button.interactive = true;
      button.cursor = 'pointer';
      button.on('pointerdown', () => this.selectDifficulty(diff));

      container.addChild(button);
      this.difficultyButtons.push(button);
    });
  }

  private drawDifficultyButton(
    button: PIXI.Graphics,
    color: number,
    label: string,
    width: number,
    height: number,
    selected: boolean
  ): void {
    button.clear();
    button.removeChildren();

    if (selected) {
      button.lineStyle(4, 0xffffff, 1);
      button.beginFill(color, 1);
    } else {
      button.lineStyle(2, color, 0.6);
      button.beginFill(color, 0.3);
    }
    button.drawRoundedRect(-width / 2, -height / 2, width, height, 10);
    button.endFill();

    const textStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: selected ? 0xffffff : 0xdddddd,
      align: 'center'
    });

    const text = new PIXI.Text(label, textStyle);
    text.anchor.set(0.5);
    button.addChild(text);
  }

  private selectDifficulty(difficulty: Difficulty): void {
    this.selectedDifficulty = difficulty;
    this.updateDifficultyButtons();
    this.updateSongInfo();
    if (this.leaderboardVisible) {
      this.updateLeaderboardContent();
    }
  }

  private updateDifficultyButtons(): void {
    const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
    const labels = ['简单', '普通', '困难'];
    const colors = [0x4caf50, 0x2196f3, 0xf44336];

    this.difficultyButtons.forEach((btn, index) => {
      this.drawDifficultyButton(btn, colors[index], labels[index], 100, 44, difficulties[index] === this.selectedDifficulty);
    });
  }

  private prevSong(): void {
    this.selectedSongIndex = (this.selectedSongIndex - 1 + this.songList.length) % this.songList.length;
    this.updateSongInfo();
    if (this.leaderboardVisible) {
      this.updateLeaderboardContent();
    }
  }

  private nextSong(): void {
    this.selectedSongIndex = (this.selectedSongIndex + 1) % this.songList.length;
    this.updateSongInfo();
    if (this.leaderboardVisible) {
      this.updateLeaderboardContent();
    }
  }

  private createStartButton(): void {
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = this.app.screen.width / 2;
    buttonContainer.y = Math.min(this.app.screen.height - 100, 560);

    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x6b9dff);
    buttonBg.drawRoundedRect(-120, -32, 240, 64, 16);
    buttonBg.endFill();

    buttonBg.interactive = true;
    buttonBg.cursor = 'pointer';

    buttonBg.on('pointerdown', () => this.startGame());

    buttonContainer.addChild(buttonBg);

    const buttonStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const buttonText = new PIXI.Text('开始游戏', buttonStyle);
    buttonText.anchor.set(0.5);
    buttonContainer.addChild(buttonText);

    this.container.addChild(buttonContainer);

    this.animateButton(buttonBg);
  }

  private animateButton(button: PIXI.Graphics): void {
    let time = 0;
    const animate = () => {
      time += 0.05;
      const scale = 1 + Math.sin(time) * 0.03;
      button.scale.set(scale);
      if (this.container.visible) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  private createControlsHint(): void {
    const hintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: 0x666666,
      align: 'center',
      lineHeight: 20
    });

    const hint = new PIXI.Text('操作说明: 键盘 D F J K 对应四个轨道\n或直接点击屏幕轨道区域', hintStyle);
    hint.anchor.set(0.5);
    hint.x = this.app.screen.width / 2;
    hint.y = Math.min(this.app.screen.height - 35, 610);
    this.container.addChild(hint);
  }

  private createLeaderboardToggle(): void {
    const btnContainer = new PIXI.Graphics() as PIXI.Graphics & { labelText?: PIXI.Text };
    btnContainer.x = this.app.screen.width - 70;
    btnContainer.y = 120;

    btnContainer.beginFill(0x9b59b6, 0.85);
    btnContainer.lineStyle(2, 0xffd700, 0.6);
    btnContainer.drawRoundedRect(-40, -20, 80, 40, 10);
    btnContainer.endFill();

    const btnStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const text = new PIXI.Text('🏆 榜', btnStyle);
    text.anchor.set(0.5);
    btnContainer.addChild(text);

    btnContainer.interactive = true;
    btnContainer.cursor = 'pointer';
    btnContainer.on('pointerdown', () => this.toggleLeaderboard());

    this.container.addChild(btnContainer);
  }

  private createLeaderboardPanel(): void {
    this.leaderboardPanel.x = 0;
    this.leaderboardPanel.y = 0;
    this.leaderboardPanel.visible = false;

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.85);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    mask.interactive = true;
    this.leaderboardPanel.addChild(mask);

    const panelWidth = Math.min(640, this.app.screen.width - 40);
    const panelHeight = Math.min(680, this.app.screen.height - 80);
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = (this.app.screen.height - panelHeight) / 2;

    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0x151530, 0.98);
    panelBg.lineStyle(3, 0xffd700, 0.8);
    panelBg.drawRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
    panelBg.endFill();
    this.leaderboardPanel.addChild(panelBg);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      align: 'center'
    });

    const title = new PIXI.Text('🏆 历史成绩榜', titleStyle);
    title.anchor.set(0.5);
    title.x = this.app.screen.width / 2;
    title.y = panelY + 35;
    this.leaderboardPanel.addChild(title);

    const closeBtn = new PIXI.Graphics();
    closeBtn.x = panelX + panelWidth - 40;
    closeBtn.y = panelY + 30;
    closeBtn.beginFill(0xff6b6b, 0.9);
    closeBtn.drawRoundedRect(-18, -18, 36, 36, 8);
    closeBtn.endFill();
    closeBtn.interactive = true;
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.toggleLeaderboard());

    const closeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    const closeText = new PIXI.Text('✕', closeStyle);
    closeText.anchor.set(0.5);
    closeBtn.addChild(closeText);
    this.leaderboardPanel.addChild(closeBtn);

    this.leaderboardContent.x = 0;
    this.leaderboardContent.y = panelY + 60;
    this.leaderboardPanel.addChild(this.leaderboardContent);

    this.container.addChild(this.leaderboardPanel);
  }

  private toggleLeaderboard(): void {
    this.leaderboardVisible = !this.leaderboardVisible;
    this.leaderboardPanel.visible = this.leaderboardVisible;
    if (this.leaderboardVisible) {
      this.updateLeaderboardContent();
    }
  }

  private updateLeaderboardContent(): void {
    this.leaderboardContent.removeChildren();

    const song = this.songList[this.selectedSongIndex];
    const panelWidth = Math.min(640, this.app.screen.width - 40);
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const contentWidth = panelWidth - 60;
    const startX = panelX + 30;

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0xaaaaaa,
      align: 'left'
    });

    const songLabelStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 16,
      fill: 0xffd700,
      fontWeight: 'bold',
      align: 'left'
    });

    const songLabel = new PIXI.Text(`${song.title} - ${DIFFICULTY_LABELS[this.selectedDifficulty]}`, songLabelStyle);
    songLabel.anchor.set(0, 0);
    songLabel.x = startX;
    songLabel.y = 10;
    this.leaderboardContent.addChild(songLabel);

    const colHeaders = ['排名', '评级', '分数', '连击', '准确率', '日期'];
    const colXs = [0, 55, 100, 210, 290, 380];

    colHeaders.forEach((header, i) => {
      const text = new PIXI.Text(header, headerStyle);
      text.anchor.set(0, 0);
      text.x = startX + colXs[i];
      text.y = 40;
      this.leaderboardContent.addChild(text);
    });

    const divider = new PIXI.Graphics();
    divider.lineStyle(1, 0x444466, 0.6);
    divider.moveTo(startX, 62);
    divider.lineTo(startX + contentWidth, 62);
    this.leaderboardContent.addChild(divider);

    const topScores = ScoreStorage.getTopScores(song.id, this.selectedDifficulty, 15);

    if (topScores.length === 0) {
      const emptyStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 16,
        fill: 0x666666,
        fontStyle: 'italic',
        align: 'center'
      });
      const emptyText = new PIXI.Text('还没有成绩记录~ 快去挑战吧！', emptyStyle);
      emptyText.anchor.set(0.5);
      emptyText.x = this.app.screen.width / 2;
      emptyText.y = 110;
      this.leaderboardContent.addChild(emptyText);
      return;
    }

    const rowHeight = 36;
    topScores.forEach((entry, index) => {
      const rowY = 70 + index * rowHeight;
      const isTopThree = index < 3;

      if (isTopThree) {
        const rowBg = new PIXI.Graphics();
        const bgColor = index === 0 ? 0xffd700 : index === 1 ? 0xc0c0c0 : 0xcd7f32;
        rowBg.beginFill(bgColor, 0.12);
        rowBg.drawRoundedRect(startX - 5, rowY - 4, contentWidth + 10, rowHeight - 4, 6);
        rowBg.endFill();
        this.leaderboardContent.addChild(rowBg);
      }

      const rankStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: isTopThree ? 16 : 14,
        fontWeight: isTopThree ? 'bold' : 'normal',
        fill: index === 0 ? 0xffd700 : index === 1 ? 0xe0e0e0 : index === 2 ? 0xcd7f32 : 0x888888,
        align: 'left'
      });

      const rankLabel = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
      const rankText = new PIXI.Text(rankLabel, rankStyle);
      rankText.anchor.set(0, 0.5);
      rankText.x = startX + colXs[0];
      rankText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(rankText);

      const ratingColor = this.getRatingColor(entry.rating);
      const ratingStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 16,
        fontWeight: 'bold',
        fill: ratingColor,
        stroke: 0x000000,
        strokeThickness: 1,
        align: 'left'
      });
      const ratingText = new PIXI.Text(entry.rating, ratingStyle);
      ratingText.anchor.set(0, 0.5);
      ratingText.x = startX + colXs[1];
      ratingText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(ratingText);

      const scoreStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0x6b9dff,
        align: 'left'
      });
      const scoreText = new PIXI.Text(entry.score.toLocaleString(), scoreStyle);
      scoreText.anchor.set(0, 0.5);
      scoreText.x = startX + colXs[2];
      scoreText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(scoreText);

      const comboStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 13,
        fill: 0xff9d5b,
        align: 'left'
      });
      const comboText = new PIXI.Text(`${entry.maxCombo}x`, comboStyle);
      comboText.anchor.set(0, 0.5);
      comboText.x = startX + colXs[3];
      comboText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(comboText);

      const accColor = entry.accuracy >= 95 ? 0xffd700 : entry.accuracy >= 85 ? 0x6bff9d : entry.accuracy >= 70 ? 0x6b9dff : 0xff6b6b;
      const accStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 13,
        fill: accColor,
        align: 'left'
      });
      const accText = new PIXI.Text(`${entry.accuracy.toFixed(1)}%`, accStyle);
      accText.anchor.set(0, 0.5);
      accText.x = startX + colXs[4];
      accText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(accText);

      const date = new Date(entry.timestamp);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      const dateStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fill: 0x888888,
        align: 'left'
      });
      const dateText = new PIXI.Text(dateStr, dateStyle);
      dateText.anchor.set(0, 0.5);
      dateText.x = startX + colXs[5];
      dateText.y = rowY + rowHeight / 2 - 4;
      this.leaderboardContent.addChild(dateText);
    });

    const allHistory = ScoreStorage.getScoreHistory();
    const totalStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x666688,
      align: 'center'
    });
    const totalText = new PIXI.Text(`总游玩记录: ${allHistory.length} 次  |  当前曲目: ${topScores.length} 次`, totalStyle);
    totalText.anchor.set(0.5);
    totalText.x = this.app.screen.width / 2;
    totalText.y = 70 + Math.min(topScores.length, 15) * rowHeight + 15;
    this.leaderboardContent.addChild(totalText);
  }

  private getRatingColor(rating: string): number {
    switch (rating) {
      case 'S': return 0xffd700;
      case 'A': return 0x6bff9d;
      case 'B': return 0x6b9dff;
      case 'C': return 0xff9d5b;
      case 'D': return 0xff6b6b;
      default: return 0xffffff;
    }
  }

  private startGame(): void {
    if (this.onStartCallback) {
      const song = this.songList[this.selectedSongIndex];
      this.onStartCallback(song.id, this.selectedDifficulty);
    }
  }

  public setOnStartCallback(callback: (songId: string, difficulty: Difficulty) => void): void {
    this.onStartCallback = callback;
  }

  public show(): void {
    this.container.visible = true;
    this.updateSongInfo();
    if (this.leaderboardVisible) {
      this.updateLeaderboardContent();
    }
  }

  public hide(): void {
    this.container.visible = false;
    this.leaderboardVisible = false;
    this.leaderboardPanel.visible = false;
  }

  public destroy(): void {
    this.container.destroy();
  }
}
