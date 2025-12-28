"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type Location = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
};

type UseLocationsPageParams = {
    page: number;
    limit: number;
    search?: string;
};

type LocationsPageResult = {
    data: Location[];
    totalItems: number;
    totalPages: number;
};

async function fetchLocationsPage(
    params: UseLocationsPageParams
): Promise<LocationsPageResult> {
    const supabase = createClient();
    const { page, limit, search } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase.from("locations").select("*", { count: "exact" });

    if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, count, error } = await query
        .order("name", { ascending: true })
        .range(from, to);

    if (error) {
        throw new Error(error.message);
    }

    return {
        data: data as Location[],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useLocationsPage(params: UseLocationsPageParams) {
    return useQuery({
        queryKey: ["locations", params.page, params.limit, params.search],
        queryFn: () => fetchLocationsPage(params),
    });
}
