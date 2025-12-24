-- Add is_active column to atk_items table
ALTER TABLE atk_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- Update existing items to be active
UPDATE atk_items SET is_active = true WHERE is_active IS NULL;
