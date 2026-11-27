"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { saveReportSchedule } from "../actions";
import { useAllUsers } from "@/hooks/api/use-all-users";
import { useAuthStore } from "@/stores/auth-store";
import { getNextOccurrencePreview } from "@/lib/reports/schedule-utils";
import { toast } from "sonner";
import {
    CalendarClock,
    Check,
    ChevronsUpDown,
    Loader2,
    Repeat,
    Save,
} from "lucide-react";
import {
    DEFAULT_GENERATE_DAYS_BEFORE,
    INDONESIAN_MONTHS,
    REPORT_PRIORITY_CONFIG,
    SCHEDULE_FREQUENCY_LABELS,
    type ReportCategory,
    type ReportDeadlineRule,
    type ReportPriority,
    type ReportSchedule,
    type ReportScheduleFrequency,
} from "@/types/report";

interface ScheduleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    scheduleToEdit?: ReportSchedule | null;
    categories: ReportCategory[];
    onSuccess: () => void;
}

function formatDateID(ymd: string) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export function ScheduleDialog({
    open,
    onOpenChange,
    scheduleToEdit,
    categories,
    onSuccess,
}: ScheduleDialogProps) {
    const { user } = useAuthStore();
    const { data: users = [] } = useAllUsers();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [titleTemplate, setTitleTemplate] = useState("");
    const [numberPrefix, setNumberPrefix] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [priority, setPriority] = useState<ReportPriority>("normal");
    const [assignedTo, setAssignedTo] = useState("");
    const [frequency, setFrequency] = useState<ReportScheduleFrequency>("monthly");
    const [deadlineRule, setDeadlineRule] = useState<ReportDeadlineRule>("fixed_day");
    const [deadlineDay, setDeadlineDay] = useState<number>(25);
    const [deadlineMonth, setDeadlineMonth] = useState<number>(12);
    const [generateDaysBefore, setGenerateDaysBefore] = useState<number>(
        DEFAULT_GENERATE_DAYS_BEFORE.monthly
    );
    const [isActive, setIsActive] = useState<boolean>(true);
    const [description, setDescription] = useState("");
    const [picOpen, setPicOpen] = useState(false);

    const isEditing = !!scheduleToEdit;

    useEffect(() => {
        if (!open) return;

        if (scheduleToEdit) {
            setTitleTemplate(scheduleToEdit.title_template || "");
            setNumberPrefix(scheduleToEdit.report_number_prefix || "");
            setCategoryId(scheduleToEdit.category_id || "");
            setPriority(scheduleToEdit.priority || "normal");
            setAssignedTo(scheduleToEdit.assigned_to || "");
            setFrequency(scheduleToEdit.frequency || "monthly");
            setDeadlineRule(scheduleToEdit.deadline_rule || "fixed_day");
            setDeadlineDay(scheduleToEdit.deadline_day || 25);
            setDeadlineMonth(scheduleToEdit.deadline_month || 12);
            setGenerateDaysBefore(
                scheduleToEdit.generate_days_before ??
                    DEFAULT_GENERATE_DAYS_BEFORE[scheduleToEdit.frequency || "monthly"]
            );
            setIsActive(scheduleToEdit.is_active);
            setDescription(scheduleToEdit.description || "");
        } else {
            setTitleTemplate("");
            setNumberPrefix("");
            setCategoryId(categories[0]?.id || "");
            setPriority("normal");
            setAssignedTo(user?.id || "");
            setFrequency("monthly");
            setDeadlineRule("fixed_day");
            setDeadlineDay(25);
            setDeadlineMonth(12);
            setGenerateDaysBefore(DEFAULT_GENERATE_DAYS_BEFORE.monthly);
            setIsActive(true);
            setDescription("");
        }
    }, [scheduleToEdit, open, categories, user?.id]);

    const handleFrequencyChange = (nextFreq: ReportScheduleFrequency) => {
        setFrequency(nextFreq);
        setGenerateDaysBefore(DEFAULT_GENERATE_DAYS_BEFORE[nextFreq]);
        if (nextFreq === "quarterly" || nextFreq === "semiannual") {
            setDeadlineRule("end_of_period");
            setDeadlineDay(10);
        } else if (nextFreq === "yearly") {
            setDeadlineRule("fixed_day");
            setDeadlineMonth(12);
            setDeadlineDay(31);
        } else {
            setDeadlineRule("fixed_day");
            setDeadlineDay(25);
        }
    };

    const preview = useMemo(() => {
        return getNextOccurrencePreview({
            title_template: titleTemplate.trim() || "Contoh Nama Laporan",
            frequency,
            deadline_rule: deadlineRule,
            deadline_day: deadlineDay || 1,
            deadline_month: frequency === "yearly" ? deadlineMonth : null,
            generate_days_before: generateDaysBefore || 0,
        });
    }, [titleTemplate, frequency, deadlineRule, deadlineDay, deadlineMonth, generateDaysBefore]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!titleTemplate.trim()) {
            toast.error("Nama template laporan wajib diisi.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await saveReportSchedule({
                id: scheduleToEdit?.id || null,
                title_template: titleTemplate.trim(),
                report_number_prefix: numberPrefix.trim() || null,
                category_id: categoryId || null,
                description: description.trim() || null,
                priority,
                assigned_to: assignedTo || null,
                frequency,
                deadline_rule: deadlineRule,
                deadline_day: deadlineDay,
                deadline_month: frequency === "yearly" ? deadlineMonth : null,
                generate_days_before: generateDaysBefore,
                is_active: isActive,
            });

            if (res.success) {
                toast.success(
                    isEditing
                        ? "Jadwal laporan rutin berhasil diperbarui."
                        : "Jadwal laporan rutin baru berhasil dibuat."
                );
                onOpenChange(false);
                onSuccess();
            } else {
                toast.error(res.error || "Gagal menyimpan jadwal rutin.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const deadlineRuleOptions: { value: ReportDeadlineRule; label: string }[] =
        frequency === "monthly"
            ? [
                  { value: "fixed_day", label: "Tanggal tetap di bulan berjalan" },
                  { value: "end_of_period", label: "Akhir bulan (tgl 28/29/30/31)" },
                  { value: "next_month_day", label: "Tanggal tetap di bulan berikutnya" },
              ]
            : frequency === "quarterly"
              ? [
                    {
                        value: "end_of_period",
                        label: "Akhir triwulan (31 Mar, 30 Jun, 30 Sep, 31 Des)",
                    },
                    {
                        value: "next_month_day",
                        label: "Tgl tetap di bulan setelah triwulan (Apr, Jul, Okt, Jan)",
                    },
                    {
                        value: "fixed_day",
                        label: "Tgl tetap di bulan akhir triwulan (Mar, Jun, Sep, Des)",
                    },
                ]
              : frequency === "semiannual"
                ? [
                      {
                          value: "end_of_period",
                          label: "Akhir semester (30 Jun & 31 Des)",
                      },
                      {
                          value: "next_month_day",
                          label: "Tgl tetap di bulan setelah semester (Jul & Jan)",
                      },
                      {
                          value: "fixed_day",
                          label: "Tgl tetap di bulan akhir semester (Jun & Des)",
                      },
                  ]
                : [
                      { value: "fixed_day", label: "Bulan & tanggal tetap di tahun berjalan" },
                      { value: "end_of_period", label: "Setiap 31 Desember" },
                      {
                          value: "next_month_day",
                          label: "Bulan & tanggal tetap di tahun berikutnya (mis. 15 Jan)",
                      },
                  ];

    const showDayInput = deadlineRule !== "end_of_period";
    const showMonthInput = frequency === "yearly" && deadlineRule !== "end_of_period";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Repeat className="h-5 w-5 text-primary" />
                        {isEditing ? "Edit Jadwal Laporan Rutin" : "Buat Jadwal Laporan Rutin"}
                    </DialogTitle>
                    <DialogDescription>
                        Laporan akan dibuat otomatis di tiap periode (Bulanan, Triwulanan,
                        Semesteran, atau Tahunan) beserta pengingat WA H-7, H-3, dan Overdue.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-1">
                    {/* Nama Template & Prefix Nomor */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="sched-title">
                                Nama Laporan Rutin <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="sched-title"
                                placeholder="Contoh: Laporan SIRS Online"
                                value={titleTemplate}
                                onChange={(e) => setTitleTemplate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="sched-prefix">Prefix Nomor (Opsional)</Label>
                            <Input
                                id="sched-prefix"
                                placeholder="LAP/IT"
                                value={numberPrefix}
                                onChange={(e) => setNumberPrefix(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Kategori, Prioritas, PIC */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label>Kategori</Label>
                            <Select
                                value={categoryId || "none"}
                                onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Tanpa Kategori</SelectItem>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Prioritas</Label>
                            <Select
                                value={priority}
                                onValueChange={(v) => setPriority(v as ReportPriority)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(REPORT_PRIORITY_CONFIG) as ReportPriority[]).map(
                                        (key) => (
                                            <SelectItem key={key} value={key}>
                                                {REPORT_PRIORITY_CONFIG[key].label}
                                            </SelectItem>
                                        )
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>PIC Default</Label>
                            <Popover open={picOpen} onOpenChange={setPicOpen} modal={true}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={picOpen}
                                        className="w-full justify-between font-normal px-3"
                                    >
                                        <span className="truncate">
                                            {assignedTo
                                                ? (() => {
                                                      const found = users.find(
                                                          (u) => u.id === assignedTo
                                                      );
                                                      return (
                                                          found?.full_name ||
                                                          found?.username ||
                                                          "Pilih PIC"
                                                      );
                                                  })()
                                                : "Belum ditentukan"}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari nama pegawai..." />
                                        <CommandList className="max-h-[240px] overflow-y-auto overscroll-contain">
                                            <CommandEmpty>
                                                Pegawai tidak ditemukan.
                                            </CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="__none__ belum ditentukan"
                                                    onSelect={() => {
                                                        setAssignedTo("");
                                                        setPicOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={`mr-2 h-4 w-4 shrink-0 ${
                                                            !assignedTo
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                        }`}
                                                    />
                                                    <span className="text-muted-foreground">
                                                        Belum ditentukan
                                                    </span>
                                                </CommandItem>
                                                {users.map((u) => {
                                                    const displayName =
                                                        u.full_name || u.username || u.id;
                                                    return (
                                                        <CommandItem
                                                            key={u.id}
                                                            value={`${displayName} ${u.username || ""} ${u.id}`}
                                                            onSelect={() => {
                                                                setAssignedTo(u.id);
                                                                setPicOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 shrink-0 ${
                                                                    assignedTo === u.id
                                                                        ? "opacity-100"
                                                                        : "opacity-0"
                                                                }`}
                                                            />
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="truncate">
                                                                    {displayName}
                                                                </span>
                                                                {u.username && u.full_name && (
                                                                    <span className="text-[11px] text-muted-foreground truncate">
                                                                        @{u.username}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Pengaturan Frekuensi & Aturan Deadline */}
                    <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Pengaturan Jadwal & Deadline
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Frekuensi *</Label>
                                <Select
                                    value={frequency}
                                    onValueChange={(v) =>
                                        handleFrequencyChange(v as ReportScheduleFrequency)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(
                                            Object.keys(
                                                SCHEDULE_FREQUENCY_LABELS
                                            ) as ReportScheduleFrequency[]
                                        ).map((f) => (
                                            <SelectItem key={f} value={f}>
                                                {SCHEDULE_FREQUENCY_LABELS[f]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Aturan Deadline *</Label>
                                <Select
                                    value={deadlineRule}
                                    onValueChange={(v) =>
                                        setDeadlineRule(v as ReportDeadlineRule)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {deadlineRuleOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {showMonthInput && (
                                <div className="space-y-1.5">
                                    <Label>Bulan Deadline</Label>
                                    <Select
                                        value={String(deadlineMonth)}
                                        onValueChange={(v) => setDeadlineMonth(Number(v))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {INDONESIAN_MONTHS.map((mName, idx) => (
                                                <SelectItem key={mName} value={String(idx + 1)}>
                                                    {mName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {showDayInput && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="sched-day">Tanggal Deadline (1–31)</Label>
                                    <Input
                                        id="sched-day"
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={deadlineDay}
                                        onChange={(e) =>
                                            setDeadlineDay(
                                                Math.min(31, Math.max(1, Number(e.target.value) || 1))
                                            )
                                        }
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="sched-before">
                                    Buat Otomatis (H-N Hari)
                                </Label>
                                <Input
                                    id="sched-before"
                                    type="number"
                                    min={0}
                                    max={365}
                                    value={generateDaysBefore}
                                    onChange={(e) =>
                                        setGenerateDaysBefore(
                                            Math.min(365, Math.max(0, Number(e.target.value) || 0))
                                        )
                                    }
                                />
                            </div>
                        </div>

                        {/* Live Preview */}
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                            <p className="font-semibold text-primary flex items-center gap-1.5">
                                <CalendarClock className="h-3.5 w-3.5" />
                                Preview Periode Terdekat
                            </p>
                            <p>
                                Judul otomatis:{" "}
                                <strong className="text-foreground">{preview.title}</strong>
                            </p>
                            <p className="text-muted-foreground">
                                Deadline:{" "}
                                <strong className="text-foreground">
                                    {formatDateID(preview.deadline)}
                                </strong>{" "}
                                • Muncul otomatis mulai:{" "}
                                <strong className="text-foreground">
                                    {formatDateID(preview.generateOnDate)}
                                </strong>
                            </p>
                        </div>
                    </div>

                    {/* Keterangan */}
                    <div className="space-y-1.5">
                        <Label htmlFor="sched-desc">Keterangan Default (Opsional)</Label>
                        <Textarea
                            id="sched-desc"
                            rows={2}
                            placeholder="Catatan standar yang ikut tersalin ke setiap laporan periode baru..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <DialogFooter className="pt-2">
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
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    {isEditing ? "Simpan Perubahan" : "Simpan Jadwal Rutin"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
