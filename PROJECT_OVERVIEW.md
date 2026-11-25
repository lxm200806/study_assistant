# 学习助手项目概览

## 项目信息

| 属性 | 值 |
|------|------|
| 项目名称 | study-assistant |
| 项目类型 | UniApp 跨平台英语 + 语文学习应用 |
| 支持平台 | H5、微信小程序 |
| 主要功能 | 英语词汇训练/FSRS 复习、语文题卡课程/SM-2 复习、键盘拼读、AI 陪聊、口语识别、学习统计 |

## 技术栈

### 前端

- **框架**: UniApp 3.0.0
- **核心**: Vue 3.4.21 + TypeScript
- **状态管理**: Pinia 2.1.7
- **构建工具**: Vite 5.0.12
- **样式**: SCSS

### 后端

- **框架**: Express 4.18.2
- **语言**: TypeScript
- **ORM**: Prisma 5.10.0
- **数据库**: PostgreSQL
- **认证**: JWT
- **输入校验**: zod + zod-to-openapi
- **可观测性**: request id + JSON 结构化访问/错误日志
- **复习算法**: ts-fsrs（英语）+ 自研 SM-2（语文）
- **AI/语音**: OpenAI-compatible LLM、Edge TTS、讯飞 ASR/Whisper 兼容 ASR

## 前端布局（PC 壳层）

宽屏左侧导航 + 右侧页面；**只有右侧滚动**。改业务页时不要动壳层。

详见：[doc/pc-shell-layout.md](doc/pc-shell-layout.md)

## 项目结构

```text
src/
├── windows/left-window.vue   # PC 侧栏壳（导航），非业务页
├── App.vue                   # 全局样式；含 pc-shell 滚动隔离
├── pages/                    # 32 个已注册页面（pages.json）
│   ├── login/ register/      # 登录、注册
│   ├── home/                 # 首页
│   ├── books/                # 词书选择
│   ├── primary/              # 小学课文阅读（内置 JSON）
│   ├── vocabulary/           # 学习统计
│   ├── vocabulary-map/       # 词汇图谱
│   ├── vocabulary-practice/  # 词汇训练入口
│   ├── recognition/          # 认读训练
│   ├── typing/               # 键盘拼读
│   ├── speaking/             # 口语训练
│   ├── quiz/                 # 阶段小测
│   ├── chat/                 # AI 陪聊
│   ├── membership/           # 会员
│   ├── mine/                 # 我的
│   ├── theme/                # 主题
│   ├── family/               # 角色选择、学生管理
│   ├── admin/                # 词库缺失检查
│   └── chinese/              # 语文课程、题库、练习、计划、统计、资源、草稿
├── api/                      # 按领域拆分的 API 客户端（auth/learning/speech/typing/chinese）
├── components/               # 通用组件、训练组件、图谱图表、拼读输入
├── composables/              # 训练、音频、流式 ASR/TTS 等组合逻辑
├── typing-engine/            # 拼读纯逻辑引擎（token/归一化/标记/音效）
├── platform/                 # 跨端适配（runtime / storage / audio / stream）
├── stores/                   # Pinia 状态（user / vocabulary）
├── utils/                    # API、导航、语音、主题、掌握度等工具
├── data/                     # 前端词库元数据 + primary 课本 JSON
└── types/                    # 前端类型；api-generated.ts 由 npm run gen:api 生成

server/
├── src/
│   ├── server.ts             # 进程入口：listen + bootstrap
│   ├── app.ts                # createApp()：中间件与路由，不 listen
│   ├── bootstrap.ts          # 启动后内容同步与 /ready 状态
│   ├── routes/               # 路由层
│   ├── controllers/          # Controller 层
│   ├── services/             # 英语、拼读、聊天、语音等业务服务
│   ├── chinese/              # 语文路由、控制器、课程、SM-2、题卡
│   ├── middleware/           # 认证、管理员、错误、限流、安全头
│   ├── validation/           # zod schema、校验中间件、OpenAPI 注册表
│   ├── prisma/               # Prisma 客户端与事务辅助
│   ├── config/               # 环境变量校验
│   ├── utils/                # JWT、密码、日期、分页、格式化等工具
│   ├── data/                 # 内置词库和分类标签
│   └── types/                # 后端共享类型
├── prisma/                   # Prisma schema 与迁移
├── data/                     # 英语词库、语文题卡、教材源数据
├── scripts/                  # 词库导入、成语题卡、教材抽取
└── Dockerfile / docker-entrypoint.sh
```

