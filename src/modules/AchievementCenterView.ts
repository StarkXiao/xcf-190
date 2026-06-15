import * as PIXI from 'pixi.js';
import {
  AchievementCategory,
  AchievementLogEntry,
  AchievementRarity,
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_RARITY_LABELS,
  MissionLogEntry,
} from '../types';
import { AchievementSystem } from './AchievementSystem';

export type AchievementCenterCloseCallback = () => void;

type CenterTab = 'achievements' | 'daily' | 'weekly' | 'log';

const RARITY_NUMERIC_COLORS: Record<AchievementRarity, number> = {
  bronze: 0xcd7f32,
  silver: 0xc0c0c0,
  gold: 0xffd700,
  diamond: 0xb9f2ff,
};

export class AchievementCenterView {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private contentContainer: PIXI.Container;
  private scrollContainer: PIXI.Container;
  private scrollMask: PIXI.Graphics;
  private onCloseCallback?: AchievementCenterCloseCallback;

  private currentTab: CenterTab = 'achievements';
  private currentCategory: AchievementCategory | 'all' = 'all';
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private dragStartScrollY: number = 0;

  private tabBar: PIXI.Container;
  private categoryBar: PIXI.Container;
  private itemList: PIXI.Container;

  private readonly PANEL_WIDTH: number;
  private readonly PANEL_HEIGHT: number;
  private readonly PANEL_X: number;
  private readonly PANEL_Y: number;
  private readonly CONTENT_TOP: number = 110;
  private readonly CONTENT_BOTTOM_PADDING: number = 20;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.contentContainer = new PIXI.Container();
    this.scrollContainer = new PIXI.Container();
    this.scrollMask = new PIXI.Graphics();
    this.tabBar = new PIXI.Container();
    this.categoryBar = new PIXI.Container();
    this.itemList = new PIXI.Container();

    this.PANEL_WIDTH = Math.min(720, this.app.screen.width - 40);
    this.PANEL_HEIGHT = Math.min(850, this.app.screen.height - 80);
    this.PANEL_X = (this.app.screen.width - this.PANEL_WIDTH) / 2;
    this.PANEL_Y = (this.app.screen.height - this.PANEL_HEIGHT) / 2;

