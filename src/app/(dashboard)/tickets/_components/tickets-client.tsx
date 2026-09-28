"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataTable } from "@/hooks/use-data-table";
import { useTickets, Ticket, useTicketsRealtime } from "@/hooks/api/use-tickets";
import { useATKItems } from "@/hooks/api/use-atk-items";
import { useAssets } from "@/hooks/api/use-assets";
import { useLocations } from "@/hooks/api/use-locations";
import { useUsers } from "@/hooks/api/use-users";
import { useAuthStore } from "@/stores/auth-store";
import { DataTable, Column } from "@/components/ui/data-table";
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
    draft: "Draft",
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
};

const priorityColors: Record<string, string> = {
    low: "bg-gray-500/10 text-gray-600",
    medium: "bg-blue-500/10 text-blue-600",
    high: "bg-orange-500/10 text-orange-600",
    urgent: "bg-red-500/10 text-red-600",
};

const categoryLabels: Record<string, string> = {
    hardware: "Hardware",
    software: "Software",
    data: "Data",
    network: "Network",
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

function formatDateOnly(dateStr?: string | null): string {
    if (!dateStr) return "-";
    try {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

function formatTimeOnly(dateStr?: string | null): string {
    if (!dateStr) return "";
    try {
        return new Date(dateStr).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
}

function formatFullDateTime(dateStr?: string | null): string {
    if (!dateStr) return "-";
    try {
        return new Date(dateStr).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
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
    const [isPending, startTransition] = useTransition();

    // Enable realtime updates
    useTicketsRealtime();

    const { data: ticketsData, isLoading } = useTickets({
        page,
        limit,
        status: statusFilter,
        category: categoryFilter,
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
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                setIsCreateOpen(false);
                resetForm();
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
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                queryClient.invalidateQueries({ queryKey: ["atk-items"] });
                queryClient.invalidateQueries({ queryKey: ["atk-requests"] });
                setIsEditOpen(false);
                setSelectedTicket(null);
                resetForm();
            }
        });
    };

    const handleAssign = () => {
        if (!selectedTicket || !formAssignee) return;

        startTransition(async () => {
            const result = await assignTicket(selectedTicket.id, formAssignee);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                setIsAssignOpen(false);
                setSelectedTicket(null);
            }
        });
    };

    const handleReassign = () => {
        if (!selectedTicket || !formAssignee) return;

        startTransition(async () => {
            const result = await reassignTicket(selectedTicket.id, formAssignee);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                setIsReassignOpen(false);
                setSelectedTicket(null);
                setFormAssignee("");
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
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                queryClient.invalidateQueries({ queryKey: ["atk-items"] });
                queryClient.invalidateQueries({ queryKey: ["asset-maintenance"] });
                setIsCompleteOpen(false);
                setSelectedTicket(null);
                resetForm();
            }
        });
    };

    const handleDelete = () => {
        if (!selectedTicket) return;

        startTransition(async () => {
            const result = await deleteTicket(selectedTicket.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                setIsDeleteOpen(false);
                setSelectedTicket(null);
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
            header: "Ticket",
            cell: (ticket) => (
                <div 
                    className="cursor-pointer group"
                    onClick={() => {
                        setSelectedTicket(ticket);
                        setIsViewOpen(true);
                    }}
                >
                    <p className="font-medium group-hover:text-primary transition-colors">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground">
                        {ticket.requester?.full_name || ticket.creator?.full_name} • {new Date(ticket.created_at).toLocaleDateString("id-ID")}
                    </p>
                </div>
            ),
        },
        {
            key: "category",
            header: "Category",
            cell: (ticket) => (
                <Badge variant="outline">{categoryLabels[ticket.category]}</Badge>
            ),
        },
        {
            key: "priority",
            header: "Priority",
            cell: (ticket) => (
                <Badge className={priorityColors[ticket.priority]}>
                    {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                </Badge>
            ),
        },
        {
            key: "status",
            header: "Status",
            cell: (ticket) => (
                <Badge className={statusColors[ticket.status]}>
                    {statusLabels[ticket.status]}
                </Badge>
            ),
        },
        {
            key: "assignee",
            header: "Assigned To",
            cell: (ticket) => ticket.assignee?.full_name || "-",
        },
        {
            key: "actions",
            header: "",
            cell: (ticket) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedTicket(ticket); setIsViewOpen(true); }}>
                            <Eye className="mr-2 h-4 w-4" /> View
                        </DropdownMenuItem>
                        {isStaff && ticket.status === "open" && (
                            <DropdownMenuItem onClick={() => { setSelectedTicket(ticket); setIsAssignOpen(true); }}>
                                <UserPlus className="mr-2 h-4 w-4" /> Assign
                            </DropdownMenuItem>
                        )}
                        {isStaff && ticket.status === "in_progress" && (
                            <>
                                <DropdownMenuItem onClick={() => {
                                    setSelectedTicket(ticket);
                                    setFormAssignee("");
                                    setIsReassignOpen(true);
                                }}>
                                    <RefreshCw className="mr-2 h-4 w-4" /> Reassign
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
                                    <CheckCircle className="mr-2 h-4 w-4" /> Complete
                                </DropdownMenuItem>
                            </>
                        )}
                        {(ticket.status === "open" || ticket.status === "in_progress" || isStaff) && (
                            <DropdownMenuItem onClick={() => openEditDialog(ticket)}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                        )}
                        {isStaff && (ticket.status === "resolved" || ticket.status === "closed") && (
                            <DropdownMenuItem onClick={async () => {
                                const { convertTicketToKB } = await import("@/app/(dashboard)/knowledge-base/actions");
                                const res = await convertTicketToKB(ticket.id);
                                if (res.success && res.data) {
                                    const { toast } = await import("sonner");
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
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Tickets</h1>
                    <p className="text-muted-foreground">IT Helpdesk Support Tickets</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Ticket
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="hardware">Hardware</SelectItem>
                        <SelectItem value="software">Software</SelectItem>
                        <SelectItem value="data">Data</SelectItem>
                        <SelectItem value="network">Network</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
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
            />

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create New Ticket</DialogTitle>
                        <DialogDescription>Submit a new support request</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="Brief description of the issue"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="Detailed description..."
                                rows={3}
                            />
                        </div>
                        {isStaff && (
                            <div className="space-y-2">
                                <Label>Requester (optional)</Label>
                                <Popover open={requesterPopoverOpen} onOpenChange={setRequesterPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={requesterPopoverOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {formRequester ? (
                                                allUsersData?.data?.find((u) => u.id === formRequester)?.full_name || "Unknown"
                                            ) : (
                                                <span className="text-muted-foreground">Select requester if different from you...</span>
                                            )}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0" align="start" side="bottom" sideOffset={8} avoidCollisions={true}>
                                        <Command shouldFilter={true}>
                                            <CommandInput placeholder="Search requester..." className="h-9" />
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
                                <p className="text-xs text-muted-foreground">Leave empty if you are the requester</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={formCategory} onValueChange={setFormCategory}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hardware">Hardware</SelectItem>
                                        <SelectItem value="software">Software</SelectItem>
                                        <SelectItem value="data">Data</SelectItem>
                                        <SelectItem value="network">Network</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Priority</Label>
                                <Select value={formPriority} onValueChange={setFormPriority}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Related Asset (optional)</Label>
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
                                            <span className="text-muted-foreground">Search asset...</span>
                                        )}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari asset..." />
                                        <CommandList>
                                            <CommandEmpty>Asset tidak ditemukan.</CommandEmpty>
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
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={isPending || !formTitle}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Create Ticket
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Ticket</DialogTitle>
                        <DialogDescription>Update ticket details</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="Brief description of the issue"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="Detailed description..."
                                rows={3}
                            />
                        </div>
                        {isStaff && (
                            <div className="space-y-2">
                                <Label>Requester / Pelapor (optional)</Label>
                                <Popover open={requesterPopoverOpen} onOpenChange={setRequesterPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={requesterPopoverOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {formRequester ? (
                                                allUsersData?.data?.find((u) => u.id === formRequester)?.full_name || "Unknown"
                                            ) : (
                                                <span className="text-muted-foreground">Select requester...</span>
                                            )}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0" align="start" side="bottom" sideOffset={8} avoidCollisions={true}>
                                        <Command shouldFilter={true}>
                                            <CommandInput placeholder="Search requester..." className="h-9" />
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
                                <Label>Category</Label>
                                <Select value={formCategory} onValueChange={setFormCategory}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hardware">Hardware</SelectItem>
                                        <SelectItem value="software">Software</SelectItem>
                                        <SelectItem value="data">Data</SelectItem>
                                        <SelectItem value="network">Network</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Priority</Label>
                                <Select value={formPriority} onValueChange={setFormPriority}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Related Asset (optional)</Label>
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
                                            <span className="text-muted-foreground">Search asset...</span>
                                        )}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari asset..." />
                                        <CommandList>
                                            <CommandEmpty>Asset tidak ditemukan.</CommandEmpty>
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
                                <Label>Parts / Spareparts Used (optional)</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addPart}>
                                    <Plus className="h-3 w-3 mr-1" /> Add Part
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
                                                    : "Select part..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Cari part..." />
                                                <CommandList>
                                                    <CommandEmpty>Part tidak ditemukan.</CommandEmpty>
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
                                                                {item.name} (Stock: {item.stock_quantity})
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
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setIsEditOpen(false); resetForm(); }}>Cancel</Button>
                            <Button onClick={handleEdit} disabled={isPending || !formTitle}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{selectedTicket?.title || "Ticket Details"}</DialogTitle>
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
                                                {selectedTicket.priority.toUpperCase()}
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
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Alur Tiket & Durasi
                                        </span>
                                        {duration && (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                                <Clock className="h-3.5 w-3.5" /> Waktu Selesai: {duration}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {/* Step 1: Dibuat */}
                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-background border shadow-xs">
                                            <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                                                <Calendar className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">1. Dibuat</p>
                                                <div className="text-xs font-semibold text-foreground mt-0.5">
                                                    {formatDateOnly(selectedTicket.created_at)}
                                                    <span className="text-muted-foreground font-normal ml-1">
                                                        ({formatTimeOnly(selectedTicket.created_at)})
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 break-words leading-tight">
                                                    Oleh: <span className="font-medium text-foreground">{selectedTicket.creator?.full_name || "-"}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Step 2: Penugasan */}
                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-background border shadow-xs">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${selectedTicket.assigned_to ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                                                <User className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">2. Teknisi Ditugaskan</p>
                                                <p className="text-xs font-semibold text-foreground mt-0.5 break-words leading-tight">
                                                    {selectedTicket.assignee?.full_name || <span className="text-muted-foreground italic font-normal">Belum Ditugaskan</span>}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <span className="text-[11px] text-muted-foreground">Status:</span>
                                                    <Badge className={`${statusColors[selectedTicket.status]} text-[10px] h-5 py-0 px-1.5 font-medium`}>
                                                        {statusLabels[selectedTicket.status]}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 3: Penyelesaian */}
                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-background border shadow-xs">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${selectedTicket.resolved_at ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                                                <CheckCircle2 className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">3. Diselesaikan</p>
                                                {selectedTicket.resolved_at ? (
                                                    <>
                                                        <div className="text-xs font-semibold text-foreground mt-0.5">
                                                            {formatDateOnly(selectedTicket.resolved_at)}
                                                            <span className="text-muted-foreground font-normal ml-1">
                                                                ({formatTimeOnly(selectedTicket.resolved_at)})
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1 break-words leading-tight">
                                                            Oleh: <span className="font-medium text-foreground">{selectedTicket.resolver?.full_name || selectedTicket.assignee?.full_name || "-"}</span>
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground italic mt-0.5">
                                                        Menunggu Penyelesaian
                                                    </p>
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
                                                <p className="font-medium text-foreground capitalize">
                                                    {selectedTicket.priority} Priority
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
                                                <Badge variant="outline" className="text-xs capitalize">
                                                    Status Aset: {selectedTicket.asset.status}
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
                                                <span className="text-xs text-muted-foreground">Serial Number</span>
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
                                                    Type: {repairType}
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
                        <DialogTitle>Assign Ticket</DialogTitle>
                        <DialogDescription>Assign technician to work on this ticket</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Select value={formAssignee} onValueChange={setFormAssignee}>
                            <SelectTrigger><SelectValue placeholder="Select technician..." /></SelectTrigger>
                            <SelectContent>
                                {usersData?.data?.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.full_name || user.username || "Unknown"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
                            <Button onClick={handleAssign} disabled={isPending || !formAssignee}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Assign
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reassign Dialog */}
            <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reassign Ticket</DialogTitle>
                        <DialogDescription>Dialihkan ticket ke teknisi lain. Teknisi sebelumnya akan mendapat notifikasi.</DialogDescription>
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
                                        {user.full_name || user.username || "Unknown"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsReassignOpen(false)}>Cancel</Button>
                            <Button onClick={handleReassign} disabled={isPending || !formAssignee}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Reassign
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Complete Dialog */}
            <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Complete Ticket</DialogTitle>
                        <DialogDescription>Mark ticket as resolved and record parts used</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Resolution Notes</Label>
                            <Textarea
                                value={formResolution}
                                onChange={(e) => setFormResolution(e.target.value)}
                                placeholder="What was done to resolve this issue..."
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Kategori Tiket</Label>
                                <Select 
                                    value={completeCategory} 
                                    onValueChange={(cat) => {
                                        setCompleteCategory(cat);
                                        const types = REPAIR_TYPES_BY_CATEGORY[cat] || REPAIR_TYPES_BY_CATEGORY.hardware;
                                        setFormRepairType(types[0]);
                                    }}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hardware">Hardware</SelectItem>
                                        <SelectItem value="software">Software</SelectItem>
                                        <SelectItem value="data">Data</SelectItem>
                                        <SelectItem value="network">Network</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Type Perbaikan</Label>
                                <Select value={formRepairType} onValueChange={setFormRepairType}>
                                    <SelectTrigger><SelectValue placeholder="Pilih type perbaikan" /></SelectTrigger>
                                    <SelectContent>
                                        {(REPAIR_TYPES_BY_CATEGORY[completeCategory] || REPAIR_TYPES_BY_CATEGORY.hardware).map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>


                        {selectedTicket?.asset ? (
                            <div className="space-y-2">
                                <Label>Asset</Label>
                                <div className="p-2 border rounded-md bg-muted/50">
                                    {selectedTicket.asset.name} ({selectedTicket.asset.asset_code})
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Asset (pilih jika ada)</Label>
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
                                                <span className="text-muted-foreground">Cari asset...</span>
                                            )}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari asset..." />
                                            <CommandList>
                                                <CommandEmpty>Asset tidak ditemukan.</CommandEmpty>
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
                                <Label>Parts Used (optional)</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addPart}>
                                    <Plus className="h-3 w-3 mr-1" /> Add Part
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
                                                    : "Select part..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Cari part..." />
                                                <CommandList>
                                                    <CommandEmpty>Part tidak ditemukan.</CommandEmpty>
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
                                                                {item.name} (Stock: {item.stock_quantity})
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

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsCompleteOpen(false)}>Cancel</Button>
                            <Button onClick={handleComplete} disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                Complete Ticket
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Ticket?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
