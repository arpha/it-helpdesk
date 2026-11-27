export type ReportStatus =
    | "pending"
    | "draft"
    | "submitted"
    | "review"
    | "revision"
    | "approved"
    | "rejected"
    | "overdue";

export type ReportPriority = "low" | "normal" | "high" | "urgent";

export type ReportPeriodType =
    | "daily"
    | "weekly"
    | "monthly"
    | "quarterly"
    | "semiannual"
    | "yearly"
    | "incidental";

export type ReportScheduleFrequency = "monthly" | "quarterly" | "semiannual" | "yearly";

export type ReportDeadlineRule = "fixed_day" | "end_of_period" | "next_month_day";

export interface ReportSchedule {
    id: string;
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
    last_generated_period?: string | null;
    last_generated_at?: string | null;
    created_by?: string | null;
    updated_by?: string | null;
    created_at: string;
    updated_at: string;

    // Joined relations
    category?: ReportCategory | null;
    assigned_profile?: ReportProfile | null;
    created_profile?: ReportProfile | null;
}

export type ReportLogAction =
    | "created"
    | "updated"
    | "submitted"
    | "reviewed"
    | "approved"
    | "rejected"
    | "revision_requested"
    | "deleted"
    | "file_uploaded"
    | "file_replaced";

export interface ReportCategory {
    id: string;
    name: string;
    description?: string | null;
    color: string;
    created_at: string;
    updated_at: string;
}

export interface ReportProfile {
    id: string;
    full_name?: string | null;
    username?: string | null;
    role?: string | null;
}

export interface ReportAttachment {
    url: string;
    name: string;
    size: number;
    type?: string | null;
    uploaded_at?: string;
    provider?: "supabase" | "gdrive";
    drive_file_id?: string | null;
    preview_url?: string | null;
}

export interface Report {
    id: string;
    title: string;
    report_number?: string | null;
    category_id?: string | null;
    description?: string | null;

    period_type: ReportPeriodType;
    period_start?: string | null;
    period_end?: string | null;

    deadline: string; // YYYY-MM-DD
    submitted_at?: string | null;
    reviewed_at?: string | null;
    approved_at?: string | null;

    status: ReportStatus;
    priority: ReportPriority;

    assigned_to?: string | null;
    reviewed_by?: string | null;
    approved_by?: string | null;

    file_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    file_type?: string | null;
    attachments?: ReportAttachment[] | null;

    reviewer_notes?: string | null;
    revision_notes?: string | null;

    created_by?: string | null;
    created_at: string;
    updated_at: string;

    // Joined relations
    category?: ReportCategory | null;
    assigned_profile?: ReportProfile | null;
    created_profile?: ReportProfile | null;
    reviewed_profile?: ReportProfile | null;
    approved_profile?: ReportProfile | null;
}

export interface ReportLogChange {
    old: unknown;
    new: unknown;
}

export interface ReportLog {
    id: string;
    report_id: string;
    action: ReportLogAction;
    performed_by?: string | null;
    notes?: string | null;
    changes?: Record<string, ReportLogChange> | null;
    ip_address?: string | null;
    created_at: string;
    performer?: ReportProfile | null;
}

export interface ReportStats {
    total: number;
    pending: number;
    dueSoon: number;
    overdue: number;
    approved: number;
}

export interface ReportFilterParams {
    search?: string;
    category_id?: string;
    status?: string;
    period_type?: string;
    priority?: string;
    assigned_to?: string;
    page?: number;
    pageSize?: number;
}

export const SIMPLE_REPORT_STATUSES: ReportStatus[] = [
    "pending",
    "draft",
    "approved",
    "overdue",
];

export const FORM_REPORT_STATUSES: { value: ReportStatus; label: string }[] = [
    { value: "pending", label: "Belum Selesai" },
    { value: "draft", label: "Sedang Dikerjakan" },
    { value: "approved", label: "Selesai (Terarsip)" },
];

export const REPORT_STATUS_CONFIG: Record<
    ReportStatus,
    { label: string; badgeClass: string; dotClass: string }
