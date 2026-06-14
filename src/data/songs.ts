import { ChartData, DIFFICULTY_CONFIGS, NoteData, NoteType, UnlockCondition, LegacySongWithUnlock } from '../types';
import { SongLibrary } from '../modules/SongLibrary';

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

export const songDefinitions: Array<{
  metadata: {
    id: string;
    title: string;
    artist: string;
    bpm: number;
    lyrics: string;
    poemLines: string[];
    genre?: string;
    tags?: string[];
    description?: string;
    composer?: string;
    lyricist?: string;
  };
  easyLyrics: string;
  normalLyrics: string;
  hardLyrics: string;
  easyDensity: 'low' | 'normal' | 'high';
  normalDensity: 'low' | 'normal' | 'high';
  hardDensity: 'low' | 'normal' | 'high';
  easyStartDelay: number;
  normalStartDelay: number;
  hardStartDelay: number;
  easyStarLevel: number;
  normalStarLevel: number;
  hardStarLevel: number;
  easyNoteSpeed: number;
  normalNoteSpeed: number;
  hardNoteSpeed: number;
  unlockCondition: UnlockCondition | null;
  prerequisiteSongId: string | null;
  coverThemeIndex: number;
}> = [
  {
    metadata: {
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
      genre: '古风',
      tags: ['初恋', '浪漫', '入门'],
      description: '一首温柔的告白诗，适合初次游玩的练习曲。',
      composer: '古韵工作室',
      lyricist: '佚名'
    },
    easyLyrics: lovePoemEasyLyrics,
    normalLyrics: lovePoemNormalLyrics,
    hardLyrics: lovePoemHardLyrics,
    easyDensity: 'low',
    normalDensity: 'normal',
    hardDensity: 'high',
    easyStartDelay: 1200,
    normalStartDelay: 1000,
    hardStartDelay: 1000,
    easyStarLevel: 2,
    normalStarLevel: 4,
    hardStarLevel: 6,
    easyNoteSpeed: 300,
    normalNoteSpeed: 400,
    hardNoteSpeed: 550,
    unlockCondition: null,
    prerequisiteSongId: null,
    coverThemeIndex: 0
  },
  {
    metadata: {
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
      genre: '古风',
      tags: ['抒情', '经典', '中速'],
      description: '一首抒情的古风曲目，旋律优美，适合熟练掌握基础技巧。',
      composer: '乐府诗人',
      lyricist: '古词集'
    },
    easyLyrics: '春风十里不如你',
    normalLyrics: '春风十里不如你，桃花流水窅然去',
    hardLyrics: '春风十里不如你，桃花流水窅然去。此情可待成追忆，只是当时已惘然❤',
    easyDensity: 'low',
    normalDensity: 'normal',
    hardDensity: 'high',
    easyStartDelay: 1500,
    normalStartDelay: 1200,
    hardStartDelay: 1000,
    easyStarLevel: 2,
    normalStarLevel: 3,
    hardStarLevel: 5,
    easyNoteSpeed: 280,
    normalNoteSpeed: 360,
    hardNoteSpeed: 500,
    unlockCondition: {
      type: 'both',
      minRating: 'C',
      minAccuracy: 70,
      difficulty: 'normal',
      description: '完成「告白诗篇」普通难度，评级≥C 且 准确率≥70%'
    },
    prerequisiteSongId: 'love-poem',
    coverThemeIndex: 2
  },
  {
    metadata: {
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
      genre: '古典',
      tags: ['经典', '思乡', '高难度'],
      description: '经典古诗改编的高难度曲目，BPM较高，考验手速和反应。',
      composer: '李白(改编)',
      lyricist: '李白'
    },
    easyLyrics: '床前明月光，疑是地上霜',
    normalLyrics: '床前明月光，疑是地上霜。举头望明月',
    hardLyrics: '床前明月光，疑是地上霜。举头望明月，低头思故乡。❤',
    easyDensity: 'low',
    normalDensity: 'normal',
    hardDensity: 'high',
    easyStartDelay: 1000,
    normalStartDelay: 800,
    hardStartDelay: 700,
    easyStarLevel: 3,
    normalStarLevel: 5,
    hardStarLevel: 7,
    easyNoteSpeed: 340,
    normalNoteSpeed: 440,
    hardNoteSpeed: 580,
    unlockCondition: {
      type: 'both',
      minRating: 'B',
      minAccuracy: 80,
      difficulty: 'normal',
      description: '完成「春风十里」普通难度，评级≥B 且 准确率≥80%'
    },
    prerequisiteSongId: 'spring-breeze',
    coverThemeIndex: 5
  }
];

