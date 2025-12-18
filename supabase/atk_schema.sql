-- ATK Management Database Schema
-- Run this SQL in Supabase SQL Editor

-- 1. Create ENUM types
CREATE TYPE item_type AS ENUM ('atk', 'sparepart');
CREATE TYPE atk_request_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE purchase_status AS ENUM ('draft', 'submitted', 'approved', 'purchased');
CREATE TYPE atk_stock_type AS ENUM ('in', 'out', 'adjustment');

-- 2. ATK Items table
CREATE TABLE atk_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type item_type NOT NULL DEFAULT 'atk',
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) NOT NULL,
  price DECIMAL(15,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 5,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ATK Requests table
CREATE TABLE atk_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES profiles(id),
  department_id UUID REFERENCES departments(id),
  status atk_request_status DEFAULT 'pending',
  notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  approval_signature_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ATK Request Items table
CREATE TABLE atk_request_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES atk_requests(id) ON DELETE CASCADE,
  item_id UUID REFERENCES atk_items(id),
  quantity INTEGER NOT NULL,
  approved_quantity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ATK Purchase Requests table
CREATE TABLE atk_purchase_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  status purchase_status DEFAULT 'draft',
  total_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  approval_signature_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ATK Purchase Items table
CREATE TABLE atk_purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID REFERENCES atk_purchase_requests(id) ON DELETE CASCADE,
  item_id UUID REFERENCES atk_items(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(15,2) NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ATK Stock History table
CREATE TABLE atk_stock_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES atk_items(id) ON DELETE CASCADE,
  type atk_stock_type NOT NULL,
  quantity INTEGER NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable RLS
ALTER TABLE atk_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE atk_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE atk_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE atk_purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE atk_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE atk_stock_history ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies (allow all for authenticated users)
CREATE POLICY "Allow all for authenticated" ON atk_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON atk_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON atk_request_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON atk_purchase_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON atk_purchase_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON atk_stock_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. Updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 11. Apply triggers
CREATE TRIGGER update_atk_items_updated_at BEFORE UPDATE ON atk_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_atk_requests_updated_at BEFORE UPDATE ON atk_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_atk_purchase_requests_updated_at BEFORE UPDATE ON atk_purchase_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
