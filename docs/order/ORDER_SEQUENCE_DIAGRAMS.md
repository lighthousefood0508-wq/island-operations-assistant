# Order Sequence Diagrams

## POS onsite order

```mermaid
sequenceDiagram
  participant Staff as POS staff
  participant API as Operations Order service
  participant Event as Event sellable snapshot
  Staff->>API: create POS order + idempotency key
  API->>Event: guarded reserve quantity
  API->>Event: convert reserve to sold allocation
  API-->>Staff: confirmed, unpaid order + order number
```

## Kiosk order

```mermaid
sequenceDiagram
  participant Guest as Kiosk guest
  participant API as Operations Order service
  participant Event as Event sellable snapshot
  Guest->>API: submit order + retained idempotency key
  API->>Event: guarded increase reserved quantity
  API-->>Guest: submitted order result
  Note over API,Event: Retry with same key returns same Order; no second reserve
```

## Preorder order

```mermaid
sequenceDiagram
  participant Line as LINE preorder adapter
  participant API as Operations Order service
  participant Event as Event sellable snapshot
  Line->>API: submit preorder + webhook-derived key
  API->>API: validate Event deadline and future quota policy
  API->>Event: guarded increase reserved quantity
  API-->>Line: submitted reservation result
```

## Payment and quantity conversion

```mermaid
sequenceDiagram
  participant POS
  participant Order as Operations Order service
  participant Event as Sellable Inventory
  POS->>Order: confirm submitted order
  Order->>Event: reservedQuantity - quantity
  Order->>Event: soldQuantity + quantity
  Order-->>POS: confirmed
  POS->>Order: future payment result
  Order-->>POS: paymentStatus updated only
```

## Cancel and release

```mermaid
sequenceDiagram
  participant Actor as Customer or staff
  participant Order as Operations Order service
  participant Event as Sellable Inventory
  Actor->>Order: cancel with reason
  alt submitted / not started
    Order->>Event: reservedQuantity - quantity
  else confirmed / not started
    Order->>Event: soldQuantity - quantity
  else preparing, ready, or served
    Note over Order,Event: no automatic restoration
  end
  Order-->>Actor: audited cancellation result
```

## Kitchen production states

```mermaid
sequenceDiagram
  participant Kitchen
  participant Order as Operations Order service
  Kitchen->>Order: queued -> preparing
  Kitchen->>Order: preparing -> ready
  Order-->>Kitchen: idempotent production snapshot
  participant POS
  POS->>Order: ready -> served and commercial completion
```
