# 学习助手项目概览

## 项目信息

| 属性 | 值 |
|------|------|
| 项目名称 | study-assistant |
| 项目类型 | UniApp 跨平台英语学习应用 |
| 支持平台 | H5、微信小程序 |
| 主要功能 | 词汇学习、训练复习、AI 陪聊、口语识别、学习统计 |

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
- **复习算法**: ts-fsrs
- **AI/语音**: OpenAI-compatible LLM、Edge TTS、讯飞 ASR/Whisper 兼容 ASR

## 项目结构

```text
src/
├── pages/                    # 前端页面
│   ├── login/                # 登录
│   ├── register/             # 注册
│   ├── onboarding/           # 新手引导
│   ├── home/                 # 首页
│   ├── books/                # 词书选择
│   ├── vocabulary/           # 学习统计
│   ├── vocabulary-map/       # 词汇图谱
│   ├── listening/            # 听力训练
│   ├── recognition/          # 认读训练
│   ├── spelling/             # 拼写训练
│   ├── speaking/             # 口语训练
│   ├── quiz/                 # 阶段小测
│   ├── chat/                 # AI 陪聊
│   ├── membership/           # 会员
│   ├── mine/                 # 我的
│   └── admin/                # 词库管理
├── components/               # 通用组件与训练组件
├── composables/              # 训练、音频、流式 ASR/TTS 等组合逻辑
├── stores/                   # Pinia 状态
├── utils/                    # API、导航、语音、掌握度等工具
├── data/                     # 前端词书静态兜底数据
└── types/                    # 前端类型

server/
├── src/
│   ├── app.ts                # API 入口
│   ├── routes/               # 路由层
│   ├── controllers/          # Controller 层
│   ├── services/             # 业务服务层
│   ├── middleware/           # 认证、错误、管理员中间件
│   ├── utils/                # JWT、密码、TTS、词库格式等工具
│   └── data/                 # 内置词库和分类标签
├── prisma/                   # Prisma schema 与迁移
├── data/                     # 词库构建产物和源数据
└── scripts/                  # 词库导入、迁移、管理员种子脚本
```

## 功能模块

| 模块 | 功能说明 | 状态 |
|------|----------|------|
| 用户认证 | 注册、登录、JWT、个人资料、微信登录入口 | 已实现 |
| 新手引导 | 首次注册后的学习引导 | 已实现 |
| 词书体系 | KET、PET、中考、高考等词书，支持会员解锁 | 已实现 |
| 学习训练 | 听力、认读、拼写、口语训练 | 已实现 |
| 阶段小测 | 按词书抽题并提交结果 | 已实现 |
| 复习调度 | 基于 FSRS 计算 due、retrievability、mastery | 已实现 |
| 学习图谱 | 全局/词书掌握度、分类统计、薄弱项分析 | 已实现 |
| AI 陪聊 | 自由聊天、挑战模式、角色扮演、词汇匹配 | 已实现 |
| 语音能力 | TTS、ASR、口语评分 | 已实现，依赖环境配置 |
| 管理后台 | 词库缺失释义检查、管理员访问控制 | 已实现 |

## API 模块

| 前缀 | 说明 |
|------|------|
| `/api/auth` | 登录、注册、刷新 token、个人资料、新手引导 |
| `/api/books` | 词书列表、详情、训练 session、进度、到期复习数量 |
| `/api/vocabulary` | 词汇列表、详情、随机词汇、统计 |
| `/api/training` | 练习提交、复习列表、训练历史、阶段小测 |
| `/api/stats` | 每日统计、周报、词汇图谱 |
| `/api/chat` | AI 陪聊、流式聊天、历史、配额 |
| `/api/tts` | 文本转语音 |
| `/api/speech` | ASR 会话、转写、口语评分 |
| `/api/admin` | 管理员词库检查能力 |

## 核心数据模型

主要模型位于 `server/prisma/schema.prisma`：

- `User`: 用户、管理员标记、会员计划、新手引导状态。
- `Book`: 词书元信息。
- `Vocabulary`: 单词、释义、音标、例句、主题、标签。
- `BookVocabulary`: 词书与单词的多对多关系。
- `VocabularyStat`: 用户单词训练统计和 FSRS 字段。
- `TrainingRecord`: 单次训练记录。
- `BookStudyProgress`: 词书覆盖进度。
- `DailyStudyLog`: 每日学习记录。
- `ChatRecord`: AI 聊天历史。
- `SpeechUsageLog`: 语音使用记录。

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
npm run prisma:migrate
npm run prisma:generate
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
- `JWT_SECRET`
- `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL`
- `XFYUN_APP_ID` / `XFYUN_API_KEY` / `XFYUN_API_SECRET`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- `TTS_VOICE`
- `SPEECH_PASS_THRESHOLD`

## 部署

生产环境使用 `docker-compose.prod.yml`：

```bash
cp .env.prod.example .env.prod
bash deploy.sh
```

容器包括 Nginx Web、Express API 和 PostgreSQL。详细说明见 `deploy/README.md`。

## 测试现状

后端已有 Vitest 单元测试，重点覆盖：

- FSRS 复习算法
- 口语评分文本归一化
- 讯飞 ASR 流式片段合并
- AI 回复清洗
- 词汇匹配
- 聊天系统提示词构建

前端页面测试和端到端测试仍是后续可补强方向。
