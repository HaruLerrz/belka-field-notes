# Version History

本頁整理 Issue Trace 原型的主要版本歷史。重點放在公開站可理解的產品演進、來源流程、AI 查證邊界與後台管理能力；正式站的完整程式、私有資料與營運設定保留在私有環境。

## v0.3.3.1

v0.3.3.1 是文件與版本標示整理版本，runtime 行為沿用 v0.3.3。

主要更新：

* 精修 README 主標題與部署確認說明。
* 更新查證策略、log 檔案列表與版本歷史排序。
* 移除 README 內過期版本標示。
* 整理重複版本區塊。
* 補齊 public guide、admin guide 與 system guide。
* 讓 health check 與頁腳版本資訊更容易對照。

## v0.3.3

v0.3.3 將 prompt 來源選取改為明確策略 `submitted_4_discovered_4_fillback`。

主要更新：

* 在 8 筆 prompt 來源上限下，投稿來源先取最多 4 筆。
* 系統搜尋來源保留其餘席位。
* 若投稿或搜尋任一邊不足，依原始順序補滿。
* 新增 `source-selection-report.json`，記錄候選來源總數、投稿來源數、搜尋來源數、入選來源、補充來源與選取原因。
* 來源進入 prompt 後重新編成連續的 `S01`～`S08`，避免因候選來源延後而出現跳號。
* 不做機械式來源桶權重。
* 不判斷媒體立場。
* 不讓 `.gov` 或 `.edu` 自動升級，也不讓 unknown `.com` 自動降級。
* 後台補充來源與重新調查流程使用 expanded query / expanded result 設定。
* 來源數不足時可補搜，並以草稿或人工檢查狀態保留結果。

這一版的核心，是讓投稿線索與系統搜尋來源同時有機會進入 final AI prompt，避免任何一側完全擠掉另一側。

## v0.3.2

v0.3.2 修正 source ID、inline URL 與來源清理後的驗證問題。

主要更新：

* 修正 tracker metadata 污染。
* 若外部搜尋取得的標題或摘要疑似 tracker 殘留，系統保留原來源 URL，但顯示為 domain 或低資訊標題。
* 在 `source-normalization-report.json` 記錄污染警告。
* 來源驗證計數改為區分真正排除與重複合併。
* duplicate / ignored 不再顯示成一般「排除來源」。
* 增加英文 UI 整行白名單，只移除整行完全等於社群介面文字的行，不刪正文內詞。
* 保留 AI 自行產生的參考來源段落，不再由 Node.js 依標題硬刪。
* 系統來源列表仍會附加於文末。
* 正文引用已知 `[Sxx]` 但 AI 少列入 sources 時，系統會自動補入或建立 alias。
* 未知 `[Sxx]` 才列為人工檢查。
* 來源驗證區分 hard block、soft warning、duplicate、ignored 與真正排除。

## v0.3.1

v0.3.1 主要處理「待查對象本身是 URL」時，來源清理過度的問題。

主要更新：

* 新增 `preserve_inline_urls` 單篇 job 參數。
* 若 Query Planner 判斷待查對象是 URL 本身，final prompt 來源內容會保留內文 URL。
* 後台新增保留內文 URL 的重試流程，可單次覆寫 URL 清理行為。
* 同時保留 `source-prompt-section.raw.txt` 與 `source-prompt-section.txt`，方便對照清理前後差異。
* 清理 final prompt 來源內容中的 Markdown URL 與裸 URL；完整 URL 仍保存在 `source-map.json`。
* Source ID 驗證改為自動修復優先。
* 已知 `Sxx` 若未列入 accepted sources 會自動補入。
* 未知 `Sxx` 才列入人工檢查。
* 主要引用來源與補充參考來源分區。
* Query Planner 被內容政策擋下時，改用 request 原文作為 fallback query。
* final writer 被內容政策擋下時，保留人工檢查草稿與 log。

## v0.3.0

v0.3.0 新增來源引用正規化流程。

主要更新：

* 外部搜尋與投稿 URL 來源會先建立 `source-map.json`。
* 每筆來源固定對應 `S01`、`S02` 這類代號。
* 最終 AI prompt 不再把完整長網址塞進來源卡。
* Prompt 內改用來源代號、標題、網域、來源類型與清理後內容。
* 完整 URL 由 Node.js 在發布與來源驗證時依 source map 回填。
* AI 回傳 sources 時可填 `source_id` 並把 URL 留空。
* 系統會用 source map 還原完整網址，降低 AI 抄錯或幻覺生成 URL 的風險。
* 新增來源代號產出檢查。
* 若正文或 sources 出現不存在的 `Sxx`，會列入來源驗證警告並阻擋自動發布。
* URL 正規化只移除明確追蹤參數，並保留可能影響內容定位的參數。
* 來源內容前處理維持保守，不做關鍵字壓縮、AI 預摘要或切片。

