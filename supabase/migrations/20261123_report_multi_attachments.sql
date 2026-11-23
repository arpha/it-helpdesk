-- Migration for Multi-File Attachments on Inventaris Laporan
-- Aman: hanya menambah kolom JSONB baru & menyalin referensi file lama tanpa menghapus data

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb NOT NULL;

-- Backfill otomatis untuk laporan yang sudah memiliki file_url sebelum migrasi ini
UPDATE public.reports
SET attachments = jsonb_build_array(
    jsonb_build_object(
        'url', file_url,
        'name', COALESCE(file_name, 'Lampiran'),
        'size', COALESCE(file_size, 0),
        'type', file_type,
        'uploaded_at', updated_at
    )
)
WHERE file_url IS NOT NULL
  AND file_url <> ''
  AND (attachments IS NULL OR jsonb_array_length(attachments) = 0);
