# Threads Follow Guard

一支 Firefox／Tampermonkey Userscript，用來降低瀏覽 Threads 動態河道時誤觸「追蹤」按鈕的機會。預設需要在指定時間內再次點擊同一個按鈕確認，也可切換為隱藏追蹤控制或停用保護。

目前版本為 `v0.2.0`。使用者已在 Threads 實際操作並回報目前未發現問題；本次收錄保留當時使用的完整原始碼。

## Purpose

Threads 動態河道的追蹤按鈕容易在滑動、閱讀或切換操作時誤觸。這項工具為追蹤操作增加第二次確認，保留 Threads 原本的操作介面。

## Files

* [`threads-follow-guard.user.js`](threads-follow-guard.user.js)：目前使用的 v0.2.0 Userscript。

## Installation

1. 在 Firefox 安裝並啟用 Tampermonkey。
2. 新增 Userscript，貼入 `threads-follow-guard.user.js` 的完整內容並儲存。
3. 開啟 Threads。預設使用二次點擊確認模式，可從 Tampermonkey 腳本選單切換模式。

腳本設定的網址包含 `threads.com`、`www.threads.com`、`threads.net` 與 `www.threads.net`。本次實際使用回報主要來自 Firefox／Threads，未逐一確認所有網址與介面變體。

## Modes and Controls

### 二次點擊確認（預設）

* 第一次點擊「追蹤」：攔截操作，在該按鈕顯示橘色外框，並於頁面底部顯示確認提示。
* 再次點擊同一按鈕：兩次操作需至少相隔 0.5 秒，確認提示於 8 秒後逾時。
* 第二次符合條件的實體點擊交由 Threads 原本的事件處理流程執行。
* 按 Esc、點擊其他位置，或等候提示逾時，可取消這次確認。

腳本也處理 Enter／Space 鍵觸發的追蹤操作，並在確認流程中檢查事件的 `isTrusted` 狀態。

### 隱藏追蹤控制

將可辨識的追蹤與已追蹤／取消追蹤按鈕隱藏，並監看頁面 DOM 變化以更新對應元素。

### 停用保護

放行 Threads 原本的操作。三種模式透過 Tampermonkey 選單切換，設定由 `GM_setValue` 儲存；因此選擇「暫時停用保護」後，重新整理頁面仍會維持該模式，直到再次切換。

在預設確認模式下，取消追蹤操作保留 Threads 原生的確認流程。

## How It Works

腳本透過 capture 階段的 `pointerdown`、`mousedown`、`click` 與鍵盤事件監聽，在追蹤動作到達網站自身的事件處理器之前判斷是否攔截。

使用 `button`、`role="button"`、`role="menuitem"` 等控制元素與其文字／無障礙標籤辨識操作。第一次追蹤會暫存按鈕參照及確認時間；第二次操作必須符合相同目標與時間條件，才交回瀏覽器與 Threads 處理。

隱藏模式以 DOM 屬性及 CSS 控制可辨識的按鈕，使用 `MutationObserver` 及 `requestAnimationFrame` 因應動態載入。確認提示由帶有 Shadow DOM 的頁面元素呈現。

## Development Notes

### v0.1.0：確認後模擬點擊

初版先攔截追蹤操作，顯示確認介面，再透過 JavaScript `target.click()` 嘗試完成追蹤。實機測試發現，個人頁面可正常追蹤，但動態河道按下確認後未成功追蹤。

這個差異促使開發方式轉向保留真實使用者事件，處理不同 Threads 元件對事件來源與傳遞流程可能存在的差異。

### v0.2.0：放行第二次實體操作

修正後將第一次操作攔截，符合確認條件的第二次實體操作則直接放行，讓 Threads 自行處理追蹤。並補充快速連點、取消、鍵盤、逾時與模式切換等情境。

需求、實際 Threads 操作與結果判斷由我負責；AI 協助產生程式、分析測試回報並調整實作方式。

## Validation

* 開發期間的模擬測試涵蓋事件攔截、快速連點、取消、鍵盤操作、逾時及模式切換。
* v0.1.0 的實機測試確認個人頁面正常，但動態河道的模擬點擊未能完成追蹤。
* v0.2.0 改用放行第二次實體點擊後，使用者在 Threads 實際操作，回報目前未發現問題。

本次文件整理完成靜態語法與檔案檢查。不同語系、瀏覽器、Threads 介面版本與各種輸入方式尚待進一步驗證。

## Known Limitations

* Threads 的 DOM、按鈕文字、無障礙標籤及事件處理方式可能因改版而改變。
* 腳本依賴目前可辨識的追蹤控制；特殊介面或未收錄的文字可能需要補充規則。
* 隱藏模式會同時處理追蹤及已追蹤／取消追蹤按鈕；模式可從 Tampermonkey 選單切換。
* 模式設定會保存到後續頁面載入，包括「暫時停用保護」。

## Navigation

* [返回 Tools Index](../)
* [返回 Digital Workflow Prototyping](../../case-notes/digital-workflow-prototyping.md)
* [返回 Selected Works](../../profile/works.md)
* [返回根 README](../../README.md)
