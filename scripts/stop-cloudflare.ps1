[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $root "logs\cloudflared\ros-cloudflared.pid"
if (-not (Test-Path $pidPath)) {
  Write-Host "No ROS Cloudflare Tunnel PID file exists. Nothing was stopped."
  exit 0
}

$processId = Get-Content -LiteralPath $pidPath -ErrorAction Stop
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $processId
  Write-Host "Stopped ROS Cloudflare Tunnel PID $processId."
} else {
  Write-Host "ROS Cloudflare Tunnel PID $processId is not running."
}
Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
