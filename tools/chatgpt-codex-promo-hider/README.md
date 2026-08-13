# ChatGPT Promo Cards Hider

這是一支 Tampermonkey userscript，用來隱藏 ChatGPT 網頁介面中動態插入的產品與功能提示卡。

## Purpose

ChatGPT 可能在回覆完成後插入 Codex、Pro、外掛程式資訊、ChatGPT Work 等提示卡。這些卡片的文案與外層 DOM 結構會隨介面更新而改變，單純逐條比對固定文字容易在新文案出現時失效。

v0.6.0 改成「已知文案規則 + 輸入框上方卡片結構辨識」的混合模式。已收錄的提示卡仍可直接依文字規則處理；遇到尚未收錄的新文案時，腳本會嘗試辨識緊貼輸入框上方、具有關閉控制與行動按鈕的提示卡結構。

## Known Promo Rules

v0.6.0 目前保留四組已知文案規則：

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
3. Plugin information promo
   * `外掛程式提供更有幫助的結果`
   * 外掛程式使用對話與記憶資訊的說明
   * 權限管理、了解更多與確認按鈕
4. ChatGPT Work promo
   * `在 ChatGPT Work 繼續深入`
   * `ChatGPT Work`
   * 文件、簡報、試算表、報告或網站等相關正文
   * `試用工作`

已知文案命中後，隱藏原因會記錄成 `text:<rule-name>`，例如 `text:codex` 或 `text:chatgpt-work`。

## Structural Fallback

結構辨識會尋找目前可見的 ChatGPT 輸入區，再檢查附近候選元素是否符合以下條件：

1. 卡片位於輸入框上方的有限距離內。
2. 卡片與輸入框有足夠的水平重疊。
3. 卡片寬度與輸入框大致相近。
4. 卡片存在可辨識的 X／Close／Dismiss 類關閉控制。
5. 卡片另外包含至少一個可見的行動控制。
6. 卡片文字或按鈕包含促銷、導覽或功能提示訊號。
7. 候選元素本身不包含 textarea、contenteditable 或一般文字輸入欄位。
8. `html`、`body`、`main`、`form`、`#__next` 與 `#root` 等高風險容器一律排除。

結構 fallback 成功時，隱藏原因會記錄成：

```text
structure:composer-adjacent
```

## Files

```text
chatgpt-hide-codex-promo-card.user.js
```

repo 目前保留最初建立工具時使用的 Codex 路徑與檔名，避免既有內部連結失效；腳本顯示名稱與功能已擴充為一般 ChatGPT Promo Cards Hider。

## Install

1. 打開 Tampermonkey。
2. 建立新的 userscript。
3. 用 `chatgpt-hide-codex-promo-card.user.js` 取代預設內容。
4. 儲存。
5. 重新整理 ChatGPT 頁面。

## How It Works

腳本會：

1. 只在 `chatgpt.com` 與 `chat.openai.com` 執行。
2. 先執行已知 `PROMOS` 文字規則。
3. 再尋找目前可見的 composer editor。
4. 從輸入框附近的關閉控制往上尋找安全候選容器。
5. 以尺寸、位置、水平重疊、行動控制與促銷訊號篩選結構 fallback。
6. 對已隱藏元素標記 `data-belka-hidden-chatgpt-promo="true"`。
7. 另外以 `data-belka-promo-reason` 記錄實際命中原因。
8. 使用 `MutationObserver` 監看頁面變化，並保留 1.2 秒 interval fallback。
9. 成功隱藏時以 `console.debug()` 寫入 `[Belka Promo Hider] hidden: ...`。

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

若要確認目前 DOM 中被腳本標記的卡片與命中原因，可執行：

```javascript
[...document.querySelectorAll(
  '[data-belka-hidden-chatgpt-promo="true"]'
)].map((el) => el.getAttribute('data-belka-promo-reason'))
```

可能看到：

```text
["text:codex"]
["text:chatgpt-work"]
["structure:composer-adjacent"]
```

也可以在 Firefox Console 顯示 Debug／除錯訊息後搜尋：

```text
[Belka Promo Hider] hidden:
```

若回傳空陣列，可能代表提示卡當下沒有生成、已被 React 從 DOM 移除，或查詢時機早於提示卡出現。

## Validation Status

v0.6.0 已確認：

1. 腳本本身可正常執行。
2. 舊的已知文案規則可正常隱藏提示卡。
3. `data-belka-promo-reason` 與 console debug 記錄可用。

`structure:composer-adjacent` 目前保留為安全 fallback，仍等待沒有既有文字規則可先命中的新提示卡進行實際驗證。這項限制刻意保留在文件中，避免把尚未完成野生案例測試的結構規則寫成已完全驗證。

## Development Notes

這個工具經過多次實際介面測試：

1. 初版使用較寬鬆的文字比對，曾誤藏 ChatGPT 上層容器，造成整頁空白。
2. 後續加入危險容器排除與提示卡尺寸限制。
3. v0.3.0 改為選取最大的安全候選容器，解決只隱藏內層內容後留下白色外框的問題。
4. v0.4.0 因 Codex promo 文案更新，將辨識拆成標題、正文與操作線索。
5. v0.5.0 加入 Pro promo，並把多種提示卡整理成 `PROMOS` 設定。
6. v0.5.1 將停用旗標與隱藏元素標記改用 `belka` 命名。
7. v0.5.2 加入外掛程式資訊提示卡。
8. v0.6.0 加入 ChatGPT Work 規則，並新增 composer-adjacent 結構 fallback、命中原因標記與 debug log，使後續新提示卡不必完全依賴逐條新增文案。

目前版本已確認為 UTF-8 無 BOM，可直接匯入 Tampermonkey。ChatGPT 後續若大幅改變 composer、提示卡位置或控制元件結構，仍可能需要調整結構辨識條件。

## Navigation

* [返回 Tools Index](../)
* [返回 Digital Workflow Prototyping](../../case-notes/digital-workflow-prototyping.md)
* [返回 Selected Works](../../profile/works.md)
* [返回根 README](../../README.md)
