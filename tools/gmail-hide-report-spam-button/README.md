# Gmail 隱藏回報垃圾郵件按鈕

一個小型 Gmail userscript，透過 CSS 隱藏介面中的「回報垃圾郵件」按鈕，降低整理郵件時誤觸的機會。

目前版本：`v1.0.0`

## 使用情境

Gmail 的「回報垃圾郵件」按鈕會出現在郵件工具列中。對於很少使用這項功能、又希望避免誤觸的使用者，可以透過 userscript 將按鈕從介面中隱藏。

這個工具源自日常使用需求，功能刻意保持單純：

* 隱藏「回報垃圾郵件」按鈕
* 阻止按鈕接受滑鼠點擊
* 不修改郵件內容
* 不更動 Gmail 帳號設定
* 不向外部伺服器傳送資料

## 運作方式

script 會在 Gmail 載入後，透過 `GM_addStyle` 注入 CSS，鎖定目前用於「回報垃圾郵件」按鈕的元素：

```css
[role="button"][act="9"]
```

並套用隱藏樣式。

這項修改只影響瀏覽器中顯示的介面，不會停用 Gmail 本身的垃圾郵件功能，也不會改變既有郵件分類。

## 檔案

```text
gmail-hide-report-spam-button.user.js
```

## 安裝方式

1. 在瀏覽器安裝支援 userscript 的管理工具，例如 Tampermonkey 或 Violentmonkey。
2. 建立新的 userscript。
3. 將 `gmail-hide-report-spam-button.user.js` 的完整內容貼入編輯器。
4. 儲存並啟用 script。
5. 重新整理或重新開啟 Gmail。

啟用後，「回報垃圾郵件」按鈕應會從 Gmail 工具列中消失。

## 恢復按鈕

需要重新使用「回報垃圾郵件」功能時，可以：

1. 暫時停用這個 userscript。
2. 重新整理 Gmail。

若不再需要，也可以直接從 userscript 管理工具中刪除。

## 注意事項與限制

1. 此工具依賴 Gmail 目前使用的內部 DOM 屬性 `act="9"`。
2. Gmail 改版後，按鈕的屬性或結構可能改變，script 屆時可能失效。
3. `act="9"` 並非 Gmail 對外公開的穩定 API，無法保證長期維持相同用途。
4. 此工具只隱藏介面按鈕，不會阻止 Gmail 透過其他操作路徑執行垃圾郵件回報。
5. 隱藏按鈕後，使用者也無法從原位置回報真正的垃圾郵件；需要先停用 script 才能恢復。

## 隱私與網路存取

這個 script：

* 不讀取郵件內容
* 不蒐集帳號資料
* 不使用外部 API
* 不建立網路請求
* 不將任何資料傳送至第三方

程式只在 Gmail 頁面中加入一段 CSS。

## 為什麼使用 userscript

這項需求只涉及單一網站中的單一介面元素，不需要建立完整的瀏覽器擴充套件。

userscript 形式較容易：

* 安裝與停用
* 檢查實際程式內容
* 在 Gmail 改版後調整 selector
* 維持小型、單一用途的工具結構

## 開發沿革

* **2025-03-23：** 私人使用版本開始。早期曾測試直接操作 DOM、`MutationObserver`、`requestIdleCallback` 與定時檢查等方式，處理 Gmail 動態重建按鈕的情況。
* 後續改用 `GM_addStyle` 注入 CSS，穩定隱藏 `act="9"` 對應的按鈕；私人版本編號一度更新至 `v4.0`。
* **2026-06-12：** 整理為公開版本，重新從 `v1.0.0` 起算，補齊 metadata、安裝說明、隱私說明與使用限制，並將 selector 收窄為 `[role="button"][act="9"]`。
* 曾測試 Delete 鍵刪除郵件，以及在封存與刪除按鈕之間加入分隔線；這些功能未納入目前公開版本，以維持單一用途與可預期的操作方式。

## 版本紀錄

### v1.0.0

1. 整理為公開版本。
2. 使用 CSS 隱藏 Gmail 的「回報垃圾郵件」按鈕。
3. 將 selector 限定為具有 `role="button"` 與 `act="9"` 的元素。
4. 補充繁體中文名稱、說明與使用限制。

## 授權

本工具採用 MIT License。請見 [`LICENSE`](LICENSE)。

## Navigation

* [返回 Tools Index](../)
* [返回根 README](../../README.md)
