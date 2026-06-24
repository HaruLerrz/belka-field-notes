# Architecture

議題溯源追蹤器公開原型是一套 request-driven 的公共議題查證系統。它將一則待查說法拆成投稿、來源蒐集、AI 草稿、來源驗證與人工審核流程。

## Component Responsibilities

```text
公開投稿
  接收標題、待查說法、補充說明與投稿 URL。

Request store
  保存投稿狀態、可見性與佇列狀態。

來源搜尋
  正規化投稿 URL，並搜尋相關公開來源。

Source map
  對來源去重，並分配穩定來源 ID。

AI 查證草稿
  接收受限的來源集合，產生結構化分析草稿。

來源驗證
  檢查草稿引用的來源是否能回到投稿或搜尋取得的來源。

發布判斷
  依來源數量、驗證狀態、verdict 與 review flags 決定輸出狀態。

後台審核
  讓人工檢查草稿、log、來源與發布狀態。
```

## State Flow

```text
received
        ↓
queued
        ↓
researching
        ↓
draft
        ↓
published / needs_review / insufficient_sources
```

公開版只保留概念模型，正式站的實際狀態名稱與內部資料表不在公開範圍內。

## Data Ownership

| 資料 | 負責層 |
|---|---|
| 使用者投稿的待查說法 | Request record |
| 投稿 URL | Request record 與 source map |
| 搜尋結果 | Source discovery layer |
| AI 草稿 | Research layer |
| 已驗證來源 | Source validation layer |
| 發布狀態 | Publication decision layer |
| 人工修改 | Admin review layer |

## AI Boundary

AI 步驟只負責草稿與綜整，不被當成事實來源。系統仍需要 source map、驗證規則與發布門檻，避免草稿在來源不足時直接變成公開內容。

## Shared-hosting Constraints

原始原型以共享主機上的 Node.js 環境為部署條件，因此設計上偏向：

* 單純的 Node.js / Express process 結構
* 檔案式 content snapshots
* SQLite-compatible storage
* 可重啟的狀態保存
* 程式、持久資料、上傳素材與環境設定分離

## Navigation

* [返回專案首頁](../README.md)
* [查看 Source Workflow](source-workflow.md)
* [查看 Safety Boundaries](safety-boundaries.md)
* [查看 Version History](version-history.md)
* [返回 Projects Index](../../README.md)
* [返回根 README](../../../README.md)
