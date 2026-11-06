# Animad WSA Fullscreen Helper

用於在 Windows Subsystem for Android 環境下，自動啟動巴哈姆特動畫瘋 App，並切換到全螢幕的小型 Python 工具。

我在 MSI Claw 上用 WSA 看動畫瘋時，切全螢幕得先叫出螢幕鍵盤按 F11。現在只要點桌面捷徑，啟動器就會找到動畫瘋的視窗，視需要切換全螢幕。

## What it does

* 找不到既有視窗時，透過 Windows 喚醒 WSA 並開啟動畫瘋，再用 ADB 確認動畫瘋的 Android Activity 已就緒。
* 冷啟動期間查詢 Activity 時，若 ADB 連線重設，會嘗試重連指定裝置。若 ADB 回報找不到裝置，會在原有查詢時限內重新登記並繼續查詢。
* 已有動畫瘋視窗且 App 程序仍在執行時，沿用原本的視窗，保留目前的播放狀態。
* 在 Windows 端核對視窗標題與所屬程序，取得前景後比對內容區與螢幕邊界。畫面已滿版就略過 F11。需要切換時，送鍵前再確認前景，每次執行最多送出一次 F11。

## Implementation Notes

啟動器將 Windows 視窗、WSA 連線與 Android Activity 分開確認，再依當下狀態決定後續操作。

* **App 啟動與沿用**：先辨識既有動畫瘋視窗；需要冷啟動時，透過 Windows 的 `wsa://` 通訊協定喚醒 WSA，並由 ADB 啟動 Android Activity。只有指定 `--restart` 才強制停止並重開 App。
* **ADB 連線恢復**：透過 `get-state`、`connect` 和指定裝置的 shell 查詢確認 WSA 狀態。處理 `connection_reset`、`device_missing`、裝置離線及 Android Activity 清單尚未就緒等情況；重試與重新登記都受到等待期限約束。
* **Android 前景確認**：讀取 `dumpsys activity activities`，核對 `topResumedActivity` 是否屬於動畫瘋套件，避免將其他 Android App 的前景誤認為啟動成功。
* **Windows 視窗與焦點**：核對視窗標題、`WsaClient.exe`、HWND 與 PID。`SetForegroundWindow` 可能受 Windows 前景權限限制，因此保留啟動提示窗及受限條件下的切換備援。
* **F11 安全條件**：使用 `GetClientRect`、`ClientToScreen` 與螢幕邊界判斷全螢幕，等候視窗尺寸穩定，送鍵前再次確認目標仍在前景；只送出一次 F11，之後檢查結果。若焦點、視窗或尺寸發生不預期的變化，就停止操作。
* **重複啟動防護**：透過 Windows 命名 Mutex 避免兩個啟動器同時送 F11，防止第二次按鍵把第一次的全螢幕切換抵銷。

## Usage

將三個 `.pyw` 入口和 `PY_animad_fs.py` 放在同一個資料夾。平常雙擊 **`自動切換動畫瘋.pyw`**，也可以替它建立桌面捷徑。

| 入口 | 使用時機 | 診斷檔 |
| --- | --- | --- |
| `自動切換動畫瘋.pyw` | 日常使用。冷啟動時若 Windows 接連拒絕切換前景，可在啟動器自己的提示窗模擬點擊一次，再切回動畫瘋。 | 不寫入 |
| `自動切換動畫瘋_Debug.pyw` | 需要重現問題時，執行相同的自動切換流程並記錄這一次的操作。 | 寫入 |
| `啟動動畫瘋.pyw` | 使用一般前景切換。若 Windows 拒絕，可以手動點回啟動提示窗或動畫瘋。 | 不寫入 |

Debug 紀錄優先存入同層的 `logs/`，檔名為 `Animad_focus_trace_*.txt`。該處無法寫入時，改試系統暫存目錄下的 `AnimadFullscreenLogs`。若兩處皆無法寫入，啟動器仍會繼續執行。

