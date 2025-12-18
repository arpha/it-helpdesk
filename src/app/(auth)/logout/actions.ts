"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logout() {
    const supabase = await createClient();

    // Sign out from Supabase (clears server-side session)
    await supabase.auth.signOut({ scope: 'global' });

    // Clear all cookies
    const cookieStore = await cookies();

    // Delete user profile cookie
    cookieStore.delete("user_profile");

    // Delete all Supabase auth cookies
    const allCookies = cookieStore.getAll();
    for (const cookie of allCookies) {
        if (cookie.name.includes('sb-') || cookie.name.includes('supabase')) {
            cookieStore.delete(cookie.name);
        }
    }

    revalidatePath("/", "layout");
    redirect("/login");
}
