import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUBJECTS, getLessonsForSubject, getUnitsFor } from '../lib/lessons/catalog.js';
import { useStore } from '../lib/state/store.js';
import { fetchLeaderboard, type LeaderboardEntry } from '../lib/sync/mongodb.js';

function LeaderboardCard() {
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const nickname = useStore((s) => s.account.nickname);

  useEffect(() => {
    let live = true;
    const load = () => {
      void fetchLeaderboard().then((r) => {
        if (live) setRows(r);
      });
    };
    load();
    // Refresh lazily: a 60s poll keeps the Neon compute awake around the
    // clock. Fetch on mount, when the tab becomes visible, and 10 min apart —
    // the compute sleeps (scale-to-zero) between polls, keeping the free tier
    // genuinely free.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const t = setInterval(load, 10 * 60_000);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(t);
    };
  }, []);

  const you = rows?.findIndex((r) => r.nickname === nickname) ?? -1;

  return (
    <div className="leaderboard-preview">
      <span className="lb-title">🏅 This week's leaderboard</span>
      {rows && rows.length > 0 ? (
        <div className="lb-rows">
          {rows.slice(0, 5).map((r, i) => (
            <div
              key={r.nickname}
              className={`lb-row${i === you ? ' you' : ''}`}
            >
              <span className="lb-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
              <span className="lb-name">{r.nickname}{i === you ? ' (you)' : ''}</span>
              <span className="lb-xp">+{r.weekGain ?? 0} XP</span>
            </div>
          ))}
        </div>
      ) : (
        <span className="lb-foot">
          {rows === null ? 'Loading…' : 'Sync to your Neon account to compete'}
        </span>
      )}
    </div>
  );
}

function DailyCharge() {
  const charge = useStore((s) => s.dailyCharge);
  const today = new Date().toISOString().slice(0, 10);
  const active = charge && charge.date === today;
  const remaining = active ? Math.max(0, 5 - charge.answered) : 5;
  const pct = active ? (charge.answered / 5) * 100 : 0;

  if (remaining === 0) return null;

  return (
    <Link to="/charge" className="charge-card">
      <span className="charge-emoji">⚡</span>
      <span className="charge-meta">
        <span className="charge-title">Daily Charge</span>
        <span className="charge-sub">
          {remaining} question{remaining === 1 ? '' : 's'} left · +3 XP each
        </span>
      </span>
      <div className="charge-track">
        <div className="charge-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="charge-arrow">→</span>
    </Link>
  );
}

export default function Subjects() {
  const [openId, setOpenId] = useState<string | null>(SUBJECTS[0]?.id ?? null);
  const completed = useStore((s) => s.completedLessonIds);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Learn</h1>
        <p className="page-sub">
          Short, game-like lessons. 3 minutes a day.
        </p>
      </div>

      <DailyCharge />

      {SUBJECTS.map((subject) => {
        const lessons = getLessonsForSubject(subject.id);
        const units = getUnitsFor(subject.id);
        const done = lessons.filter((l) => completed.includes(l.id)).length;
        const open = openId === subject.id;
        return (
          <div key={subject.id} className="subject-card">
            <button
              className="subject-header"
              onClick={() => setOpenId(open ? null : subject.id)}
              style={{ '--subject-color': subject.color } as React.CSSProperties}
            >
              <span className="subject-icon">{subject.icon}</span>
              <span className="subject-meta">
                <span className="subject-title">{subject.title}</span>
                <span className="subject-desc">{subject.description}</span>
              </span>
              {lessons.length > 0 && (
                <span className="subject-progress">
                  {done}/{lessons.length}
                </span>
              )}
              <span className="subject-caret">{open ? '▾' : '▸'}</span>
            </button>

            {open && (
              <div className="subject-lessons">
                {lessons.length === 0 && (
                  <p className="coming-soon">Coming soon…</p>
                )}

                {units.length > 0 ? (
                  units.map((unit) => {
                    const unitLessons = lessons.filter((l) =>
                      unit.lessonIds.includes(l.id),
                    );
                    if (unitLessons.length === 0) return null;
                    return (
                      <div key={unit.id} className="unit-block">
                        <span className="unit-title">{unit.title}</span>
                        {unitLessons.map((l) => (
                          <LessonRow key={l.id} lesson={l} done={completed.includes(l.id)} />
                        ))}
                      </div>
                    );
                  })
                ) : (
                  lessons.map((l) => (
                    <LessonRow key={l.id} lesson={l} done={completed.includes(l.id)} />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="poll-card">
        <span className="poll-emoji">🗳️</span>
        <span className="poll-title">This week's poll</span>
        <span className="poll-q">
          What should we teach next — more robotics or deeper semiconductors?
        </span>
        <div className="poll-opts">
          <span className="poll-opt">🦾 Robotics</span>
          <span className="poll-opt">🔬 Semiconductors</span>
        </div>
        <span className="poll-foot">1,240 votes</span>
      </div>

      <LeaderboardCard />
    </div>
  );
}

function LessonRow({ lesson, done }: { lesson: { id: string; order: number; title: string; subtitle: string; xpReward: number; level?: string }; done: boolean }) {
  return (
    <Link key={lesson.id} to={`/lesson/${lesson.id}`} className="lesson-row">
      <span className="lesson-check">{done ? '✅' : '⬜'}</span>
      <span className="lesson-info">
        <span className="lesson-title">
          {lesson.order}. {lesson.title}
          {lesson.level && (
            <span className={`level-badge level-${lesson.level}`}>{lesson.level}</span>
          )}
        </span>
        <span className="lesson-sub">{lesson.subtitle}</span>
      </span>
      <span className="lesson-xp">+{lesson.xpReward} XP</span>
      <span className="lesson-arrow">→</span>
    </Link>
  );
}