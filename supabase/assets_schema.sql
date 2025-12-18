-- =============================================
-- MANAGEMENT ASSETS SCHEMA
-- =============================================

-- Asset Categories
CREATE TABLE IF NOT EXISTS asset_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO asset_categories (name, description) VALUES
    ('Komputer', 'PC Desktop dan Workstation'),
    ('Laptop', 'Laptop dan Notebook'),
    ('Printer', 'Printer, MFP, dan Plotter'),
    ('Scanner', 'Scanner dokumen'),
    ('Peripheral', 'Mouse, Keyboard, Monitor, dll');

-- Assets Table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    category_id UUID REFERENCES asset_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    purchase_date DATE,
    purchase_price DECIMAL(15,2) DEFAULT 0,
    warranty_expiry DATE,
    useful_life_years INTEGER DEFAULT 5,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'damage', 'disposed')),
    condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('good', 'fair', 'poor')),
    location VARCHAR(255),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    image_url TEXT,
    qr_code_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset Maintenance History
CREATE TABLE IF NOT EXISTS asset_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('repair', 'upgrade', 'cleaning', 'inspection')),
    description TEXT,
    cost DECIMAL(15,2) DEFAULT 0,
    performed_by VARCHAR(255),
    performed_at DATE,
    next_maintenance DATE,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assets_code ON assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON asset_maintenance(asset_id);

-- RLS Policies
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_maintenance ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users
CREATE POLICY "asset_categories_all" ON asset_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "assets_all" ON assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "asset_maintenance_all" ON asset_maintenance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_assets_updated_at();
