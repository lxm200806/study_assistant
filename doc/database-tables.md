# 数据库表说明

本文档依据 `server/prisma/schema.prisma` 整理，对应 PostgreSQL 库 `study_assistant`。  
Prisma 模型名与真实表名不一致时，以表名为准。

当前共 21 张业务表，按模块分为：账号与学习者、英语词书、对话与用量、语文课程。

## 总览

| 模块 | 表名 | 作用 |
| --- | --- | --- |
| 账号 | `User` | 能登录的家庭账号。用户数、付费、日活、留存都统计这张表 |
| 账号 | `Learner` | 学习者（孩子）。学习进度、课程、掌握度都挂在这里 |
| 账号 | `account_daily_actives` | 账号按日活跃，用于 DAU / 留存 |
| 英语 | `Book` | 英语词书 |
| 英语 | `Vocabulary` | 单词/词条内容 |
| 英语 | `BookVocabulary` | 词书与单词的多对多关系 |
| 英语 | `BookStudyProgress` | 某本词书本轮已练过的词 |
| 英语 | `VocabularyStat` | 单词掌握度与 FSRS 复习状态 |
| 英语 | `TrainingRecord` | 单次练习对错流水 |
| 英语 | `UserBookUnlock` | 账号已解锁的词书 |
| 英语 | `DailyStudyLog` | 每日英语学习量和连续天数 |
| 对话 | `ChatRecord` | AI 对话消息 |
| 对话 | `SpeechUsageLog` | 语音识别/合成用量 |
| 语文 | `chinese_resources` | 语文资料包及同步状态 |
| 语文 | `chinese_published` | 题卡（草稿 / 已发布 / 废弃） |
| 语文 | `chinese_entries` | 语文词条（一首诗、一个成语等） |
| 语文 | `chinese_entry_grades` | 词条适用年级 |
| 语文 | `chinese_entry_levels` | 词条适用级别 |
| 语文 | `chinese_courses` | 学习者的语文课程 |
| 语文 | `chinese_course_items` | 课程包含哪些题卡 |
| 语文 | `chinese_review_states` | 语文 SM-2 复习状态 |
| 语文 | `chinese_review_logs` | 语文答题流水 |

---

## 账号与学习者

登录账号和孩子必须分开：用户数、会员、日活看 `User`；练习记录看 `Learner`。  
一个账号下多个孩子都在 `Learner` 里，用 `accountId` + `name` 区分，归档用 `archivedAt`。

### `User`

能登录的家庭账号。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 账号 ID |
| `username` | TEXT | 唯一 | 登录名 |
| `passwordHash` | TEXT | 必填 | 密码哈希，不存明文 |
| `isAdmin` | BOOLEAN | 默认 `false` | 是否管理员 |
| `plan` | TEXT | 默认 `free` | 会员档位：`free` / `premium` |
| `planExpiresAt` | TIMESTAMP | 可空 | 会员到期时间 |
| `wxOpenId` | TEXT | 唯一，可空 | 微信 OpenID |
| `hasOnboarded` | BOOLEAN | 默认 `false` | 是否完成首次引导 |
| `activeSubject` | TEXT | 默认 `english` | 当前学科：`english` / `chinese` |
| `displayName` | TEXT | 可空 | 显示名 |
| `activeLearnerId` | TEXT | 唯一，可空，外键 → `Learner.id` | 当前选中的孩子 |
| `activeRole` | TEXT | 默认 `parent` | 当前界面角色：`parent` / `student` |
| `createdAt` | TIMESTAMP | 默认 now | 创建时间 |
| `updatedAt` | TIMESTAMP | 自动更新 | 更新时间 |

接口仍返回 `accountType: 'parent'`，这是给前端用的展示字段，库里不再存账号类型。

### `Learner`

学习者。英语练习、语文课程、对话用量都挂在这里。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 学习者 ID |
| `accountId` | TEXT | 外键 → `User.id`，级联删除 | 所属账号 |
| `name` | TEXT | 必填 | 孩子姓名 |
| `activeSubject` | TEXT | 默认 `english` | 该孩子当前学科 |
| `archivedAt` | TIMESTAMP | 可空 | 归档时间；有值表示已停用 |
| `createdAt` | TIMESTAMP | 默认 now | 创建时间 |
| `updatedAt` | TIMESTAMP | 自动更新 | 更新时间 |

