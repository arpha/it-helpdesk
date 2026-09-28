"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDataTable } from "@/hooks/use-data-table";
import { useTickets, Ticket, useTicketsRealtime } from "@/hooks/api/use-tickets";
import { useATKItems } from "@/hooks/api/use-atk-items";
import { useAssets } from "@/hooks/api/use-assets";
import { useLocations } from "@/hooks/api/use-locations";
import { useUsers } from "@/hooks/api/use-users";
import { useAuthStore } from "@/stores/auth-store";
import { DataTable, Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    MoreHorizontal,
    Eye,
    CheckCircle,
    UserPlus,
    Trash2,
    Plus,
    Loader2,
    X,
    Wrench,
    ChevronsUpDown,
    Check,
    RefreshCw,
    Pencil,
    Calendar,
    Clock,
    User,
    MapPin,
    FileText,
    CheckCircle2,
    AlertCircle,
    Copy,
    Sparkles,
    Box,
    Laptop,
    Network,
    Database,
    Tag,
    Ticket as TicketIcon,
    RotateCcw,
    Filter,
} from "lucide-react";
import {
    createTicket,
    updateTicket,
    assignTicket,
    reassignTicket,
    completeTicket,
    deleteTicket,
} from "../actions";

const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-600",
    open: "bg-yellow-500/10 text-yellow-600",
    in_progress: "bg-blue-500/10 text-blue-600",
    resolved: "bg-green-500/10 text-green-600",
    closed: "bg-gray-500/10 text-gray-500",
};

const statusLabels: Record<string, string> = {
    draft: "Draf",
    open: "Menunggu",
    in_progress: "Diproses",
    resolved: "Selesai",
    closed: "Ditutup",
};

const priorityColors: Record<string, string> = {
    low: "bg-gray-500/10 text-gray-600",
    medium: "bg-blue-500/10 text-blue-600",
    high: "bg-orange-500/10 text-orange-600",
    urgent: "bg-red-500/10 text-red-600",
};

const priorityLabels: Record<string, string> = {
    low: "Rendah",
    medium: "Sedang",
    high: "Tinggi",
    urgent: "Mendesak",
};

const categoryLabels: Record<string, string> = {
    hardware: "Hardware",
    software: "Software",
    data: "Data",
    network: "Jaringan",
};

const repairTypeLabels: Record<string, string> = {
    "Repair / Replacement": "Perbaikan / Penggantian (Repair / Replacement)",
    "Upgrade": "Peningkatan (Upgrade)",
    "Cleaning": "Pembersihan (Cleaning)",
    "Inspection / Troubleshooting": "Pemeriksaan & Diagnosa (Inspection)",
    "Installation / Reinstallation": "Instalasi / Instal Ulang",
    "Update / Patching": "Pembaruan Sistem (Update / Patching)",
    "Configuration / Setup": "Konfigurasi & Pengaturan (Setup)",
    "Troubleshooting / Bug Fixing": "Penanganan Bug & Gangguan",
    "Backup & Restore": "Pencadangan & Pemulihan (Backup & Restore)",
    "Data Recovery": "Pemulihan Data (Data Recovery)",
    "Data Migration": "Migrasi Data (Data Migration)",
    "Data Cleanup / Sanitization": "Pembersihan Data (Data Cleanup)",
    "Installation & Cabling": "Instalasi & Pengkabelan (Cabling)",
    "Network Configuration": "Konfigurasi Jaringan (Network Config)",
    "Network Repair / Troubleshooting": "Perbaikan Gangguan Jaringan",
    "Maintenance & Optimization": "Pemeliharaan & Optimasi Jaringan",
};

const REPAIR_TYPES_BY_CATEGORY: Record<string, string[]> = {
    hardware: [
        "Repair / Replacement",
        "Upgrade",
        "Cleaning",
        "Inspection / Troubleshooting",
    ],
    software: [
        "Installation / Reinstallation",
        "Update / Patching",
        "Configuration / Setup",
        "Troubleshooting / Bug Fixing",
    ],
    data: [
        "Backup & Restore",
        "Data Recovery",
        "Data Migration",
        "Data Cleanup / Sanitization",
    ],
    network: [
        "Installation & Cabling",
        "Network Configuration",
        "Network Repair / Troubleshooting",
        "Maintenance & Optimization",
    ],
};

function formatFullDateTime(dateStr?: string | null): string {
    if (!dateStr) return "-";
    try {
        const d = new Date(dateStr);
        const day = d.getDate();
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return `${day} ${month} ${year}, ${hours}:${minutes} WIB`;
    } catch {
        return dateStr;
    }
}

function calculateDuration(startStr?: string | null, endStr?: string | null): string | null {
    if (!startStr || !endStr) return null;
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    const diffMs = end - start;
    if (diffMs <= 0) return "< 1 Menit";

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;

    if (days > 0) return `${days} Hari ${remHours} Jam`;
    if (hours > 0) return `${hours} Jam ${minutes} Menit`;
    return `${minutes} Menit`;
}

function formatRupiah(num?: number | null): string {
    if (num == null) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(num);
}

function parseResolution(resolutionNotes?: string | null) {
    if (!resolutionNotes) return { repairType: null, notes: "" };
    const match = resolutionNotes.match(/^\[(.*?)\]\s*([\s\S]*)$/);
    if (match) {
        return {
            repairType: match[1],
            notes: match[2] || "-",
        };
    }
    return {
        repairType: null,
        notes: resolutionNotes,
    };
}

function getCategoryIcon(cat?: string) {
    switch (cat?.toLowerCase()) {
        case "hardware":
            return <Laptop className="h-3.5 w-3.5" />;
        case "software":
            return <FileText className="h-3.5 w-3.5" />;
        case "network":
            return <Network className="h-3.5 w-3.5" />;
        case "data":
            return <Database className="h-3.5 w-3.5" />;
        default:
            return <Tag className="h-3.5 w-3.5" />;
    }
}

