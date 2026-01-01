"use client";

import { useState, useTransition, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataTable } from "@/hooks/use-data-table";
import { useAssetDistributions, useDistributableAssets, AssetDistribution } from "@/hooks/api/use-asset-distributions";
import { useUsers } from "@/hooks/api/use-users";
import { useLocations } from "@/hooks/api/use-locations";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SignaturePad, SignaturePadRef } from "@/components/ui/signature-pad";
import {
    MoreHorizontal,
    Eye,
    CheckCircle,
    Trash2,
    Plus,
    Loader2,
    X,
    ChevronsUpDown,
    Check,
    FileText,
} from "lucide-react";
import {
    createDistribution,
    confirmDistribution,
    deleteDistribution,
    uploadDistributionSignature,
} from "../actions";
import Link from "next/link";

const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-600",
    pending: "bg-yellow-500/10 text-yellow-600",
    completed: "bg-green-500/10 text-green-600",
};

const statusLabels: Record<string, string> = {
    draft: "Draft",
    pending: "Pending",
    completed: "Completed",
};

export default function DistributionClient() {
    const { page, limit, setPage, setLimit } = useDataTable();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState("all");

    const { data: distributionsData, isLoading } = useAssetDistributions({
        page,
        limit,
        status: statusFilter,
    });

    const { data: assetsData } = useDistributableAssets();
    const { data: usersData } = useUsers({ page: 1, limit: 1000, activeOnly: true });
    const { data: locationsData } = useLocations();

    // Modal states
    const [selectedDistribution, setSelectedDistribution] = useState<AssetDistribution | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Form states
    const [selectedLocation, setSelectedLocation] = useState("");
    const [selectedReceiver, setSelectedReceiver] = useState("");
    const [notes, setNotes] = useState("");
    const [selectedAssets, setSelectedAssets] = useState<{ asset_id: string; condition: "Baru" | "Bekas" }[]>([]);
    const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
    const [receiverPopoverOpen, setReceiverPopoverOpen] = useState(false);
    const [assetPopoverOpen, setAssetPopoverOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const signatureRef = useRef<SignaturePadRef>(null);

    const handleView = (distribution: AssetDistribution) => {
        setSelectedDistribution(distribution);
        setIsViewOpen(true);
    };

    const handleOpenCreate = () => {
        setSelectedLocation("");
        setSelectedReceiver("");
        setNotes("");
        setSelectedAssets([]);
        setMessage(null);
        setIsCreateOpen(true);
    };

    const handleOpenConfirm = (distribution: AssetDistribution) => {
        setSelectedDistribution(distribution);
        signatureRef.current?.clear();
        setMessage(null);
        setIsConfirmOpen(true);
    };

    const handleOpenDelete = (distribution: AssetDistribution) => {
        setSelectedDistribution(distribution);
        setIsDeleteOpen(true);
    };

    const handleAddAsset = (assetId: string) => {
        if (!selectedAssets.find((a) => a.asset_id === assetId)) {
            setSelectedAssets([...selectedAssets, { asset_id: assetId, condition: "Baru" }]);
        }
        setAssetPopoverOpen(false);
    };

    const handleRemoveAsset = (assetId: string) => {
        setSelectedAssets(selectedAssets.filter((a) => a.asset_id !== assetId));
    };

    const handleConditionChange = (assetId: string, condition: "Baru" | "Bekas") => {
        setSelectedAssets(
            selectedAssets.map((a) =>
                a.asset_id === assetId ? { ...a, condition } : a
            )
        );
    };

    const handleCreate = () => {
        setMessage(null);

        if (!selectedLocation) {
            setMessage({ type: "error", text: "Pilih lokasi tujuan" });
            return;
        }

        if (!selectedReceiver) {
            setMessage({ type: "error", text: "Pilih penerima" });
            return;
        }

        if (selectedAssets.length === 0) {
            setMessage({ type: "error", text: "Pilih minimal 1 asset" });
            return;
        }

        startTransition(async () => {
            const result = await createDistribution({
                destination_location_id: selectedLocation,
                receiver_id: selectedReceiver,
                notes: notes || undefined,
                items: selectedAssets,
            });

            if (result.success) {
                setMessage({ type: "success", text: "SBBK berhasil dibuat!" });
                queryClient.invalidateQueries({ queryKey: ["asset-distributions"] });
                queryClient.invalidateQueries({ queryKey: ["distributable-assets"] });
                setTimeout(() => {
                    setIsCreateOpen(false);
                }, 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Gagal membuat SBBK" });
            }
        });
    };

    const handleConfirm = async () => {
        if (!selectedDistribution) return;
        setMessage(null);

        if (signatureRef.current?.isEmpty()) {
            setMessage({ type: "error", text: "Tanda tangan penerima harus diisi" });
            return;
        }

        startTransition(async () => {
            // Get signature as data URL and convert to Blob
            const dataUrl = signatureRef.current?.toDataURL();
            if (!dataUrl) {
                setMessage({ type: "error", text: "Gagal mengambil tanda tangan" });
                return;
            }

            // Convert data URL to Blob
            const response = await fetch(dataUrl);
            const signatureBlob = await response.blob();

            const formData = new FormData();
            formData.append("file", signatureBlob, "signature.png");
            formData.append("distributionId", selectedDistribution.id);

            const uploadResult = await uploadDistributionSignature(formData);
            if (!uploadResult.success || !uploadResult.id) {
                setMessage({ type: "error", text: uploadResult.error || "Gagal upload tanda tangan" });
                return;
            }

            const result = await confirmDistribution(selectedDistribution.id, uploadResult.id);

            if (result.success) {
                setMessage({ type: "success", text: "Distribusi berhasil dikonfirmasi!" });
                queryClient.invalidateQueries({ queryKey: ["asset-distributions"] });
                queryClient.invalidateQueries({ queryKey: ["distributable-assets"] });
                queryClient.invalidateQueries({ queryKey: ["assets"] });
                setTimeout(() => {
                    setIsConfirmOpen(false);
                }, 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Gagal konfirmasi" });
            }
        });
    };

    const handleDelete = () => {
        if (!selectedDistribution) return;

        startTransition(async () => {
            const result = await deleteDistribution(selectedDistribution.id);

            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["asset-distributions"] });
                queryClient.invalidateQueries({ queryKey: ["distributable-assets"] });
                setIsDeleteOpen(false);
            } else {
                alert(result.error || "Gagal menghapus");
            }
        });
    };

    const columns: Column<AssetDistribution>[] = [
        {
            key: "document_number",
            header: "No. Dokumen",
            cell: (row) => (
                <span className="font-medium">{row.document_number || "-"}</span>
            ),
        },
        {
            key: "location",
            header: "Lokasi Tujuan",
            cell: (row) => row.locations?.name || "-",
        },
        {
            key: "receiver",
            header: "Penerima",
            cell: (row) => row.receiver?.full_name || "-",
        },
        {
            key: "items",
            header: "Jumlah Asset",
            cell: (row) => (
                <Badge variant="outline">
                    {row.asset_distribution_items?.length || 0} asset
                </Badge>
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
            key: "created_at",
            header: "Tanggal",
            cell: (row) => (
                <span className="text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                    })}
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
                            Lihat Detail
                        </DropdownMenuItem>
                        {row.status === "completed" && (
                            <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/assets/distribution/${row.id}/document`} target="_blank">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Cetak SBBK
                                </Link>
                            </DropdownMenuItem>
                        )}
                        {row.status === "draft" && (
                            <>
                                <DropdownMenuItem onClick={() => handleOpenConfirm(row)} className="cursor-pointer">
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Konfirmasi
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleOpenDelete(row)}
                                    className="text-destructive cursor-pointer"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Hapus
                                </DropdownMenuItem>
                            </>
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
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                columns={columns}
                data={distributionsData?.data || []}
                isLoading={isLoading}
                page={page}
                totalPages={distributionsData?.totalPages || 1}
                totalItems={distributionsData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="Belum ada distribusi asset."
                toolbarAction={
                    <Button onClick={handleOpenCreate} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Buat SBBK
                    </Button>
                }
            />

            {/* Create Modal */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Buat SBBK Baru</DialogTitle>
                        <DialogDescription>Distribusikan asset ke instalasi lain</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {message && (
                            <div
                                className={`rounded-md p-3 text-sm ${message.type === "success"
                                    ? "bg-green-500/10 text-green-600"
                                    : "bg-destructive/10 text-destructive"
                                    }`}
                            >
                                {message.text}
                            </div>
                        )}

                        {/* Location */}
                        <div className="space-y-2">
                            <Label>Lokasi Tujuan *</Label>
                            <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                        {selectedLocation
                                            ? locationsData?.find((l) => l.id === selectedLocation)?.name
                                            : "Pilih lokasi..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari lokasi..." />
                                        <CommandList className="max-h-[200px]">
                                            <CommandEmpty>Lokasi tidak ditemukan.</CommandEmpty>
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
                                                        <Check className={`mr-2 h-4 w-4 ${selectedLocation === loc.id ? "opacity-100" : "opacity-0"}`} />
                                                        {loc.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Receiver */}
                        <div className="space-y-2">
                            <Label>Penerima *</Label>
                            <Popover open={receiverPopoverOpen} onOpenChange={setReceiverPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                        {selectedReceiver
                                            ? usersData?.data?.find((u) => u.id === selectedReceiver)?.full_name
                                            : "Pilih penerima..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari penerima..." />
                                        <CommandList className="max-h-[200px]">
                                            <CommandEmpty>Penerima tidak ditemukan.</CommandEmpty>
                                            <CommandGroup>
                                                {usersData?.data?.map((user) => (
                                                    <CommandItem
                                                        key={user.id}
                                                        value={user.full_name || user.username || ""}
                                                        onSelect={() => {
                                                            setSelectedReceiver(user.id);
                                                            setReceiverPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check className={`mr-2 h-4 w-4 ${selectedReceiver === user.id ? "opacity-100" : "opacity-0"}`} />
                                                        {user.full_name || user.username}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Assets */}
                        <div className="space-y-2">
                            <Label>Pilih Asset *</Label>
                            <Popover open={assetPopoverOpen} onOpenChange={setAssetPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between">
                                        Tambah Asset...
                                        <Plus className="ml-2 h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari asset..." />
                                        <CommandList className="max-h-[200px]">
                                            <CommandEmpty>Asset tidak ditemukan.</CommandEmpty>
                                            <CommandGroup>
                                                {assetsData
                                                    ?.filter((a) => !selectedAssets.find((sa) => sa.asset_id === a.id))
                                                    .map((asset) => (
                                                        <CommandItem
                                                            key={asset.id}
                                                            value={asset.name}
                                                            onSelect={() => handleAddAsset(asset.id)}
                                                        >
                                                            <div>
                                                                <p>{asset.name}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {asset.asset_code} - {asset.locations?.name || "No location"}
                                                                </p>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            {/* Selected Assets List */}
                            {selectedAssets.length > 0 && (
                                <div className="border rounded-md p-2 space-y-2">
                                    {selectedAssets.map((sa) => {
                                        const asset = assetsData?.find((a) => a.id === sa.asset_id);
                                        return (
                                            <div key={sa.asset_id} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                                                <div className="flex-1">
                                                    <p className="font-medium">{asset?.name}</p>
                                                    <p className="text-xs text-muted-foreground">{asset?.asset_code}</p>
                                                </div>
                                                <Select
                                                    value={sa.condition}
                                                    onValueChange={(v) => handleConditionChange(sa.asset_id, v as "Baru" | "Bekas")}
                                                >
                                                    <SelectTrigger className="w-24">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Baru">Baru</SelectItem>
                                                        <SelectItem value="Bekas">Bekas</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveAsset(sa.asset_id)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>Catatan</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Catatan tambahan..."
                                rows={3}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                Batal
                            </Button>
                            <Button onClick={handleCreate} disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Buat SBBK
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Modal */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Detail Distribusi</DialogTitle>
                        <DialogDescription>{selectedDistribution?.document_number}</DialogDescription>
                    </DialogHeader>
                    {selectedDistribution && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Lokasi Tujuan</p>
                                    <p className="font-medium">{selectedDistribution.locations?.name || "-"}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Penerima</p>
                                    <p className="font-medium">{selectedDistribution.receiver?.full_name || "-"}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Status</p>
                                    <Badge variant="secondary" className={statusColors[selectedDistribution.status]}>
                                        {statusLabels[selectedDistribution.status]}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Tanggal</p>
                                    <p className="font-medium">
                                        {new Date(selectedDistribution.created_at).toLocaleDateString("id-ID")}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-muted-foreground mb-2">Daftar Asset</p>
                                <div className="border rounded-md divide-y">
                                    {selectedDistribution.asset_distribution_items?.map((item) => (
                                        <div key={item.id} className="p-2 flex justify-between">
                                            <div>
                                                <p className="font-medium">{item.assets?.name}</p>
                                                <p className="text-xs text-muted-foreground">{item.assets?.asset_code}</p>
                                            </div>
                                            <Badge variant="outline">{item.condition}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedDistribution.receiver_signature_url && (
                                <div>
                                    <p className="text-muted-foreground mb-2">Tanda Tangan Penerima</p>
                                    <img
                                        src={selectedDistribution.receiver_signature_url}
                                        alt="Signature"
                                        className="max-h-24 border rounded"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Confirm Modal */}
            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi Distribusi</DialogTitle>
                        <DialogDescription>
                            Tanda tangan penerima untuk konfirmasi penerimaan asset
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {message && (
                            <div
                                className={`rounded-md p-3 text-sm ${message.type === "success"
                                    ? "bg-green-500/10 text-green-600"
                                    : "bg-destructive/10 text-destructive"
                                    }`}
                            >
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Tanda Tangan Penerima *</Label>
                            <SignaturePad ref={signatureRef} />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => signatureRef.current?.clear()}
                            >
                                Reset
                            </Button>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
                                Batal
                            </Button>
                            <Button onClick={handleConfirm} disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Mengkonfirmasi...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Konfirmasi
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Distribusi?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Apakah Anda yakin ingin menghapus SBBK {selectedDistribution?.document_number}?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                            {isPending ? "Menghapus..." : "Hapus"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
