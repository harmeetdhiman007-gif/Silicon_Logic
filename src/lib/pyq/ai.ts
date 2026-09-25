/**
 * Optional live-AI explainer for PYQ answers.
 *
 * Template explanations ship by default. When VITE_AI_ENDPOINT and
 * VITE_AI_API_KEY are set (OpenAI-compatible chat-completions API), each
 * answered question can also fetch a fresh, pointed explanation. Responses
 * are cached per question so repeat visits are instant and free.
 *
 * Falls back cleanly to null on any failure — the template explainer always
 * stays visible.
 */

import type { PyqQuestion } from './types.js';

const ENDPOINT: string | undefined = import.meta.env.VITE_AI_ENDPOINT;
const API_KEY: string | undefined = import.meta.env.VITE_AI_API_KEY;
const MODEL: string | undefined = import.meta.env.VITE_AI_MODEL;

export function liveAiConfigured(): boolean {
  return Boolean(ENDPOINT && API_KEY);
}

const CACHE_KEY = 'SiLo-ai-cache';

interface CacheShape {
  [id: string]: string;
}

function readCache(): CacheShape {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as CacheShape;
  } catch {
    return {};
  }
}

function writeCache(c: CacheShape): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // storage full or unavailable — cache is best-effort
  }
}

export function cachedLiveExplanation(id: string): string | null {
  return readCache()[id] ?? null;
}

/** Ask the configured endpoint to explain a question. Returns null if
 *  unavailable or the call fails. */
export async function fetchLiveExplanation(
  q: PyqQuestion,
): Promise<string | null> {
  if (!liveAiConfigured()) return null;
  const cached = readCache()[q.id];
  if (cached) return cached;

  const correct = q.choices[q.answer];
  try {
    const res = await fetch(ENDPOINT!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY!}`,
      },
      body: JSON.stringify({
        model: MODEL ?? 'gpt-4o-mini',
        max_tokens: 160,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are a sharp ECE tutor. In at most 3 short sentences, explain why the given answer is correct and why the common wrong options are tempting traps. No filler.',
          },
          {
            role: 'user',
            content: `Question: ${q.prompt}\nChoices: ${q.choices.join(' | ')}\nCorrect answer: ${correct}\nExplain in ≤3 sentences.`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    writeCache({ ...readCache(), [q.id]: text });
    return text;
  } catch {
    return null;
  }
}