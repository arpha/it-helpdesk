"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReportDetail } from "@/hooks/api/use-reports";
import { sendManualReportReminder } from "../actions";
import { ReportCompleteDialog } from "./report-complete-dialog";
import { toast } from "sonner";
import {
    ArrowRight,
    BellRing,
    Calendar,
    CheckCircle2,
    Clock,
    Download,
    Edit3,
    FileText,
    History,
    Loader2,
    ShieldCheck,
    User,
} from "lucide-react";
import {
    CATEGORY_COLOR_CLASSES,
    REPORT_FIELD_LABELS,
    REPORT_LOG_ACTION_LABELS,
    REPORT_PERIOD_LABELS,
    REPORT_PRIORITY_CONFIG,
    REPORT_STATUS_CONFIG,
    formatFileSize,
    getDeadlineInfo,
    getEffectiveStatus,
    getReportAttachments,
    type Report,
    type ReportLog,
} from "@/types/report";

interface ReportDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reportId: string | null;
    canSendWa: boolean;
    onEdit: (report: Report) => void;
    onUpdated: () => void;
}

function formatDateID(dateStr?: string | null) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function formatDateTimeID(dateStr?: string | null) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDiffValue(val: unknown): string {
    if (val === null || val === undefined || val === "") return "(kosong)";
    return String(val);
}

