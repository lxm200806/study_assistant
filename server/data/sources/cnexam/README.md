# 中高考 / 四六级

| 书 | 单元表 | 课表 |
| --- | --- | --- |
| 中考 | `vocabulary/units/zhongkao.json` | `books/zhongkao.json` |
| 高考 | `vocabulary/units/gaokao.json` | `books/gaokao.json` |
| 四级 | `vocabulary/units/cet4.json` | `books/cet4.json` |
| 六级 | `vocabulary/units/cet6.json` | `books/cet6.json` |

释义在 `senses/{a-z}.json`（字母分片）。改单元顺序后：

```bash
npm run cishu:bianpai -- zhongkao
npm run tongbu:cishu -- --force zhongkao
```
