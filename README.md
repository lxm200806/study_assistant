# Study Assistant

面向中文市场的双语学习应用，包含两条独立学习线：

- **英语**：词书 + 听力/口语/认读/拼写训练，使用 FSRS 调度复习。
- **语文**：古诗词/文言/成语/句子等题卡课程，使用 SM-2 调度复习；另有独立的键盘拼读（跟写/听写/自测/默写）。

项目采用前后端同仓结构：前端基于 UniApp/Vue 3，可运行 H5 和微信小程序；后端基于 Express/Prisma/PostgreSQL，提供词书、训练、复习调度、语文课程、AI 陪聊、TTS/ASR 等能力。

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | UniApp 3, Vue 3, TypeScript, Pinia, Vite, SCSS |
| 后端 | Express, TypeScript, Prisma, PostgreSQL, JWT |
| 输入校验 | zod + zod-to-openapi |
| 可观测性 | request id + JSON 结构化日志 |
| 学习算法 | ts-fsrs（英语）+ 自研 SM-2（语文） |
| AI/语音 | OpenAI 兼容 LLM、Edge TTS、讯飞/Whisper ASR |
| 部署 | Docker Compose, Nginx |

## 会员与权限

会员按学科售卖（英语/语文/数学等），功能通过细粒度权限控制：`Permission` → `PlanPermission` → `Subscription/EntitlementGrant`，AI 使用单独的点数钱包。当前英语核心会员已启用，语文/数学/SVIP/AI 包已预留但默认未上架。详见 [doc/entitlements.md](doc/entitlements.md)。

## 目录结构

```text
src/                 前端 UniApp 应用（pages / composables / stores / typing-engine）
src/api/             按领域拆分的 API 客户端（auth / learning / speech / typing / chinese）
src/platform/        跨端适配（runtime / storage / audio / stream / assets / payment / push）
assets/              大体积共享资源（词光图鉴）；H5 构建拷入 /static，小程序/App 走 VITE_ASSET_BASE
e2e/                 Playwright H5 冒烟测试
server/              Express API 服务
server/src/chinese/  语文课程、题卡、SM-2 与资源同步
server/src/entitlements/ 权限目录、套餐映射、订阅/授权与 AI 点数
server/src/validation/  zod 入参校验与 OpenAPI 注册表
server/prisma/       Prisma schema 与数据库迁移
server/data/         英语词库、语文题卡等源数据与构建产物
server/scripts/      词库导入、成语题卡构建、教材抽取
scripts/             跨平台开发编排（dev.mjs）与数据库脚本
deploy/              生产 Nginx 与 Web 镜像配置
doc/                 壳层、主题、数据库表说明
```

## 本地开发

启停脚本已跨平台化：Linux/macOS 任意 shell、Windows 的 Git Bash 或 PowerShell 均可。
Windows 下请直接运行 `node scripts/dev.mjs ...`（或 `bash start-dev.sh`），不要依赖 WSL。

### 两种运行模式

