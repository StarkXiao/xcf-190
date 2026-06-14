import * as PIXI from 'pixi.js';
import { ChartData, Difficulty } from '../types';
import { songs } from '../data/songs';
import { ScoreStorage } from './ScoreStorage';

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

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.songInfoContainer = new PIXI.Container();
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
    bgPanel.drawRoundedRect(-240, 0, 480, 220, 16);
    bgPanel.endFill();
    bgPanel.lineStyle(2, 0x6b9dff, 0.6);
    bgPanel.drawRoundedRect(-240, 0, 480, 220, 16);
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

    if (bestScore) {
      const bestLabelStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0xffd700,
        fontWeight: 'bold',
        align: 'left'
      });

      const bestLabel = new PIXI.Text('★ 最佳', bestLabelStyle);
      bestLabel.anchor.set(0, 0.5);
      bestLabel.x = -210;
      bestLabel.y = 172;
      this.songInfoContainer.addChild(bestLabel);

      const bestScoreStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 18,
        fill: 0x6b9dff,
        fontWeight: 'bold',
        align: 'left'
      });

      const bestScoreText = new PIXI.Text(
        `${bestScore.score} [${bestScore.rating}] Combo:${bestScore.maxCombo}`,
        bestScoreStyle
      );
      bestScoreText.anchor.set(0, 0.5);
      bestScoreText.x = -130;
      bestScoreText.y = 172;
      this.songInfoContainer.addChild(bestScoreText);
    } else {
      const noScoreStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0x666666,
        fontStyle: 'italic',
        align: 'left'
      });

      const noScoreText = new PIXI.Text('暂无记录 - 来挑战吧！', noScoreStyle);
      noScoreText.anchor.set(0, 0.5);
      noScoreText.x = -210;
      noScoreText.y = 172;
      this.songInfoContainer.addChild(noScoreText);
    }

    const poemLabelStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 13,
      fill: 0x888888,
      align: 'center'
    });

    const poemPreview = song.poemLines.slice(0, 1).join('  ');
    const poemText = new PIXI.Text(`「${poemPreview}...」`, poemLabelStyle);
    poemText.anchor.set(0.5);
    poemText.y = 200;
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
    container.y = Math.min(410, this.app.screen.height - 280);
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
  }

  private nextSong(): void {
    this.selectedSongIndex = (this.selectedSongIndex + 1) % this.songList.length;
    this.updateSongInfo();
  }

  private createStartButton(): void {
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = this.app.screen.width / 2;
    buttonContainer.y = Math.min(this.app.screen.height - 100, 550);

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
    hint.y = Math.min(this.app.screen.height - 35, 600);
    this.container.addChild(hint);
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
  }

  public hide(): void {
    this.container.visible = false;
  }

  public destroy(): void {
    this.container.destroy();
  }
}
