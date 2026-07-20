# ADR-018: Sales Contract Emission Point

Status: Accepted

Architecture Owner: Miles / 林子茂
Decision date: 2026-07-20

## Decision

Operations emits exactly one Sales Contract for an orderId only when orderStatus becomes completed. It does not emit at paid, confirmed, queued, preparing, ready, or served. Cancelled Orders never emit Sales Contract.

## Accepted known gap

When an Order is cancelled after production begins, food may be consumed but Cost receives no Sales Contract because the Order is cancelled. This is accepted for first version. A future independent Waste Contract/reporting flow will handle it; this ADR does not create or approve that flow.
