import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { environment } from "@/configs/environment";

/**
 * Admin client that bypasses RLS using service role key
 * Use this only for server-side admin operations
 */
export function createAdminClient() {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = environment;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase admin credentials");
    }

    return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