    this.container.visible = false;
    this.app.stage.addChild(this.container);
    this.createUI();
  }

  private createUI(): void {
    this.createBackground();
    this.createHeader();
    this.createTabBar();
    this.createCategoryBar();
    this.createScrollArea();
    this.createCloseButton();
  }

  private createBackground(): void {
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.85);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    mask.interactive = true;
    this.container.addChild(mask);

    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0x12122a, 0.98);
    panelBg.lineStyle(3, 0xffd700, 0.8);
    panelBg.drawRoundedRect(this.PANEL_X, this.PANEL_Y, this.PANEL_WIDTH, this.PANEL_HEIGHT, 16);
    panelBg.endFill();
    this.container.addChild(panelBg);

    this.contentContainer.x = this.PANEL_X;
    this.contentContainer.y = this.PANEL_Y;
    this.container.addChild(this.contentContainer);
  }

  private createHeader(): void {
    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });

    const title = new PIXI.Text('🏅 成就与任务', titleStyle);
    title.anchor.set(0.5);
    title.x = this.PANEL_WIDTH / 2;
    title.y = 30;
    this.contentContainer.addChild(title);

    const system = AchievementSystem.getInstance();
    const pointsStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0x6bff9d,
      align: 'center'
    });
    const points = new PIXI.Text(`成就点数: ${system.getAchievementPoints()}`, pointsStyle);
    points.anchor.set(0.5);
    points.x = this.PANEL_WIDTH / 2;
    points.y = 58;
    points.name = 'pointsDisplay';
    this.contentContainer.addChild(points);
  }

  private createTabBar(): void {
    this.tabBar.y = 78;
    this.contentContainer.addChild(this.tabBar);
    this.renderTabBar();
  }

  private renderTabBar(): void {
    this.tabBar.removeChildren();

    const tabs: { key: CenterTab; label: string; color: number }[] = [
      { key: 'achievements', label: '🎖 成就', color: 0xffd700 },
      { key: 'daily', label: '📋 每日', color: 0xff6b9d },
      { key: 'weekly', label: '📅 每周', color: 0x6b9dff },
      { key: 'log', label: '📖 日志', color: 0x9b59b6 },
    ];

    const tabWidth = (this.PANEL_WIDTH - 20) / tabs.length;
    const startX = 10;

    tabs.forEach((tab, i) => {
      const isActive = this.currentTab === tab.key;
      const btn = new PIXI.Graphics();

      if (isActive) {
        btn.beginFill(tab.color, 0.3);
        btn.lineStyle(2, tab.color, 1);
      } else {
        btn.beginFill(0x222244, 0.6);
        btn.lineStyle(1, 0x555577, 0.5);
      }
      btn.drawRoundedRect(startX + i * tabWidth + 3, 0, tabWidth - 6, 30, 8);
      btn.endFill();
      btn.interactive = true;
      btn.cursor = 'pointer';
      btn.on('pointerdown', () => {
        this.currentTab = tab.key;
        this.currentCategory = 'all';
        this.scrollY = 0;
        this.renderTabBar();
        this.renderCategoryBar();
        this.renderContent();
      });

      const style = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fontWeight: isActive ? 'bold' : 'normal',
        fill: isActive ? tab.color : 0xaaaacc,
        align: 'center'
      });

      const label = new PIXI.Text(tab.label, style);
      label.anchor.set(0.5);
      label.x = startX + i * tabWidth + tabWidth / 2;
      label.y = 15;
      btn.addChild(label);

      this.tabBar.addChild(btn);
    });
  }

  private createCategoryBar(): void {
    this.categoryBar.y = 112;
    this.contentContainer.addChild(this.categoryBar);
    this.renderCategoryBar();
  }

  private renderCategoryBar(): void {
    this.categoryBar.removeChildren();

    if (this.currentTab !== 'achievements') return;

    const categories: { key: AchievementCategory | 'all'; label: string }[] = [
      { key: 'all', label: '全部' },
      ...Object.entries(ACHIEVEMENT_CATEGORY_LABELS).map(([key, label]) => ({
        key: key as AchievementCategory,
        label,
      })),
    ];

    const itemWidth = 56;
    const totalWidth = categories.length * (itemWidth + 4);
    const startX = Math.max(10, (this.PANEL_WIDTH - totalWidth) / 2);

    categories.forEach((cat, i) => {
      const isActive = this.currentCategory === cat.key;
      const btn = new PIXI.Graphics();

      if (isActive) {
        btn.beginFill(0xffd700, 0.2);
        btn.lineStyle(1, 0xffd700, 0.8);
      } else {
        btn.beginFill(0x222244, 0.4);
        btn.lineStyle(1, 0x444466, 0.4);
      }
      btn.drawRoundedRect(startX + i * (itemWidth + 4), 0, itemWidth, 24, 6);
      btn.endFill();
      btn.interactive = true;
      btn.cursor = 'pointer';
      btn.on('pointerdown', () => {
        this.currentCategory = cat.key;
        this.scrollY = 0;
        this.renderCategoryBar();
        this.renderContent();
      });

      const style = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 11,
        fontWeight: isActive ? 'bold' : 'normal',
        fill: isActive ? 0xffd700 : 0x999999,
        align: 'center'
      });
      const text = new PIXI.Text(cat.label, style);
      text.anchor.set(0.5);
      text.x = startX + i * (itemWidth + 4) + itemWidth / 2;
      text.y = 12;
      btn.addChild(text);

      this.categoryBar.addChild(btn);
    });
  }

  private createScrollArea(): void {
    const top = this.CONTENT_TOP + 30;
    const height = this.PANEL_HEIGHT - top - this.CONTENT_BOTTOM_PADDING;

    this.scrollMask.beginFill(0xffffff);
    this.scrollMask.drawRect(this.PANEL_X, this.PANEL_Y + top, this.PANEL_WIDTH, height);
    this.scrollMask.endFill();
    this.container.addChild(this.scrollMask);

    this.scrollContainer.mask = this.scrollMask;
    this.scrollContainer.x = this.PANEL_X;
    this.scrollContainer.y = this.PANEL_Y + top;
    this.container.addChild(this.scrollContainer);

    this.itemList.x = 10;
    this.scrollContainer.addChild(this.itemList);

    this.setupScrollInput(top, height);
  }

  private setupScrollInput(top: number, height: number): void {
    const hitArea = new PIXI.Rectangle(this.PANEL_X, this.PANEL_Y + top, this.PANEL_WIDTH, height);
    this.scrollContainer.hitArea = hitArea;
    this.scrollContainer.interactive = true;

    this.scrollContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this.isDragging = true;
      this.dragStartY = e.global.y;
      this.dragStartScrollY = this.scrollY;
    });

    this.scrollContainer.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!this.isDragging) return;
      const dy = e.global.y - this.dragStartY;
      this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.dragStartScrollY - dy));
      this.itemList.y = -this.scrollY;
    });

    this.scrollContainer.on('pointerup', () => { this.isDragging = false; });
    this.scrollContainer.on('pointerupoutside', () => { this.isDragging = false; });

    this.scrollContainer.on('wheel', (e: PIXI.FederatedWheelEvent) => {
      const delta = e.deltaY || 0;
      this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + delta * 0.5));
      this.itemList.y = -this.scrollY;
    });
  }

  private renderContent(): void {
    this.itemList.removeChildren();

    switch (this.currentTab) {
      case 'achievements':
        this.renderAchievements();
        break;
      case 'daily':
        this.renderMissions('daily');
        break;
      case 'weekly':
        this.renderMissions('weekly');
        break;
      case 'log':
        this.renderLog();
        break;
    }
  }

  private renderAchievements(): void {
    const system = AchievementSystem.getInstance();
    const all = system.getAllAchievements();
    const filtered = this.currentCategory === 'all'
      ? all
      : all.filter(a => a.category === this.currentCategory);

    const itemHeight = 64;
    const gap = 6;
    let y = 0;

    const summaryStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: 0xaaaacc,
      align: 'left'
    });

    const unlocked = filtered.filter(a => {
      const state = system.getAchievementState(a.id);
      return state && state.isUnlocked;
    }).length;
    const summary = new PIXI.Text(`已解锁: ${unlocked} / ${filtered.length}`, summaryStyle);
    summary.x = 4;
    summary.y = y;
    this.itemList.addChild(summary);
    y += 24;

    for (const ach of filtered) {
      const state = system.getAchievementState(ach.id);
      const isUnlocked = state && state.isUnlocked;
      const progress = state ? state.progress : 0;

      const item = new PIXI.Graphics();
      const rarityColor = RARITY_NUMERIC_COLORS[ach.rarity] || 0xffffff;

      if (isUnlocked) {
        item.beginFill(rarityColor, 0.12);
        item.lineStyle(2, rarityColor, 0.6);
      } else {
        item.beginFill(0x1a1a2e, 0.6);
        item.lineStyle(1, 0x444466, 0.5);
      }
      item.drawRoundedRect(0, y, this.PANEL_WIDTH - 24, itemHeight, 10);
      item.endFill();

      if (!isUnlocked && ach.hidden) {
        const hiddenStyle = new PIXI.TextStyle({
          fontFamily: 'serif',
          fontSize: 16,
          fill: 0x555577,
          align: 'center'
        });
        const hiddenText = new PIXI.Text('???', hiddenStyle);
        hiddenText.anchor.set(0.5);
        hiddenText.x = (this.PANEL_WIDTH - 24) / 2;
        hiddenText.y = y + itemHeight / 2;
        item.addChild(hiddenText);
      } else {
        const rarityLabel = ACHIEVEMENT_RARITY_LABELS[ach.rarity];
        const badgeStyle = new PIXI.TextStyle({
          fontFamily: 'sans-serif',
          fontSize: 10,
          fontWeight: 'bold',
          fill: rarityColor,
        });
        const badge = new PIXI.Text(`[${rarityLabel}]`, badgeStyle);
        badge.x = 10;
        badge.y = y + 8;
        item.addChild(badge);

        const nameStyle = new PIXI.TextStyle({
          fontFamily: 'serif',
          fontSize: 16,
          fontWeight: 'bold',
          fill: isUnlocked ? 0xffffff : 0x999999,
        });
        const name = new PIXI.Text(ach.title, nameStyle);
        name.x = 10;
        name.y = y + 24;
        item.addChild(name);

        const descStyle = new PIXI.TextStyle({
          fontFamily: 'sans-serif',
          fontSize: 11,
          fill: isUnlocked ? 0xbbbbdd : 0x666688,
        });
        const desc = new PIXI.Text(ach.description, descStyle);
        desc.x = 10;
        desc.y = y + 44;
        item.addChild(desc);

        if (!isUnlocked) {
          const barBg = new PIXI.Graphics();
          barBg.beginFill(0x333355, 0.8);
          barBg.drawRoundedRect(10, y + itemHeight - 10, this.PANEL_WIDTH - 84, 4, 2);
          barBg.endFill();
          item.addChild(barBg);

          const barFill = new PIXI.Graphics();
          barFill.beginFill(rarityColor, 0.8);
          barFill.drawRoundedRect(10, y + itemHeight - 10, (this.PANEL_WIDTH - 84) * Math.max(progress, 0.02), 4, 2);
          barFill.endFill();
          item.addChild(barFill);

          const pctStyle = new PIXI.TextStyle({
            fontFamily: 'sans-serif',
            fontSize: 10,
            fill: 0x888888,
          });
          const pct = new PIXI.Text(`${Math.floor(progress * 100)}%`, pctStyle);
          pct.anchor.set(1, 0.5);
          pct.x = this.PANEL_WIDTH - 28;
          pct.y = y + itemHeight - 8;
          item.addChild(pct);
        } else {
          const rewardParts: string[] = [];
          if (ach.reward.coin) rewardParts.push(`🪙${ach.reward.coin}`);
          if (ach.reward.jade) rewardParts.push(`💎${ach.reward.jade}`);
          if (ach.reward.star) rewardParts.push(`⭐${ach.reward.star}`);
          if (rewardParts.length > 0) {
            const rewardStyle = new PIXI.TextStyle({
              fontFamily: 'sans-serif',
              fontSize: 11,
              fill: 0x6bff9d,
            });
            const rewardText = new PIXI.Text(rewardParts.join(' '), rewardStyle);
            rewardText.anchor.set(1, 0.5);
            rewardText.x = this.PANEL_WIDTH - 30;
            rewardText.y = y + 20;
            item.addChild(rewardText);
          }
        }
      }

      this.itemList.addChild(item);
      y += itemHeight + gap;
    }

    this.maxScrollY = Math.max(0, y - (this.PANEL_HEIGHT - this.CONTENT_TOP - 30 - this.CONTENT_BOTTOM_PADDING));
    this.scrollY = Math.min(this.scrollY, this.maxScrollY);
    this.itemList.y = -this.scrollY;
  }

  private renderMissions(type: 'daily' | 'weekly'): void {
    const system = AchievementSystem.getInstance();
    const missions = type === 'daily' ? system.getDailyMissions() : system.getWeeklyMissions();
    const periodStats = type === 'daily' ? system.getMissionState().dailyStats : system.getMissionState().weeklyStats;
    const resetLabel = type === 'daily' ? `每日 ${5}时刷新` : '每周一刷新';

    const itemHeight = 80;
    const gap = 8;
    let y = 0;

    const headerStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888899,
    });
    const header = new PIXI.Text(resetLabel, headerStyle);
    header.x = 4;
    header.y = y;
    this.itemList.addChild(header);
    y += 20;

    const statsStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 11,
      fill: 0x666688,
    });
    const statsText = new PIXI.Text(
      `${type === 'daily' ? '今日' : '本周'}: 演奏${periodStats.playCount}场 | 最高连击${periodStats.maxCombo} | ${periodStats.uniqueSongs.length}首不同曲目`,
      statsStyle
    );
    statsText.x = 4;
    statsText.y = y;
    this.itemList.addChild(statsText);
    y += 24;

    for (const { definition, progress } of missions) {
      const isCompleted = progress.isCompleted;
      const pct = Math.min(progress.currentValue / definition.targetValue, 1);

      const item = new PIXI.Graphics();
      const accentColor = type === 'daily' ? 0xff6b9d : 0x6b9dff;

      if (isCompleted) {
        item.beginFill(accentColor, 0.1);
        item.lineStyle(2, accentColor, 0.6);
      } else {
        item.beginFill(0x1a1a2e, 0.6);
        item.lineStyle(1, 0x444466, 0.5);
      }
      item.drawRoundedRect(0, y, this.PANEL_WIDTH - 24, itemHeight, 10);
      item.endFill();

      const typeLabel = type === 'daily' ? '日' : '周';
      const typeStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 10,
        fontWeight: 'bold',
        fill: accentColor,
      });
      const typeTag = new PIXI.Text(`[${typeLabel}]`, typeStyle);
      typeTag.x = 10;
      typeTag.y = y + 8;
      item.addChild(typeTag);

      const nameStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 15,
        fontWeight: 'bold',
        fill: isCompleted ? 0xffffff : 0xaaaaaa,
      });
      const name = new PIXI.Text(definition.title, nameStyle);
      name.x = 40;
      name.y = y + 6;
      item.addChild(name);

      const descStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 11,
        fill: isCompleted ? 0xbbbbdd : 0x666688,
      });
      const desc = new PIXI.Text(definition.description, descStyle);
      desc.x = 10;
      desc.y = y + 28;
      item.addChild(desc);

      const barWidth = this.PANEL_WIDTH - 84;
      const barBg = new PIXI.Graphics();
      barBg.beginFill(0x333355, 0.8);
      barBg.drawRoundedRect(10, y + 48, barWidth, 6, 3);
      barBg.endFill();
      item.addChild(barBg);

      const barFill = new PIXI.Graphics();
      barFill.beginFill(isCompleted ? accentColor : 0x5577aa, 0.9);
      barFill.drawRoundedRect(10, y + 48, barWidth * Math.max(pct, 0.02), 6, 3);
      barFill.endFill();
      item.addChild(barFill);

      const progressStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 11,
        fill: isCompleted ? accentColor : 0x888888,
      });
      const progressText = new PIXI.Text(
        isCompleted ? '✓ 已完成' : `${Math.floor(progress.currentValue)} / ${definition.targetValue}`,
        progressStyle
      );
      progressText.anchor.set(1, 0.5);
      progressText.x = this.PANEL_WIDTH - 30;
      progressText.y = y + 51;
      item.addChild(progressText);

      const rewardParts: string[] = [];
      if (definition.reward.coin) rewardParts.push(`🪙${definition.reward.coin}`);
      if (definition.reward.jade) rewardParts.push(`💎${definition.reward.jade}`);
      if (definition.reward.star) rewardParts.push(`⭐${definition.reward.star}`);
      if (rewardParts.length > 0) {
        const rewardStyle = new PIXI.TextStyle({
          fontFamily: 'sans-serif',
          fontSize: 11,
          fill: isCompleted ? 0x6bff9d : 0x557755,
        });
        const rewardText = new PIXI.Text(rewardParts.join(' '), rewardStyle);
        rewardText.anchor.set(1, 0.5);
        rewardText.x = this.PANEL_WIDTH - 30;
        rewardText.y = y + 14;
        item.addChild(rewardText);
      }

      this.itemList.addChild(item);
      y += itemHeight + gap;
    }

    this.maxScrollY = Math.max(0, y - (this.PANEL_HEIGHT - this.CONTENT_TOP - 30 - this.CONTENT_BOTTOM_PADDING));
    this.scrollY = Math.min(this.scrollY, this.maxScrollY);
    this.itemList.y = -this.scrollY;
  }

  private renderLog(): void {
    const system = AchievementSystem.getInstance();
    const achLogs = system.getLog();
    const misLogs = system.getMissionLog();

    const allLogs: Array<{ time: number; render: () => PIXI.Container }> = [];

    for (const entry of achLogs) {
      allLogs.push({
        time: entry.unlockedAt,
        render: () => this.renderAchLogEntry(entry),
      });
    }

    for (const entry of misLogs) {
      allLogs.push({
        time: entry.completedAt,
        render: () => this.renderMisLogEntry(entry),
      });
    }

    allLogs.sort((a, b) => b.time - a.time);

    let y = 0;

    if (allLogs.length === 0) {
      const emptyStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fill: 0x666688,
        align: 'center'
      });
      const empty = new PIXI.Text('暂无记录', emptyStyle);
      empty.anchor.set(0.5);
      empty.x = (this.PANEL_WIDTH - 24) / 2;
      empty.y = 40;
      this.itemList.addChild(empty);
    }

    for (const log of allLogs) {
      const entryContainer = log.render();
      entryContainer.y = y;
      this.itemList.addChild(entryContainer);
      y += 56;
    }

    this.maxScrollY = Math.max(0, y - (this.PANEL_HEIGHT - this.CONTENT_TOP - 30 - this.CONTENT_BOTTOM_PADDING));
    this.scrollY = Math.min(this.scrollY, this.maxScrollY);
    this.itemList.y = -this.scrollY;
  }

  private renderAchLogEntry(entry: AchievementLogEntry): PIXI.Container {
    const container = new PIXI.Container();
    const w = this.PANEL_WIDTH - 24;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a1a2e, 0.6);
    bg.lineStyle(1, 0x444466, 0.4);
    bg.drawRoundedRect(0, 0, w, 50, 8);
    bg.endFill();
    container.addChild(bg);

    const icon = new PIXI.Text('🎖', new PIXI.TextStyle({ fontSize: 18 }));
    icon.x = 8;
    icon.y = 6;
    container.addChild(icon);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffd700,
    });
    const title = new PIXI.Text(entry.title, titleStyle);
    title.x = 34;
    title.y = 6;
    container.addChild(title);

    const dateStr = this.formatTime(entry.unlockedAt);
    const dateStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 10,
      fill: 0x666688,
    });
    const date = new PIXI.Text(dateStr, dateStyle);
    date.x = 34;
    date.y = 28;
    container.addChild(date);

    const rewardParts: string[] = [];
    if (entry.rewards.coin) rewardParts.push(`🪙${entry.rewards.coin}`);
    if (entry.rewards.jade) rewardParts.push(`💎${entry.rewards.jade}`);
    if (entry.rewards.star) rewardParts.push(`⭐${entry.rewards.star}`);
    if (rewardParts.length > 0) {
      const rewardStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 11,
        fill: 0x6bff9d,
      });
      const rewardText = new PIXI.Text(rewardParts.join(' '), rewardStyle);
      rewardText.anchor.set(1, 0.5);
      rewardText.x = w - 10;
      rewardText.y = 25;
      container.addChild(rewardText);
    }

    return container;
  }

  private renderMisLogEntry(entry: MissionLogEntry): PIXI.Container {
    const container = new PIXI.Container();
    const w = this.PANEL_WIDTH - 24;

    const accentColor = entry.missionType === 'daily' ? 0xff6b9d : 0x6b9dff;
    const typeLabel = entry.missionType === 'daily' ? '日' : '周';

    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a1a2e, 0.6);
    bg.lineStyle(1, accentColor, 0.4);
    bg.drawRoundedRect(0, 0, w, 50, 8);
    bg.endFill();
    container.addChild(bg);

    const icon = new PIXI.Text('📋', new PIXI.TextStyle({ fontSize: 18 }));
    icon.x = 8;
    icon.y = 6;
    container.addChild(icon);

    const tagStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: 'bold',
      fill: accentColor,
    });
    const tag = new PIXI.Text(`[${typeLabel}]`, tagStyle);
    tag.x = 34;
    tag.y = 6;
    container.addChild(tag);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffffff,
    });
    const title = new PIXI.Text(entry.title, titleStyle);
    title.x = 62;
    title.y = 6;
    container.addChild(title);

    const dateStr = this.formatTime(entry.completedAt);
    const dateStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 10,
      fill: 0x666688,
    });
    const date = new PIXI.Text(dateStr, dateStyle);
    date.x = 34;
    date.y = 28;
    container.addChild(date);

    const rewardParts: string[] = [];
    if (entry.rewards.coin) rewardParts.push(`🪙${entry.rewards.coin}`);
    if (entry.rewards.jade) rewardParts.push(`💎${entry.rewards.jade}`);
    if (entry.rewards.star) rewardParts.push(`⭐${entry.rewards.star}`);
    if (rewardParts.length > 0) {
      const rewardStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 11,
        fill: 0x6bff9d,
      });
      const rewardText = new PIXI.Text(rewardParts.join(' '), rewardStyle);
      rewardText.anchor.set(1, 0.5);
      rewardText.x = w - 10;
      rewardText.y = 25;
      container.addChild(rewardText);
    }

    return container;
  }

  private formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private createCloseButton(): void {
    const btn = new PIXI.Graphics();
    btn.beginFill(0xff4444, 0.8);
    btn.lineStyle(2, 0xffffff, 0.4);
    btn.drawRoundedRect(this.PANEL_WIDTH - 50, 10, 40, 30, 8);
    btn.endFill();
    btn.interactive = true;
    btn.cursor = 'pointer';
    btn.on('pointerdown', () => this.hide());

    const style = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });
    const label = new PIXI.Text('✕', style);
    label.anchor.set(0.5);
    label.x = this.PANEL_WIDTH - 30;
    label.y = 25;
    btn.addChild(label);

    this.contentContainer.addChild(btn);
  }

  public setOnCloseCallback(callback: AchievementCenterCloseCallback): void {
    this.onCloseCallback = callback;
  }

  public show(): void {
    this.container.visible = true;
    this.scrollY = 0;
    this.itemList.y = 0;

    const system = AchievementSystem.getInstance();
    const pointsDisplay = this.contentContainer.getChildByName('pointsDisplay') as PIXI.Text;
    if (pointsDisplay) {
      pointsDisplay.text = `成就点数: ${system.getAchievementPoints()}`;
    }

    this.renderTabBar();
    this.renderCategoryBar();
    this.renderContent();
  }

  public hide(): void {
    this.container.visible = false;
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  public destroy(): void {
    this.container.destroy();
  }
}
