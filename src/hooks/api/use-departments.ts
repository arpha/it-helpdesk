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

async function fetchDepartments(): Promise<Department[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("name", { ascending: true });

    if (error) {
        throw new Error(error.message);
    }

    return data || [];
}

export function useDepartments() {
    return useQuery({
        queryKey: ["departments"],
        queryFn: fetchDepartments,
    });
}
