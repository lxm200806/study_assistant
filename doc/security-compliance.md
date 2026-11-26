# 安全与合规清单

## 已实现

- JWT access/refresh 分离密钥；生产环境强制 32+ 位 secret。
- 设备会话 `AuthSession`：登录创建、refresh 轮换、logout 撤销单设备、logout-all 提升 `tokenVersion` 撤销全部。
- 密码 bcrypt 哈希；注册密码至少 8 位。
- 登录后可修改密码 `POST /api/auth/password`；修改后提升 `tokenVersion` 并撤销所有设备会话，强制重新登录。
- 账号导出 `GET /api/auth/account/export` 与注销 `POST /api/auth/account/delete`。
- CORS 白名单、安全响应头、生产 HSTS、登录/注册/聊天/TTS/ASR 限流。
- `/api/tts` 需要 access token（支持 `?token=`，因为音频元素不能设置 Authorization 头）。
- 管理端写操作审计 `admin_audit_logs`，通过 `GET /api/admin/audit` 查询。
- 生产环境默认禁用 mock 支付：未配置真实 `PAYMENT_PROVIDER` 时会员下单/支付返回 503；仅在生产演示时可显式设置 `ALLOW_MOCK_PAYMENT=true`。
- 请求参数 zod 校验；5xx 不返回内部细节。
- Dependabot 每周检查 npm 依赖和 GitHub Actions。
- `Security` CI 工作流运行 gitleaks 和 `npm audit --omit=dev --audit-level=critical`。
- Nginx 已配置 CSP Report-Only，观察后再切换强制 CSP。
- 设置 `SENTRY_DSN` 后 5xx 自动上报 Sentry/APM。

## 待办 / 风险

- 管理员 TOTP 2FA 已实现（管理页绑定/关闭，登录需 6 位验证码）；密钥目前明文存于 `User.twoFactorSecret`，数据库泄露时风险较高，后续可改为 KMS/环境密钥加密。
- zod 3 存在 high 级内存耗尽公告，升级 zod 4 + zod-to-openapi 9 属于 major，需要单独验证。
- 忘记密码/重置密码需要邮箱或短信基础设施，当前只支持登录后修改密码。
- App 上架前需补：隐私政策、用户协议、ICP备案、软著、儿童个人信息保护、应用商店权限声明。
- 生产日志保留由 Docker `json-file` 10MB × 3 控制；如需长期审计，接入集中日志。
- 备份/恢复流程见 `deploy/README.md`，上线前需要实际演练。
