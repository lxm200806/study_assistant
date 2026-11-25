# 安全与合规清单

## 已实现

- JWT access/refresh 分离密钥；生产环境强制 32+ 位 secret。
- 设备会话 `AuthSession`：登录创建、refresh 轮换、logout 撤销单设备、logout-all 提升 `tokenVersion` 撤销全部。
- 密码 bcrypt 哈希；注册密码至少 8 位。
- 账号导出 `GET /api/auth/account/export` 与注销 `POST /api/auth/account/delete`。
- CORS 白名单、安全响应头、生产 HSTS、登录/注册/聊天/TTS/ASR 限流。
- 管理端写操作审计 `admin_audit_logs`，通过 `GET /api/admin/audit` 查询。
- 请求参数 zod 校验；5xx 不返回内部细节。
- Dependabot 每周检查 npm 依赖和 GitHub Actions。

## 待办 / 风险

- `GET /api/tts` 仍是公开接口（有分钟/小时限流），存在被刷成本的风险；后续改为签名 URL 或鉴权。
- CSP 尚未启用；H5 大量内联样式，需要先在测试环境验证 report-only。
- 管理员 2FA 未实现；建议对 `isAdmin` 账号强制 TOTP。
- 账号注销目前是 API，前端入口和二次确认仍需产品确认。
- App 上架前需补：隐私政策、用户协议、ICP备案、软著、儿童个人信息保护、应用商店权限声明。
- 生产日志保留由 Docker `json-file` 10MB × 3 控制；如需长期审计，接入集中日志。
- 备份/恢复流程见 `deploy/README.md`，上线前需要实际演练。
