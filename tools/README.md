# Tools

本資料夾整理我依實際工作、裝置操作與個人使用需求規劃，並使用 AI 協助撰寫、測試與修正的小型工具。

完整的問題拆解、原型開發與測試方法另見：

[Digital Workflow Prototyping](../case-notes/digital-workflow-prototyping.md)

## Tool Index

### [YouTube Thumbnail Cropper](youtube-thumbnail-cropper/)

抓取 YouTube 縮圖、依影片標題命名，並裁切成固定尺寸。這項工具直接源自影音新聞與 YouTube 作品整理流程中的重複操作。

### [Belka 3D Showcase Manager](belka-3d-showcase-manager/)

一套可轉發的靜態 3D 作品站與 Windows 圖形化管理工具，可在本機新增或更新作品、預覽網站，並產生增量更新 ZIP 或完整網站部署包。

### [MSI Claw RGB Slot GUI](msi-claw-rgb-slot-gui/)

透過 HID payload 控制 MSI Claw A1M 的按鍵與燈環顏色，並整理成 PowerShell GUI、依賴安裝與 preset 流程。

### [MSI Claw Mode Switcher](msi-claw-mode-switcher/)

切換 Windows 的 `ConvertibilityEnabled` 覆蓋值，用於處理傳統小視窗被強制撐滿，並在需要時恢復原廠裝置姿態與觸控行為的自動判定。

### [Belka Firefox Add-on Order Helper](belka-firefox-addon-order-helper/)

在 Firefox `about:addons` Web Console 中調整擴充套件項目順序，並提供備份與還原介面。

### [Animad WSA Fullscreen Helper](animad-wsa-fullscreen/)

串接 ADB、Windows Subsystem for Android 與視窗操作，完成動畫瘋 App 的啟動與全螢幕流程。

### [Gmail 隱藏回報垃圾郵件按鈕](gmail-hide-report-spam-button/)

透過 userscript 與 CSS 隱藏 Gmail 的「回報垃圾郵件」按鈕，降低整理郵件時誤觸的機會。

### [ChatGPT Codex Promo Hider](chatgpt-codex-promo-hider/)

透過 Tampermonkey userscript 隱藏 ChatGPT 網頁中動態插入的 Codex 提示卡，並保留安全容器排除、完整外框選取、MutationObserver 與緊急停用流程。

## Navigation

* [返回 Selected Works](../profile/works.md)
* [返回根 README](../README.md)