## v0.2.3

v0.2.3 調整前台公開 request 的使用者體驗。

主要更新：

* 移除前台投稿表單的公開勾選框。
* 一般使用者送出 request 後，標題、要查的說法與補充說明預設且固定公開。
* 投稿表單改以明確提醒告知：請勿填寫姓名、電話、住址、私人帳號、非公開對話或其他可識別個人的資訊。
* 暱稱與聯絡方式不公開。
* 詳細公開關閉時，request 仍可出現在前台列表與搜尋結果中，但文章頁不顯示原始說法與補充說明。
* 後台隱藏 request 仍是完整隱藏。

## v0.2.2

v0.2.2 調整搜尋服務 key 儲存庫的標籤管理。

主要更新：

* 批次標籤按鈕改為「恢復自動標籤」。
* 恢復自動標籤會清空所有自訂標籤。
* 畫面依目前順位自動顯示搜尋服務 key #1、搜尋服務 key #2、搜尋服務 key #3……
* 此操作不刪除 key，也不改變排序、啟用狀態或錯誤狀態。

## v0.2.1

v0.2.1 調整搜尋服務 key 儲存庫顯示方式與前端識別。

主要更新：

* 搜尋服務 key 儲存庫改以順位作為主要顯示。
* 原始資料庫 ID 改為次要資訊。
* 每組搜尋服務 key 新增自訂標籤，可手動命名，也可留空回到自動顯示。
* 新增 SVG favicon。
* 共用 layout 載入 favicon。

## v0.2.0

v0.2.0 新增公開版 request 流程。

主要更新：

* 公開文章頁若連結到詳細公開的 request，會顯示「原始 request（公開版）」區塊。
* 後台 request 詳細頁可強制開啟或關閉該 request 的公開狀態。
* 搜尋服務 key 儲存庫保留頁面上方的官方入口，移除每組 key 操作列與詳細頁內的重複外連。
* 後續 v0.2.3 將一般使用者投稿調整為固定公開標題、待查說法與補充說明，並移除前台自行關閉公開的選項。

## v0.1.34

v0.1.34 讓搜尋服務 key pool 的使用順序可管理。

主要更新：

* 搜尋服務 key 儲存庫新增排序欄位與上移／下移操作。
* 排序越上方，外部搜尋使用優先順序越高。
* 搜尋服務 key pool 的實際選用順序改為排序欄位優先，再依建立順序。
* 停用或標記異常的 key 會自動跳過。
* 既有資料庫會自動補上排序欄位，舊 key 依原本順序初始化。
* 搜尋服務相關外連統一改往供應商官方首頁。

## v0.1.33

v0.1.33 修正後台 key 管理畫面的 UI 與檢查能力。

主要更新：

* 修正管理密鑰頁 checkbox 被全域 input 寬度影響而跑版的問題。
* 管理密鑰頁新增顯示目前密鑰狀態功能，可檢查相關設定是否實際生效。
* 搜尋服務 key 操作區按鈕排版改為可換行的操作列。

## v0.1.32

v0.1.32 收窄搜尋服務 key pool 用盡判定。

主要更新：

* 只有 HTTP 401 / 402 / 403 / 429 會把 key 標記為已用盡或異常。
* HTTP 200 成功內容不會燒掉 key pool。
* HTTP 5xx 暫時錯誤、網路 timeout 或其他非授權類錯誤只記錄錯誤。
* 後台完整 key 顯示頁的複製按鈕改用固定欄位定位。
* 關閉該欄位的 autocomplete 與拼字檢查。

## v0.1.31

v0.1.31 修正搜尋服務 key pool 誤判。

主要更新：

* HTTP 200 的成功搜尋結果不再因內文出現 `token`、`api key`、`authentication` 等字樣而被標記為 key 用盡。
* 新增搜尋服務 key 顯示頁，方便登入後檢查或複製完整 key。
* 這次修正來自實際測試時遇到的 `developer token` 與 `redir_token` false positive。

## v0.1.30

v0.1.30 把公開說明與後台說明分開，並新增搜尋服務 key 儲存庫。

