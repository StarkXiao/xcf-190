import fs from 'fs';
import path from 'path';
import { Connect, IncomingMessage, ServerResponse } from 'vite';

const CONFIG_FILE_PATH = path.resolve(process.cwd(), 'server-data', 'game-config.json');

function ensureConfigDir() {
  const dir = path.dirname(CONFIG_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateDefaultConfig() {
  const now = Date.now();
  const oneWeekLater = now + 7 * 24 * 60 * 60 * 1000;
  const oneMonthLater = now + 30 * 24 * 60 * 60 * 1000;

  return {
    version: 1,
    versionName: '1.0.0',
    publishTime: now,
    minClientVersion: '1.0.0',
    songs: [
      { songId: 'love-poem', isOnline: true, sortPriority: 3, isNew: true, isHot: true, tags: ['初恋', '浪漫', '入门'] },
      { songId: 'spring-breeze', isOnline: true, sortPriority: 2, isNew: false, isHot: false, tags: ['抒情', '经典', '中速'] },
      { songId: 'moonlight-sonata', isOnline: true, sortPriority: 1, isNew: false, isHot: false, tags: ['经典', '思乡', '高难度'] }
    ],
    activities: [
      {
        id: 'double_reward_launch',
        name: '开服双倍奖励',
        description: '活动期间，所有曲目获得双倍金币奖励！',
        isEnabled: true,
        startTime: now,
        endTime: oneWeekLater,
        type: 'double_reward',
        config: { rewardMultiplier: 2, affectedTypes: ['coin'] }
      },
      {
        id: 'login_bonus_daily',
        name: '每日登录奖励',
        description: '每日登录即可获得丰厚奖励，连续登录奖励更丰厚！',
        isEnabled: true,
        startTime: now,
        endTime: oneMonthLater,
        type: 'login_bonus',
        config: { rewards: [{ day: 1, coin: 100, jade: 5 }, { day: 7, coin: 500, jade: 50, star: 5 }] }
      }
    ],
    rewards: [
      {
        id: 'first_clear_love_poem',
        name: '初次通关：告白诗篇',
        type: 'coin',
        value: 500,
        conditions: [{ type: 'first_clear', targetValue: 1, songId: 'love-poem', difficulty: 'normal' }],
        isEnabled: true
      },
      {
        id: 'rating_s_any_song',
        name: 'S级评价达成',
        type: 'star',
        value: 5,
        conditions: [{ type: 'rating', targetValue: 1, minRating: 'S' }],
        isEnabled: true
      },
      {
        id: 'play_10_songs',
        name: '勤勉演奏者',
        type: 'coin',
        value: 1000,
        conditions: [{ type: 'play_count', targetValue: 10 }],
        isEnabled: true
      }
    ],
    announcements: [
      {
        id: 'welcome_announcement',
        title: '欢迎来到浮岛书屋！',
        content: '感谢您游玩《浮岛书屋》！在这里，您将通过演奏美妙的音乐来收集散落的诗词，体验独特的国风音乐游戏魅力。\n\n游戏特色：\n• 精美的国风画面\n• 丰富的曲目选择\n• 独特的诗词收集系统\n• 多种难度挑战\n\n祝您游戏愉快！',
        type: 'success',
        priority: 100,
        isEnabled: true,
        startTime: now,
        endTime: oneWeekLater,
        showOnStart: true,
        showInGame: false
      },
      {
        id: 'spring_event_announcement',
        title: '春日诗会活动开启',
        content: '🌸 春日诗会活动正式开启！\n\n活动时间：即日起至活动结束\n\n活动内容：\n• 完成每日任务获取积分\n• 积分可兑换限定奖励\n• 赛季通行证解锁更多内容\n\n快来参与吧！',
        type: 'info',
        priority: 80,
        isEnabled: true,
        startTime: now,
        endTime: oneWeekLater,
        showOnStart: true,
        showInGame: true
      }
    ],
    globalSettings: {
      maintenanceMode: false,
      forceUpdate: false,
      latestClientVersion: '1.0.0'
    }
  };
}

function loadConfig(): any {
  ensureConfigDir();
  if (fs.existsSync(CONFIG_FILE_PATH)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error('[ConfigAPI] Failed to parse config file, using default:', e);
      const defaultConfig = generateDefaultConfig();
      saveConfig(defaultConfig);
      return defaultConfig;
    }
  }
  const defaultConfig = generateDefaultConfig();
  saveConfig(defaultConfig);
  return defaultConfig;
}

function saveConfig(config: any): void {
  ensureConfigDir();
  config.publishTime = Date.now();
  fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`[ConfigAPI] Config saved, version: ${config.version}, name: ${config.versionName}`);
}

