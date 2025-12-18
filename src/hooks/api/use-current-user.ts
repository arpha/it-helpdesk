"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore, UserProfile } from "@/stores/auth-store";
import { useEffect } from "react";

async function fetchCurrentUser(): Promise<UserProfile | null> {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    return profile as UserProfile | null;
}

export function useCurrentUser() {
    const setUser = useAuthStore((state) => state.setUser);
    const storedUser = useAuthStore((state) => state.user);

    const query = useQuery({
        queryKey: ["currentUser"],
        queryFn: fetchCurrentUser,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Update Zustand store when data changes
    useEffect(() => {
        if (query.data) {
            setUser(query.data);
        }
    }, [query.data, setUser]);

    return {
        ...query,
        user: query.data || storedUser,
    };
}
