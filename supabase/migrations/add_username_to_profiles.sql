-- Add username column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Update existing users with auto-generated username from full_name
-- Format: lowercase, replace spaces with dots
UPDATE profiles 
SET username = LOWER(REPLACE(full_name, ' ', '.'))
WHERE username IS NULL;

-- Handle duplicate usernames by appending a number
DO $$
DECLARE
    dup_record RECORD;
    counter INT;
    new_username VARCHAR(50);
BEGIN
    FOR dup_record IN 
        SELECT id, username 
        FROM profiles 
        WHERE username IN (
            SELECT username FROM profiles GROUP BY username HAVING COUNT(*) > 1
        )
        ORDER BY created_at
    LOOP
        SELECT COUNT(*) INTO counter 
        FROM profiles 
        WHERE username LIKE dup_record.username || '%' 
        AND id != dup_record.id;
        
        IF counter > 0 THEN
            new_username := dup_record.username || counter::TEXT;
            UPDATE profiles SET username = new_username WHERE id = dup_record.id;
        END IF;
    END LOOP;
END $$;

-- Make username NOT NULL after populating existing data
ALTER TABLE profiles ALTER COLUMN username SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
