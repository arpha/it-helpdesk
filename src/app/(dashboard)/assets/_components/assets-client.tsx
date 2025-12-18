"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataTable } from "@/hooks/use-data-table";
import { useAssets, Asset } from "@/hooks/api/use-assets";
import { useAllAssetCategories } from "@/hooks/api/use-asset-categories";
import { useDepartments } from "@/hooks/api/use-departments";
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

function calculateDepreciation(purchasePrice: number, purchaseDate: string | null, usefulLifeYears: number): { currentValue: number; depreciationPercent: number } {
    if (!purchaseDate || purchasePrice <= 0) {
        return { currentValue: purchasePrice, depreciationPercent: 0 };
    }

    const purchaseDateObj = new Date(purchaseDate);
    const now = new Date();
    const yearsUsed = (now.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365);

    const annualDepreciation = purchasePrice / usefulLifeYears;
    const totalDepreciation = Math.min(annualDepreciation * yearsUsed, purchasePrice);
    const currentValue = Math.max(0, purchasePrice - totalDepreciation);
    const depreciationPercent = (totalDepreciation / purchasePrice) * 100;

    return { currentValue, depreciationPercent: Math.min(depreciationPercent, 100) };
}

export default function AssetsClient() {
    const { page, limit, search, searchInput, setPage, setLimit, setSearch } = useDataTable();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");

    const { data: assetsData, isLoading } = useAssets({ page, limit, search, status: statusFilter, categoryId: categoryFilter });
    const { data: categories } = useAllAssetCategories();
    const { data: departments } = useDepartments();

    // Modal states
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Form states
    const [formAssetCode, setFormAssetCode] = useState("");
    const [formName, setFormName] = useState("");
    const [formCategoryId, setFormCategoryId] = useState("");
    const [formBrand, setFormBrand] = useState("");
    const [formModel, setFormModel] = useState("");
    const [formSerialNumber, setFormSerialNumber] = useState("");
    const [formPurchaseDate, setFormPurchaseDate] = useState("");
    const [formPurchasePrice, setFormPurchasePrice] = useState("");
    const [formWarrantyExpiry, setFormWarrantyExpiry] = useState("");
    const [formUsefulLife, setFormUsefulLife] = useState("5");
    const [formStatus, setFormStatus] = useState("active");
    const [formCondition, setFormCondition] = useState("good");
    const [formLocation, setFormLocation] = useState("");
    const [formDepartmentId, setFormDepartmentId] = useState("");
    const [formNotes, setFormNotes] = useState("");
    const [formImageFile, setFormImageFile] = useState<File | null>(null);
    const [formImagePreview, setFormImagePreview] = useState("");
    const [formImageUrl, setFormImageUrl] = useState("");

    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const resetForm = () => {
        setFormAssetCode("");
        setFormName("");
        setFormCategoryId("");
        setFormBrand("");
        setFormModel("");
        setFormSerialNumber("");
        setFormPurchaseDate("");
        setFormPurchasePrice("");
        setFormWarrantyExpiry("");
        setFormUsefulLife("5");
        setFormStatus("active");
        setFormCondition("good");
        setFormLocation("");
        setFormDepartmentId("");
        setFormNotes("");
        setFormImageFile(null);
        setFormImagePreview("");
        setFormImageUrl("");
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
        setFormBrand(asset.brand || "");
        setFormModel(asset.model || "");
        setFormSerialNumber(asset.serial_number || "");
        setFormPurchaseDate(asset.purchase_date || "");
        setFormPurchasePrice(asset.purchase_price.toString());
        setFormWarrantyExpiry(asset.warranty_expiry || "");
        setFormUsefulLife(asset.useful_life_years.toString());
        setFormStatus(asset.status);
        setFormCondition(asset.condition);
        setFormLocation(asset.location || "");
        setFormDepartmentId(asset.department_id || "");
        setFormNotes(asset.notes || "");
        setFormImageFile(null);
        setFormImagePreview(asset.image_url || "");
        setFormImageUrl(asset.image_url || "");
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
                brand: formBrand || undefined,
                model: formModel || undefined,
                serial_number: formSerialNumber || undefined,
                purchase_date: formPurchaseDate || undefined,
                purchase_price: parseFloat(formPurchasePrice) || 0,
                warranty_expiry: formWarrantyExpiry || undefined,
                useful_life_years: parseInt(formUsefulLife) || 5,
                status: formStatus,
                condition: formCondition,
                location: formLocation || undefined,
                department_id: formDepartmentId || undefined,
                image_url: imageUrl || undefined,
                notes: formNotes || undefined,
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
                brand: formBrand || undefined,
                model: formModel || undefined,
                serial_number: formSerialNumber || undefined,
                purchase_date: formPurchaseDate || undefined,
                purchase_price: parseFloat(formPurchasePrice) || 0,
                warranty_expiry: formWarrantyExpiry || undefined,
                useful_life_years: parseInt(formUsefulLife) || 5,
                status: formStatus,
                condition: formCondition,
                location: formLocation || undefined,
                department_id: formDepartmentId || undefined,
                image_url: imageUrl || undefined,
                notes: formNotes || undefined,
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
            const { currentValue, depreciationPercent } = calculateDepreciation(
                asset.purchase_price,
                asset.purchase_date,
                asset.useful_life_years
            );
            return {
                No: index + 1,
                "Asset Code": asset.asset_code,
                Name: asset.name,
                Category: asset.asset_categories?.name || "-",
                Brand: asset.brand || "-",
                Model: asset.model || "-",
                "Serial Number": asset.serial_number || "-",
                Status: statusLabels[asset.status],
                Condition: conditionLabels[asset.condition],
                Location: asset.location || "-",
                Department: asset.departments?.name || "-",
                "Purchase Date": asset.purchase_date || "-",
                "Purchase Price": asset.purchase_price,
                "Current Value": Math.round(currentValue),
                "Depreciation %": Math.round(depreciationPercent),
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
        XLSX.writeFile(workbook, `Assets_${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    const columns: Column<Asset>[] = [
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
                <span className="text-muted-foreground">{asset.location || "-"}</span>
            ),
        },
        {
            key: "value",
            header: "Value",
            cell: (asset) => {
                const { currentValue, depreciationPercent } = calculateDepreciation(
                    asset.purchase_price,
                    asset.purchase_date,
                    asset.useful_life_years
                );
                return (
                    <div>
                        <p className="font-medium">{formatCurrency(currentValue)}</p>
                        <p className="text-xs text-muted-foreground">
                            -{Math.round(depreciationPercent)}% depreciated
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
                        <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleOpenDelete(asset)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
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
                    <SelectTrigger className="w-40">
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
                searchPlaceholder="Search assets..."
                page={page}
                totalPages={assetsData?.totalPages || 1}
                totalItems={assetsData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="No assets found."
                toolbarAction={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExportExcel}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />Export Excel
                        </Button>
                        <Button onClick={handleOpenAdd}>
                            <Plus className="mr-2 h-4 w-4" />Add Asset
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
                                    <span className="text-muted-foreground">Brand / Model</span>
                                    <p className="font-medium">{selectedAsset.brand} {selectedAsset.model}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Serial Number</span>
                                    <p className="font-medium">{selectedAsset.serial_number || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Condition</span>
                                    <p className="font-medium">{conditionLabels[selectedAsset.condition]}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Location</span>
                                    <p className="font-medium">{selectedAsset.location || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Department</span>
                                    <p className="font-medium">{selectedAsset.departments?.name || "-"}</p>
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
                                        <span className="text-muted-foreground">Purchase Price</span>
                                        <p className="font-medium">{formatCurrency(selectedAsset.purchase_price)}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Current Value</span>
                                        <p className="font-medium text-green-600">
                                            {formatCurrency(
                                                calculateDepreciation(
                                                    selectedAsset.purchase_price,
                                                    selectedAsset.purchase_date,
                                                    selectedAsset.useful_life_years
                                                ).currentValue
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Depreciation</span>
                                        <p className="font-medium text-red-500">
                                            {Math.round(
                                                calculateDepreciation(
                                                    selectedAsset.purchase_price,
                                                    selectedAsset.purchase_date,
                                                    selectedAsset.useful_life_years
                                                ).depreciationPercent
                                            )}%
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
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEditOpen ? "Edit Asset" : "Add New Asset"}</DialogTitle>
                        <DialogDescription>
                            {isEditOpen ? "Update asset details" : "Create a new asset"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                        {message && (
                            <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
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

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Brand</Label>
                                <Input
                                    value={formBrand}
                                    onChange={(e) => setFormBrand(e.target.value)}
                                    placeholder="e.g., Dell"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Model</Label>
                                <Input
                                    value={formModel}
                                    onChange={(e) => setFormModel(e.target.value)}
                                    placeholder="e.g., Latitude 5520"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Serial Number</Label>
                                <Input
                                    value={formSerialNumber}
                                    onChange={(e) => setFormSerialNumber(e.target.value)}
                                    placeholder="S/N"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Purchase Date</Label>
                                <Input
                                    type="date"
                                    value={formPurchaseDate}
                                    onChange={(e) => setFormPurchaseDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Purchase Price</Label>
                                <Input
                                    type="number"
                                    value={formPurchasePrice}
                                    onChange={(e) => setFormPurchasePrice(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Warranty Expiry</Label>
                                <Input
                                    type="date"
                                    value={formWarrantyExpiry}
                                    onChange={(e) => setFormWarrantyExpiry(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
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
                            <div className="space-y-2">
                                <Label>Condition</Label>
                                <Select value={formCondition} onValueChange={setFormCondition}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="good">Good</SelectItem>
                                        <SelectItem value="fair">Fair</SelectItem>
                                        <SelectItem value="poor">Poor</SelectItem>
                                    </SelectContent>
                                </Select>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Location</Label>
                                <Input
                                    value={formLocation}
                                    onChange={(e) => setFormLocation(e.target.value)}
                                    placeholder="e.g., Room 201"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Department</Label>
                                <Select value={formDepartmentId} onValueChange={setFormDepartmentId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments?.map((dept) => (
                                            <SelectItem key={dept.id} value={dept.id}>
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
        </>
    );
}
