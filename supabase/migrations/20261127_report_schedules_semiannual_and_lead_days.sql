-- Migration: Support Semiannual (Semester) frequency & extend generate_days_before up to 365 days
-- Aman: hanya melonggarkan CHECK constraint dan memperbarui nilai default generate_days_before, tidak menghapus data apa pun

-- 1. Update CHECK constraint frequency & generate_days_before pada report_schedules
ALTER TABLE public.report_schedules
    DROP CONSTRAINT IF EXISTS report_schedules_frequency_check;

ALTER TABLE public.report_schedules
    ADD CONSTRAINT report_schedules_frequency_check
    CHECK (frequency IN ('monthly', 'quarterly', 'semiannual', 'yearly'));

ALTER TABLE public.report_schedules
    DROP CONSTRAINT IF EXISTS report_schedules_generate_days_before_check;

ALTER TABLE public.report_schedules
    ADD CONSTRAINT report_schedules_generate_days_before_check
    CHECK (generate_days_before >= 0 AND generate_days_before <= 365);

ALTER TABLE public.report_schedules
    ALTER COLUMN generate_days_before SET DEFAULT 28;

-- 2. Update CHECK constraint period_type pada reports agar mendukung 'semiannual'
ALTER TABLE public.reports
    DROP CONSTRAINT IF EXISTS reports_period_type_check;

ALTER TABLE public.reports
    ADD CONSTRAINT reports_period_type_check
    CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'yearly', 'incidental'));

-- 3. Sinkronkan jadwal rutin yang sudah ada ke default H-28 / H-84 / H-168 / H-336
UPDATE public.report_schedules SET generate_days_before = 28  WHERE frequency = 'monthly';
UPDATE public.report_schedules SET generate_days_before = 84  WHERE frequency = 'quarterly';
UPDATE public.report_schedules SET generate_days_before = 168 WHERE frequency = 'semiannual';
UPDATE public.report_schedules SET generate_days_before = 336 WHERE frequency = 'yearly';
