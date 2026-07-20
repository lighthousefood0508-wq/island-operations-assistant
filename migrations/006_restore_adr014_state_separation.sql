-- Recovery for databases that ran the original Phase 1C-2 migration. Every
-- statement is repeatable: rerunning it preserves the recovered three-track state.
UPDATE operations_orders
SET
  order_status = CASE
    WHEN order_status IN ('pending', 'cooking', 'ready') THEN 'confirmed'
    WHEN order_status = 'no_show' THEN 'cancelled'
    ELSE order_status
  END,
  status = CASE
    WHEN order_status IN ('pending', 'cooking', 'ready') THEN 'confirmed'
    WHEN order_status = 'no_show' THEN 'cancelled'
    ELSE status
  END,
  production_status = CASE
    WHEN order_status = 'cooking' THEN 'preparing'
    WHEN order_status = 'ready' THEN 'ready'
    WHEN order_status = 'completed' THEN 'served'
    WHEN order_status IN ('no_show', 'cancelled') AND EXISTS (
      SELECT 1 FROM audit_logs
      WHERE entity_id = operations_orders.order_id
        AND after_json LIKE '%"from":"ready"%'
    ) THEN 'ready'
    WHEN order_status IN ('no_show', 'cancelled') AND EXISTS (
      SELECT 1 FROM audit_logs
      WHERE entity_id = operations_orders.order_id
        AND after_json LIKE '%"from":"cooking"%'
    ) THEN 'preparing'
    ELSE COALESCE(production_status, 'not_started')
  END,
  payment_status = COALESCE(payment_status, 'unpaid'),
  cancellation_reason = CASE
    WHEN order_status = 'no_show' THEN 'no_show'
    ELSE cancellation_reason
  END,
  cancelled_at = CASE
    WHEN order_status = 'no_show' THEN COALESCE(
      cancelled_at,
      (SELECT occurred_at FROM audit_logs
       WHERE entity_id = operations_orders.order_id AND action = 'no_show'
       ORDER BY occurred_at DESC LIMIT 1)
    )
    ELSE cancelled_at
  END;
