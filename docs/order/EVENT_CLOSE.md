# Event Close

Event Close is manual, idempotent, and Operations-only. It refuses an OPEN Event with `pending`, `cooking`, or `ready` Orders. Staff resolve each as `completed` or `no_show`, confirm close, then one IMMEDIATE transaction stores an immutable daily-report snapshot, appends audit, and locks the Event as `closed`. Repeating close returns the stored report without another settlement.
