ALTER TABLE operations_sellable_inventory ADD COLUMN safety_buffer_quantity INTEGER NOT NULL DEFAULT 0 CHECK (safety_buffer_quantity >= 0);
