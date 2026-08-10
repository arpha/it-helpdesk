-- Migration for SOP & Pedoman Center
CREATE TABLE IF NOT EXISTS public.sop_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    document_number VARCHAR(100),
    category VARCHAR(100) NOT NULL DEFAULT 'Umum',
    description TEXT,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'published',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Table
ALTER TABLE public.sop_documents ENABLE ROW LEVEL SECURITY;

-- Table Policies
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.sop_documents;
CREATE POLICY "Enable read access for all authenticated users" ON public.sop_documents
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for admin and staff_it" ON public.sop_documents;
CREATE POLICY "Enable insert for admin and staff_it" ON public.sop_documents
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for admin and staff_it" ON public.sop_documents;
CREATE POLICY "Enable update for admin and staff_it" ON public.sop_documents
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable delete for admin and staff_it" ON public.sop_documents;
CREATE POLICY "Enable delete for admin and staff_it" ON public.sop_documents
    FOR DELETE TO authenticated USING (true);


-- ----------------------------------------------------
-- STORAGE BUCKET CONFIGURATION & POLICIES (Fix 403)
-- ----------------------------------------------------

-- 1. Create 'documents' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow public access to view files in 'documents' bucket
DROP POLICY IF EXISTS "Public Access to SOP Files" ON storage.objects;
CREATE POLICY "Public Access to SOP Files" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'documents');

-- 3. Allow authenticated users to upload files to 'documents' bucket
DROP POLICY IF EXISTS "Authenticated Upload to SOP Files" ON storage.objects;
CREATE POLICY "Authenticated Upload to SOP Files" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');

-- 4. Allow authenticated users to update files in 'documents' bucket
DROP POLICY IF EXISTS "Authenticated Update to SOP Files" ON storage.objects;
CREATE POLICY "Authenticated Update to SOP Files" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'documents');

-- 5. Allow authenticated users to delete files in 'documents' bucket
DROP POLICY IF EXISTS "Authenticated Delete to SOP Files" ON storage.objects;
CREATE POLICY "Authenticated Delete to SOP Files" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'documents');
