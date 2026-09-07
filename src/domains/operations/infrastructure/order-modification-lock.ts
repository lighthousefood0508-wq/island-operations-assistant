import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { OrderPresentation } from "../domain/types.js";

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
