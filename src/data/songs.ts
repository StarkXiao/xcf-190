import { ChartData, DIFFICULTY_CONFIGS, NoteData, NoteType, UnlockCondition } from '../types';

function getNoteTypeForIndex(i: number, density: 'low' | 'normal' | 'high'): NoteType {
  if (density === 'low') {
    return i > 0 && i % 6 === 0 ? 'hold' : 'tap';
  } else if (density === 'normal') {
    if (i > 0 && i % 5 === 0) return 'hold';
    if (i > 0 && i % 7 === 0) return 'slide';
    return 'tap';
  } else {
    if (i > 0 && i % 4 === 0) return 'hold';
    if (i > 0 && i % 6 === 0) return 'slide';
    return 'tap';
  }
}

function getEndLane(startLane: number, i: number): number {
  const directions = [1, -1, 1, -1];
  const direction = directions[i % directions.length];
  let endLane = startLane + direction;
  if (endLane < 0) endLane = 1;
  if (endLane > 3) endLane = 2;
  return endLane;
}

function generateNotes(lyrics: string, bpm: number, startDelay: number = 1000, density: 'low' | 'normal' | 'high' = 'normal'): NoteData[] {
  const beatInterval = 60000 / bpm;
  const intervalMultiplier = density === 'low' ? 1 : density === 'high' ? 0.5 : 0.75;
  const interval = beatInterval * intervalMultiplier;
  const chars = lyrics.split('');
  const notes: NoteData[] = [];

  for (let i = 0; i < chars.length; i++) {
    let lane: number;
    if (density === 'high') {
      lane = (i * 3 + Math.floor(i / 4)) % 4;
    } else if (density === 'low') {
      lane = i % 2 === 0 ? 1 : 2;
    } else {
      lane = (i + Math.floor(i / 3)) % 4;
    }

    const noteType = getNoteTypeForIndex(i, density);
    const note: NoteData = {
      time: startDelay + i * interval,
      lane,
      lyricChar: chars[i],
      type: noteType
    };

    if (noteType === 'hold') {
      note.duration = beatInterval * (density === 'high' ? 1.5 : 2);
    } else if (noteType === 'slide') {
      note.endLane = getEndLane(lane, i);
      note.duration = beatInterval * 0.8;
    }

    notes.push(note);
  }

  return notes;
}

const lovePoemEasyLyrics = '愿我如星君如月';
const lovePoemNormalLyrics = '愿我如星君如月，夜夜流光相皎洁';
const lovePoemHardLyrics = '愿我如星君如月，夜夜流光相皎洁。在这浮岛书屋里，为你写下这首诗❤';

export interface SongWithUnlock extends ChartData {
  unlockCondition: UnlockCondition | null;
  prerequisiteSongId: string | null;
}

export const songs: SongWithUnlock[] = [
  {
    id: 'love-poem',
    title: '告白诗篇',
    artist: '浮岛书屋',
    bpm: 120,
    lyrics: lovePoemNormalLyrics,
    poemLines: [
      '愿我如星君如月',
      '夜夜流光相皎洁',
      '在这浮岛书屋里',
      '为你写下这首诗'
    ],
    difficulties: {
      easy: generateNotes(lovePoemEasyLyrics, 120, 1200, 'low'),
      normal: generateNotes(lovePoemNormalLyrics, 120, 1000, 'normal'),
      hard: generateNotes(lovePoemHardLyrics, 120, 1000, 'high')
    },
    difficultyConfigs: {
      easy: { ...DIFFICULTY_CONFIGS.easy, starLevel: 2 },
      normal: { ...DIFFICULTY_CONFIGS.normal, starLevel: 4 },
      hard: { ...DIFFICULTY_CONFIGS.hard, starLevel: 6 }
    },
    unlockCondition: null,
    prerequisiteSongId: null
  },
  {
    id: 'spring-breeze',
    title: '春风十里',
    artist: '古韵新声',
    bpm: 100,
    lyrics: '春风十里不如你，桃花流水窅然去',
    poemLines: [
      '春风十里不如你',
      '桃花流水窅然去',
      '此情可待成追忆',
      '只是当时已惘然'
    ],
    difficulties: {
      easy: generateNotes('春风十里不如你', 100, 1500, 'low'),
      normal: generateNotes('春风十里不如你，桃花流水窅然去', 100, 1200, 'normal'),
      hard: generateNotes('春风十里不如你，桃花流水窅然去。此情可待成追忆，只是当时已惘然❤', 100, 1000, 'high')
    },
    difficultyConfigs: {
      easy: { ...DIFFICULTY_CONFIGS.easy, starLevel: 2, noteSpeed: 280 },
      normal: { ...DIFFICULTY_CONFIGS.normal, starLevel: 3, noteSpeed: 360 },
      hard: { ...DIFFICULTY_CONFIGS.hard, starLevel: 5, noteSpeed: 500 }
    },
    unlockCondition: {
      type: 'both',
      minRating: 'C',
      minAccuracy: 70,
      difficulty: 'normal',
      description: '完成「告白诗篇」普通难度，评级≥C 且 准确率≥70%'
    },
    prerequisiteSongId: 'love-poem'
  },
  {
    id: 'moonlight-sonata',
    title: '月光奏鸣',
    artist: '夜曲集',
    bpm: 140,
    lyrics: '床前明月光，疑是地上霜。举头望明月，低头思故乡。',
    poemLines: [
      '床前明月光',
      '疑是地上霜',
      '举头望明月',
      '低头思故乡'
    ],
    difficulties: {
      easy: generateNotes('床前明月光，疑是地上霜', 140, 1000, 'low'),
      normal: generateNotes('床前明月光，疑是地上霜。举头望明月', 140, 800, 'normal'),
      hard: generateNotes('床前明月光，疑是地上霜。举头望明月，低头思故乡。❤', 140, 700, 'high')
    },
    difficultyConfigs: {
      easy: { ...DIFFICULTY_CONFIGS.easy, starLevel: 3, noteSpeed: 340 },
      normal: { ...DIFFICULTY_CONFIGS.normal, starLevel: 5, noteSpeed: 440 },
      hard: { ...DIFFICULTY_CONFIGS.hard, starLevel: 7, noteSpeed: 580 }
    },
    unlockCondition: {
      type: 'both',
      minRating: 'B',
      minAccuracy: 80,
      difficulty: 'normal',
      description: '完成「春风十里」普通难度，评级≥B 且 准确率≥80%'
    },
    prerequisiteSongId: 'spring-breeze'
  }
];

export const getSongById = (id: string): SongWithUnlock | undefined => {
  return songs.find(song => song.id === id);
};

export const getNotesForDifficulty = (song: ChartData, difficulty: 'easy' | 'normal' | 'hard'): NoteData[] => {
  const notes = song.difficulties[difficulty];
  if (notes && notes.length > 0) {
    return [...notes].sort((a, b) => a.time - b.time);
  }
  return [...song.difficulties.normal].sort((a, b) => a.time - b.time);
};

export const generateUnlockDescription = (condition: UnlockCondition | null): string => {
  if (!condition) return '初始章节，自由游玩';
  return condition.description;
};
