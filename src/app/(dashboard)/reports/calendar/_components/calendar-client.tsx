"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    FileStack,
    FileText,
    Plus,
    RefreshCw,
    User,
} from "lucide-react";
import {
    useInvalidateReports,
    useReportCategories,
    useReportsByDeadline,
} from "@/hooks/api/use-reports";
import { useAuthStore } from "@/stores/auth-store";
import { ReportDialog } from "../../_components/report-dialog";
import { ReportDetailDialog } from "../../_components/report-detail-dialog";
import { ReportReviewDialog } from "../../_components/report-review-dialog";
import {
    REPORT_STATUS_CONFIG,
    getDeadlineInfo,
    getEffectiveStatus,
    type DeadlineLevel,
    type Report,
} from "@/types/report";

const MONTH_NAMES = [
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
];

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const LEVEL_PRIORITY: Record<DeadlineLevel, number> = {
    overdue: 5,
    today: 4,
    urgent: 3,
    approaching: 2,
    safe: 1,
    completed: 0,
};

function toDateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function CalendarClient() {
    const today = new Date();
    const todayKey = toDateKey(
        today.getFullYear(),
        today.getMonth() + 1,
        today.getDate()
    );

    const { user } = useAuthStore();
    const isAdminOrManager = ["admin", "manager_it"].includes(user?.role || "");

    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12
    const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

    // Dialog states
    const [formOpen, setFormOpen] = useState(false);
    const [reportToEdit, setReportToEdit] = useState<Report | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reportToReview, setReportToReview] = useState<Report | null>(null);

    const invalidateReports = useInvalidateReports();
    const { data: categories = [] } = useReportCategories();
    const { data: reports = [], isLoading } = useReportsByDeadline(
        currentYear,
        currentMonth
    );

    // Group reports by YYYY-MM-DD
    const reportsByDate = useMemo(() => {
        const map: Record<string, Report[]> = {};
        for (const r of reports) {
            const key = r.deadline;
            if (!map[key]) map[key] = [];
            map[key].push(r);
        }
        return map;
    }, [reports]);

    // Build calendar cells (Monday-first grid)
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        // JS getDay(): 0=Sun, 1=Mon...6=Sat => convert to Mon=0..Sun=6
        const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

        const cells: Array<{ day: number | null; dateKey: string | null }> = [];
        for (let i = 0; i < startOffset; i++) {
            cells.push({ day: null, dateKey: null });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ day: d, dateKey: toDateKey(currentYear, currentMonth, d) });
        }
        while (cells.length % 7 !== 0) {
            cells.push({ day: null, dateKey: null });
        }
        return cells;
    }, [currentYear, currentMonth]);

    const goToPrevMonth = () => {
        if (currentMonth === 1) {
            setCurrentMonth(12);
            setCurrentYear((y) => y - 1);
        } else {
            setCurrentMonth((m) => m - 1);
        }
    };

    const goToNextMonth = () => {
        if (currentMonth === 12) {
            setCurrentMonth(1);
            setCurrentYear((y) => y + 1);
        } else {
            setCurrentMonth((m) => m + 1);
        }
    };

    const goToToday = () => {
        setCurrentYear(today.getFullYear());
        setCurrentMonth(today.getMonth() + 1);
        setSelectedDateKey(todayKey);
    };

    const selectedDateReports = reportsByDate[selectedDateKey] || [];

    const formatSelectedDateHeading = (key: string) => {
        const [y, m, d] = key.split("-").map(Number);
        const dt = new Date(y, (m || 1) - 1, d || 1);
        return dt.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    const handleCreateOnDate = () => {
        setReportToEdit(null);
        setFormOpen(true);
    };

    return (
        <div className="container mx-auto py-6 space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
                        <CalendarClock className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                        Kalender Deadline Laporan
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Pantau jadwal batas waktu laporan bulanan agar tidak ada yang terlewat.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/reports">
                            <FileStack className="h-4 w-4 mr-1.5" />
                            Semua Laporan
                        </Link>
                    </Button>
                    <Button size="sm" onClick={handleCreateOnDate}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Buat Laporan
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar Grid */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-lg font-bold">
                            {MONTH_NAMES[currentMonth - 1]} {currentYear}
                        </CardTitle>
                        <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" onClick={goToToday}>
                                Hari Ini
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={goToPrevMonth}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={goToNextMonth}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <RefreshCw className="h-6 w-6 animate-spin text-primary mb-2" />
                                Memuat jadwal deadline...
                            </div>
                        ) : (
                            <>
                                {/* Weekday Headers */}
                                <div className="grid grid-cols-7 gap-1.5 text-center">
                                    {WEEKDAYS.map((wd) => (
                                        <div
                                            key={wd}
                                            className="text-xs font-semibold text-muted-foreground py-1.5"
                                        >
                                            {wd}
                                        </div>
                                    ))}
                                </div>

                                {/* Days Grid */}
                                <div className="grid grid-cols-7 gap-1.5">
                                    {calendarDays.map((cell, idx) => {
                                        if (!cell.day || !cell.dateKey) {
                                            return (
                                                <div
                                                    key={`empty-${idx}`}
                                                    className="min-h-[76px] sm:min-h-[86px] rounded-xl bg-muted/20"
                                                />
                                            );
                                        }

                                        const dayReports = reportsByDate[cell.dateKey] || [];
                                        const isToday = cell.dateKey === todayKey;
                                        const isSelected = cell.dateKey === selectedDateKey;

                                        // Determine highest urgency level on this date
                                        let topDotClass = "";
                                        let topBadgeClass = "";
                                        let topPriority = -1;

                                        for (const r of dayReports) {
                                            const eff = getEffectiveStatus(r);
                                            const info = getDeadlineInfo(r.deadline, eff);
                                            const prio = LEVEL_PRIORITY[info.level];
                                            if (prio > topPriority) {
                                                topPriority = prio;
                                                topDotClass = info.dotClass;
                                                topBadgeClass = info.badgeClass;
                                            }
                                        }

                                        return (
                                            <button
                                                key={cell.dateKey}
                                                type="button"
                                                onClick={() => setSelectedDateKey(cell.dateKey!)}
                                                className={`min-h-[76px] sm:min-h-[86px] rounded-xl border p-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                                                    isSelected
                                                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                                        : isToday
                                                          ? "border-primary/50 bg-primary/[0.03]"
                                                          : "border-border/70 hover:bg-muted/40"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span
                                                        className={`text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full ${
                                                            isToday
                                                                ? "bg-primary text-primary-foreground"
                                                                : "text-foreground"
                                                        }`}
                                                    >
                                                        {cell.day}
                                                    </span>
                                                    {dayReports.length > 0 && (
                                                        <span
                                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${topBadgeClass}`}
                                                        >
                                                            {dayReports.length}
                                                        </span>
                                                    )}
                                                </div>

                                                {dayReports.length > 0 && (
                                                    <div className="space-y-1 mt-1">
                                                        <div className="flex items-center gap-1">
                                                            <span
                                                                className={`h-2 w-2 rounded-full shrink-0 ${topDotClass}`}
                                                            />
                                                            <span className="text-[10px] truncate text-muted-foreground">
                                                                {dayReports[0].title}
                                                            </span>
                                                        </div>
                                                        {dayReports.length > 1 && (
                                                            <p className="text-[10px] text-muted-foreground pl-3">
                                                                +{dayReports.length - 1} lainnya
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Legend */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">Keterangan:</span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                                        Terlambat
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                                        Hari Ini / Mendesak
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                                        Mendekati (3-7 hari)
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                        Aman (&gt;7 hari)
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                                        Sudah Selesai
                                    </span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Selected Date Detail Panel */}
                <Card className="h-fit">
                    <CardHeader className="pb-3 border-b">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">
                                    Deadline Tanggal Dipilih
                                </p>
                                <CardTitle className="text-base mt-0.5">
                                    {formatSelectedDateHeading(selectedDateKey)}
                                </CardTitle>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs shrink-0"
                                onClick={handleCreateOnDate}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Tambah
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                        {selectedDateReports.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground space-y-2">
                                <FileText className="h-9 w-9 mx-auto opacity-30" />
                                <p className="text-sm font-medium text-foreground">
                                    Tidak ada deadline laporan
                                </p>
                                <p className="text-xs">
                                    Klik &ldquo;Tambah&rdquo; untuk menjadwalkan laporan pada
                                    tanggal ini.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedDateReports.map((report) => {
                                    const eff = getEffectiveStatus(report);
                                    const statusCfg = REPORT_STATUS_CONFIG[eff];
                                    const deadlineInfo = getDeadlineInfo(report.deadline, eff);

                                    return (
                                        <button
                                            key={report.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedReportId(report.id);
                                                setDetailOpen(true);
                                            }}
                                            className="w-full text-left rounded-xl border p-3 hover:border-primary/50 hover:bg-muted/30 transition-all space-y-2 cursor-pointer"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-semibold leading-snug line-clamp-2">
                                                    {report.title}
                                                </p>
                                                <Badge
                                                    variant="outline"
                                                    className={`shrink-0 text-[10px] ${statusCfg.badgeClass}`}
                                                >
                                                    {statusCfg.label}
                                                </Badge>
                                            </div>

                                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1 truncate">
                                                    <User className="h-3 w-3 shrink-0" />
                                                    {report.assigned_profile?.full_name ||
                                                        report.assigned_profile?.username ||
                                                        "Belum ada PIC"}
                                                </span>
                                                <span className={deadlineInfo.textClass}>
                                                    {deadlineInfo.shortLabel}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Modals */}
            <ReportDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                reportToEdit={reportToEdit}
                defaultDeadline={selectedDateKey}
                categories={categories}
                onSuccess={invalidateReports}
            />

            <ReportDetailDialog
                open={detailOpen}
                onOpenChange={setDetailOpen}
                reportId={selectedReportId}
                canReview={isAdminOrManager}
                onEdit={(rep) => {
                    setReportToEdit(rep);
                    setFormOpen(true);
                }}
                onReview={(rep) => {
                    setReportToReview(rep);
                    setReviewOpen(true);
                }}
                onUpdated={invalidateReports}
            />

            {isAdminOrManager && (
                <ReportReviewDialog
                    open={reviewOpen}
                    onOpenChange={setReviewOpen}
                    report={reportToReview}
                    onSuccess={invalidateReports}
                />
            )}
        </div>
    );
}
