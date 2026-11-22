# 人教 PEP 小学英语（新教材）

词表整理自 [速声英语](https://ss.aihu.cn/books) 公开单元页（`pep-primary-ss-aihu`）。

| 书号 | 册次 | 来源页 |
|------|------|--------|
| `pep-g3a-2024` | 三上 2024 | /books/pep3 |
| `pep-g3b-2025` | 三下 2025 | /books/pep3b |
| `pep-g4a-2025` | 四上 2025 | /books/pep4 |
| `pep-g4b-2026` | 四下 2026 | /books/pep4b |
| `pep-g5a-2026` | 五上 2026 | /books/pep5 |

五下、六年级速声尚未上线；上线后可按同样流程追加。

## 文件

- 单元词表：`data/vocabulary/units/<code>.json`
- 释义种子：`data/sources/pep/<code>-glosses.json`
- 自编课文：`data/vocabulary/passages/<code>.json`
- 原文槽位：`data/vocabulary/passages/<code>-textbook.json`
- 已授权原文：`<code>-textbook.local.json`（gitignore）

## 同步

```bash
npm run cidian:quezi -- pep-g3a-2024 pep-g3b-2025 pep-g4a-2025 pep-g4b-2026 pep-g5a-2026 --write
npm run cishu:bianpai -- pep-g3a-2024 pep-g3b-2025 pep-g4a-2025 pep-g4b-2026 pep-g5a-2026
npm run tongbu:cishu -- --force pep-g3a-2024 pep-g3b-2025 pep-g4a-2025 pep-g4b-2026 pep-g5a-2026
```

本仓库不收录教材课文原文。

个人课本 Markdown（PEP + 精通）放在 `data/kb/md/`（gitignore）。对齐册次后：

```bash
npm run kb:sync
npm run kb:import
```

会生成 `passages/*-textbook.local.json` 与 `src/data/primary/local/*-textbook.json`。
