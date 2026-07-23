# ROS Windows Runtime

## Purpose

These scripts start only Desert Island ROS and its temporary Cloudflare Quick Tunnel. They do not start, stop, restart, or reconfigure Legacy, Legacy ngrok, Docker, or n8n.

## Prerequisites

- Windows Node.js 24 or newer, with `node.exe` and `npm.cmd` installed.
- Project dependencies already installed and the ROS repository available at its normal path.
- `cloudflared` installed locally.

The scripts resolve Node from the current PATH or common Windows Node installation paths. They never use Codex's bundled runtime.

## Start ROS

From the repository root, run:

```powershell
.\scripts\start-ros.ps1
```

The script builds ROS, starts it only when `http://127.0.0.1:3092/health` is not already healthy, then starts the canonical ROS Quick Tunnel. It writes the current public links to:

```text
runtime\ROS_CURRENT_LINKS.txt
```

The public `trycloudflare.com` URL changes after a new Quick Tunnel is created. It is not committed to Git and is for temporary testing only.

## Stop ROS

Run:

```powershell
.\scripts\stop-ros.ps1
```

The stop script only acts on processes recorded in `runtime\ros-server.pid` and `runtime\cloudflared.pid` when their names and start-time markers match. If a marker is missing or does not match, the script refuses to stop the process.

## Windows Task Scheduler

Create the task only after the manual start, repeat start, stop, and restart checks all pass.

- Name: `Desert Island ROS Startup`
- Trigger: At log on
- Delay: 30 seconds
- Program: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
- Arguments:

```text
-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\Users\user\Documents\荒島餐車 AI 營運資料庫\desert-island-ros\scripts\start-ros.ps1"
```

- Run only when the user is logged on.
- Do not enable highest privileges unless a separate operating-system requirement proves it is necessary.

To disable it, open Task Scheduler, select `Desert Island ROS Startup`, and choose Disable. To remove it, choose Delete. These are Windows-local settings and are not stored in Git.

## Verification After Login

After a real Windows sign-out and sign-in, without opening Codex:

1. Wait at least 30 seconds.
2. Open `runtime\ROS_CURRENT_LINKS.txt`.
3. Confirm the health link returns HTTP 200.
4. Confirm the Back Office, Catalog, POS, and Kitchen links open.
5. Confirm Legacy, n8n, Docker, and Legacy ngrok are still operating normally.

Do not claim this verification is complete until a person performs the actual sign-out/sign-in test.
