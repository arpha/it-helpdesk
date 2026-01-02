"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type SimpleUser = {
    id: string;
    full_name: string | null;
    username: string | null;
};

async function fetchAllUsers(): Promise<SimpleUser[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .neq("is_active", false)
        .order("full_name", { ascending: true });

    if (error) {
        console.error("Error fetching users:", error);
        return [];
    }

    return (data as SimpleUser[]) || [];
}

export function useAllUsers() {
    return useQuery({
        queryKey: ["all-users"],
        queryFn: fetchAllUsers,
    });
}

// Fetch only IT users (admin, staff_it, manager_it)
async function fetchITUsers(): Promise<SimpleUser[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("role", ["admin", "staff_it", "manager_it"])
        .neq("is_active", false)
        .order("full_name", { ascending: true });

    if (error) {
        console.error("Error fetching IT users:", error);
        return [];
    }

    return (data as SimpleUser[]) || [];
}

export function useITUsers() {
    return useQuery({
        queryKey: ["it-users"],
        queryFn: fetchITUsers,
    });
}
