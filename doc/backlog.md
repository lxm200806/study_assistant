# 执行清单

按大模块推进；每完成一个模块更新状态并提交。需要外部账号、付费服务或产品决策的条目标记为 `BLOCKED`，不阻塞可执行模块。

| 模块 | 范围 | 状态 |
| --- | --- | --- |
| M1 | 接口契约：auth/家庭、词汇、词书剩余接口 + 对应测试 | DONE |
| M2a | 接口契约：拼读标记/历史/会话、短文 CRUD + 对应测试 | DONE |
| M2b | 接口契约：语文课程/资源/草稿、admin、speech/TTS | DONE |
| M3 | 错误信封统一、`/api/v1` 别名、幂等键（单实例） | DONE |
| M4 | 异常链路集成测试：401/403/404/409、recheck、admin/speech/tts 边界 | DONE |
| M5 | 前端 Vitest：stores、纯逻辑（7 个文件 / 17 个测试） | DONE |
| M6a | Playwright：quiz + PC 侧栏、真实 API+DB E2E | DONE |
| M6b | Playwright：recognition / 语文 drill 页面冒烟 | DONE |
| M7 | 安全：refresh token 轮换/撤销、设备会话、logout/logout-all | DONE |
| M8a | 安全：管理审计、账号导出/注销、密码策略、HSTS、Dependabot、合规清单 | DONE |
| M8b | 安全：TTS token 鉴权、CSP Report-Only、gitleaks + npm audit CI | DONE |
| M8c | 安全残余：管理员 TOTP 2FA | TODO |
| M9a | 可观测/运维：Metrics、外部超时、优雅退出、Web healthcheck、备份/告警、request id | DONE |
| M9b | 可观测残余：Sentry/APM（需 DSN/账号） | BLOCKED |
| M10a | 性能/扩展：内容同步 CLI、多实例扩展文档 | DONE |
| M10b | 性能/扩展残余：Redis、对象存储、图谱 SQL、缓存、包体积 | BLOCKED |
| M11a | 前端体验：小程序分块流式、全局错误处理、清理空目录/历史文档/未用依赖 | DONE |
| M11b | 前端重构残余：typing 逻辑、course/typing service、加载/空态统一 | TODO |
| M12 | App/商业化：app-plus、原生音频、推送、支付/IAP、会员、商店合规、埋点 | BLOCKED（需产品/账号决策） |

## 阻塞说明

- M10 的 Redis、对象存储、CDN 需要部署资源；先做可选适配与文档，不实际接入生产。
- M12 的支付、推送、App 上架、隐私合规需要商户号、证书、产品定价与应用商店账号。
