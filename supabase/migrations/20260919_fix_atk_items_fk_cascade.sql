-- Migration: Fix foreign key constraints on atk_items
-- Allows deletion of atk_items by setting related references to NULL (preserving history)

-- 1. atk_request_items.item_id → SET NULL
ALTER TABLE atk_request_items
    DROP CONSTRAINT IF EXISTS atk_request_items_item_id_fkey;
ALTER TABLE atk_request_items
    ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE atk_request_items
    ADD CONSTRAINT atk_request_items_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES atk_items(id) ON DELETE SET NULL;

-- 2. atk_purchase_items.item_id → SET NULL
ALTER TABLE atk_purchase_items
    DROP CONSTRAINT IF EXISTS atk_purchase_items_item_id_fkey;
ALTER TABLE atk_purchase_items
    ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE atk_purchase_items
    ADD CONSTRAINT atk_purchase_items_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES atk_items(id) ON DELETE SET NULL;

-- 3. stock_opname_items.item_id → SET NULL
ALTER TABLE stock_opname_items
    DROP CONSTRAINT IF EXISTS stock_opname_items_item_id_fkey;
ALTER TABLE stock_opname_items
    ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE stock_opname_items
    ADD CONSTRAINT stock_opname_items_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES atk_items(id) ON DELETE SET NULL;

-- 4. ticket_parts.item_id → SET NULL
ALTER TABLE ticket_parts
    DROP CONSTRAINT IF EXISTS ticket_parts_item_id_fkey;
ALTER TABLE ticket_parts
    ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE ticket_parts
    ADD CONSTRAINT ticket_parts_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES atk_items(id) ON DELETE SET NULL;
