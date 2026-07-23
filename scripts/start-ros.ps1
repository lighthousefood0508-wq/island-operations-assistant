[CmdletBinding()]
param(
  [int]$Port = 3092,
  [switch]$SkipClipboard
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $root "runtime"
$logsDirectory = Join-Path $root "logs"
$serverPidPath = Join-Path $runtimeDirectory "ros-server.pid"
$serverStartedAtPath = Join-Path $runtimeDirectory "ros-server.started-at.txt"
$linksPath = Join-Path $runtimeDirectory "ROS_CURRENT_LINKS.txt"
$serverLog = Join-Path $logsDirectory "ros-startup.log"
$serverErrorLog = Join-Path $logsDirectory "ros-startup.err.log"
$buildLog = Join-Path $logsDirectory "ros-build.log"
$quickTunnelScript = Join-Path $PSScriptRoot "start-quick-tunnel.ps1"
$healthUrl = "http://127.0.0.1:$Port/health"

function Get-NodePath {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidates = @(
    "$env:ProgramFiles\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
  )
  return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

function Get-NpmPath([string]$nodePath) {
  $command = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidate = Join-Path (Split-Path -Parent $nodePath) "npm.cmd"
  if (Test-Path -LiteralPath $candidate) { return $candidate }
  return $null
}

function Normalize-ChildProcessPath {
  # Codex can inherit both PATH and Path. Keep one process-local entry so
  # Start-Process can create ROS children without changing Windows settings.
  $variables = [Environment]::GetEnvironmentVariables("Process")
  $canonicalPath = [string]$variables["Path"]
  if (-not $canonicalPath) { $canonicalPath = [string]$variables["PATH"] }
  if ($canonicalPath) {
    [Environment]::SetEnvironmentVariable("PATH", $null, "Process")
    [Environment]::SetEnvironmentVariable("Path", $canonicalPath, "Process")
  }
}

function Test-RosHealth {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
    return $health.data.status -eq "ok" -and $health.data.database -eq "ready"
  } catch {
    return $false
  }
}

function Test-TcpPort([int]$tcpPort) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync("127.0.0.1", $tcpPort)
    if (-not $task.Wait(500)) { return $false }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Get-ManagedRosProcess {
  if (-not (Test-Path -LiteralPath $serverPidPath)) { return $null }
  $pidValue = Get-Content -LiteralPath $serverPidPath -ErrorAction SilentlyContinue
  $process = if ($pidValue) { Get-Process -Id $pidValue -ErrorAction SilentlyContinue }
  if (-not $process) {
    Remove-Item -LiteralPath $serverPidPath,$serverStartedAtPath -Force -ErrorAction SilentlyContinue
    return $null
  }
  if ($process.ProcessName -ne "node") { throw "ROS PID $pidValue is no longer a node process. It will not be touched." }
  $expectedStart = Get-Content -LiteralPath $serverStartedAtPath -ErrorAction SilentlyContinue
  if (-not $expectedStart) { throw "ROS PID $pidValue has no ROS start marker. It will not be touched." }
  if ($expectedStart -ne $process.StartTime.ToUniversalTime().ToString("o")) {
    throw "ROS PID $pidValue no longer matches the ROS start marker. It will not be touched."
  }
  return $process
}

function Write-Links([string]$baseUrl) {
  $lines = @(
    "Status: RUNNING",
    "GeneratedAt: $([DateTime]::UtcNow.ToString('o'))",
    "Health: $healthUrl",
    "Base URL: $baseUrl",
    "",
    "Back Office - Events: $baseUrl/admin",
    "Catalog: $baseUrl/admin/catalog",
    "Statistics: $baseUrl/admin/statistics",
    "System Health: $baseUrl/admin/health",
    "POS: $baseUrl/pos",
    "Kitchen: $baseUrl/kitchen"
  )
  $lines | Set-Content -LiteralPath $linksPath -Encoding UTF8
}

New-Item -ItemType Directory -Force -Path $runtimeDirectory,$logsDirectory | Out-Null
$node = Get-NodePath
if (-not $node) { throw "Node.js was not found. Install a supported Windows Node.js runtime before starting ROS." }
$npm = Get-NpmPath $node
if (-not $npm) { throw "npm.cmd was not found next to the resolved Node.js runtime: $node" }
if (-not (Test-Path -LiteralPath $quickTunnelScript)) { throw "Missing canonical Quick Tunnel script: $quickTunnelScript" }
Normalize-ChildProcessPath

$serverWasStarted = $false
if (Test-RosHealth) {
  Write-Host "ROS Health is already passing at $healthUrl. No second ROS server will be started."
} else {
  $managed = Get-ManagedRosProcess
  if ($managed) { throw "ROS process PID $($managed.Id) is still running but health is failing. It was not duplicated or stopped." }
  if (Test-TcpPort $Port) { throw "Port $Port is already in use, but it is not a healthy ROS server. It was not touched." }

  Remove-Item -LiteralPath $serverLog,$serverErrorLog,$buildLog -Force -ErrorAction SilentlyContinue
  $tsc = Join-Path $root "node_modules\typescript\bin\tsc"
  if (-not (Test-Path -LiteralPath $tsc)) { throw "TypeScript is not installed. Run npm install before starting ROS." }
  & $node $tsc "-p" "tsconfig.json" *>> $buildLog
  if ($LASTEXITCODE -ne 0) { throw "ROS build failed. See $buildLog" }

  $env:ROS_HOST = "127.0.0.1"
  $env:ROS_PORT = "$Port"
  $server = Start-Process -FilePath $node -ArgumentList @("dist/server/index.js") -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $serverLog -RedirectStandardError $serverErrorLog
  $server.Id | Set-Content -LiteralPath $serverPidPath -Encoding ASCII
  $server.StartTime.ToUniversalTime().ToString("o") | Set-Content -LiteralPath $serverStartedAtPath -Encoding ASCII
  $serverWasStarted = $true

  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-RosHealth) { break }
    if (-not (Get-Process -Id $server.Id -ErrorAction SilentlyContinue)) { break }
  }
  if (-not (Test-RosHealth)) {
    if (Get-Process -Id $server.Id -ErrorAction SilentlyContinue) { Stop-Process -Id $server.Id -Force }
    Remove-Item -LiteralPath $serverPidPath,$serverStartedAtPath -Force -ErrorAction SilentlyContinue
    throw "ROS did not become healthy. See $serverLog and $serverErrorLog"
  }
}

try {
  & $quickTunnelScript -RosUrl "http://127.0.0.1:$Port" | Out-Null
  $urlPath = Join-Path $runtimeDirectory "cloudflared-public-url.txt"
  $baseUrl = Get-Content -LiteralPath $urlPath -Raw -ErrorAction Stop
  $baseUrl = $baseUrl.Trim()
  if ($baseUrl -notmatch '^https://[a-z0-9-]+\.trycloudflare\.com$') { throw "Quick Tunnel did not provide a valid trycloudflare.com URL." }
  Write-Links $baseUrl
  if (-not $SkipClipboard) {
    try { Set-Clipboard -Value (Get-Content -LiteralPath $linksPath -Raw) } catch { Write-Verbose "Clipboard was unavailable: $($_.Exception.Message)" }
  }
  Write-Host "ROS Running"
  Write-Host "Health PASS: $healthUrl"
  Write-Host "Tunnel Running: $baseUrl"
  Write-Host "Links: $linksPath"
} catch {
  if ($serverWasStarted) { Write-Warning "ROS is healthy locally, but the Quick Tunnel step failed: $($_.Exception.Message)" }
  throw
}
