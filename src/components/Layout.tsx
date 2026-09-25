import { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useStore } from '../lib/state/store.js';
import { initSync, pushProgress, markLesson } from '../lib/sync/mongodb.js';
import { getActivePlayerId } from '../lib/auth.js';

const NAV = [
  { to: '/', icon: '⌂', label: 'Home' },
  { to: '/subjects', icon: '📖', label: 'Learn' },
  { to: '/practice', icon: '🔁', label: 'Practice' },
  { to: '/world', icon: '🏙️', label: 'World' },
  { to: '/pyq', icon: '🎓', label: 'GATE' },
  { to: '/account', icon: '🙂', label: 'You' },
];

export default function Layout() {
  const loc = useLocation();
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const coins = useStore((s) => s.coins);

  useEffect(() => {
    const pid = () => getActivePlayerId() ?? undefined;
    void initSync(pid());
    // Debounce progress writes: XP/coins change dozens of times per session.
    // Flushing at most every 30s — and right when the tab hides or closes —
    // lets the Neon compute stay suspended between flushes instead of waking
    // on every single tick. Keeps the free tier free.
    let last:
      | { xp: number; streak: number; coins: number; lessons: number; nickname: string }
      | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      if (!last) return;
      const s = last;
      last = null;
      void pushProgress(s.xp, s.streak, s.lessons, s.coins, s.nickname, pid());
    };
    const flushIfDirty = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (last) flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushIfDirty();
    };
    window.addEventListener('beforeunload', flushIfDirty);
    document.addEventListener('visibilitychange', onVisibility);
    const unsub = useStore.subscribe((state, prev) => {
      if (
        state.xp !== prev.xp ||
        state.streak !== prev.streak ||
        state.coins !== prev.coins ||
        state.account.nickname !== prev.account.nickname
      ) {
        last = {
          xp: state.xp,
          streak: state.streak,
          coins: state.coins,
          lessons: state.completedLessonIds.length,
          nickname: state.account.nickname,
        };
        if (timer === undefined) {
          timer = setTimeout(flush, 30_000);
        }
      }
      const newLessons = state.completedLessonIds.filter(
        (id) => !prev.completedLessonIds.includes(id),
      );
      for (const id of newLessons) void markLesson(id, pid());
    });
    return () => {
      unsub();
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener('beforeunload', flushIfDirty);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="logo-link">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">SiLo</span>
        </Link>
        <div className="header-stats">
          <span className="stat-streak" title="Streak">🔥 {streak}</span>
          <span className="stat-xp" title="XP">⚡ {xp}</span>
          <span className="stat-coins" title="Coins">🪙 {coins}</span>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="app-nav">
        {NAV.map((n) => {
          const active =
            n.to === '/'
              ? loc.pathname === '/'
              : loc.pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`nav-item ${active ? 'active' : ''}`}
            >
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
