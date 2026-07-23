[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $root "runtime"
$pidPath = Join-Path $runtimeDirectory "cloudflared.pid"
$startedAtPath = Join-Path $runtimeDirectory "cloudflared.started-at.txt"
$urlPath = Join-Path $runtimeDirectory "cloudflared-public-url.txt"
if (-not (Test-Path $pidPath)) {
  Write-Host "No ROS Quick Tunnel PID file exists. Nothing was stopped."
  return
}

$processId = Get-Content -LiteralPath $pidPath -ErrorAction Stop
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($process -and $process.ProcessName -eq "cloudflared") {
  $expectedStart = Get-Content -LiteralPath $startedAtPath -ErrorAction SilentlyContinue
  $actualStart = $process.StartTime.ToUniversalTime().ToString("o")
  if (-not $expectedStart) {
    Write-Warning "PID $processId has no ROS Quick Tunnel start marker. It was not stopped."
  } elseif ($expectedStart -ne $actualStart) {
    Write-Warning "PID $processId no longer matches the ROS Quick Tunnel start marker. It was not stopped."
  } else {
    Stop-Process -Id $processId -ErrorAction Stop
    Start-Sleep -Milliseconds 500
    if (Get-Process -Id $processId -ErrorAction SilentlyContinue) { Stop-Process -Id $processId -Force }
    Write-Host "Stopped ROS Quick Tunnel PID $processId."
  }
} elseif ($process) {
  Write-Warning "PID $processId is not cloudflared. It was not stopped."
}
Remove-Item -LiteralPath $pidPath,$startedAtPath,$urlPath -Force -ErrorAction SilentlyContinue
