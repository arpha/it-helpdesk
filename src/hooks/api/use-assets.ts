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
    is_borrowable: boolean;
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

    // Use standard select without inner join enforcement for global search
    // to ensure assets without locations can still be found by name/code
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
        // Split by space to allow multi-term search (e.g. "Laptop Gizi")
        const terms = search.trim().split(/\s+/);

        for (const term of terms) {
            // 1. Find locations matching the term
            const { data: locations } = await supabase
                .from("locations")
                .select("id")
                .ilike("name", `%${term}%`);

            const locIds = locations?.map(l => l.id) || [];

            // 2. Build OR query: Name match OR (if locs found) Location ID match
            let orQuery = `name.ilike.%${term}%,asset_code.ilike.%${term}%,serial_number.ilike.%${term}%`;

            if (locIds.length > 0) {
                orQuery += `,location_id.in.(${locIds.join(",")})`;
            }

            query = query.or(orQuery);
        }
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
