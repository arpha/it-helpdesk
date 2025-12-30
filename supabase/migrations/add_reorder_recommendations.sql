-- Add reorder-related columns to atk_items table
ALTER TABLE atk_items ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 14;
ALTER TABLE atk_items ADD COLUMN IF NOT EXISTS reorder_point INTEGER;
ALTER TABLE atk_items ADD COLUMN IF NOT EXISTS suggested_order_qty INTEGER;

-- Create reorder_recommendations table
CREATE TABLE IF NOT EXISTS atk_reorder_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES atk_items(id) ON DELETE CASCADE,
    current_stock INTEGER NOT NULL,
    avg_daily_usage DECIMAL(10,4) NOT NULL,
    reorder_point INTEGER NOT NULL,
    suggested_qty INTEGER NOT NULL,
    days_until_reorder INTEGER NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('urgent', 'soon', 'planned', 'safe')),
    estimated_stockout_date DATE,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(item_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_atk_reorder_item_id ON atk_reorder_recommendations(item_id);
CREATE INDEX IF NOT EXISTS idx_atk_reorder_priority ON atk_reorder_recommendations(priority);

-- Enable RLS
ALTER TABLE atk_reorder_recommendations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated users to read atk_reorder_recommendations"
    ON atk_reorder_recommendations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert atk_reorder_recommendations"
    ON atk_reorder_recommendations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update atk_reorder_recommendations"
    ON atk_reorder_recommendations FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
