"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    CalendarClock,
    Edit3,
    FileStack,
    Loader2,
    Pause,
    Play,
    Plus,
    RefreshCw,
    Repeat,
    Sparkles,
    Trash2,
} from "lucide-react";
import {
    useInvalidateReports,
    useReportCategories,
    useReportSchedules,
} from "@/hooks/api/use-reports";
import {
    deleteReportSchedule,
    runScheduleGenerator,
    toggleReportScheduleActive,
} from "../actions";
import {
    describeDeadlineRule,
    getNextOccurrencePreview,
} from "@/lib/reports/schedule-utils";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { ScheduleDialog } from "./schedule-dialog";
import {
    CATEGORY_COLOR_CLASSES,
    SCHEDULE_FREQUENCY_LABELS,
    type ReportSchedule,
} from "@/types/report";

function formatShortDate(ymd: string) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export function SchedulesClient() {
    const { user } = useAuthStore();
    const isAdminOrManager = ["admin", "manager_it"].includes(user?.role || "");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [scheduleToEdit, setScheduleToEdit] = useState<ReportSchedule | null>(null);
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const invalidateReports = useInvalidateReports();
    const { data: categories = [] } = useReportCategories();
    const { data: schedules = [], isLoading, error } = useReportSchedules();

    const handleCreate = () => {
        setScheduleToEdit(null);
        setDialogOpen(true);
    };

    const handleEdit = (schedule: ReportSchedule) => {
        setScheduleToEdit(schedule);
        setDialogOpen(true);
    };

    const handleToggleActive = async (schedule: ReportSchedule) => {
        setTogglingId(schedule.id);
        try {
            const res = await toggleReportScheduleActive(schedule.id, !schedule.is_active);
            if (res.success) {
                toast.success(
                    schedule.is_active
                        ? "Jadwal rutin dijeda (tidak akan auto-generate)."
                        : "Jadwal rutin diaktifkan kembali."
                );
                invalidateReports();
            } else {
                toast.error(res.error || "Gagal mengubah status jadwal.");
            }
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        const res = await deleteReportSchedule(id);
        if (res.success) {
            toast.success("Jadwal rutin dihapus.");
            invalidateReports();
        } else {
            toast.error(res.error || "Gagal menghapus jadwal rutin.");
        }
    };

    const handleGenerateSingle = async (schedule: ReportSchedule) => {
        setGeneratingId(schedule.id);
        const toastId = toast.loading(`Membuat laporan periode terdekat untuk "${schedule.title_template}"...`);
        try {
            const res = await runScheduleGenerator({ scheduleId: schedule.id, force: true });
            if (!res.success) {
                toast.error(res.error || "Gagal membuat laporan.", { id: toastId });
                return;
            }
            if ("generated" in res && res.generated > 0) {
                toast.success(
                    `Laporan periode baru berhasil dibuat dan masuk ke Semua Laporan!`,
                    { id: toastId }
                );
                invalidateReports();
            } else if ("skippedAlreadyExists" in res && res.skippedAlreadyExists > 0) {
                toast.info("Laporan untuk periode terdekat sudah pernah dibuat sebelumnya.", {
                    id: toastId,
                });
            } else {
                toast.info("Tidak ada laporan baru yang perlu dibuat.", { id: toastId });
            }
        } finally {
            setGeneratingId(null);
        }
    };

    const handleGenerateAllDue = async () => {
        setIsGeneratingAll(true);
        const toastId = toast.loading("Mengecek semua jadwal rutin aktif yang sudah masuk jendela H-N...");
        try {
            const res = await runScheduleGenerator({ force: false });
            if (!res.success) {
                toast.error(res.error || "Gagal menjalankan generator.", { id: toastId });
                return;
            }
            if (!("generated" in res)) {
                toast.success("Pengecekan selesai.", { id: toastId });
                return;
            }

            if (res.generated > 0) {
                toast.success(
                    `Berhasil membuat ${res.generated} laporan rutin baru! (${res.skippedAlreadyExists} sudah ada, ${res.skippedNotDueYet} belum waktunya)`,
                    { id: toastId }
                );
                invalidateReports();
            } else {
                toast.info(
                    `Semua jadwal sudah up-to-date (${res.skippedAlreadyExists} sudah dibuat, ${res.skippedNotDueYet} belum masuk jendela H-N).`,
                    { id: toastId }
                );
            }
        } finally {
            setIsGeneratingAll(false);
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Repeat className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                        Jadwal Laporan Rutin
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Daftarkan laporan Bulanan, Triwulanan, atau Tahunan sekali saja — sistem
                        akan membuat laporan baru secara otomatis di tiap periode.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/reports">
                            <FileStack className="h-4 w-4 mr-1.5" />
                            Semua Laporan
                        </Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateAllDue}
                        disabled={isGeneratingAll}
                        title="Cek semua jadwal aktif yang masuk jendela H-N dan buat laporannya sekarang"
                    >
                        {isGeneratingAll ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4 mr-1.5" />
                        )}
                        Cek & Generate
                    </Button>
                    <Button size="sm" onClick={handleCreate}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Buat Jadwal Rutin
                    </Button>
                </div>
            </div>

            {error && (
                <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm text-destructive">
                    Gagal memuat jadwal rutin: {(error as Error).message}
                </Card>
            )}

            {/* Table */}
            <Card className="overflow-hidden py-0 gap-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="min-w-[230px] py-3.5 pl-6 pr-4">
                                    Template Laporan
                                </TableHead>
                                <TableHead className="py-3.5 px-4">Frekuensi</TableHead>
                                <TableHead className="py-3.5 px-4">Aturan Deadline</TableHead>
                                <TableHead className="py-3.5 px-4">Periode Berikutnya</TableHead>
                                <TableHead className="py-3.5 px-4">PIC</TableHead>
                                <TableHead className="py-3.5 px-4">Status</TableHead>
                                <TableHead className="py-3.5 pl-4 pr-6 text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12 px-6">
                                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                                        Memuat daftar jadwal laporan rutin...
                                    </TableCell>
                                </TableRow>
                            ) : schedules.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="text-center py-12 px-6 text-muted-foreground"
                                    >
                                        <Repeat className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                        <p className="font-medium text-foreground">
                                            Belum ada jadwal laporan rutin
                                        </p>
                                        <p className="text-xs mt-1">
                                            Klik &ldquo;Buat Jadwal Rutin&rdquo; untuk mendaftarkan
                                            laporan Bulanan, Triwulanan, atau Tahunan otomatis.
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                schedules.map((schedule) => {
                                    const nextOcc = getNextOccurrencePreview(schedule);
                                    const ruleDesc = describeDeadlineRule(schedule);

                                    return (
                                        <TableRow
                                            key={schedule.id}
                                            className={`hover:bg-muted/40 ${
                                                !schedule.is_active ? "opacity-60" : ""
                                            }`}
                                        >
                                            <TableCell className="py-3.5 pl-6 pr-4 max-w-[280px]">
                                                <div className="font-medium truncate">
                                                    {schedule.title_template}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    {schedule.category && (
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] px-1.5 py-0 h-4 ${
                                                                CATEGORY_COLOR_CLASSES[
                                                                    schedule.category.color
                                                                ] || CATEGORY_COLOR_CLASSES.gray
                                                            }`}
                                                        >
                                                            {schedule.category.name}
                                                        </Badge>
                                                    )}
                                                    <span className="text-[11px] text-muted-foreground">
                                                        Auto H-{schedule.generate_days_before} hari
                                                    </span>
                                                </div>
                                            </TableCell>

                                            <TableCell className="py-3.5 px-4 whitespace-nowrap">
                                                <Badge variant="secondary" className="text-xs">
                                                    {SCHEDULE_FREQUENCY_LABELS[schedule.frequency]}
                                                </Badge>
                                            </TableCell>

                                            <TableCell className="py-3.5 px-4 text-xs text-muted-foreground max-w-[220px]">
                                                <span className="line-clamp-2 whitespace-normal">
                                                    {ruleDesc}
                                                </span>
                                            </TableCell>

                                            <TableCell className="py-3.5 px-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-medium flex items-center gap-1.5">
                                                        <CalendarClock className="h-3.5 w-3.5 text-primary" />
                                                        {formatShortDate(nextOcc.deadline)}
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {nextOcc.periodLabel}
                                                        {schedule.last_generated_period
                                                            ? ` • Terakhir: ${schedule.last_generated_period}`
                                                            : ""}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            <TableCell className="py-3.5 px-4 text-sm">
                                                <span className="truncate block max-w-[140px]">
                                                    {schedule.assigned_profile?.full_name ||
                                                        schedule.assigned_profile?.username || (
                                                            <span className="text-muted-foreground italic text-xs">
                                                                Belum ada
                                                            </span>
                                                        )}
                                                </span>
                                            </TableCell>

                                            <TableCell className="py-3.5 px-4">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        schedule.is_active
                                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                            : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30"
                                                    }
                                                >
                                                    {schedule.is_active ? "Aktif" : "Dijeda"}
                                                </Badge>
                                            </TableCell>

                                            <TableCell className="py-3.5 pl-4 pr-6 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-primary hover:bg-primary/10"
                                                        title="Generate laporan periode terdekat sekarang"
                                                        disabled={generatingId === schedule.id}
                                                        onClick={() =>
                                                            handleGenerateSingle(schedule)
                                                        }
                                                    >
                                                        {generatingId === schedule.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Sparkles className="h-4 w-4" />
                                                        )}
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        title={
                                                            schedule.is_active
                                                                ? "Jeda jadwal"
                                                                : "Aktifkan jadwal"
                                                        }
                                                        disabled={togglingId === schedule.id}
                                                        onClick={() =>
                                                            handleToggleActive(schedule)
                                                        }
                                                    >
                                                        {togglingId === schedule.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : schedule.is_active ? (
                                                            <Pause className="h-4 w-4" />
                                                        ) : (
                                                            <Play className="h-4 w-4 text-emerald-600" />
                                                        )}
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        title="Edit jadwal rutin"
                                                        onClick={() => handleEdit(schedule)}
                                                    >
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>

                                                    {isAdminOrManager && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    title="Hapus jadwal rutin"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>
                                                                        Hapus Jadwal Rutin?
                                                                    </AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Jadwal{" "}
                                                                        <strong>
                                                                            {schedule.title_template}
                                                                        </strong>{" "}
                                                                        akan dihapus. Laporan yang
                                                                        sudah terlanjur dibuat
                                                                        sebelumnya tetap aman di
                                                                        arsip.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>
                                                                        Batal
                                                                    </AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() =>
                                                                            handleDelete(
                                                                                schedule.id
                                                                            )
                                                                        }
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                    >
                                                                        Hapus
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <ScheduleDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                scheduleToEdit={scheduleToEdit}
                categories={categories}
                onSuccess={invalidateReports}
            />
        </div>
    );
}