export function TicketsClient() {
    const { page, limit, search, setPage, setLimit, setSearch } = useDataTable();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [statusFilter, setStatusFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [isPending, startTransition] = useTransition();

    // Enable realtime updates
    useTicketsRealtime();

    const { data: ticketsData, isLoading } = useTickets({
        page,
        limit,
        status: statusFilter,
        category: categoryFilter,
        priority: priorityFilter,
        search,
    });

    const { data: itemsData } = useATKItems({ page: 1, limit: 1000, status: "active" });
    const { data: assetsData } = useAssets({ page: 1, limit: 1000, excludeStatuses: ["damage", "disposed"] });
    const { data: locations } = useLocations();
    const { data: usersData } = useUsers({ page: 1, limit: 1000, roles: ["staff_it", "admin"], activeOnly: true });
    const { data: allUsersData } = useUsers({ page: 1, limit: 1000, activeOnly: true }); // All users for requester dropdown

    // Modal states
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isCompleteOpen, setIsCompleteOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [isReassignOpen, setIsReassignOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

    // Form state
    const [formTitle, setFormTitle] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formCategory, setFormCategory] = useState("hardware");
    const [formPriority, setFormPriority] = useState("medium");
    const [formAssetId, setFormAssetId] = useState("");
    const [formAssignee, setFormAssignee] = useState("");
    const [formResolution, setFormResolution] = useState("");
    const [completeCategory, setCompleteCategory] = useState("hardware");
    const [formRepairType, setFormRepairType] = useState(REPAIR_TYPES_BY_CATEGORY.hardware[0]);
    const [formParts, setFormParts] = useState<{ item_id: string; quantity: number }[]>([]);
    const [assetPopoverOpen, setAssetPopoverOpen] = useState(false);
    const [partsPopoverOpenIdx, setPartsPopoverOpenIdx] = useState<number | null>(null);
    const [formRequester, setFormRequester] = useState(""); // Requester ID for admin
    const [requesterPopoverOpen, setRequesterPopoverOpen] = useState(false);
    const [copiedId, setCopiedId] = useState(false);

    const handleCopyId = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
    };

    const isStaff = user?.role === "admin" || user?.role === "staff_it" || user?.role === "manager_it";

    const resetForm = () => {
        setFormTitle("");
        setFormDescription("");
        setFormCategory("hardware");
        setFormPriority("medium");
        setFormAssetId("");
        setFormAssignee("");
        setFormResolution("");
        setCompleteCategory("hardware");
        setFormRepairType(REPAIR_TYPES_BY_CATEGORY.hardware[0]);
        setFormParts([]);
        setFormRequester("");
    };

    const handleCreate = () => {
        startTransition(async () => {
            const result = await createTicket({
                title: formTitle,
                description: formDescription,
                category: formCategory,
                priority: formPriority,
                asset_id: formAssetId || undefined,
                requester_id: formRequester || undefined,
            });

            if (result.success) {
                toast.success("Tiket baru berhasil dibuat!");
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                setIsCreateOpen(false);
                resetForm();
            } else {
                toast.error(result.error || "Gagal membuat tiket");
            }
        });
    };

    const openEditDialog = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setFormTitle(ticket.title);
        setFormDescription(ticket.description || "");
        setFormCategory(ticket.category);
        setFormPriority(ticket.priority);
        setFormAssetId(ticket.asset_id || "");
        setFormRequester(ticket.requester_id || "");
        if (ticket.parts && ticket.parts.length > 0) {
            setFormParts(ticket.parts.map(p => ({ item_id: p.item_id, quantity: p.quantity })));
        } else {
            setFormParts([]);
        }
        setIsEditOpen(true);
    };

    const handleEdit = () => {
        if (!selectedTicket) return;

        startTransition(async () => {
            const result = await updateTicket({
                id: selectedTicket.id,
                title: formTitle,
                description: formDescription,
                category: formCategory,
                priority: formPriority,
                asset_id: formAssetId || undefined,
                requester_id: formRequester || undefined,
                parts: formParts.filter(p => p.item_id && p.quantity > 0),
            });

            if (result.success) {
                toast.success("Tiket berhasil diperbarui!");
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                queryClient.invalidateQueries({ queryKey: ["atk-items"] });
                queryClient.invalidateQueries({ queryKey: ["atk-requests"] });
                setIsEditOpen(false);
                setSelectedTicket(null);
                resetForm();
            } else {
                toast.error(result.error || "Gagal memperbarui tiket");
            }
        });
    };

    const handleAssign = () => {
        if (!selectedTicket || !formAssignee) return;

        startTransition(async () => {
            const result = await assignTicket(selectedTicket.id, formAssignee);
            if (result.success) {
                toast.success("Teknisi berhasil ditugaskan!");
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                setIsAssignOpen(false);
                setSelectedTicket(null);
            } else {
                toast.error(result.error || "Gagal menugaskan teknisi");
            }
        });
    };

    const handleReassign = () => {
        if (!selectedTicket || !formAssignee) return;

        startTransition(async () => {
            const result = await reassignTicket(selectedTicket.id, formAssignee);
            if (result.success) {
                toast.success("Penugasan tiket berhasil dialihkan!");
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                setIsReassignOpen(false);
                setSelectedTicket(null);
                setFormAssignee("");
            } else {
                toast.error(result.error || "Gagal mengalihkan penugasan");
            }
        });
    };

    const handleComplete = () => {
        if (!selectedTicket) return;

        startTransition(async () => {
            const result = await completeTicket({
                id: selectedTicket.id,
                resolution_notes: formResolution,
                repair_type: formRepairType,
                category: completeCategory,
                asset_id: selectedTicket.asset_id || formAssetId || undefined,
                parts: formParts.filter(p => p.item_id && p.quantity > 0),
            });

            if (result.success) {
                toast.success("Tiket berhasil diselesaikan!");
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                queryClient.invalidateQueries({ queryKey: ["atk-items"] });
                queryClient.invalidateQueries({ queryKey: ["asset-maintenance"] });
                setIsCompleteOpen(false);
                setSelectedTicket(null);
                resetForm();
            } else {
                toast.error(result.error || "Gagal menyelesaikan tiket");
            }
        });
    };

    const handleDelete = () => {
        if (!selectedTicket) return;

        startTransition(async () => {
            const result = await deleteTicket(selectedTicket.id);
            if (result.success) {
                toast.success("Tiket berhasil dihapus!");
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                setIsDeleteOpen(false);
                setSelectedTicket(null);
            } else {
                toast.error(result.error || "Gagal menghapus tiket");
            }
        });
    };

    const addPart = () => {
        setFormParts([...formParts, { item_id: "", quantity: 1 }]);
    };

    const removePart = (index: number) => {
        setFormParts(formParts.filter((_, i) => i !== index));
    };

    const updatePart = (index: number, field: "item_id" | "quantity", value: string | number) => {
        const updated = [...formParts];
        updated[index] = { ...updated[index], [field]: value };
        setFormParts(updated);
    };

    const columns: Column<Ticket>[] = [
        {
            key: "title",
            header: "Tiket & Kendala",
            cell: (ticket) => (
                <div 
                    className="cursor-pointer group space-y-1 py-0.5"
                    onClick={() => {
                        setSelectedTicket(ticket);
                        setIsViewOpen(true);
                    }}
                >
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-1">
                            {ticket.title}
                        </span>
                        {ticket.asset && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground border">
                                {ticket.asset.asset_code}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span>{ticket.requester?.full_name || ticket.creator?.full_name || "Pemohon"}</span>
                        <span>•</span>
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{formatFullDateTime(ticket.created_at)}</span>
                    </div>
                </div>
            ),
        },
        {
            key: "category",
            header: "Kategori",
            cell: (ticket) => (
                <Badge variant="outline" className="gap-1.5 py-1 px-2.5 font-medium border bg-muted/40">
                    {getCategoryIcon(ticket.category)}
                    <span>{categoryLabels[ticket.category] || ticket.category}</span>
                </Badge>
            ),
        },
        {
            key: "priority",
            header: "Prioritas & SLA",
            cell: (ticket) => {
                const slaMap: Record<string, string> = {
                    urgent: "≤ 4 Jam",
                    high: "≤ 8 Jam",
                    medium: "≤ 24 Jam",
                    low: "≤ 48 Jam",
                };
                return (
                    <div className="space-y-0.5">
                        <Badge variant="outline" className={cn("gap-1.5 font-medium text-xs border shadow-2xs", priorityColors[ticket.priority])}>
                            <span className={cn(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                ticket.priority === "urgent" ? "bg-red-500 animate-pulse" :
                                ticket.priority === "high" ? "bg-orange-500" :
                                ticket.priority === "medium" ? "bg-yellow-500" : "bg-blue-500"
                            )} />
                            <span>{priorityLabels[ticket.priority] || ticket.priority}</span>
                        </Badge>
                        <p className="text-[10px] font-mono text-muted-foreground pl-0.5">
                            Target {slaMap[ticket.priority] || "≤ 24 Jam"}
                        </p>
                    </div>
                );
            },
        },
        {
            key: "status",
            header: "Status",
            cell: (ticket) => (
                <Badge variant="outline" className={cn("gap-1.5 py-1 px-2.5 font-medium border shadow-2xs", statusColors[ticket.status])}>
                    {ticket.status === "open" && <Clock className="h-3 w-3 text-amber-500" />}
                    {ticket.status === "in_progress" && <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />}
                    {ticket.status === "resolved" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                    {ticket.status === "closed" && <Check className="h-3 w-3 text-gray-500" />}
                    {ticket.status === "draft" && <FileText className="h-3 w-3 text-slate-500" />}
                    <span>{statusLabels[ticket.status] || ticket.status}</span>
                </Badge>
            ),
        },
        {
            key: "assignee",
            header: "Ditugaskan Ke",
            cell: (ticket) => ticket.assignee?.full_name ? (
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {ticket.assignee.full_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium truncate max-w-[130px]">{ticket.assignee.full_name}</span>
                </div>
            ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-normal gap-1 py-0.5">
                    <AlertCircle className="h-3 w-3" />
                    Belum Ditugaskan
                </Badge>
            ),
        },
        {
            key: "actions",
            header: "Aksi",
            cell: (ticket) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedTicket(ticket); setIsViewOpen(true); }}>
                            <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                        </DropdownMenuItem>
                        {isStaff && ticket.status === "open" && (
                            <DropdownMenuItem onClick={() => { setSelectedTicket(ticket); setIsAssignOpen(true); }}>
                                <UserPlus className="mr-2 h-4 w-4" /> Tugaskan Teknisi
                            </DropdownMenuItem>
                        )}
                        {isStaff && ticket.status === "in_progress" && (
                            <>
                                <DropdownMenuItem onClick={() => {
                                    setSelectedTicket(ticket);
                                    setFormAssignee("");
                                    setIsReassignOpen(true);
                                }}>
                                    <RefreshCw className="mr-2 h-4 w-4" /> Tugaskan Ulang
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    setSelectedTicket(ticket);
                                    const cat = ticket.category?.toLowerCase() || "hardware";
                                    setCompleteCategory(cat);
                                    const types = REPAIR_TYPES_BY_CATEGORY[cat] || REPAIR_TYPES_BY_CATEGORY.hardware;
                                    setFormRepairType(types[0]);
                                    setFormAssetId(ticket.asset_id || "");
                                    setIsCompleteOpen(true);
                                }}>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Selesaikan Tiket
                                </DropdownMenuItem>
                            </>
                        )}
                        {(ticket.status === "open" || ticket.status === "in_progress" || isStaff) && (
                            <DropdownMenuItem onClick={() => openEditDialog(ticket)}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit Tiket
                            </DropdownMenuItem>
                        )}
                        {isStaff && (ticket.status === "resolved" || ticket.status === "closed") && (
                            <DropdownMenuItem onClick={async () => {
                                const { convertTicketToKB } = await import("@/app/(dashboard)/knowledge-base/actions");
                                const res = await convertTicketToKB(ticket.id);
                                if (res.success && res.data) {
                                    toast.success("Draft Artikel KB berhasil dibuat dari tiket ini!");
                                    window.location.href = `/knowledge-base?id=${res.data.id}`;
                                }
                            }}>
                                <Plus className="mr-2 h-4 w-4 text-emerald-600" /> Jadikan Artikel KB
                            </DropdownMenuItem>
                        )}
                        {(ticket.status !== "resolved" || user?.role === "admin") && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => { setSelectedTicket(ticket); setIsDeleteOpen(true); }}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" /> Hapus Tiket
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <div className="space-y-6 pb-8">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                            <TicketIcon className="h-5 w-5" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tiket IT Helpdesk</h1>
                        <Badge variant="outline" className="gap-1.5 text-xs font-normal border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 py-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Realtime Aktif
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Kelola laporan insiden pengguna, penugasan perbaikan teknisi, dan pantau standar batas waktu layanan SLA
                    </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                    <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90">
                        <Plus className="h-4 w-4" /> Buat Tiket Baru
                    </Button>
                </div>
            </div>

            {/* SLA Legend Banner (Pedoman Batas Waktu Layanan) */}
            <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4 text-card-foreground shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 shadow-2xs">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold tracking-tight">Pedoman Batas Waktu Layanan (SLA Helpdesk)</span>
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                                    Target Teknisi
                                </span>
                                {priorityFilter !== "all" && (
                                    <button
                                        type="button"
                                        onClick={() => setPriorityFilter("all")}
                                        className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive border transition-colors inline-flex items-center gap-1 cursor-pointer"
                                    >
                                        <span>Filter Aktif: {priorityLabels[priorityFilter] || priorityFilter}</span>
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Target waktu penyelesaian tiket sejak dibuat pelapor untuk menjaga kepuasan pengguna. Klik kartu prioritas untuk menyaring data.
                            </p>
                        </div>
                    </div>

                    {/* Badges for SLA limits with interactive filter */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => setPriorityFilter(priorityFilter === "urgent" ? "all" : "urgent")}
                            className={cn(
                                "flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-left transition-all cursor-pointer hover:bg-red-500/15",
                                priorityFilter === "urgent" && "ring-2 ring-red-500 ring-offset-1 bg-red-500/20 shadow-xs"
                            )}
                            title="Klik untuk filter tiket Urgent"
                        >
                            <div>
                                <span className="font-semibold text-red-600 dark:text-red-400 block">Urgent</span>
                                <span className="text-[10px] text-muted-foreground">Kritis / Darurat</span>
                            </div>
                            <span className="font-mono font-bold text-red-700 dark:text-red-300 shrink-0">≤ 4 Jam</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setPriorityFilter(priorityFilter === "high" ? "all" : "high")}
                            className={cn(
                                "flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-left transition-all cursor-pointer hover:bg-orange-500/15",
                                priorityFilter === "high" && "ring-2 ring-orange-500 ring-offset-1 bg-orange-500/20 shadow-xs"
                            )}
                            title="Klik untuk filter tiket High"
                        >
                            <div>
                                <span className="font-semibold text-orange-600 dark:text-orange-400 block">High</span>
                                <span className="text-[10px] text-muted-foreground">Tinggi</span>
                            </div>
                            <span className="font-mono font-bold text-orange-700 dark:text-orange-300 shrink-0">≤ 8 Jam</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setPriorityFilter(priorityFilter === "medium" ? "all" : "medium")}
                            className={cn(
                                "flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-left transition-all cursor-pointer hover:bg-yellow-500/15",
                                priorityFilter === "medium" && "ring-2 ring-yellow-500 ring-offset-1 bg-yellow-500/20 shadow-xs"
                            )}
                            title="Klik untuk filter tiket Medium"
                        >
                            <div>
                                <span className="font-semibold text-yellow-600 dark:text-yellow-400 block">Medium</span>
                                <span className="text-[10px] text-muted-foreground">Sedang / Rutin</span>
                            </div>
                            <span className="font-mono font-bold text-yellow-700 dark:text-yellow-300 shrink-0">≤ 24 Jam</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setPriorityFilter(priorityFilter === "low" ? "all" : "low")}
                            className={cn(
                                "flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-left transition-all cursor-pointer hover:bg-blue-500/15",
                                priorityFilter === "low" && "ring-2 ring-blue-500 ring-offset-1 bg-blue-500/20 shadow-xs"
                            )}
                            title="Klik untuk filter tiket Low"
                        >
                            <div>
                                <span className="font-semibold text-blue-600 dark:text-blue-400 block">Low</span>
                                <span className="text-[10px] text-muted-foreground">Rendah</span>
                            </div>
                            <span className="font-mono font-bold text-blue-700 dark:text-blue-300 shrink-0">≤ 48 Jam</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
                {/* Status Segmented Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {[
                        { key: "all", label: "Semua Status", dot: null },
                        { key: "open", label: "Menunggu", dot: "bg-amber-500" },
                        { key: "in_progress", label: "Diproses", dot: "bg-blue-500" },
                        { key: "resolved", label: "Selesai", dot: "bg-emerald-500" },
                        { key: "closed", label: "Ditutup", dot: "bg-gray-400" },
                    ].map((st) => {
                        const isActive = statusFilter === st.key;
                        return (
                            <button
                                key={st.key}
                                type="button"
                                onClick={() => setStatusFilter(st.key)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {st.dot && <span className={cn("h-2 w-2 rounded-full", st.dot)} />}
                                <span>{st.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Dropdowns */}
                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[150px] h-9 text-xs">
                            <SelectValue placeholder="Kategori" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Kategori</SelectItem>
                            <SelectItem value="hardware">Hardware</SelectItem>
                            <SelectItem value="software">Software</SelectItem>
                            <SelectItem value="data">Data</SelectItem>
                            <SelectItem value="network">Jaringan</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-[145px] h-9 text-xs">
                            <SelectValue placeholder="Prioritas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Prioritas</SelectItem>
                            <SelectItem value="urgent">Urgent (≤ 4 Jam)</SelectItem>
                            <SelectItem value="high">High (≤ 8 Jam)</SelectItem>
                            <SelectItem value="medium">Medium (≤ 24 Jam)</SelectItem>
                            <SelectItem value="low">Low (≤ 48 Jam)</SelectItem>
                        </SelectContent>
                    </Select>

                    {(statusFilter !== "all" || categoryFilter !== "all" || priorityFilter !== "all" || search) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setStatusFilter("all");
                                setCategoryFilter("all");
                                setPriorityFilter("all");
                                setSearch("");
                            }}
                            className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset
                        </Button>
                    )}
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
                <DataTable
                    columns={columns}
                    data={ticketsData?.data || []}
                    isLoading={isLoading}
                    page={page}
                    limit={limit}
                    totalItems={ticketsData?.totalItems || 0}
                    totalPages={ticketsData?.totalPages || 1}
                    onPageChange={setPage}
                    onLimitChange={setLimit}
                    searchValue={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Cari tiket, pemohon, atau nomor aset..."
                    emptyMessage="Tidak ada tiket yang ditemukan."
                />
            </div>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Buat Tiket Baru</DialogTitle>
                        <DialogDescription>Kirim laporan kendala atau permintaan bantuan IT baru</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Judul Kendala / Permasalahan *</Label>
                            <Input
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="Ringkasan singkat kendala yang dialami"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Deskripsi Lengkap</Label>
                            <Textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="Jelaskan detail kronologi, pesan error, atau kebutuhan..."
                                rows={3}
                            />
                        </div>
                        {isStaff && (
                            <div className="space-y-2">
                                <Label>Pelapor / Pemohon (opsional)</Label>
                                <Popover open={requesterPopoverOpen} onOpenChange={setRequesterPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={requesterPopoverOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {formRequester ? (
                                                allUsersData?.data?.find((u) => u.id === formRequester)?.full_name || "Tidak Diketahui"
                                            ) : (
                                                <span className="text-muted-foreground">Pilih pemohon jika berbeda dari akun Anda...</span>
                                            )}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0" align="start" side="bottom" sideOffset={8} avoidCollisions={true}>
                                        <Command shouldFilter={true}>
                                            <CommandInput placeholder="Cari nama pemohon..." className="h-9" />
                                            <CommandList className="max-h-[200px]">
                                                <CommandEmpty>User tidak ditemukan.</CommandEmpty>
                                                <CommandGroup>
                                                    {allUsersData?.data?.map((u) => (
                                                        <CommandItem
                                                            key={u.id}
                                                            value={u.full_name || u.username || ""}
                                                            onSelect={() => {
                                                                setFormRequester(u.id === formRequester ? "" : u.id);
                                                                setRequesterPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 ${formRequester === u.id ? "opacity-100" : "opacity-0"}`}
                                                            />
                                                            <span>{u.full_name || u.username}</span>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <p className="text-xs text-muted-foreground">Biarkan kosong jika Anda sendiri yang melapor</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Kategori</Label>
                                <Select value={formCategory} onValueChange={setFormCategory}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hardware">Hardware</SelectItem>
                                        <SelectItem value="software">Software</SelectItem>
                                        <SelectItem value="data">Data</SelectItem>
                                        <SelectItem value="network">Jaringan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Prioritas</Label>
                                <Select value={formPriority} onValueChange={setFormPriority}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Rendah (Low)</SelectItem>
                                        <SelectItem value="medium">Sedang (Medium)</SelectItem>
                                        <SelectItem value="high">Tinggi (High)</SelectItem>
                                        <SelectItem value="urgent">Mendesak (Urgent)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Aset Terkait (opsional)</Label>
                            <Popover open={assetPopoverOpen} onOpenChange={setAssetPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={assetPopoverOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        {formAssetId ? (
                                            <div className="flex flex-col items-start text-left">
                                                <span className="truncate">
                                                    {assetsData?.data?.find((a) => a.id === formAssetId)?.name} ({assetsData?.data?.find((a) => a.id === formAssetId)?.asset_code})
                                                </span>
                                                {assetsData?.data?.find((a) => a.id === formAssetId)?.locations?.name && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {assetsData?.data?.find((a) => a.id === formAssetId)?.locations?.name}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">Pilih atau cari aset terkait...</span>
                                        )}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari nama atau kode aset..." />
                                        <CommandList>
                                            <CommandEmpty>Aset tidak ditemukan.</CommandEmpty>
                                            <CommandGroup>
                                                {assetsData?.data?.filter((asset) => asset.status !== "damage" && asset.status !== "disposed").map((asset) => (
                                                    <CommandItem
                                                        key={asset.id}
                                                        value={`${asset.name} ${asset.asset_code} ${asset.locations?.name || ""}`}
                                                        onSelect={() => {
                                                            setFormAssetId(asset.id === formAssetId ? "" : asset.id);
                                                            setAssetPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${formAssetId === asset.id ? "opacity-100" : "opacity-0"}`}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span>{asset.name} ({asset.asset_code})</span>
                                                            {asset.locations?.name && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {asset.locations.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Batal</Button>
                            <Button onClick={handleCreate} disabled={isPending || !formTitle}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Buat Tiket
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Tiket</DialogTitle>
                        <DialogDescription>Perbarui data dan informasi tiket bantuan</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Judul Kendala / Permasalahan *</Label>
                            <Input
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="Ringkasan singkat kendala yang dialami"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Deskripsi Lengkap</Label>
                            <Textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="Jelaskan detail kronologi, pesan error, atau kebutuhan..."
                                rows={3}
                            />
                        </div>
                        {isStaff && (
                            <div className="space-y-2">
                                <Label>Pelapor / Pemohon (opsional)</Label>
                                <Popover open={requesterPopoverOpen} onOpenChange={setRequesterPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={requesterPopoverOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {formRequester ? (
                                                allUsersData?.data?.find((u) => u.id === formRequester)?.full_name || "Tidak Diketahui"
                                            ) : (
                                                <span className="text-muted-foreground">Pilih pemohon...</span>
                                            )}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0" align="start" side="bottom" sideOffset={8} avoidCollisions={true}>
                                        <Command shouldFilter={true}>
                                            <CommandInput placeholder="Cari nama pemohon..." className="h-9" />
                                            <CommandList className="max-h-[200px]">
                                                <CommandEmpty>User tidak ditemukan.</CommandEmpty>
                                                <CommandGroup>
                                                    {allUsersData?.data?.map((u) => (
                                                        <CommandItem
                                                            key={u.id}
                                                            value={u.full_name || u.username || ""}
                                                            onSelect={() => {
                                                                setFormRequester(u.id === formRequester ? "" : u.id);
                                                                setRequesterPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 ${formRequester === u.id ? "opacity-100" : "opacity-0"}`}
                                                            />
                                                            <span>{u.full_name || u.username}</span>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Kategori</Label>
                                <Select value={formCategory} onValueChange={setFormCategory}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hardware">Hardware</SelectItem>
                                        <SelectItem value="software">Software</SelectItem>
                                        <SelectItem value="data">Data</SelectItem>
                                        <SelectItem value="network">Jaringan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Prioritas</Label>
                                <Select value={formPriority} onValueChange={setFormPriority}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Rendah (Low)</SelectItem>
                                        <SelectItem value="medium">Sedang (Medium)</SelectItem>
                                        <SelectItem value="high">Tinggi (High)</SelectItem>
                                        <SelectItem value="urgent">Mendesak (Urgent)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Aset Terkait (opsional)</Label>
                            <Popover open={assetPopoverOpen} onOpenChange={setAssetPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={assetPopoverOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        {formAssetId ? (
                                            <div className="flex flex-col items-start text-left">
                                                <span className="truncate">
                                                    {assetsData?.data?.find((a) => a.id === formAssetId)?.name} ({assetsData?.data?.find((a) => a.id === formAssetId)?.asset_code})
                                                </span>
                                                {assetsData?.data?.find((a) => a.id === formAssetId)?.locations?.name && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {assetsData?.data?.find((a) => a.id === formAssetId)?.locations?.name}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">Pilih atau cari aset terkait...</span>
                                        )}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari nama atau kode aset..." />
                                        <CommandList>
                                            <CommandEmpty>Aset tidak ditemukan.</CommandEmpty>
                                            <CommandGroup>
                                                {assetsData?.data?.filter((asset) => asset.status !== "damage" && asset.status !== "disposed").map((asset) => (
                                                    <CommandItem
                                                        key={asset.id}
                                                        value={`${asset.name} ${asset.asset_code} ${asset.locations?.name || ""}`}
                                                        onSelect={() => {
                                                            setFormAssetId(asset.id === formAssetId ? "" : asset.id);
                                                            setAssetPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${formAssetId === asset.id ? "opacity-100" : "opacity-0"}`}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span>{asset.name} ({asset.asset_code})</span>
                                                            {asset.locations?.name && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {asset.locations.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Suku Cadang / ATK Digunakan (opsional)</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addPart}>
                                    <Plus className="h-3 w-3 mr-1" /> Tambah Barang
                                </Button>
                            </div>
                            {formParts.map((part, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <Popover
                                        open={partsPopoverOpenIdx === idx}
                                        onOpenChange={(open) => setPartsPopoverOpenIdx(open ? idx : null)}
                                    >
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="flex-1 justify-between font-normal"
                                            >
                                                {part.item_id
                                                    ? itemsData?.data?.find((i) => i.id === part.item_id)?.name
                                                    : "Pilih barang / suku cadang..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Cari nama barang..." />
                                                <CommandList>
                                                    <CommandEmpty>Barang tidak ditemukan.</CommandEmpty>
                                                    <CommandGroup>
                                                        {itemsData?.data?.map((item) => (
                                                            <CommandItem
                                                                key={item.id}
                                                                value={item.name}
                                                                onSelect={() => {
                                                                    updatePart(idx, "item_id", item.id);
                                                                    setPartsPopoverOpenIdx(null);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={`mr-2 h-4 w-4 ${part.item_id === item.id ? "opacity-100" : "opacity-0"}`}
                                                                />
                                                                {item.name} (Stok: {item.stock_quantity})
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <Input
                                        type="number"
                                        value={part.quantity}
                                        onChange={(e) => updatePart(idx, "quantity", parseInt(e.target.value) || 1)}
                                        className="w-20"
                                        min={1}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removePart(idx)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => { setIsEditOpen(false); resetForm(); }}>Batal</Button>
                            <Button onClick={handleEdit} disabled={isPending || !formTitle}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Simpan Perubahan
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-3xl max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{selectedTicket?.title || "Detail Tiket"}</DialogTitle>
                        <DialogDescription>Detail lengkap informasi tiket helpdesk</DialogDescription>
                    </DialogHeader>

                    {selectedTicket && (() => {
                        const { repairType, notes: cleanNotes } = parseResolution(selectedTicket.resolution_notes);
                        const duration = calculateDuration(selectedTicket.created_at, selectedTicket.resolved_at);
                        const partsTotal = selectedTicket.parts?.reduce((acc, p) => acc + (p.quantity * (p.item?.price || 0)), 0) || 0;

                        return (
                            <div className="space-y-6 p-6">
                                {/* Header Section */}
                                <div>
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                                                #{selectedTicket.id.slice(0, 8).toUpperCase()}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() => handleCopyId(selectedTicket.id)}
                                            >
                                                {copiedId ? (
                                                    <span className="flex items-center text-green-600 gap-1"><Check className="h-3 w-3" /> Tersalin</span>
                                                ) : (
                                                    <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Salin ID</span>
                                                )}
                                            </Button>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <Badge className={statusColors[selectedTicket.status]}>
                                                {statusLabels[selectedTicket.status]}
                                            </Badge>
                                            <Badge className={priorityColors[selectedTicket.priority]}>
                                                {priorityLabels[selectedTicket.priority] || selectedTicket.priority.toUpperCase()}
                                            </Badge>
                                            <Badge variant="outline" className="flex items-center gap-1">
                                                {getCategoryIcon(selectedTicket.category)}
                                                <span>{categoryLabels[selectedTicket.category] || selectedTicket.category}</span>
                                            </Badge>
                                        </div>
                                    </div>

                                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                                        {selectedTicket.title}
                                    </h2>

                                    {selectedTicket.location?.name && (
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                                            <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                            <span>Lokasi Unit: <strong className="text-foreground">{selectedTicket.location.name}</strong></span>
                                        </div>
                                    )}
                                </div>

                                {/* Lifecycle Progression Stepper */}
                                <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-blue-500" />
                                            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                                                Alur Tiket & Durasi
                                            </span>
                                        </div>
                                        {duration && (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                                <Clock className="h-3.5 w-3.5" /> Waktu Selesai: {duration}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {/* Step 1: Dibuat */}
                                        <div className="rounded-lg bg-card p-3.5 border shadow-xs space-y-2">
                                            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                                                <div className="h-6 w-6 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                </div>
                                                <span className="text-xs font-bold text-foreground">1. Dibuat</span>
                                            </div>
                                            <div className="space-y-1 text-xs">
                                                <div className="font-semibold text-foreground">
                                                    {formatFullDateTime(selectedTicket.created_at)}
                                                </div>
                                                <div className="text-muted-foreground leading-tight">
                                                    Oleh: <span className="font-medium text-foreground">{selectedTicket.creator?.full_name || "-"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 2: Penugasan */}
                                        <div className="rounded-lg bg-card p-3.5 border shadow-xs space-y-2">
                                            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                                                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${selectedTicket.assigned_to ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                                                    <User className="h-3.5 w-3.5" />
                                                </div>
                                                <span className="text-xs font-bold text-foreground">2. Teknisi Ditugaskan</span>
                                            </div>
                                            <div className="space-y-1 text-xs">
                                                <div className="font-semibold text-foreground">
                                                    {selectedTicket.assignee?.full_name || <span className="text-muted-foreground italic font-normal">Belum Ditugaskan</span>}
                                                </div>
                                                <div className="flex items-center gap-1.5 pt-0.5">
                                                    <span className="text-muted-foreground">Status:</span>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${statusColors[selectedTicket.status]}`}>
                                                        {statusLabels[selectedTicket.status]}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 3: Penyelesaian */}
                                        <div className="rounded-lg bg-card p-3.5 border shadow-xs space-y-2">
                                            <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                                                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${selectedTicket.resolved_at ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                </div>
                                                <span className="text-xs font-bold text-foreground">3. Diselesaikan</span>
                                            </div>
                                            <div className="space-y-1 text-xs">
                                                {selectedTicket.resolved_at ? (
                                                    <>
                                                        <div className="font-semibold text-foreground">
                                                            {formatFullDateTime(selectedTicket.resolved_at)}
                                                        </div>
                                                        <div className="text-muted-foreground leading-tight">
                                                            Oleh: <span className="font-medium text-foreground">{selectedTicket.resolver?.full_name || selectedTicket.assignee?.full_name || "-"}</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="text-muted-foreground italic py-1">
                                                        Menunggu Penyelesaian
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Information Grid (Requester & Staff Info) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="rounded-xl border p-4 space-y-3 bg-card">
                                        <div className="flex items-center gap-2 border-b pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            <User className="h-3.5 w-3.5" /> Pihak Pemohon
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="text-xs text-muted-foreground">Nama Pelapor:</span>
                                                <p className="font-semibold text-foreground">
                                                    {selectedTicket.requester?.full_name || selectedTicket.creator?.full_name || "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">Diinput Ke Sistem Oleh:</span>
                                                <p className="font-medium text-foreground">
                                                    {selectedTicket.creator?.full_name || "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">Unit / Lokasi Pemohon:</span>
                                                <p className="font-medium text-foreground">
                                                    {selectedTicket.location?.name || selectedTicket.asset?.locations?.name || "-"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border p-4 space-y-3 bg-card">
                                        <div className="flex items-center gap-2 border-b pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            <Wrench className="h-3.5 w-3.5" /> Tim Penanganan IT
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="text-xs text-muted-foreground">Teknisi Bertugas (Assigned):</span>
                                                <p className="font-semibold text-foreground">
                                                    {selectedTicket.assignee?.full_name || <span className="text-muted-foreground italic">Belum ditugaskan</span>}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">Diselesaikan Oleh:</span>
                                                <p className="font-medium text-foreground">
                                                    {selectedTicket.resolver?.full_name || selectedTicket.assignee?.full_name || "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">Prioritas Penanganan:</span>
                                                <p className="font-medium text-foreground">
                                                    Prioritas {priorityLabels[selectedTicket.priority] || selectedTicket.priority}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Deskripsi Masalah */}
                                <div className="rounded-xl border p-4 space-y-2 bg-card">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        <FileText className="h-3.5 w-3.5 text-blue-500" /> Deskripsi Keluhan / Permasalahan
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/40 border text-sm leading-relaxed whitespace-pre-wrap">
                                        {selectedTicket.description ? selectedTicket.description : (
                                            <span className="text-muted-foreground italic">Tidak ada rincian keluhan tambahan dari pemohon.</span>
                                        )}
                                    </div>
                                </div>

                                {/* Related Asset Card (If present) */}
                                {selectedTicket.asset && (
                                    <div className="rounded-xl border p-4 space-y-3 bg-card">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                <Laptop className="h-3.5 w-3.5 text-purple-500" /> Aset Terkait
                                            </div>
                                            {selectedTicket.asset.status && (
                                                <Badge variant="outline" className="text-xs">
                                                    Status Aset: {selectedTicket.asset.status === "active" ? "Aktif" : selectedTicket.asset.status === "maintenance" ? "Dalam Pemeliharaan" : selectedTicket.asset.status === "damage" ? "Rusak" : selectedTicket.asset.status}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                            <div>
                                                <span className="text-xs text-muted-foreground">Nama Aset</span>
                                                <p className="font-semibold text-foreground">{selectedTicket.asset.name}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">Kode Aset</span>
                                                <p className="font-mono font-medium text-foreground">{selectedTicket.asset.asset_code}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">Nomor Seri</span>
                                                <p className="font-mono text-muted-foreground">{selectedTicket.asset.serial_number || "-"}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground">Lokasi Aset</span>
                                                <p className="text-foreground">{selectedTicket.asset.locations?.name || "-"}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Solusi & Tindakan Perbaikan (Resolution Notes) */}
                                {(selectedTicket.status === "resolved" || selectedTicket.status === "closed" || selectedTicket.resolution_notes) && (
                                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Tindakan & Catatan Solusi
                                            </div>
                                            {repairType && (
                                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs">
                                                    Tipe: {repairType}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="p-3 rounded-lg bg-background/80 border border-emerald-500/20 text-sm whitespace-pre-wrap leading-relaxed">
                                            {cleanNotes ? cleanNotes : <span className="text-muted-foreground italic">Tiket ditandai selesai tanpa catatan tambahan.</span>}
                                        </div>

                                        {selectedTicket.resolved_at && (
                                            <div className="text-xs text-muted-foreground flex items-center justify-between pt-1">
                                                <span>Diselesaikan pada: <strong className="text-foreground">{formatFullDateTime(selectedTicket.resolved_at)}</strong></span>
                                                {selectedTicket.resolver?.full_name && (
                                                    <span>Oleh Teknisi: <strong className="text-foreground">{selectedTicket.resolver.full_name}</strong></span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Suku Cadang / ATK Digunakan (Parts Used) */}
                                {selectedTicket.parts && selectedTicket.parts.length > 0 ? (
                                    <div className="rounded-xl border p-4 space-y-3 bg-card">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                <Box className="h-3.5 w-3.5 text-amber-500" /> Suku Cadang / Sparepart Digunakan
                                            </div>
                                            <span className="text-xs text-muted-foreground font-medium">
                                                {selectedTicket.parts.length} Item Terpasang
                                            </span>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b text-muted-foreground">
                                                        <th className="text-left py-2 font-medium">Nama Sparepart / Barang</th>
                                                        <th className="text-center py-2 font-medium">Qty</th>
                                                        <th className="text-center py-2 font-medium">Satuan</th>
                                                        <th className="text-right py-2 font-medium">Estimasi Biaya</th>
                                                        <th className="text-right py-2 font-medium">Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {selectedTicket.parts.map((p, idx) => {
                                                        const price = p.item?.price || 0;
                                                        const subtotal = price * p.quantity;
                                                        return (
                                                            <tr key={idx} className="hover:bg-muted/50">
                                                                <td className="py-2.5 font-medium text-foreground">{p.item?.name || "Sparepart"}</td>
                                                                <td className="py-2.5 text-center font-semibold">{p.quantity}</td>
                                                                <td className="py-2.5 text-center text-muted-foreground">{p.item?.unit || "Unit"}</td>
                                                                <td className="py-2.5 text-right text-muted-foreground">{price > 0 ? formatRupiah(price) : "-"}</td>
                                                                <td className="py-2.5 text-right font-medium">{subtotal > 0 ? formatRupiah(subtotal) : "-"}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                {partsTotal > 0 && (
                                                    <tfoot>
                                                        <tr className="border-t font-semibold">
                                                            <td colSpan={4} className="py-2 text-right">Total Estimasi Suku Cadang:</td>
                                                            <td className="py-2 text-right text-emerald-600">{formatRupiah(partsTotal)}</td>
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    (selectedTicket.status === "resolved" || selectedTicket.status === "closed") && (
                                        <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/20 text-xs text-muted-foreground">
                                            <Box className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                                            <span>Tidak ada penggunaan suku cadang / sparepart pada tiket ini.</span>
                                        </div>
                                    )
                                )}

                                {/* Action Buttons Footer */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t">
                                    <div className="flex items-center gap-2">
                                        {/* Button Jadikan Artikel KB jika resolved */}
                                        {isStaff && (selectedTicket.status === "resolved" || selectedTicket.status === "closed") && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 gap-1.5"
                                                onClick={async () => {
                                                    const { convertTicketToKB } = await import("@/app/(dashboard)/knowledge-base/actions");
                                                    const res = await convertTicketToKB(selectedTicket.id);
                                                    if (res.success && res.data) {
                                                        const { toast } = await import("sonner");
                                                        toast.success("Draft Artikel KB berhasil dibuat dari tiket ini!");
                                                        window.location.href = `/knowledge-base?id=${res.data.id}`;
                                                    }
                                                }}
                                            >
                                                <Sparkles className="h-3.5 w-3.5" /> Jadikan Artikel KB
                                            </Button>
                                        )}

                                        {/* Button Selesaikan Tiket jika masih open/in_progress */}
                                        {isStaff && (selectedTicket.status === "open" || selectedTicket.status === "in_progress") && (
                                            <Button
                                                size="sm"
                                                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                                onClick={() => {
                                                    setIsViewOpen(false);
                                                    const cat = selectedTicket.category?.toLowerCase() || "hardware";
                                                    setCompleteCategory(cat);
                                                    const types = REPAIR_TYPES_BY_CATEGORY[cat] || REPAIR_TYPES_BY_CATEGORY.hardware;
                                                    setFormRepairType(types[0]);
                                                    setFormAssetId(selectedTicket.asset_id || "");
                                                    setIsCompleteOpen(true);
                                                }}
                                            >
                                                <CheckCircle2 className="h-3.5 w-3.5" /> Selesaikan Tiket
                                            </Button>
                                        )}
                                    </div>

                                    <Button variant="outline" size="sm" onClick={() => setIsViewOpen(false)}>
                                        Tutup
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Assign Dialog */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tugaskan Teknisi</DialogTitle>
                        <DialogDescription>Pilih teknisi IT yang akan menangani tiket ini</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Select value={formAssignee} onValueChange={setFormAssignee}>
                            <SelectTrigger><SelectValue placeholder="Pilih teknisi IT..." /></SelectTrigger>
                            <SelectContent>
                                {usersData?.data?.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.full_name || user.username || "Tidak Diketahui"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Batal</Button>
                            <Button onClick={handleAssign} disabled={isPending || !formAssignee}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Tugaskan
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reassign Dialog */}
            <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tugaskan Ulang Teknisi</DialogTitle>
                        <DialogDescription>Alihkan penanganan tiket ke teknisi IT lain. Teknisi sebelumnya akan mendapat notifikasi.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                            <p>Teknisi saat ini: <strong>{selectedTicket?.assignee?.full_name || "-"}</strong></p>
                        </div>
                        <Select value={formAssignee} onValueChange={setFormAssignee}>
                            <SelectTrigger><SelectValue placeholder="Pilih teknisi baru..." /></SelectTrigger>
                            <SelectContent>
                                {usersData?.data?.filter(u => u.id !== selectedTicket?.assigned_to).map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.full_name || user.username || "Tidak Diketahui"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setIsReassignOpen(false)}>Batal</Button>
                            <Button onClick={handleReassign} disabled={isPending || !formAssignee}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Alihkan Tugas
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Complete Dialog */}
            <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
                <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Selesaikan Tiket</DialogTitle>
                        <DialogDescription>Tandai tiket sebagai selesai dan catat tindakan perbaikan serta suku cadang yang digunakan</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Catatan Solusi / Tindakan Perbaikan</Label>
                            <Textarea
                                value={formResolution}
                                onChange={(e) => setFormResolution(e.target.value)}
                                placeholder="Jelaskan tindakan teknis yang dilakukan untuk menyelesaikan kendala..."
                                rows={3}
                            />
                        </div>

                        {/* Kategori Tiket */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kategori Tiket</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                    { key: "hardware", label: "Hardware", icon: Laptop },
                                    { key: "software", label: "Software", icon: Box },
                                    { key: "data", label: "Data", icon: Database },
                                    { key: "network", label: "Jaringan", icon: Network },
                                ].map((cat) => {
                                    const Icon = cat.icon;
                                    const isSelected = completeCategory === cat.key;
                                    return (
                                        <button
                                            key={cat.key}
                                            type="button"
                                            onClick={() => {
                                                setCompleteCategory(cat.key);
                                                const types = REPAIR_TYPES_BY_CATEGORY[cat.key] || REPAIR_TYPES_BY_CATEGORY.hardware;
                                                setFormRepairType(types[0]);
                                            }}
                                            className={cn(
                                                "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold ring-2 ring-primary/20"
                                                    : "bg-card text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground"
                                            )}
                                        >
                                            <Icon className="h-3.5 w-3.5 shrink-0" />
                                            <span>{cat.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tipe Perbaikan - Full width so text is never truncated */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipe Perbaikan</Label>
                            <Select value={formRepairType} onValueChange={setFormRepairType}>
                                <SelectTrigger className="w-full h-10 px-3.5 text-left text-sm">
                                    <SelectValue placeholder="Pilih tipe perbaikan" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {(REPAIR_TYPES_BY_CATEGORY[completeCategory] || REPAIR_TYPES_BY_CATEGORY.hardware).map((type) => (
                                        <SelectItem key={type} value={type} className="py-2.5">
                                            {repairTypeLabels[type] || type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedTicket?.asset ? (
                            <div className="space-y-2">
                                <Label>Aset Terkait</Label>
                                <div className="p-2 border rounded-md bg-muted/50 text-sm">
                                    {selectedTicket.asset.name} ({selectedTicket.asset.asset_code})
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Aset Terkait (opsional)</Label>
                                <Popover open={assetPopoverOpen} onOpenChange={setAssetPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={assetPopoverOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {formAssetId ? (
                                                <div className="flex flex-col items-start text-left">
                                                    <span className="truncate">
                                                        {assetsData?.data?.find((a) => a.id === formAssetId)?.name} ({assetsData?.data?.find((a) => a.id === formAssetId)?.asset_code})
                                                    </span>
                                                    {assetsData?.data?.find((a) => a.id === formAssetId)?.locations?.name && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {assetsData?.data?.find((a) => a.id === formAssetId)?.locations?.name}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">Pilih atau cari aset...</span>
                                            )}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari nama atau kode aset..." />
                                            <CommandList>
                                                <CommandEmpty>Aset tidak ditemukan.</CommandEmpty>
                                                <CommandGroup>
                                                    {assetsData?.data?.filter((asset) => asset.status !== "damage" && asset.status !== "disposed").map((asset) => (
                                                        <CommandItem
                                                            key={asset.id}
                                                            value={`${asset.name} ${asset.asset_code} ${asset.locations?.name || ""}`}
                                                            onSelect={() => {
                                                                setFormAssetId(asset.id === formAssetId ? "" : asset.id);
                                                                setAssetPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 ${formAssetId === asset.id ? "opacity-100" : "opacity-0"}`}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span>{asset.name} ({asset.asset_code})</span>
                                                                {asset.locations?.name && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {asset.locations.name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Suku Cadang / ATK Digunakan (opsional)</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addPart}>
                                    <Plus className="h-3 w-3 mr-1" /> Tambah Barang
                                </Button>
                            </div>
                            {formParts.map((part, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <Popover
                                        open={partsPopoverOpenIdx === idx}
                                        onOpenChange={(open) => setPartsPopoverOpenIdx(open ? idx : null)}
                                    >
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="flex-1 justify-between font-normal"
                                            >
                                                {part.item_id
                                                    ? itemsData?.data?.find((i) => i.id === part.item_id)?.name
                                                    : "Pilih barang / suku cadang..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Cari nama barang..." />
                                                <CommandList>
                                                    <CommandEmpty>Barang tidak ditemukan.</CommandEmpty>
                                                    <CommandGroup>
                                                        {itemsData?.data?.filter(item => item.stock_quantity > 0).map((item) => (
                                                            <CommandItem
                                                                key={item.id}
                                                                value={item.name}
                                                                onSelect={() => {
                                                                    updatePart(idx, "item_id", item.id);
                                                                    setPartsPopoverOpenIdx(null);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={`mr-2 h-4 w-4 ${part.item_id === item.id ? "opacity-100" : "opacity-0"}`}
                                                                />
                                                                {item.name} (Stok: {item.stock_quantity})
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <Input
                                        type="number"
                                        value={part.quantity}
                                        onChange={(e) => updatePart(idx, "quantity", parseInt(e.target.value) || 1)}
                                        className="w-20"
                                        min={1}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removePart(idx)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setIsCompleteOpen(false)}>Batal</Button>
                            <Button onClick={handleComplete} disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                Selesaikan Tiket
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Tiket?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Tiket yang dihapus tidak dapat dipulihkan kembali.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Hapus Tiket
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
