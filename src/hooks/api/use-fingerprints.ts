"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type Fingerprint = {
    id: string;
    user_id: string;
    finger_picu: string | null;
    finger_vk: string | null;
    finger_neo1: string | null;
    finger_neo2: string | null;
    finger_absensi: string | null;
    created_at: string;
    updated_at: string;
    profiles: {
        id: string;
        full_name: string | null;
        username: string | null;
        avatar_url: string | null;
    };
};

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

    let query = supabase
        .from("fingerprints")
        .select(
            "*, profiles!inner(id, full_name, username, avatar_url)",
            { count: "exact" }
        );

    // Apply search filter on user full_name
    if (search) {
        query = query.ilike("profiles.full_name", `%${search}%`);
    }

    // Apply pagination
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return {
        data: (data as unknown as Fingerprint[]) || [],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useFingerprints(params: UseFingerprintsParams = {}) {
    const { page = 1, limit = 10, search = "" } = params;

    return useQuery({
        queryKey: ["fingerprints", { page, limit, search }],
        queryFn: () => fetchFingerprints({ page, limit, search }),
    });
}
