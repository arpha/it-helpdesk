-- Add enhanced prediction fields to atk_predictions table
ALTER TABLE atk_predictions ADD COLUMN IF NOT EXISTS trend TEXT DEFAULT 'stable';
ALTER TABLE atk_predictions ADD COLUMN IF NOT EXISTS trend_percentage DECIMAL(10,2) DEFAULT 0;
ALTER TABLE atk_predictions ADD COLUMN IF NOT EXISTS peak_day TEXT;
ALTER TABLE atk_predictions ADD COLUMN IF NOT EXISTS month_end_multiplier DECIMAL(10,2) DEFAULT 1;
ALTER TABLE atk_predictions ADD COLUMN IF NOT EXISTS usage_lower DECIMAL(10,4);
ALTER TABLE atk_predictions ADD COLUMN IF NOT EXISTS usage_upper DECIMAL(10,4);
