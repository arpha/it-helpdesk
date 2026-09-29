"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Fingerprint } from "@/types/fingerprint";

export type { Fingerprint };

type UseFingerprintsParams = {
    page?: number;
    limit?: number;
    search?: string;
};

type UseFingerprintsResult = {
    data: Fingerprint[];
    totalItems: number;
    totalPages: number;
};

async function fetchFingerprints({
    page = 1,
    limit = 10,
    search = "",
}: UseFingerprintsParams): Promise<UseFingerprintsResult> {
    const supabase = createClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Use left join (profiles without !inner) so rows without user_id are returned
    let query = supabase
        .from("fingerprints")
        .select(
            "*, profiles(id, full_name, username, avatar_url)",
            { count: "exact" }
        );

    // Apply search filter on name or profiles.full_name
    if (search && search.trim()) {
        const term = search.trim();
        // Supabase or filter across name and profile
        query = query.or(`name.ilike.%${term}%,finger_picu.ilike.%${term}%,finger_vk.ilike.%${term}%,finger_neo1.ilike.%${term}%,finger_neo2.ilike.%${term}%,finger_absensi.ilike.%${term}%`);
    }

    // Apply pagination
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
        console.error("Error fetching fingerprints:", error);
        // Fallback search if 'name' column isn't yet migrated in Supabase
        if (error.message?.includes("column fingerprints.name does not exist")) {
            const fallbackQuery = supabase
                .from("fingerprints")
                .select("*, profiles(id, full_name, username, avatar_url)", { count: "exact" })
                .range(from, to)
                .order("created_at", { ascending: false });
            const fbResult = await fallbackQuery;
            if (fbResult.error) throw fbResult.error;

            const transformed = (fbResult.data || []).map((row: any) => {
                const entries: Record<string, string> = {
                    picu: row.finger_picu || "",
                    vk: row.finger_vk || "",
                    neo1: row.finger_neo1 || "",
                    neo2: row.finger_neo2 || "",
                    absensi: row.finger_absensi || "",
                };
                return {
                    ...row,
                    name: row.name || row.profiles?.full_name || "Tanpa Nama",
                    entries,
                } as Fingerprint;
            });

            return {
                data: transformed,
                totalItems: fbResult.count || 0,
                totalPages: Math.ceil((fbResult.count || 0) / limit),
            };
        }
        throw error;
    }

    // Fetch relational machine entries if available
    const fingerprintIds = (data || []).map((d: any) => d.id);
    let machineEntriesMap: Record<string, Record<string, string>> = {};

    if (fingerprintIds.length > 0) {
        try {
            const { data: entriesData } = await supabase
                .from("fingerprint_machine_entries")
                .select("fingerprint_id, finger_id, fingerprint_machines(code)")
                .in("fingerprint_id", fingerprintIds);

            if (entriesData && entriesData.length > 0) {
                entriesData.forEach((item: any) => {
                    const fpId = item.fingerprint_id;
                    const code = item.fingerprint_machines?.code;
                    if (fpId && code && item.finger_id) {
                        if (!machineEntriesMap[fpId]) machineEntriesMap[fpId] = {};
                        machineEntriesMap[fpId][code] = item.finger_id;
                    }
                });
            }
        } catch {
            // Table might not exist yet, fallback to column values
        }
    }

    // Transform data to ensure name and entries are consistently populated
    const transformedData = (data || []).map((row: any) => {
        const relationalEntries = machineEntriesMap[row.id] || {};
        const entries: Record<string, string> = {
            picu: relationalEntries["picu"] || row.finger_picu || "",
            vk: relationalEntries["vk"] || row.finger_vk || "",
            neo1: relationalEntries["neo1"] || row.finger_neo1 || "",
            neo2: relationalEntries["neo2"] || row.finger_neo2 || "",
            absensi: relationalEntries["absensi"] || row.finger_absensi || "",
            ...relationalEntries,
        };

        return {
            ...row,
            name: row.name || row.profiles?.full_name || "Tanpa Nama",
            entries,
        } as Fingerprint;
    });

    return {
        data: transformedData,
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useFingerprints(params: UseFingerprintsParams = {}) {
    return useQuery({
        queryKey: ["fingerprints", params],
        queryFn: () => fetchFingerprints(params),
    });
}
