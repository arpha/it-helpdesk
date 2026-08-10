-- Migration for Server Room Logbook
CREATE TABLE IF NOT EXISTS public.server_room_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_name VARCHAR(255) NOT NULL,
    visitor_type VARCHAR(50) NOT NULL DEFAULT 'internal_it',
    company_or_unit VARCHAR(255),
    purpose TEXT NOT NULL,
    temperature NUMERIC(4, 1), -- Suhu Ruang Server (°C) opsional
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    check_out_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'completed'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.server_room_logs ENABLE ROW LEVEL SECURITY;

-- Policies for public and authenticated access
DROP POLICY IF EXISTS "Enable read access for all" ON public.server_room_logs;
CREATE POLICY "Enable read access for all" ON public.server_room_logs
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all (public check-in)" ON public.server_room_logs;
CREATE POLICY "Enable insert for all (public check-in)" ON public.server_room_logs
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all (public check-out)" ON public.server_room_logs;
CREATE POLICY "Enable update for all (public check-out)" ON public.server_room_logs
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated staff" ON public.server_room_logs;
CREATE POLICY "Enable delete for authenticated staff" ON public.server_room_logs
    FOR DELETE TO authenticated USING (true);
