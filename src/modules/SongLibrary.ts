import {
  SongChartEntry,
  SongMetadata,
  CoverArt,
  Difficulty,
  NoteData,
  ChartDifficultyConfig,
  DIFFICULTY_CONFIGS,
  UnlockCondition,
  BestScore,
  LegacySongWithUnlock,
  SongLibraryFilter,
  SongLibrarySort,
  SongLibraryEntry,
  LibraryChangeEvent,
  LibraryChangeListener,
  DEFAULT_JUDGE_TIMING
} from '../types';
import { CoverArtManager } from './CoverArtManager';
import { ScoreStorage } from './ScoreStorage';
import { ChapterUnlockManager } from './ChapterUnlockManager';

const FAVORITES_STORAGE_KEY = 'floating-island-bookstore-favorites';
const RECENT_STORAGE_KEY = 'floating-island-bookstore-recent';
const NEW_SONGS_KEY = 'floating-island-bookstore-new-songs';

interface MetadataInput {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  lyrics: string;
  poemLines: string[];
  album?: string;
  composer?: string;
  lyricist?: string;
  arranger?: string;
  vocal?: string;
  illustrator?: string;
  duration?: number;
  genre?: string;
  tags?: string[];
  description?: string;
  coverArt?: CoverArt;
  releaseDate?: string;
  chapter?: string;
}

interface ChartInput {
  metadata: MetadataInput;
  difficulties: {
    easy?: NoteData[];
    normal: NoteData[];
    hard?: NoteData[];
  };
  difficultyOverrides?: {
    easy?: Partial<ChartDifficultyConfig>;
    normal?: Partial<ChartDifficultyConfig>;
    hard?: Partial<ChartDifficultyConfig>;
  };
  unlockCondition?: UnlockCondition | null;
  prerequisiteSongId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  coverThemeIndex?: number;
}

export class SongLibrary {
  private static instance: SongLibrary;
  private songs: Map<string, SongChartEntry> = new Map();
  private changeListeners: LibraryChangeListener[] = [];
  private favorites: Set<string> = new Set();
  private recentPlayed: Map<string, number> = new Map();
  private newSongs: Set<string> = new Set();
  private coverArtManager: CoverArtManager;
  private isInitialized: boolean = false;

  private constructor() {
    this.coverArtManager = CoverArtManager.getInstance();
    this.loadPersistentData();
  }

  public static getInstance(): SongLibrary {
    if (!SongLibrary.instance) {
      SongLibrary.instance = new SongLibrary();
    }
    return SongLibrary.instance;
  }

  public initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  public registerSong(input: ChartInput): SongChartEntry {
    const metadata = this.buildMetadata(input);
    const difficultyConfigs = this.buildDifficultyConfigs(input);
    const normalNotes = input.difficulties.normal || [];

    if (!metadata.coverArt) {
      const themeIndex = input.coverThemeIndex ?? metadata.bpm;
      metadata.coverArt = this.coverArtManager.createCoverFromBPM(
        metadata.id,
        themeIndex,
        metadata.title,
        metadata.artist,
        metadata.poemLines,
        normalNotes
      );
    }

    const entry: SongChartEntry = {
      metadata,
      difficulties: input.difficulties,
      difficultyConfigs,
      unlockCondition: input.unlockCondition ?? null,
      prerequisiteSongId: input.prerequisiteSongId ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? this.songs.size
    };

    this.songs.set(metadata.id, entry);

    if (!this.recentPlayed.has(metadata.id)) {
      this.newSongs.add(metadata.id);
    }

    this.emitChange({ type: 'add', songId: metadata.id, timestamp: Date.now() });
    this.saveNewSongs();

    return entry;
  }

  public registerSongs(inputs: ChartInput[]): SongChartEntry[] {
    return inputs.map((input, index) => {
      if (input.sortOrder === undefined) {
        input.sortOrder = index;
      }
      return this.registerSong(input);
    });
  }