## 功能模块

| 模块 | 功能说明 | 状态 |
|------|----------|------|
| 账号与家庭 | 账号登录、JWT 刷新、多学生切换、家长/学生角色、科目切换 | 已实现 |
| 新手引导 | 首次注册后的角色/学生设置入口（不再单独走 onboarding 页面） | 已实现 |
| 词书体系 | KET、PET、中考、高考、PEP/Join in 等词书，支持会员/解锁 | 已实现 |
| 英语训练 | 听力、口语、认读、拼写、跨书核对 | 已实现 |
| 阶段小测 | 按词书抽题并提交结果 | 已实现 |
| 复习调度 | 英语 FSRS；语文 SM-2，两套独立 | 已实现 |
| 拼读练习 | 跟写、听写、自测、默写、收藏、错词本、自定义词表、短文句子 | 已实现 |
| 语文学习 | 部编教材/成语题卡、课程组课、今日计划、学习/测试/背诵/筛选 | 已实现 |
| 学习图谱 | 全局/词书掌握度、分类统计、薄弱项分析 | 已实现 |
| AI 陪聊 | 自由聊天、挑战模式、角色扮演、词汇匹配 | 已实现 |
| 语音能力 | TTS、ASR、口语评分 | 已实现，依赖环境配置 |
| 小学课文 | `pages/primary/*` 读取 `src/data/primary/` 内置 JSON | 已实现 |
| 管理后台 | 词库缺失释义检查、管理员访问控制 | 已实现 |

## API 模块

| 前缀 | 说明 |
|------|------|
| `/api/auth` | 登录、注册、刷新 token、学生管理、角色/科目切换 |
| `/api/books` | 词书列表（公开）、详情、训练 session、进度、到期复习数量 |
| `/api/vocab` | 词汇列表、详情、随机词汇、统计、`/maps/*` 学习图谱 |
| `/api/training` | 练习提交、跨书核对、复习列表、训练历史、阶段小测 |
| `/api/stats` | 每日统计、周报（图谱在 `/api/vocab/maps`，不在这里） |
| `/api/chat` | AI 陪聊、流式聊天、历史、配额 |
| `/api/tts` | 文本转语音 |
| `/api/speech` | ASR 会话、转写、口语评分 |
| `/api/typing` | 拼读练习、短文/词表、队列与统计 |
| `/api/chinese` | 语文课程、题卡、资源同步、草稿/发布 |
| `/api/admin` | 管理员词库检查能力 |

`GET /api/books`、`GET /api/chinese/meta`、`GET /api/tts` 和注册/登录/刷新接口无需登录；其余 `/api` 接口需要 Bearer token。

开发环境 `/api-docs` 由 `server/src/validation/openapi.ts` 的 zod 注册表生成，当前覆盖 12 个核心接口；其余接口以路由文件为准。

## 核心数据模型

主要模型位于 `server/prisma/schema.prisma`，共 30 个，按领域分为：

- 账号与家庭：`User`、`Learner`、`AccountDailyActive`（`account_daily_actives`）。
- 英语内容：`Book`、`Vocabulary`、`BookVocabulary`。
- 英语学习：`VocabularyStat`、`TrainingRecord`、`BookStudyProgress`、`BookWordCheck`、`DailyStudyLog`、`UserBookUnlock`。
- 对话与用量：`ChatRecord`、`SpeechUsageLog`。
- 语文：`ChineseResource`、`ChinesePublished`、`ChineseEntry`、`ChineseEntryGrade`、`ChineseEntryLevel`、`ChineseCourse`、`ChineseCourseItem`、`ChineseReviewState`、`ChineseReviewLog`。
- 拼读/键盘练习：`TypingModeStat`、`TypingSessionLog`、`ArticleSentenceCard`、`LearnerWordMark`、`PracticeList`、`PracticeListItem`、`PracticeArticle`。

