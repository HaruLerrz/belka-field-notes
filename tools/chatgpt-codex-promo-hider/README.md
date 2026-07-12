# ChatGPT Promo Cards Hider

這是一支 Tampermonkey userscript，用來隱藏 ChatGPT 網頁介面中動態插入的 Codex 與 Pro 推廣提示卡。

## Purpose

ChatGPT 可能在回覆完成後插入產品推廣卡片。一般關閉按鈕或頁面元素移除工具不一定能持續處理，提示卡文案與外層結構也可能隨介面更新而改變。

這支腳本會監看動態插入內容，以文字線索辨識 Codex 與 Pro 提示卡，再從文字節點往上尋找符合尺寸條件的安全容器。找到後隱藏完整外框，同時避開輸入區、主要對話容器與整頁結構。

## Supported Promos

v0.5.1 目前處理兩組提示卡：

1. Codex promo
   * `認識 Codex`
   * `重要工作，試試 Codex`
   * `重要工作，試用 Codex`
   * Codex 相關正文與操作按鈕
2. Pro promo
   * `提升複雜程式碼編寫的準確性`
   * `取得 Pro`
   * `升級您的方案`
   * Pro 推理模型、驗證與偵錯相關正文

每組提示卡各自定義 anchors、必要文字與輔助文字，避免只看到單一 `Codex` 或 `Pro` 字樣就直接隱藏元素。

## Files

```text
chatgpt-hide-codex-promo-card.user.js
```

repo 目前保留最初建立工具時使用的 Codex 路徑與檔名，避免既有內部連結失效；腳本內容與顯示名稱已擴充為 Codex 與 Pro 提示卡。

## Install

1. 打開 Tampermonkey。
2. 建立新的 userscript。
3. 用 `chatgpt-hide-codex-promo-card.user.js` 取代預設內容。
4. 儲存。
5. 重新整理 ChatGPT 頁面。

## How It Works

腳本會：

1. 只在 `chatgpt.com` 與 `chat.openai.com` 執行。
2. 使用 `PROMOS` 設定分別保存 Codex 與 Pro 的辨識線索。
3. 先用 anchors 篩選可能相關的文字節點。
4. 檢查候選容器是否同時符合必要文字與最低輔助線索數量。
5. 排除 `html`、`body`、`main`、`form`、`#__next`、`#root`、輸入框與 contenteditable 區域。
6. 將候選容器限制在指定寬度、高度與文字長度範圍，避免誤藏整頁、主要對話區或單一小型文字節點。
7. 從安全候選中選取面積最大的容器，避免只隱藏內層文字而留下空白外框。
8. 對已隱藏元素標記 `data-belka-hidden-chatgpt-promo="true"`。
9. 使用 `MutationObserver` 監看頁面變化，並保留 1.2 秒 interval fallback。

## Emergency Disable

按下：

```text
Ctrl + Alt + C
```

腳本會將停用旗標寫入 `localStorage`，並重新整理頁面。

若要重新啟用，請在 ChatGPT 頁面的瀏覽器 console 執行：

```javascript
localStorage.removeItem('belka_chatgpt_promo_hider_disabled');
location.reload();
```

## Verification

提示卡原本應該出現後，打開瀏覽器 console 執行：

```javascript
document.querySelectorAll('[data-belka-hidden-chatgpt-promo="true"]').length
```

如果結果是 `1` 或更高，代表腳本已找到並隱藏至少一張 Codex 或 Pro 提示卡。

## Development Notes

這個工具經過多次實際介面測試：

1. 初版使用較寬鬆的文字比對，曾誤藏 ChatGPT 上層容器，造成整頁空白。
2. 後續加入危險容器排除與提示卡尺寸限制。
3. v0.3.0 改為選取最大的安全候選容器，解決只隱藏內層內容後留下白色外框的問題。
4. v0.4.0 因 Codex promo 文案更新，將辨識拆成標題、正文與操作線索。
5. v0.5.0 加入 Pro promo，並把多種提示卡整理成 `PROMOS` 設定。
6. v0.5.1 將停用旗標與隱藏元素標記改用 `belka` 命名。

目前版本已確認為 UTF-8 無 BOM，可直接匯入 Tampermonkey。ChatGPT 後續若更新文案、尺寸或 DOM 結構，仍可能需要調整辨識線索與容器範圍。

## Navigation

* [Back to Tools](../README.md)
* [Selected Works](../../profile/works.md)
* [Root README](../../README.md)
