# Digital Workflow Prototyping

本頁整理我如何使用 AI 輔助程式撰寫、流程拆解與快速原型開發，處理實際工作或裝置使用中遇到的問題。

這些案例多半起於具體限制：重複性操作太多、現有介面不符合需求、裝置功能失效、模型輸出不穩定，或多人使用後出現原先沒有預期的錯誤。接下來再把問題拆成可驗證的步驟，使用 AI 協助產生初版程式，自己進行測試、修正、補充條件，最後整理成可重複操作的工具與文件。

## Working Method

這類實作大致遵循以下流程：

```text
發現實際問題
        ↓
確認使用情境、限制與預期結果
        ↓
將問題拆成可測試的小步驟
        ↓
使用 AI 協助建立初版程式或修改方案
        ↓
在實際環境中測試
        ↓
依錯誤訊息與使用結果修正
        ↓
補上例外處理、安裝流程與文件
        ↓
整理成可重複使用的工具或 workflow
```

---

## Selected Cases

### Systems and Workflow Projects

#### Endwalker / T7C Interactive Narrative Systems

說明文件：  
[Game / Interactive Narrative Projects](../projects/)

《犬伴求生：末日行者》與《七日終途 -The La7t Correction-》將 AI 文字生成接入 Node.js、狀態管理、API 與前端 UI。

實作內容包含：

* Node.js / Express 後端
* prompt loading 與 packaging
* `userId` 與 `lastStatus` 管理
* 模型輸出格式限制與解析
* 前端故事區與狀態區分離
* reset endpoint
* 互動紀錄 logging
* 背景音樂、狀態欄與 Enter 送出切換
* 虛擬主機部署與維護

這兩個專案的多項功能來自實際使用者回報。例如：

* 使用者未注意到背景音樂被瀏覽器阻擋，因此加入啟動提示。
* 有人不希望播放音樂，因此增加切換功能。
* 有人不想顯示狀態欄，因此將狀態欄改為可切換。
* Enter 送出曾因誤觸被取消，後來又因其他使用者偏好而改成選項。
* 模型回覆有延遲，因此加入新回覆紅點提示。
* 早期多人共用上下文造成角色設定污染，後續才逐步加入 `userId`、伺服器端狀態與 prompt 防污染處理。
* 近期 API 增加歷史訊息限制與 memory 開關後，再補入平台端 context control。

這些修改分別落在 UI、Node.js、prompt、API 與狀態管理層，依照問題實際發生的位置處理。

#### Issue Trace Public Prototype

說明文件：  
[Issue Trace Public Prototype](../projects/issue-trace-public-prototype/)

