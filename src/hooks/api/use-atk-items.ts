"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type ATKItem = {
    id: string;
    type: "atk" | "sparepart";
    name: string;
    description: string | null;
    unit: string;
    price: number;
    stock_quantity: number;
    min_stock: number;
    image_url: string | null;
    created_at: string;
    updated_at: string;
};

type UseATKItemsParams = {
    page: number;
    limit: number;
    search?: string;
    type?: "atk" | "sparepart" | "all";
};

type ATKItemsResult = {
    data: ATKItem[];
    totalItems: number;
    totalPages: number;
};

async function fetchATKItems(params: UseATKItemsParams): Promise<ATKItemsResult> {
    const supabase = createClient();
    const { page, limit, search, type } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase.from("atk_items").select("*", { count: "exact" });

    if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (type && type !== "all") {
        query = query.eq("type", type);
    }

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
        queryKey: ["atk-items", params.page, params.limit, params.search, params.type],
        queryFn: () => fetchATKItems(params),
    });
}
