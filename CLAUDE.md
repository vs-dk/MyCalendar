# MyCalendar — CLAUDE.md

## Project Overview
Personal calendar PWA for managing custody schedule (Ella), school holidays, work holidays, and notifications.
Hosted on GitHub Pages, syncs data via GitHub API, notifications via ntfy.sh.

## Architecture
- `index.html` — Single-page app shell
- `styles.css` — Dark theme styling
- `app.js` — All app logic: state, rendering, navigation, GitHub sync
- `sw.js` — Service worker for PWA
- `data/markers.json` — Calendar data (synced to GitHub via app, read by workflows)
- `.github/workflows/notify.yml` — Scheduled notifications via GitHub Actions + ntfy.sh

## Key Technical Details
- **GitHub sync**: App writes markers.json directly to GitHub via API on every change.
- **Notifications**: GitHub Actions cron → reads markers.json → sends via ntfy.sh (topic: mycalendar).
- **Cron identification**: Uses `github.event.schedule` to determine notification type — no clock checks.
- **Timezone**: Europe/Madrid (CET/CEST). Cron times set for CEST; adjust twice yearly for DST.
- **Local repo vs app**: App commits markers.json directly to GitHub. Local repo needs `git pull` before `git push`.

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
- **Local/remote desync**: App pushes markers.json to GitHub independently. Always `git pull --rebase && git push` from local.
