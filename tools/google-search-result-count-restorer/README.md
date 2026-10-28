# Google Search Result Count Restorer

一支 Firefox／Tampermonkey Userscript，將 Google 放進「工具」選單的搜尋結果預估數量，恢復顯示在主要搜尋結果上方。

目前版本為 `v1.7.0`，已於 Firefox 的 Google 繁體中文搜尋頁面完成多輪實測。工具以 Google 頁面現有的搜尋結果數量為資料來源，並依頁面結構調整顯示位置與選單間距。

## Purpose

Google 搜尋結果數量移到「工具」選單後，查看預估數量需要額外展開選單。我希望在一般搜尋頁面直接看到這項資訊，因此把重複操作整理成可自動執行的 Userscript。

## Files

* [`google-search-result-count-restorer.user.js`](google-search-result-count-restorer.user.js)：目前實測版本 `v1.7.0`。

## Installation

1. 在 Firefox 安裝並啟用 Tampermonkey。
2. 建立新的 Userscript，貼入本專案 `.user.js` 的完整內容。
3. 儲存後開啟 Google 搜尋結果頁面，確認結果數量出現在主要搜尋結果上方。

若曾安裝同一工具的舊版本，請確認 Tampermonkey 中只有一份腳本處於啟用狀態。

## How It Works

* 從 Google 頁面既有的 `#result-stats` 讀取搜尋結果預估數量。
* 將擷取的文字插入主要搜尋結果上方，並隱藏工具選單中的原生數字，避免重複顯示。
* 以 `#rso`、`#center_col` 或 `#search` 尋找適合的插入位置。
* 根據數字與搜尋導覽列的實際距離，調整有無 AI 摘要時的上方間距。
* 透過 `MutationObserver` 與延遲掃描，處理搜尋頁面動態更新。
* 如果當下沒有取得數量，腳本可能自動展開一次「工具」選單以載入資料，再依可辨識的展開狀態嘗試收起。
* 以 `#result-stats` 周邊的 DOM 鄰接結構定位空白分隔元素，調整其 `margin` 與 `border-top`，消除原生選單殘留的空白及水平線。

程式只針對帶有 `q` 參數的 `/search` 頁面運作；排除 `tbm`，`udm` 僅接受空值或 `14`。Tampermonkey 的 `@match` 範圍為 `www.google.com` 與 `www.google.com.tw` 的搜尋頁面。

## Development Notes

這個工具經過多輪實際搜尋頁面測試與調整：

1. 初版確認 `#result-stats` 仍包含 Google 提供的預估數量，將它搬回主要搜尋區。
2. 測試後修正工具選單內重複顯示的數字，以及數字與搜尋結果之間的距離。
3. 比較有無 AI 摘要的版面，調整兩種情況下的顯示位置。
4. 工具選單仍留下水平線與空白。幾次依推測修改 CSS 後問題依然存在，改用 Firefox DevTools 直接檢查元素。
5. 沿 `#result-stats` 的 DOM 階層找到相鄰空白分隔元素；在檢測器取消其 `margin: 8px 0` 與 `border-top: 1px solid ...` 後，確認版面符合預期。
6. v1.7 將這項修正改寫為依 DOM 鄰接關係定位，避免依賴 Google 當時的混淆 class 名稱。

需求、版面判斷與 Firefox 實測由我進行；AI 協助撰寫腳本、分析測試結果與整理修改方向。這段過程也成為 [Digital Workflow Prototyping](../../case-notes/digital-workflow-prototyping.md) 的案例之一。

## Validation

2026-10-28，在 Firefox／Tampermonkey 與 Google 繁體中文搜尋介面完成 v1.7 實測，確認：

* 一般搜尋頁面可顯示 Google 提供的結果數量。
* 有 AI 摘要與一般搜尋版面，顯示位置均符合當次測試需求。
* 工具選單內原生數字不再重複出現。
* 原生分隔線與多餘空白已修正。

實測結果來自該次使用環境；這次收錄僅對程式進行靜態檢查與文件整理。

## Known Limitations

* Google 的 `#result-stats`、選單及搜尋欄位 DOM 結構若改版，可能需要更新 selector 或定位邏輯。
* 版面校正使用 `margin-top: -24px` 與 `-31px`；其他版型、縮放比例或 Google A/B 介面可能需要重新調整。
* 自動展開「工具」選單後，能否收起取決於當時可辨識的 `aria-expanded` 狀態。
* 其他瀏覽器、介面語系、搜尋類型及長時間使用情境尚未完整測試。
* 搜尋結果數量為 Google 提供的估計值，可能隨查詢與時間改變。

## Privacy and Maintenance

腳本在目前的 Google 搜尋頁面讀取 DOM 並調整顯示；程式未建立額外的網路請求。原始碼使用 `@grant none`，可直接檢查所做的頁面操作。

目前沿用 [Belka Field Notes 的授權說明](../../README.md#reuse)。

## Navigation

* [返回 Tools Index](../)
* [返回 Digital Workflow Prototyping](../../case-notes/digital-workflow-prototyping.md)
* [返回 Selected Works](../../profile/works.md)
* [返回根 README](../../README.md)
