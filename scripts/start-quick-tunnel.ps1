[CmdletBinding()]
param(
  [string]$RosUrl = "http://127.0.0.1:3092"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $root "logs\quick-tunnel"
$pidPath = Join-Path $runtimeDirectory "cloudflared.pid"
$urlPath = Join-Path $runtimeDirectory "public-url.txt"
$stdout = Join-Path $runtimeDirectory "cloudflared.out.log"
$stderr = Join-Path $runtimeDirectory "cloudflared.err.log"

function Get-CloudflaredPath {
  $command = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidates = @("$env:ProgramFiles\cloudflared\cloudflared.exe", "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe")
  return $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

try {
  $health = Invoke-RestMethod -Uri "$($RosUrl.TrimEnd('/'))/health" -TimeoutSec 5
  if ($health.data.status -ne "ok" -or $health.data.database -ne "ready") { throw "ROS health did not report central SQLite ready." }
} catch { throw "ROS must be healthy before starting Quick Tunnel: $($_.Exception.Message)" }

if (Test-Path $pidPath) {
  $existingPid = Get-Content -LiteralPath $pidPath -ErrorAction SilentlyContinue
  if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
    $existingUrl = Get-Content -LiteralPath $urlPath -ErrorAction SilentlyContinue
    Write-Host "ROS Quick Tunnel is already running: $existingUrl"
    exit 0
  }
}

$cloudflared = Get-CloudflaredPath
if (-not $cloudflared) { throw "cloudflared is not installed. Run scripts\prepare-cloudflare.ps1 first." }
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
Remove-Item -LiteralPath $stdout,$stderr,$urlPath -Force -ErrorAction SilentlyContinue
$process = Start-Process -FilePath $cloudflared -ArgumentList @("tunnel", "--url", $RosUrl, "--no-autoupdate") -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$process.Id | Set-Content -LiteralPath $pidPath -Encoding ASCII

for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Seconds 1
  $match = Select-String -LiteralPath $stdout -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -AllMatches -ErrorAction SilentlyContinue | Select-Object -Last 1
  if ($match) {
    $url = $match.Matches.Value
    $url | Set-Content -LiteralPath $urlPath -Encoding ASCII
    Write-Host "ROS Quick Tunnel is ready: $url"
    exit 0
  }
  if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) { throw "cloudflared stopped before it created a Quick Tunnel. See $stderr" }
}

throw "Timed out waiting for a Quick Tunnel URL. See $stdout and $stderr"
