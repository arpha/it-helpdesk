"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type CreateFingerprintInput = {
    user_id: string;
    finger_picu?: string | null;
    finger_vk?: string | null;
    finger_neo1?: string | null;
    finger_neo2?: string | null;
    finger_absensi?: string | null;
};

type UpdateFingerprintInput = {
    id: string;
    finger_picu?: string | null;
    finger_vk?: string | null;
    finger_neo1?: string | null;
    finger_neo2?: string | null;
    finger_absensi?: string | null;
};

type ActionResult = {
    success: boolean;
    error?: string;
};

export async function createFingerprint(input: CreateFingerprintInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // Check if user already has fingerprint data
        const { data: existing } = await supabase
            .from("fingerprints")
            .select("id")
            .eq("user_id", input.user_id)
            .single();

        if (existing) {
            return {
                success: false,
                error: "User sudah memiliki data fingerprint. Silakan edit data yang ada.",
            };
        }

        const { error } = await supabase
            .from("fingerprints")
            .insert({
                user_id: input.user_id,
                finger_picu: input.finger_picu || null,
                finger_vk: input.finger_vk || null,
                finger_neo1: input.finger_neo1 || null,
                finger_neo2: input.finger_neo2 || null,
                finger_absensi: input.finger_absensi || null,
            });

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        revalidatePath("/master/fingerprints");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}

export async function updateFingerprint(input: UpdateFingerprintInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("fingerprints")
            .update({
                finger_picu: input.finger_picu || null,
                finger_vk: input.finger_vk || null,
                finger_neo1: input.finger_neo1 || null,
                finger_neo2: input.finger_neo2 || null,
                finger_absensi: input.finger_absensi || null,
            })
            .eq("id", input.id);

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        revalidatePath("/master/fingerprints");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}

export async function deleteFingerprint(id: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("fingerprints")
            .delete()
            .eq("id", id);

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        revalidatePath("/master/fingerprints");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}
