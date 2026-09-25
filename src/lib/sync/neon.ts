/**
 * Optional Neon sync module.
 *
 * Syncs XP, streak and completed lessons to your Neon database so progress
 * follows you across devices.
 *
 * Usage:
 *   1. Copy .env.example → .env.local and fill in DATABASE_URL
 *   2. Call `initSync()` once at app start (or skip — local-first by default)
 *   3. Call `pushProgress()` after each XP / lesson change
 *
 * SECURITY NOTE: embedding a Postgres connection string in a client app is
 * acceptable for personal projects but not recommended for production.
 * For a real deploy, proxy writes through your own API server.
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL: string | undefined = import.meta.env.VITE_DATABASE_URL;

export const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

/**
 * The player identity used for guest (not signed-in) progress writes.
 * A signed-in user returns their account row id instead — see getActivePlayerId().
 */
export function getDeviceId(): string {
  let id = localStorage.getItem('SiLo-device-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('SiLo-device-id', id);
  }
  return id;
}

export async function initSync(playerId?: string): Promise<boolean> {
  if (!sql) return false;
  try {
    const id = playerId ?? getDeviceId();
    await sql`INSERT INTO players (id) VALUES (${id}) ON CONFLICT (id) DO NOTHING`;
    return true;
  } catch {
    return false;
  }
}

export async function pushProgress(
  xp: number,
  streak: number,
  lessonsCompleted: number,
  coins: number,
  nickname: string,
  playerId?: string,
): Promise<void> {
  if (!sql) return;
  try {
    const id = playerId ?? getDeviceId();
    await sql`
      WITH this_week AS (SELECT date_trunc('week', now())::date AS d)
      UPDATE players
      SET
        nickname = COALESCE(NULLIF(${nickname}, ''), nickname),
        coins = ${coins},
        xp = ${xp},
        streak = ${streak},
        lessons_completed = ${lessonsCompleted},
        week_started = CASE
          WHEN week_started IS DISTINCT FROM (SELECT d FROM this_week) THEN (SELECT d FROM this_week)
          ELSE week_started
        END,
        week_start_xp = CASE
          WHEN week_started IS DISTINCT FROM (SELECT d FROM this_week) THEN xp
          ELSE week_start_xp
        END,
        updated_at = now()
      WHERE id = ${id}
    `;
  } catch {
    // silent fail — app is local-first
  }
}

export async function markLesson(lessonId: string, playerId?: string): Promise<void> {
  if (!sql) return;
  try {
    const id = playerId ?? getDeviceId();
    await sql`
      INSERT INTO completed_lessons (player_id, lesson_id)
      VALUES (${id}, ${lessonId})
      ON CONFLICT (player_id, lesson_id) DO NOTHING
    `;
  } catch {
    // silent fail
  }
}

export interface LeaderboardEntry {
  nickname: string;
  xp: number;
  streak: number;
  weekGain: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT nickname, xp, streak, (xp - week_start_xp) AS week_gain
      FROM players
      WHERE week_started = date_trunc('week', now())::date
      ORDER BY week_gain DESC, xp DESC
      LIMIT 10
    `;
    return rows as unknown as LeaderboardEntry[];
  } catch {
    return [];
  }
}
