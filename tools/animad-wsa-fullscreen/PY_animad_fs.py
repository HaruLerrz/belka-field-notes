"""將 WSA 動畫瘋帶到前景全螢幕。需要強制重啟時加上 --restart。"""

import argparse
import ctypes
import ntpath
import os
import re
import subprocess
import sys
import threading
import time


def report_error(message, gui=False):
    print(message)
    if sys.platform == "win32" and (gui or sys.stdin is None or sys.stdout is None):
        trace = getattr(sys.stdout, "trace_path", None)
        detail = f"{message}\n\n紀錄檔：{trace}" if trace else message
        ctypes.windll.user32.MessageBoxW(0, detail, "動畫瘋全螢幕啟動器", 0x10)
    elif sys.stdin is not None:
        input("按 Enter 結束...")


try:
    import pyautogui
    import pywintypes
    import win32api
    import win32con
    import win32console
    import win32event
    import win32gui
    import win32process
except ImportError as error:
    if __name__ != "__main__":
        raise
    report_error(f"無法載入啟動器套件：{error}\n請用執行本檔的 Python 安裝 pyautogui 和 pywin32。",
                 gui="--gui" in sys.argv)
    sys.exit(1)


ADB_PATH = r"C:\adb\adb.exe"
WSA_DEVICE = "127.0.0.1:58526"
PACKAGE = "tw.com.gamer.android.animad"
ACTIVITY = ".AnimadActivity"
WINDOW_TITLE = "動畫瘋"
WINDOW_PROCESS = "WsaClient.exe"
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
ACTIVITY_QUERY = ("dumpsys", "activity", "activities")

# ADB 的 shell 查詢可能只回傳 socket 錯誤，也可能附上一層或多層 client 診斷。
ADB_RESET_LINE = re.compile(
    r"(?:(?:adb(?:\.exe)?|error):[ \t]*)*"
    r"(?:(?:protocol fault \([^()\r\n]*\)|(?:failed to|cannot|couldn't) "
    r"(?:read|write|connect|get|send|receive)\b[^:\r\n]*|(?:read|write|connect) failed):[ \t]*)*"
    r"(?:connection reset by peer|an existing connection was forcibly closed by the remote host|WSAECONNRESET)"
    r"\.?(?:\s*\(10054\))?\.?", re.IGNORECASE,
)

# 冷啟動時，ADB 有時以 0 結束，但 Android 的 Activity 清單查詢拋出這個例外。
NULL_ACTIVITY_ROOT = re.compile(
    r"^Exception occurred while dumping:[ \t]*\r?\n[ \t]*"
    r"java\.lang\.NullPointerException: Attempt to invoke virtual method "
    r"'boolean com\.android\.server\.wm\.RootWindowContainer\.dumpActivities\([^'\r\n]*\)' "
    r"on a null object reference[ \t]*\r?\n[ \t]*"
    r"at com\.android\.server\.wm\.ActivityTaskManagerService\.dumpActivitiesLocked\(",
    re.MULTILINE,
)

# WSA 可同時恢復多個 task。套件名必須出現在自己的 topResumedActivity 那一行。
RESUMED = re.compile(
    r"^[ \t]*topResumedActivity=ActivityRecord\{[^}\r\n]*?[ \t]u\d+[ \t]+"
    + re.escape(PACKAGE) + r"/[^\s}]+", re.MULTILINE
)


