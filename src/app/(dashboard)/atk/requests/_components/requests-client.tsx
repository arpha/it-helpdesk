"use client";

import { useState, useTransition, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataTable } from "@/hooks/use-data-table";
import { useATKRequests, ATKRequest } from "@/hooks/api/use-atk-requests";
import { useATKItems } from "@/hooks/api/use-atk-items";
import { useUsers } from "@/hooks/api/use-users";
import { useLocations } from "@/hooks/api/use-locations";
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
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SignaturePad, SignaturePadRef } from "@/components/ui/signature-pad";
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
    XCircle,
    PackageCheck,
    Trash2,
    Plus,
    Loader2,
    X,
    ChevronsUpDown,
    Check,
    FileText,
    Printer,
} from "lucide-react";
import {
    createRequest,
    approveRequest,
    rejectRequest,
    completeRequest,
    deleteRequest,
} from "../actions";

const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600",
    approved: "bg-blue-500/10 text-blue-600",
    rejected: "bg-red-500/10 text-red-600",
    completed: "bg-green-500/10 text-green-600",
};

const statusLabels: Record<string, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    completed: "Completed",
};

export default function RequestsClient() {
    const { page, limit, setPage, setLimit } = useDataTable();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [statusFilter, setStatusFilter] = useState("all");
    const [viewMode, setViewMode] = useState<"all" | "my">("all");

    const { data: requestsData, isLoading } = useATKRequests({
        page,
        limit,
        status: statusFilter,
        myRequestsOnly: viewMode === "my",
        userId: user?.id,
    });

    const { data: itemsData } = useATKItems({ page: 1, limit: 1000 });
    const { data: usersData } = useUsers({ page: 1, limit: 1000, activeOnly: true });
    const { data: locationsData } = useLocations();

    // Modal states
    const [selectedRequest, setSelectedRequest] = useState<ATKRequest | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isApproveOpen, setIsApproveOpen] = useState(false);
    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCompleteOpen, setIsCompleteOpen] = useState(false);
    const [isPrintOpen, setIsPrintOpen] = useState(false);

    // Form states
    const [createNotes, setCreateNotes] = useState("");
    const [createItems, setCreateItems] = useState<{ item_id: string; quantity: number }[]>([]);
    const [selectedRequester, setSelectedRequester] = useState<string>("");
    const [selectedLocation, setSelectedLocation] = useState<string>("");
    const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({});
    const [rejectReason, setRejectReason] = useState("");
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [requesterPopoverOpen, setRequesterPopoverOpen] = useState(false);
    const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
    const [itemPopoverOpenIdx, setItemPopoverOpenIdx] = useState<number | null>(null);
    const signatureRef = useRef<SignaturePadRef>(null);

    const handleView = (request: ATKRequest) => {
        setSelectedRequest(request);
        setIsViewOpen(true);
    };

    const handleOpenApprove = (request: ATKRequest) => {
        setSelectedRequest(request);
        // Initialize approved quantities with requested quantities
        const quantities: Record<string, number> = {};
        request.atk_request_items.forEach((item) => {
            quantities[item.item_id] = item.approved_quantity ?? item.quantity;
        });
        setApprovedQuantities(quantities);
        setMessage(null);
        setIsApproveOpen(true);
    };

    const handleOpenReject = (request: ATKRequest) => {
        setSelectedRequest(request);
        setRejectReason("");
        setIsRejectOpen(true);
    };

    const handleOpenDelete = (request: ATKRequest) => {
        setSelectedRequest(request);
        setIsDeleteOpen(true);
    };

    const handleOpenPrint = (request: ATKRequest) => {
        // Generate empty rows for table
        const emptyRows = Array.from({ length: Math.max(0, 8 - request.atk_request_items.length) })
            .map(() => `
                <tr>
                    <td>&nbsp;</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>
            `).join("");

        // Create print content in SPB format
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Surat Permintaan Barang (SPB)</title>
                <style>
                    @page { 
                        margin: 5mm;
                        size: A4;
                    }
                    body { font-family: Arial, sans-serif; padding: 10px; margin: 0; font-size: 12px; }
                    .header { display: flex; align-items: flex-start; gap: 15px; border-bottom: 2px solid black; padding-bottom: 16px; margin-bottom: 24px; }
                    .header-logo { width: 140px; height: 140px; flex-shrink: 0; }
                    .header-text { flex: 1; text-align: center; }
                    .header-text p { margin: 3px 0; }
                    .header-text .bold { font-weight: bold; font-size: 20px; }
                    .header-text .large { font-size: 26px; font-weight: bold; }
                    .header-text .small { font-size: 11px; }
                    .title { text-align: center; margin-bottom: 24px; }
                    .title h2 { margin: 0; font-size: 16px; text-decoration: underline; font-weight: bold; }
                    .title p { margin: 8px 0 0 0; font-size: 14px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 13px; }
                    th, td { border: 1px solid black; padding: 6px 8px; }
                    th { text-align: center; }
                    .signatures { margin-top: 30px; }
                    .sig-date { text-align: right; margin-bottom: 15px; font-size: 13px; }
                    .sig-row { display: flex; justify-content: space-between; text-align: center; font-size: 13px; }
                    .sig-box { width: 30%; }
                    .sig-box p { margin: 2px 0; }
                    .sig-space { height: 80px; }
                    .sig-line { border-top: 1px solid black; padding-top: 4px; margin: 0 10px; }
                    .sig-img { height: 60px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="/logo-bandung.png" class="header-logo" onerror="this.style.display='none'" />
                    <div class="header-text">
                        <p class="bold">PEMERINTAH KABUPATEN BANDUNG</p>
                        <p class="bold">DINAS KESEHATAN</p>
                        <p class="large">RUMAH SAKIT UMUM DAERAH CICALENGKA</p>
                        <p class="small">Jalan Haji Darham No.35, Tenjolaya, Cicalengka Kabupaten Bandung Jawa Barat 40395</p>
                        <p class="small">Telepon (022) 7952203 Faximile (022) 7952204</p>
                        <p class="small">Laman rsudcicalengka.bandungkab.go.id, Pos-el rsudcicalengka@bandungkab.go.id</p>
                    </div>
                </div>
                <div class="title">
                    <h2>SURAT PERMINTAAN BARANG (SPB)</h2>
                    <p>Nomor : ${request.document_number || "..............................."}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width:40px;">No.</th>
                            <th>Nama / Jenis Barang</th>
                            <th style="width:70px;">Banyaknya</th>
                            <th style="width:90px;">Unit Kerja</th>
                            <th style="width:90px;">Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${request.atk_request_items.map((item, idx) => `
                            <tr>
                                <td style="text-align:center;">${idx + 1}</td>
                                <td>${item.atk_items?.name || ""}</td>
                                <td style="text-align:center;">${item.approved_quantity || item.quantity} ${item.atk_items?.unit || ""}</td>
                                <td style="text-align:center;">${request.locations?.name || "-"}</td>
                                <td></td>
                            </tr>
                        `).join("")}
                        ${emptyRows}
                    </tbody>
                </table>
                <div class="signatures">
                    <div class="sig-date">
                        <p>Cicalengka, ${new Date(request.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                    <div class="sig-row">
                        <div class="sig-box">
                            <p><strong>Yang Menyerahkan</strong></p>
                            <p>Pemegang Barang</p>
                            <div class="sig-space"></div>
                            <p class="sig-line">${request.completer?.full_name || "................................"}</p>
                        </div>
                        <div class="sig-box">
                            <p><strong>Mengetahui / Menyetujui</strong></p>
                            <p>Sekretaris RSUD Cicalengka</p>
                            <div class="sig-space"></div>
                            <p class="sig-line">................................</p>
                        </div>
                        <div class="sig-box">
                            <p><strong>Yang mengusulkan /</strong></p>
                            <p>menerima barang</p>
                            <div class="sig-space">${request.approval_signature_url ? `<img src="${request.approval_signature_url}" class="sig-img" />` : ''}</div>
                            <p class="sig-line">${request.requester?.full_name || "................................"}</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    const handleOpenCreate = () => {
        setCreateNotes("");
        setCreateItems([{ item_id: "", quantity: 1 }]);
        setSelectedRequester("");
        setMessage(null);
        setIsCreateOpen(true);
    };

    const addCreateItem = () => {
        setCreateItems([...createItems, { item_id: "", quantity: 1 }]);
    };

    const removeCreateItem = (index: number) => {
        setCreateItems(createItems.filter((_, i) => i !== index));
    };

    const updateCreateItem = (index: number, field: "item_id" | "quantity", value: string | number) => {
        const updated = [...createItems];
        updated[index] = { ...updated[index], [field]: value };
        setCreateItems(updated);
    };

    const handleCreate = () => {
        setMessage(null);

        if (!selectedRequester) {
            setMessage({ type: "error", text: "Pilih pemohon terlebih dahulu" });
            return;
        }

        const validItems = createItems.filter((item) => item.item_id && item.quantity > 0);
        if (validItems.length === 0) {
            setMessage({ type: "error", text: "Tambahkan minimal 1 item" });
            return;
        }

        startTransition(async () => {
            const result = await createRequest({
                notes: createNotes || undefined,
                items: validItems,
                requester_id: selectedRequester || undefined,
                location_id: selectedLocation || undefined,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Request berhasil dibuat!" });
                queryClient.invalidateQueries({ queryKey: ["atk-requests"] });
                setTimeout(() => setIsCreateOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Gagal membuat request" });
            }
        });
    };

    const handleApprove = () => {
        if (!selectedRequest) return;
        setMessage(null);

        startTransition(async () => {
            const result = await approveRequest({
                request_id: selectedRequest.id,
                approved_quantities: Object.entries(approvedQuantities).map(([item_id, quantity]) => ({
                    item_id,
                    quantity,
                })),
            });

            if (result.success) {
                setMessage({ type: "success", text: "Request approved!" });
                queryClient.invalidateQueries({ queryKey: ["atk-requests"] });
                setTimeout(() => setIsApproveOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleReject = () => {
        if (!selectedRequest) return;
        startTransition(async () => {
            const result = await rejectRequest(selectedRequest.id, rejectReason);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["atk-requests"] });
                setIsRejectOpen(false);
            }
        });
    };

    const handleOpenComplete = (request: ATKRequest) => {
        setSelectedRequest(request);
        setMessage(null);
        setIsCompleteOpen(true);
    };

    const handleComplete = () => {
        if (!selectedRequest) return;
        setMessage(null);

        if (signatureRef.current?.isEmpty()) {
            setMessage({ type: "error", text: "Tanda tangan wajib diisi" });
            return;
        }

        const signatureData = signatureRef.current?.toDataURL() || "";

        startTransition(async () => {
            const result = await completeRequest({
                request_id: selectedRequest.id,
                signature_data: signatureData,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Request completed!" });
                queryClient.invalidateQueries({ queryKey: ["atk-requests"] });
                queryClient.invalidateQueries({ queryKey: ["atk-items"] });
                setTimeout(() => setIsCompleteOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleDelete = () => {
        if (!selectedRequest) return;
        startTransition(async () => {
            const result = await deleteRequest(selectedRequest.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["atk-requests"] });
                setIsDeleteOpen(false);
            }
        });
    };

    const columns: Column<ATKRequest>[] = [
        {
            key: "requester",
            header: "Requester",
            cell: (row) => (
                <div>
                    <p className="font-medium">{row.requester?.full_name || "-"}</p>
                    <p className="text-xs text-muted-foreground">{row.locations?.name || "-"}</p>
                    {row.ticket_id && (
                        <Badge variant="outline" className="text-xs mt-1">From Ticket</Badge>
                    )}
                </div>
            ),
        },
        {
            key: "items",
            header: "Items",
            cell: (row) => (
                <div className="text-sm">
                    {row.atk_request_items.slice(0, 2).map((item) => (
                        <p key={item.id}>
                            {item.atk_items?.name} ({item.quantity})
                        </p>
                    ))}
                    {row.atk_request_items.length > 2 && (
                        <p className="text-muted-foreground">+{row.atk_request_items.length - 2} more</p>
                    )}
                </div>
            ),
        },
        {
            key: "status",
            header: "Status",
            cell: (row) => (
                <Badge variant="secondary" className={statusColors[row.status]}>
                    {statusLabels[row.status]}
                </Badge>
            ),
        },
        {
            key: "date",
            header: "Date",
            cell: (row) => (
                <span className="text-sm text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString("id-ID")}
                </span>
            ),
        },
        {
            key: "actions",
            header: "",
            className: "w-12",
            cell: (row) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleView(row)} className="cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" />
                            View
                        </DropdownMenuItem>
                        {row.status === "pending" && (
                            <>
                                <DropdownMenuItem onClick={() => handleOpenApprove(row)} className="cursor-pointer text-green-600">
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenReject(row)} className="cursor-pointer text-destructive">
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject
                                </DropdownMenuItem>
                            </>
                        )}
                        {row.status === "approved" && (
                            <DropdownMenuItem onClick={() => handleOpenComplete(row)} className="cursor-pointer text-blue-600">
                                <PackageCheck className="mr-2 h-4 w-4" />
                                Complete
                            </DropdownMenuItem>
                        )}
                        {row.status === "completed" && (
                            <DropdownMenuItem
                                onClick={() => handleOpenPrint(row)}
                                className="cursor-pointer text-green-600"
                            >
                                <Printer className="mr-2 h-4 w-4" />
                                Print Document
                            </DropdownMenuItem>
                        )}
                        {row.status === "pending" && (
                            <DropdownMenuItem onClick={() => handleOpenDelete(row)} className="cursor-pointer text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4">
                <Select value={viewMode} onValueChange={(v) => setViewMode(v as "all" | "my")}>
                    <SelectTrigger className="w-[120px] sm:w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Requests</SelectItem>
                        <SelectItem value="my">My Requests</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[120px] sm:w-40">
                        <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                columns={columns}
                data={requestsData?.data || []}
                isLoading={isLoading}
                page={page}
                totalPages={requestsData?.totalPages || 1}
                totalItems={requestsData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="No requests found."
                toolbarAction={
                    <Button onClick={handleOpenCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Request
                    </Button>
                }
            />

            {/* Create Request Modal */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Request</DialogTitle>
                        <DialogDescription>Create a new stuff request</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                        {message && (
                            <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Requester *</Label>
                            <Popover open={requesterPopoverOpen} onOpenChange={setRequesterPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={requesterPopoverOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        {selectedRequester
                                            ? usersData?.data.find((u) => u.id === selectedRequester)?.full_name
                                            : "Select requester..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search name..." />
                                        <CommandList className="max-h-[200px] overflow-y-auto overscroll-contain">
                                            <CommandEmpty>No results found.</CommandEmpty>
                                            <CommandGroup>
                                                {usersData?.data.map((u) => (
                                                    <CommandItem
                                                        key={u.id}
                                                        value={u.full_name || ""}
                                                        onSelect={() => {
                                                            setSelectedRequester(u.id === selectedRequester ? "" : u.id);
                                                            setRequesterPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${selectedRequester === u.id ? "opacity-100" : "opacity-0"}`}
                                                        />
                                                        {u.full_name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>Location</Label>
                            <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between"
                                    >
                                        {selectedLocation
                                            ? locationsData?.find((l) => l.id === selectedLocation)?.name
                                            : "Select location..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search location..." />
                                        <CommandList className="max-h-[200px] overflow-y-auto overscroll-contain">
                                            <CommandEmpty>No results found.</CommandEmpty>
                                            <CommandGroup>
                                                {locationsData?.map((loc) => (
                                                    <CommandItem
                                                        key={loc.id}
                                                        value={loc.name}
                                                        onSelect={() => {
                                                            setSelectedLocation(loc.id);
                                                            setLocationPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${selectedLocation === loc.id ? "opacity-100" : "opacity-0"}`}
                                                        />
                                                        {loc.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>Items *</Label>
                            {createItems.map((item, index) => (
                                <div key={index} className="flex gap-2">
                                    <Popover open={itemPopoverOpenIdx === index} onOpenChange={(open) => setItemPopoverOpenIdx(open ? index : null)}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="flex-1 justify-between font-normal"
                                            >
                                                {item.item_id
                                                    ? (() => {
                                                        const i = itemsData?.data.find((i) => i.id === item.item_id);
                                                        return i ? `${i.name} - Stock: ${i.stock_quantity}` : "Select item...";
                                                    })()
                                                    : "Select item..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[400px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search item..." />
                                                <CommandList className="max-h-[200px] overflow-y-auto overscroll-contain">
                                                    <CommandEmpty>No results found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {itemsData?.data.filter(i => i.stock_quantity > 0).map((i) => (
                                                            <CommandItem
                                                                key={i.id}
                                                                value={`${i.name} ${i.type}`}
                                                                onSelect={() => {
                                                                    updateCreateItem(index, "item_id", i.id);
                                                                    setItemPopoverOpenIdx(null);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={`mr-2 h-4 w-4 ${item.item_id === i.id ? "opacity-100" : "opacity-0"}`}
                                                                />
                                                                {i.name} - Stock: {i.stock_quantity}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => updateCreateItem(index, "quantity", parseInt(e.target.value) || 1)}
                                        className="w-20"
                                    />
                                    {createItems.length > 1 && (
                                        <Button variant="ghost" size="icon" onClick={() => removeCreateItem(index)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={addCreateItem}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Item
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="create_notes">Notes</Label>
                            <Textarea
                                id="create_notes"
                                value={createNotes}
                                onChange={(e) => setCreateNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={2}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Create Request
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Request Modal */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Request Details</DialogTitle>
                        <DialogDescription>View request information</DialogDescription>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Requester</span>
                                    <p className="font-medium">{selectedRequest.requester?.full_name || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Location</span>
                                    <p>{selectedRequest.locations?.name || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Status</span>
                                    <Badge variant="secondary" className={statusColors[selectedRequest.status]}>
                                        {statusLabels[selectedRequest.status]}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Date</span>
                                    <p>{new Date(selectedRequest.created_at).toLocaleDateString("id-ID")}</p>
                                </div>
                            </div>

                            <div>
                                <span className="text-muted-foreground text-sm">Items</span>
                                <div className="mt-2 space-y-2">
                                    {selectedRequest.atk_request_items.map((item) => (
                                        <div key={item.id} className="flex justify-between items-center p-2 bg-muted rounded">
                                            <span>{item.atk_items?.name}</span>
                                            <span className="font-medium">
                                                {item.approved_quantity !== null ? `${item.approved_quantity}/${item.quantity}` : item.quantity} {item.atk_items?.unit}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedRequest.notes && (
                                <div>
                                    <span className="text-muted-foreground text-sm">Notes</span>
                                    <p className="mt-1">{selectedRequest.notes}</p>
                                </div>
                            )}

                            {selectedRequest.approval_signature_url && (
                                <div>
                                    <span className="text-muted-foreground text-sm">Approval Signature</span>
                                    <img
                                        src={selectedRequest.approval_signature_url}
                                        alt="Signature"
                                        className="mt-2 border rounded max-h-24"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Approved by {selectedRequest.approver?.full_name} on{" "}
                                        {selectedRequest.approved_at
                                            ? new Date(selectedRequest.approved_at).toLocaleDateString("id-ID")
                                            : ""}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Approve Request Modal */}
            <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Approve Request</DialogTitle>
                        <DialogDescription>Review and approve the requested quantities</DialogDescription>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                            {message && (
                                <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                    {message.text}
                                </div>
                            )}

                            <div>
                                <Label>Approved Quantities</Label>
                                <div className="mt-2 space-y-2">
                                    {selectedRequest.atk_request_items.map((item) => (
                                        <div key={item.id} className="flex justify-between items-center gap-4">
                                            <span className="flex-1 text-sm">{item.atk_items?.name}</span>
                                            <span className="text-muted-foreground text-sm">Requested: {item.quantity}</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                max={item.quantity}
                                                value={approvedQuantities[item.item_id] ?? item.quantity}
                                                onChange={(e) =>
                                                    setApprovedQuantities({
                                                        ...approvedQuantities,
                                                        [item.item_id]: parseInt(e.target.value) || 0,
                                                    })
                                                }
                                                className="w-20"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setIsApproveOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleApprove} disabled={isPending} className="bg-green-600 hover:bg-green-700">
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                    Approve
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Complete Request Modal with Signature */}
            <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Complete Request</DialogTitle>
                        <DialogDescription>Sign to confirm items have been distributed</DialogDescription>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                            {message && (
                                <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                    {message.text}
                                </div>
                            )}

                            <div>
                                <Label>Items to be distributed</Label>
                                <div className="mt-2 space-y-2">
                                    {selectedRequest.atk_request_items.map((item) => (
                                        <div key={item.id} className="flex justify-between items-center p-2 bg-muted rounded">
                                            <span>{item.atk_items?.name}</span>
                                            <span className="font-medium">
                                                {item.approved_quantity ?? item.quantity} {item.atk_items?.unit}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <SignaturePad ref={signatureRef} label="Tanda Tangan Penerima" required />

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setIsCompleteOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleComplete} disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                                    Complete
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Reject Request Modal */}
            <AlertDialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject Request</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to reject this request?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                        <Label>Reason (optional)</Label>
                        <Textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            rows={2}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleReject}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isPending}
                        >
                            {isPending ? "Rejecting..." : "Reject"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Request Modal */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Request</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this request? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isPending}
                        >
                            {isPending ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </>
    );
}
