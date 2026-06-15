$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

function Write-Utf8NoBom([string]$Path, [string]$Content) {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Set-Property($Object, [string]$Name, $Value) {
    if ($Object.PSObject.Properties.Name -contains $Name) {
        $Object.$Name = $Value
    } else {
        $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
    }
}

function Safe-Id([string]$Value) {
    return $Value.Trim().ToLower()
}

function Test-WorkId([string]$Value) {
    return $Value -match '^[a-z0-9][a-z0-9_-]*$'
}

function Get-TimeCode {
    return Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
}

function Get-IsoTime {
    return Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"
}

$script:Root = Split-Path -Parent $PSScriptRoot
$script:ConfigPath = Join-Path $script:Root "manager-config.json"
$script:ConfigExamplePath = Join-Path $script:Root "manager-config.example.json"
$script:WorksJsonPath = Join-Path $script:Root "works.json"
$script:WorksExamplePath = Join-Path $script:Root "works.example.json"
$script:PatchesDir = Join-Path $script:Root "upload-patches"
$script:ArchiveDir = Join-Path $script:Root "_archive"
$script:Data = $null
$script:Config = $null
$script:SiteUrl = ""
$script:ServerRootHint = ""

function Load-ManagerConfig {
    $defaultConfig = [PSCustomObject][ordered]@{
        siteUrl = ""
        serverRootHint = "/path/to/public_html/"
    }

    if (Test-Path -LiteralPath $script:ConfigPath) {
        try {
            $script:Config = Get-Content -LiteralPath $script:ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        }
        catch {
            throw "manager-config.json 格式錯誤：$($_.Exception.Message)"
        }
    } else {
        if (Test-Path -LiteralPath $script:ConfigExamplePath) {
            Copy-Item -LiteralPath $script:ConfigExamplePath -Destination $script:ConfigPath -Force
            $script:Config = Get-Content -LiteralPath $script:ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        } else {
            $script:Config = $defaultConfig
            $json = $script:Config | ConvertTo-Json -Depth 5
            Write-Utf8NoBom $script:ConfigPath $json
        }
    }

    if (-not ($script:Config.PSObject.Properties.Name -contains "siteUrl")) {
        Set-Property $script:Config "siteUrl" ""
    }
    if (-not ($script:Config.PSObject.Properties.Name -contains "serverRootHint")) {
        Set-Property $script:Config "serverRootHint" "/path/to/public_html/"
    }

    $script:SiteUrl = ([string]$script:Config.siteUrl).Trim()
    if ($script:SiteUrl -and -not $script:SiteUrl.EndsWith("/")) {
        $script:SiteUrl += "/"
    }

    $script:ServerRootHint = ([string]$script:Config.serverRootHint).Trim()
    if ([string]::IsNullOrWhiteSpace($script:ServerRootHint)) {
        $script:ServerRootHint = "網站根目錄"
    }
}

Load-ManagerConfig
$script:VisibleWorks = @()
$script:SelectedOriginalId = ""
$script:SelectedModelSource = ""
$script:SelectedImageSource = ""

New-Item -ItemType Directory -Force -Path $script:PatchesDir | Out-Null
New-Item -ItemType Directory -Force -Path $script:ArchiveDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $script:Root "works") | Out-Null

function Load-WorksData {
    if (-not (Test-Path -LiteralPath $script:WorksJsonPath)) {
        if (Test-Path -LiteralPath $script:WorksExamplePath) {
            Copy-Item -LiteralPath $script:WorksExamplePath -Destination $script:WorksJsonPath -Force
        } else {
            throw "找不到 works.json 或 works.example.json。"
        }
    }
    $script:Data = Get-Content -LiteralPath $script:WorksJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($null -eq $script:Data.works) {
        Set-Property $script:Data "works" @()
    }
}

function Save-WorksData {
    $json = $script:Data | ConvertTo-Json -Depth 20
    Write-Utf8NoBom $script:WorksJsonPath $json
}

function Get-WorkById([string]$Id) {
    return @($script:Data.works) | Where-Object { $_.id -eq $Id } | Select-Object -First 1
}

function Get-WorkIndex([string]$Id) {
    $works = @($script:Data.works)
    for ($i = 0; $i -lt $works.Count; $i++) {
        if ($works[$i].id -eq $Id) { return $i }
    }
    return -1
}

function Get-PagePath($Work) {
    if ($Work.page) { return [string]$Work.page }
    if ($Work.legacyBase) { return ([string]$Work.legacyBase).TrimEnd('/') + "/" }
    return "works/$($Work.id)/"
}

