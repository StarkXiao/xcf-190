import * as PIXI from 'pixi.js';
import { NoteData, JudgeResult } from '../types';

interface NoteMapping {
  lineIndex: number;
  charIndex: number;
  isSeparator: boolean;
}

interface CharDisplay {
  text: PIXI.Text;
  lineIndex: number;
  charIndex: number;
  hit: boolean;
  result: JudgeResult | null;
  crackMark?: PIXI.Graphics;
}

interface LineDisplay {
  container: PIXI.Container;
  chars: CharDisplay[];
  completed: boolean;
  totalNoteChars: number;
  hitCount: number;
  glowOverlay?: PIXI.Graphics;
  underline?: PIXI.Graphics;
}

interface RemedyFeedback {
  container: PIXI.Container;
  startTime: number;
  duration: number;
}

interface LineCompleteEffect {
  container: PIXI.Container;
  startTime: number;
  duration: number;
}

export class LyricProgress {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private lineDisplays: LineDisplay[] = [];
  private noteMap: Map<number, NoteMapping> = new Map();
  private totalNotes: number = 0;
  private judgedNotes: number = 0;
  private completedLines: number = 0;

  private progressBarBg: PIXI.Graphics;
  private progressFill: PIXI.Graphics;
  private progressMarker: PIXI.Graphics;

  private remedyFeedbacks: RemedyFeedback[] = [];
  private lineCompleteEffects: LineCompleteEffect[] = [];
  private consecutiveMisses: number = 0;
  private onLineCompleteCallback?: (lineIndex: number, totalLines: number) => void;

  private dimStyle: PIXI.TextStyle;
  private hitStyle: PIXI.TextStyle;
  private missStyle: PIXI.TextStyle;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.app.stage.addChild(this.container);

    this.progressBarBg = new PIXI.Graphics();
    this.progressFill = new PIXI.Graphics();
    this.progressMarker = new PIXI.Graphics();

