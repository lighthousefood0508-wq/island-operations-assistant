# ADR-003: REST plus SSE

## Decision

Use REST APIs for state and commands, with SSE for live notifications.

## Rationale

SSE is simple through reverse proxies and sufficient for server-to-device order updates. REST remains the authoritative recovery path.

## Consequence

Events do not replace durable state or transaction validation.
