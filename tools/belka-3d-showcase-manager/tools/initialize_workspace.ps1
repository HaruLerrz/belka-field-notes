param(
    [switch]$SkipManagerConfig
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Copy-TemplateIfMissing(
    [string]$TargetName,
    [string]$TemplateName,
    [string]$FallbackJson
) {
    $target = Join-Path $root $TargetName
    if (Test-Path -LiteralPath $target) { return }

    $template = Join-Path $root $TemplateName
    if (Test-Path -LiteralPath $template) {
        Copy-Item -LiteralPath $template -Destination $target -Force
        return
    }

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($target, $FallbackJson, $encoding)
}

if (-not $SkipManagerConfig) {
    Copy-TemplateIfMissing `
        "manager-config.json" `
        "manager-config.example.json" `
        "{`n  `"siteUrl`": `"`",`n  `"serverRootHint`": `"/path/to/public_html/`"`n}`n"
}

Copy-TemplateIfMissing `
    "works.json" `
    "works.example.json" `
    "{`n  `"site`": {`n    `"title`": `"3D Model Showcase`",`n    `"subtitle`": `"選擇作品，進入獨立的互動式 3D 展示頁。`",`n    `"footer`": `"首頁只載入作品縮圖；進入作品頁後才會下載該模型。`",`n    `"defaultBackgroundColor`": `"#0d1017`",`n    `"defaultClayColor`": `"#8793a6`",`n    `"defaultEdgeColor`": `"#111318`",`n    `"defaultEdgeThreshold`": 32,`n    `"defaultOutlineThickness`": 0.018,`n    `"defaultOutlineOpacity`": 0.86,`n    `"maxFeatureEdgeTriangles`": 1200000`n  },`n  `"works`": []`n}`n"

New-Item -ItemType Directory -Force -Path (Join-Path $root "works") | Out-Null