> = {
    pending: {
        label: "Belum Selesai",
        badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
        dotClass: "bg-slate-500",
    },
    draft: {
        label: "Sedang Dikerjakan",
        badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
        dotClass: "bg-amber-500",
    },
    submitted: {
        label: "Terkumpul",
        badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
        dotClass: "bg-sky-500",
    },
    review: {
        label: "Diproses",
        badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
        dotClass: "bg-indigo-500",
    },
    revision: {
        label: "Perlu Diperbarui",
        badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
        dotClass: "bg-orange-500",
    },
    approved: {
        label: "Selesai",
        badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        dotClass: "bg-emerald-500",
    },
    rejected: {
        label: "Dibatalkan",
        badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
        dotClass: "bg-rose-500",
    },
    overdue: {
        label: "Terlambat",
        badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40",
        dotClass: "bg-red-500",
    },
};

export const REPORT_PRIORITY_CONFIG: Record<
    ReportPriority,
    { label: string; badgeClass: string }
> = {
    low: {
        label: "Rendah",
        badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
    },
    normal: {
        label: "Normal",
        badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    },
    high: {
        label: "Tinggi",
        badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
    },
    urgent: {
        label: "Mendesak",
        badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40",
    },
};

export const REPORT_PERIOD_LABELS: Record<ReportPeriodType, string> = {
    daily: "Harian",
    weekly: "Mingguan",
    monthly: "Bulanan",
    quarterly: "Triwulanan",
    semiannual: "Semesteran",
    yearly: "Tahunan",
    incidental: "Insidental",
};

export const SCHEDULE_FREQUENCY_LABELS: Record<ReportScheduleFrequency, string> = {
    monthly: "Bulanan",
    quarterly: "Triwulanan",
    semiannual: "Semesteran",
    yearly: "Tahunan",
};

export const DEFAULT_GENERATE_DAYS_BEFORE: Record<ReportScheduleFrequency, number> = {
    monthly: 28,
    quarterly: 84,
    semiannual: 168,
    yearly: 336,
};

export const INDONESIAN_MONTHS = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
] as const;

export const CATEGORY_COLOR_CLASSES: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
    gray: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
};

export const REPORT_FIELD_LABELS: Record<string, string> = {
    title: "Judul Laporan",
    report_number: "Nomor Laporan",
    category_id: "Kategori",
    description: "Keterangan",
    period_type: "Tipe Periode",
    period_start: "Periode Awal",
    period_end: "Periode Akhir",
    deadline: "Deadline",
    status: "Status",
    priority: "Prioritas",
    assigned_to: "PIC",
    file_name: "File Lampiran",
    attachments: "Daftar Lampiran",
    reviewer_notes: "Catatan Reviewer",
    revision_notes: "Catatan Revisi",
};

export const REPORT_LOG_ACTION_LABELS: Record<
    ReportLogAction,
    { label: string; dotClass: string; badgeClass: string }
