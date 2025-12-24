-- Fix the handle_new_user trigger to include username
-- This trigger runs automatically when a new user is created in auth.users

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Update the function to include username generation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_username VARCHAR(50);
    base_username VARCHAR(50);
    counter INT := 0;
BEGIN
    -- Generate base username from email or full_name
    IF NEW.raw_user_meta_data->>'full_name' IS NOT NULL THEN
        base_username := LOWER(REPLACE(NEW.raw_user_meta_data->>'full_name', ' ', '.'));
    ELSE
        base_username := SPLIT_PART(NEW.email, '@', 1);
    END IF;
    
    -- Ensure username is unique by appending counter if needed
    new_username := base_username;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
        counter := counter + 1;
        new_username := base_username || counter::TEXT;
    END LOOP;
    
    INSERT INTO public.profiles (id, full_name, email, role, username)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        'user',
        new_username
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
