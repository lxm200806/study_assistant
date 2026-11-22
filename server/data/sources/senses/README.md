# 全局词典（字母分片）

```text
senses/
  a.json
  b.json
  …
  z.json
  _.json   # 非 a–z 开头（若有）
```

日常通过 `loadGlobalSenses` / 校验脚本读写即可，不必手改多个文件。  
LLM 校验落盘只会重写变更过的字母分片。
