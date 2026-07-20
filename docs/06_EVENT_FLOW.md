# Event Flow

SSE is the initial one-way real-time transport. Clients reconnect and re-fetch authoritative REST state; SSE messages are hints, not their only source of truth.

Planned domain events: `catalog.published`, `availability.changed`, `order.created`, `order.status_changed`, `payment.recorded`, `inventory.changed`, `sync.completed`, and `sync.failed`.

The future command flow is: client request -> validate transaction -> SQLite commit -> audit log -> domain event -> SSE fan-out -> async reporting sync. No event consumer may treat Google Sheets as a command source for live order state.
