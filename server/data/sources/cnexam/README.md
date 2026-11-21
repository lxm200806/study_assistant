# 中高考 / 四六级词书

| 书 | 课表 |
| --- | --- |
| 中考 | `data/vocabulary/books/zhongkao.json` |
| 高考 | `data/vocabulary/books/gaokao.json` |
| 四级 | `data/vocabulary/books/cet4.json` |
| 六级 | `data/vocabulary/books/cet6.json` |

**释义**一律在 `data/sources/senses.json`。  
旧 `*-glosses.json` 与 `build:cnexam-gloss` / `polish:zhongkao` / `build:cet-books` 已废弃。

```bash
npm run tongbu:cishu -- --force zhongkao gaokao cet4 cet6
```
