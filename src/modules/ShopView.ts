import * as PIXI from 'pixi.js';
import {
  ShopItem,
  CosmeticType,
  CurrencyAmount,
  RARITY_COLORS,
  RARITY_LABELS,
  CURRENCY_ICONS,
  COSMETIC_TYPE_LABELS
} from '../types';
import { ShopSystem, PurchaseResult } from './ShopSystem';
import { SkinSystem } from './SkinSystem';
import { getCosmeticById } from '../data/cosmetics';

export type ShopCloseCallback = () => void;

export class ShopView {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private contentContainer: PIXI.Container;
  private onCloseCallback?: ShopCloseCallback;
  private visible: boolean = false;

  private currencyDisplay?: PIXI.Container;
  private selectedTab: CosmeticType | 'all' = 'all';
  private selectedItem?: ShopItem;
  private itemDetailPanel?: PIXI.Container;
  private itemListContainer: PIXI.Container;

  private removeShopListener?: () => void;
  private removeCurrencyListener?: () => void;

  private tabs: Array<{ key: CosmeticType | 'all'; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'theme', label: '主题' },
    { key: 'track_effect', label: '轨道' },
    { key: 'poem_frame', label: '边框' },
    { key: 'note_skin', label: '音符' },
    { key: 'combo_effect', label: '连击' },
    { key: 'judge_effect', label: '判定' }
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
    this.removeShopListener = ShopSystem.addChangeListener(() => {
      if (this.visible) {
        this.updateItemList();
        this.updateCurrencyDisplay();
      }
    });

