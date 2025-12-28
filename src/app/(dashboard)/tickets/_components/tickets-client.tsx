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

    const { data: itemsData } = useATKItems({ page: 1, limit: 100 });
    const { data: assetsData } = useAssets({ page: 1, limit: 100 });
    const { data: locations } = useLocations();
    const { data: usersData } = useUsers({ page: 1, limit: 100, roles: ["staff_it", "admin"] });

    // Modal states
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isCompleteOpen, setIsCompleteOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [isReassignOpen, setIsReassignOpen] = useState(false);
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
    const [formRepairType, setFormRepairType] = useState("repair");
    const [formParts, setFormParts] = useState<{ item_id: string; quantity: number }[]>([]);
    const [assetPopoverOpen, setAssetPopoverOpen] = useState(false);

    const isStaff = user?.role === "admin" || user?.role === "staff_it" || user?.role === "manager_it";

    const resetForm = () => {
        setFormTitle("");
        setFormDescription("");
        setFormCategory("hardware");
        setFormPriority("medium");
        setFormAssetId("");
        setFormAssignee("");
        setFormResolution("");
        setFormRepairType("repair");
        setFormParts([]);
    };

    const handleCreate = () => {
        startTransition(async () => {
            const result = await createTicket({
                title: formTitle,
                description: formDescription,
                category: formCategory,
                priority: formPriority,
                asset_id: formAssetId || undefined,
            });

            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["tickets"] });
                setIsCreateOpen(false);
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
                <div>
                    <p className="font-medium">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground">
                        {ticket.creator?.full_name} • {new Date(ticket.created_at).toLocaleDateString("id-ID")}
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
                                    setFormAssetId(ticket.asset_id || "");
                                    setIsCompleteOpen(true);
                                }}>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Complete
                                </DropdownMenuItem>
                            </>
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
                                                {assetsData?.data?.map((asset) => (
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

            {/* View Dialog */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedTicket?.title}</DialogTitle>
                    </DialogHeader>
                    {selectedTicket && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <Badge className={statusColors[selectedTicket.status]}>
                                    {statusLabels[selectedTicket.status]}
                                </Badge>
                                <Badge className={priorityColors[selectedTicket.priority]}>
                                    {selectedTicket.priority}
                                </Badge>
                                <Badge variant="outline">{categoryLabels[selectedTicket.category]}</Badge>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Description</Label>
                                <p>{selectedTicket.description || "-"}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-muted-foreground">Created By</Label>
                                    <p>{selectedTicket.creator?.full_name}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Assigned To</Label>
                                    <p>{selectedTicket.assignee?.full_name || "-"}</p>
                                </div>
                            </div>
                            {selectedTicket.asset && (
                                <div>
                                    <Label className="text-muted-foreground">Related Asset</Label>
                                    <p>{selectedTicket.asset.name} ({selectedTicket.asset.asset_code})</p>
                                </div>
                            )}
                            {selectedTicket.resolution_notes && (
                                <div>
                                    <Label className="text-muted-foreground">Resolution</Label>
                                    <p>{selectedTicket.resolution_notes}</p>
                                </div>
                            )}
                        </div>
                    )}
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

                        <div className="space-y-2">
                            <Label>Type Perbaikan</Label>
                            <Select value={formRepairType} onValueChange={setFormRepairType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="repair">Repair</SelectItem>
                                    <SelectItem value="upgrade">Upgrade</SelectItem>
                                    <SelectItem value="cleaning">Cleaning</SelectItem>
                                    <SelectItem value="inspection">Inspection</SelectItem>
                                </SelectContent>
                            </Select>
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
                                                    {assetsData?.data?.map((asset) => (
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
                                    <Select
                                        value={part.item_id}
                                        onValueChange={(v) => updatePart(idx, "item_id", v)}
                                    >
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Select part..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {itemsData?.data?.map((item) => (
                                                <SelectItem key={item.id} value={item.id}>
                                                    {item.name} (Stock: {item.stock_quantity})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
