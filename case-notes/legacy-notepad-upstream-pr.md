# Legacy Notepad Upstream Contributions

## Background

這個案例起於 Windows 11 新版 Notepad 的實際使用問題。輸入法快捷鍵包含 Alt 時，記事本的選單存取鍵可能搶走輸入焦點；PowerToys 無法處理這類需要判斷按鍵事件與焦點狀態的情境。

我因此改用 [Legacy Notepad](https://github.com/forloopcodes/legacy-notepad)。這個專案以 C++17、Win32 API 與 RichEdit 實作，啟動快、功能集中，定位接近傳統純文字編輯器。

最初只是想補上自己需要的正體中文介面與自動換行偏好。實際長期使用後，又陸續發現 Find、Replace、Paste、方向鍵與 modeless dialog 的行為問題，後續整理成多個可獨立 review 的 upstream pull request。

## From Fork to Upstream Contributions

第一階段先 fork 專案，閱讀語言、設定、選單、RichEdit editor 與 dialog 相關模組，建立正體中文第三語言與 Word Wrap 持久化。

之後的修改改採小型 PR 流程。每個主題都重新從 `upstream/main` 建立乾淨 branch，再把已完成的單一修改 cherry-pick 或重新整理進去。每條 branch 獨立 build、人工測試、確認 diff 範圍後再 push 到 fork 並送出 PR。

這樣可以讓 upstream maintainer 分開判斷每項修改，也避免把 fork 專屬 README、zh-TW 介面或其他尚未相關的功能混入小型修正。

## Contribution Timeline

### PR #33 — Traditional Chinese UI and Word Wrap Persistence

PR：  
[forloopcodes/legacy-notepad#33](https://github.com/forloopcodes/legacy-notepad/pull/33)

主要內容：

* 新增 Traditional Chinese / zh-TW 作為第三語言。
* 補上正體中文 UI 字串，對齊台灣 Windows / Notepad 常用語。
* 保存 Word Wrap 偏好，重新啟動後仍保留設定。
* 修正 Redo command behavior。
* 調整本地化後的 dialog layout 與 labels。
* 保留 upstream 原有版本號標示。

這是第一次向該專案提交 upstream PR，也建立了後續 fork、branch、build 與測試流程的基礎。

### PR #38 — RichEdit Native Find

PR：  
[forloopcodes/legacy-notepad#38](https://github.com/forloopcodes/legacy-notepad/pull/38)

原本 Find 先從 editor 取出文字，在獨立 `std::wstring` 中搜尋，再把字串 index 傳給 RichEdit 的 `EM_SETSEL`。實測發現兩套位置表示可能不一致，會選到錯誤文字。

修正後改用 RichEdit 原生 `EM_FINDTEXTEXW`，直接採用 RichEdit 回傳的 `cpMin` / `cpMax` 選取範圍。

測試包含 Find Next、Find Previous、重複命中與找不到文字的訊息。

### PR #39 — Plain-text Paste

PR：  
[forloopcodes/legacy-notepad#39](https://github.com/forloopcodes/legacy-notepad/pull/39)

Legacy Notepad 儲存純文字，但畫面上的 editor 使用 RichEdit。從 Microsoft Word 貼上內容時，RichEdit 可能採用剪貼簿中的 rich-text representation，讓字級、格式與表格進入原本定位為純文字的編輯器。

修正攔截 `WM_PASTE`，優先讀取 `CF_UNICODETEXT`，必要時 fallback 到 `CF_TEXT`，最後透過 `EM_REPLACESEL` 插入純文字。

實測使用一般純文字、Microsoft Word 格式化內容與瀏覽器內容。

### PR #40 — Arrow-key Boundary Navigation

PR：  
[forloopcodes/legacy-notepad#40](https://github.com/forloopcodes/legacy-notepad/pull/40)

這項修改補上第一個與最後一個 visual line 的 Up / Down 行為，並保留 RichEdit 對中間行與 modifier keys 的原生處理。

人工測試期間另外發現 selection 位於邊界時的行為需要處理。修正後將 boundary selection 收合到 start / end，再把修改 amend 回單一 commit。

測試範圍包含首尾行、selection 邊界、中間行、自動換行形成的 visual lines，以及 Ctrl / Shift / Alt 組合鍵。

### PR #41 — Find / Replace Dialog Keyboard Behavior

PR：  
[forloopcodes/legacy-notepad#41](https://github.com/forloopcodes/legacy-notepad/pull/41)

這項修改集中處理 modeless Find / Replace dialog 的鍵盤操作：

* 開啟 Find 或 Replace 時直接 focus Find 欄位。
* Ctrl+F / Ctrl+H 可在 Find 與 Replace dialog 之間切換。
* 切換 dialog 時保留 Find / Replace 已輸入文字。
* dialog edit 欄位支援 Ctrl+A。
* controls 加入 Tab / Shift+Tab 導覽。
* Ctrl+F / Ctrl+H 在 `IsDialogMessageW` 前處理，避免 Ctrl+H 被 dialog 當成 Backspace。

PR 送出後再次檢查 diff，發現保存 dialog 文字的初版實作使用固定 256 wchar buffer。後續改成先透過 `GetWindowTextLengthW()` 取得實際長度，再動態配置 `std::wstring` 並用 `GetWindowTextW()` 讀取，移除人為 255 字元截斷風險。

這個 follow-up fix 直接追加到同一條 PR branch，讓 PR 保留原本主題與 review context。

### PR #42 — Replace Correctness and Feedback

PR：  
[forloopcodes/legacy-notepad#42](https://github.com/forloopcodes/legacy-notepad/pull/42)

Replace 原本會把 RichEdit selection position 當成獨立 `std::wstring` 的 index。這和 Find 的位置問題屬於同一類風險。

修正使用 RichEdit 的 `EM_GETSELTEXT` 直接讀取目前 selection，再執行 Replace。

Replace All 同時補上零命中回饋；找不到任何符合內容時，顯示既有的 `Cannot find` 訊息。

這條 PR 刻意不改 Find implementation，後續 Find 行為由 #38 處理。

## Working Method

這一輪 upstream contribution 使用固定流程：

```text
實際使用發現問題
→ 找到可重現條件
→ 閱讀 Win32 / RichEdit 相關程式
→ 在 fork 中完成初版修正
→ 建立以 upstream/main 為基底的乾淨 branch
→ cherry-pick 或整理單一修改
→ 獨立 CMake / MSVC build
→ 人工測試正常路徑與 edge cases
→ 檢查 diff 與 commit scope
→ push 到 fork
→ 建立 upstream PR
→ PR 送出後再次 review
```

Build 測試使用獨立資料夾，例如 `build-pr-find-x64`、`build-pr-paste-x64`、`build-pr-arrow-x64`，避免舊 build 產物混入不同 PR 的驗證。

Git 操作過程也刻意保留 branch、commit、cherry-pick、amend、push 與 upstream / origin 的差異，讓每個 PR 都能追到清楚的來源與目的。

## Review After Submission

這次流程中有兩個重要的「送出前後再次檢查」案例。

PR #40 在人工測試時找到 boundary selection edge case，先修正、重新測試，再 amend 回單一 commit後送出。

PR #41 已建立 upstream PR 後，又從 diff 中注意到固定大小 buffer。修改改成動態讀取 control text，再 push 到原 branch，GitHub PR 自動更新。這次經驗也讓 review 從「確認能不能用」延伸到資料長度、API position semantics 與維護風險。

## Status

截至 2026-08-13，已向 `forloopcodes/legacy-notepad` 提交 6 個 open pull requests：

* #33 — Add Traditional Chinese UI and persist word wrap
* #38 — Fix Find selection with RichEdit native search
* #39 — Paste clipboard content as plain text
* #40 — Add arrow key boundary navigation
* #41 — Improve Find and Replace dialog keyboard behavior
* #42 — Fix Replace selection handling and no-match feedback

GitHub 目前均標示可合併，等待 upstream maintainer review。

## What This Demonstrates

這個案例記錄了：

* 從日常工具的輸入焦點問題找到適合的開源替代專案。
* 閱讀 C++ / Win32 / RichEdit 程式結構並定位語言、設定、editor、message loop 與 dialog 行為。
* 依台灣 Windows 用語完成 zh-TW 本地化。
* 以 RichEdit 原生 API 修正搜尋、selection 與 paste 行為。
* 從實機操作找到 wrapped visual line、selection boundary、Ctrl+H / `IsDialogMessageW` 等 Win32 edge cases。
* 將大 branch 中的修改拆成可獨立 review 的 upstream PR。
* 以 build、人工測試、diff review 與 follow-up commit 持續修正已送出的貢獻。
* 使用 AI 協助問題拆解、程式檢查與測試規劃，再以本機 build 與實際操作確認結果。

## Navigation

* [開啟 Legacy Notepad fork](https://github.com/HaruLerrz/legacy-notepad)
* [返回 Case Notes](README.md)
* [返回 Selected Works](../profile/works.md)
* [返回根 README](../README.md)
