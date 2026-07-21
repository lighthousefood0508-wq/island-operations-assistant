[CmdletBinding()]
param(
  [string]$RosUrl = "http://127.0.0.1:3090",
  [string]$ReportPath = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$configTemplate = Join-Path $root "config\cloudflared\config.example.yml"

function Get-CloudflaredPath {
  $command = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidates = @(
    "$env:ProgramFiles\cloudflared\cloudflared.exe",
    "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe"
  )
  return $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Get-Status([string]$Name, [bool]$Ready, [string]$Detail) {
  [pscustomobject]@{ Check = $Name; Status = $(if ($Ready) { "Ready" } else { "Not Ready" }); Detail = $Detail }
}

$cloudflared = Get-CloudflaredPath
$checks = [System.Collections.Generic.List[object]]::new()
if ($cloudflared) {
  $version = (& $cloudflared --version 2>&1 | Select-Object -First 1).ToString().Trim()
  $checks.Add((Get-Status "cloudflared" $true "$version ($cloudflared)"))
} else {
  $checks.Add((Get-Status "cloudflared" $false "Not installed. Run the official Cloudflare installer, then rerun this script."))
}

try {
  $health = Invoke-RestMethod -Uri "$($RosUrl.TrimEnd('/'))/health" -TimeoutSec 5
  $checks.Add((Get-Status "ROS Server" ($health.data.status -eq "ok") "status=$($health.data.status)"))
  $checks.Add((Get-Status "SQLite" ($health.data.database -eq "ready") "database=$($health.data.database)"))
} catch {
  $checks.Add((Get-Status "ROS Server" $false "Cannot reach $RosUrl/health"))
  $checks.Add((Get-Status "SQLite" $false "ROS health is unavailable"))
}

$port = ([uri]$RosUrl).Port
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$checks.Add((Get-Status "ROS Port $port" ($null -ne $listener) $(if ($listener) { "Listening on $($listener.LocalAddress)" } else { "No listening ROS process" })))

$profiles = Get-NetFirewallProfile -ErrorAction SilentlyContinue
$outboundAllowed = -not ($profiles | Where-Object { $_.Enabled -and $_.DefaultOutboundAction -eq "Block" })
$checks.Add((Get-Status "Firewall" $outboundAllowed $(if ($outboundAllowed) { "Outbound HTTPS is permitted; Cloudflare Tunnel needs no inbound port forwarding." } else { "An enabled profile blocks outbound traffic." })))

$service = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
$checks.Add((Get-Status "Cloudflared Service" ($service -and $service.Status -eq "Running") $(if ($service) { "status=$($service.Status)" } else { "Not installed or not running. Expected before Owner authorization." })))
$checks.Add((Get-Status "Config Template" (Test-Path $configTemplate) $configTemplate))
$checks.Add((Get-Status "Owner Authorization" (-not [string]::IsNullOrWhiteSpace($env:ROS_CLOUDFLARE_TUNNEL_TOKEN)) $(if ($env:ROS_CLOUDFLARE_TUNNEL_TOKEN) { "Token available only in this process environment." } else { "Awaiting Owner login and tunnel authorization." })))

$checks | Format-Table -AutoSize
if ($ReportPath) {
  $target = [System.IO.Path]::GetFullPath($ReportPath)
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  $checks | ConvertTo-Json | Set-Content -LiteralPath $target -Encoding UTF8
  Write-Host "Readiness report written to $target"
}

if ($checks.Status -contains "Not Ready") { exit 2 }
