@PowerShell -ExecutionPolicy Bypass -Command Invoke-Expression $('$args=@(^&{$args} %*);'+[String]::Join(';',(Get-Content '%~f0') -notmatch '^^@PowerShell.*EOF$')) & goto :EOF

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repo = "iamcco/markdown-preview.nvim"
$file = "markdown-preview-win.zip"
$mermaidDir = "_static"
$mermaidTarget = Join-Path $mermaidDir "mermaid.min.js"
$mermaidVersionFile = Join-Path $mermaidDir "mermaid.version.json"

$releases = "https://api.github.com/repos/$repo/releases"
$mermaidPackage = "https://cdn.jsdelivr.net/npm/mermaid/package.json"

function Install-Mermaid {
  Write-Host Fetching latest Mermaid from jsDelivr
  try {
    $mermaidInfo = (Invoke-WebRequest $mermaidPackage | Select-Object -ExpandProperty Content | ConvertFrom-Json)
    $mermaidVersion = $mermaidInfo.version
    $download = "https://cdn.jsdelivr.net/npm/mermaid@$mermaidVersion/dist/mermaid.min.js"
    $tmp = [System.IO.Path]::GetTempFileName()
    Invoke-WebRequest $download -OutFile $tmp
    New-Item -Path $mermaidDir -ItemType Directory -Force | Out-Null
    Move-Item $tmp $mermaidTarget -Force
    Set-Content -Path $mermaidVersionFile -Value "{`n  `"version`": `"$mermaidVersion`",`n  `"url`": `"$download`"`n}" -Encoding UTF8
    Write-Host Updated Mermaid to $mermaidVersion
  } catch {
    Write-Warning "Could not download Mermaid from jsDelivr. Keeping bundled Mermaid."
  }
}

if ($args[0] -eq "--mermaid-only") {
  Install-Mermaid
  Write-Host markdown-preview install completed.
  exit 0
}

Write-Host Determining latest release
if ($args[0]) { $tag = $args[0] } else { $tag = (Invoke-WebRequest $releases | ConvertFrom-Json)[0].tag_name }

$download = "https://github.com/$repo/releases/download/$tag/$file"
$name = $file.Split(".")[0]
$zip = "$name-$tag.zip"
$dir = "bin"

new-item -Name $dir -ItemType directory -Force

Write-Host Dowloading latest release
Invoke-WebRequest $download -Out $zip

Remove-Item $dir\* -Recurse -Force -ErrorAction SilentlyContinue

Write-Host Extracting release files
Expand-Archive $zip -DestinationPath $dir -Force

Remove-Item $zip -Force
Install-Mermaid
Write-Host markdown-preview install completed.
