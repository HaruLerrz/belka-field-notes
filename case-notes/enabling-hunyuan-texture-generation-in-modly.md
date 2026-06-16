# Enabling Hunyuan Texture Generation in Modly

本頁記錄我在 Windows 版 Modly 中，將 Hunyuan3D Mini 擴充套件已存在、但安裝版介面未提供的材質生成流程實際跑通的過程。

本案例的範圍是：

```text
參考圖片
→ Hunyuan3D Mini 生成模型
→ Hunyuan Paint 產生材質
→ 輸出帶材質的模型
```

## Background

2026 年 6 月，我原本想用 Trellis2GGUF 的 Texture Mesh 功能替既有模型上材質，但完整模型與量化權重的空間及硬體需求都偏高。

排查 Modly 的 Hunyuan3D Mini 擴充套件後，發現後端已包含：

* `enable_texture`
* `Hunyuan3DPaintPipeline`
* Hunyuan3D Paint Turbo 權重下載流程
* 生成 mesh 後再執行材質處理的程式路徑

實際安裝版介面沒有顯示材質開關，Texture 相關相依項也沒有在安裝階段完整準備，因此需要逐步補上介面、Python 套件、C++／CUDA 元件與載入相容性修正。

## Test Environment

此次成功環境包含：

* Windows
* NVIDIA GeForce RTX 2080 8GB
* Modly 的 Hunyuan3D Mini extension venv
* Python 3.11
* PyTorch 2.7.0 + CUDA 12.8 runtime
* Visual Studio 2022 Build Tools
* 本機 CUDA Toolkit

這些版本只描述本次實測環境，不代表其他版本必須完全相同。

## Step 1: Expose the Texture Option

Hunyuan3D Mini 的 `generator.py` 已經會讀取 `enable_texture`，但安裝版的 `manifest.json` 沒有把它呈現在模型參數中。

在 `params_schema` 加入 `Generate Texture` 的 Off／On 選項後，Modly 介面便能把 `enable_texture = 1` 傳給後端。

這項修改只負責露出既有後端路徑，尚未解決 Texture 執行所需的相依項。

## Step 2: Complete Missing Python Dependencies

第一次啟用 Texture 時，匯入流程先停在：

```text
ModuleNotFoundError: No module named 'xatlas'
```

後續在 Hunyuan3D Mini 自己的 venv 中補入：

* `xatlas`
* `ninja`
* `pygltflib`
* `pybind11`
* `hf_xet`

其中 `hf_xet` 用於改善大型 Hunyuan Paint 權重的下載；其餘套件分別支援 UV、建置與 GLB 處理。

這次排查也確認，錯誤訊息將多種 Texture 匯入失敗統一描述成 C++ extension 問題，因此需依 traceback 最後一個實際缺少的模組逐項處理。

## Step 3: Download Hunyuan Paint Weights

第一次執行會另外下載 Hunyuan Paint 與去光影模型。下載曾長時間停在相同檔案數，但既有檔案與未完成暫存可在重新啟動後續用。

處理原則是：

* 以資料夾容量、網路流量及暫存檔變化判斷是否仍在下載。
* 取消後保留 `_paint_weights`，避免刪除已完成檔案。
* 權重缺檔時只補抓指定檔案。
* 保留官方 loader 使用的 `.bin` 權重格式。

曾嘗試改讀 safetensors，但權重結構不符合原 loader，最後恢復官方 `.bin` 路徑。

## Step 4: Build Native Extensions

權重到位後，下一個明確錯誤是：

```text
No module named 'custom_rasterizer'
```

Hunyuan Paint 還需要兩個本機編譯元件：

```text
custom_rasterizer
mesh_processor
```

實際處理包含：

* 使用 Visual Studio 2022 的 x64 開發者命令列環境。
* 使用 Hunyuan3D Mini extension 自己的 Python venv。
* 以 `--no-build-isolation` 避免隔離建置環境找不到既有 PyTorch。
* 設定 RTX 2080 對應的 `TORCH_CUDA_ARCH_LIST=7.5`。
* 補入 `pybind11` 後編譯 differentiable renderer。
* 匯入 CUDA extension 前先載入 `torch`，讓 Windows 建立需要的 DLL 搜尋路徑。

完成後可分別匯入：

```text
custom_rasterizer
custom_rasterizer_kernel
mesh_processor
```

## Step 5: Allow the Custom Diffusers Pipeline

Hunyuan Paint 使用自訂 Diffusers pipeline。模型載入時曾停止並要求：

```text
Pass trust_remote_code=True to allow loading remote code modules.
```

因此在對應的 `from_pretrained()` 呼叫保留：

