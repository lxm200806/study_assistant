# Study Assistant

英语词汇学习与训练应用。项目采用前后端同仓结构：前端基于 UniApp/Vue 3，可运行 H5 和微信小程序；后端基于 Express/Prisma/PostgreSQL，提供词书、训练、复习调度、AI 陪聊、TTS/ASR 等能力。

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | UniApp 3, Vue 3, TypeScript, Pinia, Vite, SCSS |
| 后端 | Express, TypeScript, Prisma, PostgreSQL, JWT |
| 学习算法 | ts-fsrs 间隔复习 |
| 部署 | Docker Compose, Nginx |

## 目录结构

```text
src/                 前端 UniApp 应用
server/              Express API 服务
server/prisma/       Prisma schema 与数据库迁移
server/data/         词库源数据与构建产物
scripts/             本地开发、数据库、词库同步脚本
deploy/              生产 Nginx 与 Web 镜像配置
```

## 本地开发

项目脚本默认面向 WSL/Linux shell，Windows 下建议在 WSL 中运行。

1. 安装依赖：

```bash
npm install
cd server
npm install
cd ..
```

2. 创建后端环境变量文件：

```bash
touch server/.env
```

至少需要在 `server/.env` 中配置：

```env
DATABASE_URL="postgresql://study:study123@localhost:5432/study_assistant?schema=public"
PORT=3004
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
| 后端 API | http://localhost:3004 |
| API 文档 | http://localhost:3004/api-docs |
| PostgreSQL | localhost:5432 |

## 常用命令

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

- 用户认证：注册、登录、JWT、管理员、新手引导。
- 词书学习：KET、PET、中考、高考等词库，支持免费和会员词书。
- 训练模式：听力、认读、拼写、口语、阶段小测。
- 复习调度：基于 FSRS 维护到期时间、记忆保持率和掌握度。
- 学习统计：每日学习、词书进度、词汇图谱、薄弱项分析。
- AI 能力：陪聊、场景对话、词汇匹配、语音识别和朗读。

## 验证建议

提交代码前建议至少运行：

```bash
cd server
npm run test
npm run build
cd ..
npm run build:h5
```
