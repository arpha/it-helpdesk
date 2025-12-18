"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type Department = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
};

type UseDepartmentsPageParams = {
    page: number;
    limit: number;
    search?: string;
};

type DepartmentsPageResult = {
    data: Department[];
    totalItems: number;
    totalPages: number;
};

async function fetchDepartmentsPage(
    params: UseDepartmentsPageParams
): Promise<DepartmentsPageResult> {
    const supabase = createClient();
    const { page, limit, search } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase.from("departments").select("*", { count: "exact" });

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
        data: data as Department[],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useDepartmentsPage(params: UseDepartmentsPageParams) {
    return useQuery({
        queryKey: ["departments", params.page, params.limit, params.search],
        queryFn: () => fetchDepartmentsPage(params),
    });
}
