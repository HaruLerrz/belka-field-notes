import time
import pyautogui
import subprocess
import win32gui
import win32con
import os
import ctypes

# 取得 CMD 視窗
SW_MINIMIZE = 6
ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), SW_MINIMIZE)

# 設定 ADB 路徑
ADB_PATH = r"C:\adb\adb.exe"
PACKAGE_NAME = "tw.com.gamer.android.animad"
ACTIVITY_NAME = ".AnimadActivity"

# **ADB 連線函式**
def connect_adb():
    print("🔍 檢查 ADB 連線...")
    result = subprocess.run(f'"{ADB_PATH}" devices', capture_output=True, text=True, shell=True)
    if "127.0.0.1:58526" in result.stdout:
        print("✅ ADB 已連線！")
        return True
    print("⚠️ ADB 未連線，嘗試重新連接...")
    subprocess.run(f'"{ADB_PATH}" disconnect', shell=True)
    time.sleep(1)
    connect_result = subprocess.run(f'"{ADB_PATH}" connect 127.0.0.1:58526', capture_output=True, text=True, shell=True)
    if "connected" in connect_result.stdout or "already connected" in connect_result.stdout:
        print("✅ ADB 連線成功！")
        return True
    else:
        print("❌ ADB 連線失敗，請手動檢查")
        input("🔴 按 Enter 退出...")
        return False

# **檢查並連接 ADB**
if not connect_adb():
    print("🚨 無法連線 ADB，停止執行")
    exit()

# **確保應用完整重啟**
print("🔄 關閉應用中...")
subprocess.run(f'"{ADB_PATH}" shell am force-stop {PACKAGE_NAME}', shell=True)
time.sleep(1)

print("🚀 啟動應用中...")
subprocess.run(f'"{ADB_PATH}" shell am start -n {PACKAGE_NAME}/{ACTIVITY_NAME} --activity-clear-task', shell=True)

# **檢查應用是否真的運行**
print("⏳ 等待應用進入 WSA 前景...")
start_time = time.time()
app_ready = False

while time.time() - start_time < 10:  # 最多等 10 秒
    result = subprocess.run(f'"{ADB_PATH}" shell dumpsys activity activities', capture_output=True, text=True, shell=True)
    
    if f"topResumedActivity=ActivityRecord" in result.stdout and f"{PACKAGE_NAME}/{ACTIVITY_NAME}" in result.stdout:
        print("✅ 應用在 WSA 內部已啟動")
        app_ready = True
        break
    time.sleep(0.5)

if not app_ready:
    print("❌ 應用未能正確進入 WSA 前景，請手動確認")
    input("🔴 按 Enter 退出...")
    exit()

# **確保畫面完全載入**
print("⏳ 檢查畫面是否顯示...")
screen_ready = False
for _ in range(10):  # 最多等 5 秒
    surface_check = subprocess.run(f'"{ADB_PATH}" shell dumpsys SurfaceFlinger | findstr animad', capture_output=True, text=True, shell=True)
    if "animad" in surface_check.stdout:
        print("✅ 畫面已顯示")
        screen_ready = True
        break
    time.sleep(0.5)

if not screen_ready:
    print("⚠️ 畫面可能仍在載入，但繼續執行")

# **切換 Windows 層級的動畫瘋視窗**
print("📌 設定動畫瘋為 Windows 前景視窗...")

hwnd_wsa = None
start_time = time.time()

while time.time() - start_time < 5:  # 最多等 5 秒
    hwnd_wsa = win32gui.FindWindow(None, "動畫瘋")  # **在 Windows 找動畫瘋視窗**
    if hwnd_wsa:
        break
    time.sleep(0.5)

if hwnd_wsa:
    print("✅ 找到動畫瘋視窗，HWND:", hwnd_wsa)

    # **最大化動畫瘋，確保它可見**
    print("🔳 嘗試最大化動畫瘋視窗...")
    win32gui.ShowWindow(hwnd_wsa, win32con.SW_SHOWMAXIMIZED)
    time.sleep(1)

    # **嘗試提升前景權限**
    ctypes.windll.user32.AllowSetForegroundWindow(-1)

    # **強制切換到動畫瘋**
    switch_success = False
    for _ in range(3):  # 嘗試 3 次確保前景切換
        try:
            win32gui.SetForegroundWindow(hwnd_wsa)
            time.sleep(0.5)

            # **檢查是否切換成功**
            if win32gui.GetForegroundWindow() == hwnd_wsa:
                switch_success = True
                print("🎯 動畫瘋成功成為前景視窗")
                break
        except Exception as e:
            print(f"⚠️ 設定動畫瘋前景失敗: {e}")

    if not switch_success:
        print("⚠️ 無法確保動畫瘋成為前景，請手動確認")
        input("🔴 按 Enter 退出...")
        exit()  # **前景切換失敗，不發送 F11 也不繼續執行**

    print("🎬 發送 F11...")
    pyautogui.press("f11")
    time.sleep(1)
    print("✅ 成功進入全螢幕模式！")

else:
    print("❌ 找不到動畫瘋視窗，請確認應用是否成功啟動")
    input("🔴 按 Enter 退出...")
    exit()

print("🛑 按 Enter 結束...")
# input()
