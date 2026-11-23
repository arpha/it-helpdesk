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
import { saveReport } from "../actions";
import { useAllUsers } from "@/hooks/api/use-all-users";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
    Check,
    ChevronsUpDown,
    FileText,
    Loader2,
    Save,
    ShieldAlert,
    Upload,
    X,
} from "lucide-react";
import {
    REPORT_PERIOD_LABELS,
    REPORT_PRIORITY_CONFIG,
    formatFileSize,
    getReportAttachments,
    type Report,
    type ReportAttachment,
    type ReportCategory,
    type ReportPeriodType,
    type ReportPriority,
    type ReportStatus,
} from "@/types/report";

interface ReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reportToEdit?: Report | null;
    defaultDeadline?: string | null;
    categories: ReportCategory[];
    onSuccess: () => void;
}

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.png,.jpg,.jpeg";

export function ReportDialog({
    open,
    onOpenChange,
    reportToEdit,
    defaultDeadline,
    categories,
    onSuccess,
}: ReportDialogProps) {
    const { user } = useAuthStore();
    const { data: users = [] } = useAllUsers();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [title, setTitle] = useState("");
    const [reportNumber, setReportNumber] = useState("");
    const [categoryId, setCategoryId] = useState<string>("");
    const [priority, setPriority] = useState<ReportPriority>("normal");
    const [periodType, setPeriodType] = useState<ReportPeriodType>("monthly");
    const [periodStart, setPeriodStart] = useState("");
    const [periodEnd, setPeriodEnd] = useState("");
    const [deadline, setDeadline] = useState("");
    const [status, setStatus] = useState<ReportStatus>("pending");
    const [assignedTo, setAssignedTo] = useState<string>("");
    const [description, setDescription] = useState("");
    const [editReason, setEditReason] = useState("");
    const [existingAttachments, setExistingAttachments] = useState<ReportAttachment[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [picOpen, setPicOpen] = useState(false);

    const isEditing = !!reportToEdit;
    const isAdminOrManager = ["admin", "manager_it"].includes(user?.role || "");
    const isEditingOthersReport =
        isEditing &&
        reportToEdit?.created_by !== user?.id &&
        reportToEdit?.assigned_to !== user?.id;

    useEffect(() => {
        if (!open) return;

        if (reportToEdit) {
            setTitle(reportToEdit.title || "");
            setReportNumber(reportToEdit.report_number || "");
            setCategoryId(reportToEdit.category_id || "");
            setPriority(reportToEdit.priority || "normal");
            setPeriodType(reportToEdit.period_type || "monthly");
            setPeriodStart(reportToEdit.period_start || "");
            setPeriodEnd(reportToEdit.period_end || "");
            setDeadline(reportToEdit.deadline || "");
            setStatus(reportToEdit.status || "pending");
            setAssignedTo(reportToEdit.assigned_to || "");
            setDescription(reportToEdit.description || "");
            setEditReason("");
            setExistingAttachments(getReportAttachments(reportToEdit));
            setSelectedFiles([]);
        } else {
            const today = new Date();
            const defaultDl =
                defaultDeadline ||
                new Date(today.getFullYear(), today.getMonth() + 1, 0)
                    .toISOString()
                    .split("T")[0];

            setTitle("");
            setReportNumber("");
            setCategoryId(categories[0]?.id || "");
            setPriority("normal");
            setPeriodType("monthly");
            setPeriodStart("");
            setPeriodEnd("");
            setDeadline(defaultDl);
            setStatus("pending");
            setAssignedTo(user?.id || "");
            setDescription("");
            setEditReason("");
            setExistingAttachments([]);
            setSelectedFiles([]);
        }
    }, [reportToEdit, defaultDeadline, open, categories, user?.id]);

    const handleFilesValidation = (fileList: FileList | File[] | null | undefined) => {
        if (!fileList || fileList.length === 0) return;
        const maxBytes = 10 * 1024 * 1024; // 10 MB per file
        const incoming = Array.from(fileList);
        const valid: File[] = [];

        for (const file of incoming) {
            if (file.size > maxBytes) {
                toast.error(`File "${file.name}" melebihi batas maksimal 10 MB.`);
                continue;
            }
            valid.push(file);
        }

        if (valid.length > 0) {
            setSelectedFiles((prev) => {
                const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
                const deduped = valid.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));
                return [...prev, ...deduped];
            });
        }
    };

    const removeNewFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
    };

    const removeExistingAttachment = (url: string) => {
        setExistingAttachments((prev) => prev.filter((a) => a.url !== url));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error("Judul laporan wajib diisi.");
            return;
        }
        if (!deadline) {
            toast.error("Tanggal deadline wajib diisi.");
            return;
        }
        if (isEditingOthersReport && !isAdminOrManager && !editReason.trim()) {
            toast.error("Mohon isi alasan perubahan untuk audit keamanan.");
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            if (reportToEdit) {
                formData.append("id", reportToEdit.id);
                formData.append("kept_attachments", JSON.stringify(existingAttachments));
            }
            formData.append("title", title.trim());
            formData.append("report_number", reportNumber.trim());
            formData.append("category_id", categoryId === "none" ? "" : categoryId);
            formData.append("priority", priority);
            formData.append("period_type", periodType);
            formData.append("period_start", periodStart);
            formData.append("period_end", periodEnd);
            formData.append("deadline", deadline);
            formData.append("status", status);
            formData.append("assigned_to", assignedTo === "none" ? "" : assignedTo);
            formData.append("description", description.trim());
            if (editReason.trim()) {
                formData.append("edit_reason", editReason.trim());
            }
            for (const file of selectedFiles) {
                formData.append("files", file);
            }

            const res = await saveReport(formData);
            if (res.success) {
                toast.success(
                    isEditing
                        ? "Laporan berhasil diperbarui & dicatat ke audit log."
                        : "Laporan baru berhasil dibuat."
                );
                onOpenChange(false);
                onSuccess();
            } else {
                toast.error(res.error || "Gagal menyimpan laporan.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Terjadi kesalahan saat menyimpan laporan.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Opsi status yang bisa dipilih user biasa vs admin/manager
    const selectableStatuses: { value: ReportStatus; label: string }[] = isAdminOrManager
        ? [
              { value: "pending", label: "Pending" },
              { value: "draft", label: "Draft (Sedang Dikerjakan)" },
              { value: "submitted", label: "Submitted (Siap Review)" },
              { value: "review", label: "Direview" },
              { value: "revision", label: "Perlu Revisi" },
              { value: "approved", label: "Disetujui" },
              { value: "rejected", label: "Ditolak" },
          ]
        : [
              { value: "pending", label: "Pending" },
              { value: "draft", label: "Draft (Sedang Dikerjakan)" },
              { value: "submitted", label: "Submitted (Siap Review)" },
          ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        {isEditing ? "Edit Laporan" : "Buat Laporan Baru"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Setiap perubahan data dan lampiran akan tercatat otomatis di audit trail."
                            : "Tambahkan laporan baru ke inventaris beserta jadwal deadline dan PIC."}
                    </DialogDescription>
                </DialogHeader>

                {isEditingOthersReport && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">
                                Perhatian Keamanan (Audit Log Aktif)
                            </p>
                            <p className="mt-0.5 opacity-90">
                                Anda sedang mengedit laporan milik pengguna lain. Nama Anda,
                                waktu, IP address, dan seluruh detail perubahan (sebelum &
                                sesudah) akan direkam permanen di log keamanan.
                            </p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 py-1">
                    {/* Judul & Nomor */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="report-title">
                                Judul Laporan <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="report-title"
                                placeholder="Contoh: Laporan Bulanan IT — November 2026"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="report-number">Nomor Laporan</Label>
                            <Input
                                id="report-number"
                                placeholder="LAP/IT/2026/011"
                                value={reportNumber}
                                onChange={(e) => setReportNumber(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Kategori & Prioritas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    </div>

                    {/* Periode Pelaporan */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label>Periode Pelaporan</Label>
                            <Select
                                value={periodType}
                                onValueChange={(v) => setPeriodType(v as ReportPeriodType)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(REPORT_PERIOD_LABELS) as ReportPeriodType[]).map(
                                        (key) => (
                                            <SelectItem key={key} value={key}>
                                                {REPORT_PERIOD_LABELS[key]}
                                            </SelectItem>
                                        )
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="period-start">Periode Awal</Label>
                            <Input
                                id="period-start"
                                type="date"
                                value={periodStart}
                                onChange={(e) => setPeriodStart(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="period-end">Periode Akhir</Label>
                            <Input
                                id="period-end"
                                type="date"
                                value={periodEnd}
                                onChange={(e) => setPeriodEnd(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Deadline, PIC, Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="report-deadline">
                                Deadline <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="report-deadline"
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Ditugaskan ke (PIC)</Label>
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
                                <PopoverContent
                                    className="w-[280px] p-0"
                                    align="start"
                                >
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
                                                                {u.username &&
                                                                    u.full_name && (
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

                        <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select
                                value={
                                    selectableStatuses.some((s) => s.value === status)
                                        ? status
                                        : "draft"
                                }
                                onValueChange={(v) => setStatus(v as ReportStatus)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectableStatuses.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Keterangan */}
                    <div className="space-y-1.5">
                        <Label htmlFor="report-desc">Keterangan / Ringkasan</Label>
                        <Textarea
                            id="report-desc"
                            rows={3}
                            placeholder="Catatan singkat isi laporan, sumber data, atau hal penting lainnya..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* File Upload Multi-File Drag & Drop */}
                    <div className="space-y-2">
                        <Label>
                            Upload File Laporan (Bisa lebih dari 1 file, maks. 10 MB/file)
                        </Label>
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                handleFilesValidation(e.dataTransfer.files);
                            }}
                            className={`relative rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                                isDragging
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50"
                            }`}
                        >
                            <label
                                htmlFor="report-file-input"
                                className="flex flex-col items-center gap-1.5 cursor-pointer"
                            >
                                <Upload className="h-6 w-6 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                    Drag & drop atau klik untuk pilih satu / beberapa file
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    PDF, Word, Excel, PowerPoint, CSV, atau Gambar
                                </span>
                                <input
                                    id="report-file-input"
                                    type="file"
                                    multiple
                                    accept={ACCEPTED_EXTENSIONS}
                                    className="hidden"
                                    onChange={(e) => {
                                        handleFilesValidation(e.target.files);
                                        e.target.value = "";
                                    }}
                                />
                            </label>
                        </div>

                        {/* Daftar File Tersimpan (saat edit) */}
                        {isEditing && existingAttachments.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">
                                    File tersimpan ({existingAttachments.length}):
                                </p>
                                <div className="space-y-1.5">
                                    {existingAttachments.map((att) => (
                                        <div
                                            key={att.url}
                                            className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-left"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileText className="h-4 w-4 text-primary shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium truncate">
                                                        {att.name}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {formatFileSize(att.size)}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                                title="Hapus file ini dari laporan"
                                                onClick={() => removeExistingAttachment(att.url)}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Daftar File Baru yang Akan Diunggah */}
                        {selectedFiles.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-xs font-medium text-primary">
                                    File baru yang akan diunggah ({selectedFiles.length}):
                                </p>
                                <div className="space-y-1.5">
                                    {selectedFiles.map((file, idx) => (
                                        <div
                                            key={`${file.name}-${file.size}-${idx}`}
                                            className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileText className="h-4 w-4 text-primary shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium truncate">
                                                        {file.name}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {formatFileSize(file.size)}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                                title="Batalkan file ini"
                                                onClick={() => removeNewFile(idx)}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Alasan perubahan (untuk audit trail saat edit) */}
                    {isEditing && (
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-reason">
                                Catatan / Alasan Perubahan{" "}
                                {isEditingOthersReport && !isAdminOrManager && (
                                    <span className="text-destructive">*</span>
                                )}
                            </Label>
                            <Input
                                id="edit-reason"
                                placeholder="Contoh: Perbarui lampiran versi final / koreksi tanggal deadline"
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                                required={isEditingOthersReport && !isAdminOrManager}
                            />
                        </div>
                    )}

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
                                    {isEditing ? "Simpan Perubahan" : "Simpan Laporan"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
