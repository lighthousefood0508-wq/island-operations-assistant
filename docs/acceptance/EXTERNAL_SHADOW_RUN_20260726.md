# External Shadow Run: 2026-07-26

This is a temporary, protected test path. Legacy remains the formal system. Do not use this URL for customer ordering, payment, or normal production.

## Current tunnel prerequisite

The current ngrok account already has a Legacy endpoint running. Do not use pooling and do not replace it from this procedure: that would mix or interrupt Legacy traffic. Before this checklist can be used externally, Architecture Owner must allocate a separate protected ngrok endpoint or explicitly approve a Legacy tunnel change.

## Start the Windows host

Open PowerShell in the ROS repository and run:

```powershell
$env:ROS_HOST = "127.0.0.1"
$env:ROS_PORT = "3090"
pnpm start
```

Confirm `http://127.0.0.1:3090/health` returns `ok`. Keep this PowerShell window running. The host must stay powered on, awake, and connected to the internet; sleep, shutdown, or a lost home connection makes the external URL unavailable.

## Start protected ngrok

Use a password with at least 8 characters. It lives only in the current PowerShell session:

```powershell
$env:ROS_TUNNEL_BASIC_AUTH = "ros-shadow:replace-with-a-new-password"
ngrok http 3090 --basic-auth $env:ROS_TUNNEL_BASIC_AUTH
```

Copy the `https://...ngrok...` URL shown by ngrok. A browser will prompt for the temporary username and password. Do not send the password in a public group chat and do not save it in a repository file.

## Open devices

- Phone at the company: `https://URL/pos`
- Samsung A9+ POS test: `https://URL/pos`
- Samsung A8 Kitchen test: `https://URL/kitchen`
- iPad test page: `https://URL/pos/statistics`
- Owner Admin/Event only: `https://URL/admin` and `https://URL/admin/events`

Use the same protected URL on every device. `/health`, POS, Kitchen, statistics, Admin, API, and SSE are protected together by ngrok Basic Authentication.

## Verify connection and sync

1. After entering the password, POS and Kitchen must show `已連線`.
2. On POS A create an order; POS B and Kitchen should update without reload.
3. On Kitchen choose preparing, ready, then served. Both POS pages should update each time.
4. Open statistics and verify it sees the same Event and central order count.
5. Briefly turn off one test device's network, then restore it. It should show reconnecting/offline and return to `已連線` without duplicating an order.

## Recovery and close

- Tunnel failure: restart the same `ngrok http 3090 --basic-auth $env:ROS_TUNNEL_BASIC_AUTH` command. A new URL may be assigned.
- ROS failure: restart `pnpm start`, confirm local `/health`, then restart ngrok if required.
- Do not edit code or SQLite at the stall. Stop ROS use and continue in Legacy if any test is unclear.
- End of testing: press `Ctrl+C` in the ngrok window, then clear the session value with `Remove-Item Env:ROS_TUNNEL_BASIC_AUTH`.

## Legacy fallback

Legacy is always the source for live service. ROS is only a parallel record. If ROS or the tunnel is unavailable, stop entering ROS data and continue with Legacy; record the time, device, and screenshot for review.
