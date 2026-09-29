-- ==============================================================================
-- Migration: Add Dynamic Fingerprint Machines & Decoupled Fingerprints
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. Create table for dynamic fingerprint machines
CREATE TABLE IF NOT EXISTS fingerprint_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Seed initial 5 machines
INSERT INTO fingerprint_machines (name, code, location, is_active)
VALUES
  ('Mesin Finger PICU', 'picu', 'Ruang PICU', true),
  ('Mesin Finger VK', 'vk', 'Ruang VK / Bersalin', true),
  ('Mesin Finger Neo 1', 'neo1', 'Ruang Perinatologi / Neo 1', true),
  ('Mesin Finger Neo 2', 'neo2', 'Ruang Perinatologi / Neo 2', true),
  ('Mesin Finger Absensi', 'absensi', 'Lobi Utama / Absensi', true)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, location = EXCLUDED.location;

-- 3. Update fingerprints table: add name, make user_id nullable
ALTER TABLE fingerprints ADD COLUMN IF NOT EXISTS name TEXT;

-- Backfill name from profiles table for existing rows
UPDATE fingerprints 
SET name = profiles.full_name 
FROM profiles 
WHERE fingerprints.user_id = profiles.id 
  AND (fingerprints.name IS NULL OR fingerprints.name = '');

-- Fallback for any without name
UPDATE fingerprints 
SET name = 'Pegawai ' || SUBSTRING(id::text, 1, 6) 
WHERE name IS NULL OR name = '';

-- Set name NOT NULL
ALTER TABLE fingerprints ALTER COLUMN name SET NOT NULL;

-- Make user_id nullable and relax unique constraint
ALTER TABLE fingerprints ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE fingerprints DROP CONSTRAINT IF EXISTS fingerprints_user_id_key;

DROP INDEX IF EXISTS fingerprints_user_id_unique;
CREATE UNIQUE INDEX fingerprints_user_id_unique ON fingerprints(user_id) WHERE user_id IS NOT NULL;

-- 4. Create table for machine entries (junction between person, machine, and finger ID)
CREATE TABLE IF NOT EXISTS fingerprint_machine_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_id UUID NOT NULL REFERENCES fingerprints(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES fingerprint_machines(id) ON DELETE CASCADE,
  finger_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_fingerprint_machine UNIQUE(fingerprint_id, machine_id),
  CONSTRAINT uq_machine_finger_id UNIQUE(machine_id, finger_id)
);

-- 5. Migrate existing machine columns into fingerprint_machine_entries
-- PICU
INSERT INTO fingerprint_machine_entries (fingerprint_id, machine_id, finger_id)
SELECT f.id, m.id, f.finger_picu
FROM fingerprints f
CROSS JOIN fingerprint_machines m
WHERE m.code = 'picu' AND f.finger_picu IS NOT NULL AND TRIM(f.finger_picu) <> ''
ON CONFLICT (fingerprint_id, machine_id) DO UPDATE SET finger_id = EXCLUDED.finger_id;

-- VK
INSERT INTO fingerprint_machine_entries (fingerprint_id, machine_id, finger_id)
SELECT f.id, m.id, f.finger_vk
FROM fingerprints f
CROSS JOIN fingerprint_machines m
WHERE m.code = 'vk' AND f.finger_vk IS NOT NULL AND TRIM(f.finger_vk) <> ''
ON CONFLICT (fingerprint_id, machine_id) DO UPDATE SET finger_id = EXCLUDED.finger_id;

-- Neo 1
INSERT INTO fingerprint_machine_entries (fingerprint_id, machine_id, finger_id)
SELECT f.id, m.id, f.finger_neo1
FROM fingerprints f
CROSS JOIN fingerprint_machines m
WHERE m.code = 'neo1' AND f.finger_neo1 IS NOT NULL AND TRIM(f.finger_neo1) <> ''
ON CONFLICT (fingerprint_id, machine_id) DO UPDATE SET finger_id = EXCLUDED.finger_id;

-- Neo 2
INSERT INTO fingerprint_machine_entries (fingerprint_id, machine_id, finger_id)
SELECT f.id, m.id, f.finger_neo2
FROM fingerprints f
CROSS JOIN fingerprint_machines m
WHERE m.code = 'neo2' AND f.finger_neo2 IS NOT NULL AND TRIM(f.finger_neo2) <> ''
ON CONFLICT (fingerprint_id, machine_id) DO UPDATE SET finger_id = EXCLUDED.finger_id;

-- Absensi
INSERT INTO fingerprint_machine_entries (fingerprint_id, machine_id, finger_id)
SELECT f.id, m.id, f.finger_absensi
FROM fingerprints f
CROSS JOIN fingerprint_machines m
WHERE m.code = 'absensi' AND f.finger_absensi IS NOT NULL AND TRIM(f.finger_absensi) <> ''
ON CONFLICT (fingerprint_id, machine_id) DO UPDATE SET finger_id = EXCLUDED.finger_id;

-- 6. RLS Policies
ALTER TABLE fingerprint_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fingerprint_machine_entries ENABLE ROW LEVEL SECURITY;

-- Allow reading active machines for everyone (including public QR scanner)
DROP POLICY IF EXISTS "Active machines are viewable by everyone" ON fingerprint_machines;
CREATE POLICY "Active machines are viewable by everyone" ON fingerprint_machines
  FOR SELECT USING (is_active = true);

-- Allow authenticated users to view all machines
DROP POLICY IF EXISTS "Authenticated users view all machines" ON fingerprint_machines;
CREATE POLICY "Authenticated users view all machines" ON fingerprint_machines
  FOR SELECT TO authenticated USING (true);

-- Allow admin full access to machines
DROP POLICY IF EXISTS "Admins can manage machines" ON fingerprint_machines;
CREATE POLICY "Admins can manage machines" ON fingerprint_machines
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Allow reading entries for public & authenticated
DROP POLICY IF EXISTS "Fingerprint entries viewable by everyone" ON fingerprint_machine_entries;
CREATE POLICY "Fingerprint entries viewable by everyone" ON fingerprint_machine_entries
  FOR SELECT USING (true);

-- Allow admin to manage entries
DROP POLICY IF EXISTS "Admins can manage fingerprint entries" ON fingerprint_machine_entries;
CREATE POLICY "Admins can manage fingerprint entries" ON fingerprint_machine_entries
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Ensure public viewable for fingerprints
DROP POLICY IF EXISTS "Fingerprints viewable by everyone" ON fingerprints;
CREATE POLICY "Fingerprints viewable by everyone" ON fingerprints
  FOR SELECT USING (true);
