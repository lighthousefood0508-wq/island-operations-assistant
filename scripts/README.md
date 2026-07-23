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
