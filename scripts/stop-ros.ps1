[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $root "runtime"
$serverPidPath = Join-Path $runtimeDirectory "ros-server.pid"
$serverStartedAtPath = Join-Path $runtimeDirectory "ros-server.started-at.txt"
$linksPath = Join-Path $runtimeDirectory "ROS_CURRENT_LINKS.txt"
$quickTunnelStopScript = Join-Path $PSScriptRoot "stop-quick-tunnel.ps1"

function Stop-ManagedRosServer {
  if (-not (Test-Path -LiteralPath $serverPidPath)) {
    Write-Host "No ROS server PID file exists. Nothing was stopped."
    return
  }
  $pidValue = Get-Content -LiteralPath $serverPidPath -ErrorAction Stop
  $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if (-not $process) {
    Remove-Item -LiteralPath $serverPidPath,$serverStartedAtPath -Force -ErrorAction SilentlyContinue
    Write-Host "Removed stale ROS server PID file."
    return
  }
  if ($process.ProcessName -ne "node") {
    Write-Warning "PID $pidValue is not node. It was not stopped."
    return
  }
  $expectedStart = Get-Content -LiteralPath $serverStartedAtPath -ErrorAction SilentlyContinue
  if (-not $expectedStart) {
    Write-Warning "PID $pidValue has no ROS start marker. It was not stopped."
    return
  }
  if ($expectedStart -ne $process.StartTime.ToUniversalTime().ToString("o")) {
    Write-Warning "PID $pidValue no longer matches the ROS start marker. It was not stopped."
    return
  }
  Stop-Process -Id $pidValue -ErrorAction Stop
  Start-Sleep -Milliseconds 500
  if (Get-Process -Id $pidValue -ErrorAction SilentlyContinue) { Stop-Process -Id $pidValue -Force }
  Remove-Item -LiteralPath $serverPidPath,$serverStartedAtPath -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped ROS server PID $pidValue."
}

if (Test-Path -LiteralPath $quickTunnelStopScript) { & $quickTunnelStopScript }
Stop-ManagedRosServer

if (Test-Path -LiteralPath $linksPath) {
  $existing = Get-Content -LiteralPath $linksPath -Raw
  "Status: STOPPED - URLs below may no longer work.`r`nUpdatedAt: $([DateTime]::UtcNow.ToString('o'))`r`n`r`n$existing" | Set-Content -LiteralPath $linksPath -Encoding UTF8
}
