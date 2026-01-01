"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataTable } from "@/hooks/use-data-table";
import { useAssetBorrowings, useBorrowableAssets, AssetBorrowing } from "@/hooks/api/use-asset-borrowings";
import { useLocations } from "@/hooks/api/use-locations";
import { useAllUsers } from "@/hooks/api/use-all-users";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    MoreHorizontal,
    Eye,
    CheckCircle,
    XCircle,
    Plus,
    Loader2,
    Trash2,
    ChevronsUpDown,
    Check,
    PackageCheck,
    Undo2,
} from "lucide-react";
import {
    createBorrowingRequest,
    approveBorrowing,
    rejectBorrowing,
    confirmBorrowed,
    returnAsset,
    deleteBorrowing,
} from "../actions";

const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600",
    approved: "bg-blue-500/10 text-blue-600",
    borrowed: "bg-purple-500/10 text-purple-600",
    returned: "bg-green-500/10 text-green-600",
    rejected: "bg-red-500/10 text-red-600",
};

const statusLabels: Record<string, string> = {
    pending: "Pending",
    approved: "Approved",
    borrowed: "Borrowed",
    returned: "Returned",
    rejected: "Rejected",
};

export default function BorrowingClient() {
    const { page, limit, setPage, setLimit } = useDataTable();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState("all");

    const { data: borrowingsData, isLoading } = useAssetBorrowings({
        page,
        limit,
        status: statusFilter,
    });

    const { data: borrowableAssets } = useBorrowableAssets();
    const { data: locations } = useLocations();
    const { data: users } = useAllUsers();

    // Modal states
    const [selectedBorrowing, setSelectedBorrowing] = useState<AssetBorrowing | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isApproveOpen, setIsApproveOpen] = useState(false);
    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Form states
    const [selectedAsset, setSelectedAsset] = useState("");
    const [selectedLocation, setSelectedLocation] = useState("");
    const [borrowDate, setBorrowDate] = useState("");
    const [expectedReturnDate, setExpectedReturnDate] = useState("");
    const [purpose, setPurpose] = useState("");
    const [notes, setNotes] = useState("");
    const [rejectReason, setRejectReason] = useState("");
    const [selectedUser, setSelectedUser] = useState("");
    const [assetPopoverOpen, setAssetPopoverOpen] = useState(false);
    const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
    const [userPopoverOpen, setUserPopoverOpen] = useState(false);

    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleView = (borrowing: AssetBorrowing) => {
        setSelectedBorrowing(borrowing);
        setIsViewOpen(true);
    };

    const handleOpenCreate = () => {
        setSelectedAsset("");
        setSelectedLocation("");
        setSelectedUser("");
        setBorrowDate(new Date().toISOString().split("T")[0]);
        setExpectedReturnDate("");
        setPurpose("");
        setNotes("");
        setMessage(null);
        setIsCreateOpen(true);
    };

    const handleCreate = () => {
        setMessage(null);

        if (!selectedAsset) {
            setMessage({ type: "error", text: "Pilih asset yang akan dipinjam" });
            return;
        }

        if (!purpose.trim()) {
            setMessage({ type: "error", text: "Isi tujuan peminjaman" });
            return;
        }

        startTransition(async () => {
            const result = await createBorrowingRequest({
                asset_id: selectedAsset,
                borrower_user_id: selectedUser || undefined,
                borrow_date: borrowDate,
                expected_return_date: expectedReturnDate || undefined,
                purpose: purpose,
                notes: notes || undefined,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Request berhasil dibuat!" });
                queryClient.invalidateQueries({ queryKey: ["asset-borrowings"] });
                setTimeout(() => setIsCreateOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Gagal membuat request" });
            }
        });
    };

    const handleOpenApprove = (borrowing: AssetBorrowing) => {
        setSelectedBorrowing(borrowing);
        setIsApproveOpen(true);
    };

    const handleApprove = () => {
        if (!selectedBorrowing) return;
        startTransition(async () => {
            const result = await approveBorrowing(selectedBorrowing.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["asset-borrowings"] });
                setIsApproveOpen(false);
            }
        });
    };

    const handleOpenReject = (borrowing: AssetBorrowing) => {
        setSelectedBorrowing(borrowing);
        setRejectReason("");
        setIsRejectOpen(true);
    };

    const handleReject = () => {
        if (!selectedBorrowing) return;
        startTransition(async () => {
            const result = await rejectBorrowing(selectedBorrowing.id, rejectReason);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["asset-borrowings"] });
                setIsRejectOpen(false);
            }
        });
    };

    const handleConfirmBorrowed = (borrowing: AssetBorrowing) => {
        startTransition(async () => {
            const result = await confirmBorrowed(borrowing.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["asset-borrowings"] });
                queryClient.invalidateQueries({ queryKey: ["assets"] });
            }
        });
    };

    const handleReturn = (borrowing: AssetBorrowing) => {
        startTransition(async () => {
            const result = await returnAsset(borrowing.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["asset-borrowings"] });
                queryClient.invalidateQueries({ queryKey: ["assets"] });
            }
        });
    };

    const handleOpenDelete = (borrowing: AssetBorrowing) => {
        setSelectedBorrowing(borrowing);
        setIsDeleteOpen(true);
    };

    const handleDelete = () => {
        if (!selectedBorrowing) return;
        startTransition(async () => {
            const result = await deleteBorrowing(selectedBorrowing.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["asset-borrowings"] });
                setIsDeleteOpen(false);
            }
        });
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const columns: Column<AssetBorrowing>[] = [
        {
            key: "asset",
            header: "Asset",
            cell: (row) => (
                <div>
                    <p className="font-medium">{row.assets?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground">{row.assets?.asset_code}</p>
                </div>
            ),
        },
        {
            key: "borrower",
            header: "Peminjam",
            cell: (row) => (
                <div>
                    <p className="font-medium">{row.borrower?.full_name || "-"}</p>
                    <p className="text-xs text-muted-foreground">{row.borrower_location?.name}</p>
                </div>
            ),
        },
        {
            key: "dates",
            header: "Tanggal",
            cell: (row) => (
                <div className="text-sm">
                    <p>Pinjam: {formatDate(row.borrow_date)}</p>
                    {row.expected_return_date && (
                        <p className="text-muted-foreground">Kembali: {formatDate(row.expected_return_date)}</p>
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
                                <DropdownMenuItem onClick={() => handleOpenDelete(row)} className="cursor-pointer text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </>
                        )}
                        {row.status === "approved" && (
                            <DropdownMenuItem onClick={() => handleConfirmBorrowed(row)} className="cursor-pointer text-purple-600">
                                <PackageCheck className="mr-2 h-4 w-4" />
                                Confirm Borrowed
                            </DropdownMenuItem>
                        )}
                        {row.status === "borrowed" && (
                            <DropdownMenuItem onClick={() => handleReturn(row)} className="cursor-pointer text-green-600">
                                <Undo2 className="mr-2 h-4 w-4" />
                                Return Asset
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <>
            <div className="flex items-center gap-4 mb-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="borrowed">Borrowed</SelectItem>
                        <SelectItem value="returned">Returned</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                columns={columns}
                data={borrowingsData?.data || []}
                isLoading={isLoading}
                page={page}
                totalPages={borrowingsData?.totalPages || 1}
                totalItems={borrowingsData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="No borrowing requests found."
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
                        <DialogTitle>New Borrowing Request</DialogTitle>
                        <DialogDescription>Request to borrow an asset</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {message && (
                            <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Asset *</Label>
                            <Popover open={assetPopoverOpen} onOpenChange={setAssetPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                        {selectedAsset
                                            ? borrowableAssets?.find((a) => a.id === selectedAsset)?.name
                                            : "Select asset..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search asset..." />
                                        <CommandList className="max-h-[200px]">
                                            <CommandEmpty>No assets found.</CommandEmpty>
                                            <CommandGroup>
                                                {borrowableAssets?.map((asset) => (
                                                    <CommandItem
                                                        key={asset.id}
                                                        value={`${asset.name} ${asset.asset_code}`}
                                                        onSelect={() => {
                                                            setSelectedAsset(asset.id);
                                                            setAssetPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check className={`mr-2 h-4 w-4 ${selectedAsset === asset.id ? "opacity-100" : "opacity-0"}`} />
                                                        <div>
                                                            <p>{asset.name}</p>
                                                            <p className="text-xs text-muted-foreground">{asset.asset_code} - {asset.locations?.name}</p>
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
                            <Label>Peminjam (opsional)</Label>
                            <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                        {selectedUser
                                            ? users?.find((u) => u.id === selectedUser)?.full_name
                                            : "Pilih user... (kosongkan = diri sendiri)"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari user..." />
                                        <CommandList className="max-h-[200px]">
                                            <CommandEmpty>User tidak ditemukan.</CommandEmpty>
                                            <CommandGroup>
                                                {users?.map((user) => (
                                                    <CommandItem
                                                        key={user.id}
                                                        value={user.full_name || user.username || ""}
                                                        onSelect={() => {
                                                            setSelectedUser(user.id);
                                                            setUserPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check className={`mr-2 h-4 w-4 ${selectedUser === user.id ? "opacity-100" : "opacity-0"}`} />
                                                        <div>
                                                            <p>{user.full_name || user.username}</p>
                                                            <p className="text-xs text-muted-foreground">{user.username}</p>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tanggal Pinjam *</Label>
                                <Input
                                    type="date"
                                    value={borrowDate}
                                    onChange={(e) => setBorrowDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tanggal Kembali</Label>
                                <Input
                                    type="date"
                                    value={expectedReturnDate}
                                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Tujuan Peminjaman *</Label>
                            <Textarea
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                placeholder="Jelaskan tujuan peminjaman..."
                                rows={2}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Catatan</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Catatan tambahan..."
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

            {/* View Modal */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Borrowing Details</DialogTitle>
                        <DialogDescription>View borrowing request information</DialogDescription>
                    </DialogHeader>
                    {selectedBorrowing && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Asset</span>
                                    <p className="font-medium">{selectedBorrowing.assets?.name}</p>
                                    <p className="text-xs text-muted-foreground">{selectedBorrowing.assets?.asset_code}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Status</span>
                                    <p>
                                        <Badge variant="secondary" className={statusColors[selectedBorrowing.status]}>
                                            {statusLabels[selectedBorrowing.status]}
                                        </Badge>
                                    </p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Peminjam</span>
                                    <p>{selectedBorrowing.borrower?.full_name || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Lokasi Peminjam</span>
                                    <p>{selectedBorrowing.borrower_location?.name || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Lokasi Asal</span>
                                    <p>{selectedBorrowing.original_location?.name || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tanggal Pinjam</span>
                                    <p>{formatDate(selectedBorrowing.borrow_date)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tanggal Kembali</span>
                                    <p>{formatDate(selectedBorrowing.expected_return_date)}</p>
                                </div>
                                {selectedBorrowing.actual_return_date && (
                                    <div>
                                        <span className="text-muted-foreground">Dikembalikan</span>
                                        <p>{formatDate(selectedBorrowing.actual_return_date)}</p>
                                    </div>
                                )}
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground">Tujuan</span>
                                <p className="text-sm">{selectedBorrowing.purpose || "-"}</p>
                            </div>
                            {selectedBorrowing.notes && (
                                <div>
                                    <span className="text-sm text-muted-foreground">Catatan</span>
                                    <p className="text-sm">{selectedBorrowing.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Approve Dialog */}
            <AlertDialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve Borrowing Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Menyetujui peminjaman "{selectedBorrowing?.assets?.name}" untuk {selectedBorrowing?.borrower?.full_name}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApprove} disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Approve
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Dialog */}
            <AlertDialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject Borrowing Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Menolak peminjaman "{selectedBorrowing?.assets?.name}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Label>Alasan Penolakan</Label>
                        <Textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Alasan penolakan..."
                            className="mt-2"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReject} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Reject
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Hapus request peminjaman ini? Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
