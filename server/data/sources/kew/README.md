# KEW 词书维护

书号、文件夹、脚本参数、glosses 前缀、成品 JSON 用同一套名字：`kew1200` / `kew4500` / `kew7200`。

```
kew1200/units.json  +  kew1200/kew1200-1-glosses.json  →  books/kew1200-1.json
```

## 每套三件套

| 套系 | 单元词表 | 释义表 | 成品（运行时） |
| --- | --- | --- | --- |
| kew1200 | `kew1200/units.json` | `kew1200/kew1200-N-glosses.json` | `data/vocabulary/books/kew1200-N.json` |
| kew4500 | `kew4500/units.json` | `kew4500/kew4500-N-glosses.json` | `data/vocabulary/books/kew4500-N.json` |
| kew7200 | `kew7200/units.json` | `kew7200/kew7200-N-glosses.json` | `data/vocabulary/books/kew7200-N.json` |

App 和数据库只读成品 JSON。每本词书（含 MSE、中考、高考）成品词条都要有中文意思、音标、英文释义、例句。

## 日常修改

在 `server/` 下执行。

改释义（中文 / 音标 / 英语 / 例句）：

1. 改 `kewXXXX/kewXXXX-N-glosses.json`
2. `npm run polish:kewXXXX`
3. 重启后端同步数据库

改单元词表：

1. 改同目录 `units.json`（或重跑 extract）
2. `npm run build:kewXXXX:fast`（会冲掉释义）
3. `npm run polish:kewXXXX`

抽词表：

- 4500：`python scripts/vocabulary-import/extract-kew4500-xlsx.py` → `kew4500/units.json`
- 7200：`python scripts/vocabulary-import/extract-kew7200-toc.py` → `kew7200/units.json`

校验 glosses：`python scripts/vocabulary-import/validate-kew-glosses.py kew4500`

## 不要提交

中间产物一律写到 `server/tmp/`（构建报告、缺词列表、gloss input、OCR），不要放进 `books/`。

- `server/tmp/`
- `server/materials/`、`.env`
