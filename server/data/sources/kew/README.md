# KEW 词书

与其它词书同一套流程，**不再使用「抛光」这个名字**。

## 日常

| 文件 | 作用 |
| --- | --- |
| `data/sources/senses/{a-z}.json` | 总词典（按字母分片） |
| `data/vocabulary/units/kew1200.json` 等 | **单元顺序**（权威） |
| `data/vocabulary/books/kew1200.json` 等 | 编排生成的课表 |

旧路径 `data/sources/kew/*/units.json` 仅作迁移来源；首次 `cishu:bianpai` 会拷到 `vocabulary/units/`。

```bash
# 改单元顺序后编排课表
npm run cishu:bianpai -- kew1200
npm run tongbu:cishu -- --force kew1200
```

旧命令 `paoguang:kew1200` / `polish:kew1200` 仍可用，内部已转到 `cishu:bianpai`。
