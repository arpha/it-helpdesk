"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type DistributionItem = {
    id: string;
    asset_id: string;
    condition: "Baru" | "Bekas";
    notes: string | null;
    assets: {
        id: string;
        name: string;
        asset_code: string | null;
    };
};

export type AssetDistribution = {
    id: string;
    document_number: string | null;
    destination_location_id: string | null;
    receiver_id: string | null;
    status: "draft" | "pending" | "completed";
    notes: string | null;
    distributed_by: string | null;
    distributed_at: string | null;
    received_at: string | null;
    receiver_signature_url: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    locations: {
        name: string;
    } | null;
    receiver: {
        full_name: string;
    } | null;
    distributor: {
        full_name: string;
    } | null;
    creator: {
        full_name: string;
    } | null;
    asset_distribution_items: DistributionItem[];
};

type UseDistributionsParams = {
    page: number;
    limit: number;
    status?: string;
};

type DistributionsResult = {
    data: AssetDistribution[];
    totalItems: number;
    totalPages: number;
};

async function fetchDistributions(params: UseDistributionsParams): Promise<DistributionsResult> {
    const supabase = createClient();
    const { page, limit, status } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("asset_distributions")
        .select(
            `
            *,
            locations:destination_location_id(name),
            receiver:receiver_id(full_name),
            distributor:distributed_by(full_name),
            creator:created_by(full_name),
            asset_distribution_items(
                id,
                asset_id,
                condition,
                notes,
                assets(id, name, asset_code)
            )
        `,
            { count: "exact" }
        );

    if (status && status !== "all") {
        query = query.eq("status", status);
    }

    const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) {
        throw new Error(error.message);
    }

    return {
        data: (data as unknown as AssetDistribution[]) || [],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useAssetDistributions(params: UseDistributionsParams) {
    return useQuery({
        queryKey: ["asset-distributions", params.page, params.limit, params.status],
        queryFn: () => fetchDistributions(params),
    });
}

// Fetch distributable assets (not currently in a pending distribution)
export type DistributableAsset = {
    id: string;
    name: string;
    asset_code: string | null;
    location_id: string | null;
    locations: {
        name: string;
    } | null;
};

async function fetchDistributableAssets(): Promise<DistributableAsset[]> {
    const supabase = createClient();

    // Get assets that are not in a pending/draft distribution
    const { data: pendingDistributions } = await supabase
        .from("asset_distribution_items")
        .select("asset_id, asset_distributions!inner(status)")
        .in("asset_distributions.status", ["draft", "pending"]);

    const excludedIds = pendingDistributions?.map((d) => d.asset_id) || [];

    let query = supabase
        .from("assets")
        .select("id, name, asset_code, location_id, locations(name)")
        .order("name", { ascending: true });

    if (excludedIds.length > 0) {
        query = query.not("id", "in", `(${excludedIds.join(",")})`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching distributable assets:", error);
        return [];
    }

    return (data as unknown as DistributableAsset[]) || [];
}

export function useDistributableAssets() {
    return useQuery({
        queryKey: ["distributable-assets"],
        queryFn: fetchDistributableAssets,
    });
}
