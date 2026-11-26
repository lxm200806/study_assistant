# 静态资源加载（图鉴 / 音频）

## 原则

- **小资源**（图标、键盘音效、必要 JSON）放 `src/static/`，随代码包分发。
- **大资源**（词光图鉴，约 86MB）放 `assets/`，**不要**放 `src/static/`，否则会被打进微信小程序和 App 包。
- 页面不要手写 `/static/...` 绝对路径，统一走 `src/platform/assets.ts`：
  - `assetUrl(path)`：按平台和 `VITE_ASSET_BASE` 解析资源 URL
  - `tryAssetUrl(path)`：解析失败返回 `null`，用于图鉴占位降级
  - `loadJsonAsset(path)`：H5 用 `fetch`，小程序/App 用 `uni.request`

## 平台策略

| 资源 | H5 / PC | 微信小程序 | App |
|------|---------|------------|-----|
| 图鉴缩略图 | H5 dev 由 Vite 中间件从 `assets/atlas` 提供 `/static/atlas/*`；H5 build 拷到 `dist/build/h5/static/atlas` | 不打包；通过 `VITE_ASSET_BASE` 从 CDN/OSS 加载 | 同小程序；后续可做本地缓存 |
| `word-to-id.json` | 同源 `fetch` 或 CDN | `uni.request`（需配置 request 合法域名） | `uni.request` |
| 键盘音效 | 本地 `src/static/sound` + `Audio` 池 | 本地 `src/static/sound` + `uni.createInnerAudioContext` 池 | 同小程序 |
| 单词 TTS | 有道 / 浏览器 TTS / 后端 `/api/tts` | 后端 `/api/tts` + `innerAudioContext` | 后端 `/api/tts` + `innerAudioContext` |
| AI 流式聊天 | fetch SSE | `uni.request` chunked | 降级到 `/chat/send` |

## 环境变量

| 变量 | 说明 |
|------|------|
| `VITE_API_BASE` | API 根地址。H5 默认同源 `/api`；小程序/App 必须配置 |
| `VITE_ASSET_BASE` | 大资源 CDN/OSS 根地址，例如 `https://cdn.example.com/study`。小程序/App 必须配置；H5 留空时使用同源 `/static`，设置后 H5 构建不再拷贝本地图鉴 |

Vite 只把 `VITE_*` 变量注入客户端。示例（不要提交真实密钥；这些变量本身是公开的）：

```env
VITE_API_BASE=https://api.example.com/api
VITE_ASSET_BASE=https://cdn.example.com/study
```

建议放在 `.env.production` / `.env.local`，再执行对应构建。CDN 目录需要与 H5 同构：

```text
<VITE_ASSET_BASE>/static/atlas/word-to-id.json
<VITE_ASSET_BASE>/static/atlas/thumb/<id>.webp
```

H5 如果跨域 `fetch` 索引 JSON，CDN 需要返回 CORS 头；图片不需要。H5 优先同源部署，跨域仅在小程序/App 必须时使用。

如果暂时没有独立 CDN，也可以直接把生产 H5 的 Nginx 当资源服务器：

1. H5 正常构建（不设置 `VITE_ASSET_BASE`），`assets/atlas` 会进入 `/usr/share/nginx/html/static/atlas`。
2. 小程序/App 构建时设置 `VITE_ASSET_BASE=https://你的域名`。
3. 在微信后台配置该域名的 request/downloadFile 合法域名，并确保 HTTPS 可用。

### 没有 HTTPS / 只有端口转发时

- **不需要给图鉴单独开端口**：优先复用 H5/API 的对外端口，让 `/static/atlas` 和 `/api` 走同一个域名。
- 外部服务器如果是公网 IP，只需放行该端口；如果在 NAT 后面，才需要把公网端口转发到内网服务。端口转发是网络层配置，不影响前端构建。
- H5 页面和资源必须同为 HTTP 或 HTTPS（HTTPS 页面加载 HTTP 资源会被浏览器拦截）；App 调试阶段可以用 HTTP，正式发版建议上 HTTPS。
- H5 的录音/语音识别依赖 secure context，生产环境最终仍需要 HTTPS（或 localhost 调试）。
- 同一 Wi-Fi 下调试 App 不需要域名或端口转发，直接使用局域网 IP：

```bash
# 先启动 API + H5 dev server（图鉴由 H5 dev server 提供）
node scripts/dev.mjs start all

# 自动检测 LAN IP，注入 API/assets 地址后构建 App
npm run build:app:lan

# 或边改边调（uni-app 的 app watch 构建）
npm run dev:app:lan
```

脚本会排除虚拟网卡，优先选择 `192.168.*` 地址；如果检测到多个地址，可用 `LAN_IP=192.168.x.x` 覆盖。手机和电脑需在同一 Wi-Fi，Windows 防火墙需放行 `3005` 和 `5173` 端口。

## H5 / PC

- 源码：`assets/atlas/`（`thumb/*.webp` + `word-to-id.json`）。
- 开发：`vite.config.ts` 中的 `atlasAssetsPlugin` 把 `/static/atlas/*` 映射到 `assets/atlas`，不需要额外启动静态服务器。
- 构建：未设置 `VITE_ASSET_BASE` 时，插件在 `closeBundle` 把 `assets/atlas` 拷到 `dist/build/h5/static/atlas`；Nginx 的 `/static/` 已有 7 天缓存。
- Docker：`deploy/web/Dockerfile` 已 `COPY assets ./assets`，构建阶段会自动拷贝。
- 设置 `VITE_ASSET_BASE` 后跳过本地拷贝，H5 也走 CDN。

## 微信小程序

- `build:mp-weixin` 不会包含 `assets/`；`src/static` 中只保留图标、键盘音效等小文件。
- 未配置 `VITE_ASSET_BASE` 时构建会打印警告，图鉴索引加载失败后自动降级为占位符，不会阻塞页面。
- 需要在微信公众平台配置：
  - **request 合法域名**：`uni.request` 拉取 `word-to-id.json`
  - **downloadFile 合法域名**：如果后续使用 `uni.downloadFile` 做缓存
  - CDN 必须是 HTTPS
- 包体门禁：

```bash
npm run build:mp-weixin
npm run check:mp-size
```

默认限制：主包 2MB、整包 20MB。可用 `MP_PACKAGE_LIMIT_MB` / `MP_TOTAL_PACKAGE_LIMIT_MB` 覆盖。脚本会读取 `app.json` 的 `subPackages`，主包统计会自动排除分包目录。CI 已在 `Build MP-Weixin` 后执行该检查。

## App

- 与小程序一样，图鉴走 `VITE_ASSET_BASE`；构建时未配置会 warning。
- 键盘音效在 `src/typing-engine/sounds.ts` 中已按平台分派：H5 用 `Audio` 池，App/小程序用 `uni.createInnerAudioContext` 池。
- 后续可在 App 侧用 `uni.downloadFile` / `plus.io` 做图鉴与 TTS 本地缓存；当前先保证包体和加载路径正确。

## 新增资源时的检查清单

1. 小于约 300KB 且每个用户必用 → 放 `src/static/`。
2. 体积大或可按需加载 → 放 `assets/<name>/`，并确认：
   - H5 是否需要本地拷贝（扩展 `vite.config.ts` 的插件）
   - 小程序/App 的 CDN 路径是否通过 `VITE_ASSET_BASE` 可达
   - 是否需要在微信后台配置合法域名
3. 页面引用统一走 `assetUrl()` / `loadJsonAsset()`，不要直接拼平台路径。
4. 提交前运行 `npm run check:mp-size`（构建 mp-weixin 后）。
