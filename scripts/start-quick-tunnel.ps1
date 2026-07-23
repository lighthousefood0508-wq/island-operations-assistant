[CmdletBinding()]
param(
  [string]$RosUrl = "http://127.0.0.1:3092"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $root "runtime"
$logsDirectory = Join-Path $root "logs"
$pidPath = Join-Path $runtimeDirectory "cloudflared.pid"
$startedAtPath = Join-Path $runtimeDirectory "cloudflared.started-at.txt"
$urlPath = Join-Path $runtimeDirectory "cloudflared-public-url.txt"
$stdout = Join-Path $logsDirectory "cloudflared.log"
$stderr = Join-Path $logsDirectory "cloudflared.err.log"

function Get-CloudflaredPath {
  $command = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidates = @("$env:ProgramFiles\cloudflared\cloudflared.exe", "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe")
  return $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Find-QuickTunnelUrl {
  $matches = @(
    Select-String -LiteralPath $stdout,$stderr -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -AllMatches -ErrorAction SilentlyContinue
  )
  $match = $matches | Select-Object -Last 1
  if ($match) { return $match.Matches.Value }
  return $null
}

try {
  $health = Invoke-RestMethod -Uri "$($RosUrl.TrimEnd('/'))/health" -TimeoutSec 5
  if ($health.data.status -ne "ok" -or $health.data.database -ne "ready") { throw "ROS health did not report central SQLite ready." }
} catch { throw "ROS must be healthy before starting Quick Tunnel: $($_.Exception.Message)" }

if (Test-Path $pidPath) {
  $existingPid = Get-Content -LiteralPath $pidPath -ErrorAction SilentlyContinue
  $existing = if ($existingPid) { Get-Process -Id $existingPid -ErrorAction SilentlyContinue }
  if ($existing -and $existing.ProcessName -eq "cloudflared") {
    $existingUrl = Get-Content -LiteralPath $urlPath -ErrorAction SilentlyContinue
    if ($existingUrl) {
      Write-Host "ROS Quick Tunnel is already running: $existingUrl"
      return $existingUrl
    }
    $existingUrl = Find-QuickTunnelUrl
    if ($existingUrl) {
      $existingUrl | Set-Content -LiteralPath $urlPath -Encoding ASCII
      Write-Host "Recovered ROS Quick Tunnel URL: $existingUrl"
      return $existingUrl
    }
    throw "A ROS-owned cloudflared process is running, but its public URL is unavailable. See $stdout"
  }
  Remove-Item -LiteralPath $pidPath,$startedAtPath,$urlPath -Force -ErrorAction SilentlyContinue
}

$cloudflared = Get-CloudflaredPath
if (-not $cloudflared) { throw "cloudflared is not installed. Run scripts\prepare-cloudflare.ps1 first." }
New-Item -ItemType Directory -Force -Path $runtimeDirectory,$logsDirectory | Out-Null
Remove-Item -LiteralPath $stdout,$stderr,$urlPath -Force -ErrorAction SilentlyContinue
$process = Start-Process -FilePath $cloudflared -ArgumentList @("tunnel", "--url", $RosUrl, "--no-autoupdate") -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$process.Id | Set-Content -LiteralPath $pidPath -Encoding ASCII
$process.StartTime.ToUniversalTime().ToString("o") | Set-Content -LiteralPath $startedAtPath -Encoding ASCII

for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Seconds 1
  $url = Find-QuickTunnelUrl
  if ($url) {
    $url | Set-Content -LiteralPath $urlPath -Encoding ASCII
    Write-Host "ROS Quick Tunnel is ready: $url"
    return $url
  }
  if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
    Remove-Item -LiteralPath $pidPath,$startedAtPath -Force -ErrorAction SilentlyContinue
    throw "cloudflared stopped before it created a Quick Tunnel. See $stderr"
  }
}

throw "Timed out waiting for a Quick Tunnel URL. See $stdout and $stderr"
