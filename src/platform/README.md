# src/platform

跨端适配层。页面和 composable 不应直接依赖 `fetch`、`MediaRecorder`、Web Audio、
`window` 或 `uni.getSystemInfoSync`，统一从这里取能力。

| 文件 | 职责 |
| --- | --- |
| `runtime.ts` | H5 / mp-weixin / app 运行时判断 |
| `storage.ts` | uni 同步存储 + token 读取/写入/删除 |
| `audio.ts` | 录音后端选择、H5 Web Audio 转换、麦克风错误映射 |
| `stream.ts` | 聊天 SSE（H5 fetch）/ 非 H5 普通请求降级 |

## 约束

1. 平台判断集中到 `runtime.ts`，页面不写 `#ifdef`。
2. 新增平台能力时，先在本目录加适配器，再让页面调用。
3. `src/utils/audio-recording.ts` 和 `src/utils/chat-stream.ts` 只保留兼容 re-export。
4. 小程序如果要做真正的流式聊天，在 `stream.ts` 补 `uni.request` 的 `enableChunked`
   实现，保持 `streamChatMessage` 签名不变。
