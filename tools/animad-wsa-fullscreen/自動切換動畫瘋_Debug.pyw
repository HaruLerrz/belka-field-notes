"""自動切換動畫瘋並記錄本次前景交接，供排錯使用。"""

from contextlib import redirect_stdout, suppress
import ctypes
from datetime import datetime
import hashlib
import io
import ntpath
import os
from pathlib import Path
import re
import runpy
import sys
import tempfile
import threading
import time

HERE = Path(__file__).resolve().parent
LAUNCHER = HERE / "PY_animad_fs.py"
if not LAUNCHER.is_file():
    LAUNCHER = HERE / "repo-files" / "tools" / "animad-wsa-fullscreen" / "PY_animad_fs.py"

# 只儲存已知階段名稱及明確標示的數值。
STAGES = (
    ("啟動器視窗未建立", "啟動器視窗未建立"),
    ("已取消啟動器", "已取消啟動器"),
    ("前景等候", "前景等候"),
    ("從 Windows 開啟動畫瘋", "Windows 啟動要求"),
    ("確認 WSA 連線", "開始 ADB 檢查"),
    ("等待 WSA 的 ADB", "等待 ADB"),
    ("ADB 狀態連續逾時，改測 WSA shell", "ADB 已登記，測試 shell"),
    ("WSA shell 已回應", "已確認 WSA shell 有效回覆"),
    ("WSA shell 未回應預期內容", "重建指定 WSA 連線"),
    ("等待動畫瘋的 Activity", "等待 Android Activity"),
    ("Android 視窗管理服務還無法列出 Activity", "Android Activity 清單尚未就緒，繼續等候"),
    ("Activity 查詢暫時失去 ADB 連線", "Activity 查詢嘗試重連 WSA"),
    ("Activity 查詢找不到指定 WSA", "Activity 查詢收到 device_missing，重新登記 WSA"),
    ("Activity 查詢收到 ADB 連線重設", "Activity 查詢收到 connection_reset"),
    ("已確認動畫瘋 Activity resumed", "已確認 Android Activity resumed"),
    ("開始辨識動畫瘋視窗與前景", "辨識 Windows 視窗與前景"),
    ("開始檢查動畫瘋全螢幕", "檢查動畫瘋全螢幕"),
    ("自動切換備援 已送出點擊", "自動切換備援 已送出點擊"),
    ("自動切換備援 略過點擊", "自動切換備援 略過點擊"),
    ("沿用已開啟的動畫瘋", "沿用現有視窗"),
    ("動畫瘋已在前景", "目標已在前景且填滿螢幕"),
    ("已送出一次 F11", "啟動器已送出 F11"),
    ("已確認動畫瘋在前景", "啟動器確認全螢幕"),
    ("啟動失敗", "啟動器回報失敗"),
)
TIMEOUT_TARGET = re.compile(r"目標 PID=(\d{1,10})，HWND=(0x[\da-fA-F]{1,16})。")
TIMEOUT_FRONT = re.compile(r"當下前景：([^\\/:*?\"<>|\x00-\x1f，]{1,220}\.exe)，PID=(\d{1,10})，HWND=(0x[\da-fA-F]{1,16})。", re.I)
OWNER = re.compile(r"啟動器視窗 HWND=(0x[\da-fA-F]{1,16}) 自有前景=([01])\b")
TRANSFER = re.compile(r"前景交接 目標 PID=(\d{1,10})，HWND=(0x[\da-fA-F]{1,16})\b")

# 只收錄已知錯誤類別、代碼及主程式行號，不儲存 stderr、視窗標題或其他 App 的資料。
ERROR_TYPES = {
    "AdbCommandError", "RuntimeError", "ValueError", "OSError", "error", "TimeoutExpired",
    "PermissionError", "FileNotFoundError", "TypeError", "AttributeError", "FailSafeException",
}
ADB_REASONS = {"device_offline", "device_missing", "service_unavailable", "unauthorized",
               "command_failed", "activity_dump_not_ready", "connection_reset"}
