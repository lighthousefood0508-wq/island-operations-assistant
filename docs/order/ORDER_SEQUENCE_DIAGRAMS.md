# Frozen Order Policy Diagrams

## POS direct sale allocation

```mermaid
sequenceDiagram
  participant POS
  participant Order as Operations Order service
  participant Event as Sellable Inventory
  POS->>Order: create POS Order plus idempotency key
  Order->>Event: guarded soldQuantity plus quantity
  Order-->>POS: confirmed, unpaid, not_started, shared order number
  POS->>Order: record payment paid
  POS->>Order: queue for Kitchen
```

## Kiosk ten-minute reservation

```mermaid
sequenceDiagram
  participant Kiosk
  participant Order as Operations Order service
  participant Event as Sellable Inventory
  Kiosk->>Order: submit plus retained idempotency key
  Order->>Event: guarded reservedQuantity plus quantity
  Order-->>Kiosk: submitted, unpaid, not_started
  alt paid within ten minutes
    Order->>Event: reserved minus quantity; sold plus quantity
    Order-->>Kiosk: confirmed, paid, queued
  else timeout
    Order->>Event: reserved minus quantity
    Order-->>Kiosk: cancelled with timeout reason
  end
```

## Preorder automatic confirmation

```mermaid
sequenceDiagram
  participant Adapter as Preorder adapter
  participant Order as Operations Order service
  participant Event as Event policy and inventory
  Adapter->>Order: submit stable webhook key
  Order->>Event: validate OPEN Event, deadline, quota, remaining
  Order->>Event: guarded soldQuantity plus quantity
  Order-->>Adapter: confirmed, unpaid, not_started
  participant POS
  POS->>Order: manual send to Kitchen
  Order-->>POS: production queued
```

## Completed to Sales Contract

```mermaid
sequenceDiagram
  participant POS
  participant Order as Operations Order service
  participant Outbox as Future Sales Contract outbox
  POS->>Order: mark completed after paid and served
  Order->>Outbox: emit once for orderId
  Order-->>POS: completed
  Note over Outbox: cancelled Orders never emit
```