> = {
    created: {
        label: "Dibuat",
        dotClass: "bg-emerald-500",
        badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    updated: {
        label: "Diperbarui",
        dotClass: "bg-amber-500",
        badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    submitted: {
        label: "Disubmit",
        dotClass: "bg-sky-500",
        badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    reviewed: {
        label: "Mulai Review",
        dotClass: "bg-indigo-500",
        badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    },
    approved: {
        label: "Ditandai Selesai",
        dotClass: "bg-emerald-600",
        badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    rejected: {
        label: "Ditolak",
        dotClass: "bg-rose-500",
        badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
    revision_requested: {
        label: "Revisi Diminta",
        dotClass: "bg-orange-500",
        badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    },
    deleted: {
        label: "Dihapus",
        dotClass: "bg-red-600",
        badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
    file_uploaded: {
        label: "File Diunggah",
        dotClass: "bg-blue-500",
        badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    file_replaced: {
        label: "File Diganti",
        dotClass: "bg-purple-500",
        badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
};

export type DeadlineLevel =
    | "completed"
    | "safe"
    | "approaching"
    | "urgent"
    | "today"
    | "overdue";

export interface DeadlineInfo {
    level: DeadlineLevel;
    daysLeft: number;
    label: string;
    shortLabel: string;
    textClass: string;
    badgeClass: string;
    dotClass: string;
    pulse?: boolean;
}

/**
 * Hitung status efektif laporan (auto-flag overdue jika deadline terlewat & belum selesai/disubmit)
 */
export function getEffectiveStatus(report: Pick<Report, "status" | "deadline">): ReportStatus {
    if (
        report.status === "approved" ||
        report.status === "rejected" ||
        report.status === "submitted" ||
        report.status === "review"
    ) {
        return report.status;
    }

    const daysLeft = getDaysUntilDeadline(report.deadline);
    if (daysLeft < 0) {
        return "overdue";
    }
    return report.status;
}

/**
 * Selisih hari dari hari ini ke tanggal deadline (YYYY-MM-DD)
 */
export function getDaysUntilDeadline(deadline: string): number {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [year, month, day] = deadline.split("-").map(Number);
    const target = new Date(year, (month || 1) - 1, day || 1);
    const diffMs = target.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Informasi warna & label indikator deadline sesuai spesifikasi plan
 */
export function getDeadlineInfo(deadline: string, status: ReportStatus): DeadlineInfo {
    const daysLeft = getDaysUntilDeadline(deadline);

    if (status === "approved") {
        return {
            level: "completed",
            daysLeft,
            label: "Selesai",
            shortLabel: "Selesai",
            textClass: "text-blue-600 dark:text-blue-400",
            badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
            dotClass: "bg-blue-500",
        };
    }

    if (daysLeft < 0) {
        const overdueDays = Math.abs(daysLeft);
        return {
            level: "overdue",
            daysLeft,
            label: `Terlambat ${overdueDays} hari`,
            shortLabel: "TERLAMBAT",
            textClass: "text-red-600 dark:text-red-400 font-semibold",
            badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40",
            dotClass: "bg-red-500",
            pulse: true,
        };
    }

    if (daysLeft === 0) {
        return {
            level: "today",
            daysLeft,
            label: "Hari Ini!",
            shortLabel: "Hari Ini!",
            textClass: "text-orange-600 dark:text-orange-400 font-semibold",
            badgeClass: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/40",
            dotClass: "bg-orange-500",
            pulse: true,
        };
    }

    if (daysLeft <= 2) {
        return {
            level: "urgent",
            daysLeft,
            label: `Mendesak (${daysLeft} hari)`,
            shortLabel: `${daysLeft} hari lagi`,
            textClass: "text-orange-600 dark:text-orange-400 font-medium",
            badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
            dotClass: "bg-orange-500",
        };
    }

    if (daysLeft <= 7) {
        return {
            level: "approaching",
            daysLeft,
            label: `Mendekati (${daysLeft} hari)`,
            shortLabel: `${daysLeft} hari lagi`,
            textClass: "text-amber-600 dark:text-amber-400",
            badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
            dotClass: "bg-amber-500",
        };
    }

    return {
        level: "safe",
        daysLeft,
        label: `Aman (${daysLeft} hari)`,
        shortLabel: `${daysLeft} hari lagi`,
        textClass: "text-emerald-600 dark:text-emerald-400",
        badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        dotClass: "bg-emerald-500",
    };
}

export function formatFileSize(bytes?: number | null): string {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Ambil daftar lampiran laporan secara konsisten (mendukung multi-file & fallback legacy single file)
 */
export function getReportAttachments(
    report?: Pick<Report, "attachments" | "file_url" | "file_name" | "file_size" | "file_type"> | null
): ReportAttachment[] {
    if (!report) return [];
    if (Array.isArray(report.attachments) && report.attachments.length > 0) {
        return report.attachments;
    }
    if (report.file_url) {
        return [
            {
                url: report.file_url,
                name: report.file_name || "Lampiran Laporan",
                size: report.file_size || 0,
                type: report.file_type || null,
            },
        ];
    }
    return [];
}