```python
trust_remote_code=True
```

這一步讓本機的 Hunyuan Paint pipeline 程式碼可以被 Diffusers 載入。

## Step 6: Resolve the UNet Type Check

清除 Hugging Face 動態模組快取後，仍持續出現：

```text
Expected:
diffusers_modules.local.unet.modules.UNet2p5DConditionModel

Got:
diffusers_modules.local.modules.UNet2p5DConditionModel
```

兩者的程式內容相同，Python 仍會把不同模組路徑下的類別視為不同型別。

最後將 Hunyuan Paint pipeline 建構式中的 UNet 型別註記，由特定自訂類別放寬為：

```python
torch.nn.Module
```

這項修改保留模型本身的權重與方法，只處理新版 Diffusers 動態載入所造成的類別路徑不一致。

## Step 7: Fit the Paint Pipeline into 8GB VRAM

完成模型載入與型別檢查後，流程會嘗試把去光影模型及多視角材質模型整套搬進 GPU。RTX 2080 的 8GB VRAM 無法穩定容納全部元件。

因此在兩個位置改用 Diffusers CPU offload：

```text
dehighlight_utils.py
multiview_utils.py
```

原本直接執行 `.to(device)` 的位置，改成：

```python
pipeline.enable_model_cpu_offload(device=self.device)
self.pipeline = pipeline
```

這會增加模型元件在系統記憶體與 GPU 之間搬移的時間，也可能產生很長的無文字進度區間；本次實測最後仍成功完成材質生成。

## Warnings That Did Not Stop Generation

### VAE safetensors fallback

日誌會顯示找不到：

```text
diffusion_pytorch_model.safetensors
```

接著改用 `.bin`。只要後續仍完成 pipeline components 載入，這是 fallback 警告，不代表 VAE 載入失敗。

### Turbo timestep schedule

Hunyuan Paint Turbo 會使用自己的 timestep 排程，新版 Diffusers 可能警告第一個 timestep 不是 999，或部分 timestep 不在預設 LCM 排程中。

此次輸出能正常完成，因此保留 Hunyuan Paint 原有排程，沒有為了消除警告修改 scheduler 或 timestep。

## Result

完成上述修改後，Modly 的 Hunyuan3D Mini 可以：

1. 產生 3D 模型。
2. 啟動 Hunyuan Paint 材質流程。
3. 根據參考圖片為模型產生材質。
4. 輸出帶材質的模型。

第一次成功結果的品質仍有限，但已將問題從「功能無法執行」推進到「可進一步比較輸入、mesh、材質解析度與生成品質」。

## Scope and Limitations

* 目前 Texture 仍接在同一次 Hunyuan mesh 生成後方。
* CPU offload 讓 8GB VRAM 環境可以完成流程，速度會明顯變慢。
* Repair、更新 extension、重新下載模型程式或重裝 Modly，可能覆蓋手動修改。
* 此頁記錄排查與修改方向，沒有重新散布 Modly 或 Hunyuan 的第三方程式碼及模型權重。
* 不同 Modly、Diffusers、PyTorch 與 Hunyuan 版本可能需要不同修正。

## Files Touched During the Investigation

主要涉及：

```text
extensions/hunyuan3d-mini/manifest.json
models/hunyuan3d-mini/generate/_hy3dgen/hy3dgen/texgen/hunyuanpaint/pipeline.py
models/hunyuan3d-mini/generate/_hy3dgen/hy3dgen/texgen/utils/dehighlight_utils.py
models/hunyuan3d-mini/generate/_hy3dgen/hy3dgen/texgen/utils/multiview_utils.py
```

另在 Hunyuan3D Mini extension venv 中安裝 Python 套件，並編譯 `custom_rasterizer` 與 `mesh_processor`。

## What This Case Shows

這個案例記錄了：

* 從前端缺少選項，追查到後端已存在的功能路徑。
* 依 traceback 逐層拆解 Python、模型權重、C++、CUDA、Diffusers 與 VRAM 問題。
* 分辨可忽略的 fallback／scheduler 警告與真正的終止錯誤。
* 避免把大型權重問題一律處理成整包重抓。
* 在 8GB VRAM 環境中，以 CPU offload 完成原本無法啟動的材質流程。
* 記錄失敗嘗試與恢復原始 loader 的過程，區分暫時可執行的替代作法與最終採用的修正。

## Navigation

* [返回 Case Notes](README.md)
* [返回 Digital Workflow Prototyping](digital-workflow-prototyping.md)
* [查看 Belka 3D Showcase](belka-3d-showcase.md)
* [查看簡歷摘要](../profile/resume-lite.md)
* [返回根 README](../README.md)
