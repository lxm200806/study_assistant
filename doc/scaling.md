# 多实例与扩展说明

默认仍是**单 API 实例 + 进程内回退**；配置 `REDIS_URL` 后限流和幂等键自动改用 Redis，配置 `OBJECT_STORAGE_DRIVER`/`OBJECT_STORAGE_DIR` 后使用对应对象存储适配器。

| 状态 | 位置 | 多实例方案 |
| --- | --- | --- |
| 限流桶 | `server/src/middleware/rate-limit.ts` → `kv.service.ts` | 已支持 Redis；未配置时退回内存 |
| 幂等键缓存 | `server/src/middleware/idempotency.ts` → `kv.service.ts` | 已支持 Redis，TTL 10 分钟 |
| ASR 会话 | `server/src/services/asr-session.service.ts` | 仍需粘性会话；Redis 只适合放元数据 |
| SSE 连接 | `/api/chat/stream` | 负载均衡需支持长连接；避免无状态轮询 |
| TTS 缓存 | `server/data/tts-cache` | 已提供本地/内存对象存储适配器；生产可接 S3/OSS |
| 对象存储 | `server/src/services/object-storage.service.ts` | `local` 默认；`memory` 仅测试；S3/OSS 实现同一接口 |
| 图书列表缓存 | `server/src/services/book.service.ts` | 60 秒 TTL；多实例各自缓存，可接受 |
| 内容启动同步 | `server/src/bootstrap.ts` | 独立 job：`cd server && npm run content:sync` |
| 迁移 | API 启动时 `prisma migrate deploy` | 独立迁移 job，避免并发迁移 |

## 建议顺序

1. 先拆 API 与迁移/内容同步 job。
2. 配置 `REDIS_URL`，已完成的限流/幂等会自动共享。
3. ASR/SSE 保持单实例或使用粘性会话，再考虑多实例。
4. 生产对象存储实现 S3/OSS 适配器，TTS 缓存与静态资源走 CDN。
5. 数据库先加只读副本/连接池，再评估分库分表。

## 当前瓶颈

- 图谱统计在应用内存聚合；当前数据量可接受，出现慢查询后再改 SQL 聚合/物化视图。
- `GET /api/tts` 会实时合成并落盘；生产建议实现 S3/OSS 适配器并预热。
- LLM/TTS/ASR 的外部配额通常比 Express 进程更早成为瓶颈。
- 包体积暂未做专项拆分；以 `build:h5` 产物体积和首屏指标为准再拆 vendor chunk。
