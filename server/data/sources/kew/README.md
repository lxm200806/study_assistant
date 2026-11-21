# KEW 词书维护

命令都在 **`server/`** 下执行。

## 日常维护（只看这三样）

| 文件 | 作用 |
| --- | --- |
| `data/sources/senses.json` | **总词典**（释义 / 音标 / 例句 / topic / level） |
| `data/vocabulary/books/kew1200.json` 等 | **课表**（词序、单元 tags、多义词 senseKey） |
| `data/sources/kew/*/units.json` | 单元原料；大改课序时用，再跑抛光重建课表 |

已删除：`*-glosses.json`（旧本书释义）。不要再维护 gloss。

### 改释义

编辑 `senses.json`（或 `npm run cidian:jiaoyan -- --llm`），然后：

```bash
npm run tongbu:cishu -- --force kew1200
```

### 大改单元词序

1. 改 `data/sources/kew/kew1200/units.json`
2. 重建瘦身课表：`npm run paoguang:kew1200`
3. 同步：`npm run tongbu:cishu -- --force kew1200`

`paoguang` 现在只从 `units.json` 生成课表（word + tags），**不写释义**。

## 其它常用命令

| 命令 | 作用 |
| --- | --- |
| `cidian:quezi` | 对照课表查总表缺词 |
| `cidian:jiaoyan` | LLM / 人工校验总表 |
| `cishu:daochu` / `cidian:hebing` | 书→总表增量导出/合并（过渡用） |
| `cishu:shoushen` | 成品书再瘦身（一般已瘦完） |
| `tongbu:cishu` | 同步进数据库 |

废弃（会直接报错提示）：`polish:mse`、`polish:zhongkao`、`build:cnexam-gloss`、`build:cet-books`、`fill:mse`。
