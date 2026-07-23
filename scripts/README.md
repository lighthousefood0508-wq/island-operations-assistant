# Scripts

Formal, executable ROS scripts live here. This includes approved start, stop, deployment, tunnel, verification, and maintenance entry points.

Allowed:

- Versioned PowerShell, batch, Node, or shell scripts with a documented purpose.
- Scripts that write their transient output to `runtime/` or `logs/`.
- Operational scripts that have an owner and rollback instructions.

Do not place:

- Runtime files, PID files, temporary links, or generated state.
- Logs, backups, credentials, or ad-hoc output.
- Legacy automation or an unapproved duplicate startup path.

Project commands remain in `package.json`. Add an operational script only after its scope, owner, and rollback behavior are documented.

## ROS runtime entry points

- `start-ros.ps1` starts the ROS Node server on local port 3092, waits for `/health`, starts the canonical Quick Tunnel, and writes the current links to `runtime/ROS_CURRENT_LINKS.txt`.
- `stop-ros.ps1` stops only the ROS Node and cloudflared processes whose PID and start markers were written by the ROS runtime scripts.
- `start-ros.bat` and `stop-ros.bat` are thin double-click wrappers. They do not contain a second implementation.
- `start-quick-tunnel.ps1` and `stop-quick-tunnel.ps1` remain the single ROS Quick Tunnel implementation and are called by the ROS runtime scripts.

See `docs/deployment/ROS_RUNTIME_WINDOWS.md` for manual operation and the Windows Task Scheduler recreation steps.
