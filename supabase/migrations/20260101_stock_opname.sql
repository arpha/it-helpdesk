-- Stock Opname Sessions Table
CREATE TABLE IF NOT EXISTS stock_opname_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    completed_by UUID REFERENCES profiles(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Opname Items Table
CREATE TABLE IF NOT EXISTS stock_opname_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES stock_opname_sessions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES atk_items(id),
    system_quantity INT NOT NULL DEFAULT 0,
    physical_quantity INT,
    difference INT GENERATED ALWAYS AS (COALESCE(physical_quantity, 0) - system_quantity) STORED,
    notes TEXT,
    counted_by UUID REFERENCES profiles(id),
    counted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_opname_items_session ON stock_opname_items(session_id);
CREATE INDEX IF NOT EXISTS idx_stock_opname_items_item ON stock_opname_items(item_id);

-- RLS Policies
ALTER TABLE stock_opname_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_opname_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view stock opname sessions"
    ON stock_opname_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert stock opname sessions"
    ON stock_opname_sessions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update stock opname sessions"
    ON stock_opname_sessions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to view stock opname items"
    ON stock_opname_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert stock opname items"
    ON stock_opname_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update stock opname items"
    ON stock_opname_items FOR UPDATE TO authenticated USING (true);
