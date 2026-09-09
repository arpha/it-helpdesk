-- =============================================
-- USER CUSTOM VOICES MIGRATION
-- Add columns for custom voice cloning to profiles table
-- Create voice-samples storage bucket
-- =============================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS voice_sample_url TEXT,
ADD COLUMN IF NOT EXISTS voice_sample_name TEXT,
ADD COLUMN IF NOT EXISTS voice_model_provider TEXT DEFAULT 'huggingface';

-- Create Storage bucket for voice samples if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-samples', 'voice-samples', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy for storage
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Voice Samples' AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Public Access Voice Samples" ON storage.objects
        FOR SELECT TO public USING (bucket_id = 'voice-samples');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Upload Voice Samples' AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Authenticated Upload Voice Samples" ON storage.objects
        FOR INSERT TO authenticated WITH CHECK (bucket_id = 'voice-samples');
    END IF;
END $$;
