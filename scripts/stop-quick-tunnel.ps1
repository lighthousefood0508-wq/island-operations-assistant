[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $root "logs\quick-tunnel"
$pidPath = Join-Path $runtimeDirectory "cloudflared.pid"
if (-not (Test-Path $pidPath)) {
  Write-Host "No ROS Quick Tunnel PID file exists. Nothing was stopped."
  exit 0
}

$processId = Get-Content -LiteralPath $pidPath -ErrorAction Stop
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $processId
  Write-Host "Stopped ROS Quick Tunnel PID $processId."
}
Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
