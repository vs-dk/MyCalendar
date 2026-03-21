# MyCalendar — CLAUDE.md

## Project Overview
Personal calendar PWA for managing custody schedule (Ella), school holidays, work holidays, notifications and events.
Hosted on GitHub Pages, syncs data via GitHub API, notifications via ntfy.sh.

## Architecture
- `index.html` — Single-page app shell
- `styles.css` — Dark theme styling
- `app.js` — All app logic: state, rendering, navigation, GitHub sync, events system
- `sw.js` — Service worker for PWA (bump `CACHE_NAME` version on every change)
- `data/markers.json` — Calendar marker data (synced to GitHub via app, read by workflows)
- `data/events.json` — Events data: one-off + recurring (synced to GitHub via app, read by workflows)
- `.github/workflows/notify.yml` — Scheduled notifications via GitHub Actions + ntfy.sh

## Key Technical Details
- **GitHub sync**: App writes markers.json and events.json directly to GitHub via API on every change.
- **Notifications**: GitHub Actions cron → reads markers.json + events.json → sends via ntfy.sh (topic: mycalendar).
- **Cron identification**: Uses `github.event.schedule` to determine notification type — no clock checks.
- **Timezone**: Europe/Madrid (CET/CEST). Cron times set for CEST; adjust twice yearly for DST.
- **Local repo vs app**: App commits data files directly to GitHub. Local repo needs `git pull` before `git push`.
- **Cache busting**: On every code change, bump `CACHE_NAME` in sw.js AND query strings (`?v=N`) in index.html for styles.css and app.js.
- **UTF-8 base64**: GitHub API requires base64. Use `utf8ToBase64()`/`base64ToUtf8()` helpers for accented characters.
- **Desktop view**: 3×4 month grid, events in slide-in panel (left), FAB lock (right), year nav in header.
- **Mobile view**: Single month with swipe, events section below, expand/collapse calendar.
- **Events**: One-off (date + text) and recurring (day-of-month + text). Grid-based date pickers (mini-calendar with weekday headers). 24-month rolling window. Filter: ALL/1OFF/REC/DONE.

## Conventions
- **Language**: Communicate with user in **Spanish**. Code, commits, comments, and CLAUDE.md in **English**.
- **Commits**: Short descriptive message in English, always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.
- **Code style**: Minimal — no unnecessary abstractions, no docstrings on obvious functions, no over-engineering.
- **Edits**: Prefer editing existing files. Never create new files unless strictly necessary.

## User Preferences
- Dark UI only — no white, no bright colors. Dark grey base, elegant, minimal.
- Always PERFORMANCE over design.
- Informal tone, minimal explanations mid-thought. Brief alignment check before coding, summary after.
- Challenge proposals, suggest crazy ideas — but validate alignment before big changes.
- No condescension, no constant praise, no filler. Sarcasm welcome.
- Loves productivity, efficiency, optimization.

## Common Pitfalls
- **GitHub Actions cron delay**: Up to ~60min. Never rely on exact execution time. Use `github.event.schedule` to identify notification type.
- **Dual cron CET/CEST**: Previous approach with duplicate crons caused double sends. Use single cron per notification.
- **Local/remote desync**: App pushes data files to GitHub independently. Always `git pull --rebase && git push` from local. Will fail otherwise virtually every time.
- **Service worker stale cache**: Forgetting to bump `CACHE_NAME` in sw.js means users see old code. Always bump on every change.
- **Don't git stash events.json**: Stash can overwrite newer events data synced from the app. Avoid staging `data/` files unless explicitly asked.
- **Desktop events panel state**: Persisted in localStorage (`events-panel-open`). Panel open/closed survives refresh.
- **DST cron timing**: Currently set for CEST (summer). Likely misconfigured for winter — needs verification after 2026-03-29 clock change.