function New-RedirectHtml([string]$ViewerUrl, [string]$Title) {
    $safeTitle = [System.Net.WebUtility]::HtmlEncode($Title)
    return @"
<!doctype html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex,nofollow" />
  <meta http-equiv="refresh" content="0; url=$ViewerUrl" />
  <title>$safeTitle</title>
</head>
<body>
  <script>location.replace('$ViewerUrl');</script>
  <p><a href="$ViewerUrl">前往 $safeTitle</a></p>
</body>
</html>
"@
}

function New-HomepageRedirectHtml([string]$Title, [string]$HomeUrl) {
    $safeTitle = [System.Net.WebUtility]::HtmlEncode($Title)
    return @"
<!doctype html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex,nofollow" />
  <meta http-equiv="refresh" content="0; url=$HomeUrl" />
  <title>$safeTitle 已下架</title>
</head>
<body>
  <script>location.replace('$HomeUrl');</script>
  <p>此作品已下架。<a href="$HomeUrl">回到作品列表</a></p>
</body>
</html>
"@
}

function Ensure-WorkEntryPage([string]$Id, [string]$Title) {
    $workDir = Join-Path $script:Root ("works\" + $Id)
    New-Item -ItemType Directory -Force -Path $workDir | Out-Null
    $viewerUrl = "../../viewer/?id=" + [System.Uri]::EscapeDataString($Id)
    Write-Utf8NoBom (Join-Path $workDir "index.html") (New-RedirectHtml $viewerUrl $Title)
    return $workDir
}

function Select-ModelFile {
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = "選擇 3D 模型"
    $dialog.Filter = "3D 模型 (*.glb;*.obj;*.stl;*.ply)|*.glb;*.obj;*.stl;*.ply|所有檔案 (*.*)|*.*"
    $dialog.Multiselect = $false
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        return $dialog.FileName
    }
    return ""
}

function Select-ImageFile {
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = "選擇原始參考圖"
    $dialog.Filter = "圖片 (*.jpg;*.jpeg;*.png;*.webp;*.avif)|*.jpg;*.jpeg;*.png;*.webp;*.avif|所有檔案 (*.*)|*.*"
    $dialog.Multiselect = $false
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        return $dialog.FileName
    }
    return ""
}

function Copy-SelectedAssets([string]$Id, [string]$ModelSource, [string]$ImageSource, $ExistingWork) {
    $timestamp = Get-TimeCode
    $workDir = Ensure-WorkEntryPage $Id $txtTitle.Text.Trim()

    $modelRelative = if ($ExistingWork -and $ExistingWork.model) { [string]$ExistingWork.model } else { "" }
    $imageRelative = if ($ExistingWork -and $ExistingWork.image) { [string]$ExistingWork.image } else { "" }

    if ($ModelSource) {
        $ext = [System.IO.Path]::GetExtension($ModelSource).ToLower()
        $name = "model_" + $timestamp + $ext
        Copy-Item -LiteralPath $ModelSource -Destination (Join-Path $workDir $name) -Force
        $modelRelative = "works/$Id/$name"

        if ($ext -eq ".obj") {
            $mtlSource = [System.IO.Path]::ChangeExtension($ModelSource, ".mtl")
            if (Test-Path $mtlSource) {
                Copy-Item -LiteralPath $mtlSource -Destination (Join-Path $workDir ([System.IO.Path]::GetFileName($mtlSource))) -Force
            }
        }
    }

    if ($ImageSource) {
        $ext = [System.IO.Path]::GetExtension($ImageSource).ToLower()
        $name = "original_" + $timestamp + $ext
        Copy-Item -LiteralPath $ImageSource -Destination (Join-Path $workDir $name) -Force
        $imageRelative = "works/$Id/$name"
    }

    return [PSCustomObject]@{
        WorkDir = $workDir
        Model = $modelRelative
        Image = $imageRelative
    }
}

