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

async function fetchLocations(): Promise<Location[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("name", { ascending: true });

    if (error) {
        throw new Error(error.message);
    }

    return data || [];
}

export function useLocations() {
    return useQuery({
        queryKey: ["locations"],
        queryFn: fetchLocations,
    });
}
