"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
    Report,
    ReportCategory,
    ReportFilterParams,
    ReportLog,
    ReportSchedule,
    ReportStats,
} from "@/types/report";

const REPORT_LIST_SELECT = `
    id,
    title,
    report_number,
    category_id,
    description,
    period_type,
    period_start,
    period_end,
    deadline,
    submitted_at,
    reviewed_at,
    approved_at,
    status,
    priority,
    assigned_to,
    file_url,
    file_name,
    file_size,
    file_type,
    attachments,
    created_by,
    created_at,
    updated_at,
    category:report_categories(id, name, color),
    assigned_profile:profiles!reports_assigned_to_fkey(id, full_name, username, role)
`;

const REPORT_DETAIL_SELECT = `
    *,
    category:report_categories(*),
    assigned_profile:profiles!reports_assigned_to_fkey(id, full_name, username, role),
    created_profile:profiles!reports_created_by_fkey(id, full_name, username, role),
    reviewed_profile:profiles!reports_reviewed_by_fkey(id, full_name, username, role),
    approved_profile:profiles!reports_approved_by_fkey(id, full_name, username, role)
`;

const SCHEDULE_SELECT = `
    *,
    category:report_categories(id, name, color),
    assigned_profile:profiles!report_schedules_assigned_to_fkey(id, full_name, username, role),
    created_profile:profiles!report_schedules_created_by_fkey(id, full_name, username, role)
`;

function getTodayDateString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export const reportKeys = {
    all: ["reports"] as const,
    list: (params?: ReportFilterParams) => ["reports", "list", params] as const,
    detail: (id: string) => ["reports", "detail", id] as const,
    stats: () => ["reports", "stats"] as const,
    categories: () => ["reports", "categories"] as const,
    calendar: (year: number, month: number) => ["reports", "calendar", year, month] as const,
    schedules: () => ["reports", "schedules"] as const,
};

export function useReports(params?: ReportFilterParams) {
    return useQuery({
        queryKey: reportKeys.list(params),
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60, // 1 menit
        queryFn: async () => {
            const supabase = createClient();
            const page = params?.page || 1;
            const pageSize = params?.pageSize || 10;
            const start = (page - 1) * pageSize;
            const end = start + pageSize - 1;
            const today = getTodayDateString();

            let query = supabase
                .from("reports")
                .select(REPORT_LIST_SELECT, { count: "exact" });

            if (params?.search && params.search.trim()) {
                const q = params.search.trim();
                query = query.or(
                    `title.ilike.%${q}%,report_number.ilike.%${q}%,description.ilike.%${q}%`
                );
            }

            if (params?.category_id && params.category_id !== "all") {
                query = query.eq("category_id", params.category_id);
            }

            if (params?.status && params.status !== "all") {
                if (params.status === "overdue") {
                    query = query
                        .in("status", ["pending", "draft", "revision", "overdue"])
                        .lt("deadline", today);
                } else if (["pending", "draft", "revision"].includes(params.status)) {
                    query = query.eq("status", params.status).gte("deadline", today);
                } else {
                    query = query.eq("status", params.status);
                }
            }

            if (params?.period_type && params.period_type !== "all") {
                query = query.eq("period_type", params.period_type);
            }

            if (params?.priority && params.priority !== "all") {
                query = query.eq("priority", params.priority);
            }

            if (params?.assigned_to && params.assigned_to !== "all") {
                query = query.eq("assigned_to", params.assigned_to);
            }

            const { data, count, error } = await query
                .order("deadline", { ascending: true })
                .order("created_at", { ascending: false })
                .range(start, end);

            if (error) {
                throw new Error(error.message || "Gagal memuat daftar laporan");
            }

            return {
                data: (data || []) as unknown as Report[],
                count: count || 0,
                page,
                pageSize,
                totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
            };
        },
    });
}

