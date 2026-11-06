"""雙擊啟用一次模擬點擊備援。完整解壓後與一般入口放在一起。"""
import ctypes
from pathlib import Path
import runpy
import sys

if __name__ == "__main__":
    entry = Path(__file__).with_name("啟動動畫瘋.pyw")
    if not entry.is_file():
        ctypes.windll.user32.MessageBoxW(None, "找不到「啟動動畫瘋.pyw」，請完整解壓交付包。", "動畫瘋啟動器", 0x10)
        sys.exit(1)
    sys.argv = [str(entry), "--auto-activate", *sys.argv[1:]]
    runpy.run_path(str(entry), run_name="__main__")
