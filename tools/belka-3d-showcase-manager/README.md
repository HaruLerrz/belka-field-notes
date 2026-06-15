# Belka 3D Showcase Manager

一套可自行架設的靜態 3D 作品展示站，搭配 Windows PowerShell 圖形化發布管理器。  
管理器可新增、更新、重新命名、上架、下架與刪除作品，並輸出可直接上傳到網站根目錄的增量 ZIP。

目前版本：`v1.0.1`

## 主要功能

### 公開展示網站

- 支援 GLB、OBJ、STL、PLY
- 原始材質、灰模、法線三種顯示模式
- 自動旋轉、網格、重設鏡頭、全螢幕
- 主要稜線與自動對比外輪廓
- 模型頂點與三角面統計
- 原始參考圖展示
- 模型載入封面、容量與進度提示
- 首頁可切換「新的在前」與「舊的在前」
- Viewer 程式預載與作品卡片延遲預抓
- 時間碼模型與靜態資源長期快取

### Windows 作品管理器

- 新增作品
- 更新名稱、說明、模型與原圖
- 重新命名作品代號與資料夾
- 上架或下架
- 刪除作品並保留本機封存
- 從正式網站同步 `works.json`
- 輸出 Linux／DirectAdmin 相容的增量 ZIP
- 修復舊 ZIP 的反斜線路徑問題
- 一鍵產生只含網站 runtime 的伺服器部署 ZIP

## 執行環境

管理器：

- Windows 10 或 Windows 11
- Windows PowerShell 5.1

本機預覽：

- Python 3
- 瀏覽器

展示網站：

- 一般靜態網站主機
- Apache 主機可直接使用附帶的 `.htaccess`
- 伺服器需要正確提供 JavaScript、WASM 與 3D 模型檔案

重建 Viewer：

- Node.js
- npm

## Repo-safe 本機資料

公開套件只追蹤範本：

```text
manager-config.example.json
works.example.json
```

首次啟動管理器、本機預覽或建立伺服器部署包時，工具會依需要建立：

```text
manager-config.json
works.json
```

這兩個本機檔案與 `works/` 內的模型、原圖都已加入 `.gitignore`，可降低正式網址、主機路徑，以及大型模型與圖片檔案被意外提交的風險。

## 全新使用者最快流程

### 1. 完整解壓縮套件

不要直接在 ZIP 預覽視窗中執行管理器。

### 2. 啟動一次管理器

雙擊：

```text
START_MANAGER.cmd
```

首次啟動會由範本建立本機的：

```text
manager-config.json
works.json
```

若 GUI 沒有開啟，執行：

```text
DEBUG_MANAGER.cmd
```

完整錯誤會寫入：

```text
logs/manager_startup_error.log
```

### 3. 設定自己的正式站台

關閉管理器後，編輯根目錄的 `manager-config.json`：

```json
{
  "siteUrl": "https://example.com/",
  "serverRootHint": "/domains/example.com/public_html/"
}
```

- `siteUrl`：管理器用來開啟網站與同步線上的 `works.json`
- `serverRootHint`：寫入增量 ZIP 內的上傳提示
- 這個檔案只供本機管理器使用，不會控制網站首頁內容

第一次按「從網站同步清單」以前，仍須先完成初次部署，否則線上尚未存在 `works.json`。

### 4. 建立初次伺服器部署包

雙擊：

```text
BUILD_SERVER_PACKAGE.cmd
```

工具會建立：

```text
server-packages/Belka_3D_Showcase_Server_日期時間.zip
```

這個 ZIP 只包含網站執行需要的檔案與第三方授權聲明。

### 5. 部署到伺服器

將 Server ZIP 上傳到網站根目錄，例如：

```text
/domains/example.com/public_html/
```

在網站根目錄直接解壓縮、合併並覆蓋。

完成後應能開啟：

```text
https://example.com/
```

初始 `works.json` 是空作品清單，因此首頁會先顯示沒有作品。

