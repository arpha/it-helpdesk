import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportSchedule } from "@/types/report";
import {
    getCandidateOccurrences,
    getNextOccurrencePreview,
    getTodayWibYmd,
} from "./schedule-utils";

export interface GenerateSchedulesDetail {
    scheduleId: string;
    titleTemplate: string;
    periodKey: string;
    generatedTitle: string;
    deadline: string;
    outcome: "generated" | "skipped_exists" | "skipped_not_due" | "error";
    reason?: string;
}

export interface GenerateSchedulesResult {
    success: boolean;
    dateWib: string;
    totalSchedules: number;
    generated: number;
    skippedAlreadyExists: number;
    skippedNotDueYet: number;
    failed: number;
    details: GenerateSchedulesDetail[];
    error?: string;
}

/**
 * Jalankan auto-generator untuk membuat laporan rutin (Bulanan, Triwulanan, Tahunan)
 * yang masuk jendela H-N sebelum deadline (atau force = true untuk membuat periode terdekat secara manual)
 */
export async function generateScheduledReports(options?: {
    scheduleId?: string;
    force?: boolean;
    triggeredByUserId?: string | null;
}): Promise<GenerateSchedulesResult> {
    const todayWib = getTodayWibYmd();
    const force = options?.force === true;

    try {
        const supabase = createAdminClient();

        let query = supabase.from("report_schedules").select("*");
        if (options?.scheduleId) {
            query = query.eq("id", options.scheduleId);
        } else {
            query = query.eq("is_active", true);
        }

        const { data: schedules, error } = await query.order("created_at", { ascending: true });

        if (error) {
            return {
                success: false,
                dateWib: todayWib,
                totalSchedules: 0,
                generated: 0,
                skippedAlreadyExists: 0,
                skippedNotDueYet: 0,
                failed: 0,
                details: [],
                error: error.message,
            };
        }

        const typedSchedules = (schedules || []) as ReportSchedule[];
        const details: GenerateSchedulesDetail[] = [];
        let generated = 0;
        let skippedAlreadyExists = 0;
        let skippedNotDueYet = 0;
        let failed = 0;

        for (const schedule of typedSchedules) {
            const candidates = getCandidateOccurrences(schedule, todayWib);

            const targets = force
                ? [getNextOccurrencePreview(schedule, todayWib)]
                : candidates.filter(
                      (c) => todayWib >= c.generateOnDate && c.deadline >= todayWib
                  );

            if (targets.length === 0) {
                const next = getNextOccurrencePreview(schedule, todayWib);
                skippedNotDueYet++;
                details.push({
                    scheduleId: schedule.id,
                    titleTemplate: schedule.title_template,
                    periodKey: next.periodKey,
                    generatedTitle: next.title,
                    deadline: next.deadline,
                    outcome: "skipped_not_due",
                    reason: `Dijadwalkan dibuat mulai ${next.generateOnDate}`,
                });
                continue;
            }

            for (const occ of targets) {
                const { data: existing } = await supabase
                    .from("reports")
                    .select("id")
                    .eq("schedule_id", schedule.id)
                    .eq("period_key", occ.periodKey)
                    .maybeSingle();

                if (existing) {
                    skippedAlreadyExists++;
                    details.push({
                        scheduleId: schedule.id,
                        titleTemplate: schedule.title_template,
                        periodKey: occ.periodKey,
                        generatedTitle: occ.title,
                        deadline: occ.deadline,
                        outcome: "skipped_exists",
                    });
                    continue;
                }

                const reportNumber = schedule.report_number_prefix
                    ? `${schedule.report_number_prefix}/${occ.periodKey}`
                    : null;

                const nowIso = new Date().toISOString();
                const creatorId = options?.triggeredByUserId || schedule.created_by || null;

                const { data: createdReport, error: insertError } = await supabase
                    .from("reports")
                    .insert([
                        {
                            title: occ.title,
                            report_number: reportNumber,
                            category_id: schedule.category_id || null,
                            description: schedule.description || null,
                            period_type: schedule.frequency,
                            period_start: occ.periodStart,
                            period_end: occ.periodEnd,
                            deadline: occ.deadline,
                            status: "pending",
                            priority: schedule.priority || "normal",
                            assigned_to: schedule.assigned_to || null,
                            schedule_id: schedule.id,
                            period_key: occ.periodKey,
                            created_by: creatorId,
                            updated_at: nowIso,
                        },
                    ])
                    .select("id")
                    .single();

                if (insertError || !createdReport) {
                    failed++;
                    details.push({
                        scheduleId: schedule.id,
                        titleTemplate: schedule.title_template,
                        periodKey: occ.periodKey,
                        generatedTitle: occ.title,
                        deadline: occ.deadline,
                        outcome: "error",
                        reason: insertError?.message || "Gagal membuat laporan rutin",
                    });
                    continue;
                }

                await supabase.from("report_logs").insert([
                    {
                        report_id: createdReport.id,
                        action: "created",
                        performed_by: creatorId,
                        notes: force
                            ? `Dibuat manual dari Jadwal Rutin (${occ.periodLabel}).`
                            : `Dibuat otomatis dari Jadwal Rutin (${occ.periodLabel}).`,
                        changes: {
                            title: { old: null, new: occ.title },
                            deadline: { old: null, new: occ.deadline },
                            status: { old: null, new: "pending" },
                        },
                    },
                ]);

                await supabase
                    .from("report_schedules")
                    .update({
                        last_generated_period: occ.periodKey,
                        last_generated_at: nowIso,
                        updated_at: nowIso,
                    })
                    .eq("id", schedule.id);

                generated++;
                details.push({
                    scheduleId: schedule.id,
                    titleTemplate: schedule.title_template,
                    periodKey: occ.periodKey,
                    generatedTitle: occ.title,
                    deadline: occ.deadline,
                    outcome: "generated",
                });
            }
        }

        return {
            success: true,
            dateWib: todayWib,
            totalSchedules: typedSchedules.length,
            generated,
            skippedAlreadyExists,
            skippedNotDueYet,
            failed,
            details,
        };
    } catch (err) {
        console.error("Error generating scheduled reports:", err);
        return {
            success: false,
            dateWib: todayWib,
            totalSchedules: 0,
            generated: 0,
            skippedAlreadyExists: 0,
            skippedNotDueYet: 0,
            failed: 0,
            details: [],
            error: err instanceof Error ? err.message : "Unknown error",
        };
    }
}
