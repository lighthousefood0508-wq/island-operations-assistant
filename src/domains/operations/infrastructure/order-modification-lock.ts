import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { OperationsOrder, OrderModificationDisplay, OrderPresentation } from "../domain/types.js";

export const NONTERMINAL_ORDER_MODIFICATION_STATES = [
  "prepared",
  "external_in_progress",
  "reconciliation_required"
] as const;

export function resolveOrderModificationRoot(database: DatabaseAdapter, orderId: string): string {
  return database.queryOne<{ root_order_id: string }>(`SELECT root_order_id
    FROM operations_order_replacements
    WHERE replacement_order_id = ? OR superseded_order_id = ?
    ORDER BY effective_revision DESC LIMIT 1`, [orderId, orderId])?.root_order_id ?? orderId;
}

export function resolveOrderPresentation(
  database: DatabaseAdapter,
  orderId: string,
  internalOrderNumber: string
): OrderPresentation {
  const replacement = database.queryOne<{
    pickup_number: string;
    effective_revision: number;
  }>(`SELECT root.order_number AS pickup_number, replacement.effective_revision
    FROM operations_order_replacements replacement
    JOIN operations_orders root ON root.order_id = replacement.root_order_id
    WHERE replacement.replacement_order_id = ?
    LIMIT 1`, [orderId]);
  if (!replacement) {
    return {
      pickupNumber: internalOrderNumber,
      modified: false,
      effectiveRevision: 1,
      modificationSequence: 0
    };
  }
  return {
    pickupNumber: replacement.pickup_number,
    modified: true,
    effectiveRevision: replacement.effective_revision,
    modificationSequence: replacement.effective_revision - 1
  };
}

type FrozenOrderView = Pick<OperationsOrder, "items">;

function parseOrderView(value: string): FrozenOrderView | undefined {
  try {
    const parsed = JSON.parse(value) as FrozenOrderView;
    return parsed && Array.isArray(parsed.items) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function resolveOrderModificationDisplay(
  database: DatabaseAdapter,
  orderId: string
): OrderModificationDisplay {
  const rootOrderId = resolveOrderModificationRoot(database, orderId);
  const active = database.queryOne<{ state: OrderModificationDisplay["state"] }>(`SELECT state
    FROM operations_order_modification_intents
    WHERE root_order_id = ?
      AND state IN ('prepared', 'external_in_progress', 'reconciliation_required')
    LIMIT 1`, [rootOrderId]);
  const confirmed = database.queryOne<{ before_json: string; after_json: string }>(`SELECT intent.before_json, intent.after_json
    FROM operations_order_replacements replacement
    JOIN operations_order_modification_intents intent ON intent.intent_id = replacement.intent_id
    WHERE replacement.replacement_order_id = ? AND intent.state = 'confirmed'
    LIMIT 1`, [orderId]);
  const before = confirmed ? parseOrderView(confirmed.before_json) : undefined;
  const after = confirmed ? parseOrderView(confirmed.after_json) : undefined;
  const beforeByProduct = new Map(before?.items.map((item) => [item.productId, item]) ?? []);
  const afterByProduct = new Map(after?.items.map((item) => [item.productId, item]) ?? []);
  const productIds = new Set([...beforeByProduct.keys(), ...afterByProduct.keys()]);
  const lastChanges = [...productIds].reduce<Array<OrderModificationDisplay["lastChanges"][number]>>((changes, productId) => {
    const oldItem = beforeByProduct.get(productId);
    const newItem = afterByProduct.get(productId);
    const beforeQuantity = oldItem?.quantity ?? 0;
    const afterQuantity = newItem?.quantity ?? 0;
    const posName = newItem?.posNameSnapshot ?? oldItem?.posNameSnapshot ?? productId;
    if (!oldItem && newItem) changes.push({ kind: "added", productId, posName, beforeQuantity, afterQuantity });
    else if (oldItem && !newItem) changes.push({ kind: "removed", productId, posName, beforeQuantity, afterQuantity });
    else if (beforeQuantity !== afterQuantity) changes.push({ kind: "quantity", productId, posName, beforeQuantity, afterQuantity });
    else if ((oldItem?.notes ?? null) !== (newItem?.notes ?? null)) changes.push({ kind: "note", productId, posName, beforeQuantity, afterQuantity });
    return changes;
  }, []);
  return { locked: Boolean(active), state: active?.state ?? null, lastChanges };
}

export function hasNonterminalOrderModification(database: DatabaseAdapter, orderId: string): boolean {
  const rootOrderId = resolveOrderModificationRoot(database, orderId);
  return database.queryOne<{ intent_id: string }>(`SELECT intent_id
    FROM operations_order_modification_intents
    WHERE root_order_id = ?
      AND state IN ('prepared', 'external_in_progress', 'reconciliation_required')
    LIMIT 1`, [rootOrderId]) !== undefined;
}

export function hasNonterminalEventModification(database: DatabaseAdapter, eventId: string): boolean {
  return database.queryOne<{ intent_id: string }>(`SELECT intent_id
    FROM operations_order_modification_intents
    WHERE event_id = ?
      AND state IN ('prepared', 'external_in_progress', 'reconciliation_required')
    LIMIT 1`, [eventId]) !== undefined;
}
