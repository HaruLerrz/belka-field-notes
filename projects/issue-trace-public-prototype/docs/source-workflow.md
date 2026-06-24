# Source Workflow

來源流程是這個原型的核心。它的目標是避免查證文章在證據薄弱、缺少來源或引用無法對應時，仍呈現出已完成查證的樣子。

## 1. Submitted Sources

投稿可以包含使用者提供的 URL 或來源線索。系統在使用前會先正規化：

```text
移除 tracking parameters
正規化 hostname
移除 URL fragments
去除等價 URL 重複
限制進入 prompt 的投稿來源數量
```

投稿來源很有價值，但不會自動被視為可信來源；它仍需要進入 source map 並接受後續檢查。

## 2. Query Planning

系統不直接把使用者原句丟進搜尋流程。AI query planner 會先把口語化 request 整理成多組搜尋 query，必要時保留原文作為 fallback。

這個步驟處理幾種情況：

```text
使用者用口語或反問句描述待查說法
投稿內容含有多個人物、組織或事件
待查對象是 URL、短網址或疑似假網站
來源提示是文字描述而非可點擊網址
```

query planner 的輸出會成為後續外部搜尋與來源補查的線索。

## 3. Search Sources

原型可以呼叫外部來源搜尋層。公開文件以通用流程描述外部搜尋服務，只保留 key pool 狀態分類與錯誤判斷的設計脈絡。

搜尋結果會被整理成：

```text
評分
去重
過濾 blocked domains
限制最大來源數
轉成 source-map entries
```

## 4. Source Normalization and Source Map

搜尋來源與投稿 URL 來源會進入來源正規化流程。

這個步驟會處理：

```text
追蹤參數
重複網址
低資訊標題
社群介面文字
tracker metadata
source type
publisher / host
published time
reliability note
```

Source map 會分配穩定 ID，例如：

```text
S01
S02
S03
```

每個 entry 可包含：

```text
title
url
publisher
source_type
published_at
reliability
note
origin
```

AI 草稿可以引用這些 ID，避免產生無法追蹤的來源。

## 5. AI Research Input

Prompt 只接收受控數量的來源。重要設計之一，是避免單一來源類別吃掉全部 prompt budget。

範例分配：

```text
投稿來源：最多 N 筆
搜尋來源：使用剩餘 slots
總 prompt sources：固定上限
```

這樣能避免使用者提供的資料完全排擠獨立搜尋結果。

## 6. Article Building

AI final writer 產生查證草稿後，系統會將草稿整理成可公開文章所需的資料：

```text
Markdown body
metadata
verdict
source references
主要引用來源
補充參考來源
原始 request 區塊
來源表
```

這個步驟由系統負責整理版面與來源區塊，降低 AI 自行輸出來源段落時造成的格式不穩。

## 7. Post-output Validation

系統會檢查草稿中引用的來源是否存在於已知 source map。

可能結果包含：

```text
所有引用來源皆可對應
部分引用來源可對應
找不到有效來源
來源數低於門檻
需要人工審核
```

## 8. Publication Threshold

草稿只有在通過來源與驗證規則時才可發布。

正式原型使用可調整的門檻；公開版只記錄概念，不公開完整 production settings。

## Example Data

請見 [source-map.sample.json](../examples/source-map.sample.json)。

## Navigation

* [返回專案首頁](../README.md)
* [查看 Architecture](architecture.md)
* [查看 Safety Boundaries](safety-boundaries.md)
* [查看 Version History](version-history.md)
* [返回 Projects Index](../../README.md)
* [返回根 README](../../../README.md)
