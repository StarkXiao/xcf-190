import { ChartData, DIFFICULTY_CONFIGS } from '../types';

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
    normal: [
      { time: 1000, lane: 0, lyricChar: '愿' },
      { time: 1500, lane: 1, lyricChar: '我' },
      { time: 2000, lane: 2, lyricChar: '如' },
      { time: 2500, lane: 3, lyricChar: '星' },
      { time: 3000, lane: 1, lyricChar: '君' },
      { time: 3500, lane: 2, lyricChar: '如' },
      { time: 4000, lane: 0, lyricChar: '月' },
      { time: 4500, lane: 3, lyricChar: '，' },
      { time: 5000, lane: 2, lyricChar: '夜' },
      { time: 5500, lane: 1, lyricChar: '夜' },
      { time: 6000, lane: 3, lyricChar: '流' },
      { time: 6500, lane: 0, lyricChar: '光' },
      { time: 7000, lane: 1, lyricChar: '相' },
      { time: 7500, lane: 2, lyricChar: '皎' },
      { time: 8000, lane: 3, lyricChar: '洁' },
      { time: 9000, lane: 0, lyricChar: '❤' }
    ]
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