索引：`accountId`。

### `account_daily_actives`

账号日活。鉴权成功后按登录账号写入，不按学习者。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `userId` | TEXT | 联合主键，外键 → `User.id`，级联删除 | 账号 |
| `date` | TEXT | 联合主键 | 日期 `YYYY-MM-DD`（UTC） |
| `lastSeenAt` | TIMESTAMP | 默认 now | 当日最后一次鉴权时间 |

---

## 英语词书与练习

### `Book`

一本英语词书，例如某年级教材词汇。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 词书 ID |
| `name` | TEXT | 唯一 | 词书名称 |
| `code` | TEXT | 唯一 | 词书编码，接口常用这个查书 |
| `description` | TEXT | 可空 | 简介 |
| `level` | TEXT | 必填 | 程度或年级标记 |
| `wordCount` | INTEGER | 默认 0 | 词数缓存 |
| `isFree` | BOOLEAN | 默认 `false` | 是否免费书；否则需会员或解锁 |
| `createdAt` | TIMESTAMP | 默认 now | 创建时间 |

### `Vocabulary`

一条英语单词或短语。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 单词 ID |
| `word` | TEXT | 必填 | 英文写法 |
| `meaning` | TEXT | 必填 | 中文释义 |
| `phonetic` | TEXT | 可空 | 音标 |
| `imageUrl` | TEXT | 可空 | 配图地址 |
| `exampleSentence` | TEXT | 可空 | 例句 |
| `englishMeaning` | TEXT | 可空 | 英文释义 |
| `contentType` | TEXT | 可空 | 内容分类，用于知识图谱筛选 |
| `topic` | TEXT | 可空 | 主题分类 |
| `tags` | TEXT[] | 默认空数组 | 标签 |
| `createdAt` | TIMESTAMP | 默认 now | 创建时间 |

### `BookVocabulary`

词书和单词的多对多关系，并记录该书中的顺序。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 关系 ID |
| `bookId` | TEXT | 外键 → `Book.id` | 词书 |
| `wordId` | TEXT | 外键 → `Vocabulary.id` | 单词 |
| `sort_order` | INTEGER | 默认 0 | 在该书中的排序。Prisma 字段名是 `sortOrder` |

唯一约束：`(bookId, wordId)`。

### `BookStudyProgress`

学习者在某本词书当前一轮练过哪些词，用来避免重复抽题。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 进度 ID |
| `learnerId` | TEXT | 外键 → `Learner.id`，级联删除 | 学习者 |
| `bookId` | TEXT | 外键 → `Book.id` | 词书 |
| `cycleStartedAt` | TIMESTAMP | 默认 now | 本轮开始时间 |
| `practicedWordIds` | TEXT[] | 默认空数组 | 本轮已练过的单词 ID |

唯一约束：`(learnerId, bookId)`。

### `VocabularyStat`

某学习者对某单词、某种练习类型的 FSRS 复习状态。  
`practiceCount` / `correctCount` / `mastery` / `lastPractice` 是随练习更新的展示缓存；正式次数和正确率以 `TrainingRecord` 流水为准。这些缓存仍会参与 FSRS、图谱和覆盖率计算，不要删。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 统计 ID |
| `learnerId` | TEXT | 外键 → `Learner.id`，级联删除 | 学习者 |
| `wordId` | TEXT | 外键 → `Vocabulary.id` | 单词 |
| `type` | TEXT | 必填 | 练习类型，如听写、认读、拼写、口语 |
| `practiceCount` | INTEGER | 默认 0 | 练习次数（展示缓存） |
| `correctCount` | INTEGER | 默认 0 | 正确次数（展示缓存） |
| `lastPractice` | TIMESTAMP | 可空 | 最近一次练习时间 |
| `mastery` | INTEGER | 默认 0 | 掌握度分数（展示缓存） |
| `due` | TIMESTAMP | 可空 | 下次应复习时间 |
| `stability` | DOUBLE | 默认 0 | FSRS 记忆稳定度 |
| `difficulty` | DOUBLE | 默认 0 | FSRS 难度 |
| `reps` | INTEGER | 默认 0 | 成功复习次数 |
| `lapses` | INTEGER | 默认 0 | 遗忘次数 |
| `fsrsState` | TEXT | 默认 `New` | FSRS 状态，如 `New` / `Learning` / `Review` |
| `lastReview` | TIMESTAMP | 可空 | 最近一次复习时间 |
| `retrievability` | DOUBLE | 默认 0 | 当前可提取概率 |
| `recentLapse` | BOOLEAN | 默认 `false` | 最近是否刚遗忘 |

