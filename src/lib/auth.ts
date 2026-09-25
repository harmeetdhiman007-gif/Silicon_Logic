/**
 * Lightweight email + password auth backed by the `players` table.
 *
 * Passwords are never stored in plain text: a random per-user salt is stored
 * alongside a PBKDF2-SHA-256 hash derived in the browser. The active session
 * lives in localStorage (`SiLo-session`) and identifies which `players` row
 * progress writes land on (see getActivePlayerId).
 *
 * NOTE: like the sync module, this uses the database role from the client,
 * which is fine for a personal app but should move behind a server API
 * (`neon-http` / your own endpoint) before a public production launch.
 */

import { sql } from './sync/neon.js';

export interface Session {
  userId: string;
  email: string;
  nickname: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  session?: Session;
}

const SESSION_KEY = 'SiLo-session';
const PBKDF2_ITERATIONS = 100_000;

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s || typeof s.userId !== 'string' || !s.email) return null;
    return s;
  } catch {
    return null;
  }
}

/** The players-row id progress writes should use, or null when signed out. */
export function getActivePlayerId(): string | null {
  return getSession()?.userId ?? null;
}

function setSession(s: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

async function deriveKey(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    256,
  );
  return toHex(new Uint8Array(bits));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function authMessage(e: unknown): string {
  if (
    typeof e === 'object' &&
    e !== null &&
    'message' in e &&
    typeof (e as { message: unknown }).message === 'string'
  ) {
    return (e as { message: string }).message;
  }
  return 'Something went wrong — try again.';
}

export async function signUp(
  email: string,
  password: string,
  nickname: string,
): Promise<AuthResult> {
  const cleanEmail = normalizeEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }
  if (!sql) {
    return {
      ok: false,
      error: 'No database configured — add VITE_DATABASE_URL to .env.local.',
    };
  }
  try {
    const existing = await sql`
      SELECT email FROM players WHERE email = ${cleanEmail}
    `;
    if (existing.length > 0) {
      return { ok: false, error: 'An account with that email already exists — log in instead.' };
    }
    const salt = randomSalt();
    const hash = await deriveKey(password, salt);
    const cleanNick = nickname.trim().slice(0, 24) || 'Explorer';
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO players (id, nickname, email, password_salt, password_hash)
      VALUES (${id}, ${cleanNick}, ${cleanEmail}, ${salt}, ${hash})
    `;
    const session: Session = { userId: id, email: cleanEmail, nickname: cleanNick };
    setSession(session);
    return { ok: true, session };
  } catch (e) {
    return { ok: false, error: authMessage(e) };
  }
}

export async function logIn(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = normalizeEmail(email);
  if (!sql) {
    return {
      ok: false,
      error: 'No database configured — add VITE_DATABASE_URL to .env.local.',
    };
  }
  try {
    const rows = await sql`
      SELECT id, nickname, password_salt, password_hash
      FROM players WHERE email = ${cleanEmail}
    `;
    if (rows.length === 0) {
      return { ok: false, error: 'No account found with that email.' };
    }
    const row = rows[0] as {
      id: string;
      nickname: string;
      password_salt: string;
      password_hash: string;
    };
    const hash = await deriveKey(password, row.password_salt);
    if (hash !== row.password_hash) {
      return { ok: false, error: 'Incorrect password.' };
    }
    const session: Session = {
      userId: row.id,
      email: cleanEmail,
      nickname: row.nickname,
    };
    setSession(session);
    return { ok: true, session };
  } catch (e) {
    return { ok: false, error: authMessage(e) };
  }
}

export function logOut(): void {
  clearSession();
}