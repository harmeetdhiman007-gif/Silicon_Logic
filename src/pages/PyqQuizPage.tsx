import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPyqPaper, getPyqTrack, trackOf, basePathForTrack } from '../lib/pyq/index.js';
import type { PyqDifficulty, PyqPaper } from '../lib/pyq/index.js';
import { cachedLiveExplanation, fetchLiveExplanation, liveAiConfigured } from '../lib/pyq/ai.js';
import { useStore } from '../lib/state/store.js';
import { playFx } from '../lib/sfx.js';

const PYQ_XP_PER = 10;
const TIER_KEY = 'SiLo-pyq-tier';

type Tier = 'all' | PyqDifficulty;

const TIERS: Array<{ id: Tier; label: string; emoji: string }> = [
  { id: 'all', label: 'Full paper', emoji: '🎓' },
  { id: 'easy', label: 'Easy', emoji: '🌱' },
  { id: 'medium', label: 'Medium', emoji: '📖' },
  { id: 'hard', label: 'Hard', emoji: '🔥' },
];

export default function PyqQuizPage() {
  const { track, year } = useParams();
  const paper = getPyqPaper(track, year);
  if (!paper) {
    return (
      <div className="empty-state">
        <h1>Paper not found</h1>
        <p>That year doesn’t exist in this track.</p>
        <Link to="/pyq" className="btn-primary">All GATE tracks →</Link>
      </div>
    );
  }
  return <PyqQuiz key={`${paper.exam}-${paper.year}`} paper={paper} />;
}

export function PyqQuiz({ paper }: { paper: PyqPaper }) {
  const track = getPyqTrack(trackOf(paper));
  const base = track ? basePathForTrack(track.id) : '/pyq';
  const addXP = useStore((s) => s.addXP);
  const title = paper.title ?? `${paper.exam} ${paper.paperWord} ${paper.year}`;

  const [tier, setTier] = useState<Tier>(() => {
    const saved = localStorage.getItem(TIER_KEY);
    return saved === 'easy' || saved === 'medium' || saved === 'hard' ? saved : 'all';
  });
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [earned, setEarned] = useState(0);
  const [live, setLive] = useState<string | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);

  const restart = () => {
    setIdx(0);
    setChoice(null);
    setSubmitted(false);
    setFinished(false);
    setScore(0);
    setEarned(0);
    setLive(null);
    setLiveBusy(false);
  };

  const pickTier = (t: Tier) => {
    if (t === tier) return;
    setTier(t);
    localStorage.setItem(TIER_KEY, t);
    restart();
  };

  const qs = tier === 'all' ? paper.questions : paper.questions.filter((q) => q.difficulty === tier);
  const q = qs[idx];

  const submit = () => {
    if (choice === null || submitted || !q) return;
    setSubmitted(true);
    const correct = choice === q.answer;
    playFx(correct ? 'correct' : 'wrong');
    if (correct) {
      setScore((s) => s + 1);
      setEarned((e) => e + PYQ_XP_PER);
      addXP(PYQ_XP_PER);
    }
    setChoice(correct ? q.answer : choice);
    setLive(cachedLiveExplanation(q.id) ?? null);
  };

  const askLive = async () => {
    if (!q || liveBusy) return;
    setLiveBusy(true);
    const text = await fetchLiveExplanation(q);
    setLiveBusy(false);
    if (text) setLive(text);
  };

  const next = () => {
    if (idx + 1 >= qs.length) {
      setFinished(true);
      playFx('win');
      return;
    }
    setIdx((i) => i + 1);
    setChoice(null);
    setSubmitted(false);
    setLive(null);
    setLiveBusy(false);
  };

  const mix = {
    easy: paper.questions.filter((x) => x.difficulty === 'easy').length,
    medium: paper.questions.filter((x) => x.difficulty === 'medium').length,
    hard: paper.questions.filter((x) => x.difficulty === 'hard').length,
  };

  if (finished || !q) {
    return (
      <div className="empty-state">
        <div className="completion-emoji">{score >= qs.length - 1 ? '🏆' : '🎯'}</div>
        <h1>
          {track?.emoji} {title}
          {tier !== 'all' ? ` · ${TIERS.find((t) => t.id === tier)?.label}` : ''} done!
        </h1>
        <p>
          You scored <strong>{score}</strong>/{qs.length} marks and banked{' '}
          <strong>+{earned} XP</strong>. In the real exam, MCQs carry 1–2 marks
          with ⅓ negative marking.
        </p>
        <div className="completion-actions">
          <button className="btn-primary" onClick={restart}>
            Retake paper →
          </button>
          <Link to={`${base}/${track?.id ?? ''}`} className="btn-ghost">
            All years
          </Link>
          <Link to={base} className="text-link">
            {track?.gate ? 'Other GATE tracks' : 'Other studios'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>
          {paper.title ?? (
            <>
              {paper.exam} {paper.paperWord} {paper.year}
            </>
          )}
        </h1>
        <p className="page-sub">
          Question {idx + 1} of {qs.length} · {q.section} · +{PYQ_XP_PER} XP per correct
          answer
        </p>
      </div>

      {!paper.title && (
        <div className="tier-bar" role="tablist" aria-label="Difficulty tier">
          {TIERS.map((t) => (
            <button
              key={t.id}
              className={`tier-tab${t.id === tier ? ' active' : ''}`}
              onClick={() => pickTier(t.id)}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      )}

      {mix.easy > 0 && tier === 'all' && !paper.title && (
        <p className="tier-hint">
          🌱 Easy {mix.easy} · 📖 Medium {mix.medium} · 🔥 Hard {mix.hard}
        </p>
      )}

      <div className="step-card">
        <div className="choice-row">
          <span className="section-chip">{q.section}</span>
          <span className={`diff-chip diff-${q.difficulty}`}>
            {q.difficulty === 'easy' ? '🌱' : q.difficulty === 'medium' ? '📖' : '🔥'}{' '}
            {TIERS.find((t) => t.id === q.difficulty)?.label}
          </span>
        </div>
        <h2>{q.prompt}</h2>
        <div className="choice-list">
          {q.choices.map((c, i) => {
            let cls = 'choice-btn';
            if (submitted) {
              if (i === q.answer) cls += ' correct';
              else if (i === choice) cls += ' wrong';
            }
            return (
              <button
                key={i}
                className={cls}
                disabled={submitted}
                onClick={() => setChoice(i)}
              >
                <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
                {c}
              </button>
            );
          })}
        </div>

        {!submitted && (
          <button className="btn-primary" disabled={choice === null} onClick={submit}>
            Check answer
          </button>
        )}

        {submitted && (
          <div className="ai-explainer">
            <span className="ai-chip">
              🤖 AI EXPLAINER{'\u2009'}·{'\u2009'}{paper.paperWord} {paper.year}
            </span>
            <p>
              <strong>{choice === q.answer ? 'Correct — ' : 'Not quite. '}</strong>
              {q.aiExplanation}
            </p>
            {live && (
              <div className="ai-live">
                <span className="ai-chip ai-chip-live">✨ LIVE AI</span>
                <p>{live}</p>
              </div>
            )}
            {!live && (
              <button
                className="btn-ghost btn-inline"
                onClick={() => void askLive()}
                disabled={liveBusy}
              >
                {liveBusy ? 'Asking the model…' : liveAiConfigured() ? '✨ Ask live AI' : '✨ Live AI (set VITE_AI_ENDPOINT)'}
              </button>
            )}
            <button className="btn-primary btn-inline" onClick={next}>
              {idx + 1 >= qs.length ? 'Finish paper →' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}