ERROR_SIGNALS = (
    ("找到多個動畫瘋", "multiple_targets"),
    ("找不到可切換", "target_missing"),
    ("等待期間動畫瘋視窗已關閉或更換", "target_changed"),
    ("動畫瘋視窗已變更或失去前景", "target_changed_or_unfocused"),
    ("動畫瘋視窗仍無法接收鍵盤輸入", "target_disabled"),
    ("動畫瘋未取得前景", "focus_denied"),
    ("Activity 進入 resumed 狀態", "activity_not_resumed"),
    ("尚未授權 ADB", "unauthorized"),
    ("找不到 ADB", "adb_missing"),
    ("秒仍無法連上", "adb_connection_timeout"),
    ("仍未回報開機完成", "boot_incomplete"),
    ("仍無法確認已切換全螢幕", "fullscreen_unconfirmed"),
    ("仍未確認內容區填滿螢幕", "fullscreen_unconfirmed"),
)


def describe_failure(error):
    name = type(error).__name__
    reason = getattr(error, "reason", None)
    if reason not in ADB_REASONS:
        message = str(error)
        reason = next((code for signal, code in ERROR_SIGNALS if signal in message), "other")
    fields = [f"type={name if name in ERROR_TYPES else 'Exception'}", f"reason={reason}"]
    if reason == "adb_connection_timeout":
        message = str(error).casefold()
        if "裝置狀態：adb get-state 逾時。連線回覆：already connected to " in message:
            fields.extend(("last_state=timeout", "last_connect=already_connected"))
        if any(hint in message for hint in
               ("connection reset by peer", "forcibly closed by the remote host", "wsaeconnreset")):
            fields.append("last_adb_reply=connection_reset")
    for attr in ("returncode", "winerror", "errno"):
        value = getattr(error, attr, None)
        if type(value) is int:
            fields.append(f"{attr}={value}")
    # 搭配 launcher_sha256 可定位到失敗的那一行，不必輸出 traceback 中的私人路徑。
    tb = error.__traceback__
    lineno = None
    while tb:
        if tb.tb_frame.f_code.co_filename == str(LAUNCHER):
            lineno = tb.tb_lineno
        tb = tb.tb_next
    if lineno is not None:
        fields.append(f"core_line={lineno}")
    return " ".join(fields)


def new_log():
    stem = "Animad_focus_trace_" + datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    for directory in (HERE / "logs", None):
        try:
            if directory is None:
                directory = Path(tempfile.gettempdir()) / "AnimadFullscreenLogs"
            directory.mkdir(exist_ok=True)
        except OSError:
            continue
        for number in range(100):
            suffix = "" if number == 0 else f"_{number}"
            path = directory / f"{stem}{suffix}.txt"
            try:
                return path.open("x", encoding="utf-8", buffering=1)
            except FileExistsError:
                continue
            except OSError:
                break
    raise OSError("診斷資料夾與暫存資料夾皆無法建立新的紀錄檔。")


def run_launcher():
    argv = sys.argv
    try:
        sys.argv = [str(LAUNCHER), "--gui", "--auto-activate", *argv[1:]]
        runpy.run_path(str(LAUNCHER), run_name="__main__")
    finally:
        sys.argv = argv


