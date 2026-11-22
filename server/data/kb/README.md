# 个人课本知识库（kb）

从本机人教 PEP / 精通电子课本 PDF 文字层整理的 Markdown。**仅供个人学习，勿提交、勿传播完整教材文本。**

## 目录

- `md/` — 同步自本机整理库（gitignore）。结构：

```
md/
  人教版-PEP/<册别>/unit-XX-....md
  人教版-精通/<册别>/unit-XX-....md
```

## 同步

```bash
# 推荐：从 downloads/*.pdf 重抽 md，再导入词书/文章
npm run kb:rebuild

# 或分步
npm run kb:extract   # PDF → md/
npm run kb:import    # md → units / textbook.local / primary

# 仅从外部 md 目录拷入（可选）
npm run kb:sync -- --from /Users/lxm/Documents/CCTest/data/kb/md
```

- `downloads/`：原始 PDF（gitignore）
- `md/`：抽取结果（gitignore）
- 新教材三上～五上词表仍保留速声来源，只叠加原文；其余册次词表以 PDF 书末附录为准
- 扫描版无文字层（如 PEP 四下 2026 春）会跳过