唯一约束：`(learnerId, wordId, type)`。  
索引：`(learnerId, type, due)`。

### `TrainingRecord`

单次英语练习流水，用于统计正确率和历史。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 记录 ID |
| `learnerId` | TEXT | 外键 → `Learner.id`，级联删除 | 学习者 |
| `wordId` | TEXT | 外键 → `Vocabulary.id` | 单词 |
| `type` | TEXT | 必填 | 练习类型，与 `VocabularyStat.type` 对应 |
| `isCorrect` | BOOLEAN | 必填 | 本次是否正确 |
| `createdAt` | TIMESTAMP | 默认 now | 作答时间 |

### `UserBookUnlock`

账号已解锁的非免费词书。会员也可直接访问，不依赖本表。解锁挂在账号上，不按孩子拆。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 解锁记录 ID |
| `userId` | TEXT | 外键 → `User.id` | 账号 |
| `bookId` | TEXT | 外键 → `Book.id` | 词书 |
| `createdAt` | TIMESTAMP | 默认 now | 解锁时间 |

唯一约束：`(userId, bookId)`。

### `DailyStudyLog`

按自然日汇总英语学习量，并记录连续打卡天数。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 日志 ID |
| `learnerId` | TEXT | 外键 → `Learner.id`，级联删除 | 学习者 |
| `date` | TEXT | 必填 | 日期，通常为 `YYYY-MM-DD` |
| `wordCount` | INTEGER | 默认 0 | 当日学习词数 |
| `streak` | INTEGER | 默认 0 | 截至当日的连续天数 |
| `createdAt` | TIMESTAMP | 默认 now | 创建时间 |

唯一约束：`(learnerId, date)`。

---

## 对话与语音用量

### `ChatRecord`

英语陪练聊天的一条消息。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 消息 ID |
| `learnerId` | TEXT | 外键 → `Learner.id`，级联删除 | 学习者 |
| `role` | TEXT | 必填 | `user` 或 `assistant` / `ai` |
| `content` | TEXT | 必填 | 消息正文 |
| `mode` | TEXT | 可空 | 对话模式，如自由聊、纠错等 |
| `createdAt` | TIMESTAMP | 默认 now | 发送时间 |

### `SpeechUsageLog`

语音识别或语音合成的调用记录，用于限额和统计。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 用量 ID |
| `learnerId` | TEXT | 外键 → `Learner.id`，级联删除 | 学习者 |
| `kind` | TEXT | 必填 | 用量类型，如 ASR / TTS |
| `createdAt` | TIMESTAMP | 默认 now | 调用时间 |

索引：`(learnerId, createdAt)`。

---

## 语文课程

语文内容按「词条 → 多张题卡」组织。  
成语不再绑定年级，只用 `difficulty` 分层：`primary` 基础、`xiaoshengchu` 拓展、`junior` 培优。

组课和学习只读 `status = 'published'` 的题卡。草稿、废弃也在同一张表，用 `status` 区分。

### `chinese_resources`

一份官方或用户上传的语文资料包，以及它同步到题库的版本。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 资源 ID |
| `ownerType` | TEXT | 必填 | `official` 官方包，或 `user` 用户上传 |
| `ownerId` | TEXT | 可空 | 资源归属，官方包可为空 |
| `path` | TEXT | 必填 | 文件相对路径 |
| `filename` | TEXT | 必填 | 原始文件名 |
| `mime` | TEXT | 可空 | MIME 类型 |
| `slug` | TEXT | 默认空 | 资料包标识，如 `elementary-idioms` |
| `status` | TEXT | 默认 `stored` | 处理状态，如 `stored` / `extracted` |
| `uploadedBy` | TEXT | 可空，外键 → `User.id` | 上传人（账号） |
| `syncedVersion` | INTEGER | 默认 0 | 已同步到题库的版本号 |
| `syncedHash` | TEXT | 默认空 | 已同步内容哈希，用于判断是否需要再同步 |
| `createdAt` | TIMESTAMP | 默认 now | 创建时间 |

