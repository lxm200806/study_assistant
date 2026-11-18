# KEW 词书维护（以 kew1200 为例）

所有命令都在 **`server/`** 目录下执行。

路径里的 `server/` 是相对仓库根目录；命令本身已在 `server/` 里，所以脚本里写的相对路径是 `data/...`。

---

## 文件角色（先认清这几个）

| 中文名 | 路径 | 谁维护 | 干什么 |
| --- | --- | --- | --- |
| 词序表 | `data/sources/kew/kew1200/units.json` | 人 | 有哪些词、什么顺序 |
| 本书释义 | `data/sources/kew/kew1200/kew1200-glosses.json` | 人 | 这本书的中文/英文/音标/例句（可覆盖全局） |
| 全局词典 | `data/sources/senses.json` | 人 + 工具 | 所有书共用；`pending` 待校验 / `verified` 已校验 |
| 成品书 | `data/vocabulary/books/kew1200.json` | 脚本生成 | App / 数据库真正用的书，一般别手改 |
| 过程报告 | `tmp/kew/*.json` | 脚本生成 | 缺词列表、待校验列表等，方便查看 |

字段查找顺序：**本书释义 > 全局词典 > 脚本默认**。

### `senses.json` 条目结构（嵌套）

顶层 key 是小写英文词；value 示例：

```json
{
  "abandon": {
    "meanings": [
      {
        "pos": "v.",
        "meaning": { "zh": "放弃", "en": "to leave behind" },
        "sentences": [
          { "en": "Do not abandon hope.", "zh": "不要放弃希望。", "role": "basic" },
          { "en": "They abandoned the plan.", "zh": "他们放弃了计划。", "role": "ext" }
        ]
      }
    ],
    "phonetic": { "uk": "/əˈbændən/", "us": "/əˈbændən/" },
    "topic": "society",
    "level": "B2",
    "status": "pending",
    "origin": "word-atlas"
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `meanings[]` | 义项；`meaning.zh` / `meaning.en`；可选 `pos` |
| `sentences[]` | 挂在义项下；`role`: `basic`（基础）/ `ext`（进阶/考试） |
| `phonetic` | `uk` / `us` / `g`（通用，不分英美时） |
| `level` | 级别 A1–C2（不再用顶层 `cefr`） |
| `status` | `pending` 待校验 / `llm` 大模型已校验 / `verified` 人工已校验 |

旧扁平字段读入时会自动 normalize；一次性压盘用 `cidian:yasuo`。

---

## 命令一览（拼音）

| 命令 | 意思 |
| --- | --- |
| `cidian:daoru-ciguang` | 词典：从词光导入全局（偶尔做一次） |
| `cidian:quezi` | 词典：查缺词 |
| `cidian:jiaoyan` | 词典：校验 / 标记已校验 |
| `cidian:yasuo` | 词典：把 senses.json 压成嵌套结构（一次性） |
| `paoguang:kew1200` | 抛光：生成/更新成品书 |
| `cidian:tianchong` | 词典：用全局回填成品里的主题等 |
| `tongbu:cishu` | 同步：成品写入数据库 |

说明：`npm run 某命令 -- 后面的参数` 里，中间那个单独的 `--` 是给 npm 的，表示「后面原样传给脚本」。

---

## 完整流程示例：处理 kew1200

### 第 0 步（可选）：词光导入 / 结构压缩

一般只需做一次，或词光大更新时再做。

```bash
npm run cidian:daoru-ciguang
# 若磁盘上仍是旧扁平字段，压成嵌套：
npm run cidian:yasuo
```

| 变化 | 说明 |
| --- | --- |
| 写入/更新 | `data/sources/senses.json` |
| 状态 | 新导入或补洞的词多为 `pending`（待校验） |
| 不会动 | `units.json`、`kew1200-glosses.json`、成品书、数据库 |

试跑不写盘：`npm run cidian:daoru-ciguang -- --dry-run`

---

### 第 1 步：准备词序（人）

编辑：

- `data/sources/kew/kew1200/units.json`

需要时同时准备/校对本书释义：

- `data/sources/kew/kew1200/kew1200-glosses.json`

这两步**不跑命令**，只改文件。

---

### 第 2 步：看这本词书缺哪些全局词

```bash
npm run cidian:quezi -- kew1200
```

| 变化 | 说明 |
| --- | --- |
| 新产生 | `tmp/kew/kew1200-lexicon-missing.json`（缺词报告） |
| 不会改 | `senses.json`、成品书、数据库 |

终端会打印：词表多少、全局已有多少、缺失多少。

---

### 第 3 步：把缺词写进全局（标成待校验）

```bash
npm run cidian:quezi -- kew1200 --write
```

| 变化 | 说明 |
| --- | --- |
| 更新 | `data/sources/senses.json`（追加缺词，`status: pending`） |
| 更新/产生 | `tmp/kew/kew1200-lexicon-missing.json` |
| 不会改 | 成品书、数据库 |

有本书释义时，会尽量把释义字段一并带进全局，方便后面校验。

---

### 第 4 步：校验全局词典里的待校验词

先看有哪些待校验：

```bash
npm run cidian:jiaoyan
```

| 变化 | 说明 |
| --- | --- |
| 新产生/更新 | `tmp/kew/lexicon-pending.json`（待校验报告） |
| 不会改 | `senses.json` 内容（只读列出） |

#### 大模型自动校验（推荐）

在 `server/.env` 配好密钥（DeepSeek 示例：`DEEPSEEK_API_KEY` + `LLM_BASE_URL=https://api.deepseek.com/v1` + `LLM_MODEL=deepseek-chat`；或百炼 `OPENAI_API_KEY`）后：