  public registerLegacySongs(legacySongs: LegacySongWithUnlock[]): SongChartEntry[] {
    return legacySongs.map((legacy, index) => {
      const normalNotes = legacy.difficulties.normal || [];
      const input: ChartInput = {
        metadata: {
          id: legacy.id,
          title: legacy.title,
          artist: legacy.artist,
          bpm: legacy.bpm,
          lyrics: legacy.lyrics,
          poemLines: legacy.poemLines,
          genre: '古风',
          description: '',
          tags: []
        },
        difficulties: legacy.difficulties,
        difficultyOverrides: {
          easy: legacy.difficultyConfigs.easy ? {
            ...legacy.difficultyConfigs.easy,
            noteCount: (legacy.difficulties.easy || []).length,
            maxCombo: (legacy.difficulties.easy || []).length
          } : undefined,
          normal: {
            ...legacy.difficultyConfigs.normal,
            noteCount: normalNotes.length,
            maxCombo: normalNotes.length
          },
          hard: legacy.difficultyConfigs.hard ? {
            ...legacy.difficultyConfigs.hard,
            noteCount: (legacy.difficulties.hard || []).length,
            maxCombo: (legacy.difficulties.hard || []).length
          } : undefined
        },
        unlockCondition: legacy.unlockCondition,
        prerequisiteSongId: legacy.prerequisiteSongId,
        sortOrder: index,
        coverThemeIndex: index
      };
      return this.registerSong(input);
    });
  }

  public unregisterSong(songId: string): boolean {
    const existed = this.songs.delete(songId);
    if (existed) {
      this.favorites.delete(songId);
      this.recentPlayed.delete(songId);
      this.newSongs.delete(songId);
      this.emitChange({ type: 'remove', songId, timestamp: Date.now() });
      this.savePersistentData();
    }
    return existed;
  }

  public getSong(songId: string): SongChartEntry | undefined {
    return this.songs.get(songId);
  }

  public getSongRequired(songId: string): SongChartEntry {
    const song = this.songs.get(songId);
    if (!song) {
      throw new Error(`Song not found: ${songId}`);
    }
    return song;
  }

  public hasSong(songId: string): boolean {
    return this.songs.has(songId);
  }

