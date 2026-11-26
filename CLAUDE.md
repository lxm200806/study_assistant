# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Study Assistant (学习助手) is a Chinese-market learning app with two subjects:

- **English**: vocabulary books (词书) and training/review, scheduled with FSRS.
- **Chinese (语文)**: courses of dictation/recitation point cards (题卡), scheduled with SM-2.

Frontend is UniApp 3 + Vue 3 + TypeScript + Pinia (H5 and WeChat mini-program). Backend is Express + TypeScript + Prisma + PostgreSQL. Monorepo layout: `src/` frontend, `server/` API, `server/data/` vocabulary and Chinese content, `scripts/` dev tooling, `deploy/` production Nginx/Docker.

## Commands

Shell scripts are thin wrappers around `scripts/dev.mjs`, so development works on Linux/macOS and **directly on Windows** (Git Bash or PowerShell, native Node 22). `scripts/dev.mjs` resolves Git Bash explicitly because `bash` on `PATH` is usually WSL's `C:\Windows\System32\bash.exe`. See **Windows local dev** below.

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
npm run dev:app
npm run dev:app:lan      # App dev, auto-detect LAN IP for API/assets
npm run build:h5
npm run build:mp-weixin
npm run check:mp-size    # after build:mp-weixin; main 2MB / total 20MB gate
npm run build:app        # 产物在 dist/build/app，交给 HBuilderX 打包
npm run build:app:lan    # App build with http://<LAN_IP>:3005/api + :5173 assets
npm run gen:api          # export OpenAPI + regenerate src/types/api-generated.ts
node scripts/dev.mjs restart web   # restart H5 (after pages.json/vite.config/deps changes)

cd server
npm run dev                # prisma generate + nodemon + ts-node on src/server.ts
npm run build              # tsc -> server/dist
npm run start              # node dist/server.js
```

API docs UI: `http://localhost:3005/api-docs` (dev only). The spec is generated from zod schemas registered in `server/src/validation/openapi.ts`; it currently covers the core auth/family/account/2fa/vocab/book/training/quiz/typing/articles/chat/Chinese/admin/speech/tts/billing/entitlements/push/stats paths (96 paths / 106 operations), while the remaining endpoints are still route-only — treat the route files as the full endpoint reference. `start-dev.sh` writes `logs/server.log` and `logs/client.log`.

The API port is `PORT` from `server/.env`. The repo's dev scripts and Vite proxy assume **3005** locally; production compose forces **3004**.

### Windows local dev (the actual dev machine)

Windows 10 + native Node 22, run from PowerShell or Git Bash. WSL is not required.

**Start / stop / restart** from the repo root:

```bash
node scripts/dev.mjs start all      # DB check -> prisma generate + migrate deploy -> API 3005 -> H5 5173
node scripts/dev.mjs status         # ports + real PIDs
node scripts/dev.mjs restart api    # or web / all
node scripts/dev.mjs stop all
node scripts/dev.mjs migrate        # prisma generate + migrate deploy only
bash start-dev.sh                   # same as start all (Git Bash)
```

`start` accepts `--foreground`, `--no-db`, `--no-migrate`, `--no-generate`. Logs go to `logs/server.log` and `logs/client.log`; if a log file is still locked by an old process the manager retries and falls back to `logs/<name>-<ts>.log`.

**Verify — all five must be 200** (PowerShell / `curl.exe`, or `curl -s -o /dev/null -w "%{http_code}"` in Git Bash):

