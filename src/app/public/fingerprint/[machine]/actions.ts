"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type PublicMachineData = {
    id: string;
    name: string;
    code: string;
    location: string | null;
};

export type PublicFingerprintEntry = {
    id: string;
    name: string;
    finger_id: string;
    created_at?: string;
};

// Machine slug to legacy column fallback map
const SLUG_TO_COLUMN: Record<string, string> = {
    picu: "finger_picu",
    vk: "finger_vk",
    neo1: "finger_neo1",
    neo2: "finger_neo2",
    absensi: "finger_absensi",
};

export async function getPublicMachineInfo(machineSlug: string): Promise<{
    success: boolean;
    machine?: PublicMachineData;
    error?: string;
}> {
    try {
        const supabase = createAdminClient();
        const slug = machineSlug.toLowerCase().trim();

        // 1. Try fetching from fingerprint_machines table
        const { data, error } = await supabase
            .from("fingerprint_machines")
            .select("id, name, code, location")
            .eq("code", slug)
            .eq("is_active", true)
            .maybeSingle();

        if (data) {
            return {
                success: true,
                machine: data as PublicMachineData,
            };
        }

        // Fallback for default machines if table not yet seeded/migrated
        const DEFAULT_MAP: Record<string, { name: string; location: string }> = {
            picu: { name: "Mesin Finger PICU", location: "Ruang PICU" },
            vk: { name: "Mesin Finger VK", location: "Ruang VK / Bersalin" },
            neo1: { name: "Mesin Finger Neo 1", location: "Ruang Perinatologi / Neo 1" },
            neo2: { name: "Mesin Finger Neo 2", location: "Ruang Perinatologi / Neo 2" },
            absensi: { name: "Mesin Finger Absensi", location: "Lobi Utama / Absensi" },
        };

        if (DEFAULT_MAP[slug]) {
            return {
                success: true,
                machine: {
                    id: `def-${slug}`,
                    name: DEFAULT_MAP[slug].name,
                    code: slug,
                    location: DEFAULT_MAP[slug].location,
                },
            };
        }

        return {
            success: false,
            error: `Mesin dengan kode '${slug}' tidak ditemukan atau tidak aktif.`,
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Gagal mengambil data mesin",
        };
    }
}

export async function getPublicMachineRegisteredList(machineSlug: string): Promise<{
    success: boolean;
    entries: PublicFingerprintEntry[];
    error?: string;
}> {
    try {
        const supabase = createAdminClient();
        const slug = machineSlug.toLowerCase().trim();

        // Check if dynamic relational table exists & has entries
        let relationalResults: PublicFingerprintEntry[] = [];
        try {
            const { data: machine } = await supabase
                .from("fingerprint_machines")
                .select("id")
                .eq("code", slug)
                .maybeSingle();

            if (machine) {
                const { data: entries } = await supabase
                    .from("fingerprint_machine_entries")
                    .select("id, finger_id, created_at, fingerprints(name)")
                    .eq("machine_id", machine.id)
                    .order("finger_id", { ascending: true });

                if (entries && entries.length > 0) {
                    relationalResults = entries.map((e: any) => ({
                        id: e.id,
                        finger_id: e.finger_id,
                        name: e.fingerprints?.name || "Pegawai",
                        created_at: e.created_at,
                    }));
                    return { success: true, entries: relationalResults };
                }
            }
        } catch {
            // Relational table might not exist yet, fallback to column check below
        }

        // Fallback: check legacy column if applicable
        const colName = SLUG_TO_COLUMN[slug];
        if (colName) {
            const { data: rows } = await supabase
                .from("fingerprints")
                .select(`id, name, ${colName}, created_at, profiles(full_name)`)
                .not(colName, "is", null)
                .neq(colName, "");

            if (rows) {
                const entries: PublicFingerprintEntry[] = rows.map((r: any) => ({
                    id: r.id,
                    name: r.name || r.profiles?.full_name || "Pegawai",
                    finger_id: r[colName],
                    created_at: r.created_at,
                }));
                // Sort by numeric finger_id
                entries.sort((a, b) => (parseInt(a.finger_id) || 0) - (parseInt(b.finger_id) || 0));
                return { success: true, entries };
            }
        }

        return { success: true, entries: [] };
    } catch (err) {
        return {
            success: false,
            entries: [],
            error: err instanceof Error ? err.message : "Gagal memuat daftar ID",
        };
    }
}

/**
 * Generate a random 3-digit ID (001 - 999) that is NOT yet used on this machine
 */