  public getAllSongs(): SongChartEntry[] {
    return Array.from(this.songs.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public getActiveSongs(): SongChartEntry[] {
    return this.getAllSongs().filter(s => s.isActive);
  }

  public getNotesForDifficulty(song: SongChartEntry, difficulty: Difficulty): NoteData[] {
    const notes = song.difficulties[difficulty];
    if (notes && notes.length > 0) {
      return [...notes].sort((a, b) => a.time - b.time);
    }
    return [...song.difficulties.normal].sort((a, b) => a.time - b.time);
  }

  public getNotes(songId: string, difficulty: Difficulty): NoteData[] {
    const song = this.getSong(songId);
    if (!song) return [];
    return this.getNotesForDifficulty(song, difficulty);
  }

  public getDifficultyConfig(song: SongChartEntry, difficulty: Difficulty): ChartDifficultyConfig {
    return song.difficultyConfigs[difficulty];
  }

  public filterAndSort(
    filter?: Partial<SongLibraryFilter>,
    sort?: Partial<SongLibrarySort>
  ): SongLibraryEntry[] {
    const activeSongs = this.getActiveSongs();
    let entries = activeSongs.map(song => this.buildLibraryEntry(song));

    if (filter) {
      entries = this.applyFilter(entries, filter);
    }
    if (sort) {
      entries = this.applySort(entries, sort);
    }

    return entries;
  }

  public getLibraryEntry(songId: string): SongLibraryEntry | undefined {
    const song = this.getSong(songId);
    if (!song) return undefined;
    return this.buildLibraryEntry(song);
  }

  public toggleFavorite(songId: string): boolean {
    if (!this.hasSong(songId)) return false;

    const isFavorite = this.favorites.has(songId);
    if (isFavorite) {
      this.favorites.delete(songId);
    } else {
      this.favorites.add(songId);
    }
    this.saveFavorites();
    this.emitChange({ type: 'update', songId, timestamp: Date.now() });
    return !isFavorite;
  }

  public isFavorite(songId: string): boolean {
    return this.favorites.has(songId);
  }

  public getFavorites(): string[] {
    return Array.from(this.favorites);
  }

  public markAsPlayed(songId: string): void {
    if (!this.hasSong(songId)) return;
    this.recentPlayed.set(songId, Date.now());
    this.newSongs.delete(songId);
    this.saveRecent();
    this.saveNewSongs();
    this.emitChange({ type: 'update', songId, timestamp: Date.now() });
  }

  public getRecentPlayed(limit: number = 10): SongLibraryEntry[] {
    const recent = Array.from(this.recentPlayed.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([songId]) => this.getLibraryEntry(songId))
      .filter((entry): entry is SongLibraryEntry => entry !== undefined);
    return recent;
  }

  public getNewSongs(): SongLibraryEntry[] {
    return Array.from(this.newSongs)
      .map(songId => this.getLibraryEntry(songId))
      .filter((entry): entry is SongLibraryEntry => entry !== undefined);
  }

  public clearNewFlag(songId: string): void {
    if (this.newSongs.delete(songId)) {
      this.saveNewSongs();
      this.emitChange({ type: 'update', songId, timestamp: Date.now() });
    }
  }

  public clearAllNewFlags(): void {
    if (this.newSongs.size > 0) {
      this.newSongs.clear();
      this.saveNewSongs();
      this.emitChange({ type: 'update', timestamp: Date.now() });
    }
  }

  public updateSongMetadata(songId: string, updates: Partial<SongMetadata>): boolean {
    const song = this.getSong(songId);
    if (!song) return false;

    song.metadata = { ...song.metadata, ...updates };
    this.emitChange({ type: 'update', songId, timestamp: Date.now() });
    return true;
  }

  public updateCoverArt(songId: string, coverArt: CoverArt): boolean {
    return this.updateSongMetadata(songId, { coverArt });
  }

  public regenerateCoverArt(songId: string, themeIndex?: number): boolean {
    const song = this.getSong(songId);
    if (!song) return false;

    const { id, title, artist, poemLines, bpm } = song.metadata;
    const notes = song.difficulties.normal;
    const cover = themeIndex !== undefined
      ? this.coverArtManager.createPresetCover(id, themeIndex, title, artist, poemLines, notes)
      : this.coverArtManager.createCoverFromBPM(id, bpm, title, artist, poemLines, notes);

    return this.updateCoverArt(songId, cover);
  }

  public reorderSongs(songIds: string[]): boolean {
    let changed = false;
    songIds.forEach((songId, index) => {
      const song = this.getSong(songId);
      if (song && song.sortOrder !== index) {
        song.sortOrder = index;
        changed = true;
      }
    });

    if (changed) {
      this.emitChange({ type: 'reorder', timestamp: Date.now() });
    }
    return changed;
  }

  public setSongActive(songId: string, isActive: boolean): boolean {
    const song = this.getSong(songId);
    if (!song) return false;
    if (song.isActive === isActive) return false;

    song.isActive = isActive;
    this.emitChange({ type: 'update', songId, timestamp: Date.now() });
    return true;
  }

  public getAvailableDifficulties(song: SongChartEntry): Difficulty[] {
    const diffs: Difficulty[] = [];
    if (song.difficulties.easy && song.difficulties.easy.length > 0) diffs.push('easy');
    diffs.push('normal');
    if (song.difficulties.hard && song.difficulties.hard.length > 0) diffs.push('hard');
    return diffs;
  }

  public addChangeListener(listener: LibraryChangeListener): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index >= 0) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  public getSongCount(): number {
    return this.songs.size;
  }

  public getActiveSongCount(): number {
    return this.getActiveSongs().length;
  }

  public clearAll(): void {
    this.songs.clear();
    this.favorites.clear();
    this.recentPlayed.clear();
    this.newSongs.clear();
    this.emitChange({ type: 'remove', timestamp: Date.now() });
    this.savePersistentData();
  }

  private buildMetadata(input: ChartInput): SongMetadata {
    const { metadata } = input;
    return {
      id: metadata.id,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      composer: metadata.composer,
      lyricist: metadata.lyricist,
      arranger: metadata.arranger,
      vocal: metadata.vocal,
      illustrator: metadata.illustrator,
      bpm: metadata.bpm,
      duration: metadata.duration ?? 0,
      genre: metadata.genre ?? '古风',
      tags: metadata.tags ?? [],
      description: metadata.description ?? '',
      poemLines: metadata.poemLines,
      lyrics: metadata.lyrics,
      coverArt: metadata.coverArt ?? null,
      releaseDate: metadata.releaseDate,
      chapter: metadata.chapter
    };
  }

  private buildDifficultyConfigs(input: ChartInput): SongChartEntry['difficultyConfigs'] {
    const overrides = input.difficultyOverrides || {};
    const buildConfig = (
      diff: Difficulty,
      baseStarLevel: number,
      notes?: NoteData[]
    ): ChartDifficultyConfig => {
      const base = DIFFICULTY_CONFIGS[diff];
      const override = overrides[diff] || {};
      const noteCount = notes?.length ?? 0;
      return {
        difficulty: diff,
        label: override.label ?? base.label,
        noteSpeed: override.noteSpeed ?? base.noteSpeed,
        judgeTiming: override.judgeTiming ?? { ...DEFAULT_JUDGE_TIMING, ...base.judgeTiming },
        starLevel: override.starLevel ?? baseStarLevel,
        noteCount: override.noteCount ?? noteCount,
        maxCombo: override.maxCombo ?? noteCount,
        designer: override.designer,
        description: override.description
      };
    };

    return {
      easy: buildConfig('easy', 2, input.difficulties.easy),
      normal: buildConfig('normal', 4, input.difficulties.normal),
      hard: buildConfig('hard', 6, input.difficulties.hard)
    };
  }

  private buildLibraryEntry(song: SongChartEntry): SongLibraryEntry {
    const bestScoreNormal = ScoreStorage.getBestScore(song.metadata.id, 'normal');
    const bestScoreEasy = ScoreStorage.getBestScore(song.metadata.id, 'easy');
    const bestScoreHard = ScoreStorage.getBestScore(song.metadata.id, 'hard');

    const bestScore = [bestScoreNormal, bestScoreEasy, bestScoreHard]
      .filter((s): s is BestScore => s !== null)
      .sort((a, b) => b.score - a.score)[0];

    const playCount = ScoreStorage.getScoreHistoryForSong(song.metadata.id).length;
    const lastPlayed = this.recentPlayed.get(song.metadata.id);

    return {
      chart: song,
      bestScore,
      isFavorite: this.favorites.has(song.metadata.id),
      isNew: this.newSongs.has(song.metadata.id),
      lastPlayedAt: lastPlayed,
      playCount
    };
  }

  private applyFilter(entries: SongLibraryEntry[], filter: Partial<SongLibraryFilter>): SongLibraryEntry[] {
    return entries.filter(entry => {
      const song = entry.chart;
      const unlockInfo = ChapterUnlockManager.getUnlockInfo(song.metadata.id);

      if (filter.type) {
        switch (filter.type) {
          case 'unlocked':
            if (!unlockInfo.isUnlocked) return false;
            break;
          case 'locked':
            if (unlockInfo.isUnlocked) return false;
            break;
          case 'favorites':
            if (!entry.isFavorite) return false;
            break;
          case 'unplayed':
            if (entry.playCount > 0) return false;
            break;
        }
      }

      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const title = song.metadata.title.toLowerCase();
        const artist = song.metadata.artist.toLowerCase();
        const tags = song.metadata.tags.join(' ').toLowerCase();
        const lyrics = song.metadata.lyrics.toLowerCase();
        if (!title.includes(query) && !artist.includes(query) &&
            !tags.includes(query) && !lyrics.includes(query)) {
          return false;
        }
      }

      if (filter.minStarLevel !== undefined) {
        const maxStars = Math.max(
          song.difficultyConfigs.easy.starLevel,
          song.difficultyConfigs.normal.starLevel,
          song.difficultyConfigs.hard.starLevel
        );
        if (maxStars < filter.minStarLevel) return false;
      }

      if (filter.maxStarLevel !== undefined) {
        const minStars = Math.min(
          song.difficultyConfigs.easy.starLevel,
          song.difficultyConfigs.normal.starLevel,
          song.difficultyConfigs.hard.starLevel
        );
        if (minStars > filter.maxStarLevel) return false;
      }

      if (filter.genres && filter.genres.length > 0) {
        if (!filter.genres.includes(song.metadata.genre)) return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some(t => song.metadata.tags.includes(t));
        if (!hasTag) return false;
      }

      return true;
    });
  }