```powershell
curl.exe -s -o NUL -w "health %{http_code}`n" http://127.0.0.1:3005/health
curl.exe -s -o NUL -w "ready  %{http_code}`n" http://127.0.0.1:3005/ready
curl.exe -s -o NUL -w "books  %{http_code}`n" http://127.0.0.1:3005/api/books
curl.exe -s -o NUL -w "h5     %{http_code}`n" http://127.0.0.1:5173/
curl.exe -s -o NUL -w "proxy  %{http_code}`n" http://127.0.0.1:5173/api/books
```

`/health` is liveness, `/ready` checks the database. `/api/books` returning ~2 KB of JSON with real book codes (`pep-g3a-2024`, …) proves API + Postgres + the Vite `/api` proxy are all healthy; `:3005/api/books` and `:5173/api/books` must return the same byte count.

**Notes:**

- `logs/server.pid` / `logs/client.pid` now contain the real launcher PID (nodemon for API, node for H5). `stop` kills the port listener *and* the recorded launcher, so nodemon cannot respawn the child behind your back. Do not kill pid files manually; use `stop`.
- The Vite build needs `NODE_OPTIONS=--require scripts/patch-os-ni.cjs`; `dev.mjs` injects it with forward slashes (backslashes get eaten when Node re-parses `NODE_OPTIONS`).
- Both ports bind `0.0.0.0`, so a phone on the same Wi-Fi reaches the H5 build at `http://<lan-ip>:5173/` (current Wi-Fi IP: `192.168.31.245`; run `npm run build:app:lan` to auto-detect and inject the LAN API/asset URLs for App testing).
- `.sh` files must stay LF. `.gitattributes` enforces `*.sh text eol=lf`; with `core.autocrlf=true` a stale CRLF checkout makes bash fail with `$'\r': command not found`.

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
npm run test        # unit tests; DB integration is skipped unless TEST_DATABASE_URL/RUN_DB_TESTS=1
npm run test:db     # unit + DB integration against a throwaway schema derived from server/.env
npm run test:watch
npx vitest run src/services/review-engine.test.ts   # single test file

