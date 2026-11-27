"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markReportCompleted } from "../actions";
import { ReportFilePreviewDialog } from "./report-file-preview-dialog";
import { toast } from "sonner";
import {
    AlertTriangle,
    CheckCircle2,
    Eye,
    FileText,
    Loader2,
    Upload,
} from "lucide-react";
import {
    formatFileSize,
    getReportAttachments,
    type Report,
} from "@/types/report";

interface ReportCompleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    report: Report | null;
    onUploadNow: (report: Report) => void;
    onSuccess: () => void;
}

export function ReportCompleteDialog({
    open,
    onOpenChange,
    report,
    onUploadNow,
    onSuccess,
}: ReportCompleteDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);

    if (!report) return null;

    const attachments = getReportAttachments(report);
    const hasFiles = attachments.length > 0;

    const handleConfirmComplete = async () => {
        if (!hasFiles) {
            toast.error("Minimal 1 file laporan harus diunggah sebelum menandai selesai.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await markReportCompleted(report.id);
            if (res.success) {
                toast.success(`"${report.title}" berhasil ditandai selesai & terarsip.`);
                onOpenChange(false);
                onSuccess();
            } else {
                toast.error(res.error || "Gagal menandai laporan selesai.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[540px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        Konfirmasi Kelengkapan File Laporan
                    </DialogTitle>
                    <DialogDescription>
                        Pastikan seluruh file laporan telah diunggah dengan benar sebelum menandai
                        laporan ini sebagai selesai.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    {/* Ringkasan Laporan */}
                    <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1 text-sm">
                        <p className="font-semibold leading-snug">{report.title}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {report.report_number && (
                                <span className="font-mono">No: {report.report_number}</span>
                            )}
                            <span>
                                PIC:{" "}
                                <strong className="text-foreground">
                                    {report.assigned_profile?.full_name ||
                                        report.assigned_profile?.username ||
                                        "Belum ditentukan"}
                                </strong>
                            </span>
                        </div>
                    </div>

                    {/* Pengecekan File Lampiran */}
                    {hasFiles ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    File Terunggah ({attachments.length})
                                </p>
                                <Badge
                                    variant="outline"
                                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px]"
                                >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    File Tersedia
                                </Badge>
                            </div>

                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                {attachments.map((att, idx) => (
                                    <div
                                        key={`${att.url}-${idx}`}
                                        className="flex items-center justify-between gap-2.5 rounded-lg border bg-card px-3 py-2"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="h-4 w-4 text-primary shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium truncate">
                                                    {att.name || `Lampiran ${idx + 1}`}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {formatFileSize(att.size)}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs shrink-0"
                                            onClick={() => {
                                                setPreviewIndex(idx);
                                                setPreviewOpen(true);
                                            }}
                                        >
                                            <Eye className="h-3.5 w-3.5 mr-1" />
                                            Lihat
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3 text-red-700 dark:text-red-300">
                            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div className="space-y-1 text-xs">
                                <p className="font-semibold text-sm">
                                    Belum Ada File yang Diunggah
                                </p>
                                <p className="opacity-90 leading-relaxed">
                                    Laporan belum dapat ditandai selesai karena belum memiliki file
                                    lampiran. Silakan unggah minimal 1 file laporan terlebih dahulu.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Batal
                    </Button>

                    {!hasFiles ? (
                        <Button
                            type="button"
                            onClick={() => {
                                onOpenChange(false);
                                onUploadNow(report);
                            }}
                        >
                            <Upload className="h-4 w-4 mr-1.5" />
                            Upload File Sekarang
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={isSubmitting}
                                onClick={() => {
                                    onOpenChange(false);
                                    onUploadNow(report);
                                }}
                            >
                                <Upload className="h-4 w-4 mr-1.5" />
                                Tambah / Ubah File
                            </Button>
                            <Button
                                type="button"
                                onClick={handleConfirmComplete}
                                disabled={isSubmitting}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                        Konfirmasi &amp; Tandai Selesai
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>

            <ReportFilePreviewDialog
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                attachments={attachments}
                initialIndex={previewIndex}
            />
        </Dialog>
    );
}