從命令列執行自動切換時，可在工具目錄輸入以下指令。若要中斷目前播放、強制重開動畫瘋，可在指令末尾加上 `--restart`。

```powershell
py PY_animad_fs.py --auto-activate
```

## Dependencies

需要已安裝 WSA 與巴哈姆特動畫瘋 App 的 Windows 電腦、Python 和 ADB。請開啟 WSA 的 ADB 偵錯並授權連線，以執行啟動器的同一個 Python 環境安裝套件。

```powershell
py -m pip install pyautogui pywin32
```

## Environment Assumptions

以下設定寫在 `PY_animad_fs.py`。若 ADB 安裝路徑或 WSA 連線位址不同，請修改對應常數。

| 項目 | 程式常數 | 預設值 |
| --- | --- | --- |
| ADB 執行檔 | `ADB_PATH` | `C:\adb\adb.exe` |
| WSA 裝置位址 | `WSA_DEVICE` | `127.0.0.1:58526` |
| Android 套件與 Activity | `PACKAGE`、`ACTIVITY` | `tw.com.gamer.android.animad`、`.AnimadActivity` |
| Windows 視窗標題與所屬程序 | `WINDOW_TITLE`、`WINDOW_PROCESS` | `動畫瘋`、`WsaClient.exe` |

## Development History

* **2025-02-14**　開始嘗試用捷徑或命令列在 MSI Claw 上開啟 WSA App。同日的本機檔案紀錄已可見 `PY_animad_fs.py`。
* **2026-06-10**　原版首次收錄於 Belka Field Notes。當時每次都會強制停止並重開動畫瘋，透過 ADB 檢查 Activity 和 `SurfaceFlinger` 的畫面狀態，再切換 Windows 視窗並送出 F11。[首次收錄紀錄](https://github.com/HaruLerrz/belka-field-notes/commit/34d0a631b90e550a96f6926c9e01bcc5a99b5b68)
* **2026-11-06**　重構冷啟動與前景切換，加入既有視窗沿用、送鍵前檢查及獨立 Debug 入口。依 MSI Claw 的實測結果補上 ADB 連線重設後的裝置重新登記。

## Validation

**Windows 筆電，2026-11-06，04:34 版。** 冷啟動期間持續操作其他程式，Windows 兩次拒絕切換前景後，啟動器點擊自己的提示窗，成功將動畫瘋切為全螢幕。另一輪在動畫瘋取得前景後，刻意切換到其他程式，啟動器偵測前景變更並停止操作，該次未送出 F11。

**MSI Claw，2026-11-06，06:26 版。** 以下四次使用 `自動切換動畫瘋_Debug.pyw`。兩次冷啟動都先遇到 ADB 連線重設，再收到裝置遺失的回報。重新登記後，啟動器都等到動畫瘋 Activity 就緒才操作視窗。

| 開始時間（台灣） | 實機結果 | 送出 F11 |
| --- | --- | ---: |
| 14:09:58 | 冷啟動，重新連線後兩次切換前景受阻。啟動器點擊自己的提示窗，完成全螢幕切換。 | 1 次 |
| 14:11:29 | 沿用既有視窗，切換並確認全螢幕。 | 1 次 |
| 14:11:40 | 同一視窗已填滿螢幕，維持全螢幕。 | 0 次 |
| 14:12:44 | 冷啟動，重新連線後直接將前景交給動畫瘋，完成全螢幕切換。 | 1 次 |

## License

本工具採用 MIT License。請見 [`LICENSE`](LICENSE)。

ADB、PyAutoGUI、pywin32 與其他外部元件仍依各自的授權條款使用。

## Navigation

* [返回 Tools Index](../)
* [返回 Digital Workflow Prototyping](../../case-notes/digital-workflow-prototyping.md)
* [返回 Selected Works](../../profile/works.md)
* [返回根 README](../../README.md)
