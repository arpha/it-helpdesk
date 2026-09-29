"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { DEFAULT_MACHINES, type FingerprintMachine } from "@/types/fingerprint";

export type MachineActionResult = {
    success: boolean;
    data?: FingerprintMachine | FingerprintMachine[];
    error?: string;
    isTableMissing?: boolean;
};

export async function getFingerprintMachines(): Promise<{ machines: FingerprintMachine[]; isTableMissing: boolean }> {
    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from("fingerprint_machines")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) {
            console.warn("fingerprint_machines query failed, falling back to defaults:", error.message);
            return { machines: DEFAULT_MACHINES, isTableMissing: true };
        }

        if (!data || data.length === 0) {
            // Seed defaults into database if table exists but empty
            return { machines: DEFAULT_MACHINES, isTableMissing: false };
        }

        return { machines: data as FingerprintMachine[], isTableMissing: false };
    } catch (err) {
        console.error("Error fetching machines:", err);
        return { machines: DEFAULT_MACHINES, isTableMissing: true };
    }
}

export async function createFingerprintMachine(input: {
    name: string;
    code: string;
    location?: string | null;
}): Promise<MachineActionResult> {
    try {
        const supabase = createAdminClient();
        const cleanCode = input.code
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "-")
            .replace(/-+/g, "-");

        if (!cleanCode) {
            return { success: false, error: "Kode / slug mesin tidak valid" };
        }

        const { data, error } = await supabase
            .from("fingerprint_machines")
            .insert({
                name: input.name.trim(),
                code: cleanCode,
                location: input.location?.trim() || null,
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                return { success: false, error: `Kode mesin '${cleanCode}' sudah digunakan.` };
            }
            return { success: false, error: error.message };
        }

        revalidatePath("/master/fingerprints");
        return { success: true, data: data as FingerprintMachine };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Terjadi kesalahan sistem",
        };
    }
}

export async function updateFingerprintMachine(input: {
    id: string;
    name: string;
    code?: string;
    location?: string | null;
    is_active?: boolean;
}): Promise<MachineActionResult> {
    try {
        const supabase = createAdminClient();
        const updatePayload: Record<string, unknown> = {
            name: input.name.trim(),
            location: input.location?.trim() || null,
            updated_at: new Date().toISOString(),
        };

        if (input.code) {
            updatePayload.code = input.code
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, "-")
                .replace(/-+/g, "-");
        }

        if (typeof input.is_active === "boolean") {
            updatePayload.is_active = input.is_active;
        }

        const { data, error } = await supabase
            .from("fingerprint_machines")
            .update(updatePayload)
            .eq("id", input.id)
            .select()
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/master/fingerprints");
        return { success: true, data: data as FingerprintMachine };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Terjadi kesalahan sistem",
        };
    }
}

export async function deleteFingerprintMachine(id: string): Promise<MachineActionResult> {
    try {
        const supabase = createAdminClient();
        const { error } = await supabase
            .from("fingerprint_machines")
            .delete()
            .eq("id", id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/master/fingerprints");
        return { success: true };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Terjadi kesalahan sistem",
        };
    }
}