class StartupWindow:
    """在本 Python 程序建立一般桌面視窗，維持獨立訊息迴圈。"""

    def __init__(self):
        self.hwnd = 0
        self.cancelled = threading.Event()
        self._ready = threading.Event()
        self._closing = threading.Event()
        self._status = "正在啟動動畫瘋，請稍候…"
        self._label = 0
        self._thread_id = 0
        self._thread = threading.Thread(target=self._run, name="AnimadStartupWindow", daemon=True)

    @classmethod
    def open(cls):
        window = cls()
        window._thread.start()
        if window._ready.wait(2) and (window.hwnd or window.cancelled.is_set()):
            return window
        window.close()
        return None

    def _matches_owner(self, hwnd):
        if not hwnd:
            return False
        tid, pid = win32process.GetWindowThreadProcessId(hwnd)
        return hwnd == self.hwnd and tid == self._thread_id and pid == os.getpid()

    def owns_foreground(self):
        hwnd = self.hwnd
        try:
            return win32gui.GetForegroundWindow() == hwnd and self._matches_owner(hwnd)
        except pywintypes.error:
            return False

    def _post(self, message):
        hwnd = self.hwnd
        try:
            if self._matches_owner(hwnd):
                win32gui.PostMessage(hwnd, message, 0, 0)
        except pywintypes.error:
            pass  # 視窗可能恰好已關閉。

    def set_status(self, text):
        self._status = text
        self._post(win32con.WM_APP + 1)

    def close(self):
        self._closing.set()
        self._post(win32con.WM_CLOSE)
        self._thread.join(timeout=0.5)

    def _on_message(self, hwnd, message, wparam, lparam):
        if message == win32con.WM_APP + 1:
            if self._label:
                win32gui.SetWindowText(self._label, self._status)
            return 0
        if message == win32con.WM_CLOSE:
            if not self._closing.is_set():
                self.cancelled.set()
            win32gui.DestroyWindow(hwnd)
            return 0
        if message == win32con.WM_DESTROY:
            self.hwnd = 0
            self._label = 0
            win32gui.PostQuitMessage(0)
            return 0
        return win32gui.DefWindowProc(hwnd, message, wparam, lparam)

    def _run(self):
        instance = None
        class_name = "AnimadStartupWindow_" + str(id(self))
        registered = False
        font = None
        try:
            instance = win32api.GetModuleHandle(None)
            self._thread_id = win32api.GetCurrentThreadId()
            # DPI 感知以執行緒為單位。視窗建立前設定，才能依所在螢幕縮放。
            user32 = ctypes.windll.user32
            set_dpi = user32.SetThreadDpiAwarenessContext
            set_dpi.argtypes = [ctypes.c_void_p]
            set_dpi.restype = ctypes.c_void_p
            set_dpi(ctypes.c_void_p(-4))  # PER_MONITOR_AWARE_V2
            wc = win32gui.WNDCLASS()
            wc.hInstance = instance
            wc.lpszClassName = class_name
            wc.lpfnWndProc = self._on_message
            wc.hCursor = win32gui.LoadCursor(0, win32con.IDC_ARROW)
            wc.hbrBackground = win32con.COLOR_BTNFACE + 1
            win32gui.RegisterClass(wc)
            registered = True
            self.hwnd = win32gui.CreateWindowEx(
                win32con.WS_EX_APPWINDOW, class_name, "動畫瘋全螢幕啟動器",
                win32con.WS_CAPTION | win32con.WS_SYSMENU | win32con.WS_MINIMIZEBOX,
                win32con.CW_USEDEFAULT, win32con.CW_USEDEFAULT, 350, 100, 0, 0, instance, None)
            get_dpi = user32.GetDpiForWindow
            get_dpi.argtypes = [ctypes.c_void_p]
            get_dpi.restype = ctypes.c_uint
            scale = (get_dpi(self.hwnd) or 96) / 96
            win32gui.SetWindowPos(self.hwnd, 0, 0, 0, round(350 * scale), round(100 * scale),
                                  win32con.SWP_NOMOVE | win32con.SWP_NOZORDER | win32con.SWP_NOACTIVATE)
            x, y, width, height = win32gui.GetClientRect(self.hwnd)
            self._label = win32gui.CreateWindowEx(
                0, "STATIC", self._status, win32con.WS_CHILD | win32con.WS_VISIBLE | 0x201,
                x, y, width, height, self.hwnd, 0, instance, None)  # SS_CENTER | SS_CENTERIMAGE
            lf = win32gui.LOGFONT()
            lf.lfFaceName = "Microsoft JhengHei UI"
            lf.lfHeight = -round(15 * scale)
            font = win32gui.CreateFontIndirect(lf)
            win32gui.SendMessage(self._label, win32con.WM_SETFONT, font, 1)
            if not self._closing.is_set():
                win32gui.ShowWindow(self.hwnd, win32con.SW_SHOWNORMAL)
                try:
                    if win32gui.GetForegroundWindow() != self.hwnd:
                        win32gui.SetForegroundWindow(self.hwnd)
                except pywintypes.error:
                    pass  # Windows 可以拒絕，交接時讀取真正前景。
                self._ready.set()
                win32gui.PumpMessages()
        except (pywintypes.error, OSError, AttributeError) as error:
            print(f"啟動提示視窗無法使用：{error}")
        finally:
            try:
                if self.hwnd and win32gui.IsWindow(self.hwnd):
                    win32gui.DestroyWindow(self.hwnd)
                self.hwnd = 0
                if font:
                    win32gui.DeleteObject(font)
                if registered:
                    win32gui.UnregisterClass(class_name, instance)
            finally:
                self._ready.set()


class _MouseInput(ctypes.Structure):
    _fields_ = [("dx", ctypes.c_int32), ("dy", ctypes.c_int32), ("data", ctypes.c_uint32),
                ("flags", ctypes.c_uint32), ("time", ctypes.c_uint32), ("extra", ctypes.c_void_p)]


class _MouseRecord(ctypes.Structure):
    # MOUSEINPUT is the largest member of the Win32 INPUT union on x86 and x64.
    _fields_ = [("kind", ctypes.c_uint32), ("mouse", _MouseInput)]


class _GuiThreadInfo(ctypes.Structure):
    _fields_ = [("size", ctypes.c_uint32), ("flags", ctypes.c_uint32),
                ("active", ctypes.c_void_p), ("focus", ctypes.c_void_p),
                ("capture", ctypes.c_void_p), ("menu", ctypes.c_void_p),
                ("move_size", ctypes.c_void_p), ("caret", ctypes.c_void_p),
                ("caret_rect", ctypes.c_int32 * 4)]


