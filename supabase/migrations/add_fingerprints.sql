-- Fingerprint Management Schema
-- Run this in Supabase SQL Editor

-- fingerprints table (one-to-one with profiles)
CREATE TABLE fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  finger_picu TEXT,
  finger_vk TEXT,
  finger_neo1 TEXT,
  finger_neo2 TEXT,
  finger_absensi TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE fingerprints ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all fingerprints
CREATE POLICY "Fingerprints are viewable by authenticated users" ON fingerprints
  FOR SELECT TO authenticated USING (true);

-- Allow admin to manage fingerprints
CREATE POLICY "Admins can manage fingerprints" ON fingerprints
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Trigger for fingerprints updated_at
CREATE TRIGGER update_fingerprints_updated_at
  BEFORE UPDATE ON fingerprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