const songLibrary = SongLibrary.getInstance();

songDefinitions.forEach((def) => {
  const easyNotes = generateNotes(def.easyLyrics, def.metadata.bpm, def.easyStartDelay, def.easyDensity);
  const normalNotes = generateNotes(def.normalLyrics, def.metadata.bpm, def.normalStartDelay, def.normalDensity);
  const hardNotes = generateNotes(def.hardLyrics, def.metadata.bpm, def.hardStartDelay, def.hardDensity);

  songLibrary.registerSong({
    metadata: def.metadata,
    difficulties: {
      easy: easyNotes,
      normal: normalNotes,
      hard: hardNotes
    },
    difficultyOverrides: {
      easy: {
        noteSpeed: def.easyNoteSpeed,
        starLevel: def.easyStarLevel,
        noteCount: easyNotes.length,
        maxCombo: easyNotes.length,
        label: '简单',
        description: '适合新手练习'
      },
      normal: {
        noteSpeed: def.normalNoteSpeed,
        starLevel: def.normalStarLevel,
        noteCount: normalNotes.length,
        maxCombo: normalNotes.length,
        label: '普通',
        description: '标准难度'
      },
      hard: {
        noteSpeed: def.hardNoteSpeed,
        starLevel: def.hardStarLevel,
        noteCount: hardNotes.length,
        maxCombo: hardNotes.length,
        label: '困难',
        description: '挑战极限'
      }
    },
    unlockCondition: def.unlockCondition,
    prerequisiteSongId: def.prerequisiteSongId,
    coverThemeIndex: def.coverThemeIndex
  });
});

const _legacySongs: LegacySongWithUnlock[] = songDefinitions.map((def) => {
  const easyNotes = generateNotes(def.easyLyrics, def.metadata.bpm, def.easyStartDelay, def.easyDensity);
  const normalNotes = generateNotes(def.normalLyrics, def.metadata.bpm, def.normalStartDelay, def.normalDensity);
  const hardNotes = generateNotes(def.hardLyrics, def.metadata.bpm, def.hardStartDelay, def.hardDensity);

  return {
    id: def.metadata.id,
    title: def.metadata.title,
    artist: def.metadata.artist,
    bpm: def.metadata.bpm,
    lyrics: def.metadata.lyrics,
    poemLines: def.metadata.poemLines,
    difficulties: {
      easy: easyNotes,
      normal: normalNotes,
      hard: hardNotes
    },
    difficultyConfigs: {
      easy: { ...DIFFICULTY_CONFIGS.easy, starLevel: def.easyStarLevel, noteSpeed: def.easyNoteSpeed },
      normal: { ...DIFFICULTY_CONFIGS.normal, starLevel: def.normalStarLevel, noteSpeed: def.normalNoteSpeed },
      hard: { ...DIFFICULTY_CONFIGS.hard, starLevel: def.hardStarLevel, noteSpeed: def.hardNoteSpeed }
    },
    unlockCondition: def.unlockCondition,
    prerequisiteSongId: def.prerequisiteSongId
  };
});

export const songs: LegacySongWithUnlock[] = _legacySongs;

export const getSongById = (id: string): LegacySongWithUnlock | undefined => {
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

export type SongWithUnlock = LegacySongWithUnlock;
export { SongLibrary };
