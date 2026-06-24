# Safety Boundaries

本頁說明 Issue Trace 在公開投稿、query planning、來源整理、AI 查證草稿與發布判斷之間設定的產品邊界。重點放在「哪些資料可以進入下一階段」與「哪些結果需要人工檢查」，不展開正式站的維運設定。

## Boundary Layers

```text
公開投稿
        ↓
AI query planning
        ↓
來源整理與 source map
        ↓
AI final writer
        ↓
文章整理
        ↓
來源驗證
        ↓
發布判斷
        ↓
人工審核
```

每一層都有自己的任務。公開投稿負責收件，query planning 負責把口語問題轉成搜尋線索，來源整理負責建立可追蹤材料，final writer 負責產生草稿，文章整理負責輸出 Markdown 與來源區塊，來源驗證負責確認引用能否回到已知來源，發布判斷負責決定是否公開。

## Public Input Boundary

公開投稿定位為待查 request。

使用者輸入的標題、說法、補充說明與參考連結，會成為系統開始搜尋與整理的線索。這些內容不直接形成查證結論，也不直接取得可信來源地位。

這層邊界的目的，是避免單一投稿者用強烈語氣、錯誤描述或偏誤材料決定最後文章方向。

## Query Planning Boundary

query planner 的任務是整理待查問題與產生搜尋 query。

它可以把口語化 request 轉成較適合搜尋的問題組合，也可以在規劃失敗時退回 request 原文作為 fallback。它不負責產生結論，也不負責判定真偽。

## Source Boundary

來源流程會處理搜尋、去重、正規化與 source map。詳細步驟放在 [Source Workflow](source-workflow.md)。

本頁只保留來源邊界的原則：

* 來源需要能被追蹤。
* 引用需要能回到 source map。
* 主要引用來源與補充參考來源分開呈現。
* 來源不足或引用無法對應時，結果進入人工檢查。

## AI Draft Boundary

AI final writer 輸出定位為查證草稿。

草稿需要接受文章整理、來源驗證與發布判斷。若草稿看起來完整，但引用來源不足、來源代號錯誤、來源彼此衝突，系統仍應保留人工檢查狀態。

這層邊界讓 AI 可以協助整理與表述，同時避免把模型輸出直接當成查證結果。

## Article Boundary

Article builder 負責將 AI 草稿、metadata、source references、原始 request 與來源表整理成公開頁面可用的 Markdown 結構。

這個步驟讓文章呈現由系統控制，避免公開頁面完全依賴 AI 自行輸出的來源段落或格式。

## Publication Boundary

發布判斷會綜合來源條件、引用對應、verdict、blockers 與人工檢查旗標。

一篇文章要進入公開頁面，需要同時滿足內容完整性與來源可追蹤性。系統在這裡處理：

* 自動發布。
* 留在草稿。
* 需要人工檢查。
* 來源不足。
* 來源驗證失敗。

## Resource Boundary

這個原型會呼叫外部搜尋服務與 AI 平台服務，因此需要控制自動流程的使用量。

公開文件只記錄設計方向：

* 自動查證上限。
* cooldown。
* mock flow。
* key pool 狀態分類。
* timeout 後保留已取得材料。

這些設計讓公開收件流程不會因單一錯誤、重複投稿或外部服務不穩而持續消耗資源。

## Human Review Boundary

人工審核是這類系統的必要層級。

當來源不足、來源互相衝突、AI 輸出不穩、外部服務 timeout，或 verdict 不適合自動發布時，系統會保留草稿、log 與來源整理結果，讓後台使用者決定是否補查、重跑或發布。

## Public Repo Boundary

公開 repo 呈現系統架構、流程設計、版本脈絡、範例資料與安全化程式片段。完整應用程式、營運設定、資料與私有 prompt 保留在私有環境。

## Relation to Source Workflow

[Source Workflow](source-workflow.md) 說明來源如何被收集、整理、正規化、建立 source map、送入 final writer，並在輸出後接受驗證。  
本頁說明每一階段的進出條件，以及哪些情況會讓結果停在草稿或人工檢查。

## Navigation

* [返回專案首頁](../README.md)
* [查看 Architecture](architecture.md)
* [查看 Source Workflow](source-workflow.md)
* [查看 Version History](version-history.md)
* [返回 Projects Index](../../README.md)
* [返回根 README](../../../README.md)