| 模式 | 入口 | 说明 |
|------|------|------|
| 本地测试 | `bash start-dev.sh` / `node scripts/dev.mjs start all` | 启动本地后端 `3005` + 前端 `5173`，连接本机数据库 |
| Docker 发布 | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build` | 启动 Docker 后端 `3004` + Web `80`，连接 Docker 内数据库 |

1. 安装依赖：

```bash
npm install
cd server
npm install
cd ..
```

2. 创建后端环境变量文件：

```bash
cp server/.env.example server/.env
```

至少需要在 `server/.env` 中配置：

```env
DATABASE_URL="postgresql://study:study123@localhost:5432/study_assistant?schema=public"
PORT=3005
JWT_SECRET="change_me_at_least_32_characters_long"
```

3. 一键启动数据库、迁移、后端和前端：

```bash
bash start-dev.sh
```

默认访问地址：

| 服务 | 地址 |
|------|------|
| 前端 H5 | http://localhost:5173 |
| 后端 API | http://localhost:3005 |
| API 文档 | http://localhost:3005/api-docs |
| PostgreSQL | localhost:5432 |

> `/api-docs` 仅开发环境挂载。文档由 `server/src/validation/openapi.ts` 中的 zod 注册表生成，目前覆盖登录/家庭/会话/账号/2FA、词汇、词书、训练、测验、拼读/短文、聊天、语文、admin、speech、TTS、会员/权限、推送、统计等 96 条路径（106 个操作）；其余接口仍以 `server/src/routes/*.ts` 和 `server/src/chinese/chinese.routes.ts` 为准。

## 常用命令

### 启停（跨平台）

```bash
node scripts/dev.mjs start all     # 数据库检查 + generate + migrate + API + H5
node scripts/dev.mjs status        # 查看端口与真实 PID
node scripts/dev.mjs restart api   # 只重启后端（web/all 同理）
node scripts/dev.mjs stop all      # 同时回收 nodemon 启动器与监听进程
```

### 前端

```bash
npm run dev:h5
npm run build:h5
npm run dev:mp-weixin
npm run build:mp-weixin
npm run check:mp-size  # 小程序包体门禁：主包 2MB / 整包 20MB
npm run dev:app
npm run build:app      # 产物在 dist/build/app，交给 HBuilderX 打包
npm run dev:app:lan    # 内网调试：自动检测 LAN IP 并注入 API/assets 地址
npm run build:app:lan  # 内网调试构建（API 3005 + H5 5173）
```

> 小程序/App 构建需要 `VITE_API_BASE`；图鉴等大资源通过 `VITE_ASSET_BASE` 指向 CDN/OSS。H5 默认同源，并自动把 `assets/atlas` 拷到 `/static/atlas`。详见 `doc/asset-loading.md`。

### 后端

```bash
cd server
npm run dev
npm run build
npm run test
npm run test:db
npm run prisma:migrate
npm run prisma:generate
```

### API 契约

```bash
npm run gen:api   # 根目录执行：导出 OpenAPI，生成 src/types/api-generated.ts
```

核心接口的请求/响应类型来自 `server/src/validation/schemas.ts` 与 `responses.ts`，前端通过 `src/types/api-contract.ts` 引用。修改 zod schema 后需要重新生成；CI 会检查生成文件是否过期。

## 生产部署

复制并填写生产环境变量：

```bash
cp .env.prod.example .env.prod
```

启动生产栈：

```bash
bash deploy.sh
```

生产环境包含：

| 容器 | 说明 |
|------|------|
| study-assistant-web | Nginx，托管 H5 静态页并反代 `/api` |
| study-assistant-api | Express API，启动时执行 Prisma 迁移 |
| study-assistant-db | PostgreSQL 16 |

更多部署说明见 [deploy/README.md](deploy/README.md)。

## 核心模块

- 账号与家庭：账号登录、JWT 刷新、多学生（Learner）切换、家长/学生角色、科目切换。
- 词书学习：KET、PET、中考、高考、PEP/Join in 等词库，支持免费和会员/解锁词书。
- 英语训练：听力、口语、认读、拼写（`listening | speaking | reading | writing`）、跨书核对、阶段小测。
- 复习调度：英语用 FSRS；语文题卡用独立的 SM-2，两套状态互不影响。
- 拼读练习：跟写、听写、自测、默写，支持收藏、错词本、自定义词表和短文句子复习。
- 语文学习：部编教材与成语题卡、课程组课、今日计划、学习/测试/背诵/筛选模式。
- 学习统计：每日学习、词书进度、词汇图谱、语文课程统计与薄弱项分析。
- AI 能力：陪聊、场景对话、词汇匹配、语音识别和朗读。
- 小学课文阅读：`src/pages/primary/*` 读取 `src/data/primary/` 内置课本 JSON。

## 验证建议

提交代码前建议至少运行：

```bash
cd server
npm run test
npm run build
cd ..
npm run typecheck
npm run lint
npm run lint:server
npm run test:frontend
npm run build:h5
npm run test:e2e
```

涉及数据库链路时再跑 `cd server && npm run test:db`；CI 会自动执行这套集成测试。

前端单元测试使用 Vitest + happy-dom + Vue plugin + uni mock：`npm run test:frontend` 运行 12 个文件、43 个测试，覆盖 user/vocabulary/entitlements store、StateHint、认读/拼读偏好和 storage、quiz-options、tts-text、speech-text、normalize-word 等逻辑。Playwright H5 冒烟测试 `e2e/smoke.spec.ts` 有 10 个用例：登录页、登录错误、未登录守卫、模拟登录进入角色页、quiz 开始页 + PC 侧栏、登录后词书列表、会员套餐页、认读设置页、语文 drill 卡片、学生拼读设置 → 开始练习；`e2e/real-api.spec.ts` 是可选的真实 API + PostgreSQL 测试（`E2E_REAL_API=1`，CI 独立 job 执行）。Windows 本地默认使用系统 Edge，其他平台/CI 使用安装的 Chromium；可通过 `PLAYWRIGHT_CHANNEL` 覆盖。

后端有 41 个 Vitest 文件（40 个单元测试 + 1 个数据库集成测试），配置见 `server/vitest.config.ts`。`npm test` 默认跳过数据库集成（221 个通过，26 个跳过）；`npm run test:db` 会基于 `server/.env` 创建临时 `it_*` schema、执行迁移、跑完整链路后删除 schema（共 247 个测试）。管理员账号支持 TOTP 两步验证；会员开通支持 mock 支付（生产环境默认禁用，需显式设置 `ALLOW_MOCK_PAYMENT=true`）。生产运维可用 `GET /metrics`（可选 `METRICS_TOKEN`）接入 Prometheus；设置 `SENTRY_DSN` 后 5xx 自动上报 Sentry/APM。API 同时挂载 `/api` 与 `/api/v1`；练习和结算支持可选 `Idempotency-Key`；登录会话支持 refresh 轮换、设备列表、单设备/全设备退出；支持账号导出与注销，管理端写操作有审计日志。CI 使用独立的 PostgreSQL 16 服务并设置 `TEST_DATABASE_URL`，因此会自动跑全部测试；同时构建 H5 和微信小程序、检查 API 生成类型是否最新、运行 Playwright 冒烟，并运行成语内容审计 `npm run audit:idioms`。
