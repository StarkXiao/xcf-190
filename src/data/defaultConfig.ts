import {
  GameConfig,
  SongOnlineConfig,
  ActivityConfig,
  RewardConfig,
  AnnouncementConfig,
  Difficulty
} from '../types';
import { songDefinitions } from './songs';

export function createDefaultSongConfigs(): SongOnlineConfig[] {
  return songDefinitions.map((def, index) => ({
    songId: def.metadata.id,
    isOnline: true,
    sortPriority: songDefinitions.length - index,
    isNew: index < 1,
    isHot: index === 0,
    tags: def.metadata.tags || []
  }));
}

export function createDefaultActivities(): ActivityConfig[] {
  const now = Date.now();
  const oneWeekLater = now + 7 * 24 * 60 * 60 * 1000;
  const oneMonthLater = now + 30 * 24 * 60 * 60 * 1000;

  return [
    {
      id: 'double_reward_launch',
      name: '开服双倍奖励',
      description: '活动期间，所有曲目获得双倍金币奖励！',
      isEnabled: true,
      startTime: now,
      endTime: oneWeekLater,
      type: 'double_reward',
      config: {
        rewardMultiplier: 2,
        affectedTypes: ['coin']
      }
    },
    {
      id: 'login_bonus_daily',
      name: '每日登录奖励',
      description: '每日登录即可获得丰厚奖励，连续登录奖励更丰厚！',
      isEnabled: true,
      startTime: now,
      endTime: oneMonthLater,
      type: 'login_bonus',
      config: {
        rewards: [
          { day: 1, coin: 100, jade: 5 },
          { day: 2, coin: 150, jade: 10 },
          { day: 3, coin: 200, jade: 15, star: 1 },
          { day: 4, coin: 250, jade: 20 },
          { day: 5, coin: 300, jade: 25, star: 2 },
          { day: 6, coin: 400, jade: 30 },
          { day: 7, coin: 500, jade: 50, star: 5 }
        ]
      }
    },
    {
      id: 'season_spring_2024',
      name: '春日诗会赛季',
      description: '春日诗会赛季开启！完成任务获取限定奖励。',
      isEnabled: true,
      startTime: now,
      endTime: oneMonthLater,
      type: 'season',
      config: {
        theme: 'spring',
        accentColor: '#6B9DFF',
        seasonPassPrice: 100,
        premiumPassPrice: 300
      }
    }
  ];
}

export function createDefaultRewards(): RewardConfig[] {
  return [
    {
      id: 'first_clear_love_poem',
      name: '初次通关：告白诗篇',
      type: 'coin',
      value: 500,
      conditions: [
        {
          type: 'first_clear',
          targetValue: 1,
          songId: 'love-poem',
          difficulty: 'normal' as Difficulty
        }
      ],
      isEnabled: true
    },
    {
      id: 'combo_50_love_poem',
      name: '连击达人：告白诗篇',
      type: 'jade',
      value: 20,
      conditions: [
        {
          type: 'combo',
          targetValue: 50,
          songId: 'love-poem',
          difficulty: 'normal' as Difficulty
        }
      ],
      isEnabled: true
    },
    {
      id: 'rating_s_any_song',
      name: 'S级评价达成',
      type: 'star',
      value: 5,
      conditions: [
        {
          type: 'rating',
          targetValue: 1,
          minRating: 'S'
        }
      ],
      isEnabled: true
    },
    {
      id: 'accuracy_95_any_song',
      name: '精准演奏家',
      type: 'jade',
      value: 50,
      conditions: [
        {
          type: 'accuracy',
          targetValue: 95,
          minAccuracy: 95
        }
      ],
      isEnabled: true
    },
    {
      id: 'play_10_songs',
      name: '勤勉演奏者',
      type: 'coin',
      value: 1000,
      conditions: [
        {
          type: 'play_count',
          targetValue: 10
        }
      ],
      isEnabled: true
    },
    {
      id: 'perfect_100_total',
      name: '完美收集者',
      type: 'star',
      value: 10,
      conditions: [
        {
          type: 'perfect_count',
          targetValue: 100
        }
      ],
      isEnabled: true
    }
  ];
}

export function createDefaultAnnouncements(): AnnouncementConfig[] {
  const now = Date.now();
  const oneWeekLater = now + 7 * 24 * 60 * 60 * 1000;
  const threeDaysLater = now + 3 * 24 * 60 * 60 * 1000;

  return [
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
    },
    {
      id: 'maintenance_notice',
      title: '维护通知',
      content: '为了给您带来更好的游戏体验，我们将于近期进行服务器维护。\n\n维护时间：请关注后续公告\n\n维护期间将无法登录游戏，给您带来的不便敬请谅解。',
      type: 'warning',
      priority: 50,
      isEnabled: true,
      startTime: now,
      endTime: threeDaysLater,
      showOnStart: false,
      showInGame: true
    }
  ];
}

export function createDefaultGameConfig(): GameConfig {
  return {
    version: 1,
    versionName: '1.0.0',
    publishTime: Date.now(),
    minClientVersion: '1.0.0',
    songs: createDefaultSongConfigs(),
    activities: createDefaultActivities(),
    rewards: createDefaultRewards(),
    announcements: createDefaultAnnouncements(),
    globalSettings: {
      maintenanceMode: false,
      forceUpdate: false,
      latestClientVersion: '1.0.0'
    }
  };
}

export function initializeDefaultConfig(): void {
  const config = createDefaultGameConfig();
  const configJson = JSON.stringify(config, null, 2);
  console.log('默认配置已生成，可以复制到服务器：');
  console.log(configJson);
}

export function getSampleConfigJson(): string {
  return JSON.stringify(createDefaultGameConfig(), null, 2);
}
