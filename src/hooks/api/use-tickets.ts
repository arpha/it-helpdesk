"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export type Ticket = {
    id: string;
    title: string;
    description: string | null;
    category: "hardware" | "software" | "data" | "network";
    priority: "low" | "medium" | "high" | "urgent";
    status: "draft" | "open" | "in_progress" | "resolved" | "closed";
    created_by: string;
    assigned_to: string | null;
    location_id: string | null;
    asset_id: string | null;
    resolution_notes: string | null;
    resolved_at: string | null;
    resolved_by: string | null;
    created_at: string;
    updated_at: string;
    // Joined data
    creator?: { full_name: string };
    assignee?: { full_name: string };
    location?: { name: string };
    asset?: { name: string; asset_code: string };
};

type UseTicketsParams = {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    search?: string;
};

export function useTickets(params: UseTicketsParams = {}) {
    const { page = 1, limit = 10, status, category, search } = params;
    const supabase = createClient();

    return useQuery({
        queryKey: ["tickets", page, limit, status, category, search],
        queryFn: async () => {
            let query = supabase
                .from("tickets")
                .select(`
                    *,
                    creator:profiles!tickets_created_by_fkey(full_name),
                    assignee:profiles!tickets_assigned_to_fkey(full_name),
                    location:locations(name),
                    asset:assets(name, asset_code)
                `, { count: "exact" });

            if (status && status !== "all") {
                query = query.eq("status", status);
            }

            if (category && category !== "all") {
                query = query.eq("category", category);
            }

            if (search) {
                query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
            }

            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await query
                .order("created_at", { ascending: false })
                .range(from, to);

            if (error) throw error;

            return {
                data: data as Ticket[],
                totalItems: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            };
        },
    });
}

export function useTicket(id: string) {
    const supabase = createClient();

    return useQuery({
        queryKey: ["ticket", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tickets")
                .select(`
                    *,
                    creator:profiles!tickets_created_by_fkey(full_name),
                    assignee:profiles!tickets_assigned_to_fkey(full_name),
                    location:locations(name),
                    asset:assets(name, asset_code),
                    parts:ticket_parts(
                        id,
                        quantity,
                        item:atk_items(id, name, unit)
                    )
                `)
                .eq("id", id)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });
}

// Realtime subscription hook - auto-refreshes tickets on any change
export function useTicketsRealtime() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel("tickets-realtime")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "tickets",
                },
                () => {
                    // Invalidate all tickets queries to refetch
                    queryClient.invalidateQueries({ queryKey: ["tickets"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, queryClient]);
}
