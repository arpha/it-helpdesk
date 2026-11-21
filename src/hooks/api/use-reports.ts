"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getReports,
    getReportById,
    getReportStats,
    getReportCategories,
    getReportsByDeadline,
} from "@/app/(dashboard)/reports/actions";
import type { ReportFilterParams } from "@/types/report";

export const reportKeys = {
    all: ["reports"] as const,
    list: (params?: ReportFilterParams) => ["reports", "list", params] as const,
    detail: (id: string) => ["reports", "detail", id] as const,
    stats: () => ["reports", "stats"] as const,
    categories: () => ["reports", "categories"] as const,
    calendar: (year: number, month: number) => ["reports", "calendar", year, month] as const,
};

export function useReports(params?: ReportFilterParams) {
    return useQuery({
        queryKey: reportKeys.list(params),
        queryFn: async () => {
            const res = await getReports(params);
            if (!res.success) {
                throw new Error(res.error || "Gagal memuat daftar laporan");
            }
            return {
                data: res.data || [],
                count: res.count || 0,
                page: res.page || 1,
                pageSize: res.pageSize || 10,
                totalPages: res.totalPages || 1,
            };
        },
        staleTime: 1000 * 30,
    });
}

export function useReportDetail(id: string | null) {
    return useQuery({
        queryKey: reportKeys.detail(id || ""),
        queryFn: async () => {
            if (!id) return null;
            const res = await getReportById(id);
            if (!res.success) {
                throw new Error(res.error || "Gagal memuat detail laporan");
            }
            return {
                report: res.data!,
                logs: res.logs || [],
            };
        },
        enabled: !!id,
    });
}

export function useReportStats() {
    return useQuery({
        queryKey: reportKeys.stats(),
        queryFn: async () => {
            const res = await getReportStats();
            if (!res.success) {
                throw new Error(res.error || "Gagal memuat statistik laporan");
            }
            return (
                res.data || {
                    total: 0,
                    pending: 0,
                    dueSoon: 0,
                    overdue: 0,
                    approved: 0,
                }
            );
        },
        staleTime: 1000 * 30,
    });
}

export function useReportCategories() {
    return useQuery({
        queryKey: reportKeys.categories(),
        queryFn: async () => {
            const res = await getReportCategories();
            if (!res.success) {
                throw new Error(res.error || "Gagal memuat kategori laporan");
            }
            return res.data || [];
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useReportsByDeadline(year: number, month: number) {
    return useQuery({
        queryKey: reportKeys.calendar(year, month),
        queryFn: async () => {
            const res = await getReportsByDeadline(year, month);
            if (!res.success) {
                throw new Error(res.error || "Gagal memuat kalender deadline");
            }
            return res.data || [];
        },
        staleTime: 1000 * 30,
    });
}

export function useInvalidateReports() {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: reportKeys.all });
        queryClient.invalidateQueries({ queryKey: ["sidebar-pending-counts"] });
    };
}
