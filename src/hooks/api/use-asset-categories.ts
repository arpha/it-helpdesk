"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type AssetCategory = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
};

type UseAssetCategoriesParams = {
    page?: number;
    limit?: number;
};

type AssetCategoriesResult = {
    data: AssetCategory[];
    totalItems: number;
    totalPages: number;
};

async function fetchAssetCategories(params: UseAssetCategoriesParams): Promise<AssetCategoriesResult> {
    const supabase = createClient();
    const { page = 1, limit = 10 } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await supabase
        .from("asset_categories")
        .select("*", { count: "exact" })
        .order("name", { ascending: true })
        .range(from, to);

    if (error) {
        throw new Error(error.message);
    }

    return {
        data: (data as AssetCategory[]) || [],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useAssetCategories(params: UseAssetCategoriesParams = {}) {
    return useQuery({
        queryKey: ["asset-categories", params.page, params.limit],
        queryFn: () => fetchAssetCategories(params),
    });
}

// Simple hook to get all categories for dropdown
export function useAllAssetCategories() {
    return useQuery({
        queryKey: ["asset-categories-all"],
        queryFn: async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("asset_categories")
                .select("*")
                .order("name", { ascending: true });

            if (error) throw new Error(error.message);
            return data as AssetCategory[];
        },
    });
}
