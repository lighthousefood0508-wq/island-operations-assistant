# Template only. Do not run until the Owner has completed Cloudflare login and Tunnel authorization.
# This template intentionally refuses to install a service without an environment-only tunnel token.

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($env:ROS_CLOUDFLARE_TUNNEL_TOKEN)) {
  throw "No ROS_CLOUDFLARE_TUNNEL_TOKEN is present. Service installation is blocked; no service was created."
}

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$cloudflared = (Get-Command cloudflared -ErrorAction Stop).Source
Write-Host "Template validated. Review the generated service command before any installation:"
Write-Host "`"$cloudflared`" tunnel run --token <ROS_CLOUDFLARE_TUNNEL_TOKEN>"
Write-Host "No Windows service was installed by this template."
