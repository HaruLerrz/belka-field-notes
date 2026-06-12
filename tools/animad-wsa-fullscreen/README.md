# Animad WSA Fullscreen Helper

用於在 Windows Subsystem for Android 環境下，自動啟動巴哈姆特動畫瘋 App，並切換到全螢幕的小型 Python 工具。

這支工具原本是為了解決一個很具體的日常問題：
在 WSA 中開啟動畫瘋時，需要手動確認 ADB 連線、啟動 App、切換 Windows 前景視窗，再按 F11 進入全螢幕。這支腳本把這些步驟串成一個流程。

## What it does

* 檢查 ADB 是否連線到 WSA
* 若未連線，嘗試重新連線到 `127.0.0.1:58526`
* 強制停止動畫瘋 App
* 重新啟動指定 package / activity
* 透過 `dumpsys activity` 確認 App 是否進入前景
* 透過 `SurfaceFlinger` 檢查畫面是否顯示
* 在 Windows 層級尋找標題為「動畫瘋」的視窗
* 最大化該視窗
* 嘗試切換為前景視窗
* 發送 F11 進入全螢幕

## Usage

確認 ADB 路徑與 WSA 連線設定後執行：

```bash
python PY_animad_fs.py
```

## Dependencies

```bash
pip install pyautogui pywin32
```

另需：

* Windows
* Windows Subsystem for Android
* ADB
* 巴哈姆特動畫瘋 App
* ADB 路徑預設為 `C:\adb\adb.exe`

## Environment Assumptions

目前版本依照個人使用環境撰寫，包含以下硬編碼設定：

```python
ADB_PATH = r"C:\adb\adb.exe"
PACKAGE_NAME = "tw.com.gamer.android.animad"
ACTIVITY_NAME = ".AnimadActivity"
```

WSA ADB 連線位址預設為：

```txt
127.0.0.1:58526
```

Windows 視窗標題預設為：

```txt
動畫瘋
```

## Notes

這支工具針對個人觀看流程撰寫，使用條件依賴目前的 WSA、ADB 與 Windows 視窗設定。

此腳本將 ADB、Android Activity、WSA 狀態檢查、Windows 視窗控制與鍵盤輸入串成單一流程，用來處理每天重複發生的操作。

若要泛用化，後續可補上：

* ADB path 設定檔
* package / activity 可由參數指定
* WSA port 自動偵測
* 視窗標題 fallback
* GUI 或 tray launcher

## License

本工具採用 MIT License。請見 [`LICENSE`](LICENSE)。

ADB、PyAutoGUI、pywin32 與其他外部元件仍依各自的授權條款使用。

## Navigation

* [返回 Tools Index](../)
* [返回根 README](../../README.md)
