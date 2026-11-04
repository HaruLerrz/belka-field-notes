# Validation and Known Limitations

驗證日期：2026-11-04（Asia/Taipei）

## Confirmed Results

* 使用者在 Firefox／Tampermonkey 成功以 v1.1.0 匯出 JSON 與 CSV。
* 離線檢查確認 JSON 可解析，CSV **1,414 筆資料**與 JSON `rows` 的 1,414 筆內容和數值一致。
* 六個資料來源中，`quota`、`counts`、`category_shares`、`plugin_activity`、`skill_activity` 成功取得；`model_token_details` 失敗。
* `truncated_rows=false`，本次未達 20,000 列的輸出上限。
* 本次受檢匯出資料未發現對話內容、access token 或個人帳號識別欄位。

## Known Limitations

1. **模型 Token 端點**：`model_token_details`（`/backend-api/wham/usage/daily-workspace-user-token-usage-breakdown`）回傳 HTTP 400，導致 `daily_model_tokens=[]`，其他成功來源仍可匯出。
2. **分類單位**：`daily_category_shares` 請求使用 `units=percent`，`models[].credits` 與 `attribution[].value` 表示圖表比例值，與 `daily_usage[].totals.credits` 的絕對計量單位不同。本次樣本呈現相對比例的特徵；若要比較實際 Credits，需使用對應的絕對計量來源。
3. **High／Ultra 拆分**：成功取得的欄位包含 `model` 與 `speed`，未取得可確認推理強度的 `reasoning_effort`，目前無法精確拆分 High／Ultra 消耗。
4. **日期邊界**：`daily_category_shares` 曾回傳排他上界當日的零值紀錄，後續需補上日期範圍過濾。
5. **Plugin／Skill 統計**：本次 `daily_plugin_activity` 主要只有日期，`daily_skill_activity=[]`；資料不足以推定實際活動次數。
6. **計量回填**：本次樣本出現有 Credits／Token 而 `turns=0` 的日期；各指標可能具有不同的更新時點或資料語意。
7. **模型層 Credits**：樣本中的 `daily_usage.models[].credits` 為 0，即使當日 `totals.credits` 有值。應先確認來源欄位語意，再用於模型成本分配。

## Future Work

* 在輸出欄位與 UI 中區分絕對計量和圖表相對百分比。
* 加強部分端點失敗時的訊息說明，並增加日期範圍過濾及來源單位 metadata。
* 待來源提供可驗證的推理強度資料後，再評估 High／Ultra 分類。
* 使用合成測試資料建立離線驗證流程。

驗證依據為使用者於 2026-11-04 匯出的實際檔案。公開 repo 僅保留檢查結果，未收錄原始帳戶用量資料。

## Navigation

* [返回工具 README](README.md)
* [返回 Tools Index](../)
* [返回 Selected Works](../../profile/works.md)
