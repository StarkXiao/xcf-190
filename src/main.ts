import { Game } from './Game';
import { createChartEditor, destroyChartEditor } from './editor/index';
import { AccountSystem } from './modules/AccountSystem';
import { CloudSaveSystem } from './modules/CloudSaveSystem';
import { ConfigSystem } from './modules/ConfigSystem';
import { createDefaultGameConfig } from './data/defaultConfig';
import { AnnouncementConfig } from './types';

let currentMode: 'game' | 'editor' = 'game';
let gameInstance: Game | null = null;
let editorContainer: HTMLElement | null = null;
let configInitialized = false;

const container = document.getElementById('game-container');

const showLoadingScreen = (message: string = '正在加载...') => {
  const existing = document.getElementById('config-loading-screen');
  if (existing) {
    existing.querySelector('.loading-message')!.textContent = message;
    return;
  }

  const loadingScreen = document.createElement('div');
  loadingScreen.id = 'config-loading-screen';
  loadingScreen.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  loadingScreen.innerHTML = `
    <div class="loading-spinner" style="
      width: 50px;
      height: 50px;
      border: 3px solid rgba(107, 157, 255, 0.3);
      border-top-color: #6b9dff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    "></div>
    <div class="loading-message" style="
      color: #ffffff;
      font-size: 16px;
      opacity: 0.9;
    ">${message}</div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
  document.body.appendChild(loadingScreen);
};

const hideLoadingScreen = () => {
  const loadingScreen = document.getElementById('config-loading-screen');
  if (loadingScreen) {
    loadingScreen.style.transition = 'opacity 0.3s';
    loadingScreen.style.opacity = '0';
    setTimeout(() => loadingScreen.remove(), 300);
  }
};

const showMaintenanceScreen = (message: string) => {
  const maintenanceScreen = document.createElement('div');
  maintenanceScreen.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #1a0a0a 0%, #3a1a1a 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 20px;
    box-sizing: border-box;
  `;
  maintenanceScreen.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">🔧</div>
    <h1 style="color: #ff6b6b; font-size: 24px; margin-bottom: 16px; text-align: center;">服务器维护中</h1>
    <p style="color: #ffffff; font-size: 14px; text-align: center; max-width: 400px; line-height: 1.6; opacity: 0.9;">
      ${message || '服务器正在维护中，请稍后再试。'}
    </p>
  `;
  document.body.appendChild(maintenanceScreen);
};

const showUpdateRequiredScreen = (latestVersion: string, updateUrl?: string) => {
  const updateScreen = document.createElement('div');
  updateScreen.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #0a1a1a 0%, #1a3a3a 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 20px;
    box-sizing: border-box;
  `;
  
  const updateButton = updateUrl ? `
    <a href="${updateUrl}" style="
      display: inline-block;
      padding: 12px 32px;
      background: #6b9dff;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-size: 14px;
      margin-top: 20px;
      transition: background 0.3s;
    " onmouseover="this.style.background='#5a8cee'" onmouseout="this.style.background='#6b9dff'">
      立即更新
    </a>
  ` : '';

  updateScreen.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
    <h1 style="color: #6bff9d; font-size: 24px; margin-bottom: 16px; text-align: center;">需要更新客户端</h1>
    <p style="color: #ffffff; font-size: 14px; text-align: center; max-width: 400px; line-height: 1.6; opacity: 0.9;">
      当前客户端版本过低，请更新到最新版本 ${latestVersion} 后再继续游戏。
    </p>
    ${updateButton}
  `;
  document.body.appendChild(updateScreen);
};

const showAnnouncementModal = (announcements: AnnouncementConfig[]) => {
  if (announcements.length === 0) return;

  const modal = document.createElement('div');
  modal.id = 'announcement-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9998;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 20px;
    box-sizing: border-box;
  `;

  const typeColors: Record<string, string> = {
    info: '#6b9dff',
    success: '#6bff9d',
    warning: '#ffd700',
    urgent: '#ff6b6b'
  };

  const typeIcons: Record<string, string> = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    urgent: '🚨'
  };

  const announcementsHtml = announcements.map(a => `
    <div style="
      background: rgba(255, 255, 255, 0.05);
      border-left: 3px solid ${typeColors[a.type]};
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    ">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="margin-right: 8px;">${typeIcons[a.type]}</span>
        <h3 style="color: ${typeColors[a.type]}; font-size: 16px; margin: 0;">${a.title}</h3>
      </div>
      <p style="color: #ffffff; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap; opacity: 0.9;">
        ${a.content}
      </p>
    </div>
  `).join('');

  modal.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%);
      border-radius: 16px;
      padding: 24px;
      max-width: 500px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="color: #ffffff; font-size: 20px; margin: 0;">📢 公告</h2>
      </div>
      <div>${announcementsHtml}</div>
      <button id="announcement-close-btn" style="
        width: 100%;
        padding: 12px;
        background: #6b9dff;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        margin-top: 16px;
        transition: background 0.3s;
      " onmouseover="this.style.background='#5a8cee'" onmouseout="this.style.background='#6b9dff'">
        我知道了
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#announcement-close-btn')?.addEventListener('click', () => {
    modal.style.transition = 'opacity 0.3s';
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 300);
  });
};

