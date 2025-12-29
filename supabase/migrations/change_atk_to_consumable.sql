-- Migration: Change type 'atk' to 'consumable' in atk_items table
-- PostgreSQL ENUM type requires special handling

-- Step 1: Add 'consumable' to the enum type
ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'consumable';

-- Step 2: Update existing 'atk' values to 'consumable'
UPDATE atk_items
SET type = 'consumable'
WHERE type = 'atk';

-- Note: Removing 'atk' from enum requires recreating the type, which is complex.
-- For now, we keep 'atk' in enum but all data uses 'consumable'.
-- The application code already only allows 'consumable' or 'sparepart'.
