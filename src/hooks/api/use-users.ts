"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type UserProfile = {
    id: string;
    full_name: string;
    role: "admin" | "user" | "staff_it" | "manager_it";
    department_id: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
    departments?: {
        id: string;
        name: string;
    } | null;
};

type UseUsersParams = {
    page?: number;
    limit?: number;
    search?: string;
};

type UseUsersResult = {
    data: UserProfile[];
    totalItems: number;
    totalPages: number;
};

async function fetchUsers({
    page = 1,
    limit = 10,
    search = "",
}: UseUsersParams): Promise<UseUsersResult> {
    const supabase = createClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("profiles")
        .select("*, departments(id, name)", { count: "exact" });

    // Apply search filter
    if (search) {
        query = query.ilike("full_name", `%${search}%`);
    }

    // Apply pagination
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return {
        data: data || [],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useUsers(params: UseUsersParams = {}) {
    const { page = 1, limit = 10, search = "" } = params;

    return useQuery({
        queryKey: ["users", { page, limit, search }],
        queryFn: () => fetchUsers({ page, limit, search }),
    });
}
