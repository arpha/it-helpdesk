-- Migration for Recurring Report Schedules (Jadwal Laporan Rutin: Bulanan, Triwulanan, Tahunan)
-- Aman: hanya menambah tabel baru & 2 kolom opsional pada reports, tidak menghapus data apa pun

CREATE TABLE IF NOT EXISTS public.report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_template TEXT NOT NULL,
    report_number_prefix TEXT,
    category_id UUID REFERENCES public.report_categories(id) ON DELETE SET NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    -- Pengaturan frekuensi & deadline
    frequency TEXT NOT NULL DEFAULT 'monthly'
        CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
    deadline_rule TEXT NOT NULL DEFAULT 'fixed_day'
        CHECK (deadline_rule IN ('fixed_day', 'end_of_period', 'next_month_day')),
    deadline_day INTEGER NOT NULL DEFAULT 25
        CHECK (deadline_day >= 1 AND deadline_day <= 31),
    deadline_month INTEGER DEFAULT 12
        CHECK (deadline_month IS NULL OR (deadline_month >= 1 AND deadline_month <= 12)),
    generate_days_before INTEGER NOT NULL DEFAULT 14
        CHECK (generate_days_before >= 0 AND generate_days_before <= 90),

    is_active BOOLEAN NOT NULL DEFAULT true,
    last_generated_period TEXT,
    last_generated_at TIMESTAMP WITH TIME ZONE,

    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_is_active ON public.report_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_report_schedules_frequency ON public.report_schedules(frequency);
CREATE INDEX IF NOT EXISTS idx_report_schedules_assigned_to ON public.report_schedules(assigned_to);

-- Tambahkan referensi jadwal & kunci periode ke tabel reports untuk mencegah duplikasi
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.report_schedules(id) ON DELETE SET NULL;

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS period_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_schedule_period_unique
    ON public.reports(schedule_id, period_key)
    WHERE schedule_id IS NOT NULL AND period_key IS NOT NULL;

-- Row Level Security (RLS)
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

-- Semua role (termasuk user) boleh melihat, membuat, dan mengubah jadwal rutin
DROP POLICY IF EXISTS "report_schedules_select" ON public.report_schedules;
CREATE POLICY "report_schedules_select" ON public.report_schedules
    FOR SELECT TO authenticated USING (
        auth.uid() IN (SELECT id FROM public.profiles)
    );

DROP POLICY IF EXISTS "report_schedules_insert" ON public.report_schedules;
CREATE POLICY "report_schedules_insert" ON public.report_schedules
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() IN (SELECT id FROM public.profiles)
    );

DROP POLICY IF EXISTS "report_schedules_update" ON public.report_schedules;
CREATE POLICY "report_schedules_update" ON public.report_schedules
    FOR UPDATE TO authenticated USING (
        auth.uid() IN (SELECT id FROM public.profiles)
    );

-- Hanya admin dan manager_it yang boleh menghapus jadwal rutin
DROP POLICY IF EXISTS "report_schedules_delete" ON public.report_schedules;
CREATE POLICY "report_schedules_delete" ON public.report_schedules
    FOR DELETE TO authenticated USING (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE role IN ('admin', 'manager_it')
        )
    );
