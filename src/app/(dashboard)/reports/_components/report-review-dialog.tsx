"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reviewReport } from "../actions";
import { toast } from "sonner";
import {
    CheckCircle2,
    Eye,
    Loader2,
    RotateCcw,
    XCircle,
} from "lucide-react";
import type { Report } from "@/types/report";

interface ReportReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    report: Report | null;
    onSuccess: () => void;
}

type ReviewDecision = "review" | "approved" | "revision" | "rejected";

const DECISIONS: {
    value: ReviewDecision;
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    activeClass: string;
}[] = [
    {
        value: "approved",
        label: "Setujui (Approve)",
        desc: "Laporan dinyatakan selesai dan valid",
        icon: CheckCircle2,
        activeClass: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
        value: "revision",
        label: "Minta Revisi",
        desc: "Kembalikan ke PIC untuk diperbaiki",
        icon: RotateCcw,
        activeClass: "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    },
    {
        value: "review",
        label: "Sedang Direview",
        desc: "Tandai laporan sedang dalam tahap pemeriksaan",
        icon: Eye,
        activeClass: "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    },
    {
        value: "rejected",
        label: "Tolak (Reject)",
        desc: "Laporan ditolak dengan alasan jelas",
        icon: XCircle,
        activeClass: "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    },
];

export function ReportReviewDialog({
    open,
    onOpenChange,
    report,
    onSuccess,
}: ReportReviewDialogProps) {
    const [decision, setDecision] = useState<ReviewDecision>("approved");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setDecision("approved");
            setNotes("");
        }
    }, [open, report?.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!report) return;

        if ((decision === "revision" || decision === "rejected") && !notes.trim()) {
            toast.error("Mohon isi catatan untuk keputusan revisi atau penolakan.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await reviewReport({
                id: report.id,
                action: decision,
                notes,
            });
            if (res.success) {
                toast.success("Status review laporan berhasil disimpan.");
                onOpenChange(false);
                onSuccess();
            } else {
                toast.error(res.error || "Gagal menyimpan hasil review.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Review & Persetujuan Laporan</DialogTitle>
                    <DialogDescription className="truncate">
                        {report?.title}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-1">
                    <div className="space-y-2">
                        <Label>Pilih Keputusan</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {DECISIONS.map((item) => {
                                const isActive = decision === item.value;
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        onClick={() => setDecision(item.value)}
                                        className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                                            isActive
                                                ? item.activeClass
                                                : "border-border hover:bg-muted/50"
                                        }`}
                                    >
                                        <item.icon className="h-4 w-4 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-semibold">{item.label}</p>
                                            <p className="text-[11px] opacity-80 leading-snug">
                                                {item.desc}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="review-notes">
                            Catatan{" "}
                            {(decision === "revision" || decision === "rejected") && (
                                <span className="text-destructive">*</span>
                            )}
                        </Label>
                        <Textarea
                            id="review-notes"
                            rows={3}
                            placeholder={
                                decision === "revision"
                                    ? "Jelaskan bagian yang perlu diperbaiki oleh PIC..."
                                    : decision === "rejected"
                                      ? "Jelaskan alasan penolakan laporan..."
                                      : "Tambahkan catatan (opsional)..."
                            }
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            required={decision === "revision" || decision === "rejected"}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Menyimpan...
                                </>
                            ) : (
                                "Simpan Keputusan"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
