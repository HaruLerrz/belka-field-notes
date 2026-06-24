# Architecture

議題溯源追蹤器公開原型是一套 request-driven 的公共議題查證系統。它將一則待查說法拆成投稿、query planning、來源蒐集、source map、AI 草稿、文章整理、來源驗證與人工審核流程。

## Component Responsibilities

```text
公開投稿
  接收標題、待查說法、補充說明與投稿 URL。

Request store
  保存投稿狀態、可見性與佇列狀態。

AI query planner
  將使用者的口語 request 整理成可搜尋 query，必要時保留原文作為 fallback。

投稿 URL 正規化
  清理使用者提供的 URL，保留可用來源線索。

來源搜尋
  依 query 與投稿 URL 搜尋相關公開來源。

來源正規化
  清理追蹤參數、UI 雜訊、重複來源與低資訊內容。

Source map
  對來源去重，分配穩定來源 ID，保存完整 URL 與來源 metadata。

AI final writer
  接收受控來源集合，產生結構化查證草稿。

Article builder
  將查證草稿整理成 Markdown、metadata、source references 與公開頁面可用內容。

來源驗證
  檢查草稿引用的來源是否能回到投稿或搜尋取得的來源。

發布判斷
  依來源數量、驗證狀態、verdict 與 review flags 決定輸出狀態。

後台審核
  讓人工檢查草稿、log、來源、發布狀態與必要的重新調查。
```

## Pipeline View

```text
request
        ↓
query planning / claim normalization
        ↓
source discovery
        ↓
source normalization / source map
        ↓
final AI draft
        ↓
Markdown / metadata / source references
        ↓
source validation / publication decision
```

## State Flow

```text
received
        ↓
queued
        ↓
planning
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
| 搜尋 query | Query planner |
| 投稿 URL | Request record 與 source map |
| 搜尋結果 | Source discovery layer |
| Source map | Source normalization layer |
| AI 草稿 | Research layer |
| Markdown 文章與 metadata | Article builder |
| 已驗證來源 | Source validation layer |
| 發布狀態 | Publication decision layer |
| 人工修改 | Admin review layer |

## AI Boundary

AI 在這個原型裡分成兩個角色：

* query planner：整理口語 request，產生搜尋 query。
* final writer：依受控來源集合產生查證草稿。

這兩個角色都不被當成事實來源。系統仍需要 source map、驗證規則、文章整理與發布門檻，避免草稿在來源不足時直接變成公開內容。

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
