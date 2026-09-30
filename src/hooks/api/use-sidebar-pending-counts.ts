"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export type SidebarPendingCounts = Record<string, number>;

export function useSidebarPendingCounts() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    // Listen to real-time changes on tables that affect approval / pending badges
    useEffect(() => {
        const channel = supabase
            .channel("sidebar-pending-counts-realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "atk_requests" },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["sidebar-pending-counts"] });
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "asset_borrowings" },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["sidebar-pending-counts"] });
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "asset_distributions" },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["sidebar-pending-counts"] });
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "tickets" },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["sidebar-pending-counts"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, queryClient]);

    return useQuery<SidebarPendingCounts>({
        queryKey: ["sidebar-pending-counts"],
        queryFn: async () => {
            try {
                const [
                    { count: pendingAtkRequests },
                    { count: pendingBorrowings },
                    { count: pendingDistributions },
                    { count: openTickets },
                ] = await Promise.all([
                    supabase
                        .from("atk_requests")
                        .select("*", { count: "exact", head: true })
                        .eq("status", "pending"),
                    supabase
                        .from("asset_borrowings")
                        .select("*", { count: "exact", head: true })
                        .eq("status", "pending"),
                    supabase
                        .from("asset_distributions")
                        .select("*", { count: "exact", head: true })
                        .eq("status", "pending"),
                    supabase
                        .from("tickets")
                        .select("*", { count: "exact", head: true })
                        .eq("status", "open"),
                ]);

                return {
                    "/atk/requests": pendingAtkRequests || 0,
                    "/assets/borrowing": pendingBorrowings || 0,
                    "/assets/distribution": pendingDistributions || 0,
                    "/tickets": openTickets || 0,
                };
            } catch (err) {
                console.error("Error fetching sidebar pending counts:", err);
                return {
                    "/atk/requests": 0,
                    "/assets/borrowing": 0,
                    "/assets/distribution": 0,
                    "/tickets": 0,
                };
            }
        },
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 30, // 30s auto polling fallback
        refetchOnWindowFocus: true,
    });
}
