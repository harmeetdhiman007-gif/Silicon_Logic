import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeaderboard } from '../lib/sync/mongodb.js';
import type { LeaderboardEntry } from '../lib/sync/mongodb.js';

const TRAINERS = [
  {
    id: 'ampere',
    name: 'Ampere Annie',
    title: 'Electronics trainer',
    emoji: '⚡',
    color: '#00ff88',
    tagline: 'Voltage, current & the first circuits',
  },
  {
    id: 'logic',
    name: 'Logic Larry',
    title: 'Digital trainer',
    emoji: '🧠',
    color: '#f78166',
    tagline: 'Gates, binary & how chips think',
  },
  {
    id: 'sam',
    name: 'Circuit Sam',
    title: 'Physics trainer',
    emoji: '🔬',
    color: '#58a6ff',
    tagline: "Ohm's law & resistor puzzles",
  },
];

export default function World() {
  return (
    <div className="page">
      <div className="page-head">
        <h1>🏙️ Copper Town</h1>
        <p className="page-sub">
          SiLo World — duel trainers with real questions and climb the town
          leaderboard.
        </p>
      </div>

      <div className="town-row">
        {['🏠', '🏭', '⚡', '🏪', '🏫'].map((b, i) => (
          <span key={i} className="town-building" style={{ fontSize: `${28 + (i % 3) * 6}px` }}>
            {b}
          </span>
        ))}
      </div>

      <section className="trainer-list">
        {TRAINERS.map((t) => (
          <Link key={t.id} to={`/duel/${t.id}`} className="trainer-card" style={{ '--trainer': t.color } as React.CSSProperties}>
            <span className="trainer-emoji">{t.emoji}</span>
            <span className="trainer-meta">
              <span className="trainer-name">{t.name}</span>
              <span className="trainer-title">{t.title}</span>
              <span className="trainer-tag">{t.tagline}</span>
            </span>
            <span className="trainer-duel">Duel →</span>
          </Link>
        ))}
      </section>

      <Link to="/duel/watt" className="watt-card">
        <span className="watt-emoji">🤖</span>
        <span className="watt-meta">
          <span className="watt-title">Watt Bot</span>
          <span className="watt-sub">
            First to 5 correct answers. No risk — just reps.
          </span>
        </span>
        <span className="watt-arrow">→</span>
      </Link>

      <Link to="/lab" className="watt-card">
        <span className="watt-emoji">🔧</span>
        <span className="watt-meta">
          <span className="watt-title">Open bench</span>
          <span className="watt-sub">
            Free-play lab — build circuits and watch them run.
          </span>
        </span>
        <span className="watt-arrow">→</span>
      </Link>

      <Leaderboard />
    </div>
  );
}

function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let live = true;
    void fetchLeaderboard().then((data) => {
      if (live) setRows(data);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="section-title">
      <h2>🏆 Town leaderboard</h2>
      {rows === null ? (
        <p className="fine-print" style={{ marginTop: 6 }}>
          {rows === null && 'Loading this week’s standings…'}
        </p>
      ) : rows.length === 0 ? (
        <p className="fine-print" style={{ marginTop: 6 }}>
          Leaderboard is off until you connect Neon — add VITE_DATABASE_URL to
          a .env.local and your progress starts climbing this week’s board.
        </p>
      ) : (
        <div className="leaderboard">
          {rows.map((r, i) => (
            <div key={i} className={`leader-row ${i === 0 ? 'top' : ''}`}>
              <span className="leader-rank">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>
              <span className="leader-name">{r.nickname || 'Explorer'}</span>
              <span className="leader-streak">🔥 {r.streak}</span>
              <span className="leader-gain">+{r.weekGain} XP</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}