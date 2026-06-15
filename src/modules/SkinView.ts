import * as PIXI from 'pixi.js';
import {
  CosmeticItem,
  CosmeticType,
  CosmeticFilterType,
  CosmeticFilter,
  RARITY_COLORS,
  RARITY_LABELS,
  CURRENCY_ICONS,
  COSMETIC_TYPE_LABELS,
  CurrencyAmount
} from '../types';
import { SkinSystem } from './SkinSystem';
import { getCosmeticById } from '../data/cosmetics';

export type SkinCloseCallback = () => void;

export class SkinView {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private contentContainer: PIXI.Container;
  private onCloseCallback?: SkinCloseCallback;
  private visible: boolean = false;

  private selectedCategory: CosmeticType = 'theme';
  private selectedFilter: CosmeticFilterType = 'all';
  private selectedCosmetic?: CosmeticItem;
  private itemDetailPanel?: PIXI.Container;
  private itemListContainer: PIXI.Container;

  private removeSkinListener?: () => void;
  private removeUnlockListener?: () => void;

  private categories: Array<{ type: CosmeticType; icon: string; label: string }> = [
    { type: 'theme', icon: '🎨', label: '主题' },
    { type: 'track_effect', icon: '✨', label: '轨道' },
    { type: 'poem_frame', icon: '🖼️', label: '边框' },
    { type: 'note_skin', icon: '📜', label: '音符' },
    { type: 'combo_effect', icon: '💫', label: '连击' },
    { type: 'judge_effect', icon: '🎯', label: '判定' }
  ];

  private filters: Array<{ type: CosmeticFilterType; label: string }> = [
    { type: 'all', label: '全部' },
    { type: 'unlocked', label: '已拥有' },
    { type: 'locked', label: '未解锁' },
    { type: 'equipped', label: '已装备' }
  ];

  constructor(app: PIXI.Application) {
    this.app = app;
    this.container = new PIXI.Container();
    this.contentContainer = new PIXI.Container();
    this.itemListContainer = new PIXI.Container();
    this.container.visible = false;
    this.app.stage.addChild(this.container);
    this.createUI();
    this.setupListeners();
  }

  private setupListeners(): void {
    this.removeSkinListener = SkinSystem.addSkinChangeListener(() => {
      if (this.visible) {
        this.updateEquippedDisplay();
        this.updateItemList();
      }
    });

    this.removeUnlockListener = SkinSystem.addUnlockChangeListener(() => {
      if (this.visible) {
        this.updateItemList();
      }
    });
  }

  private createUI(): void {
    this.createBackground();
    this.createHeader();
    this.createCategoryTabs();
    this.createFilterTabs();
    this.createItemListArea();
    this.createEquippedDisplay();
    this.createCloseButton();
  }

  private createBackground(): void {
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.85);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    mask.interactive = true;
    this.container.addChild(mask);

