import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhoneNumber, sendWhatsAppMessage } from "@/lib/fonnte/client";
import { REPORT_STATUS_CONFIG, type ReportStatus } from "@/types/report";

export type ReminderType = "h_minus_7" | "h_minus_3" | "overdue" | "manual";

export interface ReminderDetailItem {
    reportId: string;
    title: string;
    reminderType: ReminderType;
    picName: string;
    phone: string | null;
    outcome: "sent" | "skipped_already_sent" | "skipped_no_phone" | "failed";
    reason?: string;
}

export interface ProcessRemindersResult {
    success: boolean;
    dateWib: string;
    totalChecked: number;
    eligible: number;
    sent: number;
    skippedAlreadySent: number;
    skippedNoPhone: number;
    failed: number;
    details: ReminderDetailItem[];
    error?: string;
}

interface ReportWithPic {
    id: string;
    title: string;
    report_number: string | null;
    deadline: string;
    status: ReportStatus;
    assigned_to: string | null;
    category: { name: string } | null;
    assigned_profile: {
        id: string;
        full_name: string | null;
        username: string | null;
        whatsapp_phone: string | null;
    } | null;
}

/**
 * Ambil tanggal hari ini dalam timezone Asia/Jakarta (WIB / UTC+7) berformat YYYY-MM-DD
 */
function getTodayWibDateString(): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return formatter.format(new Date()); // YYYY-MM-DD
}

function parseYmdToUtcMs(ymd: string): number {
    const [y, m, d] = ymd.split("-").map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
}

function getDaysDiffFromWibToday(deadlineYmd: string, todayWibYmd: string): number {
    const diffMs = parseYmdToUtcMs(deadlineYmd) - parseYmdToUtcMs(todayWibYmd);
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function formatDateIndonesian(ymd: string): string {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    return dt.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });
}

function buildReminderMessage(params: {
    report: ReportWithPic;
    reminderType: ReminderType;
    daysLeft: number;
}): string {
    const { report, reminderType, daysLeft } = params;
    const picName =
        report.assigned_profile?.full_name ||
        report.assigned_profile?.username ||
        "Rekan";
    const statusLabel = REPORT_STATUS_CONFIG[report.status]?.label || report.status;
    const deadlineFormatted = formatDateIndonesian(report.deadline);
    const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://it-helpdesk-sage.vercel.app";

    let header = "📋 *PENGINGAT LAPORAN — SI-Mantap*";
    let urgencyLine = "";

    if (reminderType === "h_minus_7") {
        header = "⏰ *PENGINGAT DEADLINE LAPORAN (H-7)*";
        urgencyLine = "Batas waktu penyerahan tinggal *7 hari lagi*.";
    } else if (reminderType === "h_minus_3") {
        header = "⚠️ *PENGINGAT MENDESAK LAPORAN (H-3)*";
        urgencyLine = "Batas waktu penyerahan tinggal *3 hari lagi*. Mohon segera disiapkan dan disubmit.";
    } else if (reminderType === "overdue") {
        const overdueDays = Math.abs(daysLeft);
        header = "🚨 *LAPORAN MELEWATI DEADLINE*";
        urgencyLine = `Laporan ini sudah *terlambat ${overdueDays} hari* dari batas waktu. Mohon segera diselesaikan.`;
    } else {
        header = "📢 *PENGINGAT DEADLINE LAPORAN*";
        if (daysLeft < 0) {
            urgencyLine = `Laporan ini sudah *terlambat ${Math.abs(daysLeft)} hari* dari batas waktu.`;
        } else if (daysLeft === 0) {
            urgencyLine = "Batas waktu penyerahan laporan adalah *HARI INI*.";
        } else {
            urgencyLine = `Batas waktu penyerahan tinggal *${daysLeft} hari lagi*.`;
        }
    }

    const lines = [
        header,
        "",
        `Halo *${picName}*,`,
        urgencyLine,
        "",
        `*Judul:* ${report.title}`,
        report.report_number ? `*No. Laporan:* ${report.report_number}` : null,
        report.category?.name ? `*Kategori:* ${report.category.name}` : null,
        `*Deadline:* ${deadlineFormatted}`,
        `*Status Saat Ini:* ${statusLabel}`,
        "",
        `Silakan akses dan perbarui laporan di:`,
        `${appUrl}/reports`,
        "",
        "_Pesan otomatis dari SI-Mantap IT Helpdesk._",
    ].filter((line): line is string => line !== null);

    return lines.join("\n");
}

