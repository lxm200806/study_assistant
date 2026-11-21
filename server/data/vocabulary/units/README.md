# 词书单元表（统一）

每本书一份：`<code>.json`。

**编排课表**（生成 `books/<code>.json` 顺序）：

```bash
cd server
npm run cishu:bianpai -- kew1200
npm run cishu:bianpai                 # 全部已注册书
npm run cishu:bianpai -- --init       # 缺 units 时从现有 books 生成
```

改完单元顺序后务必：

```bash
npm run tongbu:cishu -- --force 书号
```

释义不在这里，在 `data/sources/senses.json`。
