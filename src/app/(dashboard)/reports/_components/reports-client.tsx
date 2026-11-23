"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    BellRing,
    CalendarClock,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit3,
    Eye,
    FileStack,
    FileText,
    Loader2,
    Paperclip,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Tag,
    Trash2,
} from "lucide-react";
import {
    useInvalidateReports,
    useReportCategories,
    useReports,
    useReportStats,
} from "@/hooks/api/use-reports";
import { deleteReport, triggerReportDeadlineReminders } from "../actions";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { ReportStatsCards } from "./report-stats-cards";
import { ReportDialog } from "./report-dialog";
import { ReportDetailDialog } from "./report-detail-dialog";
import { ReportReviewDialog } from "./report-review-dialog";
import { CategoryManagerDialog } from "./category-manager-dialog";
import {
    CATEGORY_COLOR_CLASSES,
    REPORT_PERIOD_LABELS,
    REPORT_PRIORITY_CONFIG,
    REPORT_STATUS_CONFIG,
    getDeadlineInfo,
    getEffectiveStatus,
    getReportAttachments,
    type Report,
    type ReportPeriodType,
    type ReportPriority,
    type ReportStatus,
} from "@/types/report";

function formatShortDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export function ReportsClient() {
    const { user } = useAuthStore();
    const role = user?.role || "user";
    const isAdminOrManager = ["admin", "manager_it"].includes(role);

    // Filter state
    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [categoryId, setCategoryId] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [periodType, setPeriodType] = useState("all");
    const [priority, setPriority] = useState("all");
    const [page, setPage] = useState(1);

    // Dialog states
    const [formOpen, setFormOpen] = useState(false);
    const [reportToEdit, setReportToEdit] = useState<Report | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reportToReview, setReportToReview] = useState<Report | null>(null);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [isSendingReminders, setIsSendingReminders] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
            setPage(1);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const invalidateReports = useInvalidateReports();
    const { data: categories = [] } = useReportCategories();
    const { data: stats, isLoading: isStatsLoading } = useReportStats();
    const {
        data: reportsResult,
        isLoading,
        isFetching,
        error,
    } = useReports({
        search: debouncedSearch || undefined,
        category_id: categoryId,
        status: statusFilter,
        period_type: periodType,
        priority,
        page,
        pageSize: 10,
    });

    const reports = reportsResult?.data || [];
    const totalCount = reportsResult?.count || 0;
    const totalPages = reportsResult?.totalPages || 1;

    const hasActiveFilters =
        !!debouncedSearch ||
        categoryId !== "all" ||
        statusFilter !== "all" ||
        periodType !== "all" ||
        priority !== "all";

    const resetFilters = () => {
        setSearchInput("");
        setDebouncedSearch("");
        setCategoryId("all");
        setStatusFilter("all");
        setPeriodType("all");
        setPriority("all");
        setPage(1);
    };

    const handleCreate = () => {
        setReportToEdit(null);
        setFormOpen(true);
    };

    const handleEdit = (report: Report) => {
        setReportToEdit(report);
        setFormOpen(true);
    };

    const handleView = (report: Report) => {
        setSelectedReportId(report.id);
        setDetailOpen(true);
    };

    const handleReview = (report: Report) => {
        setReportToReview(report);
        setReviewOpen(true);
    };

    const handleDelete = async (id: string) => {
        const res = await deleteReport(id);
        if (res.success) {
            toast.success("Laporan berhasil dihapus.");
            invalidateReports();
        } else {
            toast.error(res.error || "Gagal menghapus laporan.");
        }
    };

    const handleStatsCardClick = (filter: "all" | "pending" | "overdue" | "approved") => {
        setStatusFilter(filter);
        setPage(1);
    };

    const handleTriggerReminders = async () => {
        setIsSendingReminders(true);
        const toastId = toast.loading("Mengecek deadline (H-7, H-3, Terlambat) & mengirim WA...");
        try {
            const res = await triggerReportDeadlineReminders();
            if (!res.success) {
                toast.error(res.error || "Gagal memproses pengingat WA.", { id: toastId });
                return;
            }
            if (!("eligible" in res)) {
                toast.success("Pengingat WA diproses.", { id: toastId });
                return;
            }

            if (res.eligible === 0) {
                toast.info("Tidak ada laporan yang memenuhi kriteria H-7, H-3, atau Terlambat hari ini.", {
                    id: toastId,
                });
            } else {
                const parts: string[] = [];
                if (res.sent > 0) parts.push(`${res.sent} terkirim`);
                if (res.skippedAlreadySent > 0) parts.push(`${res.skippedAlreadySent} sudah dikirim sebelumnya`);
                if (res.skippedNoPhone > 0) parts.push(`${res.skippedNoPhone} PIC tanpa No. WA`);
                if (res.failed > 0) parts.push(`${res.failed} gagal`);

                if (res.failed > 0 && res.sent === 0) {
                    toast.error(`Pengingat WA: ${parts.join(", ")}`, { id: toastId });
                } else {
                    toast.success(`Pengingat WA selesai: ${parts.join(", ")}`, { id: toastId });
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Terjadi kesalahan saat mengirim pengingat WA.", { id: toastId });
        } finally {
            setIsSendingReminders(false);
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
                        <FileStack className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                        Inventaris Laporan
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Kelola seluruh laporan secara terpusat agar tertib, terdokumentasi, dan
                        tepat waktu.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/reports/calendar">
                            <CalendarClock className="h-4 w-4 mr-1.5" />
                            Kalender Deadline
                        </Link>
                    </Button>

                    {isAdminOrManager && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleTriggerReminders}
                                disabled={isSendingReminders}
                                title="Cek & kirim pengingat WA untuk laporan H-7, H-3, dan Terlambat"
                            >
                                {isSendingReminders ? (
                                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                ) : (
                                    <BellRing className="h-4 w-4 mr-1.5" />
                                )}
                                Pengingat WA
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCategoryDialogOpen(true)}
                            >
                                <Tag className="h-4 w-4 mr-1.5" />
                                Kelola Kategori
                            </Button>
                        </>
                    )}

                    <Button onClick={handleCreate} size="sm">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Buat Laporan
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <ReportStatsCards
                stats={stats}
                isLoading={isStatsLoading}
                onFilterClick={handleStatsCardClick}
            />

            {/* Filter & Search Bar */}
            <Card className="p-4">
                <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari judul, nomor laporan, atau keterangan..."
                            className="pl-9"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 lg:flex lg:flex-wrap lg:items-center">
                        <Select
                            value={categoryId}
                            onValueChange={(v) => {
                                setCategoryId(v);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-full lg:w-[165px]">
                                <SelectValue placeholder="Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kategori</SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={statusFilter}
                            onValueChange={(v) => {
                                setStatusFilter(v);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-full lg:w-[145px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                {(Object.keys(REPORT_STATUS_CONFIG) as ReportStatus[]).map(
                                    (st) => (
                                        <SelectItem key={st} value={st}>
                                            {REPORT_STATUS_CONFIG[st].label}
                                        </SelectItem>
                                    )
                                )}
                            </SelectContent>
                        </Select>

                        <Select
                            value={periodType}
                            onValueChange={(v) => {
                                setPeriodType(v);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-full lg:w-[135px]">
                                <SelectValue placeholder="Periode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Periode</SelectItem>
                                {(Object.keys(REPORT_PERIOD_LABELS) as ReportPeriodType[]).map(
                                    (pt) => (
                                        <SelectItem key={pt} value={pt}>
                                            {REPORT_PERIOD_LABELS[pt]}
                                        </SelectItem>
                                    )
                                )}
                            </SelectContent>
                        </Select>

                        <Select
                            value={priority}
                            onValueChange={(v) => {
                                setPriority(v);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-full lg:w-[135px]">
                                <SelectValue placeholder="Prioritas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Prioritas</SelectItem>
                                {(Object.keys(REPORT_PRIORITY_CONFIG) as ReportPriority[]).map(
                                    (pr) => (
                                        <SelectItem key={pr} value={pr}>
                                            {REPORT_PRIORITY_CONFIG[pr].label}
                                        </SelectItem>
                                    )
                                )}
                            </SelectContent>
                        </Select>

                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={resetFilters}
                                className="col-span-2 sm:col-span-4 lg:col-span-1"
                            >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Reset
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {/* Error Notice */}
            {error && (
                <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm text-destructive">
                    Gagal memuat data laporan: {(error as Error).message}
                </Card>
            )}

            {/* Reports Table */}
            <Card className="overflow-hidden py-0 gap-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="min-w-[240px] py-3.5 pl-6 pr-4">
                                    Judul Laporan
                                </TableHead>
                                <TableHead className="py-3.5 px-4">Kategori</TableHead>
                                <TableHead className="py-3.5 px-4">Periode</TableHead>
                                <TableHead className="py-3.5 px-4">Deadline</TableHead>
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
                                        Memuat daftar inventaris laporan...
                                    </TableCell>
                                </TableRow>
                            ) : reports.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="text-center py-12 px-6 text-muted-foreground"
                                    >
                                        <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                        <p className="font-medium text-foreground">
                                            Belum ada laporan ditemukan
                                        </p>
                                        <p className="text-xs mt-1">
                                            {hasActiveFilters
                                                ? "Coba ubah atau reset filter pencarian."
                                                : "Klik 'Buat Laporan' untuk menambahkan laporan pertama."}
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reports.map((report) => {
                                    const effectiveStatus = getEffectiveStatus(report);
                                    const statusCfg = REPORT_STATUS_CONFIG[effectiveStatus];
                                    const priorityCfg = REPORT_PRIORITY_CONFIG[report.priority];
                                    const deadlineInfo = getDeadlineInfo(
                                        report.deadline,
                                        effectiveStatus
                                    );
                                    const attachments = getReportAttachments(report);

                                    return (
                                        <TableRow
                                            key={report.id}
                                            className="group hover:bg-muted/40"
                                        >
                                            <TableCell className="max-w-[300px] py-3.5 pl-6 pr-4">
                                                <button
                                                    type="button"
                                                    onClick={() => handleView(report)}
                                                    className="text-left w-full cursor-pointer"
                                                >
                                                    <div className="font-medium truncate flex items-center gap-2 group-hover:text-primary transition-colors">
                                                        <FileText className="h-4 w-4 text-primary/80 shrink-0" />
                                                        <span className="truncate">
                                                            {report.title}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        {report.report_number && (
                                                            <span className="text-[11px] text-muted-foreground font-mono">
                                                                {report.report_number}
                                                            </span>
                                                        )}
                                                        {report.priority !== "normal" && (
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-[10px] px-1.5 py-0 h-4 ${priorityCfg.badgeClass}`}
                                                            >
                                                                {priorityCfg.label}
                                                            </Badge>
                                                        )}
                                                        {attachments.length > 0 && (
                                                            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                                                                <Paperclip className="h-3 w-3" />
                                                                {attachments.length} file
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            </TableCell>

                                            <TableCell className="py-3.5 px-4">
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
                                                    <span className="text-xs text-muted-foreground">
                                                        -
                                                    </span>
                                                )}
                                            </TableCell>

                                            <TableCell className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                                                {REPORT_PERIOD_LABELS[report.period_type]}
                                            </TableCell>

                                            <TableCell className="py-3.5 px-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-medium">
                                                        {formatShortDate(report.deadline)}
                                                    </span>
                                                    <span
                                                        className={`text-[11px] flex items-center gap-1.5 ${deadlineInfo.textClass}`}
                                                    >
                                                        <span className="relative flex h-2 w-2">
                                                            {deadlineInfo.pulse && (
                                                                <span
                                                                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${deadlineInfo.dotClass}`}
                                                                />
                                                            )}
                                                            <span
                                                                className={`relative inline-flex rounded-full h-2 w-2 ${deadlineInfo.dotClass}`}
                                                            />
                                                        </span>
                                                        {deadlineInfo.shortLabel}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            <TableCell className="py-3.5 px-4 text-sm">
                                                <span className="truncate block max-w-[140px]">
                                                    {report.assigned_profile?.full_name ||
                                                        report.assigned_profile?.username || (
                                                            <span className="text-muted-foreground italic text-xs">
                                                                Belum ada
                                                            </span>
                                                        )}
                                                </span>
                                            </TableCell>

                                            <TableCell className="py-3.5 px-4">
                                                <Badge
                                                    variant="outline"
                                                    className={`whitespace-nowrap ${statusCfg.badgeClass}`}
                                                >
                                                    <span
                                                        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${statusCfg.dotClass}`}
                                                    />
                                                    {statusCfg.label}
                                                </Badge>
                                            </TableCell>

                                            <TableCell className="py-3.5 pl-4 pr-6 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        title="Lihat Detail & Audit Log"
                                                        onClick={() => handleView(report)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>

                                                    {attachments.length === 1 ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            title={`Unduh ${attachments[0].name}`}
                                                            asChild
                                                        >
                                                            <a
                                                                href={attachments[0].url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                download={
                                                                    attachments[0].name || undefined
                                                                }
                                                            >
                                                                <Download className="h-4 w-4" />
                                                            </a>
                                                        </Button>
                                                    ) : attachments.length > 1 ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 relative"
                                                            title={`Lihat & unduh ${attachments.length} file lampiran`}
                                                            onClick={() => handleView(report)}
                                                        >
                                                            <Download className="h-4 w-4" />
                                                            <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                                                                {attachments.length}
                                                            </span>
                                                        </Button>
                                                    ) : null}

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        title="Edit Laporan (dicatat di audit log)"
                                                        onClick={() => handleEdit(report)}
                                                    >
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>

                                                    {isAdminOrManager && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                                                title="Review / Approve"
                                                                onClick={() => handleReview(report)}
                                                            >
                                                                <CheckCircle2 className="h-4 w-4" />
                                                            </Button>

                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                        title="Hapus Laporan"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>
                                                                            Hapus Laporan?
                                                                        </AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Laporan{" "}
                                                                            <strong>
                                                                                {report.title}
                                                                            </strong>{" "}
                                                                            beserta file lampiran
                                                                            dan log-nya akan dihapus
                                                                            secara permanen.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>
                                                                            Batal
                                                                        </AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            onClick={() =>
                                                                                handleDelete(
                                                                                    report.id
                                                                                )
                                                                            }
                                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                        >
                                                                            Hapus
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </>
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

                {/* Pagination */}
                {totalCount > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t">
                        <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                            <span>
                                Menampilkan {(page - 1) * 10 + 1}–
                                {Math.min(page * 10, totalCount)} dari {totalCount} laporan
                            </span>
                            {isFetching && !isLoading && (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                            )}
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Sebelumnya
                                </Button>
                                <span className="text-xs text-muted-foreground px-2">
                                    Hal {page} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    Selanjutnya
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Modals */}
            <ReportDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                reportToEdit={reportToEdit}
                categories={categories}
                onSuccess={invalidateReports}
            />

            <ReportDetailDialog
                open={detailOpen}
                onOpenChange={setDetailOpen}
                reportId={selectedReportId}
                canReview={isAdminOrManager}
                onEdit={handleEdit}
                onReview={handleReview}
                onUpdated={invalidateReports}
            />

            {isAdminOrManager && (
                <>
                    <ReportReviewDialog
                        open={reviewOpen}
                        onOpenChange={setReviewOpen}
                        report={reportToReview}
                        onSuccess={invalidateReports}
                    />

                    <CategoryManagerDialog
                        open={categoryDialogOpen}
                        onOpenChange={setCategoryDialogOpen}
                        categories={categories}
                        onSuccess={invalidateReports}
                    />
                </>
            )}
        </div>
    );
}