def traced_launch(log):
    import win32api
    import win32gui
    import win32process

    start = time.monotonic()
    stop = threading.Event()
    lock = threading.Lock()
    previous = object()
    stream = sys.stdout
    real_focus = win32gui.SetForegroundWindow
    try:
        initial_input = win32api.GetLastInputInfo()
    except Exception:
        initial_input = None

    def observe(label, changes_only=False):
        # 觀察失敗不能改變啟動器的前景判斷或阻止真正的 API 呼叫。
        nonlocal previous
        try:
            with lock:
                hwnd = win32gui.GetForegroundWindow() or 0
                pid = 0
                with suppress(Exception):
                    if hwnd:
                        _, pid = win32process.GetWindowThreadProcessId(hwnd)
                if changes_only and previous == (hwnd, pid):
                    return
                previous = (hwnd, pid)
                name = "?"
                if pid:
                    with suppress(Exception):
                        handle = win32api.OpenProcess(0x1000, False, pid)
                        try:
                            basename = ntpath.basename(win32process.GetModuleFileNameEx(handle, 0))
                            if re.fullmatch(r"[^\x00-\x1f|]{1,220}\.exe", basename, re.I):
                                name = basename
                        finally:
                            handle.Close()
                changed = "?"
                if initial_input is not None:
                    with suppress(Exception):
                        changed = str(int(win32api.GetLastInputInfo() != initial_input))
                print(f"+{time.monotonic()-start:.3f}s {label} | fg={name} "
                      f"PID={pid} HWND={hwnd:#x} input_changed={changed}", file=log, flush=True)
        except Exception:
            # 即使 Win32 的前景讀取失敗，也留下呼叫階段。
            with suppress(Exception):
                print(f"+{time.monotonic()-start:.3f}s {label} | fg=?", file=log, flush=True)

    def set_foreground(hwnd):
        target = f"target={hwnd:#x}"
        observe(f"SetForegroundWindow 要求 {target}")
        try:
            result = real_focus(hwnd)
        except Exception as error:
            code = getattr(error, "winerror", None)
            observe(f"SetForegroundWindow 例外 code={code} {target}")
            raise
        observe(f"SetForegroundWindow 正常返回 {target}")
        return result

    class StageOutput(io.TextIOBase):
        trace_path = log.name
        stage = "啟動器初始化"

        def record_failure(self, error):
            observe(f"啟動失敗階段 [{self.stage}] {describe_failure(error)}")

        def write(self, value):
            if stream is not None:
                with suppress(OSError, ValueError):
                    stream.write(value)
            owner = OWNER.match(value)
            handoff = TRANSFER.match(value)
            if owner:
                observe(f"啟動器視窗 HWND={owner[1]} 自有前景={owner[2]}")
                return len(value)
            if handoff:
                self.stage = "前景交接"
                observe(f"前景交接 目標 PID={handoff[1]} HWND={handoff[2]}")
                return len(value)
            for prefix, stage in STAGES:
                if value.startswith(prefix):
                    if stage == "啟動器回報失敗":
                        stop.set()
                        # 逾時訊息是原版還原主控台之前的快照，比此刻再查前景更早。
                        target = TIMEOUT_TARGET.search(value)
                        front = TIMEOUT_FRONT.search(value)
                        if target:
                            stage += f" [逾時目標 PID={target[1]} HWND={target[2]}]"
                        if front:
                            stage += f" [逾時前景 {front[1]} PID={front[2]} HWND={front[3]}]"
                    else:
                        self.stage = stage
                    observe(stage)
                    break
            return len(value)

        def flush(self):
            if stream is not None:
                with suppress(OSError, ValueError):
                    stream.flush()

    def poll():
        while not stop.wait(0.2) and time.monotonic() - start < 240:
            observe("前景取樣變更", changes_only=True)

    with suppress(OSError):
        print(f"launcher_sha256={hashlib.sha256(LAUNCHER.read_bytes()).hexdigest()}", file=log)
    with suppress(OSError):
        print(f"launcher_pid={os.getpid()}", file=log)
        print("auto_activate=1", file=log)
        print("input_changed=1 表示自啟動以來本工作階段的最近輸入時間戳曾變動。", file=log)
        print("取樣間隔 0.2 秒，最多 240 秒。", file=log)
    observe("診斷開始")
    observer = threading.Thread(target=poll, daemon=True)
    observer.start()
    try:
        win32gui.SetForegroundWindow = set_foreground
        with redirect_stdout(StageOutput()):
            run_launcher()
    finally:
        win32gui.SetForegroundWindow = real_focus
        stop.set()
        observer.join(timeout=1)


def main():
    log = None
    try:
        if sys.platform != "win32":
            raise RuntimeError("此啟動入口需在 Windows 上執行。")
        if not LAUNCHER.is_file():
            raise FileNotFoundError("找不到 PY_animad_fs.py，請完整解壓 ZIP 或將此入口放在主程式旁。")
        with suppress(OSError):
            log = new_log()
        if log is None:
            run_launcher()
        else:
            try:
                traced_launch(log)
            finally:
                with suppress(OSError):
                    log.close()
    except Exception as error:
        message = f"動畫瘋啟動器無法執行。\n\n{error}"
        if isinstance(error, ImportError):
            message += "\n\n請用開啟此檔的 Python 安裝 pywin32 和 pyautogui。"
        if log is not None:
            message += f"\n\n本次紀錄：{log.name}"
        if sys.platform == "win32":
            ctypes.windll.user32.MessageBoxW(None, message, "動畫瘋啟動器", 0x10)
        elif sys.stderr is not None:
            print(message, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
