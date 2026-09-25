import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import { generateDailyQuests, todayStr } from './quests.js';

export interface DailyQuest {
  id: string;
  title: string;
  target: number;
  progress: number;
  reward: number;
  coinReward: number;
  completed: boolean;
  kind: QuestKind;
}

export type QuestKind = 'lessons' | 'xp' | 'answers' | 'circuits' | 'charge';

export interface Account {
  id: string;
  nickname: string;
}

interface ChargeState {
  date: string;
  answered: number;
  correct: number;
}

interface AppState {
  xp: number;
  coins: number;
  streak: number;
  lastStudyDate: string | null;
  streakFreezes: number;
  hearts: number;
  heartsUpdatedAt: number;
  completedLessonIds: string[];
  completedStepIds: string[];
  practiceQueue: string[];
  practiceStage: Record<string, number>;
  practiceDue: Record<string, number>;
  dailyQuests: DailyQuest[];
  questsDate: string;
  dailyCharge: ChargeState | null;
  account: Account;
  duelsWon: number;
  labBuilds: number;

  addXP: (amount: number) => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  completeLesson: (lessonId: string) => void;
  completeStep: (stepId: string) => void;
  isLessonCompleted: (lessonId: string) => boolean;
  isStepCompleted: (stepId: string) => boolean;
  updateStreak: () => void;
  incrementQuestKind: (kind: QuestKind, amount?: number) => void;

  currentHearts: () => number;
  spendHeart: () => boolean;
  refillHeartsFull: () => void;
  buyHeartsRefill: () => boolean;

  enqueueMissed: (stepId: string) => void;
  practiceCorrect: (stepId: string) => void;
  practiceWrong: (stepId: string) => void;
  clearPractice: (stepId: string) => void;
  duePracticeIds: () => string[];

  chargeState: () => ChargeState;
  recordChargeAnswer: (correct: boolean) => void;

  setNickname: (nickname: string) => void;
  grantStreakFreeze: () => boolean;
  countDuelWin: () => void;
  countLabBuild: () => void;
}

// ── constants ─────────────────────────────────────────────────────────
export const MAX_HEARTS = 5;
export const HEART_REPLENISH_MS = 30 * 60 * 1000; // 1 heart / 30 min
export const STREAK_FREEZE_COST = 200;
export const HEART_REFILL_COST = 450;
export const PRACTICE_XP = 5;
export const CHARGE_DAILY_LIMIT = 5;
export const CHARGE_XP_PER = 3;
export const WEEKLY_STREAK_REWARD = 100; // coins at every 7-day milestone

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'p-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function tickStreak(s: AppState): Partial<AppState> {
  const today = todayStr();
  if (s.lastStudyDate === today) return {};
  if (s.lastStudyDate) {
    const last = new Date(s.lastStudyDate).getTime();
    const diff = Math.floor((Date.now() - last) / 86_400_000);
    if (diff === 1) {
      const streak = s.streak + 1;
      const coins =
        streak > 0 && streak % 7 === 0
          ? (s.coins ?? 0) + WEEKLY_STREAK_REWARD
          : s.coins;
      return { streak, lastStudyDate: today, coins };
    }
    if (diff > 1) {
      if ((s.streakFreezes ?? 0) > 0) {
        return {
          streak: s.streak,
          streakFreezes: s.streakFreezes - 1,
          lastStudyDate: today,
        };
      }
      return { streak: 1, lastStudyDate: today };
    }
  }
  return { streak: 1, lastStudyDate: today };
}

function refillHearts(s: AppState): AppState {
  const now = Date.now();
  const elapsed = now - (s.heartsUpdatedAt ?? now);
  const gained = Math.floor(elapsed / HEART_REPLENISH_MS);
  if (gained <= 0) return s;
  return {
    ...s,
    hearts: Math.min(s.hearts + gained, MAX_HEARTS),
    heartsUpdatedAt: now - (elapsed % HEART_REPLENISH_MS),
  };
}

