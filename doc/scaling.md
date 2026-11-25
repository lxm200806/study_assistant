# 多实例与扩展说明

当前部署按**单 API 实例**设计。以下状态在进程内存中，横向扩容前需要替换：

| 状态 | 位置 | 多实例方案 |
| --- | --- | --- |
| 限流桶 | `server/src/middleware/rate-limit.ts` | Redis / API Gateway |
| ASR 会话 | `server/src/services/asr-session.service.ts` | Redis + 粘性会话 |
| SSE 连接 | `/api/chat/stream` | 负载均衡需支持长连接；避免无状态轮询 |
| 幂等键缓存 | `server/src/middleware/idempotency.ts` | Redis，TTL 10 分钟 |
| TTS 缓存 | `server/data/tts-cache` | 对象存储 + CDN |
| 内容启动同步 | `server/src/bootstrap.ts` | 独立 job：`cd server && npm run content:sync` |
| 迁移 | API 启动时 `prisma migrate deploy` | 独立迁移 job，避免并发迁移 |

## 建议顺序

1. 先拆 API 与迁移/内容同步 job。
2. 把限流和幂等键迁到 Redis。
3. ASR/SSE 保持单实例或使用粘性会话，再考虑多实例。
4. TTS 缓存迁到对象存储，静态资源走 CDN。
5. 数据库先加只读副本/连接池，再评估分库分表。

## 当前瓶颈

- 图谱统计在应用内存聚合；数据量增大后应改为 SQL 聚合或物化视图。
- `GET /api/tts` 会实时合成并落盘；需要对象存储与缓存预热。
- LLM/TTS/ASR 的外部配额通常比 Express 进程更早成为瓶颈。
