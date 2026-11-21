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
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "reports" },
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
                const dueThreshold = new Date();
                dueThreshold.setDate(dueThreshold.getDate() + 7);
                const dueThresholdStr = `${dueThreshold.getFullYear()}-${String(
                    dueThreshold.getMonth() + 1
                ).padStart(2, "0")}-${String(dueThreshold.getDate()).padStart(2, "0")}`;

                const [
                    { count: activeAtkRequests },
                    { count: pendingBorrowings },
                    { count: pendingDistributions },
                    { count: activeTickets },
                    { count: urgentReports },
                ] = await Promise.all([
                    // ATK Requests: belum completed (pending approval atau approved menunggu serah terima)
                    supabase
                        .from("atk_requests")
                        .select("*", { count: "exact", head: true })
                        .in("status", ["pending", "approved"]),
                    // Asset Borrowings: belum selesai / belum dikembalikan
                    supabase
                        .from("asset_borrowings")
                        .select("*", { count: "exact", head: true })
                        .in("status", ["pending", "approved", "borrowed"]),
                    // Asset Distributions: belum completed
                    supabase
                        .from("asset_distributions")
                        .select("*", { count: "exact", head: true })
                        .in("status", ["draft", "pending"]),
                    // Helpdesk Tickets: belum selesai (open / in progress)
                    supabase
                        .from("tickets")
                        .select("*", { count: "exact", head: true })
                        .in("status", ["open", "in_progress"]),
                    // Inventaris Laporan: belum selesai & mendekati/melewati deadline (<= 7 hari)
                    supabase
                        .from("reports")
                        .select("*", { count: "exact", head: true })
                        .in("status", ["pending", "draft", "revision", "overdue"])
                        .lte("deadline", dueThresholdStr),
                ]);

                return {
                    "/atk/requests": activeAtkRequests || 0,
                    "/assets/borrowing": pendingBorrowings || 0,
                    "/assets/distribution": pendingDistributions || 0,
                    "/tickets": activeTickets || 0,
                    "/reports": urgentReports || 0,
                };
            } catch (err) {
                console.error("Error fetching sidebar pending counts:", err);
                return {
                    "/atk/requests": 0,
                    "/assets/borrowing": 0,
                    "/assets/distribution": 0,
                    "/tickets": 0,
                    "/reports": 0,
                };
            }
        },
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 30, // 30s auto polling fallback
        refetchOnWindowFocus: true,
    });
}