  private applySort(entries: SongLibraryEntry[], sort: Partial<SongLibrarySort>): SongLibraryEntry[] {
    const type = sort.type ?? 'default';
    const ascending = sort.ascending ?? true;

    const sorted = [...entries].sort((a, b) => {
      let compare = 0;

      switch (type) {
        case 'title':
          compare = a.chart.metadata.title.localeCompare(b.chart.metadata.title, 'zh-CN');
          break;
        case 'artist':
          compare = a.chart.metadata.artist.localeCompare(b.chart.metadata.artist, 'zh-CN');
          break;
        case 'bpm':
          compare = a.chart.metadata.bpm - b.chart.metadata.bpm;
          break;
        case 'difficulty':
          compare = (
            a.chart.difficultyConfigs.normal.starLevel -
            b.chart.difficultyConfigs.normal.starLevel
          );
          break;
        case 'score':
          compare = (a.bestScore?.score ?? 0) - (b.bestScore?.score ?? 0);
          break;
        case 'recent':
          compare = (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0);
          break;
        case 'default':
        default:
          compare = a.chart.sortOrder - b.chart.sortOrder;
      }

      return ascending ? compare : -compare;
    });

    return sorted;
  }

  private emitChange(event: LibraryChangeEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error('SongLibrary change listener error:', e);
      }
    });
  }

  private loadPersistentData(): void {
    try {
      const favData = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (favData) {
        this.favorites = new Set(JSON.parse(favData));
      }

      const recentData = localStorage.getItem(RECENT_STORAGE_KEY);
      if (recentData) {
        const arr: Array<[string, number]> = JSON.parse(recentData);
        this.recentPlayed = new Map(arr);
      }

      const newData = localStorage.getItem(NEW_SONGS_KEY);
      if (newData) {
        this.newSongs = new Set(JSON.parse(newData));
      }
    } catch (e) {
      console.error('Failed to load SongLibrary persistent data:', e);
    }
  }

  private savePersistentData(): void {
    this.saveFavorites();
    this.saveRecent();
    this.saveNewSongs();
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(this.favorites)));
    } catch (e) {
      console.error('Failed to save favorites:', e);
    }
  }

  private saveRecent(): void {
    try {
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(Array.from(this.recentPlayed.entries())));
    } catch (e) {
      console.error('Failed to save recent played:', e);
    }
  }

  private saveNewSongs(): void {
    try {
      localStorage.setItem(NEW_SONGS_KEY, JSON.stringify(Array.from(this.newSongs)));
    } catch (e) {
      console.error('Failed to save new songs:', e);
    }
  }
}
