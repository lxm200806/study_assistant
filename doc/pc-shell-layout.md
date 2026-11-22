# PC 壳层布局（改布局必读）

## 一句话

**左侧导航是壳（shell），右侧才是页面内容。**  
改词书 / 主题 / 训练页时，**只改对应页面**；不要顺手改壳层、启动脚本、全局 CSS。

宽屏 PC：**只有右侧 `uni-main` 滚**；左侧固定。

---

## 「改完打不开」先分清两件事

| 现象 | 常见原因 | 正确处理 |
|------|----------|----------|
| 浏览器连不上 `localhost:5173` | 前端 **进程挂了**（与布局代码无关） | `./restart-client.sh`，再 `curl` 看是否 200 |
| 页面白屏 / 报错，但 5173 能通 | 某页 JS/模板错误 | 看浏览器控制台 / `logs/client.log`，**回滚该页**，别乱改壳层 |
| 左右一起滚、背景不统一 | 壳层被改坏 | 只查 `App.vue` 的 `pc-shell` 与 `pc-theme`，别改业务页 |

自检命令：

```bash
curl -s -o /dev/null -w "h5=%{http_code}\n" http://127.0.0.1:5173/
curl -s -o /dev/null -w "api=%{http_code}\n" http://127.0.0.1:3005/api/books
```

- `h5=200` → 服务是好的，刷新浏览器即可  
- `h5=000` → **先重启前端**，不要当成「布局改坏了」去大改代码  

访问地址：**http://localhost:5173/**（API 走 Vite 代理到 3005，不要直接当页面开 3005）

---

## 改什么 → 动哪些文件（严禁越界）

| 你要做的事 | ✅ 只许改 | ❌ 禁止顺手改 |
|------------|-----------|----------------|
| 词书列表 UI | `pages/books/books.vue` | `App.vue`、`left-window`、`pages.json` tabBar、启动脚本 |
| 主题选择 / 左右背景色 | `pages/theme/theme.vue`、必要时 `utils/pc-theme.ts` | 各业务页硬编码背景、乱改 `pc-shell` 滚动规则 |
| 侧栏多一个菜单 | `windows/left-window.vue`；新页再加 `pages.json` 一条 path | 重构整个 tabBar、改无关页 |
| 左栏跟着右栏滚 | `App.vue` 里 `html.pc-shell` 段、`pc-route.ts` | 在 `pages/*` 写 `html`/`body`/`uni-main` |
| 训练页交互 | 对应 `pages/recognition` 等 | 壳层、主题、启动脚本 |

### 壳层文件清单（非任务点名不要动）

- `src/App.vue`（尤其 `@media` / `pc-shell` / `pc-chromeless`）
- `src/windows/left-window.vue`
- `src/utils/pc-route.ts`、`src/utils/pc-theme.ts`、`src/utils/subject.ts`（`applyAppShell`）
- `src/pages.json` 的 `leftWindow` / `tabBar`（增页只加 path，别重排整份）
- `start-client.sh` / `restart-client.sh` / `dev-h5.sh` / `vite.config.*`（布局 UI **无关**）

### 页面层

- `src/pages/**`、`src/components/**`：只改任务相关文件的 **模板 + scoped 样式**
- 禁止在业务页写全局选择器：`uni-left-window`、`uni-main`、`html`、`body`、`page { overflow… }`

---

## 结构（H5 ≥768px）

```text
html.pc-shell
└─ uni-app / uni-layout / uni-content
   ├─ uni-left-window          ← 壳：侧栏（认读 / 拼读 / 词书 / 图鉴 / 主题 …）
   │  └─ windows/left-window.vue
   └─ uni-main                 ← 唯一纵向滚动；背景 --pc-main-bg
      └─ pages/**              ← 业务内容
```

窄屏 / 小程序：无 leftWindow，用底部 `tabBar`。

---

## 主题

- 侧栏 **主题** → `/pages/theme/theme`
- **分层色板**（卡片/按钮/字色一起变）：见 [theme-layers.md](./theme-layers.md)
- **已全层适配**：日间·米色、夜间·墨灰；云灰/松青仅有基底
- **自定义**：可新增 / 选用 / 删除（会自动推导分层）；不能改官方
- 业务页用 `var(--pc-*)`，禁止只改底色、白卡片死写 `#fff`

---

## 类名

| 类名 | 谁设置 | 作用 |
|------|--------|------|
| `html.pc-shell` | `syncPcRoute()` | 锁壳，仅 `uni-main` 滚 |
| `html.pc-chromeless` | 宽屏 + 名单页 | 藏系统导航栏 |
| `data-pc-theme` | `pc-theme.ts` | 主题 id |

---

## 何时重启前端

| 改动 | 要不要 `./restart-client.sh` |
|------|------------------------------|
| 普通 `.vue` / `.ts`（含主题页、词书页） | **否**，HMR / 刷新即可 |
| `pages.json`、`vite.config.*`、依赖、`dev-h5.sh` | **是**，重启后必须 `curl` 5173=200 |
| 只改文档 / `.cursor/rules` | 否 |

Agent：**不要**为 scoped 样式或主题色反复杀端口重启；重启后若进程又没了，用本仓库的 `./restart-client.sh`（独立进程组，避免会话结束带走前端），再验证，而不是继续改布局代码。

---

## 自检（布局）

宽屏打开词书或主题页，滚右侧：

- ✅ 左侧不动  
- ✅ 只有右侧动  
- ❌ 左栏一起滚 → 查壳层，别改业务页凑合  
