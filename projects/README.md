# Game / Interactive Narrative Projects

本頁整理我做過的 AI 互動敘事／文字遊戲專案，重點放在兩個專案共用的系統架構、個別設計，以及實際使用後的迭代過程。

## Development Lineage

《犬伴求生：末日行者》是較早完成的合作專案；《七日終途 -The La7t Correction-》則是在前者累積的網站、Node.js 與 prompt packaging 經驗上繼續發展。

我最初曾考慮將這套做法整理成通用 AI 敘事遊戲框架，因此兩個專案雖然世界觀與玩法不同，仍共享一組核心結構：

* 前端只負責玩家輸入、畫面呈現與操作選項
* Node.js 後端負責狀態讀寫、prompt 組裝、API 呼叫與回覆解析
* 主要 prompt 與遊戲規則放在外部檔案中，避免直接寫入 HTML、前端程式或 Node.js 主程式
* API key 與模型設定由後端管理
* 每一回合都以伺服器保存的 `lastStatus` 作為角色與世界狀態基準

## Shared Architecture

### Prompt and API Separation

兩個專案都刻意將前端、後端、prompt 與 API 設定拆開處理。

主要 prompt 會在每一回合送往模型，但一般使用者不會在介面中看到。這些內容因此放在後端可讀取的外部 prompt files，並依功能拆成系統規則、遊戲規則、初始化條件、輸出格式與敘事模組。

這樣處理主要基於幾項考量：

* 使用者不需要理解後端的運作方式即可進行遊戲；操作所需的功能與提示都集中在 UI 中。
* 核心 prompt 封裝在後端，可降低使用者反向探查系統規則，或要求模型輸出隱藏 prompt 內容的風險。
* 避免使用者透過輸入內容覆寫原定任務，將模型算力挪作與遊戲無關的用途，例如要求模型協助撰寫其他程式。
* 遊戲規則與語氣規則可以獨立修改，不必與 HTML 或 Node.js 主程式綁定。
* 不同專案可以抽換個別 prompt 模組，同時保留共通的後端流程。
* API key、模型設定與風控邏輯集中由後端管理。
* UI、狀態管理、prompt 與 API 問題可以分別在對應層級處理。

### Shared Request / State Flow

玩家在瀏覽器中輸入行動指令。前端會一併送出本地保存的 `userId`，但不會把角色狀態當成可信資料交回後端。

Node.js 會依照 `userId` 讀取該玩家目前的 `lastStatus`，再把玩家指令、隱藏的系統 prompt、遊戲規則與固定狀態格式包成完整請求送往模型。

```js
// simplified request / state flow

browser.send({ userId, userInput });

lastStatus = server.loadStatus(userId);

fullPrompt = combine(
  hiddenSystemPrompt,
  gameRules,
  userInput,
  lastStatus,
  requiredStatusFormat
);

aiReply = callModel(fullPrompt);

story, newStatus = parse(aiReply);
server.saveStatus(userId, newStatus);

formattedReply = formatForBrowser(story, newStatus);
browser.render(formattedReply);
```

AI 負責依照規則生成敘事與下一回合狀態；Node.js 則負責讀取、組裝、解析、保存，以及將模型輸出整理成前端能固定處理的格式。

模型回覆中的狀態部分必須遵循固定欄位的結構化文字格式，例如：

```text
故事內容……

status={
基本：……
生存：……
時間：……
世界：……
}
```

後端完成解析與格式整理後，再將結果回傳前端。瀏覽器會依固定標記把內容分為故事區與狀態區；玩家可以依需求切換狀態欄，但下一回合實際使用的狀態仍以伺服器保存內容為準。

### Context Isolation: Development History

目前的伺服器端 `lastStatus` 架構源自《犬伴求生：末日行者》的實際多人使用經驗。

早期版本主要依賴模型原有的對話上下文延續劇情，伺服器尚未替每位玩家保存獨立的角色狀態。當時曾發生一名玩家要求生成獸人角色後，其他玩家的角色與故事也陸續被帶入相似設定的情況。

這次事件促使我加入：

* 瀏覽器端保存的 `userId`
* 依 `userId` 區分玩家資料
* 伺服器端狀態儲存
* 每回合重新注入模型的 `lastStatus`
* 固定格式的狀態輸出與解析流程

改由伺服器提供每位玩家各自的 `lastStatus` 後，模型不再只靠共用聊天上下文判斷目前角色與世界，跨玩家污染問題因而大幅減少。

