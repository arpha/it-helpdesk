"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataTable } from "@/hooks/use-data-table";
import { useAssets, Asset } from "@/hooks/api/use-assets";
import { useAllAssetCategories } from "@/hooks/api/use-asset-categories";
import { useLocations } from "@/hooks/api/use-locations";
import { useAllUsers } from "@/hooks/api/use-all-users";
import { getSpecTemplate, SpecField } from "@/lib/asset-spec-templates";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
    MoreHorizontal,
    Eye,
    Pencil,
    Trash2,
    Plus,
    Loader2,
    FileSpreadsheet,
    Monitor,
    Upload,
    X,
    Check,
    ChevronsUpDown,
    QrCode,
    Printer,
} from "lucide-react";
import * as XLSX from "xlsx";
import { createAsset, updateAsset, deleteAsset, uploadAssetImage, generateAssetCode } from "../actions";

const statusLabels: Record<string, string> = {
    active: "Active",
    maintenance: "Maintenance",
    damage: "Damage",
    disposed: "Disposed",
};

const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-500",
    maintenance: "bg-yellow-500/10 text-yellow-500",
    damage: "bg-red-500/10 text-red-500",
    disposed: "bg-gray-500/10 text-gray-500",
};

const conditionLabels: Record<string, string> = {
    good: "Good",
    fair: "Fair",
    poor: "Poor",
};

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function calculateRefreshCycle(purchaseDate: string | null, refreshCycleYears: number): { yearsRemaining: number; percentRemaining: number } {
    if (!purchaseDate || refreshCycleYears <= 0) {
        return { yearsRemaining: 0, percentRemaining: 0 };
    }

    const purchaseDateObj = new Date(purchaseDate);
    const now = new Date();
    const yearsUsed = (now.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const yearsRemaining = Math.max(0, refreshCycleYears - yearsUsed);
    const percentRemaining = Math.max(0, Math.min(100, (yearsRemaining / refreshCycleYears) * 100));

    return { yearsRemaining, percentRemaining };
}

export default function AssetsClient() {
    const { page, limit, search, searchInput, setPage, setLimit, setSearch } = useDataTable();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");

    const { data: assetsData, isLoading } = useAssets({
        page,
        limit,
        search,
        status: statusFilter,
        categoryId: categoryFilter
    });
    const { data: categories } = useAllAssetCategories();
    const { data: locations } = useLocations();
    const { data: users } = useAllUsers();

    // Modal states
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isQrOpen, setIsQrOpen] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<string>("");

    // Bulk select for print
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());

    // Form states
    const [formAssetCode, setFormAssetCode] = useState("");
    const [formName, setFormName] = useState("");
    const [formCategoryId, setFormCategoryId] = useState("");
    const [formSerialNumber, setFormSerialNumber] = useState("");
    const [formPurchaseDate, setFormPurchaseDate] = useState("");
    const [formWarrantyExpiry, setFormWarrantyExpiry] = useState("");
    const [formUsefulLife, setFormUsefulLife] = useState("5");
    const [formStatus, setFormStatus] = useState("active");
    const [formOwnershipStatus, setFormOwnershipStatus] = useState("purchase");
    const [formLocationId, setFormLocationId] = useState("");
    const [formAssignedTo, setFormAssignedTo] = useState("");
    const [userPopoverOpen, setUserPopoverOpen] = useState(false);
    const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
    const [formNotes, setFormNotes] = useState("");
    const [formSpecifications, setFormSpecifications] = useState<Record<string, string>>({});
    const [formImageFile, setFormImageFile] = useState<File | null>(null);
    const [formImagePreview, setFormImagePreview] = useState("");
    const [formImageUrl, setFormImageUrl] = useState("");
    const [formIsBorrowable, setFormIsBorrowable] = useState(false);

    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const resetForm = () => {
        setFormAssetCode("");
        setFormName("");
        setFormCategoryId("");
        setFormSerialNumber("");
        setFormPurchaseDate("");
        setFormWarrantyExpiry("");
        setFormUsefulLife("5");
        setFormStatus("active");
        setFormOwnershipStatus("purchase");
        setFormLocationId("");
        setFormAssignedTo("");
        setFormNotes("");
        setFormSpecifications({});
        setFormImageFile(null);
        setFormImagePreview("");
        setFormImageUrl("");
        setFormIsBorrowable(false);
        setMessage(null);
    };

    const handleView = (asset: Asset) => {
        setSelectedAsset(asset);
        setIsViewOpen(true);
    };

    const handleOpenAdd = async () => {
        resetForm();
        // Generate asset code
        const code = await generateAssetCode("AST");
        setFormAssetCode(code);
        setIsAddOpen(true);
    };

    const handleOpenEdit = (asset: Asset) => {
        setSelectedAsset(asset);
        setFormAssetCode(asset.asset_code);
        setFormName(asset.name);
        setFormCategoryId(asset.category_id || "");
        setFormSerialNumber(asset.serial_number || "");
        setFormPurchaseDate(asset.purchase_date || "");
        setFormWarrantyExpiry(asset.warranty_expiry || "");
        setFormUsefulLife(asset.useful_life_years.toString());
        setFormStatus(asset.status);
        setFormOwnershipStatus(asset.ownership_status || "purchase");
        setFormLocationId(asset.location_id || "");
        setFormAssignedTo(asset.assigned_to || "");
        setFormNotes(asset.notes || "");
        setFormSpecifications(asset.specifications || {});
        setFormImageFile(null);
        setFormImagePreview(asset.image_url || "");
        setFormImageUrl(asset.image_url || "");
        setFormIsBorrowable(asset.is_borrowable || false);
        setMessage(null);
        setIsEditOpen(true);
    };

    const handleOpenDelete = (asset: Asset) => {
        setSelectedAsset(asset);
        setIsDeleteOpen(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreate = () => {
        setMessage(null);
        if (!formAssetCode || !formName) {
            setMessage({ type: "error", text: "Asset code and name are required" });
            return;
        }

        startTransition(async () => {
            let imageUrl = formImageUrl;

            if (formImageFile) {
                const formData = new FormData();
                formData.append("file", formImageFile);
                formData.append("assetId", Date.now().toString());
                const uploadResult = await uploadAssetImage(formData);
                if (!uploadResult.success) {
                    setMessage({ type: "error", text: uploadResult.error || "Upload failed" });
                    return;
                }
                imageUrl = uploadResult.url || "";
            }

            const result = await createAsset({
                asset_code: formAssetCode,
                name: formName,
                category_id: formCategoryId || undefined,
                serial_number: formSerialNumber || undefined,
                purchase_date: formPurchaseDate || undefined,
                warranty_expiry: formWarrantyExpiry || undefined,
                useful_life_years: parseInt(formUsefulLife) || 5,
                status: formStatus,
                ownership_status: formOwnershipStatus,
                location_id: formLocationId || undefined,
                assigned_to: formAssignedTo || undefined,
                image_url: imageUrl || undefined,
                notes: formNotes || undefined,
                specifications: formSpecifications,
                is_borrowable: formIsBorrowable,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Asset created!" });
                queryClient.invalidateQueries({ queryKey: ["assets"] });
                setTimeout(() => setIsAddOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleUpdate = () => {
        if (!selectedAsset) return;
        setMessage(null);
        if (!formAssetCode || !formName) {
            setMessage({ type: "error", text: "Asset code and name are required" });
            return;
        }

        startTransition(async () => {
            let imageUrl = formImageUrl;

            if (formImageFile) {
                const formData = new FormData();
                formData.append("file", formImageFile);
                formData.append("assetId", selectedAsset.id);
                const uploadResult = await uploadAssetImage(formData);
                if (!uploadResult.success) {
                    setMessage({ type: "error", text: uploadResult.error || "Upload failed" });
                    return;
                }
                imageUrl = uploadResult.url || "";
            }

            const result = await updateAsset({
                id: selectedAsset.id,
                asset_code: formAssetCode,
                name: formName,
                category_id: formCategoryId || undefined,
                serial_number: formSerialNumber || undefined,
                purchase_date: formPurchaseDate || undefined,
                warranty_expiry: formWarrantyExpiry || undefined,
                useful_life_years: parseInt(formUsefulLife) || 5,
                status: formStatus,
                ownership_status: formOwnershipStatus,
                location_id: formLocationId || undefined,
                assigned_to: formAssignedTo || undefined,
                image_url: imageUrl || undefined,
                notes: formNotes || undefined,
                specifications: formSpecifications,
                is_borrowable: formIsBorrowable,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Asset updated!" });
                queryClient.invalidateQueries({ queryKey: ["assets"] });
                setTimeout(() => setIsEditOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleDelete = () => {
        if (!selectedAsset) return;
        startTransition(async () => {
            const result = await deleteAsset(selectedAsset.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["assets"] });
                setIsDeleteOpen(false);
            }
        });
    };

    const handleExportExcel = () => {
        if (!assetsData?.data || assetsData.data.length === 0) return;

        const data = assetsData.data.map((asset, index) => {
            const { yearsRemaining, percentRemaining } = calculateRefreshCycle(
                asset.purchase_date,
                asset.useful_life_years
            );
            return {
                No: index + 1,
                "Asset Code": asset.asset_code,
                Name: asset.name,
                Category: asset.asset_categories?.name || "-",
                "Serial Number": asset.serial_number || "-",
                Status: statusLabels[asset.status],
                Location: asset.locations?.name || "-",
                "Assigned To": asset.profiles?.full_name || "-",
                "Purchase Date": asset.purchase_date || "-",
                "Refresh Cycle Years": asset.useful_life_years,
                "Years Remaining": yearsRemaining.toFixed(1),
                "Cycle Remaining %": Math.round(percentRemaining),
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
        XLSX.writeFile(workbook, `Assets_${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    const columns: Column<Asset>[] = [
        {
            key: "select",
            header: "",
            className: "w-10",
            cell: (asset) => (
                <input
                    type="checkbox"
                    checked={selectedAssetIds.has(asset.id)}
                    onChange={() => toggleSelectAsset(asset.id)}
                    className="h-4 w-4 rounded border-gray-300"
                />
            ),
        },
        {
            key: "asset",
            header: "Asset",
            cell: (asset) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-lg">
                        <AvatarImage src={asset.image_url || undefined} />
                        <AvatarFallback className="rounded-lg">
                            <Monitor className="h-5 w-5" />
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">{asset.asset_code}</p>
                    </div>
                </div>
            ),
        },
        {
            key: "category",
            header: "Category",
            cell: (asset) => (
                <span className="text-muted-foreground">{asset.asset_categories?.name || "-"}</span>
            ),
        },
        {
            key: "status",
            header: "Status",
            cell: (asset) => (
                <Badge className={statusColors[asset.status]}>
                    {statusLabels[asset.status]}
                </Badge>
            ),
        },
        {
            key: "location",
            header: "Location",
            cell: (asset) => (
                <span className="text-muted-foreground">{asset.locations?.name || "-"}</span>
            ),
        },
        {
            key: "refresh_cycle",
            header: "Refresh Cycle",
            cell: (asset) => {
                const { yearsRemaining, percentRemaining } = calculateRefreshCycle(
                    asset.purchase_date,
                    asset.useful_life_years
                );
                const filledBlocks = Math.round(percentRemaining / 10);
                const emptyBlocks = 10 - filledBlocks;
                const progressBar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);

                return (
                    <div>
                        <p className="text-sm font-medium">
                            {yearsRemaining > 0
                                ? `${yearsRemaining.toFixed(1)} years left`
                                : "Needs refresh"}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground">
                            [{progressBar}] {Math.round(percentRemaining)}%
                        </p>
                    </div>
                );
            },
        },
        {
            key: "actions",
            header: "",
            className: "w-12",
            cell: (asset) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleView(asset)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenEdit(asset)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenDelete(asset)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleShowQr(asset)}>
                            <QrCode className="mr-2 h-4 w-4" />
                            Show QR Code
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    const handleShowQr = async (asset: Asset) => {
        try {
            const res = await fetch(`/api/assets/qr?id=${asset.id}`);
            const json = await res.json();
            if (json.success) {
                setSelectedAsset(asset);
                setQrCodeData(json.data.qrCode);
                setIsQrOpen(true);
            }
        } catch (error) {
            console.error("Failed to generate QR:", error);
        }
    };

    const handlePrintSelected = async () => {
        if (selectedAssetIds.size === 0) return;

        // Fetch QR codes for selected assets
        const selectedAssets = assetsData?.data.filter(a => selectedAssetIds.has(a.id)) || [];
        const qrCodes: { name: string; code: string; qr: string }[] = [];

        for (const asset of selectedAssets) {
            try {
                const res = await fetch(`/api/assets/qr?id=${asset.id}`);
                const json = await res.json();
                if (json.success) {
                    qrCodes.push({
                        name: asset.name,
                        code: asset.asset_code,
                        qr: json.data.qrCode
                    });
                }
            } catch (error) {
                console.error(`Failed to get QR for ${asset.id}:`, error);
            }
        }

        // Create print content
        const printContent = qrCodes.map((item, index) => `
            <div style="width: 6cm; height: 6cm; padding: 0.5cm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: ${index < qrCodes.length - 1 ? 'always' : 'auto'}; box-sizing: border-box;">
                <img src="${item.qr}" style="width: 4cm; height: 4cm;" />
                <div style="margin-top: 0.3cm;">
                    <p style="font-weight: bold; font-size: 10px; margin: 0; max-width: 5cm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</p>
                    <p style="font-size: 9px; color: #666; margin: 0; font-family: monospace;">${item.code}</p>
                </div>
            </div>
        `).join('');

        // Open print window
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print QR Labels</title>
                    <style>
                        @page { size: 6cm 6cm; margin: 0; }
                        body { margin: 0; padding: 0; }
                        @media print {
                            body { margin: 0; padding: 0; }
                        }
                    </style>
                </head>
                <body>${printContent}</body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        }
    };

    const toggleSelectAsset = (assetId: string) => {
        setSelectedAssetIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(assetId)) {
                newSet.delete(assetId);
            } else {
                newSet.add(assetId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedAssetIds.size === assetsData?.data.length) {
            setSelectedAssetIds(new Set());
        } else {
            setSelectedAssetIds(new Set(assetsData?.data.map(a => a.id) || []));
        }
    };

    return (
        <>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32 sm:w-40">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="damage">Damage</SelectItem>
                        <SelectItem value="disposed">Disposed</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-32 sm:w-40">
                        <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                columns={columns}
                data={assetsData?.data || []}
                isLoading={isLoading}
                searchValue={searchInput}
                onSearchChange={setSearch}
                searchPlaceholder="Search assets or location..."
                page={page}
                totalPages={assetsData?.totalPages || 1}
                totalItems={assetsData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="No assets found."
                toolbarAction={
                    <div className="flex gap-2">
                        {selectedAssetIds.size > 0 && (
                            <Button variant="outline" onClick={handlePrintSelected} size="sm">
                                <Printer className="mr-2 h-4 w-4" />
                                Print QR ({selectedAssetIds.size})
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleExportExcel} size="sm" className="hidden sm:flex">
                            <FileSpreadsheet className="mr-2 h-4 w-4" />Export Excel
                        </Button>
                        <Button variant="outline" onClick={handleExportExcel} size="icon" className="sm:hidden">
                            <FileSpreadsheet className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleOpenAdd} size="sm" className="hidden sm:flex">
                            <Plus className="mr-2 h-4 w-4" />Add Asset
                        </Button>
                        <Button onClick={handleOpenAdd} size="icon" className="sm:hidden">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                }
            />

            {/* View Modal */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Asset Details</DialogTitle>
                        <DialogDescription>View asset information</DialogDescription>
                    </DialogHeader>
                    {selectedAsset && (
                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-20 w-20 rounded-lg">
                                    <AvatarImage src={selectedAsset.image_url || undefined} />
                                    <AvatarFallback className="rounded-lg">
                                        <Monitor className="h-10 w-10" />
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-lg font-semibold">{selectedAsset.name}</h3>
                                    <p className="text-muted-foreground">{selectedAsset.asset_code}</p>
                                    <Badge className={statusColors[selectedAsset.status]}>
                                        {statusLabels[selectedAsset.status]}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Category</span>
                                    <p className="font-medium">{selectedAsset.asset_categories?.name || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Serial Number</span>
                                    <p className="font-medium">{selectedAsset.serial_number || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Assigned To</span>
                                    <p className="font-medium">{selectedAsset.profiles?.full_name || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Location</span>
                                    <p className="font-medium">{selectedAsset.locations?.name || "-"}</p>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="font-semibold mb-2">Financial Info</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Purchase Date</span>
                                        <p className="font-medium">
                                            {selectedAsset.purchase_date
                                                ? new Date(selectedAsset.purchase_date).toLocaleDateString("id-ID")
                                                : "-"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Refresh Cycle</span>
                                        <p className="font-medium">
                                            {selectedAsset.useful_life_years} years
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Cycle Remaining</span>
                                        <p className="font-medium text-green-600">
                                            {calculateRefreshCycle(
                                                selectedAsset.purchase_date,
                                                selectedAsset.useful_life_years
                                            ).yearsRemaining.toFixed(1)} years ({Math.round(
                                                calculateRefreshCycle(
                                                    selectedAsset.purchase_date,
                                                    selectedAsset.useful_life_years
                                                ).percentRemaining
                                            )}%)
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Warranty Expiry</span>
                                        <p className="font-medium">
                                            {selectedAsset.warranty_expiry
                                                ? new Date(selectedAsset.warranty_expiry).toLocaleDateString("id-ID")
                                                : "-"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Useful Life</span>
                                        <p className="font-medium">{selectedAsset.useful_life_years} years</p>
                                    </div>
                                </div>
                            </div>

                            {selectedAsset.notes && (
                                <div className="border-t pt-4">
                                    <span className="text-muted-foreground text-sm">Notes</span>
                                    <p className="mt-1">{selectedAsset.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Add/Edit Modal */}
            <Dialog open={isAddOpen || isEditOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsAddOpen(false);
                    setIsEditOpen(false);
                }
            }}>
                <DialogContent className="sm:max-w-2xl max-w-[95vw] mx-auto">
                    <DialogHeader>
                        <DialogTitle>{isEditOpen ? "Edit Asset" : "Add New Asset"}</DialogTitle>
                        <DialogDescription>
                            {isEditOpen ? "Update asset details" : "Create a new asset"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto overflow-x-hidden px-1">
                        {message && (
                            <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Asset Code *</Label>
                                <Input
                                    value={formAssetCode}
                                    onChange={(e) => setFormAssetCode(e.target.value)}
                                    placeholder="AST-2024-0001"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories?.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Name *</Label>
                            <Input
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g., Laptop Dell Latitude 5520"
                            />
                        </div>
                        {/* Row 1: Serial Number + Status */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Serial Number</Label>
                                <Input
                                    value={formSerialNumber}
                                    onChange={(e) => setFormSerialNumber(e.target.value)}
                                    placeholder="S/N"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={formStatus} onValueChange={setFormStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="maintenance">Maintenance</SelectItem>
                                        <SelectItem value="damage">Damage</SelectItem>
                                        <SelectItem value="disposed">Disposed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 1.5: Ownership Status */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Status Kepemilikan</Label>
                                <Select value={formOwnershipStatus} onValueChange={setFormOwnershipStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="purchase">Beli</SelectItem>
                                        <SelectItem value="rent">Sewa</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Bisa Dipinjam</Label>
                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="is_borrowable"
                                        checked={formIsBorrowable}
                                        onChange={(e) => setFormIsBorrowable(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <label htmlFor="is_borrowable" className="text-sm text-muted-foreground">
                                        Asset ini bisa dipinjam oleh unit lain
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Specification Fields based on Category */}
                        {formCategoryId && categories?.find(c => c.id === formCategoryId) && (
                            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                                <h4 className="font-medium text-sm">Spesifikasi {categories.find(c => c.id === formCategoryId)?.name}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {getSpecTemplate(categories.find(c => c.id === formCategoryId)?.name || "").map((field: SpecField) => (
                                        <div key={field.key} className="space-y-2">
                                            <Label>{field.label}</Label>
                                            {field.type === "select" ? (
                                                <Select
                                                    value={formSpecifications[field.key] || ""}
                                                    onValueChange={(val) => setFormSpecifications(prev => ({ ...prev, [field.key]: val }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={`Pilih ${field.label}`} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {field.options?.map(opt => (
                                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input
                                                    value={formSpecifications[field.key] || ""}
                                                    onChange={(e) => setFormSpecifications(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                    placeholder={field.placeholder}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Row 2: Purchase Date + Purchase Price */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Purchase Date</Label>
                                <Input
                                    type="date"
                                    value={formPurchaseDate}
                                    onChange={(e) => setFormPurchaseDate(e.target.value)}
                                    className="w-full min-w-0 [&::-webkit-calendar-picker-indicator]:opacity-100"
                                />
                            </div>
                        </div>

                        {/* Row 3: Warranty Expiry + Useful Life */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Warranty Expiry</Label>
                                <Input
                                    type="date"
                                    value={formWarrantyExpiry}
                                    onChange={(e) => setFormWarrantyExpiry(e.target.value)}
                                    className="w-full min-w-0 [&::-webkit-calendar-picker-indicator]:opacity-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Useful Life (years)</Label>
                                <Input
                                    type="number"
                                    value={formUsefulLife}
                                    onChange={(e) => setFormUsefulLife(e.target.value)}
                                    placeholder="5"
                                />
                            </div>
                        </div>

                        {/* Row 4: Assigned To (searchable) + Location */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Assigned To</Label>
                                <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={userPopoverOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {formAssignedTo
                                                ? users?.find((u) => u.id === formAssignedTo)?.full_name ||
                                                users?.find((u) => u.id === formAssignedTo)?.username ||
                                                "Selected User"
                                                : "Select user..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search user..." />
                                            <CommandList className="max-h-48 overflow-y-auto touch-pan-y overscroll-contain">
                                                <CommandEmpty>No user found.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        value="__none__"
                                                        onSelect={() => {
                                                            setFormAssignedTo("");
                                                            setUserPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${formAssignedTo === "" ? "opacity-100" : "opacity-0"
                                                                }`}
                                                        />
                                                        None
                                                    </CommandItem>
                                                    {users?.map((user) => (
                                                        <CommandItem
                                                            key={user.id}
                                                            value={user.full_name || user.username || user.id}
                                                            onSelect={() => {
                                                                setFormAssignedTo(user.id);
                                                                setUserPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 ${formAssignedTo === user.id ? "opacity-100" : "opacity-0"
                                                                    }`}
                                                            />
                                                            {user.full_name || user.username || "Unknown User"}
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
                                            aria-expanded={locationPopoverOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {formLocationId
                                                ? locations?.find((l) => l.id === formLocationId)?.name ||
                                                "Selected Location"
                                                : "Select location..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search location..." />
                                            <CommandList className="max-h-48 overflow-y-auto touch-pan-y overscroll-contain">
                                                <CommandEmpty>No location found.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        value="__none__"
                                                        onSelect={() => {
                                                            setFormLocationId("");
                                                            setLocationPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${formLocationId === "" ? "opacity-100" : "opacity-0"
                                                                }`}
                                                        />
                                                        None
                                                    </CommandItem>
                                                    {locations?.map((loc) => (
                                                        <CommandItem
                                                            key={loc.id}
                                                            value={loc.name}
                                                            onSelect={() => {
                                                                setFormLocationId(loc.id);
                                                                setLocationPopoverOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={`mr-2 h-4 w-4 ${formLocationId === loc.id ? "opacity-100" : "opacity-0"
                                                                    }`}
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
                        </div>

                        <div className="space-y-2">
                            <Label>Image</Label>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 rounded-lg">
                                    <AvatarImage src={formImagePreview || undefined} />
                                    <AvatarFallback className="rounded-lg">
                                        <Monitor className="h-8 w-8" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => document.getElementById("assetImageInput")?.click()}
                                    >
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload
                                    </Button>
                                    {formImagePreview && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setFormImageFile(null);
                                                setFormImagePreview("");
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <input
                                    id="assetImageInput"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageChange}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={formNotes}
                                onChange={(e) => setFormNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={3}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => {
                                setIsAddOpen(false);
                                setIsEditOpen(false);
                            }}>
                                Cancel
                            </Button>
                            <Button onClick={isEditOpen ? handleUpdate : handleCreate} disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditOpen ? "Update" : "Create"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Asset</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{selectedAsset?.name}&quot;? This action cannot be undone.
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

            {/* QR Code Modal */}
            <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>QR Code</DialogTitle>
                        <DialogDescription>
                            Scan this QR code to view asset details
                        </DialogDescription>
                    </DialogHeader>
                    {selectedAsset && qrCodeData && (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <img
                                src={qrCodeData}
                                alt={`QR code for ${selectedAsset.name}`}
                                className="w-48 h-48"
                            />
                            <div className="text-center">
                                <p className="font-semibold">{selectedAsset.name}</p>
                                <p className="text-sm text-muted-foreground font-mono">{selectedAsset.asset_code}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const printContent = `
                                            <div style="width: 6cm; height: 6cm; padding: 0.5cm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-sizing: border-box;">
                                                <img src="${qrCodeData}" style="width: 4cm; height: 4cm;" />
                                                <div style="margin-top: 0.3cm;">
                                                    <p style="font-weight: bold; font-size: 10px; margin: 0;">${selectedAsset.name}</p>
                                                    <p style="font-size: 9px; color: #666; margin: 0; font-family: monospace;">${selectedAsset.asset_code}</p>
                                                </div>
                                            </div>
                                        `;
                                        const printWindow = window.open('', '_blank');
                                        if (printWindow) {
                                            printWindow.document.write(`
                                                <!DOCTYPE html>
                                                <html>
                                                <head>
                                                    <title>Print QR Label</title>
                                                    <style>
                                                        @page { size: 6cm 6cm; margin: 0; }
                                                        body { margin: 0; padding: 0; }
                                                    </style>
                                                </head>
                                                <body>${printContent}</body>
                                                </html>
                                            `);
                                            printWindow.document.close();
                                            printWindow.focus();
                                            setTimeout(() => {
                                                printWindow.print();
                                                printWindow.close();
                                            }, 250);
                                        }
                                    }}
                                >
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print Label
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