function Find-LocalAsset([string]$RelativePath) {
    if ([string]::IsNullOrWhiteSpace($RelativePath)) { return "" }
    $candidate = Join-Path $script:Root ($RelativePath -replace '/', '\')
    if (Test-Path $candidate) { return $candidate }
    return ""
}

function Copy-MigratedAssets([string]$OldId, [string]$NewId, $OldWork, [string]$ModelSource, [string]$ImageSource) {
    if (-not $ModelSource) { $ModelSource = Find-LocalAsset ([string]$OldWork.model) }
    if (-not $ImageSource) { $ImageSource = Find-LocalAsset ([string]$OldWork.image) }

    if (-not $ModelSource -or -not (Test-Path $ModelSource)) {
        throw "重新命名時找不到可搬移的模型。請按「選模型」指定一次目前模型檔。"
    }
    if (-not $ImageSource -or -not (Test-Path $ImageSource)) {
        throw "重新命名時找不到可搬移的原圖。請按「選原圖」指定一次目前圖片。"
    }

    return Copy-SelectedAssets $NewId $ModelSource $ImageSource $null
}

function Add-StagingFile([string]$Staging, [string]$RelativePath) {
    $source = Join-Path $script:Root ($RelativePath -replace '/', '\')
    if (-not (Test-Path $source)) { return }

    $destination = Join-Path $Staging ($RelativePath -replace '/', '\')
    $parent = Split-Path -Parent $destination
    New-Item -ItemType Directory -Force -Path $parent | Out-Null

    if (Test-Path $source -PathType Container) {
        Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
    } else {
        Copy-Item -LiteralPath $source -Destination $destination -Force
    }
}


function New-PortableZip([string]$SourceDirectory, [string]$DestinationZip) {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    if (Test-Path -LiteralPath $DestinationZip) {
        Remove-Item -LiteralPath $DestinationZip -Force
    }

    $sourceFull = [System.IO.Path]::GetFullPath($SourceDirectory).TrimEnd([char[]]"\/")
    $fileStream = [System.IO.File]::Open(
        $DestinationZip,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )

    try {
        $archive = New-Object System.IO.Compression.ZipArchive(
            $fileStream,
            [System.IO.Compression.ZipArchiveMode]::Create,
            $false,
            [System.Text.Encoding]::UTF8
        )

        try {
            $files = Get-ChildItem -LiteralPath $sourceFull -Recurse -File
            foreach ($file in $files) {
                $relativePath = $file.FullName.Substring($sourceFull.Length).TrimStart([char[]]"\/")

                # ZIP 規格與 Linux 解壓器要求使用正斜線作為資料夾分隔符。
                $entryName = $relativePath.Replace('\', '/')

                $entry = $archive.CreateEntry(
                    $entryName,
                    [System.IO.Compression.CompressionLevel]::Optimal
                )
                $entry.LastWriteTime = $file.LastWriteTime

                $inputStream = [System.IO.File]::OpenRead($file.FullName)
                $entryStream = $entry.Open()
                try {
                    $inputStream.CopyTo($entryStream)
                }
                finally {
                    $entryStream.Dispose()
                    $inputStream.Dispose()
                }
            }
        }
        finally {
            $archive.Dispose()
        }
    }
    finally {
        $fileStream.Dispose()
    }
}

function New-IncrementPatch(
    [string]$Operation,
    [string]$Id,
    [string[]]$IncludePaths,
    [string[]]$ServerDeletePaths,
    [string[]]$Notes
) {
    Save-WorksData

    $timestamp = Get-TimeCode
    $safeOperation = $Operation -replace '[\\/:*?"<>| ]', '_'
    $safeId = if ($Id) { $Id } else { "site" }
    $zipPath = Join-Path $script:PatchesDir ("增量更新_" + $safeOperation + "_" + $safeId + "_" + $timestamp + ".zip")
    $staging = Join-Path $env:TEMP ("belka-3d-patch-" + [Guid]::NewGuid().ToString("N"))

    New-Item -ItemType Directory -Force -Path $staging | Out-Null
    Copy-Item -LiteralPath $script:WorksJsonPath -Destination (Join-Path $staging "works.json") -Force

    foreach ($relativePath in @($IncludePaths | Select-Object -Unique)) {
        if ($relativePath) { Add-StagingFile $staging $relativePath }
    }

    $actions = @()
    $actions += "操作：$Operation"
    $actions += "作品：$safeId"
    $actions += "建立時間：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $actions += ""
    $actions += "將這個 ZIP 上傳到 $script:ServerRootHint，直接解壓縮並覆蓋。"

    if ($Notes.Count -gt 0) {
        $actions += ""
        $actions += "說明："
        foreach ($note in $Notes) { $actions += "- $note" }
    }

    if ($ServerDeletePaths.Count -gt 0) {
        $actions += ""
        $actions += "ZIP 解壓縮無法自動刪除主機檔案。確認網站正常後，可在 DirectAdmin 手動刪除："
        foreach ($deletePath in $ServerDeletePaths) { $actions += "- $deletePath" }
    }

    Write-Utf8NoBom (Join-Path $staging "_伺服器操作說明.txt") ($actions -join "`r`n")

    try {
        New-PortableZip $staging $zipPath
    }
    finally {
        if (Test-Path -LiteralPath $staging) {
            Remove-Item -LiteralPath $staging -Recurse -Force
        }
    }

    $lblStatus.Text = "已產生增量更新：" + [System.IO.Path]::GetFileName($zipPath)
    $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(70, 150, 90)
    Start-Process explorer.exe -ArgumentList "/select,`"$zipPath`""
    return $zipPath
}

function Refresh-WorkList([string]$SelectId = "") {
    $listWorks.Items.Clear()
    $script:VisibleWorks = @($script:Data.works | Sort-Object title, id)

    foreach ($work in $script:VisibleWorks) {
        $state = if ($work.published -eq $false) { "隱藏" } else { "顯示" }
        [void]$listWorks.Items.Add("[$state] $($work.title)  ($($work.id))")
    }

    if ($SelectId) {
        for ($i = 0; $i -lt $script:VisibleWorks.Count; $i++) {
            if ($script:VisibleWorks[$i].id -eq $SelectId) {
                $listWorks.SelectedIndex = $i
                break
            }
        }
    }
}

function Clear-Editor {
    $script:SelectedOriginalId = ""
    $script:SelectedModelSource = ""
    $script:SelectedImageSource = ""
    $txtId.Text = ""
    $txtTitle.Text = ""
    $txtDescription.Text = ""
    $txtModel.Text = "未選擇（新增作品時必選；更新時留空代表保留）"
    $txtImage.Text = "未選擇（新增作品時必選；更新時留空代表保留）"
    $comboMaterial.SelectedItem = "auto"
    $chkPublished.Checked = $true
    $lblCurrentPaths.Text = "目前路徑：—"
    $listWorks.ClearSelected()
}

function Load-SelectedWork {
    if ($listWorks.SelectedIndex -lt 0) { return }
    $work = $script:VisibleWorks[$listWorks.SelectedIndex]
    $script:SelectedOriginalId = [string]$work.id
    $script:SelectedModelSource = ""
    $script:SelectedImageSource = ""

    $txtId.Text = [string]$work.id
    $txtTitle.Text = [string]$work.title
    $txtDescription.Text = [string]$work.description
    $txtModel.Text = "未選擇（保留目前模型）"
    $txtImage.Text = "未選擇（保留目前原圖）"
    $comboMaterial.SelectedItem = if ($work.materialMode) { [string]$work.materialMode } else { "auto" }
    $chkPublished.Checked = $work.published -ne $false

    $modelPath = if ($work.model) { $work.model } elseif ($work.legacyBase) { "$($work.legacyBase)/models/model.*" } else { "—" }
    $imagePath = if ($work.image) { $work.image } elseif ($work.legacyBase) { "$($work.legacyBase)/images/original.*" } else { "—" }
    $lblCurrentPaths.Text = "目前模型：$modelPath`r`n目前原圖：$imagePath"
}

function Validate-Editor {
    $id = Safe-Id $txtId.Text
    $title = $txtTitle.Text.Trim()
    if (-not (Test-WorkId $id)) {
        throw "作品代號只能使用英文小寫、數字、底線與連字號，且第一個字元須為英文或數字。"
    }
    if ([string]::IsNullOrWhiteSpace($title)) {
        throw "請輸入作品名稱。"
    }
    return [PSCustomObject]@{ Id = $id; Title = $title }
}

function Save-NewOrUpdate {
    $values = Validate-Editor
    $id = $values.Id
    $title = $values.Title
    $description = $txtDescription.Text.Trim()
    $existing = Get-WorkById $id

    if ($script:SelectedOriginalId -and $script:SelectedOriginalId -ne $id) {
        throw "你修改了作品代號。請使用「重新命名」按鈕，避免舊資料夾與網址失去對應。"
    }

    if (-not $existing -and (-not $script:SelectedModelSource -or -not $script:SelectedImageSource)) {
        throw "新增作品時必須選擇模型與原始圖片。"
    }

    $assets = Copy-SelectedAssets $id $script:SelectedModelSource $script:SelectedImageSource $existing

    if ($existing) {
        Set-Property $existing "title" $title
        Set-Property $existing "description" $description
        if ($assets.Model) { Set-Property $existing "model" $assets.Model }
        if ($assets.Image) { Set-Property $existing "image" $assets.Image }

        if ($script:SelectedModelSource -or $script:SelectedImageSource) {
            Set-Property $existing "page" "works/$id/"
            Set-Property $existing "legacyBase" ""
        }

        Set-Property $existing "materialMode" ([string]$comboMaterial.SelectedItem)
        Set-Property $existing "published" $chkPublished.Checked
        Set-Property $existing "updatedAt" (Get-IsoTime)
        if (-not ($existing.PSObject.Properties.Name -contains "accentColor")) {
            Set-Property $existing "accentColor" "#9d78ff"
        }
        $operation = "更新作品"
    } else {
        $entry = [PSCustomObject][ordered]@{
            id = $id
            title = $title
            description = $description
            page = "works/$id/"
            legacyBase = ""
            model = $assets.Model
            image = $assets.Image
            materialMode = [string]$comboMaterial.SelectedItem
            accentColor = "#9d78ff"
            published = $chkPublished.Checked
            updatedAt = (Get-IsoTime)
        }
        $script:Data.works = @($script:Data.works) + $entry
        $operation = "新增作品"
    }

    $include = @()
    if (Test-Path (Join-Path $script:Root ("works\" + $id))) {
        $include += "works/$id"
    }

    New-IncrementPatch $operation $id $include @() @(
        "works.json 已更新。",
        "若本次只修改名稱／說明而沒有選新檔案，既有模型與原圖不會重傳。"
    ) | Out-Null

    Refresh-WorkList $id
}

function Rename-SelectedWork {
    if (-not $script:SelectedOriginalId) { throw "請先從左側選擇要重新命名的作品。" }

    $values = Validate-Editor
    $oldId = $script:SelectedOriginalId
    $newId = $values.Id
    $title = $values.Title
    $description = $txtDescription.Text.Trim()

    if ($oldId -eq $newId) { throw "新的作品代號和原代號相同。" }
    if (Get-WorkById $newId) { throw "作品代號 $newId 已經存在。" }

    $oldWork = Get-WorkById $oldId
    if (-not $oldWork) { throw "找不到原作品：$oldId" }

    $oldPage = Get-PagePath $oldWork
    $oldLegacyBase = [string]$oldWork.legacyBase
    $oldModelPath = [string]$oldWork.model
    $oldImagePath = [string]$oldWork.image

    $assets = Copy-MigratedAssets $oldId $newId $oldWork $script:SelectedModelSource $script:SelectedImageSource

    Set-Property $oldWork "id" $newId
    Set-Property $oldWork "title" $title
    Set-Property $oldWork "description" $description
    Set-Property $oldWork "page" "works/$newId/"
    Set-Property $oldWork "legacyBase" ""
    Set-Property $oldWork "model" $assets.Model
    Set-Property $oldWork "image" $assets.Image
    Set-Property $oldWork "materialMode" ([string]$comboMaterial.SelectedItem)
    Set-Property $oldWork "published" $chkPublished.Checked
    Set-Property $oldWork "updatedAt" (Get-IsoTime)

    $include = @("works/$newId")
    $deletePaths = @()
    $notes = @("作品代號已由 $oldId 改成 $newId。")

    if ($chkKeepOldUrl.Checked) {
        $oldIndexRelative = $oldPage.TrimEnd('/') + "/index.html"
        $oldIndexLocal = Join-Path $script:Root ($oldIndexRelative -replace '/', '\')
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $oldIndexLocal) | Out-Null

        $levels = ($oldIndexRelative -split '/').Count - 1
        $prefix = "../" * $levels
        $viewerUrl = $prefix + "viewer/?id=" + [System.Uri]::EscapeDataString($newId)
        Write-Utf8NoBom $oldIndexLocal (New-RedirectHtml $viewerUrl $title)
        $include += $oldIndexRelative
        $notes += "舊網址會轉址到新作品。"

        if ($oldLegacyBase) {
            $deletePaths += "$oldLegacyBase/models/"
            $deletePaths += "$oldLegacyBase/images/"
        } else {
            if ($oldModelPath) { $deletePaths += $oldModelPath }
            if ($oldImagePath) { $deletePaths += $oldImagePath }
        }
    } else {
        $deletePaths += $oldPage
        $notes += "舊網址未保留，可刪除舊作品資料夾。"
    }

    New-IncrementPatch "重新命名作品" $newId $include $deletePaths $notes | Out-Null

    Refresh-WorkList $newId
    $script:SelectedOriginalId = $newId
}

function Toggle-Published {
    if (-not $script:SelectedOriginalId) { throw "請先選擇作品。" }
    $work = Get-WorkById $script:SelectedOriginalId
    if (-not $work) { throw "找不到作品。" }

    $newState = -not ($work.published -ne $false)
    Set-Property $work "published" $newState
    Set-Property $work "updatedAt" (Get-IsoTime)

    $label = if ($newState) { "重新上架" } else { "下架隱藏" }
    New-IncrementPatch $label $work.id @() @() @(
        "這次只更新 works.json，不會刪除模型與原圖。",
        "下架後首頁不顯示，但知道直接網址的人仍可能開啟作品。"
    ) | Out-Null

    Refresh-WorkList $work.id
}

function Delete-SelectedWork {
    if (-not $script:SelectedOriginalId) { throw "請先選擇要刪除的作品。" }
    $work = Get-WorkById $script:SelectedOriginalId
    if (-not $work) { throw "找不到作品。" }

    $answer = [System.Windows.Forms.MessageBox]::Show(
        "確定從作品清單刪除「$($work.title)」？`r`n`r`n工具會產生增量 ZIP，並在說明檔列出主機上可手動刪除的路徑。",
        "確認刪除",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return }

    $oldId = [string]$work.id
    $oldPage = Get-PagePath $work
    $deletePaths = @()

    if ($work.legacyBase) {
        $deletePaths += "$($work.legacyBase)/models/"
        $deletePaths += "$($work.legacyBase)/images/"
    } else {
        $deletePaths += $oldPage
    }

    $script:Data.works = @($script:Data.works | Where-Object { $_.id -ne $oldId })

    # 本機 works/id 資料夾先移到封存，不直接永久刪除。
    $localWorkDir = Join-Path $script:Root ("works\" + $oldId)
    if (Test-Path $localWorkDir) {
        $archiveTarget = Join-Path $script:ArchiveDir ($oldId + "_" + (Get-TimeCode))
        Move-Item -LiteralPath $localWorkDir -Destination $archiveTarget -Force
    }

    # 再建立最小轉址頁，確保它會被放入增量 ZIP。
    $oldIndexRelative = $oldPage.TrimEnd('/') + "/index.html"
    $oldIndexLocal = Join-Path $script:Root ($oldIndexRelative -replace '/', '\')
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $oldIndexLocal) | Out-Null

    $pageDepth = ($oldIndexRelative -split '/').Count - 1
    $homeUrl = "../" * $pageDepth
    Write-Utf8NoBom $oldIndexLocal (New-HomepageRedirectHtml ([string]$work.title) $homeUrl)

    New-IncrementPatch "刪除作品" $oldId @($oldIndexRelative) $deletePaths @(
        "作品已從 works.json 移除。",
        "舊網址會先導回首頁。",
        "本機資料若存在，已移至 _archive，而非立即永久刪除。"
    ) | Out-Null

    Clear-Editor
    Refresh-WorkList
}

function Sync-FromWebsite {
    if ([string]::IsNullOrWhiteSpace($script:SiteUrl)) {
        throw "請先在 manager-config.json 設定 siteUrl，例如 https://example.com/。"
    }

    $worksUrl = $script:SiteUrl.TrimEnd("/") + "/works.json"
    $answer = [System.Windows.Forms.MessageBox]::Show(
        "這會以 $worksUrl 覆蓋本機作品清單。`r`n模型與原圖不會下載。確定繼續？",
        "從網站同步作品清單",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )
    if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return }

    $url = $worksUrl + "?t=" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $temp = Join-Path $env:TEMP ("works-" + [Guid]::NewGuid().ToString("N") + ".json")
    Invoke-WebRequest -Uri $url -OutFile $temp -UseBasicParsing
    Get-Content -LiteralPath $temp -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
    Copy-Item -LiteralPath $temp -Destination $script:WorksJsonPath -Force
    Remove-Item $temp -Force
    Load-WorksData
    Refresh-WorkList
    $lblStatus.Text = "已從網站同步 works.json；模型與原圖未下載。"
    $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(70, 120, 180)
}

function Run-Safely([scriptblock]$Action) {
    try {
        & $Action
    } catch {
        [System.Windows.Forms.MessageBox]::Show(
            $_.Exception.Message,
            "操作失敗",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }
}

# ------------------------------------------------------------------
# UI
# ------------------------------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.Text = "Belka 3D 作品管理工具"
$form.StartPosition = "CenterScreen"
$form.Size = New-Object System.Drawing.Size(980, 690)
$form.MinimumSize = New-Object System.Drawing.Size(920, 650)
$form.Font = New-Object System.Drawing.Font("Microsoft JhengHei UI", 9)
$form.BackColor = [System.Drawing.Color]::FromArgb(246, 247, 250)

$lblList = New-Object System.Windows.Forms.Label
$lblList.Text = "作品清單"
$lblList.Location = New-Object System.Drawing.Point(18, 18)
$lblList.AutoSize = $true
$lblList.Font = New-Object System.Drawing.Font("Microsoft JhengHei UI", 11, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($lblList)

$listWorks = New-Object System.Windows.Forms.ListBox
$listWorks.Location = New-Object System.Drawing.Point(18, 48)
$listWorks.Size = New-Object System.Drawing.Size(300, 510)
$listWorks.Anchor = "Top,Bottom,Left"
$form.Controls.Add($listWorks)

$btnSync = New-Object System.Windows.Forms.Button
$btnSync.Text = "從網站同步清單"
$btnSync.Location = New-Object System.Drawing.Point(18, 570)
$btnSync.Size = New-Object System.Drawing.Size(142, 34)
$btnSync.Anchor = "Bottom,Left"
$form.Controls.Add($btnSync)

$btnOpenPatches = New-Object System.Windows.Forms.Button
$btnOpenPatches.Text = "開啟增量更新資料夾"
$btnOpenPatches.Location = New-Object System.Drawing.Point(168, 570)
$btnOpenPatches.Size = New-Object System.Drawing.Size(150, 34)
$btnOpenPatches.Anchor = "Bottom,Left"
$form.Controls.Add($btnOpenPatches)

$panel = New-Object System.Windows.Forms.Panel
$panel.Location = New-Object System.Drawing.Point(338, 18)
$panel.Size = New-Object System.Drawing.Size(610, 586)
$panel.Anchor = "Top,Bottom,Left,Right"
$panel.BackColor = [System.Drawing.Color]::White
$panel.BorderStyle = "FixedSingle"
$form.Controls.Add($panel)

function Add-Label([string]$Text, [int]$X, [int]$Y) {
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Text
    $label.Location = New-Object System.Drawing.Point($X, $Y)
    $label.AutoSize = $true
    $label.BackColor = [System.Drawing.Color]::Transparent
    $label.UseCompatibleTextRendering = $false
    $panel.Controls.Add($label)
    return $label
}

Add-Label "作品代號" 18 20 | Out-Null
$txtId = New-Object System.Windows.Forms.TextBox
$txtId.Location = New-Object System.Drawing.Point(140, 18)
$txtId.Size = New-Object System.Drawing.Size(435, 27)
$txtId.Anchor = "Top,Left,Right"
$panel.Controls.Add($txtId)

Add-Label "作品名稱" 18 60 | Out-Null
$txtTitle = New-Object System.Windows.Forms.TextBox
$txtTitle.Location = New-Object System.Drawing.Point(140, 58)
$txtTitle.Size = New-Object System.Drawing.Size(435, 27)
$txtTitle.Anchor = "Top,Left,Right"
$panel.Controls.Add($txtTitle)

Add-Label "作品說明" 18 100 | Out-Null
$txtDescription = New-Object System.Windows.Forms.TextBox
$txtDescription.Location = New-Object System.Drawing.Point(140, 98)
$txtDescription.Size = New-Object System.Drawing.Size(435, 74)
$txtDescription.Multiline = $true
$txtDescription.ScrollBars = "Vertical"
$txtDescription.Anchor = "Top,Left,Right"
$panel.Controls.Add($txtDescription)

Add-Label "替換模型" 18 190 | Out-Null
$txtModel = New-Object System.Windows.Forms.TextBox
$txtModel.Location = New-Object System.Drawing.Point(140, 188)
$txtModel.Size = New-Object System.Drawing.Size(325, 27)
$txtModel.ReadOnly = $true
$txtModel.Anchor = "Top,Left,Right"
$panel.Controls.Add($txtModel)

$btnModel = New-Object System.Windows.Forms.Button
$btnModel.Text = "選模型"
$btnModel.Location = New-Object System.Drawing.Point(480, 186)
$btnModel.Size = New-Object System.Drawing.Size(95, 31)
$btnModel.Anchor = "Top,Right"
$panel.Controls.Add($btnModel)

Add-Label "替換原圖" 18 230 | Out-Null
$txtImage = New-Object System.Windows.Forms.TextBox
$txtImage.Location = New-Object System.Drawing.Point(140, 228)
$txtImage.Size = New-Object System.Drawing.Size(325, 27)
$txtImage.ReadOnly = $true
$txtImage.Anchor = "Top,Left,Right"
$panel.Controls.Add($txtImage)

$btnImage = New-Object System.Windows.Forms.Button
$btnImage.Text = "選原圖"
$btnImage.Location = New-Object System.Drawing.Point(480, 226)
$btnImage.Size = New-Object System.Drawing.Size(95, 31)
$btnImage.Anchor = "Top,Right"
$panel.Controls.Add($btnImage)

Add-Label "預設材質" 18 275 | Out-Null
$comboMaterial = New-Object System.Windows.Forms.ComboBox
$comboMaterial.Location = New-Object System.Drawing.Point(140, 272)
$comboMaterial.Size = New-Object System.Drawing.Size(155, 28)
$comboMaterial.DropDownStyle = "DropDownList"
[void]$comboMaterial.Items.AddRange(@("auto", "original", "clay", "normal"))
$comboMaterial.SelectedItem = "auto"
$panel.Controls.Add($comboMaterial)

$chkPublished = New-Object System.Windows.Forms.CheckBox
$chkPublished.Text = "在首頁顯示"
$chkPublished.Location = New-Object System.Drawing.Point(310, 273)
$chkPublished.Size = New-Object System.Drawing.Size(120, 28)
$chkPublished.Checked = $true
$panel.Controls.Add($chkPublished)

$chkKeepOldUrl = New-Object System.Windows.Forms.CheckBox
$chkKeepOldUrl.Text = "重新命名時保留舊網址轉址"
$chkKeepOldUrl.Location = New-Object System.Drawing.Point(18, 315)
$chkKeepOldUrl.Size = New-Object System.Drawing.Size(260, 28)
$chkKeepOldUrl.Checked = $true
$panel.Controls.Add($chkKeepOldUrl)

$lblCurrentPaths = New-Object System.Windows.Forms.Label
$lblCurrentPaths.Location = New-Object System.Drawing.Point(18, 350)
$lblCurrentPaths.Size = New-Object System.Drawing.Size(557, 58)
$lblCurrentPaths.ForeColor = [System.Drawing.Color]::FromArgb(90, 95, 105)
$lblCurrentPaths.BorderStyle = "FixedSingle"
$lblCurrentPaths.Padding = New-Object System.Windows.Forms.Padding(7)
$lblCurrentPaths.Anchor = "Top,Left,Right"
$panel.Controls.Add($lblCurrentPaths)

$btnNew = New-Object System.Windows.Forms.Button
$btnNew.Text = "清空／新增"
$btnNew.Location = New-Object System.Drawing.Point(18, 430)
$btnNew.Size = New-Object System.Drawing.Size(125, 38)
$panel.Controls.Add($btnNew)

$btnSave = New-Object System.Windows.Forms.Button
$btnSave.Text = "儲存並產生增量 ZIP"
$btnSave.Location = New-Object System.Drawing.Point(151, 430)
$btnSave.Size = New-Object System.Drawing.Size(190, 38)
$btnSave.BackColor = [System.Drawing.Color]::FromArgb(80, 125, 210)
$btnSave.ForeColor = [System.Drawing.Color]::White
$btnSave.FlatStyle = "Flat"
$panel.Controls.Add($btnSave)

$btnRename = New-Object System.Windows.Forms.Button
$btnRename.Text = "重新命名並產生 ZIP"
$btnRename.Location = New-Object System.Drawing.Point(349, 430)
$btnRename.Size = New-Object System.Drawing.Size(190, 38)
$panel.Controls.Add($btnRename)

$btnToggle = New-Object System.Windows.Forms.Button
$btnToggle.Text = "上架／下架並產生 ZIP"
$btnToggle.Location = New-Object System.Drawing.Point(18, 480)
$btnToggle.Size = New-Object System.Drawing.Size(190, 38)
$panel.Controls.Add($btnToggle)

$btnDelete = New-Object System.Windows.Forms.Button
$btnDelete.Text = "刪除並產生 ZIP"
$btnDelete.Location = New-Object System.Drawing.Point(216, 480)
$btnDelete.Size = New-Object System.Drawing.Size(160, 38)
$btnDelete.BackColor = [System.Drawing.Color]::FromArgb(185, 70, 70)
$btnDelete.ForeColor = [System.Drawing.Color]::White
$btnDelete.FlatStyle = "Flat"
$panel.Controls.Add($btnDelete)

$btnWebsite = New-Object System.Windows.Forms.Button
$btnWebsite.Text = "開啟網站"
$btnWebsite.Location = New-Object System.Drawing.Point(384, 480)
$btnWebsite.Size = New-Object System.Drawing.Size(155, 38)
$panel.Controls.Add($btnWebsite)

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = "每次新增、更新、重新命名、上下架或刪除後，都會自動輸出一包可上傳的增量 ZIP。"
$lblStatus.Location = New-Object System.Drawing.Point(18, 535)
$lblStatus.Size = New-Object System.Drawing.Size(557, 38)
$lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(80, 85, 95)
$lblStatus.Anchor = "Left,Right,Bottom"
$panel.Controls.Add($lblStatus)

$listWorks.Add_SelectedIndexChanged({ Load-SelectedWork })
$btnNew.Add_Click({ Clear-Editor })
$btnModel.Add_Click({
    $selected = Select-ModelFile
    if ($selected) {
        $script:SelectedModelSource = $selected
        $txtModel.Text = $selected
    }
})
$btnImage.Add_Click({
    $selected = Select-ImageFile
    if ($selected) {
        $script:SelectedImageSource = $selected
        $txtImage.Text = $selected
    }
})
$btnSave.Add_Click({ Run-Safely { Save-NewOrUpdate } })
$btnRename.Add_Click({ Run-Safely { Rename-SelectedWork } })
$btnToggle.Add_Click({ Run-Safely { Toggle-Published } })
$btnDelete.Add_Click({ Run-Safely { Delete-SelectedWork } })
$btnSync.Add_Click({ Run-Safely { Sync-FromWebsite } })
$btnOpenPatches.Add_Click({ Start-Process explorer.exe $script:PatchesDir })
$btnWebsite.Add_Click({
    Run-Safely {
        if ([string]::IsNullOrWhiteSpace($script:SiteUrl)) {
            throw "請先在 manager-config.json 設定 siteUrl。"
        }
        Start-Process $script:SiteUrl
    }
})

Load-WorksData
Refresh-WorkList
Clear-Editor

[System.Windows.Forms.Application]::Run($form)
