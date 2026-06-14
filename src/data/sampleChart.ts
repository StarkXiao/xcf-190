import { ChartData, DIFFICULTY_CONFIGS, NoteData } from '../types';

const beatInterval = 60000 / 120;

const normalNotes: NoteData[] = [
  { time: 1000, lane: 0, lyricChar: '愿', type: 'tap' },
  { time: 1500, lane: 1, lyricChar: '我', type: 'tap' },
  { time: 2000, lane: 2, lyricChar: '如', type: 'tap' },
  { time: 2500, lane: 3, lyricChar: '星', type: 'tap' },
  { time: 3000, lane: 1, lyricChar: '君', type: 'tap' },
  { time: 3500, lane: 2, lyricChar: '如', type: 'hold', duration: beatInterval * 2 },
  { time: 4500, lane: 0, lyricChar: '月', type: 'tap' },
  { time: 5000, lane: 3, lyricChar: '，', type: 'tap' },
  { time: 5500, lane: 2, lyricChar: '夜', type: 'tap' },
  { time: 6000, lane: 1, lyricChar: '夜', type: 'slide', endLane: 2, duration: beatInterval * 0.8 },
  { time: 6500, lane: 3, lyricChar: '流', type: 'tap' },
  { time: 7000, lane: 0, lyricChar: '光', type: 'tap' },
  { time: 7500, lane: 1, lyricChar: '相', type: 'tap' },
  { time: 8000, lane: 2, lyricChar: '皎', type: 'tap' },
  { time: 8500, lane: 3, lyricChar: '洁', type: 'tap' },
  { time: 9500, lane: 0, lyricChar: '❤', type: 'hold', duration: beatInterval * 2 }
];

export const sampleChart: ChartData = {
  id: 'love-poem-legacy',
  title: '告白诗篇',
  artist: '浮岛书屋',
  bpm: 120,
  lyrics: '愿我如星君如月，夜夜流光相皎洁',
  poemLines: [
    '愿我如星君如月',
    '夜夜流光相皎洁',
    '在这浮岛书屋里',
    '为你写下这首诗'
  ],
  difficulties: {
    normal: normalNotes
  },
  difficultyConfigs: {
    easy: { ...DIFFICULTY_CONFIGS.easy },
    normal: { ...DIFFICULTY_CONFIGS.normal },
    hard: { ...DIFFICULTY_CONFIGS.hard }
  }
};

export const lovePoemLines = [
  '愿我如星君如月',
  '夜夜流光相皎洁',
  '在这浮岛书屋里',
  '为你写下这首诗'
];
