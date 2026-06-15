import {
  ShopItem,
  CurrencyAmount,
  CurrencyType,
  SHOP_DATA_STORAGE_KEY,
  CosmeticItem,
  CosmeticType
} from '../types';
import { DEFAULT_SHOP_ITEMS, getCosmeticById } from '../data/cosmetics';
import { SkinSystem } from './SkinSystem';

export type ShopChangeListener = (items: ShopItem[]) => void;
export type PurchaseResult = {
  success: boolean;
  message: string;
  cosmetic?: CosmeticItem;
};

export class ShopSystem {
  private static instance: ShopSystem;
  private static shopItems: ShopItem[] = [...DEFAULT_SHOP_ITEMS];
  private static changeListeners: ShopChangeListener[] = [];

  private constructor() {}

  public static getInstance(): ShopSystem {
    if (!ShopSystem.instance) {
      ShopSystem.instance = new ShopSystem();
      ShopSystem.loadShopData();
    }
    return ShopSystem.instance;
  }

  private static loadShopData(): void {
    try {
      const data = localStorage.getItem(SHOP_DATA_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          ShopSystem.shopItems = parsed;
        }
      } else {
        ShopSystem.shopItems = [...DEFAULT_SHOP_ITEMS];
        ShopSystem.saveShopData();
      }
    } catch (e) {
      console.error('Failed to load shop data:', e);
      ShopSystem.shopItems = [...DEFAULT_SHOP_ITEMS];
    }
  }

  private static saveShopData(): void {
    try {
      localStorage.setItem(SHOP_DATA_STORAGE_KEY, JSON.stringify(ShopSystem.shopItems));
    } catch (e) {
      console.error('Failed to save shop data:', e);
    }
  }

  public static initialize(): void {
    ShopSystem.getInstance();
  }

  public static getShopItems(): ShopItem[] {
    return [...ShopSystem.shopItems];
  }

  public static getFeaturedItems(): ShopItem[] {
    return ShopSystem.shopItems
      .filter(item => item.isFeatured)
      .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));
  }

  public static getItemsByType(type: CosmeticType): ShopItem[] {
    return ShopSystem.shopItems.filter(item => item.cosmeticType === type);
  }

  public static getLimitedItems(): ShopItem[] {
    const now = Date.now();
    return ShopSystem.shopItems.filter(item => 
      item.isLimited && (item.limitedEndTime === undefined || item.limitedEndTime > now)
    );
  }

  public static getDiscountedItems(): ShopItem[] {
    const now = Date.now();
    return ShopSystem.shopItems.filter(item => 
      item.discount !== undefined && item.discount > 0 &&
      (!item.discountEndTime || item.discountEndTime > now)
    );
  }

  public static getShopItemById(id: string): ShopItem | undefined {
    return ShopSystem.shopItems.find(item => item.id === id);
  }

  public static getShopItemByCosmeticId(cosmeticId: string): ShopItem | undefined {
    return ShopSystem.shopItems.find(item => item.cosmeticId === cosmeticId);
  }

  public static getCurrentPrice(item: ShopItem): Partial<CurrencyAmount> {
    const now = Date.now();
    let price = { ...item.price };
    
    if (item.discount !== undefined && item.discount > 0) {
      if (!item.discountEndTime || item.discountEndTime > now) {
        const discountMultiplier = (100 - item.discount) / 100;
        if (price.coin !== undefined) {
          price.coin = Math.floor(price.coin * discountMultiplier);
        }
        if (price.jade !== undefined) {
          price.jade = Math.floor(price.jade * discountMultiplier);
        }
        if (price.star !== undefined) {
          price.star = Math.floor(price.star * discountMultiplier);
        }
      }
    }
    
    return price;
  }

  public static canPurchase(item: ShopItem): boolean {
    if (SkinSystem.isUnlocked(item.cosmeticId)) {
      return false;
    }

    if (item.isLimited && item.limitedEndTime && item.limitedEndTime < Date.now()) {
      return false;
    }

    if (item.stock !== undefined && item.stock <= 0) {
      return false;
    }

    const price = this.getCurrentPrice(item);
    return SkinSystem.canAfford(price);
  }

  public static purchase(itemId: string): PurchaseResult {
    const item = this.getShopItemById(itemId);
    if (!item) {
      return { success: false, message: '商品不存在' };
    }

    if (SkinSystem.isUnlocked(item.cosmeticId)) {
      return { success: false, message: '您已经拥有此物品' };
    }

    if (item.isLimited && item.limitedEndTime && item.limitedEndTime < Date.now()) {
      return { success: false, message: '此商品已过期' };
    }

    if (item.stock !== undefined && item.stock <= 0) {
      return { success: false, message: '此商品已售罄' };
    }

    const price = this.getCurrentPrice(item);
    if (!SkinSystem.canAfford(price)) {
      return { success: false, message: '余额不足' };
    }

    const success = SkinSystem.unlockCosmetic(item.cosmeticId, price);
    if (!success) {
      return { success: false, message: '购买失败' };
    }

    if (item.stock !== undefined) {
      item.stock--;
    }
    item.soldCount++;

    ShopSystem.saveShopData();
    ShopSystem.notifyChangeListeners();

    const cosmetic = getCosmeticById(item.cosmeticId);
    return {
      success: true,
      message: `成功购买 ${cosmetic?.name || item.cosmeticId}`,
      cosmetic: cosmetic || undefined
    };
  }

  public static purchaseByCosmeticId(cosmeticId: string): PurchaseResult {
    const item = this.getShopItemByCosmeticId(cosmeticId);
    if (!item) {
      const cosmetic = getCosmeticById(cosmeticId);
      return { 
        success: false, 
        message: `商城中未找到 ${cosmetic?.name || cosmeticId}` 
      };
    }
    return this.purchase(item.id);
  }

  public static getPriceString(price: Partial<CurrencyAmount>): string {
    const parts: string[] = [];
    if (price.coin !== undefined) {
      parts.push(`🪙 ${price.coin}`);
    }
    if (price.jade !== undefined) {
      parts.push(`💎 ${price.jade}`);
    }
    if (price.star !== undefined) {
      parts.push(`⭐ ${price.star}`);
    }
    return parts.join(' ');
  }

  public static addShopItem(item: Omit<ShopItem, 'soldCount'>): void {
    const existing = ShopSystem.shopItems.find(i => i.id === item.id || i.cosmeticId === item.cosmeticId);
    if (existing) {
      throw new Error('商品已存在');
    }
    ShopSystem.shopItems.push({
      ...item,
      soldCount: 0
    });
    ShopSystem.saveShopData();
    ShopSystem.notifyChangeListeners();
  }

  public static updateShopItem(itemId: string, updates: Partial<ShopItem>): boolean {
    const index = ShopSystem.shopItems.findIndex(i => i.id === itemId);
    if (index >= 0) {
      ShopSystem.shopItems[index] = {
        ...ShopSystem.shopItems[index],
        ...updates
      };
      ShopSystem.saveShopData();
      ShopSystem.notifyChangeListeners();
      return true;
    }
    return false;
  }

  public static removeShopItem(itemId: string): boolean {
    const index = ShopSystem.shopItems.findIndex(i => i.id === itemId);
    if (index >= 0) {
      ShopSystem.shopItems.splice(index, 1);
      ShopSystem.saveShopData();
      ShopSystem.notifyChangeListeners();
      return true;
    }
    return false;
  }

  public static addCurrency(type: CurrencyType, amount: number): void {
    const update: Partial<CurrencyAmount> = {};
    update[type] = amount;
    SkinSystem.addCurrency(update);
  }

  public static getCurrency(): CurrencyAmount {
    return SkinSystem.getCurrency();
  }

  public static getCurrencyByType(type: CurrencyType): number {
    return SkinSystem.getCurrency()[type];
  }

  public static addChangeListener(listener: ShopChangeListener): () => void {
    ShopSystem.changeListeners.push(listener);
    return () => {
      const index = ShopSystem.changeListeners.indexOf(listener);
      if (index >= 0) {
        ShopSystem.changeListeners.splice(index, 1);
      }
    };
  }

  private static notifyChangeListeners(): void {
    const items = this.getShopItems();
    ShopSystem.changeListeners.forEach(listener => listener(items));
  }

  public static resetShop(): void {
    ShopSystem.shopItems = [...DEFAULT_SHOP_ITEMS];
    ShopSystem.saveShopData();
    ShopSystem.notifyChangeListeners();
  }

  public static checkAndRefreshLimitedItems(): void {
    const now = Date.now();
    let changed = false;

    ShopSystem.shopItems.forEach(item => {
      if (item.isLimited && item.limitedEndTime && item.limitedEndTime < now) {
        if (item.stock === undefined) {
          item.stock = 0;
          changed = true;
        }
      }
      if (item.discountEndTime && item.discountEndTime < now) {
        if (item.discount !== undefined) {
          item.discount = undefined;
          changed = true;
        }
      }
    });

    if (changed) {
      ShopSystem.saveShopData();
      ShopSystem.notifyChangeListeners();
    }
  }

  public static getTotalSales(): number {
    return ShopSystem.shopItems.reduce((sum, item) => sum + item.soldCount, 0);
  }

  public static getSalesByType(type: CosmeticType): number {
    return ShopSystem.shopItems
      .filter(item => item.cosmeticType === type)
      .reduce((sum, item) => sum + item.soldCount, 0);
  }

  public static getAvailableItemsCount(): number {
    const now = Date.now();
    return ShopSystem.shopItems.filter(item => {
      const notOwned = !SkinSystem.isUnlocked(item.cosmeticId);
      const notExpired = !item.isLimited || !item.limitedEndTime || item.limitedEndTime > now;
      const notSoldOut = item.stock === undefined || item.stock > 0;
      return notOwned && notExpired && notSoldOut;
    }).length;
  }
}
