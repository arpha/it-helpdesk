"use client";

import { DataTable, Column } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { useATKItems, ATKItem } from "@/hooks/api/use-atk-items";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Pencil, Trash2, Eye, Loader2, Check, Plus, Upload, X, Package, FileSpreadsheet, Download, Search } from "lucide-react";
import { useState, useTransition, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createItem, updateItem, deleteItem, uploadItemImage, bulkImportItems } from "../actions";
import * as XLSX from "xlsx";

const typeLabels: Record<string, string> = {
    atk: "ATK",
    sparepart: "Sparepart",
};

const typeColors: Record<string, string> = {
    atk: "bg-blue-500/10 text-blue-500",
    sparepart: "bg-orange-500/10 text-orange-500",
};

const unitOptions = ["pcs", "box", "rim", "pack", "unit", "set", "roll", "lembar"];

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function ItemsClient() {
    const { page, limit, search, searchInput, setPage, setLimit, setSearch } = useDataTable();
    const queryClient = useQueryClient();
    const [typeFilter, setTypeFilter] = useState<"atk" | "sparepart" | "all">("all");
    const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("all");

    const { data: itemsData, isLoading } = useATKItems({ page, limit, search, type: typeFilter, status: statusFilter });

    // Modal states
    const [selectedItem, setSelectedItem] = useState<ATKItem | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Form states
    const [formType, setFormType] = useState<"atk" | "sparepart">("atk");
    const [formName, setFormName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formUnit, setFormUnit] = useState("pcs");
    const [formPrice, setFormPrice] = useState("");
    const [formMinStock, setFormMinStock] = useState("5");
    const [formImageFile, setFormImageFile] = useState<File | null>(null);
    const [formImagePreview, setFormImagePreview] = useState("");
    const [formImageUrl, setFormImageUrl] = useState("");
    const [formIsActive, setFormIsActive] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importResult, setImportResult] = useState<{
        imported: number;
        failed: number;
        errors: string[];
        details: {
            name: string;
            type: string;
            unit: string;
            price: number;
            stock: number;
            status: "success" | "failed";
            error?: string;
        }[];
    } | null>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormImageFile(file);
            const reader = new FileReader();
            reader.onload = (e) => setFormImagePreview(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const resetForm = () => {
        setFormType("atk");
        setFormName("");
        setFormDescription("");
        setFormUnit("pcs");
        setFormPrice("");
        setFormMinStock("5");
        setFormImageFile(null);
        setFormImagePreview("");
        setFormImageUrl("");
        setFormIsActive(true);
        setMessage(null);
    };

    const handleView = (item: ATKItem) => {
        setSelectedItem(item);
        setIsViewOpen(true);
    };

    const handleEdit = (item: ATKItem) => {
        setSelectedItem(item);
        setFormType(item.type);
        setFormName(item.name);
        setFormDescription(item.description || "");
        setFormUnit(item.unit);
        setFormPrice(item.price.toString());
        setFormMinStock(item.min_stock.toString());
        setFormImageFile(null);
        setFormImagePreview(item.image_url || "");
        setFormImageUrl(item.image_url || "");
        setFormIsActive(item.is_active);
        setMessage(null);
        setIsEditOpen(true);
    };

    const handleDelete = (item: ATKItem) => {
        setSelectedItem(item);
        setIsDeleteOpen(true);
    };

    const handleOpenAdd = () => {
        resetForm();
        setIsAddOpen(true);
    };

    const handleExportExcel = () => {
        if (!itemsData?.data || itemsData.data.length === 0) return;

        const data = itemsData.data.map((item, index) => ({
            No: index + 1,
            "Nama Barang": item.name,
            Tipe: typeLabels[item.type] || item.type,
            Satuan: item.unit,
            Harga: item.price,
            Stock: item.stock_quantity,
            "Min Stock": item.min_stock,
            Status: item.is_active ? "Aktif" : "Non-Aktif",
            Deskripsi: item.description || "-",
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "ATK Items");

        // Set column widths
        worksheet["!cols"] = [
            { wch: 5 },  // No
            { wch: 30 }, // Nama Barang
            { wch: 12 }, // Tipe
            { wch: 10 }, // Satuan
            { wch: 15 }, // Harga
            { wch: 10 }, // Stock
            { wch: 10 }, // Min Stock
            { wch: 12 }, // Status
            { wch: 30 }, // Deskripsi
        ];

        XLSX.writeFile(workbook, `ATK_Items_${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    const handleDownloadTemplate = () => {
        const templateData = [
            {
                "Nama Barang": "Contoh Item 1",
                Tipe: "atk",
                Satuan: "pcs",
                Harga: 10000,
                Stock: 100,
                "Min Stock": 10,
                Status: "Aktif",
                Deskripsi: "Deskripsi opsional",
            },
            {
                "Nama Barang": "Contoh Item 2",
                Tipe: "sparepart",
                Satuan: "unit",
                Harga: 50000,
                Stock: 20,
                "Min Stock": 5,
                Status: "Aktif",
                Deskripsi: "",
            },
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Template Import");

        worksheet["!cols"] = [
            { wch: 30 }, // Nama Barang
            { wch: 12 }, // Tipe (atk/sparepart)
            { wch: 10 }, // Satuan
            { wch: 15 }, // Harga
            { wch: 10 }, // Stock
            { wch: 10 }, // Min Stock
            { wch: 12 }, // Status (Aktif/Non-Aktif)
            { wch: 30 }, // Deskripsi
        ];

        XLSX.writeFile(workbook, "Template_Import_ATK.xlsx");
    };

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportResult(null);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

                if (jsonData.length === 0) {
                    setImportResult({ imported: 0, failed: 0, errors: ["File tidak memiliki data"], details: [] });
                    setIsImportOpen(true);
                    return;
                }

                // Map Excel columns to item fields
                const items = jsonData.map((row) => ({
                    name: String(row["Nama Barang"] || ""),
                    type: (String(row["Tipe"] || "atk").toLowerCase() === "sparepart" ? "sparepart" : "atk") as "atk" | "sparepart",
                    unit: String(row["Satuan"] || "pcs"),
                    price: Number(row["Harga"]) || 0,
                    stock_quantity: Number(row["Stock"]) || 0,
                    min_stock: Number(row["Min Stock"]) || 5,
                    is_active: String(row["Status"] || "Aktif").toLowerCase() !== "non-aktif",
                    description: row["Deskripsi"] ? String(row["Deskripsi"]) : null,
                }));

                startTransition(async () => {
                    const result = await bulkImportItems(items);
                    setImportResult(result);
                    setIsImportOpen(true);
                    queryClient.invalidateQueries({ queryKey: ["atk-items"] });
                });
            } catch (error) {
                setImportResult({
                    imported: 0,
                    failed: 0,
                    errors: [`Error parsing file: ${error instanceof Error ? error.message : "Unknown error"}`],
                    details: [],
                });
                setIsImportOpen(true);
            }
        };
        reader.readAsArrayBuffer(file);

        // Reset input
        e.target.value = "";
    };

    const handleSaveAdd = () => {
        setMessage(null);
        if (!formName || !formUnit || !formPrice) {
            setMessage({ type: "error", text: "Please fill required fields" });
            return;
        }

        startTransition(async () => {
            let imageUrl: string | null = null;

            if (formImageFile) {
                const formData = new FormData();
                formData.append("file", formImageFile);
                formData.append("itemId", Date.now().toString());
                const uploadResult = await uploadItemImage(formData);
                if (!uploadResult.success) {
                    setMessage({ type: "error", text: uploadResult.error || "Upload failed" });
                    return;
                }
                imageUrl = uploadResult.url || null;
            }

            const result = await createItem({
                type: formType,
                name: formName,
                description: formDescription || null,
                unit: formUnit,
                price: parseFloat(formPrice),
                min_stock: parseInt(formMinStock) || 5,
                image_url: imageUrl,
                is_active: formIsActive,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Item created!" });
                queryClient.invalidateQueries({ queryKey: ["atk-items"] });
                setTimeout(() => setIsAddOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleSaveEdit = () => {
        if (!selectedItem) return;
        setMessage(null);
        if (!formName || !formUnit || !formPrice) {
            setMessage({ type: "error", text: "Please fill required fields" });
            return;
        }

        startTransition(async () => {
            let imageUrl: string | undefined = undefined;

            if (formImageFile) {
                const formData = new FormData();
                formData.append("file", formImageFile);
                formData.append("itemId", selectedItem.id);
                const uploadResult = await uploadItemImage(formData);
                if (!uploadResult.success) {
                    setMessage({ type: "error", text: uploadResult.error || "Upload failed" });
                    return;
                }
                imageUrl = uploadResult.url;
            }

            const result = await updateItem({
                id: selectedItem.id,
                type: formType,
                name: formName,
                description: formDescription || null,
                unit: formUnit,
                price: parseFloat(formPrice),
                min_stock: parseInt(formMinStock) || 5,
                image_url: imageUrl || formImageUrl || null,
                is_active: formIsActive,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Item updated!" });
                queryClient.invalidateQueries({ queryKey: ["atk-items"] });
                setTimeout(() => setIsEditOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleConfirmDelete = () => {
        if (!selectedItem) return;
        startTransition(async () => {
            const result = await deleteItem(selectedItem.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["atk-items"] });
                setIsDeleteOpen(false);
            } else {
                alert(result.error || "Failed");
            }
        });
    };

    const columns: Column<ATKItem>[] = [
        {
            key: "item",
            header: "Item",
            cell: (row) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-lg">
                        <AvatarImage src={row.image_url || undefined} />
                        <AvatarFallback className="rounded-lg">
                            <Package className="h-5 w-5" />
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.unit}</p>
                    </div>
                </div>
            ),
        },
        {
            key: "type",
            header: "Type",
            cell: (row) => (
                <Badge variant="secondary" className={typeColors[row.type]}>
                    {typeLabels[row.type]}
                </Badge>
            ),
        },
        {
            key: "price",
            header: "Price",
            cell: (row) => <span>{formatCurrency(row.price)}</span>,
        },
        {
            key: "stock",
            header: "Stock",
            cell: (row) => (
                <span className={row.stock_quantity <= row.min_stock ? "text-destructive font-medium" : ""}>
                    {row.stock_quantity}
                </span>
            ),
        },
        {
            key: "status",
            header: "Status",
            cell: (row) => (
                <Badge variant="secondary" className={row.is_active ? "bg-green-500/10 text-green-600" : "bg-gray-500/10 text-gray-500"}>
                    {row.is_active ? "Aktif" : "Non-Aktif"}
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
                            <Eye className="mr-2 h-4 w-4" />View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(row)} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(row)} className="text-destructive cursor-pointer">
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    const ItemForm = ({ isEdit = false }: { isEdit?: boolean }) => (
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            {message && (
                <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                    {message.text}
                </div>
            )}

            <div className="space-y-2">
                <Label>Image</Label>
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 rounded-lg">
                        <AvatarImage src={formImagePreview || undefined} />
                        <AvatarFallback className="rounded-lg"><Package className="h-8 w-8" /></AvatarFallback>
                    </Avatar>
                    <div className="flex gap-2">
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2 h-4 w-4" />Upload
                        </Button>
                        {formImageFile && (
                            <Button type="button" variant="outline" size="sm" onClick={() => { setFormImageFile(null); setFormImagePreview(formImageUrl); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select value={formType} onValueChange={(v) => setFormType(v as "atk" | "sparepart")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="atk">ATK</SelectItem>
                            <SelectItem value="sparepart">Sparepart</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Unit *</Label>
                    <Select value={formUnit} onValueChange={setFormUnit}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Item name" />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="price">Price (Rp) *</Label>
                    <Input id="price" type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="min_stock">Min Stock</Label>
                    <Input id="min_stock" type="number" value={formMinStock} onChange={(e) => setFormMinStock(e.target.value)} />
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => isEdit ? setIsEditOpen(false) : setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={isEdit ? handleSaveEdit : handleSaveAdd} disabled={isPending}>
                    {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Check className="mr-2 h-4 w-4" />Save</>}
                </Button>
            </div>
        </div>
    );

    return (
        <>
            <div className="flex items-center gap-4 mb-4">
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "atk" | "sparepart" | "all")}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Filter type" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="atk">ATK</SelectItem>
                        <SelectItem value="sparepart">Sparepart</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "active" | "inactive" | "all")}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Filter status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="inactive">Non-Aktif</SelectItem>
                    </SelectContent>
                </Select>
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search items..."
                        value={searchInput}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <DataTable
                columns={columns}
                data={itemsData?.data || []}
                isLoading={isLoading}
                page={page}
                totalPages={itemsData?.totalPages || 1}
                totalItems={itemsData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="No items found."
                toolbarAction={
                    <div className="flex gap-2">
                        <input
                            ref={importInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleImportExcel}
                        />
                        <Button variant="outline" onClick={handleDownloadTemplate}>
                            <Download className="mr-2 h-4 w-4" />Template
                        </Button>
                        <Button variant="outline" onClick={() => importInputRef.current?.click()} disabled={isPending}>
                            <Upload className="mr-2 h-4 w-4" />{isPending ? "Importing..." : "Import Excel"}
                        </Button>
                        <Button variant="outline" onClick={handleExportExcel}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />Export Excel
                        </Button>
                        <Button onClick={handleOpenAdd}>
                            <Plus className="mr-2 h-4 w-4" />Add Item
                        </Button>
                    </div>
                }
            />

            {/* Add Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New Item</DialogTitle>
                        <DialogDescription>Create a new ATK or Sparepart item</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                        {message && (
                            <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Image</Label>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 rounded-lg">
                                    <AvatarImage src={formImagePreview || undefined} />
                                    <AvatarFallback className="rounded-lg"><Package className="h-8 w-8" /></AvatarFallback>
                                </Avatar>
                                <div className="flex gap-2">
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="mr-2 h-4 w-4" />Upload
                                    </Button>
                                    {formImageFile && (
                                        <Button type="button" variant="outline" size="sm" onClick={() => { setFormImageFile(null); setFormImagePreview(formImageUrl); }}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type *</Label>
                                <Select value={formType} onValueChange={(v) => setFormType(v as "atk" | "sparepart")}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="atk">ATK</SelectItem>
                                        <SelectItem value="sparepart">Sparepart</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Unit *</Label>
                                <Select value={formUnit} onValueChange={setFormUnit}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_name">Name *</Label>
                            <Input id="add_name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Item name" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_description">Description</Label>
                            <Textarea id="add_description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="add_price">Price (Rp) *</Label>
                                <Input id="add_price" type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="add_min_stock">Min Stock</Label>
                                <Input id="add_min_stock" type="number" value={formMinStock} onChange={(e) => setFormMinStock(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={formIsActive ? "active" : "inactive"} onValueChange={(v) => setFormIsActive(v === "active")}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Aktif</SelectItem>
                                    <SelectItem value="inactive">Non-Aktif</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveAdd} disabled={isPending}>
                                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Check className="mr-2 h-4 w-4" />Save</>}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Modal */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Item Details</DialogTitle>
                        <DialogDescription>View item information</DialogDescription>
                    </DialogHeader>
                    {selectedItem && (
                        <div className="space-y-4 py-4">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 rounded-lg">
                                    <AvatarImage src={selectedItem.image_url || undefined} />
                                    <AvatarFallback className="rounded-lg"><Package className="h-8 w-8" /></AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium text-lg">{selectedItem.name}</p>
                                    <Badge variant="secondary" className={typeColors[selectedItem.type]}>{typeLabels[selectedItem.type]}</Badge>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Unit</span><span>{selectedItem.unit}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span>{formatCurrency(selectedItem.price)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Stock</span><span>{selectedItem.stock_quantity}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Min Stock</span><span>{selectedItem.min_stock}</span></div>
                                {selectedItem.description && <div><span className="text-muted-foreground">Description:</span><p>{selectedItem.description}</p></div>}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Item</DialogTitle>
                        <DialogDescription>Update item information</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                        {message && (
                            <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Image</Label>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 rounded-lg">
                                    <AvatarImage src={formImagePreview || undefined} />
                                    <AvatarFallback className="rounded-lg"><Package className="h-8 w-8" /></AvatarFallback>
                                </Avatar>
                                <div className="flex gap-2">
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="mr-2 h-4 w-4" />Upload
                                    </Button>
                                    {formImageFile && (
                                        <Button type="button" variant="outline" size="sm" onClick={() => { setFormImageFile(null); setFormImagePreview(formImageUrl); }}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type *</Label>
                                <Select value={formType} onValueChange={(v) => setFormType(v as "atk" | "sparepart")}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="atk">ATK</SelectItem>
                                        <SelectItem value="sparepart">Sparepart</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Unit *</Label>
                                <Select value={formUnit} onValueChange={setFormUnit}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_name">Name *</Label>
                            <Input id="edit_name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Item name" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_description">Description</Label>
                            <Textarea id="edit_description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit_price">Price (Rp) *</Label>
                                <Input id="edit_price" type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit_min_stock">Min Stock</Label>
                                <Input id="edit_min_stock" type="number" value={formMinStock} onChange={(e) => setFormMinStock(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={formIsActive ? "active" : "inactive"} onValueChange={(v) => setFormIsActive(v === "active")}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Aktif</SelectItem>
                                    <SelectItem value="inactive">Non-Aktif</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveEdit} disabled={isPending}>
                                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Check className="mr-2 h-4 w-4" />Save</>}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Item</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{selectedItem?.name}</strong>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isPending}>
                            {isPending ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Import Result Modal */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Hasil Import</DialogTitle>
                        <DialogDescription>Ringkasan proses import data</DialogDescription>
                    </DialogHeader>
                    {importResult && (
                        <div className="space-y-4 py-4 overflow-hidden flex flex-col">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg bg-green-500/10 text-center">
                                    <p className="text-xl font-bold text-green-600">{importResult.imported}</p>
                                    <p className="text-xs text-muted-foreground">Berhasil</p>
                                </div>
                                <div className="p-3 rounded-lg bg-red-500/10 text-center">
                                    <p className="text-xl font-bold text-red-600">{importResult.failed}</p>
                                    <p className="text-xs text-muted-foreground">Gagal</p>
                                </div>
                            </div>

                            {importResult.details && importResult.details.length > 0 && (
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-medium mb-2">Detail Import:</p>
                                    <div className="border rounded-md overflow-auto max-h-[300px]">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium">No</th>
                                                    <th className="px-3 py-2 text-left font-medium">Nama Barang</th>
                                                    <th className="px-3 py-2 text-left font-medium">Tipe</th>
                                                    <th className="px-3 py-2 text-left font-medium">Satuan</th>
                                                    <th className="px-3 py-2 text-right font-medium">Harga</th>
                                                    <th className="px-3 py-2 text-right font-medium">Stock</th>
                                                    <th className="px-3 py-2 text-center font-medium">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {importResult.details.map((item, idx) => (
                                                    <tr key={idx} className={item.status === "failed" ? "bg-red-500/5" : ""}>
                                                        <td className="px-3 py-2">{idx + 1}</td>
                                                        <td className="px-3 py-2">
                                                            <div>
                                                                <p>{item.name}</p>
                                                                {item.error && (
                                                                    <p className="text-xs text-destructive">{item.error}</p>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Badge variant="secondary" className={item.type === "atk" ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500"}>
                                                                {item.type === "atk" ? "ATK" : "Sparepart"}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-2">{item.unit}</td>
                                                        <td className="px-3 py-2 text-right">{formatCurrency(item.price)}</td>
                                                        <td className="px-3 py-2 text-right">{item.stock}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            {item.status === "success" ? (
                                                                <Badge className="bg-green-500/10 text-green-600">Berhasil</Badge>
                                                            ) : (
                                                                <Badge className="bg-red-500/10 text-red-600">Gagal</Badge>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button onClick={() => setIsImportOpen(false)}>Tutup</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