後續仍偶爾出現舊世界、角色設定或其他對話脈絡被重新帶入的情況，因此又陸續加入記憶隔離指令、初始化規則與 prompt 防污染措施。

2025 年 5 月，我曾向 1min.ai 詢問 API 是否能提供 stateless request、記憶重置或個別 session 隔離。當時客服回覆尚未支援此類功能。

近期 1min.ai API 增加歷史訊息數量限制與跨對話 memory 開關後，我也立即將這些設定加入目前版本，進一步降低平台端既有上下文干擾本地 `lastStatus` 的可能性。

### Current State Ownership and Memory Control

目前的設計原則是：

* 角色、世界、時間與進度以伺服器保存的 `lastStatus` 為準。
* 模型歷史只作為最低限度的短期語境，不作為遊戲狀態來源。
* 初始化所需的附加 prompt 只能影響當次 request，不能改寫所有玩家共用的 prompt 模板。

其中一項近期修正，是避免在單次 request 中直接改寫全域 `prefixPrompt`：

```js
let effectivePrefixPrompt = prefixPrompt;

if (shouldInitialize(lastStatus)) {
  lastStatus = "無";
  effectivePrefixPrompt += initializationInstruction;
}
```

`effectivePrefixPrompt` 只存在於當次 request，不會把初始化提示永久追加到整個 Node.js process 共用的原始 prompt。

模型 API 端則會在每次請求中限制歷史訊息使用量，並將跨對話 memory 設為關閉：

```js
settings: {
  historySettings: {
    isMixed: false,
    historyMessageLimit: 1
  },
  withMemories: false
}
```

這幾層處理各自負責不同範圍：

* `userId`：區分不同玩家。
* `lastStatus`：保存並提供每位玩家目前可信的遊戲狀態。
* prompt 防污染規則：降低模型把不相關設定帶入當前回合的可能性。
* request-scoped prompt：避免單一玩家觸發的初始化指令污染整個 Node.js process。
* history 與 memory 設定：限制 API 平台端既有上下文對本地狀態的干擾。

### Shared Technical Scope

兩個專案共通的實作範圍包含：

* Node.js / Express 後端建置
* 1min.ai API 串接
* prompt loading 與 prompt packaging
* `userId` / session 管理
* `lastStatus` 狀態持久化
* `status={...}` 結構化輸出解析
* fallback status extraction
* reset endpoint
* 互動紀錄 logging
* 前端故事區與狀態區分離
* 背景音樂、狀態欄與 Enter 送出的切換功能
* 虛擬主機部署與維護

---

## 犬伴求生：末日行者

URL：  
https://endwalker.haruz.art/

### Project Type

AI 互動敘事文字遊戲合作專案。

### Role

此專案由我與友人合作完成。

友人負責世界觀架構與遊戲規則規劃；我負責將這些設定轉成可運作的網站，包括前後端實作、prompt 打包、API 串接、UI 設計與部署維護。

### Project-specific Design

專案以末日生存與狗狗夥伴為核心，prompt 結構包含：

* 角色初始化規則
* 狗狗夥伴資訊欄位
* 生存、戰鬥與事件處理模組
* 敘事中斷與重大失敗處理
* 末日世界觀與勢力設定
* 角色死亡後的重製／狗視角繼承機制

這是共通架構較早完成的實作版本，也成為後續 T7C 開發時的重要基礎。

### What I handled

* 將友人規劃的世界觀與規則轉成可執行的 prompt 與網頁流程
* 網站前後端實作
* UI 設計與操作流程調整
* prompt 模組打包與載入
* API 串接與回覆解析
* 虛擬主機部署與維護

---

## 七日終途 -The La7t Correction-

URL：  
https://t7c.haruz.art/

### Project Type

AI 互動敘事／生存模擬文字遊戲專案。

### Role

此專案由我獨立完成。

遊戲規則、prompt 設計、狀態欄結構、前後端流程、API 串接與網站部署皆由我自行規劃與實作。

### Project-specific Design

T7C 的核心是「七日制」AI 互動敘事系統。

玩家扮演修正旅者，在不同崩壞世界中醒來，透過探索、行動、戰鬥與修正點處理，在七天內嘗試阻止世界崩壞。

專案特有結構包含：