索引：`(ownerType, slug)`。

### `chinese_published`

题卡总表。一门课里的每一道题都指向这里的一行。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 题卡 ID |
| `kind` | TEXT | 必填 | 内容种类：`poem` / `wenyan` / `idiom` / `saying` / `sentence` / `zi` |
| `level` | TEXT | 必填 | 旧级别 `L1`–`L4` |
| `grade` | TEXT | 默认空 | 年级；成语为空 |
| `prompt` | TEXT | 必填 | 题目 |
| `answer` | TEXT | 必填 | 答案 |
| `tags` | TEXT | 默认空 | 标签 |
| `source` | TEXT | 默认空 | 出处 |
| `sourceResourceId` | TEXT | 可空，外键 → `chinese_resources.id` | 来源资料包 |
| `draftId` | TEXT | 可空 | 历史草稿 ID，合并后可等于本行 `id` |
| `pointKey` | TEXT | 唯一，可空 | 题卡稳定键，同步时用来判断插入还是更新 |
| `groupKey` | TEXT | 默认空 | 学习组 |
| `subGroupKey` | TEXT | 默认空 | 组内子类 |
| `entryKey` | TEXT | 默认空 | 所属词条 |
| `lemma` | TEXT | 默认空 | 词条原文 |
| `questionType` | TEXT | 默认 `dictation` | 题型 |
| `audience` | TEXT | 默认 `all` | 适用对象 |
| `difficulty` | TEXT | 默认空 | 分层：`primary` / `xiaoshengchu` / `junior` |
| `isActive` | BOOLEAN | 默认 `true` | 是否上架 |
| `options` | JSONB | 默认 `{}` | 选项对象，如 `{"choices":["..."]}` |
| `status` | TEXT | 默认 `published` | `draft` / `published` / `discarded` |
| `createdBy` | TEXT | 可空，外键 → `User.id` | 创建人 |
| `createdAt` | TIMESTAMP | 默认 now | 创建时间 |
| `publishedAt` | TIMESTAMP | 可空 | 发布时间；草稿为空 |

常用索引：`kind+level+grade`、`entryKey`、`groupKey`、`questionType`、`difficulty`、`isActive`、`status`。

#### 题型 `questionType`

| 值 | 含义 |
| --- | --- |
| `dictation` | 默写 |
| `recite` | 背诵 |
| `char_judge` | 写法对错（旧题型，成语已改为选择题） |
| `pinyin_choice` | 选正确拼音 |
| `spelling_choice` | 选正确写法 |
| `meaning_choice` | 选正确意思 |
| `context_choice` | 按语境选成语 |
| `usage_judge` | 判断句子里用法对不对 |

### `chinese_entries`

一个语文知识点本身，不存具体题目。  
年级、级别只存在关联表，不再在词条上重复存字符串。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 词条行 ID |
| `entryKey` | TEXT | 唯一 | 业务主键，如 `idiom:一丝不苟`、`poem:...` |
| `kind` | TEXT | 必填 | 内容种类 |
| `lemma` | TEXT | 默认空 | 展示名称 |
| `tags` | TEXT | 默认空 | 标签 |
| `source` | TEXT | 默认空 | 出处 |
| `updatedAt` | TIMESTAMP | 自动更新 | 更新时间 |

### `chinese_entry_grades`

词条和年级的多对多。删除词条时级联删除。成语同步时会清掉这些关联。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `entryKey` | TEXT | 联合主键，外键 → `chinese_entries.entryKey` | 词条 |
| `grade` | TEXT | 联合主键 | 年级，如 `三年级上` |

索引：`grade`。

### `chinese_entry_levels`

词条和级别的多对多。成语同步时同样会清掉。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `entryKey` | TEXT | 联合主键，外键 → `chinese_entries.entryKey` | 词条 |
| `level` | TEXT | 联合主键 | 级别 `L1`–`L4` |

### `chinese_courses`