const initializeConfig = async (): Promise<{ success: boolean; shouldProceed: boolean }> => {
  if (configInitialized) {
    return { success: true, shouldProceed: true };
  }

  showLoadingScreen('正在加载配置...');

  try {
    const configSystem = ConfigSystem.getInstance();
    
    const hasLocalConfig = localStorage.getItem('floating-island-bookstore-game-config');
    if (!hasLocalConfig) {
      console.log('未找到本地配置，使用默认配置');
      const defaultConfig = createDefaultGameConfig();
      configSystem.setConfigForTesting(defaultConfig);
    }

    const result = await configSystem.fetchConfig(true);
    console.log('配置拉取结果:', result);

    if (configSystem.isMaintenanceMode()) {
      hideLoadingScreen();
      showMaintenanceScreen(configSystem.getMaintenanceMessage() || '服务器正在维护中，请稍后再试。');
      return { success: false, shouldProceed: false };
    }

    const globalSettings = configSystem.getConfig().globalSettings;
    if (globalSettings.forceUpdate && globalSettings.latestClientVersion) {
      hideLoadingScreen();
      showUpdateRequiredScreen(globalSettings.latestClientVersion, globalSettings.updateUrl);
      return { success: false, shouldProceed: false };
    }

    const announcements = configSystem.getActiveAnnouncements(true);
    if (announcements.length > 0) {
      showAnnouncementModal(announcements);
    }

    configInitialized = true;
    hideLoadingScreen();
    return { success: true, shouldProceed: true };
  } catch (err) {
    console.error('配置初始化失败:', err);
    
    const configSystem = ConfigSystem.getInstance();
    const localConfig = configSystem.getConfig();
    
    if (localConfig && localConfig.songs.length > 0) {
      console.log('使用本地缓存配置继续');
      hideLoadingScreen();
      return { success: true, shouldProceed: true };
    }

    const defaultConfig = createDefaultGameConfig();
    configSystem.setConfigForTesting(defaultConfig);
    hideLoadingScreen();
    return { success: true, shouldProceed: true };
  }
};

const initGame = async () => {
  if (container) {
    destroyEditor();
    container.style.display = 'block';
    
    const configResult = await initializeConfig();
    if (!configResult.shouldProceed) {
      return;
    }

    AccountSystem.initialize();
    CloudSaveSystem.initialize();
    
    gameInstance = new Game(container);
    
    window.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
  }
};

const handleOnlineStatus = () => {
  console.log('Network online, syncing data...');
  if (CloudSaveSystem.hasPendingChanges()) {
    CloudSaveSystem.forceSync();
  }
};

const handleOfflineStatus = () => {
  console.log('Network offline, using local cache');
};

const initEditor = () => {
  destroyGame();
  if (container) {
    container.style.display = 'none';
  }
  
  editorContainer = document.createElement('div');
  editorContainer.id = 'editor-container';
  editorContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #0a0a1a;
    z-index: 1000;
  `;
  
  const backLink = document.createElement('div');
  backLink.style.cssText = `
    position: absolute;
    top: 15px;
    right: 20px;
    z-index: 100;
  `;
  backLink.innerHTML = `
    <a href="#" style="color: #6b9dff; text-decoration: none; font-size: 14px; padding: 8px 16px; 
      background: rgba(107, 157, 255, 0.1); border-radius: 6px; transition: all 0.3s;"
      onmouseover="this.style.background='rgba(107, 157, 255, 0.2)'"
      onmouseout="this.style.background='rgba(107, 157, 255, 0.1)'">
      ← 返回游戏 (Ctrl+E)
    </a>
  `;
  backLink.querySelector('a')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchToGame();
  });
  
  editorContainer.appendChild(backLink);
  document.body.appendChild(editorContainer);
  
  const width = Math.min(window.innerWidth - 40, 1600);
  const height = Math.min(window.innerHeight - 40, 900);
  
  createChartEditor(editorContainer, { width, height });
  currentMode = 'editor';
  
  window.addEventListener('keydown', handleGlobalKeydown);
};

const destroyGame = () => {
  if (gameInstance) {
    gameInstance = null;
  }
  if (container) {
    container.innerHTML = '';
  }
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('online', handleOnlineStatus);
  window.removeEventListener('offline', handleOfflineStatus);
};

const destroyEditor = () => {
  if (editorContainer) {
    destroyChartEditor();
    document.body.removeChild(editorContainer);
    editorContainer = null;
  }
  window.removeEventListener('keydown', handleGlobalKeydown);
};

const switchToEditor = () => {
  if (currentMode !== 'editor') {
    initEditor();
  }
};

const switchToGame = () => {
  if (currentMode !== 'game') {
    destroyEditor();
    initGame();
    currentMode = 'game';
  }
};

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    if (currentMode === 'game') {
      switchToEditor();
    } else {
      switchToGame();
    }
  }
};

const checkTestChart = () => {
  const testChartData = localStorage.getItem('editor_test_chart');
  if (testChartData) {
    try {
      const testChart = JSON.parse(testChartData);
      console.log('检测到测试谱面:', testChart.title);
      
      const confirmUse = confirm(
        `检测到编辑器导出的测试谱面「${testChart.title}」。\n\n是否使用该谱面开始游戏？\n\n点击"确定"使用测试谱面，点击"取消"使用默认谱面。`
      );
      
      if (confirmUse) {
        localStorage.setItem('active_test_chart', testChartData);
      } else {
        localStorage.removeItem('editor_test_chart');
        localStorage.removeItem('active_test_chart');
      }
    } catch (err) {
      console.error('解析测试谱面失败:', err);
      localStorage.removeItem('editor_test_chart');
    }
  }
};

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('mode') === 'editor') {
  initEditor();
} else {
  checkTestChart();
  initGame().catch(err => {
    console.error('游戏初始化失败:', err);
  });
}

export { switchToEditor, switchToGame, currentMode };