* Narrative Operator 角色設定
* 七日限制與世界崩壞規則
* 角色創建流程
* 1d100 與小型擲骰規則
* traveler status 結構
* 世界主題池與世界初始化規則
* 異象、修正點、敵人與事件規則
* 穿越紀錄、成功／失敗紀錄與成長欄位
* 記憶隔離與 session reality isolation
* 角色尚未初始化時的強制初始化流程

### Prompt Modules

T7C 的後端主要載入兩類外部 prompt 模組：

* 系統 prompt 模組：處理語系限制、記憶隔離、角色初始化、世界初始化、輸出格式與狀態規則。
* 遊戲 prompt 模組：處理 T7C 世界觀、遊戲規則、擲骰檢定、世界主題池、事件與敘事模組。

這種拆法讓共通框架與專案規則可以分開維護，也方便後續針對 prompt 污染、狀態格式或個別模組進行調整。

### What I handled

* 遊戲規則與狀態欄設計
* prompt 模組化與敘事流程規劃
* 網站前後端實作
* API 串接與模型回覆解析
* UI 設計與使用流程調整
* 污染控制與 reset 流程修正
* 虛擬主機部署與維護

---

## User Feedback / Iteration History

兩個專案經過多輪修改。多項調整來自實際使用者回報、多人測試時發生的錯誤，以及後續對模型與應用程式邊界的重新理解。

| 問題或需求 | 處理層級 | 後續調整 |
|---|---|---|
| 早期共用上下文造成某位玩家的獸人設定擴散至其他玩家 | Node.js／狀態管理 | 導入 `userId`、伺服器端狀態儲存與每回合 `lastStatus` 回注 |
| 部分使用者不知道瀏覽器阻擋了背景音樂自動播放 | UI | 加入點擊畫面後啟動音樂的提示 |
| 部分使用者不希望播放背景音樂 | UI | 將背景音樂改為可切換功能 |
| 部分使用者不希望持續顯示角色狀態 | UI | 將狀態欄改為可切換功能 |
| Enter 送出容易造成誤送，但部分使用者偏好鍵盤快速操作 | UI | 先取消 Enter 送出，後續改為由使用者自行切換 |
| 模型回覆存在延遲，使用者可能沒有注意到新內容已完成 | UI | 在送出按鈕加入閃爍紅點，提示已有新回覆 |
| 單一玩家的初始化判定會永久追加到共用 `prefixPrompt` | Node.js／prompt packaging | 改用每次 request 各自建立的 `effectivePrefixPrompt` |
| 角色重置與畫面清除的結果不夠明確 | UI／API handling | 檢查 reset response、區分後端角色重置與前端畫面清除，並同步清除狀態欄與暫存回覆 |
| API 平台端仍可能帶入既有對話脈絡 | API／context control | 在 1min.ai 提供相關功能後，加入 history limit 與跨對話 memory 關閉設定 |

## Versioning and Recent Maintenance

早期開發尚未導入正式版本控制，主要以日期命名的 Node.js 與 HTML 備份檔保存修改紀錄；目前正式服務端仍沿用這套方式留存不同版本。

2026 年 6 月的整理包含：

* 將初始化提示改為 request-scoped，修正全域 `prefixPrompt` 污染。
* 明確關閉模型跨對話 memory 機制，並限制歷史訊息使用量。
* 修正角色重置後，狀態欄與前端暫存回覆未同步清除的問題。
* 加入 HTTP response 檢查，避免後端重置失敗時，前端仍顯示成功結果。
* 重新整理角色重置與畫面清除的確認訊息。

## Implementation Summary

兩個專案目前涵蓋：

* 將 prompt、狀態管理與 Web backend 接成可操作服務
* 要求模型依固定結構輸出狀態資料，再由後端解析、保存並整理為前端可讀格式
* 依照實際錯誤判斷問題應在 UI、Node.js、prompt 或 API 層處理
* 針對上下文污染、狀態殘留與模型格式失敗設計補救機制
* 將使用者回報轉成可驗證的功能修改
* 從合作專案累積架構，再延伸成獨立完成的專案

## Implementation Keywords

Node.js, Express, 1min.ai API, prompt packaging, AI-assisted prototyping, interactive narrative, text-based game, status persistence, session management, output parsing, fallback extraction, request-scoped prompt, UI iteration, web prototype, hosting maintenance

## Navigation

* [返回 Selected Works](../profile/works.md)
* [返回根 README](../README.md)