### 6. 新增第一件作品

再次開啟 `START_MANAGER.cmd`，在 GUI 中填寫：

1. 作品代號
2. 作品名稱
3. 作品說明
4. 3D 模型
5. 原始參考圖
6. 預設材質模式

管理器會建立：

```text
works/<作品代號>/
├─ index.html
├─ model_<日期時間>.<副檔名>
└─ original_<日期時間>.<副檔名>
```

完成後，增量 ZIP 會出現在：

```text
upload-patches/
```

### 7. 上傳作品增量 ZIP

將增量 ZIP 上傳到同一個網站根目錄，直接解壓縮並覆蓋。

ZIP 會包含：

- `works.json`
- 本次新增或更新的作品檔案
- `_伺服器操作說明.txt`

刪除或重新命名作品時，說明檔會列出可在主機上手動清理的舊路徑。

## 可以把整個套件直接放進 public_html 嗎？

技術上可以，首頁與 Viewer 仍會運作。  
實務上不建議這樣部署。

整包上傳會讓以下本機檔案也能被網路直接存取：

```text
manager-config.json
manager-config.example.json
works.example.json
tools/
src/
logs/
upload-patches/
_archive/
package.json
package-lock.json
BUILD_VIEWER.cmd
START_MANAGER.cmd
```

`manager-config.json` 可能包含正式站台與主機路徑，`tools/` 與 `src/` 也不屬於網站 runtime。

建議固定使用：

```text
BUILD_SERVER_PACKAGE.cmd
```

它只會收集：

```text
.htaccess
index.html
robots.txt
works.json
viewer/
shared/
works/
LICENSE
THIRD_PARTY_NOTICES.md
LICENSES/
```

因此這包本身同時包含：

1. 可在本機執行的管理器
2. 可在本機預覽的完整網站
3. 可一鍵產生的乾淨伺服器部署包

## 手動部署方式

不使用建置工具時，也可以手動把下列項目上傳到網站根目錄：

```text
.htaccess
index.html
robots.txt
works.json
viewer/
shared/
works/
LICENSE
THIRD_PARTY_NOTICES.md
LICENSES/
```

不要上傳：

```text
manager-config.json
manager-config.example.json
works.example.json
tools/
src/
logs/
upload-patches/
_archive/
node_modules/
.git/
```

## 本機預覽

雙擊：

```text
START_PREVIEW.cmd
```

啟動器會先建立缺少的 `works.json`、啟動 Python HTTP Server，再於瀏覽器開啟：

```text
http://localhost:8000/
```

預覽伺服器會保留在獨立命令列視窗；關閉該視窗即可停止伺服器。

`file://` 直接開啟 HTML 通常會受瀏覽器跨來源規則限制，因此請使用本機 HTTP Server 預覽。

## 作品清單格式

網站首頁與 Viewer 都讀取根目錄的 `works.json`；初始格式來自 `works.example.json`。

最小作品範例：

```json
{
  "id": "sample-model",
  "title": "範例模型",
  "description": "範例說明",
  "page": "works/sample-model/",
  "legacyBase": "",
  "model": "works/sample-model/model_2026-01-01_12-00-00.glb",
  "image": "works/sample-model/original_2026-01-01_12-00-00.webp",
  "materialMode": "auto",
  "accentColor": "#9d78ff",
  "published": true
}
```

`materialMode` 可使用：

- `auto`
- `original`
- `clay`
- `normal`

### OBJ 與外部貼圖限制

管理器會在選取 OBJ 時自動複製同名的 `.mtl`，但目前不會解析 MTL 並自動收集其中引用的外部貼圖。依賴多張外部貼圖的 OBJ，建議先轉成 GLB；也可以在建立作品後，手動把貼圖補入對應的 `works/<作品代號>/` 資料夾，再重新產生更新包。

## 重新建置 Viewer

Repository 內保留可讀原始碼：

```text
src/viewer.js
```

使用已提交的 lockfile 安裝固定依賴：