function sendJson(res: ServerResponse, data: any, statusCode = 200): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Version');
  res.statusCode = statusCode;
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export function createConfigApiMiddleware(): Connect.NextHandleFunction {
  console.log('[ConfigAPI] Config API middleware initialized');
  console.log(`[ConfigAPI] Config file path: ${CONFIG_FILE_PATH}`);

  loadConfig();

  return async (req: IncomingMessage & { originalUrl?: string }, res: ServerResponse, next: Connect.NextFunction) => {
    const url = req.originalUrl || req.url || '';
    const method = req.method?.toUpperCase();

    if (method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Version');
      res.statusCode = 204;
      res.end();
      return;
    }

    if (url.startsWith('/api/config')) {
      const cleanUrl = url.replace('/api/config', '').replace(/^\/+/, '').split('?')[0];

      try {
        if (method === 'GET' && cleanUrl === '') {
          const clientVersion = (req.headers['x-client-version'] as string) || 'unknown';
          const config = loadConfig();
          console.log(`[ConfigAPI] GET /api/config - clientVersion=${clientVersion}, serverVersion=${config.version}`);
          sendJson(res, {
            success: true,
            data: config,
            message: `配置拉取成功，当前版本: ${config.versionName}`
          });
          return;
        }

        if (method === 'PUT' && cleanUrl === '') {
          const body = await readBody(req);
          const data = JSON.parse(body);
          const existing = loadConfig();
          const newConfig = {
            ...data,
            version: (data.version || existing.version || 1),
            publishTime: Date.now()
          };
          saveConfig(newConfig);
          console.log(`[ConfigAPI] PUT /api/config - config updated, new version: ${newConfig.version}`);
          sendJson(res, {
            success: true,
            data: newConfig,
            message: '配置保存成功'
          });
          return;
        }

        if (method === 'GET' && cleanUrl === 'version') {
          const config = loadConfig();
          sendJson(res, {
            success: true,
            data: {
              version: config.version,
              versionName: config.versionName,
              publishTime: config.publishTime
            }
          });
          return;
        }

        if (method === 'GET' && cleanUrl === 'songs') {
          const config = loadConfig();
          sendJson(res, {
            success: true,
            data: config.songs || []
          });
          return;
        }

        if (method === 'PUT' && cleanUrl === 'songs') {
          const body = await readBody(req);
          const { songId, ...updates } = JSON.parse(body);
          const config = loadConfig();
          
          if (!config.songs) config.songs = [];
          
          let index = config.songs.findIndex((s: any) => s.songId === songId);
          if (index !== -1) {
            config.songs[index] = { ...config.songs[index], ...updates, songId };
          } else {
            config.songs.push({ songId, isOnline: true, sortPriority: 0, isNew: false, isHot: false, tags: [], ...updates });
          }
          
          config.version = (config.version || 1) + 1;
          saveConfig(config);
          
          console.log(`[ConfigAPI] PUT /api/config/songs - songId=${songId}, updated: ${JSON.stringify(updates)}`);
          sendJson(res, {
            success: true,
            data: config,
            message: '曲目配置已更新'
          });
          return;
        }

        if (method === 'DELETE' && cleanUrl.startsWith('songs/')) {
          const songId = cleanUrl.replace('songs/', '');
          const config = loadConfig();
          config.songs = (config.songs || []).filter((s: any) => s.songId !== songId);
          config.version = (config.version || 1) + 1;
          saveConfig(config);
          
          console.log(`[ConfigAPI] DELETE /api/config/songs/${songId}`);
          sendJson(res, {
            success: true,
            data: config,
            message: '曲目配置已删除'
          });
          return;
        }

        if (method === 'GET' && cleanUrl === 'activities') {
          const config = loadConfig();
          sendJson(res, {
            success: true,
            data: config.activities || []
          });
          return;
        }

        if (method === 'PUT' && cleanUrl === 'activities') {
          const body = await readBody(req);
          const { activityId, ...updates } = JSON.parse(body);
          const config = loadConfig();
          
          if (!config.activities) config.activities = [];
          
          let index = config.activities.findIndex((a: any) => a.id === activityId);
          if (index !== -1) {
            config.activities[index] = { ...config.activities[index], ...updates, id: activityId };
          } else {
            config.activities.push({ 
              id: activityId, 
              name: '新活动', 
              description: '', 
              isEnabled: true, 
              startTime: Date.now(), 
              endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
              type: 'special_event',
              config: {},
              ...updates 
            });
          }
          
          config.version = (config.version || 1) + 1;
          saveConfig(config);
          
          console.log(`[ConfigAPI] PUT /api/config/activities - activityId=${activityId}`);
          sendJson(res, {
            success: true,
            data: config,
            message: '活动配置已更新'
          });
          return;
        }

        if (method === 'DELETE' && cleanUrl.startsWith('activities/')) {
          const activityId = cleanUrl.replace('activities/', '');
          const config = loadConfig();
          config.activities = (config.activities || []).filter((a: any) => a.id !== activityId);
          config.version = (config.version || 1) + 1;
          saveConfig(config);
          
          console.log(`[ConfigAPI] DELETE /api/config/activities/${activityId}`);
          sendJson(res, {
            success: true,
            data: config,
            message: '活动已删除'
          });
          return;
        }

        if (method === 'GET' && cleanUrl === 'rewards') {
          const config = loadConfig();
          sendJson(res, {
            success: true,
            data: config.rewards || []
          });
          return;
        }

        if (method === 'PUT' && cleanUrl === 'rewards') {
          const body = await readBody(req);
          const { rewardId, ...updates } = JSON.parse(body);
          const config = loadConfig();
          
          if (!config.rewards) config.rewards = [];
          
          let index = config.rewards.findIndex((r: any) => r.id === rewardId);
          if (index !== -1) {
            config.rewards[index] = { ...config.rewards[index], ...updates, id: rewardId };
          } else {
            config.rewards.push({ 
              id: rewardId, 
              name: '新奖励', 
              type: 'coin', 
              value: 100, 
              conditions: [], 
              isEnabled: true,
              ...updates 
            });
          }
          
          config.version = (config.version || 1) + 1;
          saveConfig(config);
          
          console.log(`[ConfigAPI] PUT /api/config/rewards - rewardId=${rewardId}`);
          sendJson(res, {
            success: true,
            data: config,
            message: '奖励配置已更新'
          });
          return;
        }

        if (method === 'DELETE' && cleanUrl.startsWith('rewards/')) {
          const rewardId = cleanUrl.replace('rewards/', '');
          const config = loadConfig();
          config.rewards = (config.rewards || []).filter((r: any) => r.id !== rewardId);
          config.version = (config.version || 1) + 1;
          saveConfig(config);
          
          console.log(`[ConfigAPI] DELETE /api/config/rewards/${rewardId}`);
          sendJson(res, {
            success: true,
            data: config,
            message: '奖励已删除'
          });
          return;
        }

        if (method === 'GET' && cleanUrl === 'announcements') {
          const config = loadConfig();
          sendJson(res, {
            success: true,
            data: config.announcements || []
          });
          return;
        }

        if (method === 'PUT' && cleanUrl === 'announcements') {
          const body = await readBody(req);
          const { announcementId, ...updates } = JSON.parse(body);
          const config = loadConfig();
          
          if (!config.announcements) config.announcements = [];
          
          let index = config.announcements.findIndex((a: any) => a.id === announcementId);
          if (index !== -1) {
            config.announcements[index] = { ...config.announcements[index], ...updates, id: announcementId };
          } else {
            config.announcements.push({ 
              id: announcementId, 
              title: '新公告', 
              content: '', 
              type: 'info', 
              priority: 50, 
              isEnabled: true,
              startTime: Date.now(),
              endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
              showOnStart: true,
              showInGame: false,
              ...updates 
            });
          }
          
          config.version = (config.version || 1) + 1;
          saveConfig(config);
          
          console.log(`[ConfigAPI] PUT /api/config/announcements - announcementId=${announcementId}`);
          sendJson(res, {
            success: true,
            data: config,
            message: '公告配置已更新'
          });
          return;
        }

        if (method === 'DELETE' && cleanUrl.startsWith('announcements/')) {
          const announcementId = cleanUrl.replace('announcements/', '');
          const config = loadConfig();
          config.announcements = (config.announcements || []).filter((a: any) => a.id !== announcementId);
          config.version = (config.version || 1) + 1;
          saveConfig(config);
          
          console.log(`[ConfigAPI] DELETE /api/config/announcements/${announcementId}`);
          sendJson(res, {
            success: true,
            data: config,
            message: '公告已删除'
          });
          return;
        }

        if (method === 'POST' && cleanUrl === 'reset') {
          const defaultConfig = generateDefaultConfig();
          saveConfig(defaultConfig);
          console.log(`[ConfigAPI] POST /api/config/reset - config reset to default`);
          sendJson(res, {
            success: true,
            data: defaultConfig,
            message: '已重置为默认配置'
          });
          return;
        }

        sendJson(res, {
          success: false,
          message: `接口不存在: ${method} ${url}`
        }, 404);

      } catch (e: any) {
        console.error(`[ConfigAPI] Error handling ${method} ${url}:`, e);
        sendJson(res, {
          success: false,
          message: `服务器错误: ${e.message}`
        }, 500);
      }
      return;
    }

    next();
  };
}
