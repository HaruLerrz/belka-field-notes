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

## 2. Search Sources

原型可以呼叫外部來源搜尋層。公開文件以通用流程描述外部搜尋服務，只保留 key pool 狀態分類與錯誤判斷的設計脈絡。

搜尋結果會被整理成：

```text
評分
去重
過濾 blocked domains
限制最大來源數
轉成 source-map entries
```

## 3. Source Map

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

## 4. AI Research Input

Prompt 只接收受控數量的來源。重要設計之一，是避免單一來源類別吃掉全部 prompt budget。

範例分配：

```text
投稿來源：最多 N 筆
搜尋來源：使用剩餘 slots
總 prompt sources：固定上限
```

這樣能避免使用者提供的資料完全排擠獨立搜尋結果。

## 5. Post-output Validation

AI 回傳草稿後，系統會檢查草稿中引用的來源是否存在於已知 source map。

可能結果包含：

```text
所有引用來源皆可對應
部分引用來源可對應
找不到有效來源
來源數低於門檻
需要人工審核
```

## 6. Publication Threshold

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