    const panelWidth = Math.min(720, this.app.screen.width - 40);
    const panelHeight = Math.min(850, this.app.screen.height - 80);
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = (this.app.screen.height - panelHeight) / 2;

    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0x151530, 0.98);
    panelBg.lineStyle(3, 0xffd700, 0.8);
    panelBg.drawRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
    panelBg.endFill();
    this.container.addChild(panelBg);

    this.contentContainer.x = panelX;
    this.contentContainer.y = panelY;
    this.container.addChild(this.contentContainer);
  }

  private createHeader(): void {
    const panelWidth = Math.min(720, this.app.screen.width - 40);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x8b4513,
      strokeThickness: 2,
      align: 'center'
    });

    const title = new PIXI.Text('👗 幻化装扮', titleStyle);
    title.anchor.set(0.5);
    title.x = panelWidth / 2;
    title.y = 30;
    this.contentContainer.addChild(title);

    this.createCurrencyDisplay(panelWidth);
  }

  private createCurrencyDisplay(panelWidth: number): void {
    const currencyDisplay = new PIXI.Container();
    currencyDisplay.x = panelWidth - 20;
    currencyDisplay.y = 25;
    this.contentContainer.addChild(currencyDisplay);

    const currency = SkinSystem.getCurrency();
    const currencies: Array<{ key: keyof CurrencyAmount; icon: string }> = [
      { key: 'coin', icon: CURRENCY_ICONS.coin },
      { key: 'jade', icon: CURRENCY_ICONS.jade },
      { key: 'star', icon: CURRENCY_ICONS.star }
    ];

    let xOffset = 0;
    currencies.forEach(({ key, icon }) => {
      const value = currency[key];
      const textStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0xffffff,
        align: 'right'
      });

      const text = new PIXI.Text(`${icon} ${value.toLocaleString()}`, textStyle);
      text.anchor.set(1, 0);
      text.x = xOffset;
      currencyDisplay.addChild(text);
      xOffset -= text.width + 20;
    });
  }

  private createCategoryTabs(): void {
    const panelWidth = Math.min(720, this.app.screen.width - 40);
    const tabY = 70;
    const tabWidth = (panelWidth - 40) / this.categories.length;

    this.categories.forEach((cat, index) => {
      const tabContainer = new PIXI.Container();
      tabContainer.x = 20 + index * tabWidth;
      tabContainer.y = tabY;

      const isSelected = this.selectedCategory === cat.type;
      const bg = new PIXI.Graphics();
      
      if (isSelected) {
        bg.beginFill(0xffd700, 0.9);
        bg.lineStyle(2, 0xffffff, 0.8);
      } else {
        bg.beginFill(0x2a2a4a, 0.8);
        bg.lineStyle(1, 0x666688, 0.6);
      }
      
      bg.drawRoundedRect(0, 0, tabWidth - 4, 40, 8);
      bg.endFill();
      bg.interactive = true;
      bg.cursor = 'pointer';
      bg.on('pointerdown', () => {
        this.selectedCategory = cat.type;
        this.selectedCosmetic = undefined;
        this.createCategoryTabs();
        this.updateItemList();
        this.hideItemDetail();
      });

      tabContainer.addChild(bg);

      const iconStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 16,
        align: 'center'
      });

      const icon = new PIXI.Text(cat.icon, iconStyle);
      icon.anchor.set(0, 0.5);
      icon.x = 8;
      icon.y = 20;
      tabContainer.addChild(icon);

      const textStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 12,
        fontWeight: 'bold',
        fill: isSelected ? 0x000000 : 0xcccccc,
        align: 'left'
      });

      const text = new PIXI.Text(cat.label, textStyle);
      text.anchor.set(0, 0.5);
      text.x = 32;
      text.y = 20;
      tabContainer.addChild(text);

      this.contentContainer.addChild(tabContainer);
    });
  }

  private createFilterTabs(): void {
    const filterY = 120;

    const filterContainer = new PIXI.Container();
    filterContainer.x = 20;
    filterContainer.y = filterY;
    this.contentContainer.addChild(filterContainer);

    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: 0x888888,
      align: 'left'
    });

    const label = new PIXI.Text('筛选:', labelStyle);
    filterContainer.addChild(label);

    let xOffset = 50;
    this.filters.forEach((filter) => {
      const isSelected = this.selectedFilter === filter.type;
      const bg = new PIXI.Graphics();
      
      if (isSelected) {
        bg.beginFill(0x6b9dff, 0.9);
        bg.lineStyle(1, 0xffffff, 0.6);
      } else {
        bg.beginFill(0x2a2a4a, 0.6);
        bg.lineStyle(1, 0x555577, 0.4);
      }
      
      bg.drawRoundedRect(xOffset, -2, 70, 24, 6);
      bg.endFill();
      bg.interactive = true;
      bg.cursor = 'pointer';
      bg.on('pointerdown', () => {
        this.selectedFilter = filter.type;
        this.createFilterTabs();
        this.updateItemList();
      });

      filterContainer.addChild(bg);

      const textStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 11,
        fontWeight: 'bold',
        fill: isSelected ? 0xffffff : 0xaaaaaa,
        align: 'center'
      });

      const text = new PIXI.Text(filter.label, textStyle);
      text.anchor.set(0.5);
      text.x = xOffset + 35;
      text.y = 10;
      filterContainer.addChild(text);

      xOffset += 78;
    });

    const sortLabel = new PIXI.Text('排序:', labelStyle);
    sortLabel.x = xOffset + 10;
    sortLabel.y = 0;
    filterContainer.addChild(sortLabel);

    const sortBg = new PIXI.Graphics();
    sortBg.beginFill(0x2a2a4a, 0.6);
    sortBg.lineStyle(1, 0x555577, 0.4);
    sortBg.drawRoundedRect(xOffset + 55, -2, 70, 24, 6);
    sortBg.endFill();
    filterContainer.addChild(sortBg);

    const sortTextStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: 'bold',
      fill: 0xaaaaaa,
      align: 'center'
    });

    const sortText = new PIXI.Text('按稀有度', sortTextStyle);
    sortText.anchor.set(0.5);
    sortText.x = xOffset + 90;
    sortText.y = 10;
    filterContainer.addChild(sortText);
  }

  private createItemListArea(): void {
    const panelWidth = Math.min(720, this.app.screen.width - 40);
    const panelHeight = Math.min(850, this.app.screen.height - 80);
    
    this.itemListContainer.x = 20;
    this.itemListContainer.y = 160;
    this.contentContainer.addChild(this.itemListContainer);

    const listWidth = panelWidth - 320;
    const listHeight = panelHeight - 250;
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.01);
    mask.drawRect(0, 0, listWidth, listHeight);
    mask.endFill();
    this.itemListContainer.addChild(mask);
    this.itemListContainer.mask = mask;

    this.updateItemList();
  }

  private updateItemList(): void {
    this.itemListContainer.removeChildren();
    const panelWidth = Math.min(720, this.app.screen.width - 40);
    const listWidth = panelWidth - 320;

    const filter: CosmeticFilter = {
      type: this.selectedFilter as CosmeticFilterType,
      rarity: undefined
    };

    const items = SkinSystem.filterCosmetics(filter, 'rarity').filter(
      c => c.type === this.selectedCategory
    );

    if (items.length === 0) {
      this.createEmptyState(listWidth);
      return;
    }

    const columns = 2;
    const cardWidth = (listWidth - (columns - 1) * 10) / columns;
    const cardHeight = 90;

    items.forEach((cosmetic, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const card = this.createCosmeticCard(cosmetic, cardWidth, cardHeight);
      card.x = col * (cardWidth + 10);
      card.y = row * (cardHeight + 10);
      this.itemListContainer.addChild(card);
    });
  }

  private createEmptyState(width: number): void {
    const emptyStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: 0x888888,
      fontStyle: 'italic',
      align: 'center'
    });

    const text = new PIXI.Text('暂无物品~', emptyStyle);
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = 40;
    this.itemListContainer.addChild(text);
  }

  private createCosmeticCard(cosmetic: CosmeticItem, width: number, height: number): PIXI.Container {
    const card = new PIXI.Container();
    const isUnlocked = SkinSystem.isUnlocked(cosmetic.id);
    const isEquipped = SkinSystem.isEquipped(cosmetic.id);
    const isSelected = this.selectedCosmetic?.id === cosmetic.id;

    const bg = new PIXI.Graphics();
    const rarityColor = parseInt(RARITY_COLORS[cosmetic.rarity].replace('#', ''), 16);
    
    if (isSelected) {
      bg.lineStyle(3, 0xffd700, 1);
      bg.beginFill(0x2a2a5a, 0.9);
    } else if (isEquipped) {
      bg.lineStyle(2, 0x66ff99, 0.8);
      bg.beginFill(0x1a2a1a, 0.8);
    } else if (isUnlocked) {
      bg.lineStyle(2, rarityColor, 0.6);
      bg.beginFill(0x1a1a3a, 0.8);
    } else {
      bg.lineStyle(2, 0x444466, 0.4);
      bg.beginFill(0x1a1a2a, 0.6);
    }
    
    bg.drawRoundedRect(0, 0, width, height, 8);
    bg.endFill();
    bg.interactive = true;
    bg.cursor = 'pointer';
    bg.on('pointerdown', () => {
      this.selectedCosmetic = cosmetic;
      this.updateItemList();
      this.showItemDetail(cosmetic);
    });

    card.addChild(bg);

    const iconStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 24,
      align: 'center'
    });

    const typeIcons: Record<CosmeticType, string> = {
      theme: '🎨',
      track_effect: '✨',
      poem_frame: '🖼️',
      note_skin: '📜',
      combo_effect: '💫',
      judge_effect: '🎯'
    };

    const icon = new PIXI.Text(typeIcons[cosmetic.type], iconStyle);
    icon.anchor.set(0, 0.5);
    icon.x = 10;
    icon.y = height / 2;
    icon.alpha = isUnlocked ? 1 : 0.3;
    card.addChild(icon);

    const nameStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: isUnlocked ? 0xffffff : 0x666666,
      align: 'left',
      wordWrap: true,
      wordWrapWidth: width - 80
    });

    const name = new PIXI.Text(cosmetic.name, nameStyle);
    name.anchor.set(0, 0);
    name.x = 45;
    name.y = 12;
    card.addChild(name);

    const rarityStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: 'bold',
      fill: isUnlocked ? rarityColor : 0x444466,
      align: 'left'
    });

    const rarityLabel = new PIXI.Text(RARITY_LABELS[cosmetic.rarity], rarityStyle);
    rarityLabel.anchor.set(0, 0);
    rarityLabel.x = 45;
    rarityLabel.y = 45;
    card.addChild(rarityLabel);

    if (isEquipped) {
      const equippedStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 10,
        fontWeight: 'bold',
        fill: 0x66ff99,
        align: 'right'
      });

      const equippedLabel = new PIXI.Text('✓ 使用中', equippedStyle);
      equippedLabel.anchor.set(1, 1);
      equippedLabel.x = width - 8;
      equippedLabel.y = height - 8;
      card.addChild(equippedLabel);
    } else if (!isUnlocked) {
      const lockedStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 10,
        fontWeight: 'bold',
        fill: 0x888888,
        align: 'right'
      });

      const lockedLabel = new PIXI.Text('🔒 未解锁', lockedStyle);
      lockedLabel.anchor.set(1, 1);
      lockedLabel.x = width - 8;
      lockedLabel.y = height - 8;
      card.addChild(lockedLabel);
    }

    return card;
  }

  private createEquippedDisplay(): void {
    const panelWidth = Math.min(720, this.app.screen.width - 40);

    const equippedContainer = new PIXI.Container();
    equippedContainer.x = panelWidth - 280;
    equippedContainer.y = 160;
    this.contentContainer.addChild(equippedContainer);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffd700,
      align: 'left'
    });

    const title = new PIXI.Text('当前装扮', titleStyle);
    title.y = 0;
    equippedContainer.addChild(title);

    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a1a2e, 0.8);
    bg.lineStyle(2, 0x666688, 0.5);
    bg.drawRoundedRect(0, 25, 260, 300, 12);
    bg.endFill();
    equippedContainer.addChild(bg);

    this.updateEquippedDisplay(equippedContainer);
  }

  private updateEquippedDisplay(container?: PIXI.Container): void {
    const targetContainer = container || this.contentContainer.children.find(
      c => c.children && c.children.some(ch => (ch as PIXI.Text).text === '当前装扮')
    ) as PIXI.Container;
    
    if (!targetContainer) return;

    const childrenToRemove = targetContainer.children.filter(c => c.name === 'equipped_item');
    childrenToRemove.forEach(c => targetContainer.removeChild(c));

    const currentSkin = SkinSystem.getCurrentSkinIds();
    const equippedItems: Array<{ type: CosmeticType; id: string }> = [
      { type: 'theme', id: currentSkin.theme },
      { type: 'track_effect', id: currentSkin.trackEffect },
      { type: 'poem_frame', id: currentSkin.poemFrame },
      { type: 'note_skin', id: currentSkin.noteSkin },
      { type: 'combo_effect', id: currentSkin.comboEffect },
      { type: 'judge_effect', id: currentSkin.judgeEffect }
    ];

    const typeIcons: Record<CosmeticType, string> = {
      theme: '🎨',
      track_effect: '✨',
      poem_frame: '🖼️',
      note_skin: '📜',
      combo_effect: '💫',
      judge_effect: '🎯'
    };

    equippedItems.forEach((item, index) => {
      const cosmetic = getCosmeticById(item.id);
      if (!cosmetic) return;

      const itemContainer = new PIXI.Container();
      itemContainer.name = 'equipped_item';
      itemContainer.y = 35 + index * 45;
      targetContainer.addChild(itemContainer);

      const iconStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 18,
        align: 'center'
      });

      const icon = new PIXI.Text(typeIcons[item.type], iconStyle);
      icon.anchor.set(0, 0.5);
      icon.x = 15;
      icon.y = 15;
      itemContainer.addChild(icon);

      const typeLabelStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 10,
        fill: 0x888888,
        align: 'left'
      });

      const typeLabel = new PIXI.Text(COSMETIC_TYPE_LABELS[item.type], typeLabelStyle);
      typeLabel.anchor.set(0, 0);
      typeLabel.x = 45;
      typeLabel.y = 5;
      itemContainer.addChild(typeLabel);

      const rarityColor = parseInt(RARITY_COLORS[cosmetic.rarity].replace('#', ''), 16);
      const nameStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 12,
        fontWeight: 'bold',
        fill: rarityColor,
        align: 'left'
      });

      const name = new PIXI.Text(cosmetic.name, nameStyle);
      name.anchor.set(0, 0);
      name.x = 45;
      name.y = 18;
      itemContainer.addChild(name);

      if (index < equippedItems.length - 1) {
        const divider = new PIXI.Graphics();
        divider.lineStyle(1, 0x333355, 0.5);
        divider.moveTo(15, 42);
        divider.lineTo(245, 42);
        itemContainer.addChild(divider);
      }
    });
  }

  private showItemDetail(cosmetic: CosmeticItem): void {
    this.hideItemDetail();

    const panelWidth = Math.min(720, this.app.screen.width - 40);

    this.itemDetailPanel = new PIXI.Container();
    this.itemDetailPanel.x = panelWidth - 280;
    this.itemDetailPanel.y = 480;
    this.contentContainer.addChild(this.itemDetailPanel);

    this.updateItemDetail(cosmetic);
  }

  private updateItemDetail(cosmetic: CosmeticItem): void {
    if (!this.itemDetailPanel) return;
    this.itemDetailPanel.removeChildren();

    const detailWidth = 260;
    const isUnlocked = SkinSystem.isUnlocked(cosmetic.id);
    const isEquipped = SkinSystem.isEquipped(cosmetic.id);
    const rarityColor = parseInt(RARITY_COLORS[cosmetic.rarity].replace('#', ''), 16);

    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a1a2e, 0.98);
    bg.lineStyle(2, rarityColor, 0.8);
    bg.drawRoundedRect(0, 0, detailWidth, 280, 12);
    bg.endFill();
    this.itemDetailPanel.addChild(bg);

    const typeLabelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'left'
    });

    const typeLabel = new PIXI.Text(COSMETIC_TYPE_LABELS[cosmetic.type], typeLabelStyle);
    typeLabel.anchor.set(0, 0);
    typeLabel.x = 15;
    typeLabel.y = 15;
    this.itemDetailPanel.addChild(typeLabel);

    const rarityLabelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: rarityColor,
      align: 'right'
    });

    const rarityLabel = new PIXI.Text(RARITY_LABELS[cosmetic.rarity], rarityLabelStyle);
    rarityLabel.anchor.set(1, 0);
    rarityLabel.x = detailWidth - 15;
    rarityLabel.y = 15;
    this.itemDetailPanel.addChild(rarityLabel);

    const nameStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });

    const name = new PIXI.Text(cosmetic.name, nameStyle);
    name.anchor.set(0.5);
    name.x = detailWidth / 2;
    name.y = 50;
    this.itemDetailPanel.addChild(name);

    const descStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0xaaaaaa,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: detailWidth - 30,
      lineHeight: 16
    });

    const desc = new PIXI.Text(cosmetic.description, descStyle);
    desc.anchor.set(0.5, 0);
    desc.x = detailWidth / 2;
    desc.y = 80;
    this.itemDetailPanel.addChild(desc);

    const unlockStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 11,
      fill: isUnlocked ? 0x66ff99 : 0x888888,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: detailWidth - 30
    });

    const unlockLabel = isUnlocked 
      ? '✓ 已解锁' 
      : `获取方式: ${cosmetic.unlockCondition.description}`;
    const unlockText = new PIXI.Text(unlockLabel, unlockStyle);
    unlockText.anchor.set(0.5, 0);
    unlockText.x = detailWidth / 2;
    unlockText.y = 130;
    this.itemDetailPanel.addChild(unlockText);

    const buttonY = 180;
    const buttonBg = new PIXI.Graphics();
    
    if (!isUnlocked) {
      buttonBg.beginFill(0x555566, 0.8);
      buttonBg.lineStyle(1, 0x777777, 0.6);
    } else if (isEquipped) {
      buttonBg.beginFill(0x66ff99, 0.9);
      buttonBg.lineStyle(2, 0xffffff, 0.6);
    } else {
      buttonBg.beginFill(0x6b9dff, 0.9);
      buttonBg.lineStyle(2, 0xffffff, 0.6);
    }
    
    buttonBg.drawRoundedRect(20, buttonY, detailWidth - 40, 50, 10);
    buttonBg.endFill();
    buttonBg.interactive = isUnlocked && !isEquipped;
    buttonBg.cursor = isUnlocked && !isEquipped ? 'pointer' : 'default';
    
    if (isUnlocked && !isEquipped) {
      buttonBg.on('pointerdown', () => {
        SkinSystem.setSkin(cosmetic.type, cosmetic.id);
        this.updateItemDetail(cosmetic);
        this.updateItemList();
      });
    }
    
    this.itemDetailPanel.addChild(buttonBg);

    const buttonStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: !isUnlocked ? 0x888888 : (isEquipped ? 0x000000 : 0xffffff),
      align: 'center'
    });

    const buttonText = new PIXI.Text(
      !isUnlocked ? '未解锁' : (isEquipped ? '已装备' : '装备'),
      buttonStyle
    );
    buttonText.anchor.set(0.5);
    buttonText.x = detailWidth / 2;
    buttonText.y = buttonY + 25;
    this.itemDetailPanel.addChild(buttonText);

    if (isUnlocked && isEquipped) {
      const unequipButtonY = 240;
      const unequipButtonBg = new PIXI.Graphics();
      unequipButtonBg.beginFill(0xff6b6b, 0.8);
      unequipButtonBg.lineStyle(1, 0xffffff, 0.4);
      unequipButtonBg.drawRoundedRect(20, unequipButtonY, detailWidth - 40, 30, 8);
      unequipButtonBg.endFill();
      unequipButtonBg.interactive = true;
      unequipButtonBg.cursor = 'pointer';
      this.itemDetailPanel.addChild(unequipButtonBg);

      const unequipButtonStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 12,
        fontWeight: 'bold',
        fill: 0xffffff,
        align: 'center'
      });

      const unequipButtonText = new PIXI.Text('恢复默认', unequipButtonStyle);
      unequipButtonText.anchor.set(0.5);
      unequipButtonText.x = detailWidth / 2;
      unequipButtonText.y = unequipButtonY + 15;
      this.itemDetailPanel.addChild(unequipButtonText);
    }
  }

  private hideItemDetail(): void {
    if (this.itemDetailPanel) {
      this.contentContainer.removeChild(this.itemDetailPanel);
      this.itemDetailPanel.destroy();
      this.itemDetailPanel = undefined;
    }
  }

  private createCloseButton(): void {
    const panelWidth = Math.min(720, this.app.screen.width - 40);
    
    const closeBtn = new PIXI.Graphics();
    closeBtn.x = panelWidth - 20;
    closeBtn.y = 30;
    closeBtn.beginFill(0xff6b6b, 0.9);
    closeBtn.drawRoundedRect(-18, -18, 36, 36, 8);
    closeBtn.endFill();
    closeBtn.interactive = true;
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.hide());

    const closeStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center'
    });

    const closeText = new PIXI.Text('✕', closeStyle);
    closeText.anchor.set(0.5);
    closeBtn.addChild(closeText);
    this.contentContainer.addChild(closeBtn);
  }

  public setOnCloseCallback(callback: SkinCloseCallback): void {
    this.onCloseCallback = callback;
  }

  public show(): void {
    this.visible = true;
    this.container.visible = true;
    this.selectedCosmetic = undefined;
    this.hideItemDetail();
    this.updateItemList();
    this.updateEquippedDisplay();
  }

  public hide(): void {
    this.visible = false;
    this.container.visible = false;
    this.selectedCosmetic = undefined;
    this.hideItemDetail();
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  public destroy(): void {
    if (this.removeSkinListener) {
      this.removeSkinListener();
    }
    if (this.removeUnlockListener) {
      this.removeUnlockListener();
    }
    this.container.destroy();
  }
}
