# Legacy Notepad Upstream PR

## Background

我原本在 Windows 11 新版 Notepad 中遇到 Alt key 與輸入法快捷鍵互相干擾的問題。PowerToys 無法精準處理這類事件層級的焦點問題，因此開始尋找更接近舊版 Notepad 的輕量替代品。

Legacy Notepad 符合需求：啟動快、功能集中、以 C++ / Win32 API 實作，定位接近傳統純文字編輯器。

## Goal

這次修改目標很小：

1. 新增正體中文介面。
2. 讓自動換行設定能在重新啟動後保留。
3. 維持原本輕量、低干擾、不加入額外功能的設計方向。

## Contribution

PR：  
[forloopcodes/legacy-notepad#33](https://github.com/forloopcodes/legacy-notepad/pull/33)

主要修改：

1. 新增 Traditional Chinese / zh-TW 作為第三語言選項。
2. 新增正體中文 UI 字串，對齊台灣 Windows / Notepad 常用語。
3. 保存 Word Wrap 偏好，讓使用者重新開啟程式後仍保留設定。
4. 修正 Redo command behavior。
5. 調整本地化後的 dialog layout 與 labels。
6. 以小版號標記 fork patch version。

## What This Demonstrates

這個案例展示了幾個能力：

1. 從個人使用痛點追到可貢獻的開源專案。
2. 閱讀 C++ / Win32 專案結構並定位語言、設定與指令模組。
3. 使用 fork、branch、commit、pull request 參與既有 repo。
4. 在不擴張功能範圍的前提下，做小而清楚的 product fit 修正。
5. 以正體中文本地化標準處理 UI 用語，而非單純直譯。

## Status

PR opened. Waiting for upstream review.

## Navigation

* [Back to Case Notes](README.md)
* [Selected Works](../profile/works.md)
* [Root README](../README.md)
