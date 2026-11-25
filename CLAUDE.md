# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Study Assistant (学习助手) is a Chinese-market learning app with two subjects:

- **English**: vocabulary books (词书) and training/review, scheduled with FSRS.
- **Chinese (语文)**: courses of dictation/recitation point cards (题卡), scheduled with SM-2.

Frontend is UniApp 3 + Vue 3 + TypeScript + Pinia (H5 and WeChat mini-program). Backend is Express + TypeScript + Prisma + PostgreSQL. Monorepo layout: `src/` frontend, `server/` API, `server/data/` vocabulary and Chinese content, `scripts/` dev tooling, `deploy/` production Nginx/Docker.

## Commands

Shell scripts are bash and were originally written for Linux/WSL. This repo is nevertheless developed **directly on Windows** (Git Bash + native Node 22, no WSL) — see **Windows local dev** below. `scripts/node-env.sh` rejects Node whose path contains `/mnt/c/` or ends in `.exe`; under Git Bash `command -v node` returns an extension-less `/c/...` path, so the guard does not fire and Windows Node runs normally.

### Setup

```bash
npm install
cd server && npm install
cp server/.env.example server/.env   # fill DATABASE_URL, JWT_SECRET, PORT
```

### Development

```bash
bash start-dev.sh          # one-shot: Postgres, prisma migrate deploy, API 3005, H5 5173
npm run dev:h5             # H5 dev server, proxies /api -> 127.0.0.1:3005
npm run dev:mp-weixin
npm run build:h5
npm run build:mp-weixin
bash restart-client.sh     # restart H5 in its own process group (after pages.json/vite.config/deps changes)

cd server
npm run dev                # prisma generate + nodemon + ts-node on src/app.ts
npm run build              # tsc -> server/dist
npm run start              # node dist/app.js
```

API docs: `http://localhost:3005/api-docs` (Swagger generated from `server/src/routes/*.ts`). `start-dev.sh` writes `logs/server.log` and `logs/client.log`.

The API port is `PORT` from `server/.env`. The repo's dev scripts and Vite proxy assume **3005** locally; production compose forces **3004**.

### Windows local dev (the actual dev machine)

Windows 10 + Git Bash + native Node 22, **no WSL**. Everything below was verified on 2026-11-23.

**Start everything** from the repo root:

```bash
bash start-dev.sh   # Postgres (Docker, skipped if up) -> prisma migrate deploy -> API 3005 -> H5 5173
```

Both services run in the background; logs go to `logs/server.log` and `logs/client.log`. To start one side only:

```bash
cd server && bash dev.sh    # API only: prisma generate + nodemon + ts-node on src/app.ts
bash dev-h5.sh              # H5 only (same as npm run dev:h5)
bash restart-client.sh      # restart H5 after vite.config / pages.json / dependency changes
```

**Verify — all three must be 200.** Do not treat `/` alone as proof of life; that is only the Vite shell:

```bash
curl -s -o /dev/null -w "API   %{http_code}\n" http://127.0.0.1:3005/api/books
curl -s -o /dev/null -w "H5    %{http_code}\n" http://127.0.0.1:5173/
curl -s -o /dev/null -w "Proxy %{http_code}\n" http://127.0.0.1:5173/api/books
```

`/api/books` returning ~2 KB of JSON containing real book codes (`pep-g3a-2024`, …) proves API + Postgres + the Vite `/api` proxy are all healthy. `/api/books` and `:5173/api/books` must return the same byte count.

**Stop — use `netstat` + `taskkill`, never the pid files:**

```bash
netstat -ano | grep -E ":3005|:5173" | grep LISTENING   # rightmost column is the PID
taskkill //F //PID <pid>                                # Git Bash: double slashes, or MSYS mangles the arg
```

**Windows gotchas (all confirmed on this machine):**

