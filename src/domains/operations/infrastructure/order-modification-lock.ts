import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";

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
