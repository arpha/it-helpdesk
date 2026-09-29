"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type CreateFingerprintInput = {
    name: string;
    user_id?: string | null;
    finger_picu?: string | null;
    finger_vk?: string | null;
    finger_neo1?: string | null;
    finger_neo2?: string | null;
    finger_absensi?: string | null;
    machine_entries?: Record<string, string>; // machineCode or machineId -> finger_id
};

export type UpdateFingerprintInput = {
    id: string;
    name?: string;
    user_id?: string | null;
    finger_picu?: string | null;
    finger_vk?: string | null;
    finger_neo1?: string | null;
    finger_neo2?: string | null;
    finger_absensi?: string | null;
    machine_entries?: Record<string, string>;
};

export type ActionResult = {
    success: boolean;
    error?: string;
};

export async function createFingerprint(input: CreateFingerprintInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        if (!input.name || !input.name.trim()) {
            return {
                success: false,
                error: "Nama Lengkap wajib diisi.",
            };
        }

        // If user_id is provided, check if user already has fingerprint data
        if (input.user_id) {
            const { data: existing } = await supabase
                .from("fingerprints")
                .select("id")
                .eq("user_id", input.user_id)
                .maybeSingle();

            if (existing) {
                return {
                    success: false,
                    error: "Akun user ini sudah terhubung dengan data fingerprint lain. Silakan pilih user lain atau edit data yang ada.",
                };
            }
        }

        // Extract machine entries
        const entries = input.machine_entries || {};
        const picuVal = entries["picu"] || input.finger_picu || null;
        const vkVal = entries["vk"] || input.finger_vk || null;
        const neo1Val = entries["neo1"] || input.finger_neo1 || null;
        const neo2Val = entries["neo2"] || input.finger_neo2 || null;
        const absensiVal = entries["absensi"] || input.finger_absensi || null;

        const insertPayload: Record<string, unknown> = {
            name: input.name.trim(),
            user_id: input.user_id || null,
            finger_picu: picuVal,
            finger_vk: vkVal,
            finger_neo1: neo1Val,
            finger_neo2: neo2Val,
            finger_absensi: absensiVal,
        };

        const { data: inserted, error } = await supabase
            .from("fingerprints")
            .insert(insertPayload)
            .select("id")
            .single();

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        // If machine entries table exists, sync them
        if (inserted && Object.keys(entries).length > 0) {
            await syncMachineEntries(supabase, inserted.id, entries);
        }

        revalidatePath("/master/fingerprints");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Terjadi kesalahan sistem",
        };
    }
}

export async function updateFingerprint(input: UpdateFingerprintInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // If user_id is provided, verify it's not used by someone else
        if (input.user_id) {
            const { data: existing } = await supabase
                .from("fingerprints")
                .select("id")
                .eq("user_id", input.user_id)
                .neq("id", input.id)
                .maybeSingle();

            if (existing) {
                return {
                    success: false,
                    error: "Akun user ini sudah terhubung dengan data fingerprint lain.",
                };
            }
        }

        const entries = input.machine_entries || {};
        const picuVal = entries["picu"] !== undefined ? entries["picu"] || null : input.finger_picu || null;
        const vkVal = entries["vk"] !== undefined ? entries["vk"] || null : input.finger_vk || null;
        const neo1Val = entries["neo1"] !== undefined ? entries["neo1"] || null : input.finger_neo1 || null;
        const neo2Val = entries["neo2"] !== undefined ? entries["neo2"] || null : input.finger_neo2 || null;
        const absensiVal = entries["absensi"] !== undefined ? entries["absensi"] || null : input.finger_absensi || null;

        const updatePayload: Record<string, unknown> = {
            finger_picu: picuVal,
            finger_vk: vkVal,
            finger_neo1: neo1Val,
            finger_neo2: neo2Val,
            finger_absensi: absensiVal,
            updated_at: new Date().toISOString(),
        };

        if (input.name && input.name.trim()) {
            updatePayload.name = input.name.trim();
        }

        if (input.user_id !== undefined) {
            updatePayload.user_id = input.user_id || null;
        }

        const { error } = await supabase
            .from("fingerprints")
            .update(updatePayload)
            .eq("id", input.id);

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        // Sync machine entries
        if (input.machine_entries) {
            await syncMachineEntries(supabase, input.id, input.machine_entries);
        }

        revalidatePath("/master/fingerprints");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Terjadi kesalahan sistem",
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
            error: error instanceof Error ? error.message : "Terjadi kesalahan sistem",
        };
    }
}

// Helper function to sync entries to fingerprint_machine_entries if table exists
async function syncMachineEntries(
    supabase: ReturnType<typeof createAdminClient>,
    fingerprintId: string,
    entries: Record<string, string>
) {
    try {
        // Fetch machine mapping
        const { data: machines } = await supabase
            .from("fingerprint_machines")
            .select("id, code");

        if (!machines || machines.length === 0) return;

        const machineCodeToId = new Map<string, string>();
        const machineIdToId = new Set<string>();

        machines.forEach((m) => {
            machineCodeToId.set(m.code, m.id);
            machineIdToId.add(m.id);
        });

        for (const [key, rawVal] of Object.entries(entries)) {
            const val = (rawVal || "").trim();
            const machineId = machineCodeToId.get(key) || (machineIdToId.has(key) ? key : null);
            if (!machineId) continue;

            if (val) {
                // Upsert entry
                await supabase
                    .from("fingerprint_machine_entries")
                    .upsert(
                        {
                            fingerprint_id: fingerprintId,
                            machine_id: machineId,
                            finger_id: val,
                            updated_at: new Date().toISOString(),
                        },
                        { onConflict: "fingerprint_id,machine_id" }
                    );
            } else {
                // Remove entry if cleared
                await supabase
                    .from("fingerprint_machine_entries")
                    .delete()
                    .eq("fingerprint_id", fingerprintId)
                    .eq("machine_id", machineId);
            }
        }
    } catch (err) {
        console.warn("syncMachineEntries silent notice:", err);
    }
}