- `scripts/stop-port.sh` calls `lsof`, which does not exist in Git Bash. `stop_port` therefore always prints `✓ 端口 N 未被占用` and frees nothing. Consequence: `start-dev.sh` / `restart-client.sh` are **not reliable restarts** on Windows — the old process may still hold the port, the new one dies on `EADDRINUSE`, and the readiness `curl` passes against the *stale* server. After any "restart", re-check `netstat` for a **changed** PID before believing it.
- `logs/server.pid` and `logs/client.pid` are wrong. `start-dev.sh` uses `nohup npm run dev &`, so `$!` is the npm/bash wrapper, not node (observed: file says `231`, real PID was `14320`). Never `kill` those files.
- `server.log` contains `PrismaClientKnownRequestError P2002 … modelName: 'Book'` during startup seeding. That is a duplicate-name warning from `initBooks()`, not a boot failure — the following `Chinese library seeded: inserted N` line means startup continued.
- Both ports bind `0.0.0.0`, so a phone on the same Wi-Fi reaches the H5 build at `http://<lan-ip>:5173/` (this machine: `192.168.1.30:5173`).

### Database

```bash
bash scripts/db-migrate.sh           # prisma generate + migrate deploy
cd server && npm run prisma:migrate  # migrate dev (creates a new migration)
cd server && npm run prisma:generate
cd server && npm run db:studio
```

`bash scripts/start-db.sh` starts PostgreSQL via Docker or WSL. Dev DB default: `localhost:5432/study_assistant`.

### Tests

```bash
cd server
npm run test        # vitest run (src/**/*.test.ts and scripts/**/*.test.ts)
npm run test:watch
npx vitest run src/services/review-engine.test.ts   # single test file
```

No frontend test runner is configured. The README's pre-commit verification is: backend `npm run test` + `npm run build`, then root `npm run build:h5`. There is no lint/format script or checked-in ESLint/Prettier config.

### Production

```bash
cp .env.prod.example .env.prod
bash deploy.sh
# equivalent:
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml logs -f
```

Stack: nginx web (H5 + `/api` reverse proxy to `api:3004`) on port 80, Express API on 3004, PostgreSQL 16. The API container runs `prisma migrate deploy` on startup. Pushes to `main` build/push GHCR images via `.github/workflows/docker.yml`.

## Architecture

### Identity model: account vs learner

This is the most important cross-cutting concept:

- `User` is the family login account. It owns plan/billing, admin flag, `activeLearnerId`, `activeSubject`, `activeRole`, book unlocks, and DAU (`account_daily_actives`).
- `Learner` is a child/student. Every study record hangs off `Learner`: English `VocabularyStat`/`TrainingRecord`/`DailyStudyLog`, typing stats, Chinese courses/reviews, chat and speech usage.
- `authMiddleware` verifies the JWT, sets `req.userId`, then resolves `req.learnerId` from `User.activeLearnerId` (falling back to the first non-archived learner) and records account activity.
- **Naming gotcha:** controllers pass `req.learnerId` (via `studyUserId(req)`) into service functions whose parameter is named `userId`; those queries target learner-keyed tables. Account-level code (book access, billing) uses the real account id.
- Study endpoints return 409 `请先添加学生` when the account has no learner.

### Backend layering

- Entry point is `server/src/app.ts`. It mounts `/api/auth`, `/api/vocab`, `/api/training`, `/api/chat`, `/api/books`, `/api/stats`, `/api/admin`, `/api/tts`, `/api/speech`, `/api/typing`, `/api/chinese`, plus `/api-docs`. `app_new.ts` is an unused stale copy that references a non-existent `vocabularyRoutes`; do not use it as a reference.
- Routes (`server/src/routes/*`, `server/src/chinese/chinese.routes.ts`) → controllers → services; Prisma singleton is `server/src/prisma/client.ts`.
- Responses are generally `{ success, data, error }`; errors go through `middleware/error.ts`. The client treats 401 as session expiry (with refresh-retry) and 403 as `BOOK_LOCKED`.
- After `listen`, startup runs `ensureAdminUser()` (env `ADMIN_USERNAME`/`ADMIN_PASSWORD`), `initVocabulary()`, `initBooks()` (sync built vocabulary JSON into DB, skipping books whose counts already match), then `seedChineseIfEmpty()`.

### English learning domain

