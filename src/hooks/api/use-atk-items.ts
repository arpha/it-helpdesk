"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type ATKItem = {
    id: string;
    type: "consumable" | "sparepart";
    name: string;
    description: string | null;
    unit: string;
    price: number;
    stock_quantity: number;
    min_stock: number;
    image_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Analytics data (joined)
    atk_item_analytics?: {
        health_status: "healthy" | "slow" | "dead" | "unknown";
        days_since_last_out: number;
        total_out_30d: number;
        turnover_rate: number;
    } | null;
};

type UseATKItemsParams = {
    page: number;
    limit: number;
    search?: string;
    type?: "consumable" | "sparepart" | "all";
    status?: "active" | "inactive" | "all";
    health?: "healthy" | "slow" | "dead" | "all";
};

type ATKItemsResult = {
    data: ATKItem[];
    totalItems: number;
    totalPages: number;
};

async function fetchATKItems(params: UseATKItemsParams): Promise<ATKItemsResult> {
    const supabase = createClient();
    const { page, limit, search, type, status, health } = params;

    let query = supabase
        .from("atk_items")
        .select("*, atk_item_analytics(health_status, days_since_last_out, total_out_30d, turnover_rate)", { count: "exact" });

    if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (type && type !== "all") {
        query = query.eq("type", type);
    }

    if (status && status !== "all") {
        query = query.eq("is_active", status === "active");
    }

    // If health filter is active, fetch all data first, then filter and paginate client-side
    if (health && health !== "all") {
        const { data, error } = await query.order("name", { ascending: true });

        if (error) {
            throw new Error(error.message);
        }

        // Filter by health status
        const filteredData = (data as ATKItem[]).filter(item =>
            item.atk_item_analytics?.health_status === health
        );

        // Paginate client-side
        const from = (page - 1) * limit;
        const to = from + limit;
        const paginatedData = filteredData.slice(from, to);

        return {
            data: paginatedData,
            totalItems: filteredData.length,
            totalPages: Math.ceil(filteredData.length / limit),
        };
    }

    // Normal server-side pagination for other filters
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
        .order("name", { ascending: true })
        .range(from, to);

    if (error) {
        throw new Error(error.message);
    }

    return {
        data: data as ATKItem[],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useATKItems(params: UseATKItemsParams) {
    return useQuery({
        queryKey: ["atk-items", params.page, params.limit, params.search, params.type, params.status, params.health],
        queryFn: () => fetchATKItems(params),
    });
}