function rotateQuests(s: AppState): AppState {
  const today = todayStr();
  if (s.questsDate === today && s.dailyQuests.length > 0) return s;
  return { ...s, questsDate: today, dailyQuests: generateDailyQuests(today) };
}

function freshCharge(): ChargeState {
  return { date: todayStr(), answered: 0, correct: 0 };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      xp: 0,
      coins: 0,
      streak: 0,
      lastStudyDate: null,
      streakFreezes: 0,
      hearts: MAX_HEARTS,
      heartsUpdatedAt: Date.now(),
      completedLessonIds: [],
      completedStepIds: [],
      practiceQueue: [],
      practiceStage: {},
      practiceDue: {},
      dailyQuests: [],
      questsDate: '',
      dailyCharge: null,
      account: { id: newId(), nickname: 'Explorer' },
      duelsWon: 0,
      labBuilds: 0,

      addXP: (amount) =>
        set((s) => {
          const rotated = rotateQuests(s);
          let bonus = 0;
          let coinBonus = 0;
          const quests = rotated.dailyQuests.map((q) => {
            if (q.kind !== 'xp' || q.completed) return q;
            const progress = q.progress + amount;
            if (progress < q.target) return { ...q, progress };
            bonus += q.reward;
            coinBonus += q.coinReward;
            return { ...q, progress: q.target, completed: true };
          });
          return {
            ...rotated,
            dailyQuests: quests,
            xp: rotated.xp + amount + bonus,
            coins: rotated.coins + coinBonus,
          };
        }),

      addCoins: (amount) =>
        set((s) => ({ coins: s.coins + amount })),

      spendCoins: (amount) => {
        if (get().coins < amount) return false;
        set((s) => ({ coins: s.coins - amount }));
        return true;
      },

      completeLesson: (lessonId) =>
        set((s) => {
          if (s.completedLessonIds.includes(lessonId)) return s;
          return {
            ...tickStreak(s),
            completedLessonIds: [...s.completedLessonIds, lessonId],
          };
        }),

      completeStep: (stepId) =>
        set((s) => {
          if (s.completedStepIds.includes(stepId)) return s;
          return {
            ...tickStreak(s),
            completedStepIds: [...s.completedStepIds, stepId],
          };
        }),

      updateStreak: () => set((s) => tickStreak(s)),

      isLessonCompleted: (lessonId) =>
        get().completedLessonIds.includes(lessonId),
      isStepCompleted: (stepId) => get().completedStepIds.includes(stepId),

      incrementQuestKind: (kind, amount = 1) =>
        set((s) => {
          const rotated = rotateQuests(s);
          let xpBonus = 0;
          let coinBonus = 0;
          const quests = rotated.dailyQuests.map((q) => {
            if (q.kind !== kind || q.completed) return q;
            const progress = q.progress + amount;
            if (progress < q.target) return { ...q, progress };
            xpBonus += q.reward;
            coinBonus += q.coinReward;
            return { ...q, progress: q.target, completed: true };
          });
          return {
            ...rotated,
            dailyQuests: quests,
            xp: rotated.xp + xpBonus,
            coins: rotated.coins + coinBonus,
          };
        }),

      currentHearts: () => refillHearts(get()).hearts,

      spendHeart: () => {
        const s = refillHearts(get());
        if (s.hearts <= 0) return false;
        set(() => ({
          hearts: s.hearts - 1,
          heartsUpdatedAt: Date.now(),
        }));
        return true;
      },

      refillHeartsFull: () =>
        set(() => ({ hearts: MAX_HEARTS, heartsUpdatedAt: Date.now() })),

      buyHeartsRefill: () => {
        if (!get().spendCoins(HEART_REFILL_COST)) return false;
        get().refillHeartsFull();
        return true;
      },

      enqueueMissed: (stepId) =>
        set((s) => {
          if (s.practiceQueue.includes(stepId)) return s;
          return {
            practiceQueue: [...s.practiceQueue, stepId],
            practiceStage: { ...s.practiceStage, [stepId]: 0 },
            practiceDue: { ...s.practiceDue, [stepId]: Date.now() },
          };
        }),

      practiceCorrect: (stepId) => {
        const s = get();
        const stage = (s.practiceStage[stepId] ?? 0) + 1;
        const wait =
          stage === 1 ? 86_400_000 : stage === 2 ? 3 * 86_400_000 : 0;
        const due = Date.now() + wait;
        set((st) => ({
          practiceQueue: st.practiceQueue.filter((id) => id !== stepId),
          practiceStage: { ...st.practiceStage, [stepId]: stage },
          practiceDue: { ...st.practiceDue, [stepId]: due },
        }));
        get().addXP(PRACTICE_XP);
      },

      practiceWrong: (stepId) =>
        set((s) => ({
          practiceStage: { ...s.practiceStage, [stepId]: 0 },
          practiceDue: { ...s.practiceDue, [stepId]: Date.now() },
        })),

      clearPractice: (stepId) =>
        set((s) => ({
          practiceQueue: s.practiceQueue.filter((id) => id !== stepId),
          practiceDue: {
            ...s.practiceDue,
            [stepId]: Date.now() + 30 * 86_400_000,
          },
        })),

      duePracticeIds: () => {
        const s = get();
        const now = Date.now();
        return s.practiceQueue.filter(
          (id) => (s.practiceDue[id] ?? 0) <= now,
        );
      },

      chargeState: () => {
        const s = get();
        const ch = s.dailyCharge;
        if (!ch || ch.date !== todayStr()) return { ...freshCharge() };
        return ch;
      },

      recordChargeAnswer: (correct) => {
        const s = get();
        const ch =
          s.dailyCharge && s.dailyCharge.date === todayStr()
            ? s.dailyCharge
            : freshCharge();
        if (ch.answered >= CHARGE_DAILY_LIMIT) return;
        set(() => ({
          dailyCharge: {
            ...ch,
            answered: ch.answered + 1,
            correct: ch.correct + (correct ? 1 : 0),
          },
        }));
        if (correct) get().addXP(CHARGE_XP_PER);
        get().incrementQuestKind('charge');
      },

      setNickname: (nickname) =>
        set((s) => ({
          account: {
            ...s.account,
            nickname: nickname.trim().slice(0, 24) || 'Explorer',
          },
        })),

      grantStreakFreeze: () => {
        if (!get().spendCoins(STREAK_FREEZE_COST)) return false;
        set((s) => ({ streakFreezes: (s.streakFreezes ?? 0) + 1 }));
        return true;
      },

      countDuelWin: () =>
        set((s) => ({ duelsWon: (s.duelsWon ?? 0) + 1 })),

      countLabBuild: () =>
        set((s) => ({ labBuilds: (s.labBuilds ?? 0) + 1 })),
    }),
    {
      name: 'SiLo-progress',
      version: 3,
      partialize: (s) => ({
        xp: s.xp,
        coins: s.coins,
        streak: s.streak,
        lastStudyDate: s.lastStudyDate,
        streakFreezes: s.streakFreezes,
        hearts: s.hearts,
        heartsUpdatedAt: s.heartsUpdatedAt,
        completedLessonIds: s.completedLessonIds,
        completedStepIds: s.completedStepIds,
        practiceQueue: s.practiceQueue,
        practiceStage: s.practiceStage,
        practiceDue: s.practiceDue,
        dailyQuests: s.dailyQuests,
        questsDate: s.questsDate,
        dailyCharge: s.dailyCharge,
        account: s.account,
        duelsWon: s.duelsWon,
        labBuilds: s.labBuilds,
      }),
    },
  ),
);

/** Reactive hearts count that ticks up every 30 minutes while open. */
export function useCurrentHearts(): number {
  const heartsField = useStore((s) => s.hearts);
  const heartsUpdatedAt = useStore((s) => s.heartsUpdatedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return Math.min(
    MAX_HEARTS,
    heartsField + Math.floor((now - heartsUpdatedAt) / HEART_REPLENISH_MS),
  );
}