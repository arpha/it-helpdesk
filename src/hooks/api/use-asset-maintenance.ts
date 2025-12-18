"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type AssetMaintenance = {
    id: string;
    asset_id: string;
    type: "repair" | "upgrade" | "cleaning" | "inspection";
    description: string | null;
    cost: number;
    performed_by: string | null;
    performed_at: string | null;
    next_maintenance: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    assets: {
        name: string;
        asset_code: string;
    } | null;
};

type UseMaintenanceParams = {
    page: number;
    limit: number;
    assetId?: string;
};

type MaintenanceResult = {
    data: AssetMaintenance[];
    totalItems: number;
    totalPages: number;
};

async function fetchMaintenance(params: UseMaintenanceParams): Promise<MaintenanceResult> {
    const supabase = createClient();
    const { page, limit, assetId } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("asset_maintenance")
        .select(
            `
            *,
            assets(name, asset_code)
        `,
            { count: "exact" }
        );

    if (assetId) {
        query = query.eq("asset_id", assetId);
    }

    const { data, count, error } = await query
        .order("performed_at", { ascending: false })
        .range(from, to);

    if (error) {
        throw new Error(error.message);
    }

    return {
        data: (data as unknown as AssetMaintenance[]) || [],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useAssetMaintenance(params: UseMaintenanceParams) {
    return useQuery({
        queryKey: ["asset-maintenance", params.page, params.limit, params.assetId],
        queryFn: () => fetchMaintenance(params),
    });
}
