-- Create atk_item_analytics table for inventory health tracking
CREATE TABLE IF NOT EXISTS atk_item_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES atk_items(id) ON DELETE CASCADE,
    days_since_last_out INTEGER DEFAULT 0,
    total_out_30d INTEGER DEFAULT 0,
    total_out_90d INTEGER DEFAULT 0,
    avg_daily_usage DECIMAL(10,4) DEFAULT 0,
    turnover_rate DECIMAL(10,4) DEFAULT 0,
    health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'slow', 'dead', 'unknown')),
    last_out_date TIMESTAMPTZ,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(item_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_atk_item_analytics_item_id ON atk_item_analytics(item_id);
CREATE INDEX IF NOT EXISTS idx_atk_item_analytics_health_status ON atk_item_analytics(health_status);

-- Enable RLS
ALTER TABLE atk_item_analytics ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
CREATE POLICY "Allow authenticated users to read atk_item_analytics"
    ON atk_item_analytics FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert atk_item_analytics"
    ON atk_item_analytics FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update atk_item_analytics"
    ON atk_item_analytics FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
