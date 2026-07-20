[CmdletBinding()]
param(
  [string]$RosUrl = "http://127.0.0.1:3090"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $root "logs\cloudflared"
$pidPath = Join-Path $runtimeDirectory "ros-cloudflared.pid"

function Get-CloudflaredPath {
  $command = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidates = @("$env:ProgramFiles\cloudflared\cloudflared.exe", "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe")
  return $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if ([string]::IsNullOrWhiteSpace($env:ROS_CLOUDFLARE_TUNNEL_TOKEN)) {
  throw "ROS_CLOUDFLARE_TUNNEL_TOKEN is not available. The Owner must log in and authorize the ROS Tunnel before this script can start anything."
}
$cloudflared = Get-CloudflaredPath
if (-not $cloudflared) { throw "cloudflared is not installed. Run scripts\prepare-cloudflare.ps1 first." }
try {
  $health = Invoke-RestMethod -Uri "$($RosUrl.TrimEnd('/'))/health" -TimeoutSec 5
  if ($health.data.status -ne "ok" -or $health.data.database -ne "ready") { throw "ROS health did not report central SQLite ready." }
} catch { throw "ROS must be healthy before starting Cloudflare Tunnel: $($_.Exception.Message)" }

if (Test-Path $pidPath) {
  $existingPid = Get-Content -LiteralPath $pidPath -ErrorAction SilentlyContinue
  if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
    Write-Host "ROS Cloudflare Tunnel is already running with PID $existingPid."
    exit 0
  }
  Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
$stdout = Join-Path $runtimeDirectory "cloudflared.out.log"
$stderr = Join-Path $runtimeDirectory "cloudflared.err.log"
$process = Start-Process -FilePath $cloudflared -ArgumentList @("tunnel", "run", "--token", $env:ROS_CLOUDFLARE_TUNNEL_TOKEN) -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$process.Id | Set-Content -LiteralPath $pidPath -Encoding ASCII
Write-Host "ROS Cloudflare Tunnel started in the background. PID: $($process.Id)"
Write-Host "Use scripts\stop-cloudflare.ps1 to stop only this ROS Tunnel."
