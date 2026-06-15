import { ChartData, NoteData, Difficulty, LANE_COUNT, DIFFICULTY_CONFIGS } from '../../types';
import { EditorNote, generateNoteId, EditorConfig } from '../types';

export const noteDataToEditorNote = (note: NoteData, _index: number): EditorNote => ({
  ...note,
  id: generateNoteId(),
  selected: false
});

export const editorNoteToNoteData = (note: EditorNote): NoteData => {
  const { id, selected, ...noteData } = note;
  return noteData;
};

export const convertNotesToEditorNotes = (notes: NoteData[]): EditorNote[] => {
  return notes.map((note, index) => noteDataToEditorNote(note, index));
};

export const convertEditorNotesToNotes = (notes: EditorNote[]): NoteData[] => {
  return notes.map(editorNoteToNoteData).sort((a, b) => a.time - b.time);
};

export const createEmptyChart = (): ChartData => ({
  id: `chart_${Date.now()}`,
  title: '新谱面',
  artist: '',
  bpm: 120,
  lyrics: '',
  poemLines: [],
  difficulties: {
    normal: []
  },
  difficultyConfigs: {
    easy: { ...DIFFICULTY_CONFIGS.easy },
    normal: { ...DIFFICULTY_CONFIGS.normal },
    hard: { ...DIFFICULTY_CONFIGS.hard }
  }
});

export const snapTimeToGrid = (time: number, bpm: number, snapToGrid: boolean, gridInterval: number): number => {
  if (!snapToGrid) return time;
  const beatInterval = 60000 / bpm;
  const gridMs = beatInterval * gridInterval;
  return Math.round(time / gridMs) * gridMs;
};

export const getBeatInterval = (bpm: number): number => 60000 / bpm;

export const getTimeFromPosition = (
  y: number,
  judgeLineY: number,
  noteSpeed: number,
  scrollOffset: number
): number => {
  const distanceFromJudge = judgeLineY - y + scrollOffset;
  return (distanceFromJudge / noteSpeed) * 1000;
};

export const getPositionFromTime = (
  time: number,
  judgeLineY: number,
  noteSpeed: number,
  scrollOffset: number
): number => {
  const distanceFromJudge = (time / 1000) * noteSpeed;
  return judgeLineY - distanceFromJudge + scrollOffset;
};

export const getLaneFromX = (x: number, laneWidth: number): number => {
  const lane = Math.floor(x / laneWidth);
  return Math.max(0, Math.min(LANE_COUNT - 1, lane));
};

export const getXFromLane = (lane: number, laneWidth: number): number => {
  return lane * laneWidth + laneWidth / 2;
};

export const validateNote = (note: NoteData, existingNotes: NoteData[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (note.time < 0) {
    errors.push('时间不能为负数');
  }

  if (note.lane < 0 || note.lane >= LANE_COUNT) {
    errors.push(`轨道必须在 0 到 ${LANE_COUNT - 1} 之间`);
  }

  if (!note.lyricChar || note.lyricChar.length === 0) {
    errors.push('歌词字符不能为空');
  }

  if (note.type === 'hold' && (!note.duration || note.duration <= 0)) {
    errors.push('长按音符必须设置持续时间');
  }

  if (note.type === 'slide') {
    if (note.endLane === undefined || note.endLane < 0 || note.endLane >= LANE_COUNT) {
      errors.push(`滑键音符必须设置有效的结束轨道 (0-${LANE_COUNT - 1})`);
    }
    if (note.endLane === note.lane) {
      errors.push('滑键结束轨道不能与开始轨道相同');
    }
    if (!note.duration || note.duration <= 0) {
      errors.push('滑键音符必须设置持续时间');
    }
  }

  const overlappingNote = existingNotes.find(
    n => n !== note && n.time === note.time && n.lane === note.lane
  );
  if (overlappingNote) {
    errors.push('同一轨道同一时间已存在音符');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

export const exportChartToJSON = (
  config: EditorConfig,
  notesByDifficulty: Record<Difficulty, NoteData[]>
): string => {
  const chart: ChartData = {
    id: `chart_${Date.now()}`,
    title: config.title,
    artist: config.artist,
    bpm: config.bpm,
    lyrics: config.lyrics,
    poemLines: config.poemLines,
    difficulties: {
      easy: notesByDifficulty.easy,
      normal: notesByDifficulty.normal,
      hard: notesByDifficulty.hard
    },
    difficultyConfigs: config.difficultyConfigs
  };
  return JSON.stringify(chart, null, 2);
};

export const importChartFromJSON = (json: string): ChartData => {
  const chart = JSON.parse(json) as ChartData;
  
  if (!chart.id || !chart.title || !chart.bpm || !chart.difficulties?.normal) {
    throw new Error('无效的谱面文件格式');
  }

  return {
    ...chart,
    difficultyConfigs: chart.difficultyConfigs || {
      easy: { ...DIFFICULTY_CONFIGS.easy },
      normal: { ...DIFFICULTY_CONFIGS.normal },
      hard: { ...DIFFICULTY_CONFIGS.hard }
    }
  };
};

export const generateLyricsFromNotes = (notes: NoteData[]): string => {
  return notes
    .sort((a, b) => a.time - b.time)
    .map(n => n.lyricChar)
    .join('');
};

export const getTotalDuration = (notes: NoteData[], bpm: number): number => {
  if (notes.length === 0) return 0;
  const lastNote = notes.reduce((prev, curr) => 
    curr.time > prev.time ? curr : prev
  );
  const beatInterval = getBeatInterval(bpm);
  return lastNote.time + beatInterval * 4;
};

export const getNoteCountByType = (notes: NoteData[]): Record<string, number> => {
  return notes.reduce((acc, note) => {
    acc[note.type] = (acc[note.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
};