    this.dimStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 22,
      fill: 0x444466,
      fontWeight: 'bold',
      align: 'center',
    });

    this.hitStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 22,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 2,
      dropShadow: true,
      dropShadowColor: 0xffd700,
      dropShadowBlur: 6,
      align: 'center',
    });

    this.missStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 22,
      fill: 0xff4444,
      fontWeight: 'bold',
      stroke: 0x661111,
      strokeThickness: 2,
      align: 'center',
    });
  }

  public initialize(notes: NoteData[], poemLines: string[]): void {
    this.clear();

    const relevantLines = this.filterRelevantLines(notes, poemLines);
    this.buildNoteMapping(notes, relevantLines);
    this.buildProgressUI();
    this.buildLineDisplays(relevantLines);
  }

  private filterRelevantLines(notes: NoteData[], poemLines: string[]): string[] {
    const flatText = poemLines.join('');
    const lyricsChars = notes.map(n => n.lyricChar);

    let flatIdx = 0;
    let usedLineEnd = 0;
    for (let i = 0; i < lyricsChars.length; i++) {
      const ch = lyricsChars[i];
      if (flatIdx < flatText.length && ch === flatText[flatIdx]) {
        flatIdx++;
        let accLen = 0;
        for (let li = 0; li < poemLines.length; li++) {
          accLen += poemLines[li].length;
          if (flatIdx <= accLen) {
            usedLineEnd = li;
            break;
          }
        }
      }
    }

    return poemLines.slice(0, usedLineEnd + 1);
  }

  private buildNoteMapping(notes: NoteData[], poemLines: string[]): void {
    this.noteMap.clear();
    this.totalNotes = notes.length;

    const flatText = poemLines.join('');
    const lineOffsets: number[] = [];
    let acc = 0;
    for (const line of poemLines) {
      lineOffsets.push(acc);
      acc += line.length;
    }

    let flatIdx = 0;
    let currentLine = 0;

    for (let noteIdx = 0; noteIdx < notes.length; noteIdx++) {
      const ch = notes[noteIdx].lyricChar;

      if (flatIdx < flatText.length && ch === flatText[flatIdx]) {
        while (
          currentLine < poemLines.length - 1 &&
          lineOffsets[currentLine + 1] <= flatIdx
        ) {
          currentLine++;
        }

        const charIdx = flatIdx - lineOffsets[currentLine];
        this.noteMap.set(noteIdx, {
          lineIndex: currentLine,
          charIndex: charIdx,
          isSeparator: false,
        });
        flatIdx++;
      } else {
        this.noteMap.set(noteIdx, {
          lineIndex: currentLine,
          charIndex: -1,
          isSeparator: true,
        });
      }
    }
  }

  private buildProgressUI(): void {
    const barWidth = this.app.screen.width - 40;
    const barHeight = 6;
    const barX = 20;
    const barY = 12;

    this.progressBarBg.clear();
    this.progressBarBg.beginFill(0x222244, 0.8);
    this.progressBarBg.drawRoundedRect(barX, barY, barWidth, barHeight, 3);
    this.progressBarBg.endFill();
    this.container.addChild(this.progressBarBg);

    this.progressFill.clear();
    this.progressFill.beginFill(0xffd700, 0.9);
    this.progressFill.drawRoundedRect(barX, barY, 0, barHeight, 3);
    this.progressFill.endFill();
    this.container.addChild(this.progressFill);

    this.progressMarker.clear();
    this.progressMarker.beginFill(0xffd700, 1);
    this.progressMarker.drawCircle(barX, barY + barHeight / 2, 5);
    this.progressMarker.endFill();
    this.container.addChild(this.progressMarker);
  }

  private buildLineDisplays(poemLines: string[]): void {
    this.lineDisplays = [];
    const startY = 42;
    const lineHeight = 36;
    const charSpacing = 28;

    for (let li = 0; li < poemLines.length; li++) {
      const lineContainer = new PIXI.Container();
      lineContainer.x = this.app.screen.width / 2;
      lineContainer.y = startY + li * lineHeight;

      const lineChars: CharDisplay[] = [];
      const lineText = poemLines[li];
      const lineLen = lineText.length;
      const lineStartX = -(lineLen - 1) * charSpacing / 2;

      for (let ci = 0; ci < lineLen; ci++) {
        const ch = lineText[ci];
        const text = new PIXI.Text(ch, this.dimStyle);
        text.anchor.set(0.5);
        text.x = lineStartX + ci * charSpacing;
        text.y = 0;
        lineContainer.addChild(text);

        lineChars.push({
          text,
          lineIndex: li,
          charIndex: ci,
          hit: false,
          result: null,
        });
      }

      const underline = new PIXI.Graphics();
      underline.lineStyle(1, 0x333355, 0.4);
      underline.moveTo(lineStartX - 10, 16);
      underline.lineTo(lineStartX + (lineLen - 1) * charSpacing + 10, 16);
      lineContainer.addChild(underline);

      const glowOverlay = new PIXI.Graphics();
      glowOverlay.beginFill(0xffd700, 0);
      glowOverlay.drawRoundedRect(
        lineStartX - 20,
        -22,
        (lineLen - 1) * charSpacing + 40,
        44,
        10
      );
      glowOverlay.endFill();
      lineContainer.addChildAt(glowOverlay, 0);

      this.container.addChild(lineContainer);

      let totalNoteChars = 0;
      this.noteMap.forEach(mapping => {
        if (mapping.lineIndex === li && !mapping.isSeparator) {
          totalNoteChars++;
        }
      });

      this.lineDisplays.push({
        container: lineContainer,
        chars: lineChars,
        completed: false,
        totalNoteChars,
        hitCount: 0,
        glowOverlay,
        underline,
      });
    }
  }

  public onNoteJudged(noteId: number, hit: boolean, result: JudgeResult): void {
    const mapping = this.noteMap.get(noteId);
    if (!mapping) return;

    this.judgedNotes++;
    this.updateProgressBar();

    if (mapping.isSeparator) {
      return;
    }

    const lineDisplay = this.lineDisplays[mapping.lineIndex];
    if (!lineDisplay) return;

    const charDisplay = lineDisplay.chars.find(
      c => c.charIndex === mapping.charIndex
    );
    if (!charDisplay || charDisplay.hit) return;

    charDisplay.result = result;

    if (hit) {
      charDisplay.hit = true;
      lineDisplay.hitCount++;
      this.consecutiveMisses = 0;

      this.animateCharLightUp(charDisplay, result);

      if (
        lineDisplay.hitCount >= lineDisplay.totalNoteChars &&
        !lineDisplay.completed
      ) {
        lineDisplay.completed = true;
        this.completedLines++;
        this.triggerLineComplete(mapping.lineIndex);

        if (this.onLineCompleteCallback) {
          this.onLineCompleteCallback(
            mapping.lineIndex,
            this.lineDisplays.length
          );
        }
      }
    } else {
      charDisplay.hit = false;
      this.consecutiveMisses++;
      this.animateCharBreak(charDisplay);
      this.showRemedyFeedback(mapping.lineIndex);
      this.showLineCrack(mapping.lineIndex);
    }
  }

  private animateCharLightUp(
    charDisplay: CharDisplay,
    result: JudgeResult
  ): void {
    const text = charDisplay.text;
    const startTime = Date.now();
    const duration = 400;

    const targetStyle =
      result === 'perfect'
        ? this.hitStyle
        : result === 'great'
          ? new PIXI.TextStyle({
              ...this.hitStyle,
              fill: 0x66ff66,
              dropShadowColor: 0x66ff66,
            })
          : result === 'good'
            ? new PIXI.TextStyle({
                ...this.hitStyle,
                fill: 0x66bbff,
                dropShadowColor: 0x66bbff,
              })
            : this.hitStyle;

    text.style = targetStyle;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const scale = progress < 0.3
        ? 1 + (1 - progress / 0.3) * 0.3
        : 1;
      text.scale.set(scale);
      text.alpha = 0.5 + eased * 0.5;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        text.scale.set(1);
        text.alpha = 1;
      }
    };
    animate();
  }

  private animateCharBreak(charDisplay: CharDisplay): void {
    const text = charDisplay.text;
    text.style = this.missStyle;
    text.text = '＿';

    if (charDisplay.crackMark) {
      charDisplay.crackMark.destroy();
    }

    const crack = new PIXI.Graphics();
    crack.lineStyle(2, 0xff4444, 0.9);
    crack.moveTo(-6, -8);
    crack.lineTo(0, 0);
    crack.lineTo(4, -6);
    crack.moveTo(0, 0);
    crack.lineTo(-3, 7);
    crack.moveTo(0, 0);
    crack.lineTo(6, 5);
    crack.x = text.x;
    crack.y = text.y;
    charDisplay.crackMark = crack;
    charDisplay.text.parent?.addChild(crack);

    const startTime = Date.now();
    const duration = 500;
    const baseX = text.x;
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const shake = progress < 0.3
        ? Math.sin(elapsed / 30) * 3 * (1 - progress / 0.3)
        : 0;
      text.x = baseX + shake;

      if (progress >= 1) {
        text.x = baseX;
        return;
      }
      requestAnimationFrame(animate);
    };
    animate();

    setTimeout(() => {
      if (charDisplay.crackMark && !charDisplay.crackMark.destroyed) {
        charDisplay.crackMark.alpha = 0.3;
      }
    }, 800);
  }

  private showRemedyFeedback(lineIndex: number): void {
    const lineDisplay = this.lineDisplays[lineIndex];
    if (!lineDisplay) return;

    const messages =
      this.consecutiveMisses <= 1
        ? ['继续!', '加油!', '别放弃!']
        : this.consecutiveMisses <= 3
          ? ['连击可恢复!', '稳住!', '下一句加油!']
          : ['深呼吸~', '慢慢来!', '节奏会回来的!'];

    const msg = messages[Math.floor(Math.random() * messages.length)];

    const fbContainer = new PIXI.Container();
    fbContainer.x = lineDisplay.container.x;
    fbContainer.y = lineDisplay.container.y - 30;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xff6b6b, 0.25);
    bg.lineStyle(1, 0xff6b6b, 0.6);
    bg.drawRoundedRect(-40, -14, 80, 28, 8);
    bg.endFill();
    fbContainer.addChild(bg);

    const style = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xff9d9d,
      stroke: 0x441111,
      strokeThickness: 1,
      align: 'center',
    });

    const fbText = new PIXI.Text(msg, style);
    fbText.anchor.set(0.5);
    fbContainer.addChild(fbText);

    this.container.addChild(fbContainer);

    this.remedyFeedbacks.push({
      container: fbContainer,
      startTime: Date.now(),
      duration: 1800,
    });
  }

  private showLineCrack(lineIndex: number): void {
    const lineDisplay = this.lineDisplays[lineIndex];
    if (!lineDisplay || !lineDisplay.underline) return;

    const underline = lineDisplay.underline;
    underline.clear();
    underline.lineStyle(2, 0xff4444, 0.7);
    underline.moveTo(-200, 16);

    const crackPoints = 5;
    for (let i = 1; i <= crackPoints; i++) {
      const x = -200 + i * (400 / crackPoints);
      const y = 16 + (Math.random() - 0.5) * 6;
      underline.lineTo(x, y);
    }

    setTimeout(() => {
      if (lineDisplay.completed) return;
      if (underline.destroyed) return;
      underline.clear();
      underline.lineStyle(1, 0x333355, 0.4);
      const lineLen = lineDisplay.chars.length;
      const charSpacing = 28;
      const lineStartX = -(lineLen - 1) * charSpacing / 2;
      underline.moveTo(lineStartX - 10, 16);
      underline.lineTo(lineStartX + (lineLen - 1) * charSpacing + 10, 16);
    }, 1200);
  }

  private triggerLineComplete(lineIndex: number): void {
    const lineDisplay = this.lineDisplays[lineIndex];
    if (!lineDisplay) return;

    if (lineDisplay.underline && !lineDisplay.underline.destroyed) {
      lineDisplay.underline.clear();
      lineDisplay.underline.lineStyle(2, 0xffd700, 0.8);
      const lineLen = lineDisplay.chars.length;
      const charSpacing = 28;
      const lineStartX = -(lineLen - 1) * charSpacing / 2;
      lineDisplay.underline.moveTo(lineStartX - 10, 16);
      lineDisplay.underline.lineTo(
        lineStartX + (lineLen - 1) * charSpacing + 10,
        16
      );
    }

    if (lineDisplay.glowOverlay) {
      const startTime = Date.now();
      const duration = 1500;
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const alpha = progress < 0.3
          ? (progress / 0.3) * 0.3
          : 0.3 * (1 - (progress - 0.3) / 0.7);
        lineDisplay.glowOverlay?.clear();
        if (lineDisplay.glowOverlay && !lineDisplay.glowOverlay.destroyed) {
          const lineLen = lineDisplay.chars.length;
          const charSpacing = 28;
          const lineStartX = -(lineLen - 1) * charSpacing / 2;
          lineDisplay.glowOverlay.beginFill(0xffd700, alpha);
          lineDisplay.glowOverlay.drawRoundedRect(
            lineStartX - 20,
            -22,
            (lineLen - 1) * charSpacing + 40,
            44,
            10
          );
          lineDisplay.glowOverlay.endFill();
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }

    const effectContainer = new PIXI.Container();
    effectContainer.x = lineDisplay.container.x;
    effectContainer.y = lineDisplay.container.y;

    const sparkleCount = 12;
    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = new PIXI.Graphics();
      sparkle.beginFill(0xffd700, 0.9);
      sparkle.drawCircle(0, 0, 2 + Math.random() * 2);
      sparkle.endFill();

      const angle = (Math.PI * 2 * i) / sparkleCount;
      sparkle.x = Math.cos(angle) * 30;
      sparkle.y = Math.sin(angle) * 10;
      effectContainer.addChild(sparkle);
    }

    this.container.addChild(effectContainer);
    this.lineCompleteEffects.push({
      container: effectContainer,
      startTime: Date.now(),
      duration: 1200,
    });
  }

  private updateProgressBar(): void {
    const progress = this.totalNotes > 0 ? this.judgedNotes / this.totalNotes : 0;
    const barWidth = this.app.screen.width - 40;
    const fillWidth = barWidth * progress;

    const lineProgress = this.lineDisplays.length > 0
      ? this.completedLines / this.lineDisplays.length
      : 0;
    const glowColor = lineProgress >= 0.75 ? 0xffd700 : lineProgress >= 0.5 ? 0x66ff66 : lineProgress >= 0.25 ? 0x66bbff : 0xffd700;

    this.progressFill.clear();
    this.progressFill.beginFill(glowColor, 0.9);
    this.progressFill.drawRoundedRect(20, 12, fillWidth, 6, 3);
    this.progressFill.endFill();

    this.progressMarker.clear();
    this.progressMarker.beginFill(glowColor, 1);
    this.progressMarker.drawCircle(20 + fillWidth, 15, 5);
    this.progressMarker.endFill();
  }

  public update(): void {
    const now = Date.now();

    this.remedyFeedbacks = this.remedyFeedbacks.filter(fb => {
      const elapsed = now - fb.startTime;
      const progress = elapsed / fb.duration;

      if (progress >= 1) {
        this.container.removeChild(fb.container);
        fb.container.destroy();
        return false;
      }

      fb.container.alpha = 1 - Math.pow(progress, 2);
      fb.container.y -= 0.3;

      return true;
    });

    this.lineCompleteEffects = this.lineCompleteEffects.filter(effect => {
      const elapsed = now - effect.startTime;
      const progress = elapsed / effect.duration;

      if (progress >= 1) {
        this.container.removeChild(effect.container);
        effect.container.destroy();
        return false;
      }

      effect.container.alpha = 1 - progress;

      effect.container.children.forEach((child, i) => {
        const angle = (Math.PI * 2 * i) / effect.container.children.length;
        const dist = 30 + progress * 80;
        child.x = Math.cos(angle) * dist;
        child.y = Math.sin(angle) * dist * 0.4;
        child.alpha = 1 - progress;
        child.scale.set(1 - progress * 0.5);
      });

      return true;
    });
  }

  public setOnLineCompleteCallback(
    callback: (lineIndex: number, totalLines: number) => void
  ): void {
    this.onLineCompleteCallback = callback;
  }

  public clear(): void {
    this.container.removeChildren();
    this.lineDisplays = [];
    this.noteMap.clear();
    this.totalNotes = 0;
    this.judgedNotes = 0;
    this.completedLines = 0;
    this.consecutiveMisses = 0;
    this.remedyFeedbacks = [];
    this.lineCompleteEffects = [];

    this.progressBarBg = new PIXI.Graphics();
    this.progressFill = new PIXI.Graphics();
    this.progressMarker = new PIXI.Graphics();
  }

  public reset(): void {
    this.clear();
  }

  public setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  public destroy(): void {
    this.container.destroy();
  }
}