/**
 * Proses pengecekan dan pengiriman notifikasi WA untuk semua laporan yang memenuhi:
 * - Sisa 7 hari (H-7)
 * - Sisa 3 hari (H-3)
 * - Sudah lewat deadline (Overdue)
 */
export async function processReportDeadlineReminders(options?: {
    dryRun?: boolean;
}): Promise<ProcessRemindersResult> {
    const todayWib = getTodayWibDateString();
    const dryRun = options?.dryRun === true;

    try {
        const supabase = createAdminClient();

        // Ambil semua laporan yang belum selesai/disubmit dan memiliki PIC
        const { data: reports, error } = await supabase
            .from("reports")
            .select(
                `
                id,
                title,
                report_number,
                deadline,
                status,
                assigned_to,
                category:report_categories(name),
                assigned_profile:profiles!reports_assigned_to_fkey(id, full_name, username, whatsapp_phone)
            `
            )
            .in("status", ["pending", "draft", "revision", "overdue"])
            .not("assigned_to", "is", null);

        if (error) {
            return {
                success: false,
                dateWib: todayWib,
                totalChecked: 0,
                eligible: 0,
                sent: 0,
                skippedAlreadySent: 0,
                skippedNoPhone: 0,
                failed: 0,
                details: [],
                error: error.message,
            };
        }

        const typedReports = (reports || []) as unknown as ReportWithPic[];
        const details: ReminderDetailItem[] = [];
        let eligible = 0;
        let sent = 0;
        let skippedAlreadySent = 0;
        let skippedNoPhone = 0;
        let failed = 0;

        // Filter laporan yang tepat H-7, H-3, atau Overdue (< 0)
        const candidates: Array<{
            report: ReportWithPic;
            reminderType: "h_minus_7" | "h_minus_3" | "overdue";
            daysLeft: number;
        }> = [];

        for (const report of typedReports) {
            if (!report.deadline) continue;
            const daysLeft = getDaysDiffFromWibToday(report.deadline, todayWib);

            if (daysLeft === 7) {
                candidates.push({ report, reminderType: "h_minus_7", daysLeft });
            } else if (daysLeft === 3) {
                candidates.push({ report, reminderType: "h_minus_3", daysLeft });
            } else if (daysLeft < 0) {
                candidates.push({ report, reminderType: "overdue", daysLeft });
            }
        }

        eligible = candidates.length;

        if (candidates.length === 0) {
            return {
                success: true,
                dateWib: todayWib,
                totalChecked: typedReports.length,
                eligible: 0,
                sent: 0,
                skippedAlreadySent: 0,
                skippedNoPhone: 0,
                failed: 0,
                details: [],
            };
        }

        // Ambil log pengingat yang sudah pernah terkirim untuk laporan kandidat
        const candidateIds = candidates.map((c) => c.report.id);
        const { data: existingLogs } = await supabase
            .from("report_reminder_logs")
            .select("report_id, reminder_type, deadline_snapshot, sent_date, status")
            .in("report_id", candidateIds)
            .eq("status", "sent");

        const sentLogs = existingLogs || [];

        for (const { report, reminderType, daysLeft } of candidates) {
            const picName =
                report.assigned_profile?.full_name ||
                report.assigned_profile?.username ||
                "Tanpa Nama";
            const rawPhone = report.assigned_profile?.whatsapp_phone?.trim() || null;

            // Cek anti-duplikat:
            // H-7, H-3, dan Overdue masing-masing hanya dikirim 1x per (report_id, reminder_type, deadline_snapshot)
            const alreadySent = sentLogs.some(
                (log) =>
                    log.report_id === report.id &&
                    log.reminder_type === reminderType &&
                    log.deadline_snapshot === report.deadline
            );

            if (alreadySent) {
                skippedAlreadySent++;
                details.push({
                    reportId: report.id,
                    title: report.title,
                    reminderType,
                    picName,
                    phone: rawPhone,
                    outcome: "skipped_already_sent",
                });
                continue;
            }

            if (!rawPhone) {
                skippedNoPhone++;
                details.push({
                    reportId: report.id,
                    title: report.title,
                    reminderType,
                    picName,
                    phone: null,
                    outcome: "skipped_no_phone",
                    reason: "PIC belum memiliki nomor WhatsApp di profil",
                });
                continue;
            }

            const formattedPhone = formatPhoneNumber(rawPhone);
            const message = buildReminderMessage({ report, reminderType, daysLeft });

            if (dryRun) {
                sent++;
                details.push({
                    reportId: report.id,
                    title: report.title,
                    reminderType,
                    picName,
                    phone: formattedPhone,
                    outcome: "sent",
                    reason: "dry-run",
                });
                continue;
            }

            const sendResult = await sendWhatsAppMessage({
                target: formattedPhone,
                message,
            });

            await supabase.from("report_reminder_logs").insert([
                {
                    report_id: report.id,
                    reminder_type: reminderType,
                    deadline_snapshot: report.deadline,
                    sent_date: todayWib,
                    recipient_id: report.assigned_to,
                    recipient_phone: formattedPhone,
                    status: sendResult.status ? "sent" : "failed",
                    provider_response: sendResult.detail || sendResult.id || null,
                },
            ]);

            if (sendResult.status) {
                sent++;
                details.push({
                    reportId: report.id,
                    title: report.title,
                    reminderType,
                    picName,
                    phone: formattedPhone,
                    outcome: "sent",
                });
            } else {
                failed++;
                details.push({
                    reportId: report.id,
                    title: report.title,
                    reminderType,
                    picName,
                    phone: formattedPhone,
                    outcome: "failed",
                    reason: sendResult.detail || "Gagal mengirim pesan WhatsApp",
                });
            }
        }

        return {
            success: true,
            dateWib: todayWib,
            totalChecked: typedReports.length,
            eligible,
            sent,
            skippedAlreadySent,
            skippedNoPhone,
            failed,
            details,
        };
    } catch (err) {
        console.error("Error processing report deadline reminders:", err);
        return {
            success: false,
            dateWib: todayWib,
            totalChecked: 0,
            eligible: 0,
            sent: 0,
            skippedAlreadySent: 0,
            skippedNoPhone: 0,
            failed: 0,
            details: [],
            error: err instanceof Error ? err.message : "Unknown error",
        };
    }
}

