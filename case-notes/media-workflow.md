# Media Workflow

本頁整理我在影音新聞、現場採訪與內容製作中使用的工作流程，並記錄後續加入的轉錄、音訊分離與 AI 輔助工具。

相關作品集中整理於：

* [Selected Works](../profile/works.md)
* [影音與新聞作品集](https://linktr.ee/jacksunexe)

## Scope

過往影音工作涵蓋：

* 壹傳子／即時V新聞（VTuber 短影音新聞）
* 新聞與專題長片
* 汽車發表與產品介紹
* 旅遊、美食與生活內容
* 醫療人物與活動紀錄
* YouTube 上架、標題、描述與素材整理

依題材與製作條件不同，實際工作可能包含資料查找、現場攝影、採訪素材整理、口白撰寫、剪輯、音訊處理與平台上架。

## Common Workflow

```text
接收題目或採訪資訊
        ↓
確認來源、背景與交付規格
        ↓
整理腳本方向與畫面需求
        ↓
現場拍攝或蒐集素材
        ↓
轉錄、挑選內容與建立剪輯結構
        ↓
剪輯、音訊處理與畫面補充
        ↓
確認長度、資訊與口吻
        ↓
撰寫標題、描述並完成上架
        ↓
保存素材與可重複使用的工作紀錄
```

## 壹傳子／即時V新聞

「壹傳子」是壹傳媒短影音新聞 VTuber 企劃；「即時V新聞」是該企劃實際產出的短篇新聞內容與既有欄目稱呼。

2023 年 2 月至 2025 年 11 月期間，我主導此企劃與主要製作流程，將 VTuber 技術導入新聞短影音內容。角色立繪以 Stable Diffusion 生成，並使用 Live2D Cubism 完成角色建模、透過 VTube Studio 進行動作捕捉，再結合新聞素材、文字、影音剪輯與 AI 播報語音生成，完成短篇新聞影片。

短篇V新聞通常需要在有限時間內完成資料整理、口白與影片製作。早期製作需符合 Shorts 約一分鐘以內的篇幅限制，因此工作流程會特別重視資料壓縮、口播節奏與必要資訊保留；後續這也成為短影音新聞的固定利基。

常見處理內容包括：

* 確認新聞來源與事件時間線
* 將資料壓縮成約一分鐘可完成的口播篇幅
* 保留必要數字、地名、人名與背景資訊
* 依素材狀況安排旁白、照片、影片與圖卡
* 完成剪輯、標題、描述與 YouTube 上架

VTuber 與 AI 製作流程包含：

* 以 Stable Diffusion 生成角色視覺基礎
* 使用 Live2D Cubism 製作可動角色模型
* 透過 VTube Studio 進行角色動作捕捉與錄製
* 以 AI 語音工具產生或測試播報語音
* 將角色畫面、新聞素材、字幕、圖卡與口白整合為短篇新聞影片

口白以新聞播報語氣為主，避免過度宣傳式形容。資料壓縮時優先保留事件因果、具體數字與理解議題所需的背景。

## Long-form and Feature Content

長片與專題內容會依採訪素材重新建立敘事順序。

常見步驟包含：

1. 將訪談或現場素材轉錄。
2. 標記可用段落、關鍵數字與代表性發言。
3. 依主題重新排列段落。
4. 補入旁白、畫面或背景資料。
5. 調整節奏、音量與字幕需求。
6. 確認影片標題、說明與上架資訊。

Whisper 可協助產生初步逐字稿；實際採用的段落、語意判斷與剪輯節奏仍由人工確認。

## Static Car Launch Workflow

新車發表內容常受現場條件限制，部分案件只能進行靜態拍攝、車輛啟動與電子配備展示。

相關工作型 prompt：  
[新車發表專家](../prompting/new-car-launch-expert/)

我的處理流程分為三個階段：

### 1. Vehicle Information

先整理車型、外觀、動力、空間、安全、配備與售價資料，並區分現場可驗證內容與原廠提供規格。

### 2. Static Shot Plan

依展場、車輛位置與可操作項目安排：

* 車頭、車側與車尾
* 燈組、輪圈與外觀細節
* 座艙、螢幕、座椅與收納
* 後座、行李廂與空間變化
* 車輛啟動及電子功能展示

### 3. Voice-over and Edit

現場素材確認後，再依實際拍到的內容撰寫口白。這樣可以避免口白提到現場缺少的畫面，也能依素材完整度調整篇幅與敘事順序。

## High-noise Field Audio Cleanup

案例影片：

[查看處理後影片](https://www.youtube.com/watch?v=eiTSVn5lCJM)

原始現場有數十人交談，主要語音受到大量人聲與環境噪音干擾。我使用 Ultimate Vocal Remover 進行音源分離與語音抽取，再將處理後素材帶回剪輯流程。

這類處理會依素材狀況調整：

* 比較不同分離模型的結果
* 保留主要說話者的可懂度
* 降低群眾交談與環境聲干擾
* 檢查分離後的金屬感、破音與語音缺損
* 搭配 Audacity 或剪輯軟體進行後續音量與片段調整

Ultimate Vocal Remover 也可用於人聲、音樂與背景聲分離。實際使用時仍需逐段確認結果，避免模型把目標語音一併削除。

## AI-assisted Media Tools

### Whisper

* 採訪與長片素材初步轉錄
* 快速搜尋人名、關鍵句與段落
* 協助建立剪輯用文字索引

### Ultimate Vocal Remover

* 音源分離
* 語音抽取
* 高噪音現場素材清理
* 人聲、音樂與背景聲比較測試

### GPT-SoVITS

* 語音與配音測試
* 本地端聲音模型實驗
* 內容製作流程中的替代語音評估

### Large Language Models

* 資料與訪談內容初步整理
* 腳本結構與標題候選
* 固定格式檢查
* 工作流程文件化

## Manual Checks

AI 與自動化工具產出的內容會再進行人工確認，包含：

* 來源與數字是否正確
* 逐字稿是否誤判人名或專有名詞
* 音源分離是否損傷主要語音
* 口白是否符合實際畫面
* 影片長度與節奏是否符合交付需求
* 標題與描述是否準確反映內容
* 第三方素材、畫面與個人資訊是否適合公開

## Tools

### Video / Audio

* Magix Vegas Pro
* Audacity
* Whisper
* Ultimate Vocal Remover
* GPT-SoVITS

### VTuber Production / Character

* Stable Diffusion
* Live2D Cubism
* VTube Studio
* AI voice generation

### Supporting Workflow

* YouTube Thumbnail Cropper
* AI-assisted transcription and script organization
* 檔案命名、素材整理與上架流程

## Navigation

* [返回 Case Notes](README.md)
* [返回 Selected Works](../profile/works.md)
* [查看簡歷摘要](../profile/resume-lite.md)
* [返回根 README](../README.md)
