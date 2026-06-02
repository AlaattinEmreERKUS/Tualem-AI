$venv = "$PSScriptRoot\.venv\Scripts\python.exe"
$root = $PSScriptRoot

Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$venv' '$root\modules\user_module\manage.py' runserver 8001"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$venv' '$root\modules\graph_module\manage.py' runserver 8002"

Write-Host "user_module  -> http://localhost:8001"
Write-Host "graph_module -> http://localhost:8002"

$nginx = $null

$candidate = (Get-Command nginx -ErrorAction SilentlyContinue)
if ($candidate) { $nginx = $candidate.Source }

if (-not $nginx) {
    $commonPaths = @(
        "C:\nginx\nginx.exe",
        "C:\Program Files\nginx\nginx.exe",
        "C:\Program Files (x86)\nginx\nginx.exe",
        "C:\tools\nginx\nginx.exe"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path $p) { $nginx = $p; break }
    }
}

if ($nginx) {
    $nginxDir = Split-Path $nginx -Parent
    $conf = "$root\nginx\nginx.conf"
    Start-Process $nginx -ArgumentList "-p", $nginxDir, "-c", $conf -WorkingDirectory $nginxDir
    Write-Host "Nginx        -> http://localhost:80  (prefix: $nginxDir)"
} else {
    Write-Host ""
    Write-Host "[UYARI] Nginx bulunamadi. Kurmak icin: https://nginx.org/en/download.html"
    Write-Host "        Kurduktan sonra nginx.exe dizinini PATH'e ekle veya C:\nginx\ altina kur."
}
