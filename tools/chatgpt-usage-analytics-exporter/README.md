# ChatGPT Usage Analytics Exporter

這是一支 Firefox／Tampermonkey Userscript，可從 ChatGPT Usage Analytics 匯出每日用量、Token、分類統計與目前的額度窗口，產生 JSON 或 CSV，方便在本機整理資料。

## Purpose

《萬安出口》的 AI 協作開發產生了用量管理需求，希望能把每日計量與分類資訊保存下來，進一步分析不同工作階段的資源消耗。因此製作這支從 ChatGPT 用量頁面擷取資料的工具。

需求設定與實際測試由我執行，程式撰寫、資料結構排查與修正則使用 AI 協助。v1.1.0 已在 Firefox 成功匯出；目前取得的資料仍不足以精確拆分 High／Ultra 的消耗。

## Files

* [`chatgpt-usage-analytics-exporter.user.js`](chatgpt-usage-analytics-exporter.user.js)：經實測的 v1.1.0 原始碼。
* [`VALIDATION.md`](VALIDATION.md)：實測結果、資料語意與已知限制。

## Installation and Export

1. 在 Firefox 安裝並啟用 Tampermonkey。
2. 新建 Userscript，貼入本資料夾的 `.user.js` 內容並儲存，或直接使用 Tampermonkey 匯入檔案。
3. 開啟 [ChatGPT Usage Analytics](https://chatgpt.com/settings/usage?tab=analytics) 頁面並重新整理。
4. 點擊頁面左下角的「全分類 JSON」或「分類明細 CSV」按鈕，下載資料。

預設查詢最近 45 天。實際可取得的日期與欄位取決於帳戶及 API 回傳結果。CSV 使用長格式，每列記錄一項來源、分類與指標數值。

## Data and Interpretation

* `daily_usage`：每日彙總計量，包含 Credits、回合數及可取得的 Token 指標。
* `daily_model_tokens`：模型層 Token 明細；本次測試對應端點回傳 HTTP 400，因此為空陣列。
* `daily_category_shares`：來自 `units=percent` 的分類圖表數值，其中名為 `credits` 的欄位也應按照圖表比例理解，不適合與每日絕對 Credits 相加。
* `daily_plugin_activity`、`daily_skill_activity`：相關端點的回傳資料，可能只有日期或空陣列。
* `quota_windows`：匯出當下取得的額度窗口與重設資訊，屬於即時快照。
* `diagnostics`：各端點成功與失敗的紀錄，以及資料列數截斷狀態。

目前成功回傳的資料無法可靠辨識 `reasoning_effort=high/ultra`。詳細的欄位限制與驗證結果見 [VALIDATION.md](VALIDATION.md)。

## Validation

2026-11-04 已於 Firefox／Tampermonkey 成功匯出 JSON、CSV，並離線交叉核對 **1,414 筆分類資料**；六個資料來源有五個成功取得。相關檢查與限制保留在驗證文件中，後續如有 ChatGPT 網頁或 API 變動，仍需重新實測。

## Privacy and Maintenance

腳本在使用者點擊匯出按鈕後，透過目前登入的 ChatGPT 頁面存取同源 API，並使用欄位允許清單與敏感欄位名稱排除規則整理資料。本次測試輸出未發現對話內容、登入憑證或個人帳號識別欄位。

匯出檔包含使用時間與計量紀錄，應視為個人資料妥善保存，公開前也應檢查檔案內容。程式依賴 ChatGPT 網頁使用的非公開 API，網站改版可能影響相容性。

## References

* [ChatGPT Usage Analytics](https://chatgpt.com/settings/usage?tab=analytics)
* [Wangnov/codex-meter](https://github.com/Wangnov/codex-meter)：用量分類與 API 資料語意的參考專案。

## Navigation

* [返回 Tools Index](../)
* [返回 Selected Works](../../profile/works.md)
* [返回根 README](../../README.md)
