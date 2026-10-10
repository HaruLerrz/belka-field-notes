# Coursera Google Cloud Course Text Copier

一支用於 Firefox／Tampermonkey 的小型 Userscript，針對跨語言學習中的教材閱讀與翻譯需求，從 Coursera 內嵌的 Google Cloud HTML5 教材擷取目前已載入的文字，並複製至剪貼簿，方便透過翻譯工具連續閱讀與整理筆記。

目前已完成初版，並以一個真實教材頁面確認擷取結果。其他教材頁型及 Coursera 外層頁面的跨來源通訊流程仍待進一步測試。

## Purpose

這項工具源自跨語言學習時的閱讀可及性需求。使用者需要透過翻譯軟體理解英文課程，但 Google Cloud 的 HTML5 互動教材將部分文字分散在需要手動切換的字卡、輪播、摺疊區塊與逐字稿中。一般選取、複製或翻譯流程可能只處理當前顯示的片段，反覆切換卡片與整理文字也容易中斷閱讀節奏。

本工具集中擷取已存在於 DOM 的文字並複製至剪貼簿，讓使用者能將內容交給慣用的翻譯工具，較連續地閱讀教材與整理學習筆記。

## Files

* [`coursera-google-cloud-course-text-copier.user.js`](coursera-google-cloud-course-text-copier.user.js)：Tampermonkey Userscript。

腳本 metadata 版本為 `1.0.0`。

## How It Works

腳本在 Coursera 頁面及指定的 Google Storage 教材路徑執行。

* 在教材獨立頁面，以 DOM traversal 擷取文字節點。
* 保留已載入 DOM、但因介面狀態尚未顯示的文字。
* 對部分區塊元素插入換行，改善純文字閱讀順序。
* 附上目前教材網址，透過 `GM_setClipboard` 複製至本機剪貼簿。
* 在 Coursera 外層頁面，透過 `window.postMessage` 向教材 iframe 請求擷取結果。
* 使用 origin、source、channel 與 request ID 驗證 iframe 訊息。
* 使用 `MutationObserver` 因應 Coursera 頁面切換時 iframe 的變動。

## Installation

1. 在 Firefox 安裝並啟用 Tampermonkey。
2. 新建 Userscript，貼入本專案的 `.user.js` 內容。
3. 儲存並啟用腳本。
4. 開啟支援路徑內的 Google Cloud HTML5 教材。
5. 點擊頁面右下角的「📋 複製整頁教材」。

目前以 Google Storage 教材獨立頁面，或 Coursera 中內嵌的指定 Google Storage 教材作為設計範圍。兩種操作入口仍需分開累積測試紀錄。

## Development Notes

本工具從跨語言教材的閱讀與翻譯需求出發，經歷以下排查：

1. 為了交由翻譯軟體理解教材而手動複製文字時，發現需逐張切換的輪播卡片容易造成未展開內容遺漏。
2. 嘗試直接讀取教材網址，無法取得 JavaScript 呈現後的完整正文。
3. 第一次使用 Firefox Browser Console 時，取得瀏覽器自身介面文字。
4. 改從 Coursera 頁面擷取，發現得到的是外層 DOM 與 iframe 備援文字。
5. 將 Google Storage 教材 iframe 開啟為獨立分頁，確認 `document.body.textContent` 能取得尚未顯示的輪播文字。
6. 以此結果選定 DOM 文字擷取方案，製作帶有一鍵按鈕的 Userscript。
7. 為跨來源的 Coursera 頂層頁面與 Google Storage iframe 設計雙端訊息傳遞。
8. 以真實教材內容進行第一次功能驗證。

我負責確認需求、操作教材與檢查擷取結果，並使用 AI 協助程式撰寫、瀏覽器行為分析及修正方向評估。

## Validation

2026-10-09，以 Google Cloud Digital Leader 學習路徑中的 `Challenges that lead to digital transformation` 教材進行第一次測試。

首次擷取結果包含：

* 教材標題、正文與教材網址。
* 五項數位轉型驅動因素（5/5）。
* 六項 Google Cloud 差異化優勢（6/6）。
* Cloud Corner Podcast Transcript。

此次結果確認工具已能從一個真實教材頁面取得原本手動複製容易遺漏的內容。

## Known Limitations

* 擷取範圍為目前已載入、可遍歷的 DOM；延遲載入內容、Shadow DOM、其他 iframe 與虛擬化元件可能遺漏。
* 輸出保留部分教材導覽文字，例如 `Completed`、`Incomplete`、`Search`。
* 輸出格式為純文字，Markdown 標題、表格與連結結構尚待處理。
* Coursera 外層頁面的跨來源 iframe 通訊、Knowledge Check、其他教材頁型與複數 iframe 情境仍待實測。
* 適用範圍為指定的 Coursera 頁面與 Google Cloud 教材路徑。

## Privacy and Scope

工具由使用者點擊啟動，將目前擷取的教材文字複製至本機剪貼簿，供翻譯、閱讀與筆記整理使用。

由於 DOM 擷取可能包含教材以外的頁面文字，使用者在轉貼內容前仍應檢查個人資訊與資料使用範圍。

## Navigation

* [返回 Tools Index](../)
* [返回 Digital Workflow Prototyping](../../case-notes/digital-workflow-prototyping.md)
* [返回 Selected Works](../../profile/works.md)
* [返回根 README](../../README.md)
