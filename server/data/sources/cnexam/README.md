# 国内考试词书（cnexam）

中考、高考、大学英语四/六级同属国内考试大纲词汇，源文件放在这一目录。  
成品 JSON 仍在 `data/vocabulary/books/`（和 KEW / MSE 一样，App 只读成品）。

| 书号 | 级别 | 词表 / 释义 | 成品 |
| --- | --- | --- | --- |
| `zhongkao` | 初中 | `zhongkao-glosses.json` | `books/zhongkao.json` |
| `gaokao` | 高中 | `gaokao-glosses.json` | `books/gaokao.json` |
| `cet4` | 四级 | `cet4-glosses.json` | 释义词典，未单独出书 |
| `cet6` | 六级 | `cet6-glosses.json` | 释义词典，未单独出书 |

四本词表都在对应 `*-glosses.json`（中文、音标、英文释义、例句），不再保留 txt。

## 重建

在 `server/` 下：

```bash
npm run polish:zhongkao
npm run build:cnexam-gloss
```

改中考释义：编辑 `zhongkao-glosses.json` 后跑 `polish:zhongkao`。  
改高考 / 四六级释义：编辑对应 glosses 后跑 `build:cnexam-gloss`（会把高考写回 `books/gaokao.json`）。
