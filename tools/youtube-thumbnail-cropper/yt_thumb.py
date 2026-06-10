import os
import requests
from PIL import Image
from io import BytesIO
import re
import yt_dlp

def get_video_id(url):
    """ 從 YouTube 影片網址擷取影片 ID，支援標準網址和縮網址 """
    # 支援 youtu.be 縮網址格式
    match = re.search(r"youtu\.be/([a-zA-Z0-9_-]+)", url)
    if match:
        return match.group(1)

    # 支援 youtube.com/watch?v= 這種標準網址
    match = re.search(r"v=([a-zA-Z0-9_-]+)", url)
    if match:
        return match.group(1)

    return None  # 解析失敗時回傳 None

def get_video_title(video_id):
    """ 直接用影片 ID 解析，確保一定抓到正確標題 """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'force_generic_extractor': True,  # 強制只抓取單一影片
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            title = info.get('title', 'unknown_title')
            title = re.sub(r'[\\/*?:"<>|]', '', title)  # 清理不允許的檔名字符
            return title
        except Exception as e:
            print(f"❌ 取得影片標題失敗：{e}")
            return "unknown_title"

def download_thumbnail(video_id):
    """ 下載 YouTube 縮圖 """
    url = f"https://i.ytimg.com/vi/{video_id}/maxres2.jpg"
    print(f"📥 嘗試下載縮圖：{url}")
    
    response = requests.get(url)
    
    if response.status_code == 200:
        print("✅ 縮圖下載成功！")
        return Image.open(BytesIO(response.content))
    else:
        print("❌ 下載失敗，可能是該影片沒有 maxres2 縮圖。")
        return None

def crop_to_960x720(image):
    """ 裁切圖片，從 1280×720 變成 960×720（去掉左右各 160 像素） """
    left = (1280 - 960) // 2  # 160
    right = left + 960         # 1120
    return image.crop((left, 0, right, 720))

def get_save_folder():
    """ 讓使用者選擇存桌面或下載資料夾 """
    print("\n📂 請選擇圖片儲存位置：")
    print("[1] 桌面 (預設)")
    print("[2] 下載資料夾")
    folder_choice = input("請選擇 (1/2，Enter 預設存桌面)：").strip()

    if folder_choice == "2":
        save_folder = os.path.join(os.path.expanduser("~"), "Downloads")  # 下載資料夾
    else:
        save_folder = os.path.join(os.path.expanduser("~"), "Desktop")  # 預設桌面
    return save_folder

def get_save_path(folder, title):
    """ 決定圖片儲存路徑，存成 PNG 格式 """
    return os.path.join(folder, f"{title}.png")  # 儲存為 PNG

def process_youtube_thumbnail(youtube_url):
    """ 主要處理流程：取得標題、下載縮圖、裁切、存檔 """
    video_id = get_video_id(youtube_url)
    
    if not video_id:
        print("❌ 無法解析 YouTube 影片 ID，請確認輸入的網址是否正確。")
        return
    
    video_title = get_video_title(video_id)

    # 修改前綴：「【V新聞】」→「【壹傳子V新聞】」
    video_title = video_title.replace("【V新聞】", "【壹傳子V新聞】", 1)

    image = download_thumbnail(video_id)
    
    if image:
        save_folder = get_save_folder()  # 讓使用者選擇存哪裡
        cropped_image = crop_to_960x720(image)
        save_path = get_save_path(save_folder, video_title)

        # 如果檔案已經存在，提示如何處理
        while os.path.exists(save_path):
            print(f"⚠️ 檔案已存在：{save_path}")
            print("[1] 覆蓋 (Overwrite)")
            print("[2] 重新命名 (Rename)")
            print("[3] 跳過 (Skip)")
            choice = input("請選擇操作 (1/2/3)：").strip()

            if choice == "1":
                break  # 直接覆蓋
            elif choice == "2":
                i = 1
                while os.path.exists(save_path):
                    save_path = get_save_path(save_folder, f"{video_title}_{i}")
                    i += 1
                break  # 重新命名後繼續存
            elif choice == "3":
                print("🚫 跳過下載。")
                return
            else:
                print("⚠️ 無效輸入，請輸入 1、2 或 3。")

        cropped_image.save(save_path, "PNG")  # 存為 PNG 格式
        print(f"✅ 已儲存裁切後的圖片：{save_path}")

# === 互動式輸入 ===
youtube_url = input("請輸入 YouTube 影片網址：")
process_youtube_thumbnail(youtube_url)

# 確保視窗不會立即關閉
input("\n✅ 任務完成！按 Enter 鍵關閉程式...")
