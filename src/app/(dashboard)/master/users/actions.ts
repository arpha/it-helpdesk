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
            console.error("Auth error creating user:", authError);
            return {
                success: false,
                error: `Auth error: ${authError.message} (status: ${authError.status})`,
            };
        }

        if (!authData.user) {
            return {
                success: false,
                error: "Failed to create user - no user returned",
            };
        }

        // Wait a moment for the trigger to create the profile
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Use upsert to handle both cases: trigger success or failure
        const { error: profileError } = await supabase
            .from("profiles")
            .upsert({
                id: authData.user.id,
                username: input.username.toLowerCase().replace(/\s/g, '.'),
                full_name: input.full_name,
                role: input.role,
                department_id: input.department_id || null,
                avatar_url: input.avatar_url || null,
            }, {
                onConflict: 'id'
            });

        if (profileError) {
            console.error("Profile error:", profileError);
            return {
                success: false,
                error: `Profile error: ${profileError.message} (code: ${profileError.code})`,
            };
        }

        revalidatePath("/master/users");

        return {
            success: true,
        };
    } catch (error: unknown) {
        console.error("Unexpected error creating user:", error);
        let errorMsg = "Unknown error occurred";
        if (error instanceof Error) {
            errorMsg = error.message;
        } else if (typeof error === 'object' && error !== null) {
            errorMsg = JSON.stringify(error);
        } else if (typeof error === 'string') {
            errorMsg = error;
        }
        return {
            success: false,
            error: errorMsg,
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

// Types for bulk import
type ImportUserInput = {
    username: string;
    email: string;
    password: string;
    full_name: string;
    role?: string;
    department_name?: string;
};

type ImportUserDetail = {
    username: string;
    email: string;
    full_name: string;
    status: "success" | "failed";
    error?: string;
};

export type BulkImportUsersResult = {
    success: boolean;
    imported: number;
    failed: number;
    errors: string[];
    details: ImportUserDetail[];
};

export async function bulkImportUsers(items: ImportUserInput[]): Promise<BulkImportUsersResult> {
    const supabase = createAdminClient();
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];
    const details: ImportUserDetail[] = [];

    // Get departments mapping
    const { data: departments } = await supabase.from("departments").select("id, name");
    const deptMap = new Map(departments?.map(d => [d.name.toLowerCase(), d.id]) || []);

    for (const item of items) {
        const detail: ImportUserDetail = {
            username: item.username || "",
            email: item.email || "",
            full_name: item.full_name || "",
            status: "success",
        };

        try {
            // Validate required fields
            if (!item.username || !item.email || !item.password || !item.full_name) {
                detail.status = "failed";
                detail.error = "Missing required fields (username, email, password, full_name)";
                errors.push(`${item.email || item.username || "Unknown"}: ${detail.error}`);
                failed++;
                details.push(detail);
                continue;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(item.email)) {
                detail.status = "failed";
                detail.error = "Invalid email format";
                errors.push(`${item.email}: ${detail.error}`);
                failed++;
                details.push(detail);
                continue;
            }

            // Validate password length
            if (item.password.length < 6) {
                detail.status = "failed";
                detail.error = "Password must be at least 6 characters";
                errors.push(`${item.email}: ${detail.error}`);
                failed++;
                details.push(detail);
                continue;
            }

            // Determine role
            const validRoles = ["admin", "user", "staff_it", "manager_it"];
            const role = validRoles.includes(item.role?.toLowerCase() || "")
                ? item.role!.toLowerCase() as "admin" | "user" | "staff_it" | "manager_it"
                : "user";

            // Find department
            const departmentId = item.department_name
                ? deptMap.get(item.department_name.toLowerCase()) || null
                : null;

            // Create user in auth.users
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: item.email,
                password: item.password,
                email_confirm: true,
                user_metadata: {
                    full_name: item.full_name,
                },
            });

            if (authError) {
                detail.status = "failed";
                // Map common auth errors to Indonesian
                let errorMsg = authError.message;
                if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
                    errorMsg = "Email sudah terdaftar";
                } else if (authError.message.includes("password")) {
                    errorMsg = "Password tidak valid (min 6 karakter)";
                }
                detail.error = errorMsg;
                errors.push(`${item.email}: ${errorMsg}`);
                failed++;
                details.push(detail);
                continue;
            }

            if (!authData.user) {
                detail.status = "failed";
                detail.error = "Gagal membuat user";
                errors.push(`${item.email}: Gagal membuat user`);
                failed++;
                details.push(detail);
                continue;
            }

            // Wait for trigger to create profile (or it might fail)
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Use upsert to handle both cases: trigger success or failure
            const { error: profileError } = await supabase
                .from("profiles")
                .upsert({
                    id: authData.user.id,
                    username: item.username.toLowerCase().replace(/\s/g, '.'),
                    full_name: item.full_name,
                    role: role,
                    department_id: departmentId,
                }, {
                    onConflict: 'id'
                });

            if (profileError) {
                detail.status = "failed";
                detail.error = `Profile error: ${profileError.message} (code: ${profileError.code})`;
                errors.push(`${item.email}: ${profileError.message}`);
                failed++;
            } else {
                imported++;
            }
        } catch (error: unknown) {
            detail.status = "failed";
            // Capture all possible error information
            let errorMsg = "Unknown error";
            if (error instanceof Error) {
                errorMsg = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMsg = JSON.stringify(error);
            } else if (typeof error === 'string') {
                errorMsg = error;
            }
            detail.error = errorMsg;
            errors.push(`${item.email || item.username || "Unknown"}: ${errorMsg}`);
            console.error(`Import error for ${item.email}:`, error);
            failed++;
        }

        details.push(detail);
    }

    revalidatePath("/users");

    return {
        success: failed === 0,
        imported,
        failed,
        errors,
        details,
    };
}
