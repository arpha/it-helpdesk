-- Add barcode_status to assets table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'barcode_status_type') THEN
        CREATE TYPE barcode_status_type AS ENUM ('not_printed', 'printed', 'installed');
    END IF;
END $$;

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS barcode_status barcode_status_type DEFAULT 'not_printed';
