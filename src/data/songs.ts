import { ChartData, DIFFICULTY_CONFIGS, NoteData } from '../types';

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
    
    notes.push({
      time: startDelay + i * interval,
      lane,
      lyricChar: chars[i]
    });
  }

  return notes;
}

const lovePoemEasyLyrics = '愿我如星君如月';
const lovePoemNormalLyrics = '愿我如星君如月，夜夜流光相皎洁';
const lovePoemHardLyrics = '愿我如星君如月，夜夜流光相皎洁。在这浮岛书屋里，为你写下这首诗❤';

export const songs: ChartData[] = [
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
    }
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
    }
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
    }
  }
];

export const getSongById = (id: string): ChartData | undefined => {
  return songs.find(song => song.id === id);
};

export const getNotesForDifficulty = (song: ChartData, difficulty: 'easy' | 'normal' | 'hard'): NoteData[] => {
  const notes = song.difficulties[difficulty];
  if (notes && notes.length > 0) {
    return [...notes].sort((a, b) => a.time - b.time);
  }
  return [...song.difficulties.normal].sort((a, b) => a.time - b.time);
};