def _mouse_available():
    # 含左右中鍵、兩個側鍵、Shift/Ctrl/Alt、兩個 Windows 鍵。
    if any(win32api.GetAsyncKeyState(vk) & 0x8000 for vk in (1, 2, 4, 5, 6, 16, 17, 18, 91, 92)):
        return False
    info = _GuiThreadInfo()
    info.size = ctypes.sizeof(info)
    query = ctypes.windll.user32.GetGUIThreadInfo
    query.argtypes = [ctypes.c_uint32, ctypes.POINTER(_GuiThreadInfo)]
    query.restype = ctypes.c_int
    return bool(query(0, ctypes.byref(info)) and not (info.capture or info.menu or info.move_size
                                                      or info.flags & 0x1E))


def _send_mouse_click():
    send = ctypes.windll.user32.SendInput
    send.argtypes = [ctypes.c_uint, ctypes.POINTER(_MouseRecord), ctypes.c_int]
    send.restype = ctypes.c_uint
    records = (_MouseRecord * 2)()
    records[0].mouse.flags = win32con.MOUSEEVENTF_LEFTDOWN
    records[1].mouse.flags = win32con.MOUSEEVENTF_LEFTUP
    size = ctypes.sizeof(_MouseRecord)
    count = send(2, records, size)
    if count == 1:
        # 第一筆已送入系統。補放開一次，避免停在左鍵按住的狀態。
        send(1, ctypes.byref(records[1]), size)
    return count == 2


