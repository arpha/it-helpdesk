"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type UserProfile = {
    id: string;
    username: string | null;
    full_name: string | null;
    role: "admin" | "user" | "staff_it" | "manager_it";
    avatar_url: string | null;
    whatsapp_phone: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

type UseUsersParams = {
    page?: number;
    limit?: number;
    search?: string;
    roles?: string[];
    activeOnly?: boolean;
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
    roles,
    activeOnly = false,
}: UseUsersParams): Promise<UseUsersResult> {
    const supabase = createClient();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("profiles")
        .select("*", { count: "exact" });

    // Apply search filter
    if (search) {
        query = query.ilike("full_name", `%${search}%`);
    }

    // Apply role filter
    if (roles && roles.length > 0) {
        query = query.in("role", roles);
    }

    // Filter only active users if specified
    if (activeOnly) {
        query = query.neq("is_active", false);
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
    const { page = 1, limit = 10, search = "", roles, activeOnly = false } = params;

    return useQuery({
        queryKey: ["users", { page, limit, search, roles, activeOnly }],
        queryFn: () => fetchUsers({ page, limit, search, roles, activeOnly }),
    });
}