# root
npm run test:e2e    # Playwright H5 smoke; starts or reuses the H5 dev server
```

Frontend unit tests use Vitest + happy-dom + Vue plugin + a uni mock: `npm run test:frontend` runs 12 files / 43 tests covering `user`/`vocabulary`/`entitlements` stores, `StateHint`, recognition/typing preferences and pure utils (`storage`, `quiz-options`, `tts-text`, `speech-text`, `typing-engine/normalize-word`); config is `vitest.config.ts`. Playwright covers 10 H5 smoke cases in `e2e/smoke.spec.ts`: login form, API login error, unauthenticated redirect, mocked login → role page, quiz start + PC rail, authenticated book list, membership plans, recognition setup, Chinese drill card, and student typing setup → practice start. `e2e/real-api.spec.ts` is an opt-in real API + Postgres test (`E2E_REAL_API=1`), run by the `e2e-real` CI job. On Windows local runs use the system Edge channel (`PLAYWRIGHT_CHANNEL` overrides); CI installs Chromium. Root `npm run test` delegates to the backend. There are 41 Vitest files (40 unit + `src/integration/critical-flows.test.ts`). Without a test database: 221 tests pass and the 26 integration tests are skipped; `npm run test:db` creates a random `it_*` schema, runs `prisma migrate deploy`, executes all 247 tests, then drops the schema. The integration suite covers register/login/refresh → learner → book session → practice → session completion, quiz, Chinese course creation/today/review, typing queue/answer/mark/list/activity/history/session/articles, chat send/history/quota/SSE (forced deterministic fallback), profile/vocab/book helper endpoints, student create/rename/archive, Chinese/library/admin/speech/tts boundaries, 401/403/404/409 + recheck error paths, and `/api/v1` + idempotency replay.

The README's pre-commit verification is: backend `npm run test` + `npm run build`, then root `npm run typecheck`, `npm run lint`, `npm run lint:server`, `npm run build:h5`, and optionally `npm run test:e2e`. Root `.eslintrc.cjs` covers `src/**` (Vue + TypeScript + Prettier); `server/.eslintrc.cjs` covers `server/src/**` and runs with `--max-warnings 0`. `npm run typecheck` runs `vue-tsc --noEmit`. CI sets `TEST_DATABASE_URL` against a PostgreSQL 16 service, so `npm test` runs the integration suite there too; it also builds H5 + mp-weixin, checks that `src/types/api-generated.ts` is up to date, and runs frontend unit + Playwright smoke suites. A separate `e2e-real` job starts the API against a PostgreSQL service and runs the real-backend Playwright test.

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
- `authMiddleware` verifies the JWT (`ver` + `sid` claims), checks `User.tokenVersion` and an active `AuthSession`, sets `req.userId`/`req.sessionId`, then resolves `req.learnerId` from `User.activeLearnerId` (falling back to the first non-archived learner) and records account activity.
- Login/register create a device `AuthSession`; `/api/auth/refresh` rotates the refresh token (old token becomes invalid); `/api/auth/logout` revokes the current session; `/api/auth/logout-all` bumps `tokenVersion` and revokes every session; `/api/auth/sessions` lists active devices; `/api/auth/password` changes the password, bumps `tokenVersion`, and revokes all sessions. Account export/delete live at `/api/auth/account/export` and `/api/auth/account/delete`.
- Admin Chinese writes are recorded in `admin_audit_logs`; `GET /api/admin/audit` lists them. Admin TOTP 2FA is implemented (`/api/auth/2fa/status|setup|enable|disable`; login accepts `code`); settings live on the admin page. TTS requires a Bearer token or `?token=` because audio elements cannot set headers. Nginx has HSTS + CSP Report-Only; `.github/workflows/security.yml` runs gitleaks and `npm audit --omit=dev --audit-level=critical`. See `doc/security-compliance.md` for implemented controls and residual risks.
- **Naming gotcha:** controllers pass `req.learnerId` (via `studyUserId(req)`) into service functions whose parameter is named `userId`; those queries target learner-keyed tables. Account-level code (book access, billing) uses the real account id.
- Study endpoints return 409 `请先添加学生` when the account has no learner.

### Backend layering

- `server/src/server.ts` is the process entry: it calls `createApp()`, listens on `0.0.0.0`, and runs `bootstrap()`. `server/src/app.ts` exports `createApp()` and mounts `/api/auth`, `/api/vocab`, `/api/training`, `/api/chat`, `/api/books`, `/api/stats`, `/api/admin`, `/api/tts`, `/api/speech`, `/api/typing`, `/api/chinese`, `/api/billing`, `/api/push`, plus `/api-docs` in non-production only; it does not listen, so integration tests can import it directly.
- Routes (`server/src/routes/*`, `server/src/chinese/chinese.routes.ts`) → controllers → services; Prisma singleton is `server/src/prisma/client.ts`.
- Input validation is zod-based: schemas live in `server/src/validation/schemas.ts`, `validateBody` / `validateQuery` in `server/src/validation/validate.ts`, and the OpenAPI document in `server/src/validation/openapi.ts`. Add a schema and register the path when touching a core endpoint; invalid input returns 400 with `{ success: false, code: 'INVALID_REQUEST', details }`.
- Frontend request/response DTOs are generated from the same spec: `npm run gen:api` writes `src/types/api-generated.ts` (readable aliases in `src/types/api-contract.ts`); response schemas live in `server/src/validation/responses.ts`. CI regenerates and fails if the tracked file is stale.
- Responses are generally `{ success, data, error }`; errors go through `middleware/error.ts` and use `{ success: false, error, code, details? }` (`apiErrorBody`). The client treats 401 as session expiry (with refresh-retry) and 403 as `BOOK_LOCKED`.
- Express 4 does not catch rejected promises from async route handlers. Wrap them with `asyncHandler` from `server/src/utils/async-handler.ts` (or catch and call `next(error)`); unknown routes return the JSON `{ success: false, error: 'Not found', code: 'NOT_FOUND' }` envelope.
- Routers are mounted at both `/api` and `/api/v1`; `/api` remains the compatibility surface. `POST /training/practice` and `/training/session/complete` accept an optional `Idempotency-Key` header (10 min; Redis via `REDIS_URL`, memory fallback).
- Observability: `middleware/request-context.ts` generates or forwards `X-Request-Id`; `middleware/access-log.ts` emits JSON `http_request` records (method, path, status, duration, user/learner; skips `/health`, `/ready`, `/metrics`, `/api-docs`); `errorMiddleware` logs 4xx/5xx with request id and stack. `GET /metrics` exports Prometheus counters/histogram (optional `METRICS_TOKEN`). `server.ts` handles SIGTERM/SIGINT and disconnects Prisma. Set `SENTRY_DSN` to report 5xx to Sentry/APM (`server/src/instrument.ts`). `NODE_ENV=test` silences structured logs.
- Public routes: `GET /api/books`, `GET /api/chinese/meta`, `GET /api/tts`, `POST /api/auth/register|login|refresh`, plus `/`, `/health`, `/ready` (and `/api/auth/wechat` only when `WECHAT_LOGIN_STUB=true` outside production). Everything else under `/api` requires a Bearer token.
- After `listen`, startup runs `ensureAdminUser()` (env `ADMIN_USERNAME`/`ADMIN_PASSWORD`), `initVocabulary()`, `initBooks()` (sync built vocabulary JSON into DB, skipping books whose counts already match), then `seedChineseIfEmpty()`.

### English learning domain

- `Vocabulary` has one row per spelling globally; `BookVocabulary` holds per-book order, meaning, English meaning, and example sentences.
- Session selection modes live in `server/src/services/book.service.ts` (with scoring in `coverage.service.ts`): `coverage`, `smart`, `weak`, `review`, `unit`. `unit` order comes from the curriculum `units.json`.
- FSRS is in `server/src/services/review-engine.service.ts` (ts-fsrs, retention 0.9, learning steps `10m`/`1d`). State is per `(learnerId, wordId, type)` in `VocabularyStat`, where `type` ∈ `listening | speaking | reading | writing`. `/api/training/practice` updates FSRS and appends `TrainingRecord`; the stat counters are display caches, `TrainingRecord` is the source-of-truth stream.
- `/api/training/session/complete` updates `BookStudyProgress` and `DailyStudyLog` (daily word count + streak).
- Billing/membership: entitlements are the authorization source of truth (`server/src/entitlements/`): `Permission` catalog → `PlanPermission` mapping → `Subscription` / `EntitlementGrant` → `UsageCounter`, with `CreditWallet`/`CreditLedger` for AI points. `GET /api/entitlements` returns the account snapshot; routes use `requirePermission` (e.g. `english.books.all`, `english.recognition`, `english.typing`, `english.article`, `chinese.courses`, `ai.chat.text`, `ai.speech.assess`, `stats.weekly`). The `free` plan is an implicit baseline; paid grants override it. Plans: active English core replaces legacy `premium_*` (kept inactive for history); Chinese/math/SVIP/AI packs are seeded inactive until their feature ships. Billing APIs remain `GET /api/billing/plans`, `POST /api/billing/orders`, `POST /api/billing/orders/:id/pay` (mock outside production; production disables mock unless `ALLOW_MOCK_PAYMENT=true`); payment creates subscription + grants from the order's plan snapshot and still mirrors `User.plan`/`planExpiresAt` for English for backward compatibility. Admin APIs grant/revoke permissions, adjust plans, and grant AI credits. See `doc/entitlements.md`. Push tokens via `POST/DELETE /api/push/register`.
- Membership/access is in `book-access.service.ts` (admin OR active premium OR free book OR unlock).

### Typing / keyboard practice (拼读)

- Deliberately separate from the four training types: FSRS cards live in `TypingModeStat` (modes `follow`, `dictation`, `self`, `recall`) and `ArticleSentenceCard` (sentences from articles), not `VocabularyStat.writing`.
- `LearnerWordMark` stores favorite / skip-mastered / wrong-book flags. `PracticeList` + `PracticeListItem` are user word lists; spellings absent from books get learner-owned `Vocabulary` rows (`ownerLearnerId`). `PracticeArticle` stores user short texts.
- Queue selection is pure logic in `server/src/services/typing-logic.ts` (sources: `smart`, `wrong`, `favorite`, `random`, `list`); scheduling reuses the FSRS engine via `typing-schedule.ts`. The frontend engine is in `src/typing-engine/` (token parsing, normalization, live char marks, sounds).

### Chinese (语文) domain

- Content packs in `server/data/chinese/raw/*.json` are registered in `server/src/chinese/materials.ts` and synced into `chinese_resources` → `chinese_published` point cards; user imports go through a draft/publish flow (`drafts.ts`, statuses `draft | published | discarded`). Entries and grade/level links use `chinese_entries`, `chinese_entry_grades`, `chinese_entry_levels`.
- Courses (`chinese_courses`) filter published cards by kind/level/grade/difficulty. Daily planning/queue is in `course.service.ts` + `schedule.ts`; study modes `learn | test | recite | filter` are in `study-modes.ts` (test cannot reveal answers; recite does not update SM-2).
- Scheduling uses SM-2 (`server/src/chinese/sm2.ts`), completely separate from English FSRS. Answer grading is Levenshtein-based in `grade.ts` (quality 1/3/5).
- Idioms: `server/data/chinese/raw/idioms/` is the source of truth. Edit the split source files, run `cd server && npm run build:idioms`, then `npm run audit:idioms` (must be zero errors), then sync through `/api/chinese/resources/*` (`sync-all` / `sync-incremental` / `:id/sync`). `generated/小学成语_发布包.json` is generated — never hand-edit it.

### Frontend

- `src/main.ts` creates the SSR-style UniApp app with Pinia and installs a global `errorHandler` (logs unhandled component errors). `src/pages.json` defines pages, tabBar, and the wide-screen `leftWindow`.
- **API client:** endpoint wrappers live in `src/api/` by domain (`client.ts` + `auth.ts`, `learning.ts`, `speech.ts`, `typing.ts`, `chinese.ts`); `src/utils/api.ts` is a compatibility re-export. Base URL is same-origin `/api` on H5 (Vite proxy in dev, Nginx in prod); non-H5 builds require `VITE_API_BASE`. The wrapper handles 401 refresh-and-retry, session-expired modal, 403 → `BOOK_LOCKED`, and a "backend not started" toast. Token storage goes through `src/platform/storage.ts`.
- **Platform layer:** `src/platform/` is the cross-platform boundary: `runtime.ts` (H5 / mp-weixin / app detection), `storage.ts` (uni storage + token helpers), `audio.ts` (recorder / Web Audio), `stream.ts` (H5 SSE via fetch; WeChat mini-program via `uni.request` `enableChunked`; other non-H5 environments fall back to `/chat/send`), `assets.ts` (asset URL + JSON loading via `fetch`/`uni.request`, driven by `VITE_ASSET_BASE`), `payment.ts` / `push.ts` (App payment/push provider interfaces; default unavailable until credentials are configured). New code should import these adapters instead of calling `fetch`, `MediaRecorder`, `window`, or `uni.getSystemInfoSync` directly. `src/utils/audio-recording.ts` and `src/utils/chat-stream.ts` are compatibility re-exports. Layouts are still driven by `pages.json` + `App.vue` + `windows/left-window.vue`; extract `src/layouts/` only when a near-term App target is confirmed.
- **Static assets:** small always-needed files stay in `src/static/` (icons, keyboard sounds). Large shared assets live in `assets/` and are never bundled into mp/App: H5 dev serves `assets/atlas` at `/static/atlas` and H5 build copies it into the output, while mp/App load it from `VITE_ASSET_BASE` through `src/platform/assets.ts`. Run `npm run check:mp-size` after `build:mp-weixin` (2MB main / 20MB total). See `doc/asset-loading.md`.
- **Stores:** `src/stores/user.ts` (session, active learner, subject/role switching, `applyAppShell`), `src/stores/entitlements.ts` (loads `/api/entitlements`; `has(key)`/`remaining(key)`/`credits`/`subscriptions`), and `src/stores/vocabulary.ts` (current book, session loading, progress/due counts, maps). New UI checks must use entitlement keys (`src/utils/permissions.ts`), not `userStore.plan === 'premium'`; 403 responses distinguish `PERMISSION_DENIED` from `BOOK_LOCKED` in `src/api/client.ts`.
- Training pages share `src/composables/useTrainingFlow.ts`, `useTrainingStart.ts`, and `useDailySession.ts`; streaming audio is in `useStreamingAsr.ts` / `useStreamingTts.ts`. The large typing page keeps its styles in `src/pages/typing/typing.scss`, shared page types in `typing.types.ts`, and setup/history loading in `useTypingSetup.ts`; keep new pure logic out of the SFC where possible.
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

- All `server/src` sources, including `app.ts` and `server.ts`, are UTF-8 and editable normally. The old `app_new.ts` copy has been removed.
- `doc/archive/PROJECT_PROGRESS*.md` are historical and stale (they describe a removed `mobile/` React Native app). Prefer `README.md`, `PROJECT_OVERVIEW.md`, and `doc/`.
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
