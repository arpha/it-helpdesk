"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateScheduledReports } from "@/lib/reports/schedule-generator";
import {
    DEFAULT_GENERATE_DAYS_BEFORE,
    type ReportDeadlineRule,
    type ReportPriority,
    type ReportSchedule,
    type ReportScheduleFrequency,
} from "@/types/report";

const SCHEDULE_SELECT = `
    *,
    category:report_categories(*),
    assigned_profile:profiles!report_schedules_assigned_to_fkey(id, full_name, username, role),
    created_profile:profiles!report_schedules_created_by_fkey(id, full_name, username, role)
`;

async function getCurrentUserWithRole() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { supabase, user: null, role: null as string | null };

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    return {
        supabase,
        user,
        role: (profile?.role as string) || "user",
    };
}

export async function getReportSchedules() {
    const { supabase, user } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized", data: [] as ReportSchedule[] };

    const { data, error } = await supabase
        .from("report_schedules")
        .select(SCHEDULE_SELECT)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching report schedules:", error);
        return { success: false, error: error.message, data: [] as ReportSchedule[] };
    }

    return { success: true, data: (data || []) as ReportSchedule[] };
}

export interface SaveReportScheduleInput {
    id?: string | null;
    title_template: string;
    report_number_prefix?: string | null;
    category_id?: string | null;
    description?: string | null;
    priority: ReportPriority;
    assigned_to?: string | null;
    frequency: ReportScheduleFrequency;
    deadline_rule: ReportDeadlineRule;
    deadline_day: number;
    deadline_month?: number | null;
    generate_days_before: number;
    is_active: boolean;
}

export async function saveReportSchedule(input: SaveReportScheduleInput) {
    const { supabase, user } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };

    const title_template = input.title_template.trim();
    if (!title_template) {
        return { success: false, error: "Nama template laporan wajib diisi." };
    }

    const deadline_day = Math.min(31, Math.max(1, Number(input.deadline_day) || 25));
    const deadline_month =
        input.frequency === "yearly"
            ? Math.min(12, Math.max(1, Number(input.deadline_month) || 12))
            : null;
    const generate_days_before = Math.min(
        365,
        Math.max(
            0,
            Number.isFinite(Number(input.generate_days_before))
                ? Number(input.generate_days_before)
                : DEFAULT_GENERATE_DAYS_BEFORE[input.frequency]
        )
    );

    const nowIso = new Date().toISOString();
    const payload = {
        title_template,
        report_number_prefix: input.report_number_prefix?.trim() || null,
        category_id: input.category_id || null,
        description: input.description?.trim() || null,
        priority: input.priority || "normal",
        assigned_to: input.assigned_to || null,
        frequency: input.frequency,
        deadline_rule: input.deadline_rule,
        deadline_day,
        deadline_month,
        generate_days_before,
        is_active: input.is_active,
        updated_by: user.id,
        updated_at: nowIso,
    };

    let result;
    if (input.id) {
        result = await supabase
            .from("report_schedules")
            .update(payload)
            .eq("id", input.id)
            .select(SCHEDULE_SELECT)
            .single();
    } else {
        result = await supabase
            .from("report_schedules")
            .insert([{ ...payload, created_by: user.id }])
            .select(SCHEDULE_SELECT)
            .single();
    }

    if (result.error) {
        console.error("Error saving report schedule:", result.error);
        return { success: false, error: result.error.message };
    }

    revalidatePath("/reports/schedules");
    return { success: true, data: result.data as ReportSchedule };
}

export async function toggleReportScheduleActive(id: string, isActive: boolean) {
    const { supabase, user } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };

    const { error } = await supabase
        .from("report_schedules")
        .update({
            is_active: isActive,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id);

    if (error) {
        console.error("Error toggling report schedule:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/reports/schedules");
    return { success: true };
}

export async function deleteReportSchedule(id: string) {
    const { supabase, user, role } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!["admin", "manager_it"].includes(role || "")) {
        return {
            success: false,
            error: "Hanya Admin atau Manager IT yang dapat menghapus jadwal rutin.",
        };
    }

    const { error } = await supabase.from("report_schedules").delete().eq("id", id);
    if (error) {
        console.error("Error deleting report schedule:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/reports/schedules");
    return { success: true };
}

export async function runScheduleGenerator(params?: {
    scheduleId?: string;
    force?: boolean;
}) {
    const { user } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };

    const res = await generateScheduledReports({
        scheduleId: params?.scheduleId,
        force: params?.force ?? false,
        triggeredByUserId: user.id,
    });

    revalidatePath("/reports");
    revalidatePath("/reports/calendar");
    revalidatePath("/reports/schedules");
    return res;
}
