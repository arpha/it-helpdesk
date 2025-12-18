"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

type UpdateProfileInput = {
    full_name: string;
    avatar_url?: string;
    whatsapp_phone?: string;
};

type UpdateProfileResult = {
    success: boolean;
    error?: string;
    url?: string;
};

export async function uploadProfileAvatar(formData: FormData): Promise<UpdateProfileResult> {
    try {
        const supabase = await createClient();
        const adminClient = createAdminClient();

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: "User not authenticated" };
        }

        const file = formData.get("file") as File;

        if (!file) {
            return { success: false, error: "No file provided" };
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}.${fileExt}`;
        const filePath = `users/${fileName}`;

        // Upload file to Supabase Storage using admin client
        const { error: uploadError } = await adminClient.storage
            .from("images")
            .upload(filePath, file, {
                upsert: true,
                contentType: file.type,
            });

        if (uploadError) {
            return { success: false, error: uploadError.message };
        }

        // Get public URL
        const { data: urlData } = adminClient.storage
            .from("images")
            .getPublicUrl(filePath);

        return { success: true, url: urlData.publicUrl };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Upload failed",
        };
    }
}

export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return {
                success: false,
                error: "User not authenticated",
            };
        }

        const updateData: Record<string, string> = {
            full_name: input.full_name,
        };

        if (input.avatar_url) {
            updateData.avatar_url = input.avatar_url;
        }

        if (input.whatsapp_phone !== undefined) {
            updateData.whatsapp_phone = input.whatsapp_phone;
        }

        const { error } = await supabase
            .from("profiles")
            .update(updateData)
            .eq("id", user.id);

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        // Update cookie with new profile data
        const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (profile) {
            const cookieStore = await cookies();
            cookieStore.set("user_profile", JSON.stringify(profile), {
                httpOnly: true,
                path: "/",
                sameSite: "lax",
                maxAge: 60 * 60 * 24 * 365,
            });
        }

        revalidatePath("/settings/profile");
        revalidatePath("/", "layout");

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}
