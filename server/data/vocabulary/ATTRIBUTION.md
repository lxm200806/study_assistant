# 词库外部内容署名

## Word Atlas（词光）

本仓库通过 `npm run enrich:atlas` 从词光开源词库回填：

- 进阶例句（`examples[].role = exam`）
- 主题（`topic` / `topics`）
- CEFR（`cefr`）

数据授权：**CC BY 4.0**  
署名：**Word Atlas contributors — CC BY 4.0**  
授权说明：https://creativecommons.org/licenses/by/4.0/  
来源仓库：本地 `word-atlas`（与 `study_assistant` 同级）或 `WORD_ATLAS_PATH`

插画缩略图已入库：`src/static/atlas/thumb/` + `word-to-id.json`（约 84MB，clone 即可用）。  
词光的大图 `img/`、预录音频 `audio/`、界面音效 `sfx/` 当前未引入——发音走本项目 TTS。

**不覆盖** KEW / 已 polish 词书中的中文释义、音标、英文释义与简单句（`basic`）。

词条 `tags` 含 `src:atlas=CC-BY-4.0` 表示该词使用了词光字段。