```bash
npm ci
```

建置：

```bash
npm run build:viewer
```

Windows 也可雙擊：

```text
BUILD_VIEWER.cmd
```

輸出檔案：

```text
shared/viewer.bundle.min.js
```

建置使用固定版本：

- three.js `0.184.0`
- esbuild `0.28.1`

## 目錄結構

```text
.
├─ index.html
├─ manager-config.example.json
├─ works.example.json
├─ package.json
├─ package-lock.json
├─ BUILD_SERVER_PACKAGE.cmd
├─ BUILD_VIEWER.cmd
├─ START_MANAGER.cmd
├─ START_PREVIEW.cmd
├─ viewer/
│  └─ index.html
├─ shared/
│  ├─ home.js
│  ├─ home.css
│  ├─ viewer.css
│  ├─ viewer.bundle.min.js
│  └─ vendor/draco/gltf/
├─ src/
│  └─ viewer.js
├─ tools/
│  ├─ bootstrap.ps1
│  ├─ initialize_workspace.ps1
│  ├─ build_server_package.ps1
│  ├─ manager.ps1
│  └─ repair_zip.ps1
├─ works/
├─ server-packages/
├─ upload-patches/
├─ _archive/
├─ LICENSES/
├─ THIRD_PARTY_NOTICES.md
├─ LICENSE
└─ README.md
```

`manager-config.json` 與 `works.json` 是首次使用後產生的本機檔案，因此不列為公開套件的固定內容。

## 部署注意事項

1. `viewer.bundle.min.js` 已包含 three.js 與 Meshopt decoder。
2. Draco decoder 仍從 `shared/vendor/draco/gltf/` 載入，該資料夾不可刪除。
3. `works.json` 與 HTML 使用重新驗證，時間碼模型與靜態程式檔可長期快取。
4. `robots.txt` 與 HTML 目前採不收錄設定，公開站台需要搜尋引擎收錄時，請自行調整。
5. 大型 GLB 不適合直接放進一般 Git 歷史。可使用 Git LFS、Release 附件或外部物件儲存。
6. 模型與圖片未包含在此範本。上傳者需自行確認素材權利。
7. 從 GitHub clone 後，絕對不要把 `.git/` 一起上傳到公開網站。

## 版本紀錄

### v1.0.1

1. 將公開專案名稱整理為 Belka 3D Showcase Manager。
2. 分離本機設定、作品清單與大型模型檔案，加入 repo-safe 範本及 `.gitignore`。
3. 加入 `package-lock.json`，並確認 Viewer 可由可讀原始碼重建出相同 bundle。
4. 修正本機預覽的啟動順序，先啟動 HTTP Server，再開啟瀏覽器。
5. 整理伺服器部署白名單、第三方授權全文與 notices。
6. 補充 OBJ 外部貼圖的支援限制。
7. 在 Windows 完成管理工具、本機預覽與完整網站部署包的基本功能測試。

### v1.0.0

1. 建立共用 Viewer、`works.json` 作品清單與靜態作品首頁。
2. 建立 Windows 圖形化管理工具，支援作品新增、更新、重新命名、上下架與刪除。
3. 加入本機封存、線上清單同步、增量更新 ZIP 與完整網站部署包。
4. 加入舊 ZIP 路徑修復工具與網站首次載入調整。

## 授權

本專案自行撰寫的程式碼採 MIT License：

```text
MIT License

Copyright (c) 2025-2026 HaruLerrz
```

第三方元件維持原授權：

- three.js：MIT
- meshoptimizer：MIT
- Google Draco：Apache License 2.0
- esbuild：MIT，僅作為建置工具

完整說明與授權全文位於：

```text
THIRD_PARTY_NOTICES.md
LICENSES/
```

預建置的 `shared/viewer.bundle.min.js` 可隨 Repository 與 Server 部署包一同散布。保留本專案授權、`THIRD_PARTY_NOTICES.md` 與 `LICENSES/` 即可維持元件授權聲明。
