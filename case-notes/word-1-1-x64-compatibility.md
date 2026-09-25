# Microsoft Word 1.1a x64 Compatibility Experiments

## Background

這個案例使用 [HaruLerrz/msword](https://github.com/HaruLerrz/msword) 進行。該 repo 建立在 Microsoft Word for Windows 1.1a 的既有 native x64 port 上，原專案已經包含原始 Word C 程式與資源，以及為現代 Windows 補上的 x64 runtime、Win16 相容層與 CMake build 流程。

我的工作集中在自己的 fork 中進行 build、問題定位、相容性排查與修正實驗。這份紀錄不把原專案的完整 x64 port 歸為自己的成果，主要保留我進入 legacy codebase 後如何理解問題、隔離實驗、比較修正、重新 build 與實機驗證的過程。

## Build and Experiment Isolation

初期先確認 fork、upstream 與 x64 build 流程，將實驗留在獨立 branch，避免直接把測試性修改混入 `main`。曾使用的實驗線包含：

* `x64-build-test`
* `x64-clipboard-debug`
* `x64-font-render-debug`
* `x64-unicode-font-name-fix`
* `x64-ufont-font-loading-fix`
* `x64-font-unicode-fix`

不同方向也透過 Git worktree 分開處理，使各條修正可以使用獨立 working tree、build 輸出與 diff。AI 會協助閱讀舊程式、提出可能修正與比較方案；實際保留哪一條修改，仍以 build、人工操作、錯誤重現與 diff 檢查為準。較可行的修改再透過 cherry-pick 整理到後續測試線，無效或副作用較大的方向則撤回。

這套做法也用在既有修正的取用上：先把 upstream 或其他 branch 的特定 commit 帶入測試 branch，再重新 build，而不直接把整條開發歷史混在一起。

## Compatibility Issues

### x64 Build and Legacy Win16 Behavior

Word 1.1a 的原始程式建立在 Win16 時代的 API 與 UI 假設上。native x64 port 已經處理大量底層轉換，但在現代 Windows 執行時仍可能碰到不再需要或行為不同的舊路徑。

其中一個實驗將原本會修改 window system menu 的 Win16 行為在 x64 build 中跳過，保留應用程式主要功能，避免非必要的 legacy customization 影響現代環境。

相關 commit：

* [`4809942` — Skip legacy system menu customization on x64](https://github.com/HaruLerrz/msword/commit/480994286bdede8e3d0ab513017aa909fbadd943)

### Font Selection with Modern Windows Font Tables

原始 Word 的字型資料結構建立在較小的字型集合與 one-byte font-map index 上。現代 Windows 可以列舉數百個字型，舊資料結構的容量假設因此會直接影響 x64 port 的字型選擇。

排查過程需要同時理解：

* legacy font table 與 `IBSTFONT` / `ibstFontNil` 的限制
* 現代 Windows 字型列舉數量
* 文件使用字型何時加入 master table
* x64 compatibility layer 如何把 UI 選擇映射回原始 Word 的 document font map

其中一條修正限制 x64 啟動時預載的字型數量，為文件實際使用的字型保留 legacy index 空間；同時處理舊 cache 可能帶回過大 font table 的情況。

相關 commit：

* [`544af36` — Fix x64 font selection with large Windows font tables](https://github.com/HaruLerrz/msword/commit/544af363d776dc6603d4eecfca7d57e3ebf8ae35)

### Unicode Font Names and Wide / Legacy Boundaries

另一組問題出現在現代 Windows 的 Unicode 字型名稱與原始 Word backend 的 legacy string representation 之間。

實驗方向包含：

* 使用 wide Win32 API 列舉與顯示現代字型名稱
* 在 formatting toolbar 保留 Unicode font name
* 將無法無損轉成系統 ANSI code page 的名稱映射成 backend alias
* 在 UI display name、legacy backend key 與實際字型載入之間建立明確對應
* 避免 UI 能顯示字型名稱，但原始 backend 無法正確選取或建立字型

相關 branch / commit：

* [`956bdc1` — Preserve Unicode font names in the formatting toolbar](https://github.com/HaruLerrz/msword/commit/956bdc1338c0c1cc058b43146f1956042cffb410)
* [`b3374a4` — Render Unicode font aliases through wide font loading](https://github.com/HaruLerrz/msword/commit/b3374a49a74d6ac1aab7f114fb6e7f80623a3010)
* [`a2ac06d` — Integrate Unicode font display with wide font loading](https://github.com/HaruLerrz/msword/commit/a2ac06de90f6319c6ab8e38d2652de540f160ebc)

這些 commit 位於 fork 的實驗 branch，用來保留排查與驗證過程；列在這裡不代表已被原 upstream 採用。

## Font Rendering Debugging

字型問題的排查並未把畫面異常直接當成文字資料損壞。實機測試曾出現英數與符號顯示為方塊、中文字仍能顯示的情況；切換字型後顯示恢復，再切回原字型也可能恢復。

這類現象讓排查方向轉向「字型選擇、建立與 rendering 狀態」，再回頭縮小到 formatting toolbar、font table 與 x64 font-loading path。為了避免把 debug instrumentation 一起帶進修正，乾淨 branch 只保留最小必要 diff，log 與測試用輸出在確認後移除。

## Working Method

這一輪實驗大致採用以下流程：

```text
在既有 x64 port 中重現問題
→ 確認問題位於 build、legacy API、字型資料或 UI / backend 邊界
→ 閱讀相關 legacy C 與 x64 compatibility code
→ 建立獨立 branch / worktree
→ 使用 AI 協助理解程式與提出修正方向
→ 比較不同修改與副作用
→ CMake / Visual Studio build
→ 在實際 Windows 環境操作驗證
→ 檢查 diff 與修改範圍
→ cherry-pick 保留修正，或撤回不合適的方向
```

這裡的 AI 輔助主要用來加快陌生 codebase 的閱讀與假設形成。是否採用某個方案，仍回到 build 是否成功、原始行為是否保留、實際 UI 是否正常，以及修改是否引入新的相容性問題。

## What This Demonstrates

這個案例主要記錄：

* 進入規模較大、歷史包袱明顯的 legacy C / Win32 codebase，逐步理解原始程式與 x64 compatibility layer 的邊界。
* 從實際 build 與 UI 問題定位舊 API、資料結構、font rendering、Unicode / encoding 與 modern Windows compatibility 問題。
* 使用 branch / worktree 隔離不同實驗，降低多條 AI 輔助修正互相污染的風險。
* 透過 cherry-pick、revert、乾淨 diff 與獨立 build 保留可追蹤的修正歷史。
* 將 AI 產生的程式建議視為待驗證方案，再用本機 build、實際操作與 edge case 檢查決定是否保留。
* 在不是自己從零建立的系統中，依問題逐步找到可修改的位置並完成可驗證的修正。

這份案例用來補充 AI application / product prototyping 之外的工程實作證據，不將這些經驗描述成正式軟體工程師年資，也不把自己定位為資深 C / C++ 工程師。

## Navigation

* [開啟 msword fork](https://github.com/HaruLerrz/msword)
* [返回 Case Notes](README.md)
* [返回 Selected Works](../profile/works.md)
* [查看簡歷摘要](../profile/resume-lite.md)
* [返回根 README](../README.md)
