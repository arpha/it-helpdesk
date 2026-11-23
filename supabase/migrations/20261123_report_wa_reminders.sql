-- Migration for WhatsApp Deadline Reminder Logs (Inventaris Laporan)
-- Aman: hanya membuat tabel baru untuk tracking pengingat WA agar tidak mengirim duplikat

CREATE TABLE IF NOT EXISTS public.report_reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL
        CHECK (reminder_type IN ('h_minus_7', 'h_minus_3', 'overdue', 'manual')),
    deadline_snapshot DATE NOT NULL,
    sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recipient_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'failed')),
    provider_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_reminder_logs_report_id
    ON public.report_reminder_logs(report_id);

CREATE INDEX IF NOT EXISTS idx_report_reminder_logs_lookup
    ON public.report_reminder_logs(report_id, reminder_type, deadline_snapshot, sent_date);

-- Enable RLS
ALTER TABLE public.report_reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_reminder_logs_select" ON public.report_reminder_logs;
CREATE POLICY "report_reminder_logs_select" ON public.report_reminder_logs
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "report_reminder_logs_insert" ON public.report_reminder_logs;
CREATE POLICY "report_reminder_logs_insert" ON public.report_reminder_logs
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE role IN ('admin', 'manager_it')
        )
    );
