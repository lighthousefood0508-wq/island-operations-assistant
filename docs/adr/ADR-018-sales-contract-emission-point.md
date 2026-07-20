# ADR-018: Sales Contract Emission Point

Status: Proposed. Awaiting Architecture Owner Review.

Operations emits one Sales Contract only when an Order becomes `completed`. Payment and production updates do not emit it. Cost import remains out of scope.