主要更新：

* 公開 guide 改為一般民眾版說明，只保留投稿、查證流程、查證結果與使用限制。
* 後台、API key、冷卻與維運細節移到登入後說明。
* 新增搜尋服務 API key 儲存庫，可由管理員手動新增多組 key，啟用、停用、刪除、重設可用狀態。
* 外部搜尋會優先使用 key 儲存庫。
* 若儲存庫沒有 key，才退回使用原有單一 key 設定。
* key 遇到授權、額度或 rate limit 類型錯誤時，系統會標記該 key 狀態，並自動切換下一組可用 key。
* 後台會依設定顯示可用 key 數量警告。
* 所有 key 都不可用時，才暫停外部搜尋與 Query Planner。

## v0.1.28

v0.1.28 重新調整自動發布閘門。

主要更新：

* 自動發布閘門改以 AI 的 `publish_ready`、`publish_blockers`、工具狀態與來源 hard block 為主要依據。
* `insufficient_search`、`conflicting_sources`、`needs_manual_review` 不再被 Node.js 無條件視為硬擋。
* 若 AI 判定可發布、沒有 blocking source，且草稿有明確結論，可自動發布。
* `publish_class` 主要改為文章標籤與警語依據。
* 社群型說法的直接證據不足改列為後台 warning。
* 是否足夠發布交由 AI 的 publish readiness 與 blockers 判斷。

## v0.1.26

v0.1.26 拆分投稿 URL 與搜尋提示。

主要更新：

* 前台「參考連結或來源提示」會把輸入分成兩類。
* 有效 http / https 連結會存為投稿 URL。
* 其他文字會存為投稿搜尋提示。
* 投稿搜尋提示會交給 Query Planner 作為搜尋線索。
* 投稿搜尋提示不會進入正式來源池，也不會出現在公開文章的來源表。
* 投稿 URL 讀取只處理有效 http / https 網址。
* 中文短句或來源描述不會被當成不能點擊的 submitted_url。
* 公開文章來源表會排除沒有有效 URL 的來源，避免顯示無法點開的假來源。

## v0.1.23

v0.1.23 讓自動發布與有效設定共用同一套判斷。

主要更新：

* 自動發布判斷改讀有效設定。
* 後台 SQLite settings、環境設定與程式預設值會用同一套邏輯。
* 後台網站設定新增查證完成後自動發布與發布前必須通過來源驗證開關。
* 文章編輯頁與 request 頁新增重新檢查並發布。
* 文章編輯頁與 request 頁新增重新判定 verdict。
* 每次查證完成會寫入 `publication-decision.json`。
* 後台 log 可直接看到自動發布通過或未通過的原因。

## v0.1.21

v0.1.21 新增搜尋查詢規劃與來源驗證改進。

主要更新：

* 每筆 request 會先由 AI 將使用者口語輸入整理成多組搜尋 query，再交給外部搜尋。
* 移除來源日期硬性排除；日期只作為排序權重。
* 強化 URL 比對：來源驗證會使用 canonical URL、host + path 與去除追蹤參數後的多組 key。
* 最終 Markdown 的來源區由系統重建。
* AI 原本輸出的來源段落會移除，改用通過驗證的來源列表。
* 新增後台有效設定頁。
* 來源不足時會停在草稿，不會再把低品質來源送進 final writer。

## v0.1.19

v0.1.19 改善 request 表單、後台重試與 timeout 處理。

主要更新：

* Request 表單的數字 CAPTCHA 新增換題按鈕。
* 後台新增只重試 AI 整理的操作，可沿用上一輪來源，避免外部搜尋與投稿 URL 讀取整段重跑。
* 後台會依 log 顯示更細的人工審核原因，例如 AI 整理逾時、沒有可用來源、來源驗證未通過、來源部分排除。
* 外部預搜尋支援多組查詢合併，避免單次搜尋結果過少。
* 若 AI 回傳逾時，系統會保留已找到的來源，建立 needs-review 草稿，並寫入原始錯誤紀錄。

## Public Repo Version

本公開專案資料夾整理的是可公開的架構說明、版本脈絡、範例資料與安全化程式片段。

## Navigation

* [返回專案首頁](../README.md)
* [查看 Architecture](architecture.md)
* [查看 Source Workflow](source-workflow.md)
* [查看 Safety Boundaries](safety-boundaries.md)
* [返回 Projects Index](../../README.md)
* [返回根 README](../../../README.md)
