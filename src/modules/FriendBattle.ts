import {
  FriendInfo,
  ChallengeInvitation,
  BattlePlayerResult,
  BattleComparison,
  ReplayData,
  ReplayJudgeEvent,
  FriendBattleState,
  Difficulty,
  ScoreData,
  JudgeEvent,
  FRIEND_BATTLE_STORAGE_KEY,
  CHALLENGE_EXPIRY_MS,
  MAX_CHALLENGES,
  MAX_REPLAY_DATA
} from '../types';
import { ScoreSystem } from './ScoreSystem';
import { AccountSystem } from './AccountSystem';

type BattleEventCallback = (event: BattleEvent) => void;

export type BattleEvent =
  | { type: 'challenge_created'; challengeId: string }
  | { type: 'challenge_accepted'; challengeId: string }
  | { type: 'challenge_rejected'; challengeId: string }
  | { type: 'challenge_expired'; challengeId: string }
  | { type: 'challenge_completed'; challengeId: string }
  | { type: 'result_submitted'; challengeId: string; playerId: string }
  | { type: 'friend_added'; playerId: string }
  | { type: 'friend_removed'; playerId: string };

export class FriendBattle {
  private static state: FriendBattleState = {
    friends: [],
    challenges: [],
    battleResults: [],
    replayData: {}
  };

  private static listeners: BattleEventCallback[] = [];
  private static replayScoreSystem: ScoreSystem | null = null;
  private static replayEventIndex: number = 0;
  private static replayPlaying: boolean = false;

  public static initialize(): void {
    this.loadState();
    this.expireOldChallenges();
  }

  private static loadState(): void {
    try {
      const data = localStorage.getItem(FRIEND_BATTLE_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.state = {
          friends: parsed.friends ?? [],
          challenges: parsed.challenges ?? [],
          battleResults: parsed.battleResults ?? [],
          replayData: parsed.replayData ?? {}
        };
      }
    } catch (e) {
      console.error('Failed to load friend battle state:', e);
    }
  }