def click_startup_window(startup):
    """僅在啟動器視窗覆蓋指定點時送一組滑鼠事件。是否取得前景另行確認。"""
    hwnd = startup.hwnd
    raised = False
    moved = False
    position_flags = win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_NOACTIVATE

    def available():
        return (not startup.cancelled.is_set() and startup._matches_owner(hwnd) and
                win32gui.IsWindowVisible(hwnd) and win32gui.IsWindowEnabled(hwnd) and not win32gui.IsIconic(hwnd))

    def center():
        left, top, right, bottom = win32gui.GetClientRect(hwnd)
        if right <= left or bottom <= top:
            return None
        return win32gui.ClientToScreen(hwnd, ((left + right) // 2, (top + bottom) // 2))

    def valid_hit(point):
        if not available() or center() != point:
            return False
        hit = win32gui.WindowFromPoint(point)
        if hit == hwnd:
            return True
        if not hit or hit != startup._label or win32gui.GetParent(hit) != hwnd:
            return False
        tid, pid = win32process.GetWindowThreadProcessId(hit)
        return tid == startup._thread_id and pid == os.getpid()

    try:
        if not available() or startup.owns_foreground() or not _mouse_available():
            return False
        point = center()
        if point is None:
            return False
        origin = win32api.GetCursorPos()
        if not (win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE) & win32con.WS_EX_TOPMOST):
            if not available():
                return False
            win32gui.SetWindowPos(hwnd, win32con.HWND_TOPMOST, 0, 0, 0, 0, position_flags)
            raised = True
        if not valid_hit(point) or win32api.GetCursorPos() != origin or not _mouse_available():
            return False
        if origin != point:
            win32api.SetCursorPos(point)
            moved = True
        if not valid_hit(point) or not _mouse_available() or win32api.GetCursorPos() != point:
            return False
        sent = _send_mouse_click()
        if sent:
            # SendInput 返回時，Windows 可能尚未完成派送。保留原點位等待啟用與放鍵。
            deadline = time.monotonic() + 0.5
            while time.monotonic() < deadline and available():
                if startup.owns_foreground() and _mouse_available():
                    break
                time.sleep(0.015)
        return sent
    except (pywintypes.error, OSError):
        return False
    finally:
        try:
            if moved and win32api.GetCursorPos() == point and _mouse_available():
                win32api.SetCursorPos(origin)
        except (pywintypes.error, OSError):
            pass
        try:
            if raised and startup._matches_owner(hwnd):
                win32gui.SetWindowPos(hwnd, win32con.HWND_NOTOPMOST, 0, 0, 0, 0, position_flags)
        except (pywintypes.error, OSError):
            pass


class LaunchCancelled(Exception):
    pass


# 只有 GUI 冷啟動期間存在。ADB、視窗輪詢與送鍵共用同一個取消事件。
_startup_window = None


def check_cancelled():
    if _startup_window is not None and _startup_window.cancelled.is_set():
        raise LaunchCancelled()


ADB_DAEMON_BANNER = re.compile(
    r"\* daemon (?:not running; starting now at tcp:\d+|not running\. starting it now on port \d+"
    r"|started successfully)(?: \*)?"
)


def adb_diagnostic(text):
    lines = text.strip().splitlines()
    for index, line in enumerate(lines):
        if not ADB_DAEMON_BANNER.fullmatch(line.strip()):
            return "\n".join(lines[index:]).strip()
    return ""


class AdbCommandError(RuntimeError):
    def __init__(self, message, returncode, *, reason=None, diagnostic=None):
        super().__init__(message)
        self.returncode = returncode
        detail = message if diagnostic is None else diagnostic
        detail = re.sub(r"^(?:(?:adb(?:\.exe)?|error):\s*)+", "", detail.casefold()).strip()
        if reason is not None:
            self.reason = reason
        elif detail == "device offline":
            self.reason = "device_offline"
        elif detail == f"device '{WSA_DEVICE}' not found":
            self.reason = "device_missing"
        elif detail.startswith(("device unauthorized", "failed to authenticate")):
            self.reason = "unauthorized"
        elif "can't find service" in detail:
            self.reason = "service_unavailable"
        else:
            self.reason = "command_failed"


def adb(*args, timeout=10, check=True):
    check_cancelled()
    try:
        result = subprocess.run(
            [ADB_PATH, *args], capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=timeout, creationflags=subprocess.CREATE_NO_WINDOW,
        )
    except FileNotFoundError as error:
        raise RuntimeError(f"找不到 ADB，請確認 {ADB_PATH}。") from error
    output = result.stdout + "\n" + result.stderr
    android_error = re.search(r"^(?:Error:|Error type \d+|Exception occurred)", output, re.M)
    if check and (result.returncode or android_error):
        # ADB server 的啟動通知可能與真正的裝置錯誤同時出現在 stderr。
        diagnostic = adb_diagnostic(result.stderr) or adb_diagnostic(result.stdout)
        if args == ("-s", WSA_DEVICE, "shell", *ACTIVITY_QUERY):
            # stderr 可伴隨不完整的 stdout；只有命令成功才可以採信 Activity 清單。
            if result.returncode and ADB_RESET_LINE.fullmatch(diagnostic):
                raise AdbCommandError(diagnostic, result.returncode, reason="connection_reset")
            if NULL_ACTIVITY_ROOT.search(output):
                raise AdbCommandError("Android 尚無法列出 Activity（RootWindowContainer 為空）。",
                                      result.returncode, reason="activity_dump_not_ready")
        raise AdbCommandError(output.strip() or f"ADB 結束碼 {result.returncode}",
                              result.returncode, diagnostic=diagnostic)
    return result


def wake_animad():
    """透過 Windows 的 WSA 通訊協定開啟動畫瘋。"""
    check_cancelled()
    uri = f"wsa://{PACKAGE}"
    try:
        os.startfile(uri)
        return
    except OSError as error:
        protocol_error = str(error)
    local = os.environ.get("LOCALAPPDATA")
    if local:
        client = ntpath.join(local, "Microsoft", "WindowsApps",
                             "MicrosoftCorporationII.WindowsSubsystemForAndroid_8wekyb3d8bbwe",
                             "WsaClient.exe")
        try:
            subprocess.Popen([client, "/launch", uri], creationflags=subprocess.CREATE_NO_WINDOW)
            return
        except OSError as error:
            raise RuntimeError(f"Windows 無法開啟 {uri}（{protocol_error}），"
                               f"WsaClient 啟動也失敗：{error}") from error
    raise RuntimeError(f"Windows 無法開啟 {uri}（{protocol_error}），且找不到 LOCALAPPDATA。")


def probe_adb(*args, timeout=4, clean_stdout=False):
    try:
        result = adb(*args, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        return f"ADB {args[-1]} 逾時"
    detail = (result.stderr + "\n" + result.stdout).strip()
    if "unauthorized" in detail.lower() or "failed to authenticate" in detail.lower():
        raise RuntimeError("WSA 尚未授權 ADB 連線。請在 WSA 允許偵錯連線後再執行。")
    if result.returncode:
        return f"ADB 結束碼 {result.returncode}：{detail}"
    if clean_stdout:
        return result.stdout.strip() if not result.stderr.strip() else ""
    return result.stdout.strip() or detail


def connect_wsa(launch_if_needed):
    """確認指定裝置可用，回傳是否已由 Windows 啟動動畫瘋。"""
    query = ("-s", WSA_DEVICE, "get-state")
    state = probe_adb(*query)
    if state == "device":
        return False

    # TCP 握手完成前，connect 回應與 get-state 的狀態可能暫時不同。
    attempt = probe_adb("connect", WSA_DEVICE)
    for delay in (0, 0.5, 1):
        time.sleep(delay)
        state = probe_adb(*query)
        if state == "device":
            return False

    launched = launch_if_needed and find_animad_window() is None
    if launched:
        print("ADB 尚未就緒，從 Windows 啟動動畫瘋並喚醒 WSA...")
        wake_animad()
    else:
        print("等待 WSA 的 ADB 連線就緒...")

    deadline = time.monotonic() + 90
    offline_since = None
    registered_timeouts = 0
    repaired_registration = False
    while (remaining := deadline - time.monotonic()) > 0:
        state = probe_adb(*query, timeout=min(4, remaining))
        if state == "device":
            return launched
        now = time.monotonic()
        is_offline = "offline" in state.lower()
        if not is_offline:
            offline_since = None
        elif offline_since is None:
            offline_since = now
        should_disconnect = offline_since is not None and now - offline_since >= 12

        # connect 可能只確認既有紀錄。只計入有完整 4 秒預算的連續逾時。
        if remaining >= 4 and state == "ADB get-state 逾時" and attempt == f"already connected to {WSA_DEVICE}":
            registered_timeouts += 1
        else:
            registered_timeouts = 0
        if registered_timeouts >= 2 and now < deadline:
            registered_timeouts = 0
            print("ADB 狀態連續逾時，改測 WSA shell。")
            token = "animad-adb-ready"
            echo = probe_adb("-s", WSA_DEVICE, "shell", "echo", token,
                             timeout=min(4, deadline - now), clean_stdout=True)
            if echo == token:
                print("WSA shell 已回應，繼續確認動畫瘋狀態。")
                return launched
            now = time.monotonic()
            if not repaired_registration and deadline - now >= 8:
                repaired_registration = True
                print("WSA shell 未回應預期內容，重建指定 WSA 連線。")
                should_disconnect = True

        # 預留斷線與重連的時間，避免結束前才移除裝置紀錄。
        if should_disconnect and deadline - now >= 8:
            probe_adb("disconnect", WSA_DEVICE, timeout=4)
            offline_since = None
            is_offline = False
        remaining = deadline - time.monotonic()
        if not is_offline and remaining > 0:
            attempt = probe_adb("connect", WSA_DEVICE, timeout=min(4, remaining))
        time.sleep(min(2, max(0, deadline - time.monotonic())))
    raise RuntimeError(f"等候 90 秒仍無法連上 {WSA_DEVICE}。裝置狀態：{state}。連線回覆：{attempt}")


def shell(*args, **kwargs):
    return adb("-s", WSA_DEVICE, "shell", *args, **kwargs).stdout


def wait_for_output(args, pattern, seconds, recover_transport=False):
    deadline = time.monotonic() + seconds
    next_registration = None
    reported_null_root = False
    reported_reset = False
    last_probe_error = None
    while (remaining := deadline - time.monotonic()) > 0:
        try:
            dump = shell(*args, timeout=remaining)
            last_probe_error = None
        except subprocess.TimeoutExpired:
            break
        except AdbCommandError as error:
            if error.reason == "activity_dump_not_ready":
                last_probe_error = error
                if not reported_null_root:
                    print("Android 視窗管理服務還無法列出 Activity，繼續等候。")
                    reported_null_root = True
            elif error.reason == "service_unavailable":
                last_probe_error = None
            elif recover_transport and error.reason in ("device_offline", "device_missing", "connection_reset"):
                last_probe_error = error
                if error.reason == "connection_reset" and not reported_reset:
                    print("Activity 查詢收到 ADB 連線重設，將在原時限內重新查詢。")
                    reported_reset = True
                now = time.monotonic()
                # ADB server 在重連後也可能重新啟動，指定裝置要再次登記才可查詢。
                register = next_registration is None or (error.reason == "device_missing" and now >= next_registration)
                if register and (remaining := deadline - now) > 0:
                    next_registration = now + 5
                    if error.reason == "device_missing":
                        print("Activity 查詢找不到指定 WSA，重新登記裝置。")
                    else:
                        print("Activity 查詢暫時失去 ADB 連線，嘗試重連 WSA。")
                    probe_adb("connect", WSA_DEVICE, timeout=min(4, remaining))
            else:
                raise
            dump = ""
        if pattern.search(dump):
            return True
        time.sleep(min(0.5, max(0, deadline - time.monotonic())))
    if last_probe_error:
        if last_probe_error.reason == "activity_dump_not_ready":
            raise AdbCommandError(f"等候 {seconds} 秒仍未取得有效的 Activity 清單。{last_probe_error}",
                                  last_probe_error.returncode, reason=last_probe_error.reason) from last_probe_error
        raise last_probe_error
    return False


def open_animad(restart):
    native_launch = False
    if not restart and find_animad_window() is None:
        # 桌面啟動意圖交給 Windows。即使 ADB 尚未啟動，也可以立即開 App。
        print("從 Windows 開啟動畫瘋...")
        try:
            wake_animad()
            native_launch = True
        except RuntimeError as error:
            print(f"{error}\n改嘗試透過 ADB 啟動動畫瘋。")
    print("確認 WSA 連線...")
    if connect_wsa(launch_if_needed=restart):
        native_launch = True
    if not restart and not native_launch and find_animad_window() is not None:
        # 最小化或背景播放時 Activity 可能暫停；先確認 Android 程序仍在。
        process = adb("-s", WSA_DEVICE, "shell", "pidof", PACKAGE, check=False)
        if process.returncode == 0 and any(part.isdigit() for part in process.stdout.split()):
            print("沿用已開啟的動畫瘋。")
            return False
        if process.returncode != 1 or process.stderr.strip():
            raise RuntimeError(f"已有動畫瘋視窗，但無法確認 Android 程序。{process.stderr.strip()}")

    if restart or not native_launch:
        if not wait_for_output(("getprop", "sys.boot_completed"), re.compile(r"^1$"), 60):
            raise RuntimeError("ADB 已連線，但等候 60 秒後 Android 仍未回報開機完成。")
        if restart:
            print("依要求重新啟動動畫瘋...")
            shell("am", "force-stop", PACKAGE)
            time.sleep(1)
        flags = ["--activity-clear-task"] if restart else []
        shell("am", "start", "-n", f"{PACKAGE}/{ACTIVITY}", *flags)
    print("等待動畫瘋的 Activity 啟動...")
    seconds = 45 if native_launch else 10
    if not wait_for_output(ACTIVITY_QUERY, RESUMED, seconds,
                           recover_transport=native_launch):
        raise RuntimeError(f"ADB 已連線，但 {seconds} 秒內未看到動畫瘋的 Activity 進入 resumed 狀態。")
    print("已確認動畫瘋 Activity resumed。")
    return True


def window_owner(hwnd):
    _, pid = win32process.GetWindowThreadProcessId(hwnd)
    handle = win32api.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    try:
        return pid, ntpath.basename(win32process.GetModuleFileNameEx(handle, 0))
    finally:
        handle.Close()


def find_animad_window():
    """回傳唯一的 (HWND, PID)。視窗可能在列舉期間關閉。"""
    matches = []

    def inspect(hwnd, _):
        try:
            if win32gui.IsWindowVisible(hwnd) and win32gui.GetWindowText(hwnd) == WINDOW_TITLE:
                pid, name = window_owner(hwnd)
                if name.casefold() == WINDOW_PROCESS.casefold():
                    matches.append((hwnd, pid))
        except pywintypes.error:
            pass
        return True

    win32gui.EnumWindows(inspect, None)
    if len(matches) > 1:
        raise RuntimeError("找到多個動畫瘋 WSA 視窗，無法決定 F11 的對象。")
    return matches[0] if matches else None


def request_show(hwnd, mode):
    show = ctypes.windll.user32.ShowWindowAsync
    show.argtypes = [ctypes.c_void_p, ctypes.c_int]
    show.restype = ctypes.c_int
    show(hwnd, mode)


def foreground_info():
    hwnd = win32gui.GetForegroundWindow()
    if not hwnd:
        return "無前景視窗"
    try:
        pid, name = window_owner(hwnd)
        return f"{name}，PID={pid}，HWND={hwnd:#x}"
    except pywintypes.error:
        return f"HWND={hwnd:#x}（無法取得程序名稱）"


def focus_window(launched=False, startup=None, auto_activate=False):
    # 等視窗出現和等前景交接，各自使用獨立時限。
    deadline = time.monotonic() + (15 if launched else 8)
    previous = None
    attempts = 0
    extra_attempts = 0
    owner_attempts = 0
    owner_tried = False
    click_attempted = False
    tried_foregrounds = set()
    show_mode = None
    next_request = 0
    passive = False
    while True:
        check_cancelled()
        now = time.monotonic()
        if now >= deadline:
            # 有已辨識的視窗時，讓使用者在工作告一段落後仍能接續這次啟動。
            if (passive or not startup or not launched or not previous
                    or find_animad_window() != previous or not win32gui.IsWindowEnabled(previous[0])):
                break
            passive = True
            owner_tried = False
            owner_attempts = 0
            deadline = now + 60
            startup.set_status("動畫瘋已就緒，點此視窗可切換全螢幕。")
            print("前景等候：再等候 60 秒，切回提示窗或動畫瘋即可繼續。")
        target = find_animad_window()
        if target:
            hwnd, _ = target
            if previous is None:
                deadline = now + (20 if launched else 12)
            if target != previous:
                previous = target
                attempts, show_mode = 0, None
                owner_tried = False
                tried_foregrounds.clear()
            try:
                if win32gui.IsWindowEnabled(hwnd):
                    foreground = win32gui.GetForegroundWindow()
                    if startup and foreground != startup.hwnd:
                        owner_tried = False
                    # 寬限期間只回應使用者切回提示窗、或目標自己來到前景。
                    if passive and foreground != hwnd and not startup.owns_foreground():
                        time.sleep(0.15)
                        continue
                    if win32gui.IsIconic(hwnd):
                        if show_mode != win32con.SW_RESTORE:
                            request_show(hwnd, win32con.SW_RESTORE)
                            show_mode = win32con.SW_RESTORE
                    elif foreground == hwnd:
                        return target, show_mode == win32con.SW_SHOWMAXIMIZED
                    elif (startup and launched and foreground == startup.hwnd and not owner_tried
                          and owner_attempts < 2 and startup.owns_foreground()):
                        # 背景的 Terminal 和本程序擁有的前景視窗，在 Windows 是兩種不同情況。
                        # 先交接再等穩定尺寸，避免最大化或節流延後這次機會。
                        if find_animad_window() == target and startup.owns_foreground():
                            owner_tried = True
                            owner_attempts += 1
                            print(f"前景交接 目標 PID={target[1]}，HWND={hwnd:#x}")
                            win32gui.SetForegroundWindow(hwnd)
                    elif not passive and (show_mode is None or (launched and show_mode == win32con.SW_RESTORE)):
                        mode = win32con.SW_SHOW
                        if launched and fullscreen_state(*window_bounds(hwnd)) == "windowed":
                            mode = win32con.SW_SHOWMAXIMIZED
                        request_show(hwnd, mode)
                        show_mode = mode
                        # 保留實測版的尺寸轉換時間。下一輪重新辨識 HWND 和 PID。
                        if mode == win32con.SW_SHOWMAXIMIZED:
                            next_request = max(next_request, now + 1)
                    elif (auto_activate and launched and startup and not passive and not click_attempted
                          and attempts >= 2 and now >= next_request and foreground
                          and foreground != startup.hwnd and find_animad_window() == target
                          and win32gui.GetForegroundWindow() == foreground):
                        click_attempted = True
                        sent = click_startup_window(startup)
                        print("自動切換備援 已送出點擊" if sent else "自動切換備援 略過點擊")
                        next_request = now + 0.5
                    elif not passive and now >= next_request and (
                        attempts < 3 or
                        (launched and extra_attempts < 2 and foreground and foreground not in tried_foregrounds)
                    ):
                        # 前三次常在同一個前景下用完；稍後換到新前景才補試。
                        if attempts >= 3:
                            extra_attempts += 1
                        attempts += 1
                        tried_foregrounds.add(foreground)
                        next_request = now + 2
                        win32gui.SetForegroundWindow(hwnd)
            except (pywintypes.error, ValueError):
                pass  # 新視窗可能還沒有尺寸，或已在轉換期間被替換。
        time.sleep(0.15)
    if previous is None:
        raise RuntimeError(f"找不到可切換的「{WINDOW_TITLE}」視窗（{WINDOW_PROCESS}）。")
    hwnd, pid = previous
    if find_animad_window() != previous:
        reason = "等待期間動畫瘋視窗已關閉或更換"
    elif not win32gui.IsWindowEnabled(hwnd):
        reason = "動畫瘋視窗仍無法接收鍵盤輸入"
    else:
        reason = "動畫瘋未取得前景"
    raise RuntimeError(f"{reason}，已取消 F11。目標 PID={pid}，HWND={hwnd:#x}。"
                       f"當下前景：{foreground_info()}。")


def check_target(target):
    check_cancelled()
    if (find_animad_window() != target or not win32gui.IsWindowEnabled(target[0])
            or win32gui.GetForegroundWindow() != target[0]):
        raise RuntimeError("動畫瘋視窗已變更或失去前景。")


def window_bounds(hwnd):
    left, top, right, bottom = win32gui.GetClientRect(hwnd)
    if right <= left or bottom <= top:
        raise ValueError("無法取得動畫瘋的有效內容區。")
    client = win32gui.ClientToScreen(hwnd, (left, top)) + win32gui.ClientToScreen(hwnd, (right, bottom))
    monitor = win32api.MonitorFromWindow(hwnd, win32con.MONITOR_DEFAULTTONEAREST)
    return client, win32api.GetMonitorInfo(monitor)["Monitor"]


def fullscreen_state(client, monitor):
    if client == monitor:
        return "full"
    if (client[0] <= monitor[0] and client[1] <= monitor[1]
            and client[2] >= monitor[2] and client[3] >= monitor[3]):
        return "oversized"
    if max(abs(a - b) for a, b in zip(client, monitor)) <= 2:
        return "near"
    return "windowed"


def captioned_maximized(hwnd):
    style = win32gui.GetWindowLong(hwnd, win32con.GWL_STYLE)
    return (win32gui.GetWindowPlacement(hwnd)[1] == win32con.SW_SHOWMAXIMIZED
            and style & win32con.WS_CAPTION == win32con.WS_CAPTION
            and not style & win32con.WS_POPUP)


def ensure_fullscreen(target, launched, requested_maximize):
    # 先等同一個視窗尺寸穩定，避免視窗建立或還原的動畫影響 F11 的判斷。
    previous = None
    stable_since = time.monotonic()
    deadline = stable_since + 4
    while time.monotonic() < deadline:
        check_target(target)
        try:
            bounds = window_bounds(target[0])
        except ValueError:  # 剛交接到前景時，內容區可能還是零尺寸。
            previous = None
            time.sleep(0.08)
            continue
        if bounds != previous:
            previous = bounds
            stable_since = time.monotonic()
        elif time.monotonic() - stable_since >= (1.0 if launched else 0.25):
            break
        time.sleep(0.08)
    else:
        raise RuntimeError("動畫瘋視窗尺寸仍在變動，已取消 F11。")

    client, monitor = bounds
    state = fullscreen_state(client, monitor)
    # 隱藏工作列時，我們剛要求的「一般最大化」也可能剛好覆蓋螢幕。
    if state in ("full", "near") and requested_maximize and captioned_maximized(target[0]):
        state = "windowed"
    if state == "full":
        print("動畫瘋已在前景，內容區已填滿螢幕。")
        return
    if state == "oversized":
        raise RuntimeError(f"視窗覆蓋螢幕且超出邊界，已略過 F11。內容區 {client}，螢幕 {monitor}")
    if state == "near":
        raise RuntimeError(f"內容區和螢幕邊界只差一兩個像素，已略過 F11。內容區 {client}，螢幕 {monitor}")

    if window_bounds(target[0]) != bounds:
        raise RuntimeError("送鍵前視窗尺寸已改變，已取消 F11。")
    check_target(target)
    pyautogui.press("f11")
    print("已送出一次 F11，正在確認畫面。")

    # F11 是切換鍵。送出一次後只觀察，避免延遲導致第二次按鍵退出全螢幕。
    deadline = time.monotonic() + 3
    previous_full = False
    while time.monotonic() < deadline:
        check_target(target)
        client, monitor = window_bounds(target[0])
        full = client == monitor and not (requested_maximize and captioned_maximized(target[0]))
        if full and previous_full:
            print("已確認動畫瘋在前景，內容區填滿螢幕。")
            return
        previous_full = full
        time.sleep(0.1)
    if client == monitor:
        raise RuntimeError("已送出一次 F11，內容區已填滿螢幕，但仍無法確認已切換全螢幕。")
    raise RuntimeError(f"已送出一次 F11，仍未確認內容區填滿螢幕。內容區 {client}，螢幕 {monitor}")


def main(restart=False, gui=False, auto_activate=False):
    global _startup_window
    console = None
    minimized = False
    try:
        if gui and (restart or find_animad_window() is None):
            _startup_window = StartupWindow.open()
            if _startup_window:
                check_cancelled()
                print(f"啟動器視窗 HWND={_startup_window.hwnd:#x} 自有前景={int(_startup_window.owns_foreground())}")
            else:
                print("啟動器視窗未建立，沿用既有切換流程。")
        hwnd = None if gui else win32console.GetConsoleWindow()
        if hwnd and win32gui.IsWindowVisible(hwnd) and not win32gui.IsIconic(hwnd):
            console = hwnd
            if win32gui.GetForegroundWindow() != console:
                win32gui.ShowWindow(console, win32con.SW_SHOWMINNOACTIVE)
                minimized = True
        launched = open_animad(restart)
        check_cancelled()
        if _startup_window:
            _startup_window.set_status("正在等候動畫瘋視窗，準備切換全螢幕。")
        print("開始辨識動畫瘋視窗與前景...")
        target, requested_maximize = focus_window(launched, _startup_window, auto_activate)
        # 主控台原本在前景時，先讓 Windows 把焦點交給動畫瘋。
        if console and not minimized and win32gui.IsWindow(console):
            win32gui.ShowWindow(console, win32con.SW_SHOWMINNOACTIVE)
            minimized = True
        print("開始檢查動畫瘋全螢幕...")
        ensure_fullscreen(target, launched, requested_maximize)
    except LaunchCancelled:
        print("已取消啟動器。")
        return 2
    except Exception as error:
        if _startup_window and _startup_window.cancelled.is_set():
            print("已取消啟動器。")
            return 2
        record_failure = getattr(sys.stdout, "record_failure", None)
        if record_failure:
            try:
                record_failure(error)
            except Exception:
                pass  # 診斷失敗時仍顯示原始錯誤。
        # GUI 模式關閉提示窗後再顯示錯誤，避免兩個視窗相互切換。
        if _startup_window:
            _startup_window.close()
            _startup_window = None
        if minimized and win32gui.IsWindow(console):
            win32gui.ShowWindow(console, win32con.SW_RESTORE)
        report_error(f"啟動失敗：{error}", gui=gui)
        return 1
    finally:
        if _startup_window:
            _startup_window.close()
            _startup_window = None
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--restart", action="store_true", help="強制重啟動畫瘋，再切換全螢幕")
    parser.add_argument("--gui", action="store_true", help="冷啟動時顯示可交接前景的提示視窗")
    parser.add_argument("--auto-activate", action="store_true", help="冷啟動交接受阻時，可對啟動提示窗自動點一次")
    args = parser.parse_args()
    gui = args.auto_activate or args.gui or sys.argv[0].lower().endswith(".pyw") or sys.executable.lower().endswith("pythonw.exe")

    # 同一桌面的兩個啟動器若同時送 F11，第二次會把第一次的切換抵銷。
    lock = win32event.CreateMutex(None, False, r"Local\AnimadFullscreenLauncher")
    if win32api.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
        sys.exit(0)
    try:
        # PyAutoGUI 會設定程序 DPI 感知；以此執行緒取得各螢幕的實體像素座標。
        dpi_context = ctypes.windll.user32.SetThreadDpiAwarenessContext
        dpi_context.argtypes = [ctypes.c_void_p]
        dpi_context.restype = ctypes.c_void_p
        if not dpi_context(ctypes.c_void_p(-4)):  # PER_MONITOR_AWARE_V2
            report_error("無法設定螢幕 DPI 座標，已取消操作。", gui=gui)
            sys.exit(1)
        sys.exit(main(args.restart, gui=gui, auto_activate=args.auto_activate))
    finally:
        lock.Close()