```bash
# 处理全部 pending；默认并发 5，每 25 条成功落盘一次
npm run cidian:jiaoyan -- --llm

# 并发 8（最大 10），每 40 条落盘；Ctrl+C 会先落盘再退出
npm run cidian:jiaoyan -- --llm --concurrency 8 --flush 40

# 串行 + 一次请求塞 5 个词（concurrency=1 时才用 --batch）
npm run cidian:jiaoyan -- --llm --concurrency 1 --batch 5

# 先试跑 20 个
npm run cidian:jiaoyan -- --llm --limit 20
```

校验内容：中/英释义是否正确、例句有无且贴合义项、音标、topic、level；缺则补、错则改。

并发时 LLM 请求可并行，但只在内存里更新词典，由单写路径定期写 `senses.json`（避免多写交错丢更新）。

| 变化 | 说明 |
| --- | --- |
| 更新 | `data/sources/senses.json`（修正字段，`status` → `llm`；按 `--flush` 降频落盘） |
| 日志 | `tmp/kew/lexicon-llm-verify.jsonl`、`lexicon-llm-summary.json` |

人工确认某几个词没问题后，也可标成人工已校验：

```bash
npm run cidian:jiaoyan -- --mark-verified apple ball
```

| 变化 | 说明 |
| --- | --- |
| 更新 | `data/sources/senses.json`（对应词的 `status` 改为 `verified`） |

---

### 第 5 步：抛光——生成/更新成品书

```bash
npm run paoguang:kew1200
```

| 变化 | 说明 |
| --- | --- |
| 写入/更新 | `data/vocabulary/books/kew1200.json`（成品书） |
| 新产生/更新 | `tmp/kew/kew1200-polish-report.json`（抛光报告） |
| 读取 | 本书 `kew1200-glosses.json` + 全局 `senses.json` + 已有成品（若有） |
| 不会改 | 数据库（还没同步） |

---

### 第 6 步（可选）：用全局词典回填主题等

```bash
npm run cidian:tianchong -- kew1200.json
```

| 变化 | 说明 |
| --- | --- |
| 更新 | `data/vocabulary/books/kew1200.json`（补 topic / cefr / 进阶例句等） |
| 读取 | `data/sources/senses.json` |
| 不会改 | 数据库 |

试跑：`npm run cidian:tianchong -- --dry-run kew1200.json`

---

### 第 7 步：同步到数据库（App 才能用上）

```bash
npm run tongbu:cishu -- --force kew1200
```

| 变化 | 说明 |
| --- | --- |
| 更新 | 数据库里的 `kew1200` 词书与词条 |
| 读取 | `data/vocabulary/books/kew1200.json` |
| 不会改 | 源文件、成品 JSON 内容本身 |

`--force`：就算词数没变，也强制把释义等重写进库（改过释义后要用）。

中间那个单独的 `--`：告诉 npm「后面的 `--force kew1200` 原样传给脚本」。

---

## 只改释义（最短路径）

例如只改了 `kew1200-glosses.json` 里几个词：

```bash
npm run paoguang:kew1200
npm run tongbu:cishu -- --force kew1200
```

| 步骤 | 产生/更新的文件 |
| --- | --- |
| 抛光 | `books/kew1200.json`、`tmp/kew/kew1200-polish-report.json` |
| 同步 | 数据库 |

---

## 4500 / 7200

把命令里的 `kew1200` 换成 `kew4500` 或 `kew7200` 即可，例如：

```bash
npm run cidian:quezi -- kew4500 --write
npm run paoguang:kew4500
npm run tongbu:cishu -- --force kew4500
```

---

## 理想状态

全局词典越来越全、大多已是 `verified` 之后：新书主要维护词序 `units.json`，缺词写入 → 校验 → 抛光 → 同步。本书释义表只在「这本书教法跟全局不一样」时才改。
