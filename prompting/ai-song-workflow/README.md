# AI Song Workflow

本頁整理我自 2025 年起持續調整的 AI 歌曲創作工作流。系統同時處理歌詞、日文假名轉寫、中文逐行解釋、標題建議與 Suno music prompt，並透過控制器決定任務分流、參數收集與輸出順序。

## Project Scope

這套工作流主要處理：

* 日文、英文與混合語言歌詞
* 日文漢字轉假名
* 中文逐行解釋
* 歌曲標題建議
* Suno music prompt
* 純音樂結構
* 曲風、BPM、配器、情緒與長度控制
* 生成前規格確認
* 歌詞與 music prompt 分階段輸出

## Development Lineage

```text
2025-04-13
入口控制器 + 歌詞模組 + Suno prompt 模組
        ↓
2025-10-10
加入歌曲長度、密度、數字可唱性、BPM 與反樣板規則
        ↓
2026-01-02
改寫為 YAML 工作流，加入分批詢問、規格摘要、GO 閘門與模板選擇
```

## Version History

| 日期 | 版本 | 主要內容 |
|---|---|---|
| 2025-04-13 | Multi-Modular Tone Composer v1.1 | 建立入口控制器、Lyrics Tone Translator v2.0 與 Tone Sound Translator v3.1.3-lite |
| 2025-10-10 | Controller v1.2 / Lyrics v2.1 / Tone v3.2.1 | 加入歌曲長度、密度、數字可唱性、BPM、正面描述、Open Registry 與 Anti-Template Bias |
| 2026-01-02 | Multi-Gen Song Builder v1.1-yaml | 改寫為 YAML，加入 intake、分批詢問、規格確認、GO 閘門、模板選擇與兩階段輸出 |

## 2025-04-13

第一版將任務拆成三層：

1. **Entry Controller**：辨識使用者要寫歌詞或建立 Suno prompt。
2. **Lyrics Tone Translator v2.0**：產生歌詞、片假名轉寫、中文翻譯與標題。
3. **Tone Sound Translator v3.1.3-lite**：將情緒與畫面壓縮成 180 字元內的英文 music prompt。

這一版已具備：

* 明確任務分流
* 日文、英文與混合語言
* 固定四段輸出
* 段落標籤與行數規則
* 漢字轉片假名
* 參考風格轉描述詞
* Suno prompt 長度限制
* 抽象意象轉換為音色與節奏語彙

## 2025-10-10

第二版增加可調整參數與輸出限制：

* 預設歌曲長度 3:10～3:30
* `density_mode`
* `numeral_singability`
* 第二段 Chorus 後的 Interlude 規則
* Suno prompt 固定 150～180 字元
* Genre → BPM/Groove → Key Instruments → Mood/Texture → Mix/Space
* positive-only 描述
* 預設不標註人聲性別
* Open Registry
* Anti-Template Bias
* 相鄰輸出避免重複相同四連詞

此版本將歌曲長度、歌詞密度、可唱性與 prompt 結構納入控制。

## 2026-01-02

第三版改寫為 YAML 工作流，並加入更完整的互動控制：

* 每回合最多詢問三題
* 核心欄位缺少時分包補問
* 先輸出規格摘要
* 收到 GO 指令後才開始生成
* 歌詞與 Suno prompt 分成 Step A／Step B
* short、standard、rap 與 instrumental 模板
* 中文、日文、英文、混合、歐洲語言與純音樂
* 偶數行規則
* 日文假名預設改為平假名
* 純音樂使用配器與畫面意象輸出
* BPM、長度、密度、人聲與限制條件可覆寫

這一版將早期模組轉成具有 intake、confirm、planning、language guides 與 outputs 的工作流配置。

## Structural Notes

三代版本都保留「控制器」與「任務模組」的分工：

```text
使用者輸入
    ↓
意圖與參數判斷
    ↓
歌詞模組或 Suno prompt 模組
    ↓
格式檢查
    ↓
輸出
```

2026 版再加入規格確認與 GO 閘門，使生成前的條件更明確。

## Known Limitations

* 早期版本的片假名轉寫規則容易產生不自然讀音，需要人工檢查。
* 固定段落與行數規則有助於格式一致，也可能限制特定曲風。
* Suno prompt 的字元限制與模型解析方式可能隨平台更新。
* 參考創作者風格轉成描述詞時，仍需檢查輸出是否過度接近特定作品。
* 歌詞、假名與中文解釋的逐行對齊需要人工校對。
* YAML 版本的規則較完整，實際對話仍可能因模型遵循度產生偏差。

## Version Snapshots

以下檔案保留各階段的主要結構與規則；部分範例、重複說明與語彙內容經整理後省略。

* [2025-04-13｜Multi-Modular Tone Composer v1.1](versions/2025-04-13-v1.1.md)
* [2025-10-10｜Multi-Modular Tone Composer v1.2](versions/2025-10-10-v1.2.md)
* [2026-01-02｜Multi-Gen Song Builder v1.1-yaml](versions/2026-01-02-v1.1-yaml.yaml)

## Navigation

* [返回 Prompting / Structured Writing](../README.md)
* [返回 Selected Works](../../profile/works.md)
* [返回根 README](../../README.md)
