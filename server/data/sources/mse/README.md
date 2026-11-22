# MSE（KET / PET）

与全部词书同一流程：

| 文件 | 作用 |
| --- | --- |
| `data/sources/senses/{a-z}.json` | 释义（字母分片） |
| `data/vocabulary/units/mse-ket.json` 等 | 单元顺序 |
| `data/vocabulary/books/mse-ket.json` 等 | 编排生成的课表 |

```bash
npm run cishu:bianpai -- mse-ket
npm run tongbu:cishu -- --force mse-ket
```