公開網站：  
[如果有這種議題追蹤器就好了](https://myth.haruz.art/)

這個專案整理公共議題查證與來源追蹤流程的 Web 原型，將 request-driven 投稿、來源搜尋、source map、AI 查證草稿、來源驗證、發布判斷與後台審核拆成可維護的模組。

實作重點包含：

* request-driven 投稿與狀態流轉。
* 外部預搜尋與多組 query 合併。
* 投稿 URL、系統搜尋來源與 AI 回傳來源的 source map。
* 來源數量、來源有效性與 verdict 的發布判斷。
* 搜尋服務 key pool 誤判修正，避免成功內容中的 `token` 字樣燒掉 key。
* 後台審核、重新調查、解除冷卻與 request 控制。
* DirectAdmin Node.js App 環境下的部署與保留資料夾規劃。

公開版本只保留架構文件、範例資料與安全化程式片段，不包含正式站 production code、資料庫、密鑰、完整後台路由或完整 prompt。

#### Belka 3D Showcase

說明文件：  
[Belka 3D Showcase](belka-3d-showcase.md)

公開網站：  
[3D Model Showcase](https://3d.haruz.art/)

這個案例起於我學習 Modly 時，想把匯出的 3D 模型放到可直接分享的網頁。展示站從一開始就是另外製作，沒有使用 Modly API 或特殊檔案格式；現行版本可處理一般 GLB、OBJ、STL 與 PLY。

網站由首頁、`works.json` 作品清單、共用 3D 檢視器，以及各作品的模型與原圖資料夾組成。訪客點進作品頁後才下載對應模型；旋轉、縮放、材質切換、輪廓與模型資訊都由瀏覽器處理，因此一般靜態網站主機就能部署，不需要 Node.js 背景程序、API 或資料庫。

作品數量增加後，原本的手動發布步驟另外整理成 Belka 3D Showcase Manager。管理工具在下方的 Small Tools and Workflow Helpers 另行說明；完整 Case Note 則保留網站架構、部署、載入調整與錯誤排查的整體脈絡。

#### Enabling Hunyuan Texture Generation in Modly

說明文件：  
[Enabling Hunyuan Texture Generation in Modly](enabling-hunyuan-texture-generation-in-modly.md)

這個案例起於 Modly 安裝版的 Hunyuan3D Mini 介面沒有提供 Texture 選項，但擴充套件後端已包含 Hunyuan Paint 路徑。

實作與排查包含：

* 在 `manifest.json` 加入 `enable_texture` 參數。
* 補齊 xatlas、GLB 處理與建置相依項。
* 在 Windows 編譯 `custom_rasterizer` 與 `mesh_processor`。
* 處理 Diffusers 自訂 pipeline 權限與 UNet 類別路徑不一致。
* 保留官方 `.bin` loader，撤回不相容的 safetensors 嘗試。
* 使用 CPU offload 讓 Hunyuan Paint 在 RTX 2080 8GB 環境完成輸出。
* 分辨 VAE fallback 與 Turbo timestep 警告，避免把非致命訊息誤判成生成失敗。

目前成果保留為版本特定的 Case Note，沒有重新散布第三方套件與模型權重。

#### Prompt Module Development

說明文件：  
[`prompting/README.md`](../prompting/README.md)

Prompting 相關實作同樣使用版本與補丁方式整理。

案例包括：

* 將新聞撰稿規格拆成可重複的工作 prompt
* 從 GPT 語言去魅對照表發展出語氣自我檢查模組
* 將大型 prompt 拆成基底模組與可選補丁
* 依公開測試修正模式選擇被覆蓋的問題
* 保留輸出 Demo，同時不公開完整京都腔與低溫剝皮 prompt

相關文件主要記錄任務邊界、載入順序、觸發條件、固定輸出格式、版本差異與實測後補丁。

### Small Tools and Workflow Helpers

#### YouTube Thumbnail Cropper

路徑：  
[`tools/youtube-thumbnail-cropper/`](../tools/youtube-thumbnail-cropper/)

這個工具用來處理影音工作中的重複性素材整理。

原始需求包含：

* 依 YouTube 連結抓取縮圖
* 使用影片標題命名
* 裁切成固定尺寸
* 減少手動另存、重新命名與裁圖的步驟

這類工作單次操作並不困難，但在新聞與影音製作中反覆出現時，容易累積大量機械性時間。程式負責抓取、命名與裁切等固定步驟，剪輯與編輯判斷仍留在原有工作流程中。

#### Belka 3D Showcase Manager

路徑：  
[`tools/belka-3d-showcase-manager/`](../tools/belka-3d-showcase-manager/)

這個工具承接 Belka 3D Showcase 的本機內容管理與發布流程，將原本需要手動處理的資料夾、作品清單與 ZIP 打包步驟集中到 Windows 圖形化介面。

主要功能包含：

* 新增、更新與重新命名作品
* 更換模型與原始參考圖
* 上架、下架、刪除與本機封存
* 從公開網站同步 `works.json`
* 產生增量更新 ZIP
* 產生完整網站部署包
* 啟動本機預覽
* 修復舊 ZIP 的 Windows 路徑格式

介面以 PowerShell WinForms 製作，一般使用者透過 CMD 啟動即可。工具同時保留 Viewer 可讀原始碼、固定套件版本與第三方授權文件，方便重建及公開散布。

完整的網站與工具演進請見：  
[Belka 3D Showcase](belka-3d-showcase.md)

#### MSI Claw RGB Slot GUI

路徑：  
[`tools/msi-claw-rgb-slot-gui/`](../tools/msi-claw-rgb-slot-gui/)

此工具源自 MSI Claw A1M 在特定控制器韌體版本下，Mystic Light 無法正常控制按鍵燈與燈環顏色的問題。

實作過程包含：

* 透過 `hidapitester.exe` 測試 HID payload
* 整理 slot 與實際燈區的對應
* 確認顏色 channel mapping
* 將測試結果包裝成 PowerShell GUI
* 加入亮度、Quick Fill、Save／Load preset 等功能
* 將第三方依賴改為獨立安裝流程
* 補上 PATH fallback、`.gitignore` 與 README

除了 GUI，這個案例也整理了硬體測試、協定推測、外部工具依賴與可重現的安裝流程。

#### MSI Claw Mode Switcher

路徑：  
[`tools/msi-claw-mode-switcher/`](../tools/msi-claw-mode-switcher/)

此工具源自 MSI Claw A1M 將傳統 Win32 小視窗或原本不支援最大化的視窗強制撐滿，以及修改裝置姿態後部分觸控操作失效的取捨問題。

實作與排查包含：

* 排除 Xbox Full Screen Experience、Windows Snap 與 PowerToys 等可能原因
* 透過 `Win + ↓` 確認視窗可由 Windows shell 配置狀態還原
* 實機驗證 `ConvertibilityEnabled = 0` 對視窗行為的影響
* 確認刪除覆蓋值後，Windows／MSI 會恢復裝置姿態自動判定
* 將目前狀態、登錄切換與 Explorer 重啟包裝成 PowerShell GUI
* 加入權限提升、錯誤訊息與 Debug 啟動流程
* 因 VBScript 引擎相容性問題移除 VBS 啟動器，改以 CMD 作為一般入口
* 向 Microsoft Feedback Hub 提交問題回報

這個案例保留兩種模式與各自副作用，重點在於將系統層問題拆成可驗證步驟，並把一次性的登錄操作整理成可逆、可讀取狀態的工具。

#### Belka Firefox Add-on Order Helper

路徑：  
[`tools/belka-firefox-addon-order-helper/`](../tools/belka-firefox-addon-order-helper/)

這是一組直接在 Firefox `about:addons` Web Console 執行的 console hack，用來調整擴充套件拼圖按鈕中的項目順序。

開發過程包含：

* 讀取既有 DOM 結構
* 尋找可重新排序的節點
* 將原始腳本改成繁體中文介面
* 增加拖曳／排序輔助
* 加入備份輸出
* 加入可貼入備份內容的還原介面
* 保留可直接在 console 執行的形式

此工具最後保留 console hack 形式，未包裝成完整擴充套件；需求只發生在特定頁面與操作情境中，較輕量的形式也較容易維護。

#### Animad WSA Fullscreen Helper

路徑：  
[`tools/animad-wsa-fullscreen/`](../tools/animad-wsa-fullscreen/)

此工具處理巴哈姆特動畫瘋 App 在 Windows Subsystem for Android 環境中的啟動與全螢幕流程。

原始問題需要依序處理多個步驟：

1. 啟動 WSA App
2. 等待視窗出現
3. 切換到正確前景視窗
4. 執行全螢幕操作
5. 處理啟動時間與視窗狀態差異

因此實作上將 ADB、Windows GUI automation 與等待條件串在一起，形成可重複執行的工作流程。

#### Gmail 隱藏回報垃圾郵件按鈕

路徑：  
[`tools/gmail-hide-report-spam-button/`](../tools/gmail-hide-report-spam-button/)

這個 userscript 源自 Gmail 郵件整理過程中的誤觸問題。對於很少使用「回報垃圾郵件」功能的操作情境，工具會透過 CSS 隱藏對應按鈕，降低誤按後改變郵件分類的風險。

實作內容包含：

* 使用 userscript 管理工具載入程式
* 透過 `GM_addStyle` 注入 CSS
* 使用 Gmail 現行 DOM 屬性定位按鈕
* 限定 selector 只處理具有 `role="button"` 與 `act="9"` 的元素
* 保留停用 script 後恢復原始介面的方式
* 記錄 Gmail 改版可能造成 selector 失效的限制

這個案例的程式規模很小，但呈現了從日常操作問題出發，選擇符合需求規模的實作方式，而不必為單一介面調整建立完整瀏覽器擴充套件。

#### ChatGPT Promo Cards Hider

路徑：  
[`tools/chatgpt-codex-promo-hider/`](../tools/chatgpt-codex-promo-hider/)

這個 userscript 用來隱藏 ChatGPT 回覆後動態插入的 Codex、Pro 與外掛程式資訊提示卡。

開發過程包含：

* 初版依提示卡文字往上尋找容器，曾選到過大的上層元素並造成整頁空白。
* 加入 `html`、`body`、`main`、輸入區與 contenteditable 等危險容器排除。
* 改為選取最大的安全候選，解決只隱藏內層內容後留下空白外框的問題。
* 將 Codex、Pro 與外掛程式資訊卡整理成獨立 `PROMOS` 規則，每組分別設定 anchors、必要文字、輔助文字與最低命中數。
* 使用容器尺寸與文字長度限制，排除整頁結構及過小的單一文字節點。
* 加入 `MutationObserver`、interval fallback、緊急停用快捷鍵與 console 驗證標記。

這個案例顯示介面自動化需要持續確認實際 DOM 邊界。提示卡文案改變時，只更新對應規則即可保留原有的安全檢查與隱藏流程。

---

## AI Use and Manual Validation

這些工具與專案有相當一部分使用 AI 協助撰寫、解釋與修改程式，也可以歸類為 vibe coding。

AI 主要用於：

* 建立初版程式
* 解釋既有程式碼與錯誤訊息
* 提出修改方向
* 協助重構、補充例外處理與整理文件

需求定義、功能取捨、實際環境測試、修改方向與後續維護則由我處理。

這些案例涉及 Windows、Firefox Web Console、WSA、ADB、PowerShell、HID 裝置、Node.js、模型 API、Three.js、靜態網站主機與瀏覽器 UI。程式是否符合預期，仍需回到各自的實際環境中驗證。

測試過程也會進一步形成新的需求，例如：

* 缺少外部執行檔時，工具應如何提示或安裝。
* preset 不存在時，程式是否仍能正常啟動。
* API 操作失敗時，前端是否會錯誤顯示成功。
* 備份內容能否直接還原，避免只在 console 中留下輸出。
* 不同使用者對同一功能的偏好是否需要改成可切換選項。
* JavaScript 依賴檔案缺少時，是否會讓載入狀態與整組控制功能一起失效。
* Windows 產生的 ZIP 能否在 Linux 主機上正確解壓縮。
* 本機設定、模型檔案與公開網站內容是否已明確分開。

## Patterns Across These Cases

這些案例涉及的工具、裝置與使用情境不同，但實作過程中反覆出現幾個共同特徵：

* 問題通常來自實際工作或日常使用，技術選擇則依需求決定。
* 優先製作能驗證需求的小型原型，不一開始就重建完整系統。
* 將重複操作、狀態判斷與固定格式交由程式處理，保留仍需人工判斷的部分。
* 依照問題實際發生的位置，分別調整 UI、程式、資料格式、prompt 或 API 設定。
* 透過實機測試、錯誤訊息與使用者回報修正初版。
* 將一次性的解法整理成可重複執行的工具、安裝流程與說明文件。
* 記錄工具目前能處理的範圍，以及仍未處理的限制。

這些工具多半規模不大，也不以成熟產品為前提；文件主要記錄問題如何被拆解、原型如何形成，以及實際測試後又做了哪些修改。

## Keywords

AI-assisted prototyping, vibe coding, digital workflow, workflow automation, rapid prototyping, human-in-the-loop, prompt workflow, UI iteration, state management, static hosting, Three.js, 3D viewer, documentation

## Navigation

* [返回 Case Notes](README.md)
* [返回 Selected Works](../profile/works.md)
* [查看簡歷摘要](../profile/resume-lite.md)
* [返回根 README](../README.md)
