import type { DailyQuest, QuestKind } from './store.js';

export type QuestSeed =
  | { kind: 'lessons'; title: string; target: number; reward: [number, number] }
  | { kind: 'xp'; title: string; target: number; reward: [number, number] }
  | { kind: 'answers'; title: string; target: number; reward: [number, number] }
  | { kind: 'circuits'; title: string; target: number; reward: [number, number] }
  | { kind: 'charge'; title: string; target: number; reward: [number, number] };

// Deterministic PRNG so the day's quests are stable across renders.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOLS: QuestSeed[][] = [
  [
    { kind: 'lessons', title: 'Complete 1 lesson', target: 1, reward: [15, 0] },
    { kind: 'lessons', title: 'Finish 2 lessons', target: 2, reward: [25, 0] },
    { kind: 'lessons', title: 'Complete 3 lessons', target: 3, reward: [35, 20] },
  ],
  [
    { kind: 'xp', title: 'Bank 30 XP', target: 30, reward: [15, 10] },
    { kind: 'xp', title: 'Bank 60 XP', target: 60, reward: [25, 0] },
    { kind: 'xp', title: 'Bank 100 XP', target: 100, reward: [40, 25] },
  ],
  [
    { kind: 'answers', title: 'Answer 3 questions', target: 3, reward: [15, 0] },
    { kind: 'answers', title: 'Answer 5 questions', target: 5, reward: [25, 15] },
    { kind: 'answers', title: 'Answer 8 questions', target: 8, reward: [35, 0] },
  ],
  [
    { kind: 'circuits', title: 'Solve 1 circuit', target: 1, reward: [20, 0] },
    { kind: 'circuits', title: 'Solve 2 circuits', target: 2, reward: [30, 20] },
    { kind: 'circuits', title: 'Solve 3 circuit puzzles', target: 3, reward: [40, 30] },
  ],
  [
    { kind: 'charge', title: 'Do the Daily Charge', target: 1, reward: [15, 10] },
    { kind: 'charge', title: 'Score 3 in the Daily Charge', target: 3, reward: [25, 0] },
    { kind: 'charge', title: 'Clear the Daily Charge', target: 5, reward: [35, 25] },
  ],
];

// 3 quests, one from each of 3 distinct pools.
export function generateDailyQuests(dateStr: string): DailyQuest[] {
  const rng = mulberry32(hashStr('SiLo-quests:' + dateStr));
  const poolIdx = [rng(), rng(), rng()].map(
    (r) => Math.floor(r * 5) % POOLS.length,
  );
  const used = new Set<number>();
  const picks: QuestSeed[] = [];
  for (const idx of poolIdx) {
    const pool = POOLS[idx % POOLS.length];
    const item = pool[Math.floor(rng() * pool.length)];
    picks.push(item);
    used.add(idx % POOLS.length);
  }
  const leftovers = [0, 1, 2, 3, 4]
    .filter((i) => !used.has(i))
    .map((i) => POOLS[i])
    .flat();
  while (picks.length < 3 && leftovers.length > 0) {
    picks.push(leftovers[Math.floor(rng() * leftovers.length)]);
  }

  return picks.map((p, i) => {
    const [xpReward, coinReward] = p.reward;
    return {
      id: p.kind + '-' + (i + 1) + '-' + dateStr.replace(/-/g, ''),
      title: p.title,
      target: p.target,
      progress: 0,
      reward: xpReward,
      coinReward,
      completed: false,
      kind: p.kind as QuestKind,
    };
  });
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}