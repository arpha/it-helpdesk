-- Migration for Knowledge Base & AI Deflection Logs
CREATE TABLE IF NOT EXISTS public.knowledge_base_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    category VARCHAR(100) NOT NULL DEFAULT 'Umum',
    content TEXT NOT NULL,
    summary TEXT,
    tags TEXT[] DEFAULT '{}',
    is_published BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    source_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Knowledge Base
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.knowledge_base_articles;
CREATE POLICY "Enable read access for all users" ON public.knowledge_base_articles
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.knowledge_base_articles;
CREATE POLICY "Enable insert for authenticated users" ON public.knowledge_base_articles
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.knowledge_base_articles;
CREATE POLICY "Enable update for authenticated users" ON public.knowledge_base_articles
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.knowledge_base_articles;
CREATE POLICY "Enable delete for authenticated users" ON public.knowledge_base_articles
    FOR DELETE TO authenticated USING (true);


-- Table for AI Deflection Logs
CREATE TABLE IF NOT EXISTS public.ai_deflection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_query TEXT NOT NULL,
    ai_response TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    suggested_article_ids UUID[] DEFAULT '{}',
    created_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Deflection Logs
ALTER TABLE public.ai_deflection_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.ai_deflection_logs;
CREATE POLICY "Enable read access for authenticated users" ON public.ai_deflection_logs
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.ai_deflection_logs;
CREATE POLICY "Enable insert for authenticated users" ON public.ai_deflection_logs
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.ai_deflection_logs;
CREATE POLICY "Enable update for authenticated users" ON public.ai_deflection_logs
    FOR UPDATE TO authenticated USING (true);
