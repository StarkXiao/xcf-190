import { Game } from './Game';
import { createChartEditor, destroyChartEditor } from './editor/index';

let currentMode: 'game' | 'editor' = 'game';
let gameInstance: Game | null = null;
let editorContainer: HTMLElement | null = null;

const container = document.getElementById('game-container');

const initGame = () => {
  if (container) {
    destroyEditor();
    container.style.display = 'block';
    gameInstance = new Game(container);
    
    window.addEventListener('keydown', handleGlobalKeydown);
  }
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
  initGame();
}

export { switchToEditor, switchToGame, currentMode };