/**
 * Kirim pengingat WA manual untuk satu laporan spesifik
 */
export async function sendSingleReportReminder(reportId: string): Promise<{
    success: boolean;
    error?: string;
    picName?: string;
    phone?: string;
}> {
    const todayWib = getTodayWibDateString();
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from("reports")
        .select(
            `
            id,
            title,
            report_number,
            deadline,
            status,
            assigned_to,
            category:report_categories(name),
            assigned_profile:profiles!reports_assigned_to_fkey(id, full_name, username, whatsapp_phone)
        `
        )
        .eq("id", reportId)
        .single();

    if (error || !data) {
        return { success: false, error: "Laporan tidak ditemukan." };
    }

    const report = data as unknown as ReportWithPic;
    const picName =
        report.assigned_profile?.full_name ||
        report.assigned_profile?.username ||
        "PIC";
    const rawPhone = report.assigned_profile?.whatsapp_phone?.trim();

    if (!report.assigned_to) {
        return { success: false, error: "Laporan belum memiliki PIC yang ditugaskan." };
    }

    if (!rawPhone) {
        return {
            success: false,
            error: `${picName} belum memiliki nomor WhatsApp di profil pengguna.`,
        };
    }

    const daysLeft = getDaysDiffFromWibToday(report.deadline, todayWib);
    const formattedPhone = formatPhoneNumber(rawPhone);
    const message = buildReminderMessage({
        report,
        reminderType: "manual",
        daysLeft,
    });

    const sendResult = await sendWhatsAppMessage({
        target: formattedPhone,
        message,
    });

    await supabase.from("report_reminder_logs").insert([
        {
            report_id: report.id,
            reminder_type: "manual",
            deadline_snapshot: report.deadline,
            sent_date: todayWib,
            recipient_id: report.assigned_to,
            recipient_phone: formattedPhone,
            status: sendResult.status ? "sent" : "failed",
            provider_response: sendResult.detail || sendResult.id || null,
        },
    ]);

    if (!sendResult.status) {
        return {
            success: false,
            error: sendResult.detail || "Gagal mengirim pesan WhatsApp via Fonnte.",
        };
    }

    return { success: true, picName, phone: formattedPhone };
}
