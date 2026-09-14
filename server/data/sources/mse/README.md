# 剑桥通用英语（MSE）词书

书号、源文件、成品 JSON 同一套名字。

| 书号 | 级别 | 官方来源 | 成品 |
| --- | --- | --- | --- |
| `mse-ket` | A2 | [A2 Key Vocabulary List (August 2025)](https://www.cambridgeenglish.org/images/506886-a2-key-2020-vocabulary-list.pdf) | `books/mse-ket.json` |
| `mse-pet` | B1 | [B1 Preliminary Vocabulary List (August 2025)](https://www.cambridgeenglish.org/Images/506887-b1-preliminary-vocabulary-list.pdf) | `books/mse-pet.json` |

只收官方词目和 Appendix 主题词/词集，不收例句里的跑动词。

成品词条字段与 KEW 相同：中文意思、音标、英文释义、例句。释义表在 `mse-ket-glosses.json` / `mse-pet-glosses.json`。

## 重建

在 `server/` 下：

1. 官网 PDF 放到 `tmp/mse/a2-key-2025.pdf`、`tmp/mse/b1-preliminary-2025.pdf`
2. `python scripts/vocabulary-import/extract-mse-pdf.py`
3. `npm run build:mse:fast`（或 `build:mse` 走网络补释义）
4. 改 glosses 后 `npm run polish:mse`
5. `bash ../scripts/sync-vocabulary.sh` 后重启后端

## 没有官方词表的级别

剑桥 FAQ 写明：**B2 First / C1 Advanced / C2 Proficiency（FCE / CAE / CPE）不出版固定词表**。  
教师手册里也没有可抽的主题词清单。这三本不能从官网 PDF 编造，因此未建 `mse-fce` / `mse-cae` / `mse-cpe`。