function pickRandomAvailableId(usedIds: Set<string>): string | null {
    const available: string[] = [];
    for (let i = 1; i <= 999; i++) {
        const formatted = String(i).padStart(3, "0");
        if (!usedIds.has(formatted)) {
            available.push(formatted);
        }
    }

    if (available.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
}

/**
 * Generate a random 3-digit ID (001 - 999) that is NOT yet used on this machine
 */
export async function getAvailableRandomId(machineSlug: string): Promise<{
    success: boolean;
    randomId?: string;
    error?: string;
}> {
    try {
        const listResult = await getPublicMachineRegisteredList(machineSlug);
        const usedIds = new Set(listResult.entries.map((e) => e.finger_id.padStart(3, "0")));
        const chosenId = pickRandomAvailableId(usedIds);

        if (!chosenId) {
            return {
                success: false,
                error: "Kapasitas ID (001-999) untuk mesin ini sudah penuh.",
            };
        }

        return {
            success: true,
            randomId: chosenId,
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Gagal meng-generate ID",
        };
    }
}

export async function registerPublicFingerprint(input: {
    machineSlug: string;
    name: string;
    fingerId: string;
}): Promise<{
    success: boolean;
    assignedId?: string;
    wasReassigned?: boolean;
    originalId?: string;
    error?: string;
}> {
    try {
        const supabase = createAdminClient();
        const slug = input.machineSlug.toLowerCase().trim();
        const cleanName = input.name.trim();
        const requestedId = input.fingerId.trim().padStart(3, "0");

        if (!cleanName) {
            return { success: false, error: "Nama Lengkap wajib diisi." };
        }

        if (!/^\d{1,3}$/.test(input.fingerId.trim())) {
            return { success: false, error: "Nomor ID harus berupa angka 3 digit (001-999)." };
        }

        // Check if machine exists in database
        let machineId: string | null = null;
        try {
            const { data: machine } = await supabase
                .from("fingerprint_machines")
                .select("id")
                .eq("code", slug)
                .maybeSingle();

            if (machine) {
                machineId = machine.id;
            }
        } catch {
            // Table might not exist yet
        }

        // Check if person already exists by exact name in fingerprints table
        let fingerprintId: string | null = null;
        const { data: existingPerson } = await supabase
            .from("fingerprints")
            .select("id")
            .ilike("name", cleanName)
            .maybeSingle();

        if (existingPerson) {
            fingerprintId = existingPerson.id;
        } else {
            // Insert new person
            const { data: newPerson, error: insertErr } = await supabase
                .from("fingerprints")
                .insert({ name: cleanName })
                .select("id")
                .single();

            if (insertErr) {
                return { success: false, error: insertErr.message };
            }
            fingerprintId = newPerson.id;
        }

        // Concurrency & Collision Safe Assignment Loop:
        // If requested ID is already taken by another person (or in race condition),
        // automatically assign a new available 3-digit ID seamlessly.
        const colName = SLUG_TO_COLUMN[slug];
        let currentTargetId = requestedId;
        let wasReassigned = false;
        let attemptsLeft = 5;
        let saveSuccess = false;

        while (attemptsLeft > 0) {
            attemptsLeft--;

            // Fetch live list to check if currentTargetId is already occupied
            const currentList = await getPublicMachineRegisteredList(slug);
            const usedIds = new Set(
                currentList.entries
                    .filter((e) => e.name.toLowerCase() !== cleanName.toLowerCase())
                    .map((e) => e.finger_id.padStart(3, "0"))
            );

            if (usedIds.has(currentTargetId)) {
                wasReassigned = true;
                const nextAvailable = pickRandomAvailableId(usedIds);
                if (!nextAvailable) {
                    return {
                        success: false,
                        error: "Kapasitas ID (001-999) untuk mesin ini sudah penuh.",
                    };
                }
                currentTargetId = nextAvailable;
            }

            try {
                // 1. Update legacy column if applicable
                if (colName && fingerprintId) {
                    await supabase
                        .from("fingerprints")
                        .update({ [colName]: currentTargetId, updated_at: new Date().toISOString() })
                        .eq("id", fingerprintId);
                }

                // 2. Upsert into relational table fingerprint_machine_entries
                if (machineId && fingerprintId) {
                    const { error: upsertErr } = await supabase
                        .from("fingerprint_machine_entries")
                        .upsert(
                            {
                                fingerprint_id: fingerprintId,
                                machine_id: machineId,
                                finger_id: currentTargetId,
                                updated_at: new Date().toISOString(),
                            },
                            { onConflict: "fingerprint_id,machine_id" }
                        );

                    if (upsertErr) {
                        // Unique constraint violation (e.g. uq_machine_finger_id) -> concurrent claim
                        if (
                            upsertErr.code === "23505" ||
                            upsertErr.message?.toLowerCase().includes("unique") ||
                            upsertErr.message?.toLowerCase().includes("duplicate")
                        ) {
                            wasReassigned = true;
                            usedIds.add(currentTargetId);
                            const nextId = pickRandomAvailableId(usedIds);
                            if (nextId) {
                                currentTargetId = nextId;
                                continue;
                            }
                        }
                        throw upsertErr;
                    }
                }

                saveSuccess = true;
                break;
            } catch (err: any) {
                if (attemptsLeft === 0) {
                    throw err;
                }
            }
        }

        if (!saveSuccess) {
            return {
                success: false,
                error: "Terjadi kepadatan pendaftaran pada nomor ini. Silakan klik tombol daftarkan kembali.",
            };
        }

        revalidatePath(`/public/fingerprint/${slug}`);
        revalidatePath("/master/fingerprints");

        return {
            success: true,
            assignedId: currentTargetId,
            wasReassigned,
            originalId: requestedId,
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Gagal mendaftarkan ID fingerprint",
        };
    }
}
