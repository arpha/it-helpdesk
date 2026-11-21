-- Migration for Inventaris Laporan (Report Inventory)
-- Tujuan: Menginventarisir semua laporan agar tidak tercecer dan tepat waktu
-- Mendukung audit trail lengkap untuk keamanan (termasuk edit oleh semua role)

-- 1. Tabel Kategori Laporan
CREATE TABLE IF NOT EXISTS public.report_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT NOT NULL DEFAULT 'blue',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed kategori awal
INSERT INTO public.report_categories (name, description, color) VALUES
    ('Laporan Bulanan IT', 'Laporan rutin bulanan unit IT', 'blue'),
    ('Laporan Aset', 'Laporan terkait inventaris aset IT', 'green'),
    ('Laporan Insiden', 'Laporan insiden & gangguan sistem', 'red'),
    ('Laporan Pemeliharaan', 'Laporan pemeliharaan berkala', 'orange'),
    ('Laporan Keuangan IT', 'Laporan anggaran & pengeluaran IT', 'purple'),
    ('Laporan Helpdesk', 'Rekapitulasi tiket helpdesk', 'cyan'),
    ('Laporan Umum', 'Laporan lainnya', 'gray')
ON CONFLICT (name) DO NOTHING;

-- 2. Tabel Laporan
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    report_number TEXT,
    category_id UUID REFERENCES public.report_categories(id) ON DELETE SET NULL,
    description TEXT,

    -- Periode pelaporan
    period_type TEXT NOT NULL DEFAULT 'monthly'
        CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'incidental')),
    period_start DATE,
    period_end DATE,

    -- Deadline & waktu
    deadline DATE NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'draft', 'submitted', 'review', 'revision', 'approved', 'rejected', 'overdue')),
    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    -- Penugasan (mengacu ke public.profiles agar PostgREST dapat join langsung)
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    -- File lampiran
    file_url TEXT,
    file_name TEXT,
    file_size BIGINT DEFAULT 0,
    file_type TEXT,

    -- Catatan
    reviewer_notes TEXT,
    revision_notes TEXT,

    -- Metadata
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes untuk performa query
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_deadline ON public.reports(deadline);
CREATE INDEX IF NOT EXISTS idx_reports_assigned_to ON public.reports(assigned_to);
CREATE INDEX IF NOT EXISTS idx_reports_category_id ON public.reports(category_id);
CREATE INDEX IF NOT EXISTS idx_reports_period_type ON public.reports(period_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON public.reports(created_by);

-- 3. Tabel Audit Trail Laporan (Wajib untuk keamanan)
CREATE TABLE IF NOT EXISTS public.report_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    action TEXT NOT NULL
        CHECK (action IN (
            'created',
            'updated',
            'submitted',
            'reviewed',
            'approved',
            'rejected',
            'revision_requested',
            'deleted',
            'file_uploaded',
            'file_replaced'
        )),
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    changes JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_logs_report_id ON public.report_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_report_logs_performed_by ON public.report_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_report_logs_action ON public.report_logs(action);
CREATE INDEX IF NOT EXISTS idx_report_logs_created_at ON public.report_logs(created_at DESC);

-- ----------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------

-- Enable RLS
ALTER TABLE public.report_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_logs ENABLE ROW LEVEL SECURITY;

-- Policies untuk report_categories
DROP POLICY IF EXISTS "report_categories_select" ON public.report_categories;
CREATE POLICY "report_categories_select" ON public.report_categories
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "report_categories_manage" ON public.report_categories;
CREATE POLICY "report_categories_manage" ON public.report_categories
    FOR ALL TO authenticated USING (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE role IN ('admin', 'manager_it')
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE role IN ('admin', 'manager_it')
        )
    );

-- Policies untuk reports
-- Semua role yang terdaftar di profiles dapat melihat, membuat, dan mengedit (perubahan wajib dicatat ke report_logs)
DROP POLICY IF EXISTS "reports_select" ON public.reports;
CREATE POLICY "reports_select" ON public.reports
    FOR SELECT TO authenticated USING (
        auth.uid() IN (SELECT id FROM public.profiles)
    );

DROP POLICY IF EXISTS "reports_insert" ON public.reports;
CREATE POLICY "reports_insert" ON public.reports
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() IN (SELECT id FROM public.profiles)
    );

DROP POLICY IF EXISTS "reports_update" ON public.reports;
CREATE POLICY "reports_update" ON public.reports
    FOR UPDATE TO authenticated USING (
        auth.uid() IN (SELECT id FROM public.profiles)
    );

-- Hanya admin dan manager_it yang boleh menghapus laporan
DROP POLICY IF EXISTS "reports_delete" ON public.reports;
CREATE POLICY "reports_delete" ON public.reports
    FOR DELETE TO authenticated USING (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE role IN ('admin', 'manager_it')
        )
    );

-- Policies untuk report_logs (immutable: hanya SELECT dan INSERT untuk audit keamanan)
DROP POLICY IF EXISTS "report_logs_select" ON public.report_logs;
CREATE POLICY "report_logs_select" ON public.report_logs
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "report_logs_insert" ON public.report_logs;
CREATE POLICY "report_logs_insert" ON public.report_logs
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() IN (SELECT id FROM public.profiles)
    );

-- ----------------------------------------------------
-- STORAGE BUCKET CONFIGURATION & POLICIES
-- ----------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "reports_storage_select" ON storage.objects;
CREATE POLICY "reports_storage_select" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'reports');

DROP POLICY IF EXISTS "reports_storage_insert" ON storage.objects;
CREATE POLICY "reports_storage_insert" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reports');

DROP POLICY IF EXISTS "reports_storage_update" ON storage.objects;
CREATE POLICY "reports_storage_update" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'reports');

DROP POLICY IF EXISTS "reports_storage_delete" ON storage.objects;
CREATE POLICY "reports_storage_delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'reports');

-- ----------------------------------------------------
-- REALTIME PUBLICATION (untuk sidebar badge)
-- ----------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'reports'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
        END IF;
    END IF;
END $$;
