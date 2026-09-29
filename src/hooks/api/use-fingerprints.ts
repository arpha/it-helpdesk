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

    let data: any[] | null = null;
    let count: number | null = null;
    let queryError: any = null;

    // 1. Try modern query with name search if search term provided
    try {
        let query = supabase
            .from("fingerprints")
            .select(
                "*, profiles(id, full_name, username, avatar_url)",
                { count: "exact" }
            );

        if (search && search.trim()) {
            const term = search.trim();
            // Try searching name, profiles full_name, and finger ID columns
            query = query.or(
                `name.ilike.%${term}%,finger_picu.ilike.%${term}%,finger_vk.ilike.%${term}%,finger_neo1.ilike.%${term}%,finger_neo2.ilike.%${term}%,finger_absensi.ilike.%${term}%`
            );
        }

        query = query.range(from, to).order("created_at", { ascending: false });
        const res = await query;
        if (res.error) {
            queryError = res.error;
        } else {
            data = res.data;
            count = res.count;
        }
    } catch (err) {
        queryError = err;
    }

    // 2. Fallback query if error occurred (e.g. column 'name' does not exist yet)
    if (queryError || data === null) {
        console.warn("Using fallback fingerprint query:", queryError?.message || queryError);
        let fallbackQuery = supabase
            .from("fingerprints")
            .select(
                "*, profiles(id, full_name, username, avatar_url)",
                { count: "exact" }
            );

        if (search && search.trim()) {
            const term = search.trim();
            fallbackQuery = fallbackQuery.or(
                `finger_picu.ilike.%${term}%,finger_vk.ilike.%${term}%,finger_neo1.ilike.%${term}%,finger_neo2.ilike.%${term}%,finger_absensi.ilike.%${term}%`
            );
        }

        fallbackQuery = fallbackQuery.range(from, to).order("created_at", { ascending: false });
        const fbRes = await fallbackQuery;
        if (fbRes.error) {
            console.error("Fallback query also failed:", fbRes.error);
            throw fbRes.error;
        }
        data = fbRes.data;
        count = fbRes.count;
    }

    // 3. Try to fetch relational machine entries if table exists
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
            // Relational table might not exist yet, safe to ignore
        }
    }

    // 4. Transform data: ensure old columns (finger_picu, etc.) are prioritized and preserved
    const transformedData = (data || []).map((row: any) => {
        const relationalEntries = machineEntriesMap[row.id] || {};
        const entries: Record<string, string> = {
            picu: row.finger_picu || relationalEntries["picu"] || "",
            vk: row.finger_vk || relationalEntries["vk"] || "",
            neo1: row.finger_neo1 || relationalEntries["neo1"] || "",
            neo2: row.finger_neo2 || relationalEntries["neo2"] || "",
            absensi: row.finger_absensi || relationalEntries["absensi"] || "",
            ...relationalEntries,
        };

        const resolvedName = row.name || row.profiles?.full_name || "Tanpa Nama";

        return {
            ...row,
            name: resolvedName,
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
