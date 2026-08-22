export type CostSupplierRecord = Readonly<{
  supplierId: string;
  displayName: string;
  createdAt: string;
  createdBy: string;
  aggregateVersion: number;
}>;

export type CostSupplierRow = Readonly<{
  supplier_id: string;
  display_name: string;
  created_at: string;
  created_by: string;
  aggregate_version: number;
}>;
