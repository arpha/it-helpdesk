"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type Asset = {
    id: string;
    asset_code: string;
    category_id: string | null;
    name: string;
    serial_number: string | null;
    purchase_date: string | null;
    warranty_expiry: string | null;
    useful_life_years: number;
    status: "active" | "maintenance" | "damage" | "disposed";
    ownership_status: "purchase" | "rent";
    location: string | null;
    location_id: string | null;
    assigned_to: string | null;
    image_url: string | null;
    qr_code_url: string | null;
    notes: string | null;
    specifications: Record<string, string> | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    asset_categories: {
        name: string;
    } | null;
    locations: {
        name: string;
    } | null;
    profiles: {
        id: string;
        full_name: string | null;
        username: string | null;
    } | null;
};

type UseAssetsParams = {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    categoryId?: string;
};

type AssetsResult = {
    data: Asset[];
    totalItems: number;
    totalPages: number;
};

async function fetchAssets(params: UseAssetsParams): Promise<AssetsResult> {
    const supabase = createClient();
    const { page, limit, search, status, categoryId } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("assets")
        .select(
            `
            *,
            asset_categories(name),
            locations(name),
            profiles:assigned_to(id, full_name, username)
        `,
            { count: "exact" }
        );

    if (search) {
        query = query.or(`name.ilike.%${search}%,asset_code.ilike.%${search}%,serial_number.ilike.%${search}%`);
    }

    if (status && status !== "all") {
        query = query.eq("status", status);
    }

    if (categoryId && categoryId !== "all") {
        query = query.eq("category_id", categoryId);
    }

    const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) {
        throw new Error(error.message);
    }

    return {
        data: (data as unknown as Asset[]) || [],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useAssets(params: UseAssetsParams) {
    return useQuery({
        queryKey: ["assets", params.page, params.limit, params.search, params.status, params.categoryId],
        queryFn: () => fetchAssets(params),
    });
}
