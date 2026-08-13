# Facebook Invite Helper

這是一支 Tampermonkey userscript，用來處理 Facebook 貼文反應／按讚名單中的「邀請」操作，並提供獨立的名單「捲到底」功能。

## Purpose

工具源自 Facebook 反應名單中大量重複點擊「邀請」按鈕的操作需求。

腳本只操作目前登入頁面中已載入的 DOM 元素，不使用 Facebook 私有 API、GraphQL request 或額外憑證。邀請流程必須由使用者手動啟動，並保留批次上限、隨機延遲、手動停止與已知限制訊息偵測。

目前版本：

```text
2026-08-08-01
```

## Files

```text
facebook-invite-helper.user.js
```

## Safety Model

這個版本採取幾個保守條件：

1. 「開始邀請」只處理目前已載入的邀請按鈕，本身不自動捲動。
2. 每批有可調整的邀請上限，預設為 20。
3. 每次點擊之間加入可調整的隨機延遲，預設 1600～2400 ms。
4. 偵測到「稍後再試」、「暫時無法」、「操作太頻繁」等已知限制訊息時會停止。
5. 關閉目標 dialog、找不到邀請按鈕或發生例外時會結束當前流程。
6. 邀請與「捲到底」互相排斥，不會同時執行。
7. UI 預設縮小；縮小介面不會中止正在執行的流程。
8. 完整停用腳本仍由 Tampermonkey 控制，介面沒有另外放一個容易被誤認為「停用腳本」的關閉 X。

這些條件用來降低失控與誤操作機率，不代表 Facebook 一定不會套用速率限制或其他帳號層限制。

## Install

1. 打開 Tampermonkey。
2. 建立新的 userscript。
3. 用 `facebook-invite-helper.user.js` 取代預設內容。
4. 儲存。
5. 重新整理 Facebook 頁面。

## How It Works

邀請流程會：

1. 尋找目前可見的 `role="dialog"`。
2. 優先選擇實際包含最多「邀請／已邀請」按鈕的 dialog，而非單純選畫面面積最大的 dialog。
3. 若 dialog 判斷失敗，從整個頁面尋找可見且可點擊的「邀請」按鈕，再反查它所屬的 dialog。
4. 僅處理可見、未 disabled、文字為 `邀請` 或 `Invite` 的按鈕。
5. 對本輪已處理按鈕加上 `data-tm-invite-helper-processed` 對應的 dataset 狀態，避免同一輪重複點擊。
6. 使用原生 `.click()`，不另外模擬大量滑鼠事件。
7. 每次點擊後等待隨機延遲，再重新檢查 dialog、限制訊息與下一個邀請按鈕。

早期版本曾直接選取最大的 dialog；在 Facebook 同時存在貼文 modal 與反應名單 modal 時，會抓到外層貼文並得到 0 個邀請按鈕。後續改成以實際邀請按鈕數量評分 dialog，實測後可正常執行。

## Controls

介面預設顯示右下角縮小膠囊，點擊後展開完整面板。

可調整：

```text
每批上限
最小延遲（ms）
最大延遲（ms）
```

主要控制：

```text
開始邀請
停止
捲到底
```

執行狀態會同步顯示在面板與縮小膠囊。

## Scroll to Bottom

「捲到底」和邀請流程完全分開。

它會：

1. 尋找反應名單 dialog 中可實際捲動的容器。
2. 將該容器捲到目前底部。
3. 等待 Facebook 載入更多名單。
4. 若 `scrollHeight` 增加，繼續下一輪。
5. 連續 4 輪都在底部且沒有新增內容後，判定已到底。
6. 最多執行 240 輪，避免介面異常時無限循環。
7. 再按一次「停止捲動」即可手動中止。

這個功能只負責載入與捲動名單，不會點擊任何「邀請」按鈕。

## Background Execution

腳本使用頁面內的 JavaScript timer 與 DOM `.click()`，因此切到其他分頁或其他程式後通常仍可繼續執行。瀏覽器可能對背景分頁 timer 節流，所以實際間隔可能變長。

執行期間仍應保留原本的 Facebook 分頁與目標 dialog；關閉 dialog、切換同一分頁中的主要內容、分頁被瀏覽器卸載或系統進入睡眠都可能中止流程。

## Validation

目前版本已在實際 Facebook 反應名單介面確認：

1. 修正多層 dialog 選取後，可辨識並點擊邀請按鈕。
2. 批次上限與隨機延遲可正常工作。
3. 面板可預設縮小並重新展開。
4. 縮小 UI 時邀請流程仍可繼續。
5. 「捲到底」可獨立執行，不會觸發邀請。

Facebook 的 DOM、按鈕文字與限制訊息可能隨時改版；selector 或辨識條件失效時仍需重新檢查實際頁面。

## Development Notes

這個工具的演進主要來自實機測試：

1. 初版採保守批次操作，不自動捲動。
2. 首次測試發現「最大 dialog」策略抓到外層貼文 modal，改成依「邀請／已邀請」按鈕數量挑選實際反應名單。
3. 確認背景分頁仍可執行後，保留頁面 JavaScript 與 DOM click 的簡單實作。
4. UI 改為預設縮小，並刻意不加入關閉 X，避免把「隱藏面板」誤認成「停用腳本」。
5. 新增獨立「捲到底」功能，只負責載入完整名單，不和邀請流程綁在一起。

## Navigation

* [返回 Tools Index](../)
* [返回 Digital Workflow Prototyping](../../case-notes/digital-workflow-prototyping.md)
* [返回 Selected Works](../../profile/works.md)
* [返回根 README](../../README.md)
