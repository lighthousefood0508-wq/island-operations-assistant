# Cloudflare Tunnel Deployment Preparation

Approval Record: DECISIONS #017

## Scope and safety

This is a temporary ROS Shadow Run deployment path. Legacy remains independent and must not be stopped, restarted, routed through Cloudflare, or changed. Cloudflare Tunnel makes an outbound connection from this Windows host; do not create router port forwarding.

No credential belongs in Git. The ignored local files are the real Cloudflare config, credentials, token environment variable, logs, and runtime PID file.

## What is ready

- `cloudflared` is installed on the Windows host.
- `config/cloudflared/config.example.yml` is a non-secret named-tunnel template.
- `scripts/prepare-cloudflare.ps1` prints a readiness report without logging in.
- `scripts/start-cloudflare.ps1` starts only ROS's tunnel, only when `ROS_CLOUDFLARE_TUNNEL_TOKEN` is available and `/health` reports central SQLite ready.
- `scripts/stop-cloudflare.ps1` stops only the PID started by the ROS script.
- `scripts/windows/cloudflared-service.template.ps1` is a blocked-by-default service-install template. It creates no service without Owner authorization.

## Owner-only actions

Only these two actions remain:

1. Log in to the Owner's Cloudflare account from a phone or desktop browser.
2. In Cloudflare Zero Trust, authorize a dedicated named Tunnel for ROS Shadow Run, assign its public hostname and copy its connector token securely to the Windows host.

Do not reuse the Legacy ngrok URL, Legacy port, credentials, or configuration. Configure the ROS hostname to point only to `http://127.0.0.1:3090`.

## No-Zone Quick Tunnel

When the Cloudflare account has no Zone, use a Quick Tunnel for external Shadow Run testing. It does not require login, DNS, Zero Trust, or a custom domain. Start ROS on port 3092, then run:

```powershell
.\scripts\start-quick-tunnel.ps1
```

The script prints one temporary `https://*.trycloudflare.com` URL. Test `/health`, `/pos`, `/kitchen`, and `/pos/statistics` beneath that URL. The address is public, changes after restart, has no uptime guarantee, and is not suitable for production. Stop it with `./scripts/stop-quick-tunnel.ps1`.

## Windows preparation and health

From the ROS repository root:

```powershell
.\scripts\prepare-cloudflare.ps1 -RosUrl http://127.0.0.1:3090
```

The report checks cloudflared, its version, ROS `/health`, central SQLite readiness, listener port, outbound firewall policy, service state, config template, and Owner authorization. Before authorization, the service and authorization rows are correctly `Not Ready`.

## Install from the deployment package

The repository uses `pnpm-lock.yaml`, not `package-lock.json`; its reproducible clean install command is therefore:

```powershell
pnpm install --frozen-lockfile
pnpm run verify:full
```

`npm ci` is intentionally not applicable until this repository adopts and commits a `package-lock.json`.

## Start after authorization

Set the token only for the current PowerShell window. Do not save it in a tracked file.

```powershell
$env:ROS_CLOUDFLARE_TUNNEL_TOKEN = "<Owner-provided-token>"
.\scripts\start-cloudflare.ps1
```

After Cloudflare reports the tunnel healthy, test the public hostname with `/health`, `/pos`, `/kitchen`, and `/pos/statistics`. The application uses same-origin `/api/...` and `/events`, so no frontend URL changes are needed.

## Windows service template

Do not install a Windows service for the 7/26 Shadow Run unless the Owner separately approves it. The template is intentionally inert until a process environment contains the Owner's token. It does not create a service by itself.

## Rollback

1. Run `./scripts/stop-cloudflare.ps1`.
2. Confirm the public ROS hostname is no longer reachable.
3. Continue operating Legacy only. Do not repair ROS during service.

Stopping ROS's Cloudflare process does not stop ROS, SQLite, ngrok, Docker, n8n, or Legacy.

## Shadow Run reminder

ROS remains a secondary validation system on 7/26. If ROS or the tunnel fails, stop entering ROS data and continue in Legacy. Record the time, device, order number, and screenshot for later review.
