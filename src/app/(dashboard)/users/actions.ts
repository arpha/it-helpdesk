"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type CreateUserInput = {
    email: string;
    password: string;
    username: string;
    full_name: string;
    role: "admin" | "user" | "staff_it" | "manager_it";
    department_id?: string | null;
    avatar_url?: string | null;
};

type UpdateUserInput = {
    id: string;
    username?: string;
    full_name: string;
    role: "admin" | "user" | "staff_it" | "manager_it";
    department_id?: string | null;
    avatar_url?: string | null;
};

type ActionResult = {
    success: boolean;
    error?: string;
    url?: string;
};

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const file = formData.get("file") as File;
        const userId = formData.get("userId") as string;

        if (!file) {
            return { success: false, error: "No file provided" };
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${userId || Date.now()}.${fileExt}`;
        const filePath = `users/${fileName}`;

        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from("images")
            .upload(filePath, file, {
                upsert: true,
                contentType: file.type,
            });

        if (uploadError) {
            return { success: false, error: uploadError.message };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
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

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // Create user in auth.users
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: input.email,
            password: input.password,
            email_confirm: true,
            user_metadata: {
                full_name: input.full_name,
            },
        });

        if (authError) {
            return {
                success: false,
                error: authError.message,
            };
        }

        if (!authData.user) {
            return {
                success: false,
                error: "Failed to create user",
            };
        }

        // Wait a moment for the trigger to create the profile
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Update profile with additional data
        const { error: profileError } = await supabase
            .from("profiles")
            .update({
                username: input.username.toLowerCase().replace(/\s/g, '.'),
                full_name: input.full_name,
                role: input.role,
                department_id: input.department_id || null,
                avatar_url: input.avatar_url || null,
            })
            .eq("id", authData.user.id);

        if (profileError) {
            return {
                success: false,
                error: profileError.message,
            };
        }

        revalidatePath("/users");

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

export async function updateUser(input: UpdateUserInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const updateData: Record<string, unknown> = {
            full_name: input.full_name,
            role: input.role,
            department_id: input.department_id || null,
        };

        // Only update username if provided
        if (input.username) {
            updateData.username = input.username.toLowerCase().replace(/\s/g, '.');
        }

        // Only update avatar_url if provided
        if (input.avatar_url !== undefined) {
            updateData.avatar_url = input.avatar_url || null;
        }

        const { error } = await supabase
            .from("profiles")
            .update(updateData)
            .eq("id", input.id);

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        revalidatePath("/users");

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

export async function deleteUser(userId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // Get user profile to check for avatar
        const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", userId)
            .single();

        // Delete avatar from storage if exists
        if (profile?.avatar_url) {
            // Extract file path from URL (format: .../users/filename.ext)
            const urlParts = profile.avatar_url.split("/");
            const fileName = urlParts[urlParts.length - 1];
            const filePath = `users/${fileName}`;

            await supabase.storage.from("images").remove([filePath]);
        }

        // Delete user from auth
        const { error } = await supabase.auth.admin.deleteUser(userId);

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        revalidatePath("/users");

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
