-- WhatsApp ATK Integration Schema Changes
-- Run this after the main atk_schema.sql

-- Add WhatsApp phone to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20);

-- Add source column to atk_requests table
ALTER TABLE atk_requests ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'web';

-- Create index for faster phone lookup
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_phone ON profiles(whatsapp_phone);

-- Comment for documentation
COMMENT ON COLUMN profiles.whatsapp_phone IS 'User WhatsApp phone number for ATK request via WhatsApp';
COMMENT ON COLUMN atk_requests.source IS 'Request source: web or whatsapp';