- `Vocabulary` has one row per spelling globally; `BookVocabulary` holds per-book order, meaning, English meaning, and example sentences.
- Session selection modes live in `server/src/services/book.service.ts` (with scoring in `coverage.service.ts`): `coverage`, `smart`, `weak`, `review`, `unit`. `unit` order comes from the curriculum `units.json`.
- FSRS is in `server/src/services/review-engine.service.ts` (ts-fsrs, retention 0.9, learning steps `10m`/`1d`). State is per `(learnerId, wordId, type)` in `VocabularyStat`, where `type` ∈ `listening | speaking | reading | writing`. `/api/training/practice` updates FSRS and appends `TrainingRecord`; the stat counters are display caches, `TrainingRecord` is the source-of-truth stream.
- `/api/training/session/complete` updates `BookStudyProgress` and `DailyStudyLog` (daily word count + streak).
- Membership/access is in `book-access.service.ts` (admin OR active premium OR free book OR unlock).

### Typing / keyboard practice (拼读)

- Deliberately separate from the four training types: FSRS cards live in `TypingModeStat` (modes `follow`, `dictation`, `self`, `recall`) and `ArticleSentenceCard` (sentences from articles), not `VocabularyStat.writing`.
- `LearnerWordMark` stores favorite / skip-mastered / wrong-book flags. `PracticeList` + `PracticeListItem` are user word lists; spellings absent from books get learner-owned `Vocabulary` rows (`ownerLearnerId`). `PracticeArticle` stores user short texts.
- Queue selection is pure logic in `server/src/services/typing-logic.ts` (sources: `smart`, `wrong`, `favorite`, `random`, `list`); scheduling reuses the FSRS engine via `typing-schedule.ts`. The frontend engine is in `src/typing-engine/` (token parsing, normalization, live char marks, sounds).

### Chinese (语文) domain

- Content packs in `server/data/chinese/raw/*.json` are registered in `server/src/chinese/materials.ts` and synced into `chinese_resources` → `chinese_published` point cards; user imports go through a draft/publish flow (`drafts.ts`, statuses `draft | published | discarded`). Entries and grade/level links use `chinese_entries`, `chinese_entry_grades`, `chinese_entry_levels`.
- Courses (`chinese_courses`) filter published cards by kind/level/grade/difficulty. Daily planning/queue is in `course.service.ts` + `schedule.ts`; study modes `learn | test | recite | filter` are in `study-modes.ts` (test cannot reveal answers; recite does not update SM-2).
- Scheduling uses SM-2 (`server/src/chinese/sm2.ts`), completely separate from English FSRS. Answer grading is Levenshtein-based in `grade.ts` (quality 1/3/5).
- Idioms: `server/data/chinese/raw/idioms/` is the source of truth. Edit the split source files, run `cd server && npm run build:idioms`, then `npm run audit:idioms` (must be zero errors), then sync via the admin/resource API. `generated/小学成语_发布包.json` is generated — never hand-edit it.

### Frontend

- `src/main.ts` creates the SSR-style UniApp app with Pinia. `src/pages.json` defines pages, tabBar, and the wide-screen `leftWindow`.
- **API client:** all endpoint wrappers live in `src/utils/api.ts` (`authAPI`, `bookAPI`, `trainingAPI`, `typingAPI`, `chineseAPI`, ...). Base URL is same-origin `/api` (Vite proxy in dev, Nginx in prod). The wrapper handles 401 refresh-and-retry, session-expired modal, 403 → `BOOK_LOCKED`, and a "backend not started" toast.
- **Stores:** `src/stores/user.ts` (session, active learner, subject/role switching, `applyAppShell`) and `src/stores/vocabulary.ts` (current book, session loading, progress/due counts, maps).
- Training pages share `src/composables/useTrainingFlow.ts`, `useTrainingStart.ts`, and `useDailySession.ts`; streaming audio is in `useStreamingAsr.ts` / `useStreamingTts.ts`.
- **Route guards:** `src/utils/subject.ts` exposes `requireReadySession()` / `requireSubject()`. Accounts without a chosen role or learners are redirected to `pages/family/students`. `activeSubject` switches English/Chinese UX (tab labels, landing pages) via `applyAppShell`.
- **PC shell:** on wide screens the left rail (`src/windows/left-window.vue`) is the shell and only the right `uni-main` scrolls. Change only the task page's template and scoped styles; do not add global `html`/`body`/`uni-main`/`page` selectors in pages, and do not touch `App.vue` pc-shell rules or `pages.json` shell entries unless the task is about the shell. See `doc/pc-shell-layout.md`.
- **Theming:** colors must come from `--pc-*` CSS variables (defaults in `App.vue`, applied by `src/utils/pc-theme.ts`). Do not hardcode `#fff`/`#000` or bypass layers; see `doc/theme-layers.md`.
- Primary-school article pages (`src/pages/primary/*`) read bundled JSON from `src/data/primary/` (catalog + book JSON, overlaid by gitignored `local/*-textbook.json`); word training still goes through the API.

