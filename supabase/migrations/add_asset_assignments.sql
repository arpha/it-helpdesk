-- =============================================
-- ASSET ASSIGNMENTS TABLE
-- For tracking asset assignment history
-- =============================================

-- Create asset assignments table
CREATE TABLE IF NOT EXISTS asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    notes TEXT,
    assigned_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_user ON asset_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_assigned_at ON asset_assignments(assigned_at DESC);

-- Enable RLS
ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users
CREATE POLICY "asset_assignments_all" ON asset_assignments 
    FOR ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Remove unused columns from assets table (optional - run separately if needed)
-- ALTER TABLE assets DROP COLUMN IF EXISTS brand;
-- ALTER TABLE assets DROP COLUMN IF EXISTS model;
-- ALTER TABLE assets DROP COLUMN IF EXISTS condition;

-- =============================================
-- ADD OWNERSHIP STATUS COLUMN
-- =============================================
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ownership_status TEXT DEFAULT 'purchase' CHECK (ownership_status IN ('purchase', 'rent'));

-- =============================================
-- ADD SPECIFICATIONS JSONB COLUMN
-- =============================================
ALTER TABLE assets ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_assets_specs ON assets USING GIN (specifications);

-- =============================================
-- ADD ASSET CATEGORIES
-- =============================================
-- First add unique constraint on name if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_categories_name_key') THEN
        ALTER TABLE asset_categories ADD CONSTRAINT asset_categories_name_key UNIQUE (name);
    END IF;
END $$;

-- Insert categories (skip if already exists)
INSERT INTO asset_categories (name, description) VALUES
  ('CPU', 'Unit CPU/Desktop'),
  ('Komputer', 'Laptop atau All-in-One'),
  ('Laptop', 'Laptop'),
  ('Monitor', 'Monitor'),
  ('Server', 'Server'),
  ('UPS', 'Uninterruptible Power Supply'),
  ('Printer', 'Printer'),
  ('Scanner', 'Scanner'),
  ('Harddisk Eksternal', 'External Storage'),
  ('Webcam', 'Webcam'),
  ('Fingerprint', 'Fingerprint Scanner'),
  ('Wacom', 'Drawing Tablet'),
  ('Proyektor', 'Proyektor'),
  ('Peripheral Lainnya', 'Peripheral Lainnya')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- REMOVE DEPARTMENT FROM USERS (PROFILES)
-- =============================================
-- Drop the foreign key constraint first (if exists)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_department_id_fkey;

-- Drop the department_id column from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS department_id;

-- =============================================
-- RENAME DEPARTMENTS TABLE TO LOCATIONS
-- =============================================
-- Rename the table (data will be preserved)
ALTER TABLE IF EXISTS departments RENAME TO locations;

-- =============================================
-- REMOVE PRICE COLUMNS FROM ASSETS (Refresh Cycle instead of Depreciation)
-- =============================================
ALTER TABLE assets DROP COLUMN IF EXISTS purchase_price;

-- =============================================
-- RENAME department_id TO location_id IN ALL TABLES
-- =============================================
ALTER TABLE assets RENAME COLUMN department_id TO location_id;
ALTER TABLE tickets RENAME COLUMN department_id TO location_id;
ALTER TABLE atk_requests RENAME COLUMN department_id TO location_id;

-- =============================================
-- ADD TICKET REFERENCE TO ATK REQUESTS
-- =============================================
ALTER TABLE atk_requests ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL;

-- =============================================
-- ADD DOCUMENT FIELDS FOR SURAT PENGELUARAN BARANG
-- =============================================
ALTER TABLE atk_requests ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE atk_requests ADD COLUMN IF NOT EXISTS document_number text;

-- =============================================
-- AI STOCK PREDICTION TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS atk_predictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid REFERENCES atk_items(id) ON DELETE CASCADE,
    avg_daily_usage float NOT NULL DEFAULT 0,
    days_until_min_stock int,
    predicted_min_date date,
    recommendation text,
    confidence float DEFAULT 0,
    calculated_at timestamp with time zone DEFAULT now(),
    UNIQUE(item_id)
);
