"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataTable } from "@/hooks/use-data-table";
import { usePurchaseRequests, ATKPurchaseRequest } from "@/hooks/api/use-purchase-requests";
import { useATKItems } from "@/hooks/api/use-atk-items";
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
import {
    MoreHorizontal,
    Eye,
    CheckCircle,
    XCircle,
    Send,
    Trash2,
    Plus,
    Loader2,
    X,
    FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
    createPurchaseRequest,
    updatePurchaseRequest,
    submitPurchaseRequest,
    markPurchaseSuccess,
    deletePurchaseRequest,
} from "../actions";

const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-500",
    process: "bg-yellow-500/10 text-yellow-600",
    success: "bg-green-500/10 text-green-600",
};

const statusLabels: Record<string, string> = {
    draft: "Draft",
    process: "Process",
    success: "Success",
};

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function PurchaseClient() {
    const { page, limit, setPage, setLimit } = useDataTable();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState("all");

    const { data: purchaseData, isLoading } = usePurchaseRequests({
        page,
        limit,
        status: statusFilter,
    });

    const { data: itemsData } = useATKItems({ page: 1, limit: 100 });

    // Modal states
    const [selectedPurchase, setSelectedPurchase] = useState<ATKPurchaseRequest | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isSuccessOpen, setIsSuccessOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Form states
    const [createTitle, setCreateTitle] = useState("");
    const [createNotes, setCreateNotes] = useState("");
    const [createItems, setCreateItems] = useState<{ item_id: string; quantity: number; unit_price: number }[]>([]);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    const handleView = (purchase: ATKPurchaseRequest) => {
        setSelectedPurchase(purchase);
        setIsViewOpen(true);
    };

    const handleOpenSuccess = (purchase: ATKPurchaseRequest) => {
        setSelectedPurchase(purchase);
        setMessage(null);
        setPhotoFile(null);
        setPhotoPreview(null);
        setIsSuccessOpen(true);
    };

    const handleOpenDelete = (purchase: ATKPurchaseRequest) => {
        setSelectedPurchase(purchase);
        setIsDeleteOpen(true);
    };

    const handleOpenEdit = (purchase: ATKPurchaseRequest) => {
        setSelectedPurchase(purchase);
        setCreateTitle(purchase.title);
        setCreateNotes(purchase.notes || "");
        setCreateItems(purchase.atk_purchase_items.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity,
            unit_price: item.price,
        })));
        setMessage(null);
        setIsEditOpen(true);
    };

    const handleOpenCreate = () => {
        setCreateTitle("");
        setCreateNotes("");
        setCreateItems([{ item_id: "", quantity: 1, unit_price: 0 }]);
        setMessage(null);
        setIsCreateOpen(true);
    };

    const addCreateItem = () => {
        setCreateItems([...createItems, { item_id: "", quantity: 1, unit_price: 0 }]);
    };

    const removeCreateItem = (index: number) => {
        setCreateItems(createItems.filter((_, i) => i !== index));
    };

    const updateCreateItem = (index: number, field: "item_id" | "quantity" | "unit_price", value: string | number) => {
        const updated = [...createItems];
        if (field === "item_id") {
            const selectedItem = itemsData?.data.find((i) => i.id === value);
            updated[index] = {
                ...updated[index],
                item_id: value as string,
                unit_price: selectedItem?.price || 0,
            };
        } else {
            updated[index] = { ...updated[index], [field]: value };
        }
        setCreateItems(updated);
    };

    const getTotalAmount = () => {
        return createItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    };

    const handleCreate = () => {
        setMessage(null);
        if (!createTitle.trim()) {
            setMessage({ type: "error", text: "Judul wajib diisi" });
            return;
        }
        const validItems = createItems.filter((item) => item.item_id && item.quantity > 0);
        if (validItems.length === 0) {
            setMessage({ type: "error", text: "Tambahkan minimal 1 item" });
            return;
        }

        startTransition(async () => {
            const result = await createPurchaseRequest({
                title: createTitle,
                notes: createNotes || undefined,
                items: validItems,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Purchase request created!" });
                queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
                setTimeout(() => setIsCreateOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleSubmit = (purchase: ATKPurchaseRequest) => {
        startTransition(async () => {
            const result = await submitPurchaseRequest(purchase.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
            }
        });
    };

    const handleEdit = () => {
        if (!selectedPurchase) return;
        setMessage(null);
        if (!createTitle.trim()) {
            setMessage({ type: "error", text: "Judul wajib diisi" });
            return;
        }
        const validItems = createItems.filter((item) => item.item_id && item.quantity > 0);
        if (validItems.length === 0) {
            setMessage({ type: "error", text: "Tambahkan minimal 1 item" });
            return;
        }

        startTransition(async () => {
            const result = await updatePurchaseRequest({
                purchase_id: selectedPurchase.id,
                title: createTitle,
                notes: createNotes || undefined,
                items: validItems,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Updated!" });
                queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
                setTimeout(() => setIsEditOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSuccess = () => {
        if (!selectedPurchase) return;
        setMessage(null);

        if (!photoFile || !photoPreview) {
            setMessage({ type: "error", text: "Foto barang wajib diupload" });
            return;
        }

        startTransition(async () => {
            const result = await markPurchaseSuccess({
                purchase_id: selectedPurchase.id,
                photo_data: photoPreview,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Success! Stock updated." });
                queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
                queryClient.invalidateQueries({ queryKey: ["atk-items"] });
                setTimeout(() => setIsSuccessOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleDelete = () => {
        if (!selectedPurchase) return;
        startTransition(async () => {
            const result = await deletePurchaseRequest(selectedPurchase.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
                setIsDeleteOpen(false);
            }
        });
    };

    const handleExportExcel = (purchase: ATKPurchaseRequest) => {
        const data = purchase.atk_purchase_items.map((item, index) => ({
            No: index + 1,
            "Nama Barang": item.atk_items?.name || "",
            Tipe: item.atk_items?.type?.toUpperCase() || "",
            Satuan: item.atk_items?.unit || "",
            Jumlah: item.quantity,
            "Harga Satuan": item.price,
            "Total Harga": item.subtotal,
        }));

        // Add total row
        data.push({
            No: "",
            "Nama Barang": "",
            Tipe: "",
            Satuan: "",
            Jumlah: "",
            "Harga Satuan": "TOTAL",
            "Total Harga": purchase.total_amount,
        } as any);

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Request");

        // Set column widths
        worksheet["!cols"] = [
            { wch: 5 },
            { wch: 30 },
            { wch: 12 },
            { wch: 10 },
            { wch: 10 },
            { wch: 15 },
            { wch: 15 },
        ];

        XLSX.writeFile(workbook, `Pengajuan_${purchase.title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    const columns: Column<ATKPurchaseRequest>[] = [
        {
            key: "title",
            header: "Title",
            cell: (row) => (
                <div>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">{row.creator?.full_name || "-"}</p>
                </div>
            ),
        },
        {
            key: "items",
            header: "Items",
            cell: (row) => <span className="text-sm">{row.atk_purchase_items.length} items</span>,
        },
        {
            key: "total",
            header: "Total",
            cell: (row) => <span className="font-medium">{formatCurrency(row.total_amount)}</span>,
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
                        <DropdownMenuItem onClick={() => handleExportExcel(row)} className="cursor-pointer">
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Export Excel
                        </DropdownMenuItem>
                        {row.status === "draft" && (
                            <>
                                <DropdownMenuItem onClick={() => handleOpenEdit(row)} className="cursor-pointer">
                                    <Eye className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSubmit(row)} className="cursor-pointer text-blue-600">
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenDelete(row)} className="cursor-pointer text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </>
                        )}
                        {row.status === "process" && (
                            <DropdownMenuItem onClick={() => handleOpenSuccess(row)} className="cursor-pointer text-green-600">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark Success
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
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="process">Process</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                columns={columns}
                data={purchaseData?.data || []}
                isLoading={isLoading}
                page={page}
                totalPages={purchaseData?.totalPages || 1}
                totalItems={purchaseData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="No purchase requests found."
                toolbarAction={
                    <Button onClick={handleOpenCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Purchase
                    </Button>
                }
            />

            {/* Create Purchase Modal */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>New Purchase Request</DialogTitle>
                        <DialogDescription>Create a new purchase request for ATK/Sparepart</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                        {message && (
                            <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="create_title">Title *</Label>
                            <Input
                                id="create_title"
                                value={createTitle}
                                onChange={(e) => setCreateTitle(e.target.value)}
                                placeholder="e.g., Pengajuan ATK Bulan Desember"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Items *</Label>
                            <div className="space-y-2">
                                {createItems.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <Select value={item.item_id} onValueChange={(v) => updateCreateItem(index, "item_id", v)}>
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Select item" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {itemsData?.data.map((i) => (
                                                    <SelectItem key={i.id} value={i.id}>
                                                        {i.name} - {formatCurrency(i.price)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => updateCreateItem(index, "quantity", parseInt(e.target.value) || 1)}
                                            className="w-20"
                                            placeholder="Qty"
                                        />
                                        <Input
                                            type="number"
                                            min="0"
                                            value={item.unit_price}
                                            onChange={(e) => updateCreateItem(index, "unit_price", parseInt(e.target.value) || 0)}
                                            className="w-32"
                                            placeholder="Price"
                                        />
                                        <span className="text-sm w-28 text-right">{formatCurrency(item.quantity * item.unit_price)}</span>
                                        {createItems.length > 1 && (
                                            <Button variant="ghost" size="icon" onClick={() => removeCreateItem(index)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center">
                                <Button variant="outline" size="sm" onClick={addCreateItem}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Item
                                </Button>
                                <span className="font-medium">Total: {formatCurrency(getTotalAmount())}</span>
                            </div>
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
                                Create
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Purchase Modal */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Purchase Request Details</DialogTitle>
                        <DialogDescription>View purchase request information</DialogDescription>
                    </DialogHeader>
                    {selectedPurchase && (
                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Title</span>
                                    <p className="font-medium">{selectedPurchase.title}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Created By</span>
                                    <p>{selectedPurchase.creator?.full_name || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Status</span>
                                    <Badge variant="secondary" className={statusColors[selectedPurchase.status]}>
                                        {statusLabels[selectedPurchase.status]}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Total</span>
                                    <p className="font-medium">{formatCurrency(selectedPurchase.total_amount)}</p>
                                </div>
                            </div>

                            <div>
                                <span className="text-muted-foreground text-sm">Items</span>
                                <div className="mt-2 border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted">
                                            <tr>
                                                <th className="text-left p-2">Item</th>
                                                <th className="text-right p-2">Qty</th>
                                                <th className="text-right p-2">Price</th>
                                                <th className="text-right p-2">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedPurchase.atk_purchase_items.map((item) => (
                                                <tr key={item.id} className="border-t">
                                                    <td className="p-2">{item.atk_items?.name}</td>
                                                    <td className="p-2 text-right">{item.quantity}</td>
                                                    <td className="p-2 text-right">{formatCurrency(item.price)}</td>
                                                    <td className="p-2 text-right">{formatCurrency(item.subtotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {selectedPurchase.notes && (
                                <div>
                                    <span className="text-muted-foreground text-sm">Notes</span>
                                    <p className="mt-1">{selectedPurchase.notes}</p>
                                </div>
                            )}

                            {selectedPurchase.approval_signature_url && (
                                <div>
                                    <span className="text-muted-foreground text-sm">Approval Signature</span>
                                    <img
                                        src={selectedPurchase.approval_signature_url}
                                        alt="Signature"
                                        className="mt-2 border rounded max-h-24"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Approved by {selectedPurchase.approver?.full_name} on{" "}
                                        {selectedPurchase.approved_at
                                            ? new Date(selectedPurchase.approved_at).toLocaleDateString("id-ID")
                                            : ""}
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button variant="outline" onClick={() => handleExportExcel(selectedPurchase)}>
                                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                                    Export Excel
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Purchase Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Purchase Request</DialogTitle>
                        <DialogDescription>Update purchase request details</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                        {message && (
                            <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="edit_title">Title *</Label>
                            <Input
                                id="edit_title"
                                value={createTitle}
                                onChange={(e) => setCreateTitle(e.target.value)}
                                placeholder="e.g., Pengajuan ATK Bulan Desember"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Items *</Label>
                            <div className="space-y-2">
                                {createItems.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <Select value={item.item_id} onValueChange={(v) => updateCreateItem(index, "item_id", v)}>
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Select item" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {itemsData?.data.map((i) => (
                                                    <SelectItem key={i.id} value={i.id}>
                                                        {i.name} - {formatCurrency(i.price)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => updateCreateItem(index, "quantity", parseInt(e.target.value) || 1)}
                                            className="w-20"
                                            placeholder="Qty"
                                        />
                                        <Input
                                            type="number"
                                            min="0"
                                            value={item.unit_price}
                                            onChange={(e) => updateCreateItem(index, "unit_price", parseInt(e.target.value) || 0)}
                                            className="w-32"
                                            placeholder="Price"
                                        />
                                        <span className="text-sm w-28 text-right">{formatCurrency(item.quantity * item.unit_price)}</span>
                                        {createItems.length > 1 && (
                                            <Button variant="ghost" size="icon" onClick={() => removeCreateItem(index)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center">
                                <Button variant="outline" size="sm" onClick={addCreateItem}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Item
                                </Button>
                                <span className="font-medium">Total: {formatCurrency(getTotalAmount())}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_notes">Notes</Label>
                            <Textarea
                                id="edit_notes"
                                value={createNotes}
                                onChange={(e) => setCreateNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={2}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleEdit} disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                Update
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Mark Success Modal */}
            <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Mark as Success</DialogTitle>
                        <DialogDescription>Upload foto barang yang sudah diterima</DialogDescription>
                    </DialogHeader>
                    {selectedPurchase && (
                        <div className="space-y-4 py-4">
                            {message && (
                                <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                    {message.text}
                                </div>
                            )}

                            <div className="bg-muted rounded p-3">
                                <p className="font-medium">{selectedPurchase.title}</p>
                                <p className="text-sm text-muted-foreground">
                                    {selectedPurchase.atk_purchase_items.length} items • {formatCurrency(selectedPurchase.total_amount)}
                                </p>
                            </div>

                            <div className="text-sm text-muted-foreground">
                                📸 Upload foto barang yang sudah diterima
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="photo_upload">Foto Barang *</Label>
                                <Input
                                    id="photo_upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    className="cursor-pointer"
                                />
                                {photoPreview && (
                                    <div className="mt-2">
                                        <img
                                            src={photoPreview}
                                            alt="Preview"
                                            className="max-h-48 rounded border object-contain"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setIsSuccessOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSuccess} disabled={isPending || !photoFile} className="bg-green-600 hover:bg-green-700">
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                    Mark Success
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Purchase Modal */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Purchase Request</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this purchase request? This action cannot be undone.
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
