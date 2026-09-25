# Silicon Logic — Learn Electronics

A web + mobile electronics learning app built with **React + Vite + TypeScript + Capacitor** and backed by **MongoDB** for optional cross-device sync.

Learn electronics the way you learn a language: 3-minute, game-like lessons with live circuit simulations. Tap the break in the loop. Fix the fault. Watch the LED light up — on a circuit that actually simulates.

## Features

- ⚡ **Live circuit simulator** — a real Modified Nodal Analysis (MNA) engine solves DC circuits: battery, resistor, LED (nonlinear, iterated), lamp, switch, wires. `src/lib/sim/engine.ts`
- 📖 **Interactive lesson player** — info cards, instant-feedback quizzes, and circuit puzzles ("detect the break, tap to fix it"). `src/lib/lessons/`
- 🏆 **Gamification** — XP, day streaks, daily quests, and a mascot (SiLo). Progress persists locally via `localStorage` (Zustand persist).
- 🔧 **Circuit Lab** — an open bench with presets: flip switches, change resistor values (preset chips), battery voltage steppers — the LEDs respond live.
- ⭐ **GATE PYQ + Studios** — practice past GATE papers by track (`/pyq`) and a Studio hub (`/studio`) for PCB Design and VLSI workbenches. Deep links are SPA-rewritten.
- ☁️ **MongoDB sync (optional)** — progress follows you across devices: XP, streak, coins, nickname, and completed lessons push to your MongoDB database. A live **weekly leaderboard** ranks players by XP earned this week. Local-first by default; sync silently skips if no `VITE_MONGODB_URI`.
- 📱 **Capacitor** — same codebase builds to Android / iOS / desktop.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build & test

```bash
npm run build     # type-check + production build
npm run lint      # oxlint
npm test          # circuit simulator physics tests (tsx)
```

## Deploy to Vercel (free · no secrets in the bundle)

This is a **client-only SPA** — it runs entirely on the device (local-first progress + XP) and needs **no** server at all. Deploying is one click and works with **zero env vars** — build with none set and you ship a clean, secret-free bundle. Deep links (`/pyq/ece`, `/studio/vlsi`, duel rooms, …) are SPA-rewritten by `vercel.json`.

```bash
npm run build     # → dist/
npx vercel        # import this dir → link → deploy
npx vercel --prod # ship it
```

Or on the dashboard: **New Project → import this GitHub repo → Vite preset → keep defaults** (vercel.json handles build command, output dir and SPA fallback) → **Deploy**.

**Security note:** because there's no server, secrets stay out of the bundle. Don't build with `VITE_MONGODB_URI` set for a public deploy. Unset, the app runs perfectly local-first — nothing sensitive ships. To enable cross-device sync from a public/private deploy of your own, see the MongoDB section below.

## MongoDB sync (optional)

The app runs fully offline with zero accounts. To enable cross-device sync:

1. Create a free MongoDB Atlas account: https://www.mongodb.com/cloud/atlas/register
2. Create a cluster (free M0 tier)
3. Get your connection string (looks like: `mongodb+srv://user:pass@cluster.mongodb.net/silo`)
4. Copy `.env.example` to `.env.local` and put your connection string in `VITE_MONGODB_URI`
5. The app auto-creates your player document (device-id based), and pushes XP, streaks, coins, nickname, and completed lessons after each save. A live weekly leaderboard ranks players by XP earned this week.

**Database structure (MongoDB collections):**

```
silo database:
  - players: { _id, nickname, xp, streak, coins, lessons_completed[], week_started, week_start_xp, updated_at }
  - lessons: { _id, title, description, category, difficulty, xpReward }
  - progress: { _id, user, lesson, progress (0-100), completed, score, completedAt }
```

> `week_started` / `week_start_xp` power the **weekly leaderboard**: on the first sync of a new week the document records the XP total at the start of the week, so the leaderboard ranks by XP earned this week (`xp - week_start_xp`), not career totals.

> ⚠️ **Security note**: embedding a MongoDB connection string in a client app is fine for a personal project. For a public release, proxy writes through your own API server instead.

## Building for mobile with Capacitor

```bash
npm run build
npx cap add android    # or: npx cap add ios
npx cap sync
npx cap open android
```

## How the simulator works

`simulate(model)` builds a node list from component coordinates (pins sharing a grid point are one node; unbroken wires short nodes together), stamps whether the load conducts, then runs Modified Nodal Analysis — Gaussian elimination with partial pivoting. LEDs/lamps are treated as a fixed forward-voltage when forward-biased and iterated until convergence (2–3 iterations).

Verified physics (`npm test`):

| Circuit | Expected | Simulated |
| --- | --- | --- |
| 9V, 330Ω + LED | ~21.2 mA | 21.21 mA |
| 9V across 100Ω | 90 mA | 90.00 mA |
| 10V across 200Ω series | 50 mA | 50.00 mA |
| Open switch / broken wire | 0 mA | 0 mA |

## Roadmap

- Full drag-and-drop Circuit Lab editor (place parts, draw wires)
- 500+ lesson packs across Circuits, Components, Digital Logic, Embedded Systems, Robotics
- AI tutor ("Ask SiLo") chat
- PCB Studio (schematic → layout → 3D)
- Live duels against other players on the weekly leaderboard