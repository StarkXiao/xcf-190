import {
  AccountType,
  AccountProfile,
  DeviceInfo,
  GuestUpgradeState,
  MigrationState,
  AccountState,
  ACCOUNT_STORAGE_KEY,
  MIGRATION_CODE_EXPIRY_HOURS
} from '../types';

export class AccountSystem {
  private static state: AccountState = {
    isLoggedIn: false,
    currentAccount: null,
    guestAccount: null,
    upgradeState: {
      isUpgrading: false,
      progress: 0
    },
    migrationState: {
      isMigrating: false,
      step: 'generate',
      progress: 0
    }
  };

  private static generateDeviceId(): string {
    const stored = localStorage.getItem('floating-island-bookstore-device-id');
    if (stored) return stored;
    
    const deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('floating-island-bookstore-device-id', deviceId);
    return deviceId;
  }

  private static getDeviceInfo(): DeviceInfo {
    const deviceId = this.generateDeviceId();
    return {
      deviceId,
      deviceName: navigator.platform || 'Unknown Device',
      platform: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
      lastLoginAt: Date.now(),
      isCurrentDevice: true
    };
  }

  private static generateAccountId(type: AccountType): string {
    const prefix = type === 'guest' ? 'gst_' : 'usr_';
    return prefix + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  private static saveState(): void {
    try {
      localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save account state:', e);
    }
  }

  private static loadState(): void {
    try {
      const data = localStorage.getItem(ACCOUNT_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.state = {
          isLoggedIn: parsed.isLoggedIn ?? false,
          currentAccount: parsed.currentAccount ?? null,
          guestAccount: parsed.guestAccount ?? null,
          upgradeState: parsed.upgradeState ?? { isUpgrading: false, progress: 0 },
          migrationState: parsed.migrationState ?? { isMigrating: false, step: 'generate', progress: 0 }
        };
      }
    } catch (e) {
      console.error('Failed to load account state:', e);
    }
  }

  public static initialize(): void {
    this.loadState();
    
    if (!this.state.guestAccount) {
      this.createGuestAccount();
    }
    
    if (!this.state.isLoggedIn && this.state.guestAccount) {
      this.state.isLoggedIn = true;
      this.state.currentAccount = this.state.guestAccount;
      this.saveState();
    }
  }

  public static createGuestAccount(): AccountProfile {
    const deviceInfo = this.getDeviceInfo();
    const guestAccount: AccountProfile = {
      accountId: this.generateAccountId('guest'),
      accountType: 'guest',
      displayName: '游客玩家',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      devices: [deviceInfo]
    };
    
    this.state.guestAccount = guestAccount;
    this.state.currentAccount = guestAccount;
    this.state.isLoggedIn = true;
    this.saveState();
    
    return guestAccount;
  }

  public static async registerAccount(username: string, email: string, _password: string): Promise<AccountProfile> {
    if (this.state.currentAccount?.accountType === 'registered') {
      throw new Error('Already logged in as a registered user');
    }

    if (this.state.upgradeState.isUpgrading) {
      throw new Error('Upgrade already in progress');
    }

    this.state.upgradeState.isUpgrading = true;
    this.state.upgradeState.progress = 0;
    this.saveState();

    try {
      this.state.upgradeState.progress = 30;
      this.saveState();

      await new Promise(resolve => setTimeout(resolve, 200));

      this.state.upgradeState.progress = 60;
      this.saveState();

      const deviceInfo = this.getDeviceInfo();
      const existingDevices = this.state.currentAccount?.devices || [];
      const updatedDevices = existingDevices.map(d => ({ ...d, isCurrentDevice: d.deviceId === deviceInfo.deviceId }));
      if (!updatedDevices.some(d => d.deviceId === deviceInfo.deviceId)) {
        updatedDevices.push(deviceInfo);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      this.state.upgradeState.progress = 90;
      this.saveState();

      const newAccount: AccountProfile = {
        accountId: this.generateAccountId('registered'),
        accountType: 'registered',
        username,
        email,
        displayName: username,
        createdAt: this.state.currentAccount?.createdAt || Date.now(),
        lastLoginAt: Date.now(),
        devices: updatedDevices
      };

      await new Promise(resolve => setTimeout(resolve, 100));

      this.state.upgradeState.progress = 100;
      this.state.currentAccount = newAccount;
      this.state.guestAccount = null;
      this.state.isLoggedIn = true;
      this.state.upgradeState.isUpgrading = false;
      this.saveState();

      return newAccount;
    } catch (e) {
      this.state.upgradeState.isUpgrading = false;
      this.state.upgradeState.error = e instanceof Error ? e.message : 'Registration failed';
      this.saveState();
      throw e;
    }
  }

  public static async loginAccount(username: string, _password: string): Promise<AccountProfile> {
    if (this.state.upgradeState.isUpgrading) {
      throw new Error('Upgrade in progress');
    }

    this.state.upgradeState.progress = 0;
    this.saveState();

    try {
      this.state.upgradeState.progress = 50;
      this.saveState();

      await new Promise(resolve => setTimeout(resolve, 300));

      const deviceInfo = this.getDeviceInfo();

      const account: AccountProfile = {
        accountId: this.generateAccountId('registered'),
        accountType: 'registered',
        username,
        displayName: username,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
        devices: [deviceInfo]
      };

      this.state.upgradeState.progress = 100;
      this.state.currentAccount = account;
      this.state.guestAccount = null;
      this.state.isLoggedIn = true;
      this.saveState();

      return account;
    } catch (e) {
      this.state.upgradeState.error = e instanceof Error ? e.message : 'Login failed';
      this.saveState();
      throw e;
    }
  }

  public static async upgradeGuestToRegistered(username: string, email: string, password: string): Promise<AccountProfile> {
    if (!this.state.guestAccount || this.state.currentAccount?.accountType !== 'guest') {
      throw new Error('No guest account to upgrade');
    }

    return this.registerAccount(username, email, password);
  }

  public static logout(): void {
    if (this.state.currentAccount?.accountType === 'guest') {
      return;
    }

    this.state.isLoggedIn = false;
    this.state.currentAccount = this.state.guestAccount;
    if (!this.state.currentAccount) {
      this.createGuestAccount();
    }
    this.saveState();
  }

  public static getCurrentAccount(): AccountProfile | null {
    return this.state.currentAccount;
  }

  public static isGuest(): boolean {
    return this.state.currentAccount?.accountType === 'guest';
  }

  public static isLoggedIn(): boolean {
    return this.state.isLoggedIn;
  }

  public static getUpgradeState(): GuestUpgradeState {
    return { ...this.state.upgradeState };
  }

  public static getMigrationState(): MigrationState {
    return { ...this.state.migrationState };
  }

  public static updateLastLogin(): void {
    if (this.state.currentAccount) {
      this.state.currentAccount.lastLoginAt = Date.now();
      
      const deviceId = this.generateDeviceId();
      const deviceIndex = this.state.currentAccount.devices.findIndex(d => d.deviceId === deviceId);
      if (deviceIndex >= 0) {
        this.state.currentAccount.devices[deviceIndex].lastLoginAt = Date.now();
      }
      
      this.saveState();
    }
  }

  public static addDevice(deviceName: string): DeviceInfo {
    if (!this.state.currentAccount) {
      throw new Error('Not logged in');
    }

    const newDevice: DeviceInfo = {
      deviceId: 'dev_' + Math.random().toString(36).substring(2, 15),
      deviceName,
      platform: 'unknown',
      lastLoginAt: Date.now(),
      isCurrentDevice: false
    };

    this.state.currentAccount.devices.push(newDevice);
    this.saveState();
    return newDevice;
  }

  public static removeDevice(deviceId: string): void {
    if (!this.state.currentAccount) {
      throw new Error('Not logged in');
    }

    const currentDeviceId = this.generateDeviceId();
    if (deviceId === currentDeviceId) {
      throw new Error('Cannot remove current device');
    }

    this.state.currentAccount.devices = this.state.currentAccount.devices.filter(d => d.deviceId !== deviceId);
    this.saveState();
  }

  public static getDevices(): DeviceInfo[] {
    return this.state.currentAccount?.devices || [];
  }

  public static getCurrentDeviceId(): string {
    return this.generateDeviceId();
  }

  public static updateProfile(updates: Partial<AccountProfile>): void {
    if (!this.state.currentAccount) {
      throw new Error('Not logged in');
    }

    this.state.currentAccount = {
      ...this.state.currentAccount,
      ...updates
    };

    this.saveState();
  }

  public static generateMigrationCode(): string {
    if (!this.state.currentAccount) {
      throw new Error('Not logged in');
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const migrationData = {
      code,
      accountId: this.state.currentAccount.accountId,
      createdAt: Date.now(),
      expiresAt: Date.now() + MIGRATION_CODE_EXPIRY_HOURS * 60 * 60 * 1000,
      used: false
    };

    sessionStorage.setItem('migration_code_' + code, JSON.stringify(migrationData));
    return code;
  }

  public static getState(): AccountState {
    return {
      isLoggedIn: this.state.isLoggedIn,
      currentAccount: this.state.currentAccount ? { ...this.state.currentAccount } : null,
      guestAccount: this.state.guestAccount ? { ...this.state.guestAccount } : null,
      upgradeState: { ...this.state.upgradeState },
      migrationState: { ...this.state.migrationState }
    };
  }
}