### Content data pipelines

- **English vocabulary:** sources in `server/data/sources` (dictionary/senses shards; some large downloads are gitignored) → `server/scripts/vocabulary-import/*` → `server/data/vocabulary/books/<code>.json`, which the server syncs at startup. Book order authority is `server/data/vocabulary/units/<code>.json`; after editing units run `cd server && npm run cishu:bianpai -- <code>`, then `npm run tongbu:cishu -- --force <code>`. `npm run build:vocabulary` rebuilds everything (`:fast` skips the enrichment API).
- **Textbooks:** `npm run kb:rebuild` (Python PDF extraction + import) updates unit/textbook overlays from local PDFs in gitignored directories. Never commit extracted copyrighted textbook text; see `.gitignore` and `server/data/kb/README.md`.

### AI, TTS, ASR

- Chat: `/api/chat/send` and `/api/chat/stream` (SSE, not WebSocket). The LLM is OpenAI-compatible, configured by `OPENAI_API_KEY`/`DEEPSEEK_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`; without a key a deterministic fallback reply is used. Chat context injects learner/book vocabulary; challenge mode records matched words.
- TTS: `edge-tts-universal`, cached under `server/data/tts-cache` (gitignored), voice via `TTS_VOICE`.
- ASR: streaming session API; uses iFlytek (讯飞) when `XFYUN_*` is configured, otherwise a Whisper-compatible endpoint. Speech assessment is gated by `SPEECH_PASS_THRESHOLD`.

## Repo-specific notes

- `server/src/app.ts` is currently **not valid UTF-8** (legacy CJK encoding). Read shows replacement characters and Edit/Write refuse it; convert deliberately or edit with an encoding-preserving shell tool. Other source files are UTF-8.
- `PROJECT_PROGRESS*.md` are historical and stale (they describe a removed `mobile/` React Native app). Prefer `README.md`, `PROJECT_OVERVIEW.md`, and `doc/`.
- Search exclusions: `.npm-cache/` (a local npm cache in the repo root), `node_modules`, `server/data/sources`, `server/data/kb/md|downloads`, and `logs`.
- Root `tsconfig.json` aliases `@/*` → `src/*`; `@vocab/*` also maps into `server/src/data/vocabulary/*` but is currently unused.
- Vocabulary maps are served at `/api/vocab/maps/...`, not `/api/stats/...` (see `server/src/routes/vocab.routes.ts` and `statsAPI` in `src/utils/api.ts`).
- Gitignored local data (textbook PDFs/Markdown, dictionary downloads, `.env*`, `tts-cache`) must stay out of commits.

## Git workflow (from `.cursor/rules/git-commit-push.mdc`)

When the user says 「提交git」/「提交」 in a version-control context, execute without asking for confirmation:

1. Inspect `git status`, `git diff`, `git log -3`.
2. `git add -A`, excluding `.env`/secrets and stale build artifacts (e.g. `*-missing.txt`).
3. If git identity is unset, do **not** modify git config; commit with env vars `GIT_AUTHOR_NAME=lxm200806`, `GIT_AUTHOR_EMAIL=lxm200806@users.noreply.github.com`, and the same values for `GIT_COMMITTER_*`.
4. Write a concise 1–2 sentence commit message explaining why.
5. Immediately `git push -u origin HEAD`.
6. Report the commit hash, branch, and push result.

Never force-push `main`/`master`.
