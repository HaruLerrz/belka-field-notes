"""雙擊使用一般前景切換，不啟動診斷紀錄。"""
import ctypes
from pathlib import Path
import runpy
import sys


if __name__ == "__main__":
    core = Path(__file__).resolve().with_name("PY_animad_fs.py")
    if not core.is_file():
        ctypes.windll.user32.MessageBoxW(None, "找不到 PY_animad_fs.py，請完整解壓 ZIP。", "動畫瘋啟動器", 0x10)
        sys.exit(1)
    sys.argv = [str(core), "--gui", *sys.argv[1:]]
    try:
        runpy.run_path(str(core), run_name="__main__")
    except Exception as error:
        ctypes.windll.user32.MessageBoxW(None, f"動畫瘋啟動器無法執行。\n\n{error}", "動畫瘋啟動器", 0x10)
        sys.exit(1)
