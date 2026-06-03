# 学习助手项目概览

## 项目信息

| 属性 | 值 |
|------|------|
| 项目名称 | study-assistant |
| 项目类型 | UniApp 跨平台应用 |
| 支持平台 | H5、微信小程序 |
| 主要功能 | 词汇学习与训练 |

## 技术栈

### 前端
- **框架**: UniApp 3.0.0
- **核心**: Vue 3.4.21 + TypeScript
- **状态管理**: Pinia 2.1.7
- **构建工具**: Vite 5.0.12
- **样式**: SCSS

### 后端
- **框架**: Express 4.18.2
- **ORM**: Prisma 5.10.0
- **数据库**: SQLite
- **认证**: JWT

## 项目结构

```
src/
├── pages/                    # 页面
│   ├── login/               # 登录页
│   ├── home/                # 首页
│   ├── vocabulary/          # 词汇统计页
│   ├── listening/           # 听力训练页
│   ├── recognition/         # 认读训练页
│   ├── spelling/            # 拼写训练页
│   └── chat/                # AI陪聊页
├── stores/                  # Pinia状态管理
│   ├── user.ts              # 用户状态
│   └── vocabulary.ts        # 词汇状态
├── utils/
│   ├── api.ts               # API接口封装
│   └── index.ts             # 通用工具
├── data/
│   └── vocabulary.ts        # 模拟词汇数据
└── types/
    └── index.ts             # TypeScript类型定义
```

## 功能模块

| 模块 | 功能说明 | 状态 |
|------|----------|------|
| 用户认证 | 登录、注册、退出 | ✅ |
| 首页 | 学习统计、快捷入口、复习提醒 | ✅ |
| 听力训练 | 听音选词练习 | ✅ |
| 认读训练 | 看图识词练习 | ✅ |
| 拼写训练 | 听写单词练习 | ✅ |
| AI陪聊 | 口语练习 | ⚠️ |
| 词汇管理 | 词汇列表、统计数据 | ✅ |

## API接口列表

### 认证模块
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/profile` | GET | 获取用户信息 |

### 词汇模块
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/vocabulary` | GET | 获取词汇列表 |
| `/api/vocabulary/{id}` | GET | 获取词汇详情 |
| `/api/vocabulary/random` | GET | 获取随机词汇 |
| `/api/vocabulary/stats` | GET | 获取词汇统计 |

### 训练模块
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/training/practice` | POST | 提交练习记录 |
| `/api/training/review` | GET | 获取待复习词汇 |
| `/api/training/history` | GET | 获取训练历史 |

### 聊天模块
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat/send` | POST | 发送消息 |
| `/api/chat/history` | GET | 获取聊天历史 |

## 核心数据结构

### Vocabulary (词汇)
```typescript
{
  id: string,
  word: string,       // 单词
  meaning: string,    // 释义
  phonetic: string,   // 音标
  image?: string,     // 图标/emoji
  example?: string    // 例句
}
```

### VocabularyStats (词汇统计)
```typescript
{
  listening: Record<string, WordStats>,  // 听力词汇统计
  speaking: Record<string, WordStats>,   // 口语词汇统计
  reading: Record<string, WordStats>,    // 认读词汇统计
  writing: Record<string, WordStats>     // 拼写词汇统计
}
```

### WordStats (单词统计)
```typescript
{
  count: number,        // 练习次数
  correctCount: number, // 正确次数
  lastPractice: number, // 上次练习时间戳
  mastery: number       // 掌握程度(1-5)
}
```

## 运行命令

### 前端
```bash
npm run dev:h5          # H5开发
npm run build:h5        # H5构建
npm run dev:mp-weixin   # 微信小程序开发
npm run build:mp-weixin # 微信小程序构建
```

### 后端
```bash
cd server
npm run dev             # 开发模式
npm run build           # 构建
npm run start           # 启动
```

## 开发环境配置

- **前端端口**: 5173
- **后端端口**: 3000
- **API基础地址**: `http://localhost:3000/api`

## 注意事项

1. 启动前端前需先启动后端服务
2. 后端首次运行需执行 `npm run prisma:migrate` 初始化数据库
3. 词汇数据已预置25个常用单词作为初始数据
