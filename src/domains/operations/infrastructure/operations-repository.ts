import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { ProductContractV2 } from "../../../shared/contracts/product-contract.js";
import type { EventProduct, EventStatus, OperationsEvent, SellableInventory, SellableInventoryView } from "../domain/types.js";

type EventRow = { event_id: string; event_code: string; display_name: string; date: string; start_time: string; end_time: string; status: EventStatus; created_at: string; updated_at: string };
type InventoryRow = { event_id: string; product_id: string; product_version_id: string; planned_quantity: number; reserved_quantity: number; sold_quantity: number; safety_buffer_quantity: number; created_at: string; updated_at: string };
type ProductRow = { product_id: string; product_version_id: string; category_id: string; display_category_name: string; display_category_sort_order: number; display_name: string; pos_name: string; selling_price: number; channels_json: string; is_active: number; published_at: string; contract_version: string };

function mapEvent(row: EventRow): OperationsEvent {
  return { eventId: row.event_id, eventCode: row.event_code, displayName: row.display_name, date: row.date, startTime: row.start_time, endTime: row.end_time, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapInventory(row: InventoryRow): SellableInventory {
  const remainingQuantity = row.planned_quantity - row.reserved_quantity - row.sold_quantity;
  return { eventId: row.event_id, productId: row.product_id, productVersionId: row.product_version_id, plannedQuantity: row.planned_quantity, reservedQuantity: row.reserved_quantity, soldQuantity: row.sold_quantity, safetyBufferQuantity: row.safety_buffer_quantity, remainingQuantity, customerAvailableQuantity: Math.max(0, remainingQuantity - row.safety_buffer_quantity), createdAt: row.created_at, updatedAt: row.updated_at };
}

export class OperationsRepository {
  constructor(private readonly database: DatabaseAdapter) {}
  transaction<T>(work: () => T): T { return this.database.transaction(work); }
  transactionImmediate<T>(work: () => T): T { return this.database.transactionImmediate(work); }

  listEvents(): OperationsEvent[] {
    return this.database.queryMany<EventRow>("SELECT event_id, event_code, display_name, date, start_time, end_time, status, created_at, updated_at FROM operations_events WHERE event_code IS NOT NULL ORDER BY date DESC, start_time DESC").map(mapEvent);
  }
  listEventCodesByDate(date: string): string[] {
    return this.database.queryMany<{ event_code: string }>("SELECT event_code FROM operations_events WHERE date = ? AND event_code IS NOT NULL ORDER BY event_code", [date]).map((row) => row.event_code);
  }
  findEventByCode(eventCode: string): OperationsEvent | undefined {
    const row = this.database.queryOne<EventRow>("SELECT event_id, event_code, display_name, date, start_time, end_time, status, created_at, updated_at FROM operations_events WHERE event_code = ?", [eventCode]);
    return row ? mapEvent(row) : undefined;
  }
  findEvent(eventId: string): OperationsEvent | undefined {
    const row = this.database.queryOne<EventRow>("SELECT event_id, event_code, display_name, date, start_time, end_time, status, created_at, updated_at FROM operations_events WHERE event_id = ?", [eventId]);
    return row ? mapEvent(row) : undefined;
  }
  findOpenEvent(): OperationsEvent | undefined {
    const row = this.database.queryOne<EventRow>("SELECT event_id, event_code, display_name, date, start_time, end_time, status, created_at, updated_at FROM operations_events WHERE status = 'open'");
    return row ? mapEvent(row) : undefined;
  }
  insertEvent(event: OperationsEvent): void {
    this.database.execute("INSERT INTO operations_events (event_id, event_name, starts_at, event_code, display_name, date, start_time, end_time, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [event.eventId, event.displayName, `${event.date}T${event.startTime}:00.000Z`, event.eventCode, event.displayName, event.date, event.startTime, event.endTime, event.status, event.createdAt, event.updatedAt]);
  }
  updateEvent(event: OperationsEvent): void {
    this.database.execute("UPDATE operations_events SET event_code = ?, display_name = ?, date = ?, start_time = ?, end_time = ?, status = ?, updated_at = ? WHERE event_id = ?", [event.eventCode, event.displayName, event.date, event.startTime, event.endTime, event.status, event.updatedAt, event.eventId]);
  }
  upsertProductCopy(contract: ProductContractV2, receivedAt: string): void {
    this.database.execute(`INSERT INTO operations_product_copies (operations_product_copy_id, product_id, product_version_id, category_id, display_category_name, display_category_sort_order, display_name, pos_name, selling_price, channels_json, is_active, published_at, contract_version, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(product_version_id) DO UPDATE SET category_id = excluded.category_id, display_category_name = excluded.display_category_name, display_category_sort_order = excluded.display_category_sort_order, display_name = excluded.display_name, pos_name = excluded.pos_name, selling_price = excluded.selling_price, channels_json = excluded.channels_json, is_active = excluded.is_active, published_at = excluded.published_at, contract_version = excluded.contract_version, received_at = excluded.received_at`,
      [`opcopy_${contract.productVersionId}`, contract.productId, contract.productVersionId, contract.categoryId, contract.displayCategoryName, contract.displayCategorySortOrder, contract.displayName, contract.posName, contract.sellingPrice, JSON.stringify(contract.channels), contract.isActive ? 1 : 0, contract.publishedAt, contract.contractVersion, receivedAt]);
  }
  listInventory(eventId: string): SellableInventoryView[] {
    const rows = this.database.queryMany<InventoryRow & Partial<ProductRow>>(`SELECT i.event_id, i.product_id, i.product_version_id, i.planned_quantity, i.reserved_quantity, i.sold_quantity, i.safety_buffer_quantity, i.created_at, i.updated_at,
      p.category_id, p.display_category_name, p.display_category_sort_order, p.display_name, p.pos_name, p.selling_price, p.channels_json, p.is_active, p.published_at, p.contract_version
      FROM operations_sellable_inventory i LEFT JOIN operations_product_copies p ON p.product_version_id = i.product_version_id
      WHERE i.event_id = ?
      ORDER BY p.display_category_sort_order, p.display_name, i.created_at`, [eventId]);
    return rows.map((row) => {
      const inventory = mapInventory(row);
      return row.contract_version ? { ...inventory, contractVersion: row.contract_version as "2", categoryId: row.category_id, displayCategoryName: row.display_category_name, displayCategorySortOrder: row.display_category_sort_order, displayName: row.display_name, posName: row.pos_name, sellingPrice: row.selling_price, channels: JSON.parse(row.channels_json as string) as string[], isActive: row.is_active === 1, publishedAt: row.published_at } : inventory;
    });
  }
  setInventory(inventory: SellableInventory): void {
    this.database.execute(`INSERT INTO operations_sellable_inventory (event_id, product_id, product_version_id, planned_quantity, reserved_quantity, sold_quantity, safety_buffer_quantity, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id, product_version_id) DO UPDATE SET planned_quantity = excluded.planned_quantity, safety_buffer_quantity = excluded.safety_buffer_quantity, updated_at = excluded.updated_at`,
      [inventory.eventId, inventory.productId, inventory.productVersionId, inventory.plannedQuantity, inventory.reservedQuantity, inventory.soldQuantity, inventory.safetyBufferQuantity, inventory.createdAt, inventory.updatedAt]);
  }
  hasPositiveInventory(eventId: string): boolean {
    return this.database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM operations_sellable_inventory WHERE event_id = ? AND planned_quantity > 0", [eventId])?.count !== 0;
  }
  listCurrentProducts(eventId: string): EventProduct[] {
    const rows = this.database.queryMany<ProductRow & InventoryRow>(`SELECT i.event_id, i.product_id, i.product_version_id, i.planned_quantity, i.reserved_quantity, i.sold_quantity, i.safety_buffer_quantity, i.created_at, i.updated_at,
      p.category_id, p.display_category_name, p.display_category_sort_order, p.display_name, p.pos_name, p.selling_price, p.channels_json, p.is_active, p.published_at, p.contract_version
      FROM operations_sellable_inventory i JOIN operations_product_copies p ON p.product_version_id = i.product_version_id
      WHERE i.event_id = ? AND p.is_active = 1
      ORDER BY p.display_category_sort_order, p.display_name`, [eventId]);
    return rows.map((row) => {
      const remainingQuantity = row.planned_quantity - row.reserved_quantity - row.sold_quantity;
      return { contractVersion: row.contract_version as "2", productId: row.product_id, productVersionId: row.product_version_id, categoryId: row.category_id, displayCategoryName: row.display_category_name, displayCategorySortOrder: row.display_category_sort_order, displayName: row.display_name, posName: row.pos_name, sellingPrice: row.selling_price, channels: JSON.parse(row.channels_json) as string[], isActive: row.is_active === 1, publishedAt: row.published_at, remainingQuantity, safetyBufferQuantity: row.safety_buffer_quantity, customerAvailableQuantity: Math.max(0, remainingQuantity - row.safety_buffer_quantity) };
    });
  }
}
