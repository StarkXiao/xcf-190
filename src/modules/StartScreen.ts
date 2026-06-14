import * as PIXI from 'pixi.js';

export class StartScreen {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private onStartCallback?: () => void;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.app.stage.addChild(this.container);
    this.createScreen();
  }

  private createScreen(): void {
    const titleContainer = new PIXI.Container();
    titleContainer.x = this.app.screen.width / 2;
    titleContainer.y = this.app.screen.height / 3;
    
    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 48,
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
      fontSize: 28,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });
    
    const subtitle = new PIXI.Text('~ 告白诗篇 ~', subtitleStyle);
    subtitle.anchor.set(0.5);
    subtitle.y = 60;
    titleContainer.addChild(subtitle);
    
    this.container.addChild(titleContainer);
    
    const descriptionStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fill: 0xaaaaaa,
      align: 'center',
      lineHeight: 30
    });
    
    const description = new PIXI.Text(
      '跟随旋律点亮书页\n拼出属于你的告白诗句\n\n按下 D F J K 键或点击轨道开始游戏',
      descriptionStyle
    );
    description.anchor.set(0.5);
    description.x = this.app.screen.width / 2;
    description.y = this.app.screen.height / 2 + 50;
    this.container.addChild(description);
    
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = this.app.screen.width / 2;
    buttonContainer.y = this.app.screen.height - 120;
    
    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x6b9dff);
    buttonBg.drawRoundedRect(-120, -35, 240, 70, 15);
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
    
    const hintStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0x666666,
      align: 'center'
    });
    
    const hint = new PIXI.Text('按 D F J K 对应四个轨道', hintStyle);
    hint.anchor.set(0.5);
    hint.x = this.app.screen.width / 2;
    hint.y = this.app.screen.height - 50;
    this.container.addChild(hint);
    
    this.animateFloating(titleContainer);
    this.animateButton(buttonBg);
  }

  private animateFloating(container: PIXI.Container): void {
    let time = 0;
    const animate = () => {
      time += 0.02;
      container.y = this.app.screen.height / 3 + Math.sin(time) * 10;
      container.rotation = Math.sin(time * 0.5) * 0.02;
      if (this.container.visible) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  private animateButton(button: PIXI.Graphics): void {
    let time = 0;
    const animate = () => {
      time += 0.05;
      const scale = 1 + Math.sin(time) * 0.05;
      button.scale.set(scale);
      if (this.container.visible) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  private startGame(): void {
    if (this.onStartCallback) {
      this.onStartCallback();
    }
  }

  public setOnStartCallback(callback: () => void): void {
    this.onStartCallback = callback;
  }

  public show(): void {
    this.container.visible = true;
  }

  public hide(): void {
    this.container.visible = false;
  }

  public destroy(): void {
    this.container.destroy();
  }
}