    this.removeCurrencyListener = SkinSystem.addCurrencyChangeListener(() => {
      if (this.visible) {
        this.updateCurrencyDisplay();
        if (this.selectedItem) {
          this.updateItemDetail(this.selectedItem);
        }
      }
    });
  }

  private createUI(): void {
    this.createBackground();
    this.createHeader();
    this.createTabs();
    this.createItemListArea();
    this.createCloseButton();
  }

  private createBackground(): void {
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.85);
    mask.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    mask.endFill();
    mask.interactive = true;
    this.container.addChild(mask);

    const panelWidth = Math.min(700, this.app.screen.width - 40);
    const panelHeight = Math.min(800, this.app.screen.height - 80);
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
    const panelWidth = Math.min(700, this.app.screen.width - 40);

    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: 0xffd700,
      stroke: 0x8b4513,
      strokeThickness: 2,
      align: 'center'
    });

    const title = new PIXI.Text('🏪 幻化商城', titleStyle);
    title.anchor.set(0.5);
    title.x = panelWidth / 2;
    title.y = 30;
    this.contentContainer.addChild(title);

    this.createCurrencyDisplay(panelWidth);
  }

  private createCurrencyDisplay(panelWidth: number): void {
    this.currencyDisplay = new PIXI.Container();
    this.currencyDisplay.x = panelWidth - 20;
    this.currencyDisplay.y = 25;
    this.contentContainer.addChild(this.currencyDisplay);
    this.updateCurrencyDisplay();
  }

  private updateCurrencyDisplay(): void {
    if (!this.currencyDisplay) return;
    this.currencyDisplay.removeChildren();

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
      this.currencyDisplay!.addChild(text);
      xOffset -= text.width + 20;
    });
  }

  private createTabs(): void {
    const panelWidth = Math.min(700, this.app.screen.width - 40);
    const tabY = 70;
    const tabWidth = (panelWidth - 40) / this.tabs.length;

    this.tabs.forEach((tab, index) => {
      const tabContainer = new PIXI.Container();
      tabContainer.x = 20 + index * tabWidth;
      tabContainer.y = tabY;

      const isSelected = this.selectedTab === tab.key;
      const bg = new PIXI.Graphics();
      
      if (isSelected) {
        bg.beginFill(0xffd700, 0.9);
        bg.lineStyle(2, 0xffffff, 0.8);
      } else {
        bg.beginFill(0x2a2a4a, 0.8);
        bg.lineStyle(1, 0x666688, 0.6);
      }
      
      bg.drawRoundedRect(0, 0, tabWidth - 4, 36, 8);
      bg.endFill();
      bg.interactive = true;
      bg.cursor = 'pointer';
      bg.on('pointerdown', () => {
        this.selectedTab = tab.key;
        this.selectedItem = undefined;
        this.createTabs();
        this.updateItemList();
        this.hideItemDetail();
      });

      tabContainer.addChild(bg);

      const textStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: isSelected ? 0x000000 : 0xcccccc,
        align: 'center'
      });

      const text = new PIXI.Text(tab.label, textStyle);
      text.anchor.set(0.5);
      text.x = tabWidth / 2 - 2;
      text.y = 18;
      tabContainer.addChild(text);

      this.contentContainer.addChild(tabContainer);
    });
  }

  private createItemListArea(): void {
    const panelWidth = Math.min(700, this.app.screen.width - 40);
    const panelHeight = Math.min(800, this.app.screen.height - 80);
    
    this.itemListContainer.x = 20;
    this.itemListContainer.y = 120;
    this.contentContainer.addChild(this.itemListContainer);

    const listHeight = panelHeight - 200;
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.01);
    mask.drawRect(0, 0, panelWidth - 40, listHeight);
    mask.endFill();
    this.itemListContainer.addChild(mask);
    this.itemListContainer.mask = mask;

    this.updateItemList();
  }

  private updateItemList(): void {
    this.itemListContainer.removeChildren();
    const panelWidth = Math.min(700, this.app.screen.width - 40);
    const listWidth = panelWidth - 40;

    let items = ShopSystem.getShopItems();
    
    if (this.selectedTab !== 'all') {
      items = items.filter(item => item.cosmeticType === this.selectedTab);
    }

    if (items.length === 0) {
      this.createEmptyState(listWidth);
      return;
    }

    const columns = 3;
    const cardWidth = (listWidth - (columns - 1) * 12) / columns;
    const cardHeight = 180;

    items.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const card = this.createShopItemCard(item, cardWidth, cardHeight);
      card.x = col * (cardWidth + 12);
      card.y = row * (cardHeight + 12);
      this.itemListContainer.addChild(card);
    });
  }

  private createEmptyState(width: number): void {
    const emptyStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fill: 0x888888,
      fontStyle: 'italic',
      align: 'center'
    });

    const text = new PIXI.Text('暂无商品~', emptyStyle);
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = 60;
    this.itemListContainer.addChild(text);
  }

  private createShopItemCard(item: ShopItem, width: number, height: number): PIXI.Container {
    const card = new PIXI.Container();
    const cosmetic = getCosmeticById(item.cosmeticId);
    
    if (!cosmetic) return card;

    const isOwned = SkinSystem.isUnlocked(item.cosmeticId);
    const canPurchase = ShopSystem.canPurchase(item);
    const isSelected = this.selectedItem?.id === item.id;

    const bg = new PIXI.Graphics();
    const rarityColor = parseInt(RARITY_COLORS[cosmetic.rarity].replace('#', ''), 16);
    
    if (isSelected) {
      bg.lineStyle(3, 0xffd700, 1);
      bg.beginFill(0x2a2a5a, 0.9);
    } else if (isOwned) {
      bg.lineStyle(2, 0x66ff99, 0.6);
      bg.beginFill(0x1a2a1a, 0.8);
    } else {
      bg.lineStyle(2, rarityColor, 0.6);
      bg.beginFill(0x1a1a3a, 0.8);
    }
    
    bg.drawRoundedRect(0, 0, width, height, 10);
    bg.endFill();
    bg.interactive = true;
    bg.cursor = 'pointer';
    bg.on('pointerdown', () => {
      this.selectedItem = item;
      this.updateItemList();
      this.showItemDetail(item);
    });

    card.addChild(bg);

    const rarityLabelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: 'bold',
      fill: rarityColor,
      align: 'left'
    });

    const rarityLabel = new PIXI.Text(RARITY_LABELS[cosmetic.rarity], rarityLabelStyle);
    rarityLabel.x = 10;
    rarityLabel.y = 8;
    card.addChild(rarityLabel);

    if (item.discount && item.discount > 0) {
      const discountStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 10,
        fontWeight: 'bold',
        fill: 0xff6b6b,
        align: 'right'
      });

      const discountLabel = new PIXI.Text(`-${item.discount}%`, discountStyle);
      discountLabel.anchor.set(1, 0);
      discountLabel.x = width - 10;
      discountLabel.y = 8;
      card.addChild(discountLabel);
    }

    if (isOwned) {
      const ownedStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 10,
        fontWeight: 'bold',
        fill: 0x66ff99,
        align: 'right'
      });

      const ownedLabel = new PIXI.Text('✓ 已拥有', ownedStyle);
      ownedLabel.anchor.set(1, 0);
      ownedLabel.x = width - 10;
      ownedLabel.y = 8;
      card.addChild(ownedLabel);
    }

    const iconStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 28,
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

    const icon = new PIXI.Text(typeIcons[item.cosmeticType], iconStyle);
    icon.anchor.set(0.5);
    icon.x = width / 2;
    icon.y = height / 2 - 15;
    card.addChild(icon);

    const nameStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: width - 16
    });

    const name = new PIXI.Text(cosmetic.name, nameStyle);
    name.anchor.set(0.5);
    name.x = width / 2;
    name.y = height - 45;
    card.addChild(name);

    if (!isOwned) {
      const price = ShopSystem.getCurrentPrice(item);
      const priceText = ShopSystem.getPriceString(price);
      const priceStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: canPurchase ? 0xffd700 : 0x888888,
        align: 'center'
      });

      const priceLabel = new PIXI.Text(priceText, priceStyle);
      priceLabel.anchor.set(0.5);
      priceLabel.x = width / 2;
      priceLabel.y = height - 22;
      card.addChild(priceLabel);
    }

    return card;
  }

  private showItemDetail(item: ShopItem): void {
    this.hideItemDetail();

    const panelWidth = Math.min(700, this.app.screen.width - 40);
    const cosmetic = getCosmeticById(item.cosmeticId);
    
    if (!cosmetic) return;

    this.itemDetailPanel = new PIXI.Container();
    this.itemDetailPanel.x = panelWidth - 20;
    this.itemDetailPanel.y = 120;
    this.contentContainer.addChild(this.itemDetailPanel);

    this.updateItemDetail(item);
  }

  private updateItemDetail(item: ShopItem): void {
    if (!this.itemDetailPanel) return;
    this.itemDetailPanel.removeChildren();

    const detailWidth = 260;
    const cosmetic = getCosmeticById(item.cosmeticId);
    
    if (!cosmetic) return;

    const isOwned = SkinSystem.isUnlocked(item.cosmeticId);
    const canPurchase = ShopSystem.canPurchase(item);
    const currentPrice = ShopSystem.getCurrentPrice(item);
    const rarityColor = parseInt(RARITY_COLORS[cosmetic.rarity].replace('#', ''), 16);

    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a1a2e, 0.98);
    bg.lineStyle(2, rarityColor, 0.8);
    bg.drawRoundedRect(-detailWidth, 0, detailWidth, 400, 12);
    bg.endFill();
    this.itemDetailPanel.addChild(bg);

    const typeLabelStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'left'
    });

    const typeLabel = new PIXI.Text(COSMETIC_TYPE_LABELS[item.cosmeticType], typeLabelStyle);
    typeLabel.anchor.set(0, 0);
    typeLabel.x = -detailWidth + 15;
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
    rarityLabel.x = -15;
    rarityLabel.y = 15;
    this.itemDetailPanel.addChild(rarityLabel);

    const nameStyle = new PIXI.TextStyle({
      fontFamily: 'serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'center'
    });

    const name = new PIXI.Text(cosmetic.name, nameStyle);
    name.anchor.set(0.5);
    name.x = -detailWidth / 2;
    name.y = 50;
    this.itemDetailPanel.addChild(name);

    const descStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: 0xaaaaaa,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: detailWidth - 30,
      lineHeight: 18
    });

    const desc = new PIXI.Text(cosmetic.description, descStyle);
    desc.anchor.set(0.5, 0);
    desc.x = -detailWidth / 2;
    desc.y = 85;
    this.itemDetailPanel.addChild(desc);

    const unlockStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x888888,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: detailWidth - 30
    });

    const unlockText = new PIXI.Text(`获取方式: ${cosmetic.unlockCondition.description}`, unlockStyle);
    unlockText.anchor.set(0.5, 0);
    unlockText.x = -detailWidth / 2;
    unlockText.y = 150;
    this.itemDetailPanel.addChild(unlockText);

    if (item.discount && item.discount > 0 && !isOwned) {
      const originalPrice = ShopSystem.getPriceString(item.price);
      const originalStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fill: 0x888888,
        align: 'center'
      });

      const originalLabel = new PIXI.Text(originalPrice, originalStyle);
      originalLabel.anchor.set(0.5);
      originalLabel.x = -detailWidth / 2;
      originalLabel.y = 200;
      this.itemDetailPanel.addChild(originalLabel);

      const strikeThrough = new PIXI.Graphics();
      strikeThrough.lineStyle(1, 0x888888, 0.8);
      strikeThrough.moveTo(originalLabel.x - originalLabel.width / 2, 200);
      strikeThrough.lineTo(originalLabel.x + originalLabel.width / 2, 200);
      this.itemDetailPanel.addChild(strikeThrough);
    }

    if (!isOwned) {
      const priceText = ShopSystem.getPriceString(currentPrice);
      const priceStyle = new PIXI.TextStyle({
        fontFamily: 'monospace',
        fontSize: 20,
        fontWeight: 'bold',
        fill: canPurchase ? 0xffd700 : 0x888888,
        align: 'center'
      });

      const priceLabel = new PIXI.Text(priceText, priceStyle);
      priceLabel.anchor.set(0.5);
      priceLabel.x = -detailWidth / 2;
      priceLabel.y = item.discount ? 230 : 210;
      this.itemDetailPanel.addChild(priceLabel);

      const buttonY = 280;
      const buttonBg = new PIXI.Graphics();
      
      if (canPurchase) {
        buttonBg.beginFill(0xffd700, 0.9);
        buttonBg.lineStyle(2, 0xffffff, 0.6);
      } else {
        buttonBg.beginFill(0x555566, 0.8);
        buttonBg.lineStyle(1, 0x777777, 0.6);
      }
      
      buttonBg.drawRoundedRect(-detailWidth + 25, buttonY, detailWidth - 50, 50, 10);
      buttonBg.endFill();
      buttonBg.interactive = canPurchase;
      buttonBg.cursor = canPurchase ? 'pointer' : 'default';
      
      if (canPurchase) {
        buttonBg.on('pointerdown', () => this.handlePurchase(item));
      }
      
      this.itemDetailPanel.addChild(buttonBg);

      const buttonStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 18,
        fontWeight: 'bold',
        fill: canPurchase ? 0x000000 : 0x888888,
        align: 'center'
      });

      const buttonText = new PIXI.Text(
        canPurchase ? '购买' : (isOwned ? '已拥有' : '余额不足'),
        buttonStyle
      );
      buttonText.anchor.set(0.5);
      buttonText.x = -detailWidth / 2;
      buttonText.y = buttonY + 25;
      this.itemDetailPanel.addChild(buttonText);
    } else {
      const ownedStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 18,
        fontWeight: 'bold',
        fill: 0x66ff99,
        align: 'center'
      });

      const ownedLabel = new PIXI.Text('✓ 已拥有此物品', ownedStyle);
      ownedLabel.anchor.set(0.5);
      ownedLabel.x = -detailWidth / 2;
      ownedLabel.y = 260;
      this.itemDetailPanel.addChild(ownedLabel);

      const isEquipped = SkinSystem.isEquipped(cosmetic.id);
      const equipButtonY = 300;
      const equipButtonBg = new PIXI.Graphics();
      
      if (isEquipped) {
        equipButtonBg.beginFill(0x66ff99, 0.9);
        equipButtonBg.lineStyle(2, 0xffffff, 0.6);
      } else {
        equipButtonBg.beginFill(0x6b9dff, 0.9);
        equipButtonBg.lineStyle(2, 0xffffff, 0.6);
      }
      
      equipButtonBg.drawRoundedRect(-detailWidth + 25, equipButtonY, detailWidth - 50, 50, 10);
      equipButtonBg.endFill();
      equipButtonBg.interactive = true;
      equipButtonBg.cursor = 'pointer';
      equipButtonBg.on('pointerdown', () => {
        if (!isEquipped) {
          SkinSystem.setSkin(cosmetic.type, cosmetic.id);
          this.updateItemDetail(item);
        }
      });
      
      this.itemDetailPanel.addChild(equipButtonBg);

      const equipButtonStyle = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 18,
        fontWeight: 'bold',
        fill: isEquipped ? 0x000000 : 0xffffff,
        align: 'center'
      });

      const equipButtonText = new PIXI.Text(
        isEquipped ? '已装备' : '装备',
        equipButtonStyle
      );
      equipButtonText.anchor.set(0.5);
      equipButtonText.x = -detailWidth / 2;
      equipButtonText.y = equipButtonY + 25;
      this.itemDetailPanel.addChild(equipButtonText);
    }

    const soldStyle = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 11,
      fill: 0x666666,
      align: 'center'
    });

    const soldLabel = new PIXI.Text(`已售出: ${item.soldCount} 件`, soldStyle);
    soldLabel.anchor.set(0.5);
    soldLabel.x = -detailWidth / 2;
    soldLabel.y = 375;
    this.itemDetailPanel.addChild(soldLabel);
  }

  private hideItemDetail(): void {
    if (this.itemDetailPanel) {
      this.contentContainer.removeChild(this.itemDetailPanel);
      this.itemDetailPanel.destroy();
      this.itemDetailPanel = undefined;
    }
  }

  private async handlePurchase(item: ShopItem): Promise<void> {
    const result: PurchaseResult = ShopSystem.purchase(item.id);
    
    if (result.success) {
      this.updateItemList();
      this.updateItemDetail(item);
      this.showNotification(result.message, 0x66ff99);
    } else {
      this.showNotification(result.message, 0xff6b6b);
    }
  }

  private showNotification(message: string, color: number): void {
    const notification = new PIXI.Container();
    notification.x = this.app.screen.width / 2;
    notification.y = this.app.screen.height / 2;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.9);
    bg.lineStyle(2, color, 0.8);
    bg.drawRoundedRect(-150, -30, 300, 60, 10);
    bg.endFill();
    notification.addChild(bg);

    const textStyle = new PIXI.TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: color,
      align: 'center'
    });

    const text = new PIXI.Text(message, textStyle);
    text.anchor.set(0.5);
    notification.addChild(text);

    this.app.stage.addChild(notification);

    let alpha = 1;
    const animate = () => {
      alpha -= 0.02;
      notification.alpha = alpha;
      notification.y -= 1;
      
      if (alpha > 0) {
        requestAnimationFrame(animate);
      } else {
        this.app.stage.removeChild(notification);
        notification.destroy();
      }
    };
    
    setTimeout(() => animate(), 1000);
  }

  private createCloseButton(): void {
    const panelWidth = Math.min(700, this.app.screen.width - 40);
    
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

  public setOnCloseCallback(callback: ShopCloseCallback): void {
    this.onCloseCallback = callback;
  }

  public show(): void {
    this.visible = true;
    this.container.visible = true;
    this.selectedItem = undefined;
    this.hideItemDetail();
    this.updateItemList();
    this.updateCurrencyDisplay();
  }

  public hide(): void {
    this.visible = false;
    this.container.visible = false;
    this.selectedItem = undefined;
    this.hideItemDetail();
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  public destroy(): void {
    if (this.removeShopListener) {
      this.removeShopListener();
    }
    if (this.removeCurrencyListener) {
      this.removeCurrencyListener();
    }
    this.container.destroy();
  }
}