学习者的一门语文课。筛选条件决定以后「同步新词」会补进哪些题卡。  
每天学多久只看 `dailyMinutes`；组课里的能量预算在内存里按分钟换算，不再落库。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 课程 ID |
| `learnerId` | TEXT | 外键 → `Learner.id`，级联删除 | 学习者 |
| `name` | TEXT | 必填 | 课程名 |
| `note` | TEXT | 默认空 | 备注 |
| `kinds` | TEXT | 默认空 | 勾选的内容种类，编码后的筛选串 |
| `levels` | TEXT | 默认空 | 勾选的级别 |
| `grades` | TEXT | 默认空 | 勾选的年级 |
| `difficulties` | TEXT | 默认空 | 勾选的分层：基础/拓展/培优 |
| `dailyMinutes` | INTEGER | 默认 15 | 每天计划学习分钟数 |
| `reviewDefaultTest` | BOOLEAN | 默认 `false` | 有到期复习时，是否默认进入「测试」模式 |
| `createdAt` | TIMESTAMP | 默认 now | 创建时间 |

索引：`learnerId`。  
能量与时间换算：约 4 点能量 = 1 分钟，仅用于组课计算。

### `chinese_course_items`

课程里有哪些已发布题卡，以及展示顺序。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `courseId` | TEXT | 联合主键，外键 → `chinese_courses.id`，级联删除 | 课程 |
| `pointId` | TEXT | 联合主键，外键 → `chinese_published.id` | 题卡 |
| `sort` | INTEGER | 默认 0 | 在课程中的顺序 |

### `chinese_review_states`

某学习者在某课程、某张题卡上的 SM-2 间隔重复状态。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `learnerId` | TEXT | 联合主键，外键 → `Learner.id`，级联删除 | 学习者 |
| `courseId` | TEXT | 联合主键，外键 → `chinese_courses.id`，级联删除 | 课程 |
| `pointId` | TEXT | 联合主键，外键 → `chinese_published.id` | 题卡 |
| `n` | INTEGER | 默认 0 | 连续答对次数 |
| `ef` | DOUBLE | 默认 2.5 | 简易度因子 |
| `interval` | INTEGER | 默认 0 | 当前间隔天数 |
| `due` | DATE | 可空 | 下次复习日期 |
| `lapses` | INTEGER | 默认 0 | 遗忘次数 |
| `last` | DATE | 可空 | 最近一次复习日期 |

索引：`(learnerId, courseId, due)`。

### `chinese_review_logs`

语文每一次作答记录，用于今日进度、连续正确和统计。

| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | TEXT | 主键，UUID | 流水 ID |
| `learnerId` | TEXT | 外键 → `Learner.id`，级联删除 | 学习者 |
| `courseId` | TEXT | 外键 → `chinese_courses.id`，级联删除 | 课程 |
| `pointId` | TEXT | 外键 → `chinese_published.id` | 题卡 |
| `quality` | INTEGER | 必填 | SM-2 质量分，越高表示越熟 |
| `isNew` | BOOLEAN | 必填 | 本次是否算新学 |
| `correct` | BOOLEAN | 必填 | 是否答对 |
| `createdAt` | TIMESTAMP | 默认 now | 作答时间 |

索引：`(learnerId, courseId, createdAt)`。

---

## 主要关系

```text
User
 ├─ Learner（accountId）
 │    ├─ BookStudyProgress / VocabularyStat / TrainingRecord / DailyStudyLog
 │    ├─ ChatRecord / SpeechUsageLog
 │    └─ chinese_courses
 │         ├─ chinese_course_items → chinese_published
 │         ├─ chinese_review_states → chinese_published
 │         └─ chinese_review_logs → chinese_published
 ├─ account_daily_actives
 ├─ UserBookUnlock
 └─ chinese_resources / chinese_published.createdBy

Book ← BookVocabulary → Vocabulary

chinese_entries ← chinese_entry_grades
chinese_entries ← chinese_entry_levels
chinese_resources ← chinese_published
```

## 维护说明

- 改表结构请改 `server/prisma/schema.prisma` 并做迁移，然后同步更新本文档。
- 用户数 / DAU / 留存只统计 `User` 和 `account_daily_actives`，不要把 `Learner` 算进去。
- 语文发布包同步时按 `pointKey` 更新 `chinese_published`，按 `entryKey` 更新 `chinese_entries`。
- 成语词条的拼音、释义以 `server/data/chinese/raw/idioms/` 下的分卷 JSON 为准，数据库只存发布后的题卡。
