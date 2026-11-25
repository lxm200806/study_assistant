# Study Assistant - 项目功能模块与进度文档（更新版）

## 📋 项目概览

| 属性 | 值 |
|------|------|
| 项目名称 | study-assistant (学习助手) |
| 项目类型 | 英语词汇学习与训练应用 |
| 技术栈 | UniApp/Vue3 + React Native/Expo + Express/Prisma |
| 支持平台 | H5网页、微信小程序、React Native 移动端 |

---

## 🏗️ 整体架构

\`\`\`
study_assistant/
├── mobile/              # React Native 移动端
│   ├── app/            # Expo Router 页面路由
│   │   ├── (auth)/     # 认证相关页面（登录、注册）
│   │   └── (tabs)/     # 主要功能标签页
│   ├── src/            # 源代码目录
│   │   ├── api/        # API 客户端接口
│   │   ├── auth/       # 认证上下文
│   │   ├── components/ # 共享组件
│   │   ├── stores/     # 状态管理
│   │   └── utils/      # 工具函数
├── server/             # 后端 API 服务
│   ├── src/
│   │   ├── controllers/# 控制器层
│   │   ├── services/   # 业务逻辑层
│   │   ├── routes/     # 路由配置
│   │   └── prisma/     # 数据库模型
├── scripts/            # 开发与部署脚本
└── deploy/             # 生产环境部署配置
\`\`\`

---

## 🔑 核心功能模块

### 1️⃣ 用户认证模块 ✅ (95%)

| 功能 | 状态 | 描述 |
|------|------|------|
| 用户注册 | ✅ 已实现 | 支持用户名/密码注册 |
| 用户登录 | ✅ 已实现 | JWT Token 认证 |
| 微信登录 | ⚠️ 后端 Stub 实现 | OAuth 流程后端已完成，前端待集成 |
| 令牌刷新 | ✅ 已实现 | 自动令牌续期机制 |
| 密码加密 | ✅ 已实现 | bcrypt 加密存储 |

**实现细节：**
- 后端：server/src/services/auth.service.ts
- 前端：mobile/src/api/auth.ts, mobile/src/auth/AuthContext.tsx (部分集成)
- API 路由：/api/auth/*

---

### 2️⃣ 新手引导模块 ✅ (100%)

| 功能 | 状态 | 描述 |
|------|------|------|
| 首次使用引导 | ✅ 已实现 | 分步骤引导流程 |
| 词汇书选择 | ✅ 已实现 | KET/PET/中考/高考 |
| 每日目标设定 | ⚠️ UI 完成 | 设置存储至 VOCAB_STORE，后端接口待集成 |

**实现细节：**
- 页面：mobile/app/onboarding.tsx
- 状态存储：VOCAB_STORE

---

### 3️⃣ 词汇书管理系统 ✅ (100%)

| 功能 | 状态 | 描述 |
|------|------|------|
| 书籍列表展示 | ✅ 已实现 | 支持多种考试类型 |
| 书籍详情查看 | ✅ 已实现 | 包含词数、难度等信息 |
| 书籍切换 | ✅ 已实现 | 动态切换当前词汇书 |
| 词汇书解锁 | ⚠️ 权限控制实现 | 免费/会员控制逻辑已实现 |

**支持的词汇书：**
- KET (Key English Test)
- PET (Preliminary English Test)
- 中考词汇
- 高考词汇

---

### 4️⃣ 学习训练模块 ✅ (95%)

| 训练类型 | 状态 | 描述 |
|----------|------|------|
| 听力训练 | ✅ 已实现 | 听音选词练习 |
| 阅读认读 | ✅ 已实现 | 看词选义巩固记忆 |
| 拼写训练 | ✅ 已实现 | 听音拼写强化输出 |
| 口语训练 | ⚠️ 基本完成 | 跟读发音 AI 评分 |

**核心技术：**
- **FSRS 复习算法**：基于间隔重复的智能调度
- **状态跟踪**：掌握度、正确率、练习次数统计

---

### 5️⃣ 阶段小测模块 ✅ (90%)

| 功能 | 状态 | 描述 |
|------|------|------|
| 自动出题 | ✅ 已实现 | 每次30道选择题 |
| 实时答题 | ✅ 已实现 | 逐题作答，即时反馈 |
| 结果统计 | ⚠️ 基本完成 | 得分、正确率分析 |

---

### 6️⃣ 智能复习系统 ✅ (100%)

| 功能 | 状态 | 描述 |
|------|------|------|
| 遗忘曲线计算 | ✅ 已实现 | 基于 FSRS 算法 |
| 到期词识别 | ✅ 已实现 | 自动筛选待复习词汇 |
| 掌握度评估 | ✅ 已实现 | 0-4级掌握程度分级 |

**FSRS 字段：**
- stability: 稳定性
- difficulty: 难度系数
- retrievability: 可检索性

---

### 7️⃣ 学习图谱模块 ⚠️ (85%)

| 功能 | 状态 | 描述 |
|------|------|------|
| 全局图谱 | ✅ 已实现 | 所有词汇掌握情况（后端 API） |
| 书籍图谱 | ✅ 已实现 | 单本词汇掌握率（后端 API） |
| 类型分布 | ✅ 已实现 | 按词性分类统计 |
| 薄弱环节分析 | ⚠️ 后端完成 | Top10薄弱话题识别 |
| 前端可视化 | ⏳ 待完善 | 页面存在但图表显示未完全集成 |

**实现细节：**
- 后端：server/src/services/graph.service.ts
- 前端：mobile/app/vocab-map.tsx, mobile/app/(tabs)/vocab-map.tsx

---

### 8️⃣ AI陪聊模块 ⚠️ (90%)

| 功能 | 状态 | 描述 |
|------|------|------|
| 自由聊天 | ✅ 已实现 | 自然对话场景 |
| 词汇挑战 | ✅ 已实现 | 聊天中随机词汇测试 |
| 情景模拟 | ⚠️ 基本完成 | 主题化角色扮演（API 已实现） |

**技术栈：**
- LLM API 集成（OpenAI-compatible，支持 DashScope/Qwen/DeepSeek）
- 流式响应支持
- 词汇匹配与记录

---

### 9️⃣ 音频能力模块 ⚠️ (85%)

| 功能 | 状态 | 描述 |
|------|------|------|
| 文本转语音 (TTS) | ✅ 已实现 | Edge TTS 集成，支持缓存 |
| 语音识别 (ASR) | ⚠️ 基本完成 | 讯飞 + Whisper 兼容（需配置 API Key） |

**API 端点：**
- /api/tts - 文本转语音
- /api/speech/transcribe - 语音转文字
- /api/speech/assess - 发音评估

---

### 🔟 会员系统 ⚠️ (40%)

| 功能 | 状态 | 描述 |
|------|------|------|
| 会员计划展示 | ✅ 前端 UI 完成 | 月度/年度/终身 |
| 权限控制 | ✅ 后端实现 | 前后端双重校验（BookAccess） |
| 支付集成 | ⏳ 待开发 | 在线支付功能 |

**说明：**
- 移动端有完整的会员页面 UI
- 后端缺少 /api/membership 路由和控制器
- 数据库支持：User.plan, User.planExpiresAt

---

### 1️⃣1️⃣ 数据统计模块 ✅ (90%)

| 功能 | 状态 | 描述 |
|------|------|------|
| 每日学习记录 | ✅ 已实现 | 记录学习时长与词数 |
| 连续打卡统计 | ✅ 已实现 | 天数连击显示 |
| 周报生成 | ⚠️ 后端完成 | API 可用，前端待集成 |

---

### 1️⃣2️⃣ 后台管理模块 ✅ (95%)

| 功能 | 状态 | 描述 |
|------|------|------|
| 缺失释义检查 | ✅ 已实现 | 自动检测词汇质量问题 |
| 权限控制 | ✅ 已实现 | 管理员认证中间件 |

**API 端点：**
- /api/admin/vocabulary/missing/summary - 词汇质量摘要
- /api/admin/vocabulary/missing - 缺失词汇列表

---

## 🗄️ 数据库模型 (Prisma)

**主要数据表：**
- User: 用户信息（含会员标识）
- Book: 词汇书
- Vocabulary: 单词本体
- BookVocabulary: 书籍-单词关联
- VocabularyStat: 用户学习状态（含 FSRS 字段）
- TrainingRecord: 训练记录
- ChatRecord: 聊天历史
- DailyStudyLog: 每日学习日志
- SpeechUsageLog: 语音使用日志

**Prisma 迁移版本：**
\`\`\`
20260529020000_init_postgresql         # 初始迁移
20260529120000_vocab_taxonomy_progress # 词汇分类字段
20260604010418_add_fsrs_fields         # FSRS 字段
20260604013436_add_user_is_admin       # 管理员标识
20260605000000_product_optimization    # 产品优化字段
20260606000000_chat_mode               # 聊天模式支持
\`\`\`

---

## 📈 后端技术栈

| 组件 | 技术 |
|------|------|
| Web框架 | Express.js |
| 类型系统 | TypeScript |
| ORM | Prisma 5.10 |
| 数据库 | PostgreSQL |
| 认证 | JWT (2h access, 7d refresh) |
| 复习算法 | ts-fsrs v5.4.1 |
| AI集成 | OpenAI-compatible LLM |

---

## 📱 前端技术栈

### Web 版
- 框架：UniApp 3.0 + Vue 3.4
- 状态管理：Pinia 2.1.7
- 构建工具：Vite 5.0.12
- 样式：SCSS

### 移动版
- 框架：React Native + Expo
- 导航：Expo Router
- 状态管理：Context API + SecureStore
- 音频处理：expo-av 16.0.8

---

## 📊 开发进度总结

| 模块 | 进度 | 完成度 |
|------|------|--------|
| 用户认证 | ✅ 已完成 | 95% |
| 新手引导 | ✅ 已完成 | 100% |
| 词汇书管理 | ✅ 已完成 | 100% |
| 听力训练 | ✅ 已完成 | 95% |
| 阅读认读 | ✅ 已完成 | 95% |
| 拼写训练 | ✅ 已完成 | 90% |
| 口语训练 | ⚠️ 基本完成 | 85% |
| 阶段小测 | ✅ 已完成 | 90% |
| 复习系统 | ✅ 已完成 | 100% |
| 学习图谱 | ⚠️ 后端完成 | 85% |
| AI陪聊 | ⚠️ 基本完成 | 90% |
| 音频能力 | ⚠️ 基本完成 | 85% |
| 会员系统 | ⏳ 待完善 | 40% |
| 数据统计 | ✅ 已完成 | 90% |
| 后台管理 | ✅ 已完成 | 95% |

---

## 🔧 开发与部署命令

### 本地开发
\`\`\`bash
# 初始化依赖
npm install
cd server && npm install && cd ..

# 启动开发环境（含数据库）
bash start-dev.sh
\`\`\`

### 构建生产版本
\`\`\`bash
# Web 版构建
npm run build:h5

# 小程序构建
npm run build:mp-weixin

# 移动版构建
cd mobile && npx expo export --platform ios,android

# 后端构建
cd server && npm run build
\`\`\`

### Docker 部署
\`\`\`bash
cp .env.prod.example .env.prod
bash deploy.sh
\`\`\`

---

## 📝 待完善功能（规划中）

| 功能 | 状态 | 说明 |
|------|------|------|
| 实时语音通话 | ⏳ 计划中 | WebRTC 音频流传输 |
| 离线学习模式 | ⏳ 计划中 | 缓存词汇至本地 |
| 学习社群功能 | ⏳ 计划中 | 互助学习小组 |
| 挑战赛系统 | ⏳ 计划中 | 好友间单词PK |
| **会员支付集成** | ⚠️ 待开发 | 后端会员 API 完善 |
| **前端图表可视化** | ⚠️ 待完善 | 学习图谱前端集成 |

---

## 🐛 已知问题

1. **API URL 参数格式错误**：mobile/src/api/client.ts 中部分 API 端点的参数格式有误（如 /vocabulary/list?page=&limit= 应为 /vocabulary/list?page={page}&limit={limit}）

2. **Auth Context 集成不完整**：mobile/src/auth/AuthContext.tsx 包含 TODO 注释，实际 API 调用尚未集成

3. **会员系统后端缺失**：缺少 membership 路由和控制器，前端有 UI 但无法与后端通信

---

## 📞 技术支持

- **API 文档**：http://localhost:3005/api-docs (开发环境)
- **数据库**：PostgreSQL localhost:5432/study_assistant
- **配置文件**：.env, .env.prod.example

---

*本文档最后更新于 2026年6月10日*