export function useReportDetail(id: string | null) {
    return useQuery({
        queryKey: reportKeys.detail(id || ""),
        staleTime: 1000 * 30,
        enabled: !!id,
        queryFn: async () => {
            if (!id) return null;
            const supabase = createClient();

            const [
                { data: report, error: reportError },
                { data: logs, error: logsError },
            ] = await Promise.all([
                supabase
                    .from("reports")
                    .select(REPORT_DETAIL_SELECT)
                    .eq("id", id)
                    .single(),
                supabase
                    .from("report_logs")
                    .select(
                        `*, performer:profiles!report_logs_performed_by_fkey(id, full_name, username, role)`
                    )
                    .eq("report_id", id)
                    .order("created_at", { ascending: false }),
            ]);

            if (reportError) {
                throw new Error(reportError.message || "Gagal memuat detail laporan");
            }
            if (logsError) {
                console.error("Error fetching report logs:", logsError);
            }

            return {
                report: report as unknown as Report,
                logs: (logs || []) as unknown as ReportLog[],
            };
        },
    });
}

export function useReportStats() {
    return useQuery<ReportStats>({
        queryKey: reportKeys.stats(),
        staleTime: 1000 * 60, // 1 menit
        queryFn: async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("reports")
                .select("status, deadline");

            if (error) {
                throw new Error(error.message || "Gagal memuat statistik laporan");
            }

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            let total = 0;
            let pending = 0;
            let dueSoon = 0;
            let overdue = 0;
            let approved = 0;

            for (const row of data || []) {
                total++;
                const st = row.status as string;
                if (st === "approved") {
                    approved++;
                    continue;
                }
                if (st === "rejected") {
                    continue;
                }

                const [y, m, d] = (row.deadline as string).split("-").map(Number);
                const dl = new Date(y, (m || 1) - 1, d || 1);
                const daysLeft = Math.round(
                    (dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );
                const isIncomplete = ["pending", "draft", "revision", "overdue"].includes(st);

                if (isIncomplete && daysLeft < 0) {
                    overdue++;
                } else {
                    pending++;
                    if (isIncomplete && daysLeft >= 0 && daysLeft <= 7) {
                        dueSoon++;
                    }
                }
            }

            return { total, pending, dueSoon, overdue, approved };
        },
    });
}

export function useReportCategories() {
    return useQuery<ReportCategory[]>({
        queryKey: reportKeys.categories(),
        staleTime: 1000 * 60 * 10, // 10 menit (jarang berubah)
        queryFn: async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("report_categories")
                .select("*")
                .order("name", { ascending: true });

            if (error) {
                throw new Error(error.message || "Gagal memuat kategori laporan");
            }
            return (data || []) as ReportCategory[];
        },
    });
}

export function useReportsByDeadline(year: number, month: number) {
    return useQuery<Report[]>({
        queryKey: reportKeys.calendar(year, month),
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60, // 1 menit
        queryFn: async () => {
            const supabase = createClient();
            const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

            const { data, error } = await supabase
                .from("reports")
                .select(REPORT_LIST_SELECT)
                .gte("deadline", startStr)
                .lte("deadline", endStr)
                .order("deadline", { ascending: true })
                .order("priority", { ascending: false });

            if (error) {
                throw new Error(error.message || "Gagal memuat kalender deadline");
            }
            return (data || []) as unknown as Report[];
        },
    });
}

export function useReportSchedules() {
    return useQuery<ReportSchedule[]>({
        queryKey: reportKeys.schedules(),
        staleTime: 1000 * 60, // 1 menit
        queryFn: async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("report_schedules")
                .select(SCHEDULE_SELECT)
                .order("is_active", { ascending: false })
                .order("created_at", { ascending: false });

            if (error) {
                throw new Error(error.message || "Gagal memuat jadwal laporan rutin");
            }
            return (data || []) as unknown as ReportSchedule[];
        },
    });
}

export function useInvalidateReports() {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: reportKeys.all });
        queryClient.invalidateQueries({ queryKey: ["sidebar-pending-counts"] });
    };
}