  private static saveState(): void {
    try {
      localStorage.setItem(FRIEND_BATTLE_STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save friend battle state:', e);
    }
  }

  public static addListener(callback: BattleEventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private static emitEvent(event: BattleEvent): void {
    this.listeners.forEach(cb => cb(event));
  }

  private static getCurrentPlayerId(): string {
    const account = AccountSystem.getCurrentAccount();
    return account?.accountId ?? 'local_player';
  }

  private static getCurrentPlayerName(): string {
    const account = AccountSystem.getCurrentAccount();
    return account?.displayName ?? '游客玩家';
  }

  private static generateId(prefix: string): string {
    return prefix + '_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
  }

  private static expireOldChallenges(): void {
    const now = Date.now();
    let changed = false;

    this.state.challenges.forEach(challenge => {
      if (challenge.status === 'pending' && now > challenge.expiresAt) {
        challenge.status = 'expired';
        changed = true;
        this.emitEvent({ type: 'challenge_expired', challengeId: challenge.challengeId });
      }
    });

    if (changed) {
      this.saveState();
    }
  }

  public static addFriend(playerId: string, displayName: string, avatar?: string): FriendInfo {
    const existing = this.state.friends.find(f => f.playerId === playerId);
    if (existing) {
      existing.displayName = displayName;
      existing.lastActiveAt = Date.now();
      if (avatar) existing.avatar = avatar;
      this.saveState();
      return existing;
    }

    const friend: FriendInfo = {
      playerId,
      displayName,
      avatar,
      addedAt: Date.now(),
      lastActiveAt: Date.now()
    };

    this.state.friends.push(friend);
    this.saveState();
    this.emitEvent({ type: 'friend_added', playerId });
    return friend;
  }

  public static removeFriend(playerId: string): void {
    this.state.friends = this.state.friends.filter(f => f.playerId !== playerId);
    this.saveState();
    this.emitEvent({ type: 'friend_removed', playerId });
  }

  public static getFriends(): FriendInfo[] {
    return [...this.state.friends];
  }

  public static getFriendById(playerId: string): FriendInfo | undefined {
    return this.state.friends.find(f => f.playerId === playerId);
  }

  public static createChallenge(
    challengedId: string,
    challengedName: string,
    songId: string,
    songTitle: string,
    difficulty: Difficulty
  ): ChallengeInvitation {
    if (this.state.challenges.length >= MAX_CHALLENGES) {
      this.state.challenges = this.state.challenges.filter(c => c.status !== 'completed' && c.status !== 'expired' && c.status !== 'rejected');
      if (this.state.challenges.length >= MAX_CHALLENGES) {
        this.state.challenges.sort((a, b) => a.createdAt - b.createdAt);
        this.state.challenges = this.state.challenges.slice(this.state.challenges.length - MAX_CHALLENGES + 1);
      }
    }

    const now = Date.now();
    const challengerId = this.getCurrentPlayerId();
    const challengerName = this.getCurrentPlayerName();

    const challenge: ChallengeInvitation = {
      challengeId: this.generateId('ch'),
      challengerId,
      challengerName,
      challengedId,
      challengedName,
      songId,
      songTitle,
      difficulty,
      status: 'pending',
      createdAt: now,
      expiresAt: now + CHALLENGE_EXPIRY_MS
    };

    this.state.challenges.push(challenge);
    this.saveState();
    this.emitEvent({ type: 'challenge_created', challengeId: challenge.challengeId });
    return challenge;
  }

  public static acceptChallenge(challengeId: string): boolean {
    const challenge = this.state.challenges.find(c => c.challengeId === challengeId);
    if (!challenge) return false;
    if (challenge.status !== 'pending') return false;

    const currentId = this.getCurrentPlayerId();
    if (challenge.challengedId !== currentId && challenge.challengerId !== currentId) return false;

    challenge.status = 'accepted';
    challenge.acceptedAt = Date.now();
    this.saveState();
    this.emitEvent({ type: 'challenge_accepted', challengeId });
    return true;
  }

  public static rejectChallenge(challengeId: string): boolean {
    const challenge = this.state.challenges.find(c => c.challengeId === challengeId);
    if (!challenge) return false;
    if (challenge.status !== 'pending') return false;

    challenge.status = 'rejected';
    this.saveState();
    this.emitEvent({ type: 'challenge_rejected', challengeId });
    return true;
  }

  public static submitBattleResult(
    challengeId: string,
    scoreData: ScoreData,
    accuracy: number,
    judgeEvents: JudgeEvent[],
    totalNotes: number
  ): BattlePlayerResult | null {
    const challenge = this.state.challenges.find(c => c.challengeId === challengeId);
    if (!challenge) return null;
    if (challenge.status !== 'accepted') return null;

    const currentId = this.getCurrentPlayerId();
    const currentName = this.getCurrentPlayerName();
    const isChallenger = challenge.challengerId === currentId;
    const isChallenged = challenge.challengedId === currentId;

    if (!isChallenger && !isChallenged) return null;

    const playerResult: BattlePlayerResult = {
      playerId: currentId,
      displayName: currentName,
      score: scoreData.score,
      rating: scoreData.rating,
      maxCombo: scoreData.maxCombo,
      perfect: scoreData.perfect,
      great: scoreData.great,
      good: scoreData.good,
      miss: scoreData.miss,
      accuracy,
      completedAt: Date.now()
    };

    this.saveReplayData(challengeId, currentId, challenge.songId, challenge.difficulty, judgeEvents, totalNotes);

    let comparison = this.state.battleResults.find(b => b.challengeId === challengeId);

    if (!comparison) {
      comparison = {
        challengeId,
        songId: challenge.songId,
        songTitle: challenge.songTitle,
        difficulty: challenge.difficulty,
        challengerResult: isChallenger ? playerResult : null,
        challengedResult: isChallenged ? playerResult : null,
        winnerId: null,
        scoreDiff: 0,
        isDraw: false
      };
      this.state.battleResults.push(comparison);
    } else {
      if (isChallenger) {
        comparison.challengerResult = playerResult;
      } else {
        comparison.challengedResult = playerResult;
      }
    }

    this.updateComparisonWinner(comparison);

    if (comparison.challengerResult && comparison.challengedResult) {
      challenge.status = 'completed';
      challenge.completedAt = Date.now();
      this.emitEvent({ type: 'challenge_completed', challengeId });
    } else {
      this.emitEvent({ type: 'result_submitted', challengeId, playerId: currentId });
    }

    this.saveState();
    return playerResult;
  }

  private static updateComparisonWinner(comparison: BattleComparison): void {
    if (!comparison.challengerResult || !comparison.challengedResult) {
      comparison.winnerId = null;
      comparison.scoreDiff = 0;
      comparison.isDraw = false;
      return;
    }

    const challengerScore = comparison.challengerResult.score;
    const challengedScore = comparison.challengedResult.score;
    comparison.scoreDiff = Math.abs(challengerScore - challengedScore);

    if (challengerScore > challengedScore) {
      comparison.winnerId = comparison.challengerResult.playerId;
      comparison.isDraw = false;
    } else if (challengedScore > challengerScore) {
      comparison.winnerId = comparison.challengedResult.playerId;
      comparison.isDraw = false;
    } else {
      comparison.winnerId = null;
      comparison.isDraw = true;
    }
  }

  public static getPendingChallenges(): ChallengeInvitation[] {
    this.expireOldChallenges();
    const currentId = this.getCurrentPlayerId();
    return this.state.challenges.filter(
      c => c.status === 'pending' && (c.challengedId === currentId || c.challengerId === currentId)
    );
  }

  public static getAcceptedChallenges(): ChallengeInvitation[] {
    const currentId = this.getCurrentPlayerId();
    return this.state.challenges.filter(
      c => c.status === 'accepted' && (c.challengedId === currentId || c.challengerId === currentId)
    );
  }

  public static getCompletedChallenges(): ChallengeInvitation[] {
    const currentId = this.getCurrentPlayerId();
    return this.state.challenges.filter(
      c => c.status === 'completed' && (c.challengedId === currentId || c.challengerId === currentId)
    );
  }

  public static getAllChallenges(): ChallengeInvitation[] {
    const currentId = this.getCurrentPlayerId();
    return this.state.challenges.filter(
      c => c.challengedId === currentId || c.challengerId === currentId
    );
  }

  public static getChallengeById(challengeId: string): ChallengeInvitation | undefined {
    return this.state.challenges.find(c => c.challengeId === challengeId);
  }

  public static getBattleComparison(challengeId: string): BattleComparison | null {
    return this.state.battleResults.find(b => b.challengeId === challengeId) ?? null;
  }

  public static getAllBattleResults(): BattleComparison[] {
    const currentId = this.getCurrentPlayerId();
    return this.state.battleResults.filter(b => {
      const challenge = this.state.challenges.find(c => c.challengeId === b.challengeId);
      return challenge && (challenge.challengerId === currentId || challenge.challengedId === currentId);
    });
  }

  public static getDetailedComparison(challengeId: string): DetailedComparison | null {
    const challenge = this.state.challenges.find(c => c.challengeId === challengeId);
    const comparison = this.state.battleResults.find(b => b.challengeId === challengeId);
    if (!challenge || !comparison) return null;

    const challengerReplay = this.loadReplayData(challengeId, challenge.challengerId);
    const challengedReplay = this.loadReplayData(challengeId, challenge.challengedId);

    return {
      challenge,
      comparison,
      challengerReplay: challengerReplay ?? undefined,
      challengedReplay: challengedReplay ?? undefined,
      statDifferences: comparison.challengerResult && comparison.challengedResult
        ? this.computeStatDifferences(comparison.challengerResult, comparison.challengedResult)
        : undefined
    };
  }

  private static computeStatDifferences(a: BattlePlayerResult, b: BattlePlayerResult): StatDifferences {
    return {
      scoreDiff: a.score - b.score,
      accuracyDiff: a.accuracy - b.accuracy,
      maxComboDiff: a.maxCombo - b.maxCombo,
      perfectDiff: a.perfect - b.perfect,
      greatDiff: a.great - b.great,
      goodDiff: a.good - b.good,
      missDiff: a.miss - b.miss
    };
  }

  private static saveReplayData(
    challengeId: string,
    playerId: string,
    songId: string,
    difficulty: Difficulty,
    judgeEvents: JudgeEvent[],
    totalNotes: number
  ): void {
    const key = `${challengeId}_${playerId}`;

    const replayEvents: ReplayJudgeEvent[] = judgeEvents.map(e => ({
      result: e.result,
      time: e.time,
      lane: e.lane,
      lyricChar: e.lyricChar,
      noteType: e.noteType,
      noteId: e.noteId
    }));

    const replay: ReplayData = {
      challengeId,
      playerId,
      songId,
      difficulty,
      judgeEvents: replayEvents,
      totalNotes,
      recordedAt: Date.now()
    };

    this.state.replayData[key] = replay;

    const keys = Object.keys(this.state.replayData);
    if (keys.length > MAX_REPLAY_DATA) {
      const sorted = keys.sort((a, b) =>
        this.state.replayData[a].recordedAt - this.state.replayData[b].recordedAt
      );
      const toRemove = sorted.slice(0, keys.length - MAX_REPLAY_DATA);
      toRemove.forEach(k => delete this.state.replayData[k]);
    }
  }

  private static loadReplayData(challengeId: string, playerId: string): ReplayData | null {
    const key = `${challengeId}_${playerId}`;
    return this.state.replayData[key] ?? null;
  }

  public static getReplayData(challengeId: string, playerId: string): ReplayData | null {
    return this.loadReplayData(challengeId, playerId);
  }

  public static startReplay(replayData: ReplayData): void {
    this.replayScoreSystem = new ScoreSystem(replayData.totalNotes);
    this.replayEventIndex = 0;
    this.replayPlaying = true;
  }

  public static processReplayUpToTime(time: number): ScoreData | null {
    if (!this.replayScoreSystem || !this.replayPlaying) return null;

    const replay = this.getCurrentReplayData();
    if (!replay) return null;

    while (this.replayEventIndex < replay.judgeEvents.length) {
      const event = replay.judgeEvents[this.replayEventIndex];
      if (event.time > time) break;

      this.replayScoreSystem.addJudgeResult(event.result, event.noteType);
      this.replayEventIndex++;
    }

    return this.replayScoreSystem.getScore();
  }

  public static isReplayComplete(): boolean {
    if (!this.replayScoreSystem || !this.replayPlaying) return true;
    return this.replayScoreSystem.isAllJudged();
  }

  public static stopReplay(): void {
    this.replayScoreSystem = null;
    this.replayEventIndex = 0;
    this.replayPlaying = false;
  }

  private static getCurrentReplayData(): ReplayData | null {
    for (const key of Object.keys(this.state.replayData)) {
      const data = this.state.replayData[key];
      return data;
    }
    return null;
  }

  public static replayJudgeEvents(replayData: ReplayData): ReplaySimulator {
    return new ReplaySimulator(replayData);
  }

  public static calculateBattleScoreFromReplay(replayData: ReplayData): ScoreData {
    const scoreSystem = new ScoreSystem(replayData.totalNotes);
    for (const event of replayData.judgeEvents) {
      scoreSystem.addJudgeResult(event.result, event.noteType);
    }
    return scoreSystem.getScore();
  }

  public static getBattleStats(): BattleStats {
    const currentId = this.getCurrentPlayerId();
    const completedBattles = this.state.battleResults.filter(b => {
      const challenge = this.state.challenges.find(c => c.challengeId === b.challengeId);
      return challenge && (challenge.challengerId === currentId || challenge.challengedId === currentId);
    });

    let wins = 0;
    let losses = 0;
    let draws = 0;

    completedBattles.forEach(b => {
      if (b.isDraw) {
        draws++;
      } else if (b.winnerId === currentId) {
        wins++;
      } else {
        losses++;
      }
    });

    return {
      totalBattles: completedBattles.length,
      wins,
      losses,
      draws,
      winRate: completedBattles.length > 0 ? (wins / completedBattles.length) * 100 : 0,
      pendingChallenges: this.getPendingChallenges().length,
      activeChallenges: this.getAcceptedChallenges().length
    };
  }

  public static findOrCreateQuickBattle(
    friendId: string,
    friendName: string,
    songId: string,
    songTitle: string,
    difficulty: Difficulty
  ): ChallengeInvitation {
    const existing = this.state.challenges.find(c =>
      c.status === 'accepted' &&
      c.songId === songId &&
      c.difficulty === difficulty &&
      ((c.challengerId === this.getCurrentPlayerId() && c.challengedId === friendId) ||
       (c.challengerId === friendId && c.challengedId === this.getCurrentPlayerId()))
    );

    if (existing) return existing;

    return this.createChallenge(friendId, friendName, songId, songTitle, difficulty);
  }

  public static getWinStreak(): number {
    const currentId = this.getCurrentPlayerId();
    const completed = this.state.battleResults
      .filter(b => {
        const challenge = this.state.challenges.find(c => c.challengeId === b.challengeId);
        return challenge && (challenge.challengerId === currentId || challenge.challengedId === currentId);
      })
      .sort((a, b) => {
        const ca = this.state.challenges.find(c => c.challengeId === a.challengeId);
        const cb = this.state.challenges.find(c => c.challengeId === b.challengeId);
        return (cb?.completedAt ?? 0) - (ca?.completedAt ?? 0);
      });

    let streak = 0;
    for (const battle of completed) {
      if (battle.winnerId === currentId) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  public static getState(): FriendBattleState {
    return {
      friends: [...this.state.friends],
      challenges: [...this.state.challenges],
      battleResults: [...this.state.battleResults],
      replayData: { ...this.state.replayData }
    };
  }
}

export class ReplaySimulator {
  private scoreSystem: ScoreSystem;
  private events: ReplayJudgeEvent[];
  private currentIndex: number = 0;

  constructor(replayData: ReplayData) {
    this.scoreSystem = new ScoreSystem(replayData.totalNotes);
    this.events = [...replayData.judgeEvents].sort((a, b) => a.time - b.time);
  }

  public advanceToTime(time: number): ScoreData {
    while (this.currentIndex < this.events.length) {
      const event = this.events[this.currentIndex];
      if (event.time > time) break;

      this.scoreSystem.addJudgeResult(event.result, event.noteType);
      this.currentIndex++;
    }
    return this.scoreSystem.getScore();
  }

  public advanceByEvent(count: number = 1): ReplayJudgeEvent[] {
    const processed: ReplayJudgeEvent[] = [];
    for (let i = 0; i < count && this.currentIndex < this.events.length; i++) {
      const event = this.events[this.currentIndex];
      this.scoreSystem.addJudgeResult(event.result, event.noteType);
      processed.push(event);
      this.currentIndex++;
    }
    return processed;
  }

  public getCurrentScore(): ScoreData {
    return this.scoreSystem.getScore();
  }

  public getCurrentAccuracy(): number {
    return this.scoreSystem.calculateAccuracy();
  }

  public getCombo(): number {
    return this.scoreSystem.getCombo();
  }

  public getProgress(): number {
    return this.scoreSystem.getProgress();
  }

  public isComplete(): boolean {
    return this.scoreSystem.isAllJudged();
  }

  public getRemainingEvents(): number {
    return this.events.length - this.currentIndex;
  }

  public getTotalEvents(): number {
    return this.events.length;
  }

  public reset(): void {
    this.scoreSystem.reset();
    this.currentIndex = 0;
  }
}

export interface DetailedComparison {
  challenge: ChallengeInvitation;
  comparison: BattleComparison;
  challengerReplay?: ReplayData;
  challengedReplay?: ReplayData;
  statDifferences?: StatDifferences;
}

export interface StatDifferences {
  scoreDiff: number;
  accuracyDiff: number;
  maxComboDiff: number;
  perfectDiff: number;
  greatDiff: number;
  goodDiff: number;
  missDiff: number;
}

export interface BattleStats {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  pendingChallenges: number;
  activeChallenges: number;
}
