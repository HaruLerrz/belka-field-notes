# ChatGPT Codex Promo Hider

這是一支 Tampermonkey userscript，用來隱藏 ChatGPT 網頁介面中動態插入的 Codex 提示卡。

## Purpose

這支腳本會隱藏標題為 `認識 Codex` 的 ChatGPT 提示卡。

原始問題是：這張卡片可能在程式碼相關回覆後出現，而且一般關閉按鈕或頁面元素移除工具不一定能穩定處理。最後版本會監看動態插入的卡片，找到安全的外層卡片容器，並隱藏整張卡片，同時避免誤動到 ChatGPT 主要版面。

## Files

```text
chatgpt-hide-codex-promo-card.user.js
```

## Install

1. 打開 Tampermonkey。
2. 建立新的 userscript。
3. 用 `chatgpt-hide-codex-promo-card.user.js` 取代預設內容。
4. 儲存。
5. 重新整理 ChatGPT 頁面。

## How It Works

腳本會：

1. 只在 `chatgpt.com` 與 `chat.openai.com` 執行。
2. 尋找包含 `認識 Codex` 的文字節點。
3. 檢查附近父層元素是否同時包含提示卡相關文字。
4. 排除危險容器，例如 `html`、`body`、`main`、`form`、textarea、input 與 contenteditable 區域。
5. 選取最大的安全卡片候選容器，避免只隱藏內層文字而留下空白外框。
6. 對已隱藏元素標記 `data-haruz-hidden-codex-promo="true"`。
7. 使用 `MutationObserver` 監看頁面變化，並保留輕量 interval fallback，因為提示卡可能在回覆完成後才插入頁面。

## Emergency Disable

按下：

```text
Ctrl + Alt + C
```

腳本會在 `localStorage` 寫入停用旗標，並重新整理頁面。

若要重新啟用，請在 ChatGPT 頁面的瀏覽器 console 執行：

```javascript
localStorage.removeItem('haruz_codex_promo_hider_disabled');
location.reload();
```

## Verification

當 Codex 提示卡原本應該出現後，打開瀏覽器 console 執行：

```javascript
document.querySelectorAll('[data-haruz-hidden-codex-promo="true"]').length
```

如果結果是 `1` 或更高，代表腳本已找到並隱藏至少一張 Codex 提示卡。

## Development Notes

這個工具經過三個實測階段：

1. 初版使用較寬鬆的文字比對，可能誤藏過多頁面內容。
2. 安全版加入危險容器排除，避免碰到 ChatGPT 主結構。
3. 最終版改為選取最大的安全提示卡候選容器，避免只藏到內層內容而留下空白外框。

最後版本是在實際 ChatGPT 網頁介面中，由程式碼回覆觸發 Codex 提示卡後確認可用。

## Navigation

* [Back to Tools](../README.md)
* [Selected Works](../../profile/works.md)
* [Root README](../../README.md)