字段级说明见 `doc/database-tables.md`。

## 运行命令

### 一键开发

```bash
bash start-dev.sh
```

该脚本会启动 PostgreSQL、执行迁移、启动后端 API 和前端 H5。

### 运行模式

| 模式 | 入口 | 端口/数据源 |
|------|------|-------------|
| 本地测试 | `bash start-dev.sh` 或 `bash start-server.sh` | 后端 `3005`，本机 PostgreSQL |
| Docker 发布 | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build` | 后端 `3004`，Docker PostgreSQL，Web `80` |

### 前端

```bash
npm run dev:h5
npm run build:h5
npm run dev:mp-weixin
npm run build:mp-weixin
```

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

根目录生成前端 API 类型：

```bash
npm run gen:api
```

## 开发环境配置

| 项 | 默认值 |
|----|--------|
| 前端端口 | 5173 |
| 后端端口 | 3005（本地）/ 3004（Docker） |
| API 基础地址 | `/api`，由 Vite 代理到 `http://127.0.0.1:3005` |
| 数据库 | PostgreSQL `localhost:5432/study_assistant` |

## 环境变量

生产环境参考 `.env.prod.example`。关键配置包括：

- `DATABASE_URL` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
- `TEST_DATABASE_URL`（可选，数据库集成测试独立库）
- `JWT_SECRET` / `JWT_REFRESH_SECRET` / `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN`
- `CORS_ORIGINS`
- `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY`
- `LLM_BASE_URL` / `LLM_MODEL`
- `WHISPER_API_KEY` / `WHISPER_BASE_URL` / `WHISPER_MODEL`
- `XFYUN_APP_ID` / `XFYUN_API_KEY` / `XFYUN_API_SECRET`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- `TTS_VOICE`
- `SPEECH_PASS_THRESHOLD`
- `VITE_API_BASE`（非 H5 构建必须显式配置）
- `WECHAT_LOGIN_STUB`（仅本地调试）

## 部署

生产环境使用 `docker-compose.prod.yml`：

```bash
cp .env.prod.example .env.prod
bash deploy.sh
```

容器包括 Nginx Web、Express API 和 PostgreSQL。详细说明见 `deploy/README.md`。

## 测试现状

后端已有 31 个 Vitest 测试文件（30 个单元测试 + `src/integration/critical-flows.test.ts` 集成测试），重点覆盖：

- 英语：FSRS 复习、训练事务、覆盖率/跨书核对、智能队列、词书访问控制
- 语文：SM-2、课程与题卡解析
- 拼读：队列选择、FSRS 调度
- AI/语音：聊天上下文与回复清洗、词汇匹配、TTS 重音、ASR 片段合并、口语评分归一化
- 基础设施：JWT、限流、分页、日期键、词形格式化、zod 校验、request id
- 关键链路集成：注册/登录/刷新 → 学生 → 取书会话 → 提交练习 → 结算会话；语文今日队列 → 提交复习；拼读队列/答题/标记/词表；聊天发送/历史/配额/SSE

`npm test` 默认跳过数据库集成（177 个通过，7 个跳过）；`npm run test:db` 使用临时 `it_*` schema 跑全部 184 个测试。CI 的 PostgreSQL 16 服务会自动执行集成测试，并构建 H5 与微信小程序、检查 API 生成类型是否最新。

前端已有 Playwright H5 冒烟测试（`e2e/smoke.spec.ts`，6 个用例：登录页、登录错误、未登录守卫、模拟登录进入角色页、登录后词书列表、学生拼读设置页），通过 `npm run test:e2e` 运行。前端组件测试仍未配置，这是后续补强方向。
