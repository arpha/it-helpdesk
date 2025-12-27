"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type SimpleUser = {
    id: string;
    full_name: string | null;
    username: string | null;
    email: string;
};

async function fetchAllUsers(): Promise<SimpleUser[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, email")
        .order("full_name", { ascending: true });

    if (error) {
        throw new Error(error.message);
    }

    return (data as unknown as SimpleUser[]) || [];
}

export function useAllUsers() {
    return useQuery({
        queryKey: ["all-users"],
        queryFn: fetchAllUsers,
    });
}