export function ReportDetailDialog({
    open,
    onOpenChange,
    reportId,
    canSendWa,
    onEdit,
    onUpdated,
}: ReportDetailDialogProps) {
    const { data, isLoading, refetch } = useReportDetail(open ? reportId : null);
    const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
    const [isSendingWa, setIsSendingWa] = useState(false);

    const report = data?.report;
    const logs = data?.logs || [];

    const handleSendWaReminder = async () => {
        if (!report) return;
        setIsSendingWa(true);
        try {
            const res = await sendManualReportReminder(report.id);
            if (res.success) {
                toast.success(
                    `Pengingat WA berhasil dikirim ke ${"picName" in res && res.picName ? res.picName : "PIC"}.`
                );
            } else {
                toast.error(res.error || "Gagal mengirim pengingat WA.");
            }
        } finally {
            setIsSendingWa(false);
        }
    };

    const effectiveStatus = report ? getEffectiveStatus(report) : "pending";
    const statusCfg = REPORT_STATUS_CONFIG[effectiveStatus];
    const priorityCfg = report ? REPORT_PRIORITY_CONFIG[report.priority] : null;
    const deadlineInfo = report
        ? getDeadlineInfo(report.deadline, effectiveStatus)
        : null;

    const canMarkCompleted = report && effectiveStatus !== "approved";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <span className="truncate">
                            {isLoading ? "Memuat detail laporan..." : report?.title || "Detail Laporan"}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {isLoading || !report ? (
                    <div className="space-y-4 py-4">
                        <Skeleton className="h-6 w-2/3" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Header Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                            {report.report_number && (
                                <Badge variant="outline" className="font-mono text-xs">
                                    No: {report.report_number}
                                </Badge>
                            )}
                            <Badge variant="outline" className={statusCfg.badgeClass}>
                                <span
                                    className={`mr-1.5 h-1.5 w-1.5 rounded-full ${statusCfg.dotClass}`}
                                />
                                {statusCfg.label}
                            </Badge>
                            {priorityCfg && (
                                <Badge variant="outline" className={priorityCfg.badgeClass}>
                                    Prioritas: {priorityCfg.label}
                                </Badge>
                            )}
                            {deadlineInfo && (
                                <Badge variant="outline" className={deadlineInfo.badgeClass}>
                                    <Clock className="h-3 w-3 mr-1" />
                                    {deadlineInfo.label}
                                </Badge>
                            )}
                        </div>

                        <Tabs defaultValue="info" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="info" className="gap-1.5">
                                    <FileText className="h-3.5 w-3.5" />
                                    Informasi Laporan
                                </TabsTrigger>
                                <TabsTrigger value="audit" className="gap-1.5">
                                    <History className="h-3.5 w-3.5" />
                                    Audit Trail ({logs.length})
                                </TabsTrigger>
                            </TabsList>

                            {/* TAB 1: INFO */}
                            <TabsContent value="info" className="space-y-4 mt-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-4 text-sm">
                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">Kategori</p>
                                        <div>
                                            {report.category ? (
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        CATEGORY_COLOR_CLASSES[
                                                            report.category.color
                                                        ] || CATEGORY_COLOR_CLASSES.gray
                                                    }
                                                >
                                                    {report.category.name}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">
                                            Periode Pelaporan
                                        </p>
                                        <p className="font-medium">
                                            {REPORT_PERIOD_LABELS[report.period_type]}
                                            {report.period_start || report.period_end
                                                ? ` (${formatDateID(report.period_start)} – ${formatDateID(report.period_end)})`
                                                : ""}
                                        </p>
                                    </div>

                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">
                                            Batas Waktu (Deadline)
                                        </p>
                                        <p className="font-medium flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                            {formatDateID(report.deadline)}
                                        </p>
                                    </div>

                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">
                                            Penanggung Jawab (PIC)
                                        </p>
                                        <p className="font-medium flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                                            {report.assigned_profile?.full_name ||
                                                report.assigned_profile?.username ||
                                                "Belum ditentukan"}
                                        </p>
                                    </div>

                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">Dibuat Oleh</p>
                                        <p className="text-xs font-medium">
                                            {report.created_profile?.full_name ||
                                                report.created_profile?.username ||
                                                "-"}{" "}
                                            • {formatDateTimeID(report.created_at)}
                                        </p>
                                    </div>

                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">
                                            Waktu Selesai
                                        </p>
                                        <p className="text-xs font-medium">
                                            {report.approved_at
                                                ? formatDateTimeID(report.approved_at)
                                                : "Belum selesai"}
                                        </p>
                                    </div>
                                </div>

                                {report.description && (
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            Keterangan
                                        </p>
                                        <p className="text-sm whitespace-pre-wrap rounded-lg border p-3 bg-background">
                                            {report.description}
                                        </p>
                                    </div>
                                )}

                                {/* File Lampiran */}
                                {(() => {
                                    const attachments = getReportAttachments(report);
                                    return (
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                File Lampiran ({attachments.length})
                                            </p>
                                            {attachments.length > 0 ? (
                                                <div className="space-y-2">
                                                    {attachments.map((att, idx) => (
                                                        <div
                                                            key={`${att.url}-${idx}`}
                                                            className="flex items-center justify-between gap-3 rounded-xl border p-3 bg-muted/20"
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <FileText className="h-5 w-5 text-primary shrink-0" />
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium truncate">
                                                                        {att.name ||
                                                                            `Lampiran ${idx + 1}`}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {formatFileSize(att.size)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                asChild
                                                                className="shrink-0"
                                                            >
                                                                <a
                                                                    href={att.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    download={att.name || undefined}
                                                                >
                                                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                                                    Unduh
                                                                </a>
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic rounded-lg border border-dashed p-3">
                                                    Belum ada file lampiran yang diunggah.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })()}
                            </TabsContent>

                            {/* TAB 2: AUDIT TRAIL */}
                            <TabsContent value="audit" className="mt-4">
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 mb-4 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                                    <ShieldCheck className="h-4 w-4 shrink-0" />
                                    <span>
                                        Log keamanan permanen: setiap pembuatan, perubahan field,
                                        upload file, dan approval terekam otomatis.
                                    </span>
                                </div>

                                {logs.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        Belum ada riwayat aktivitas untuk laporan ini.
                                    </p>
                                ) : (
                                    <div className="relative pl-5 space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                                        {logs.map((log: ReportLog) => {
                                            const actionCfg =
                                                REPORT_LOG_ACTION_LABELS[log.action] || {
                                                    label: log.action,
                                                    dotClass: "bg-slate-500",
                                                    badgeClass: "bg-muted text-foreground",
                                                };
                                            const changeEntries = log.changes
                                                ? Object.entries(log.changes)
                                                : [];

                                            return (
                                                <div key={log.id} className="relative">
                                                    <span
                                                        className={`absolute -left-5 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ${actionCfg.dotClass}`}
                                                    />
                                                    <div className="rounded-xl border bg-card p-3 space-y-2">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <Badge
                                                                    variant="secondary"
                                                                    className={`text-[11px] ${actionCfg.badgeClass}`}
                                                                >
                                                                    {actionCfg.label}
                                                                </Badge>
                                                                <span className="text-xs font-semibold">
                                                                    {log.performer?.full_name ||
                                                                        log.performer?.username ||
                                                                        "Sistem"}
                                                                </span>
                                                                {log.performer?.role && (
                                                                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                                                        {log.performer.role}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] text-muted-foreground">
                                                                {formatDateTimeID(log.created_at)}
                                                                {log.ip_address
                                                                    ? ` • IP ${log.ip_address}`
                                                                    : ""}
                                                            </span>
                                                        </div>

                                                        {log.notes && (
                                                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                                                {log.notes}
                                                            </p>
                                                        )}

                                                        {changeEntries.length > 0 && (
                                                            <div className="rounded-lg bg-muted/40 p-2.5 space-y-1.5 text-xs">
                                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                                    Detail Perubahan
                                                                </p>
                                                                {changeEntries.map(
                                                                    ([field, diff]) => (
                                                                        <div
                                                                            key={field}
                                                                            className="flex flex-wrap items-center gap-1.5"
                                                                        >
                                                                            <span className="font-medium text-foreground">
                                                                                {REPORT_FIELD_LABELS[
                                                                                    field
                                                                                ] || field}
                                                                                :
                                                                            </span>
                                                                            <span className="line-through text-muted-foreground bg-destructive/10 px-1.5 py-0.5 rounded">
                                                                                {formatDiffValue(
                                                                                    diff.old
                                                                                )}
                                                                            </span>
                                                                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                            <span className="font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                                                {formatDiffValue(
                                                                                    diff.new
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>

                        <Separator />

                        {/* Action Bar */}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            {canSendWa &&
                                report.assigned_to &&
                                effectiveStatus !== "approved" && (
                                    <Button
                                        variant="outline"
                                        onClick={handleSendWaReminder}
                                        disabled={isSendingWa}
                                        className="text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400"
                                    >
                                        {isSendingWa ? (
                                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                        ) : (
                                            <BellRing className="h-4 w-4 mr-1.5" />
                                        )}
                                        Ingatkan PIC (WA)
                                    </Button>
                                )}

                            <Button
                                variant="outline"
                                onClick={() => {
                                    onOpenChange(false);
                                    onEdit(report);
                                }}
                            >
                                <Edit3 className="h-4 w-4 mr-1.5" />
                                Edit
                            </Button>

                            {canMarkCompleted && (
                                <Button onClick={() => setCompleteDialogOpen(true)}>
                                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                    Tandai Selesai
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>

            <ReportCompleteDialog
                open={completeDialogOpen}
                onOpenChange={setCompleteDialogOpen}
                report={report || null}
                onUploadNow={(rep) => {
                    onOpenChange(false);
                    onEdit(rep);
                }}
                onSuccess={async () => {
                    await refetch();
                    onUpdated();
                }}
            />
        </Dialog>
    );
}
