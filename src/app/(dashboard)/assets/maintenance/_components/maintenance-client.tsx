"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAssetMaintenance, AssetMaintenance } from "@/hooks/api/use-asset-maintenance";
import { useAssets } from "@/hooks/api/use-assets";
import { useITUsers } from "@/hooks/api/use-all-users";
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
import { MoreHorizontal, Pencil, Trash2, Plus, Loader2, Wrench } from "lucide-react";
import { createMaintenance, updateMaintenance, deleteMaintenance } from "../actions";

const typeLabels: Record<string, string> = {
    repair: "Repair",
    upgrade: "Upgrade",
    cleaning: "Cleaning",
    inspection: "Inspection",
};

const typeColors: Record<string, string> = {
    repair: "bg-red-500/10 text-red-500",
    upgrade: "bg-blue-500/10 text-blue-500",
    cleaning: "bg-green-500/10 text-green-500",
    inspection: "bg-yellow-500/10 text-yellow-500",
};

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function MaintenanceClient() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [search, setSearch] = useState("");

    const { data: maintenanceData, isLoading } = useAssetMaintenance({ page, limit, search });
    const { data: assetsData } = useAssets({ page: 1, limit: 200 });
    const { data: usersData } = useITUsers();

    // Modal states
    const [selectedMaintenance, setSelectedMaintenance] = useState<AssetMaintenance | null>(null);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Form states
    const [formAssetId, setFormAssetId] = useState("");
    const [formType, setFormType] = useState("repair");
    const [formDescription, setFormDescription] = useState("");
    const [formCost, setFormCost] = useState("");
    const [formPerformedBy, setFormPerformedBy] = useState("");
    const [formPerformedAt, setFormPerformedAt] = useState("");
    const [formNextMaintenance, setFormNextMaintenance] = useState("");
    const [formNotes, setFormNotes] = useState("");
    const [assetSearch, setAssetSearch] = useState("");

    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Filter assets based on search
    const filteredAssets = assetsData?.data?.filter((asset) => {
        const search = assetSearch.toLowerCase();
        return (
            asset.name.toLowerCase().includes(search) ||
            asset.asset_code.toLowerCase().includes(search) ||
            (asset.location?.toLowerCase().includes(search) ?? false)
        );
    }) || [];

    const resetForm = () => {
        setFormAssetId("");
        setFormType("repair");
        setFormDescription("");
        setFormCost("");
        setFormPerformedBy("");
        setFormPerformedAt("");
        setFormNextMaintenance("");
        setFormNotes("");
        setMessage(null);
    };

    const handleOpenAdd = () => {
        resetForm();
        setFormPerformedAt(new Date().toISOString().split("T")[0]);
        setIsAddOpen(true);
    };

    const handleOpenEdit = (maintenance: AssetMaintenance) => {
        setSelectedMaintenance(maintenance);
        setFormAssetId(maintenance.asset_id);
        setFormType(maintenance.type);
        setFormDescription(maintenance.description || "");
        setFormCost(maintenance.cost.toString());
        setFormPerformedBy(maintenance.performed_by || "");
        setFormPerformedAt(maintenance.performed_at || "");
        setFormNextMaintenance(maintenance.next_maintenance || "");
        setFormNotes(maintenance.notes || "");
        setMessage(null);
        setIsEditOpen(true);
    };

    const handleOpenDelete = (maintenance: AssetMaintenance) => {
        setSelectedMaintenance(maintenance);
        setIsDeleteOpen(true);
    };

    const handleCreate = () => {
        setMessage(null);
        if (!formAssetId) {
            setMessage({ type: "error", text: "Please select an asset" });
            return;
        }

        startTransition(async () => {
            const result = await createMaintenance({
                asset_id: formAssetId,
                type: formType,
                description: formDescription || undefined,
                cost: parseFloat(formCost) || 0,
                performed_by: formPerformedBy || undefined,
                performed_at: formPerformedAt || undefined,
                next_maintenance: formNextMaintenance || undefined,
                notes: formNotes || undefined,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Maintenance record created!" });
                queryClient.invalidateQueries({ queryKey: ["asset-maintenance"] });
                setTimeout(() => setIsAddOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleUpdate = () => {
        if (!selectedMaintenance) return;
        setMessage(null);
        if (!formAssetId) {
            setMessage({ type: "error", text: "Please select an asset" });
            return;
        }

        startTransition(async () => {
            const result = await updateMaintenance({
                id: selectedMaintenance.id,
                asset_id: formAssetId,
                type: formType,
                description: formDescription || undefined,
                cost: parseFloat(formCost) || 0,
                performed_by: formPerformedBy || undefined,
                performed_at: formPerformedAt || undefined,
                next_maintenance: formNextMaintenance || undefined,
                notes: formNotes || undefined,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Maintenance record updated!" });
                queryClient.invalidateQueries({ queryKey: ["asset-maintenance"] });
                setTimeout(() => setIsEditOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleDelete = () => {
        if (!selectedMaintenance) return;
        startTransition(async () => {
            const result = await deleteMaintenance(selectedMaintenance.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["asset-maintenance"] });
                setIsDeleteOpen(false);
            }
        });
    };

    const columns: Column<AssetMaintenance>[] = [
        {
            key: "asset",
            header: "Asset",
            cell: (maintenance) => (
                <div>
                    <p className="font-medium">{maintenance.assets?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground">{maintenance.assets?.asset_code}</p>
                </div>
            ),
        },
        {
            key: "type",
            header: "Type",
            cell: (maintenance) => (
                <Badge className={typeColors[maintenance.type]}>
                    {typeLabels[maintenance.type]}
                </Badge>
            ),
        },
        {
            key: "description",
            header: "Description",
            cell: (maintenance) => (
                <span className="text-muted-foreground line-clamp-1">
                    {maintenance.description || "-"}
                </span>
            ),
        },
        {
            key: "cost",
            header: "Cost",
            cell: (maintenance) => (
                <span className="font-medium">{formatCurrency(maintenance.cost)}</span>
            ),
        },
        {
            key: "performed_at",
            header: "Date",
            cell: (maintenance) => (
                <span className="text-muted-foreground">
                    {maintenance.performed_at
                        ? new Date(maintenance.performed_at).toLocaleDateString("id-ID")
                        : "-"}
                </span>
            ),
        },
        {
            key: "actions",
            header: "",
            className: "w-12",
            cell: (maintenance) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleOpenEdit(maintenance)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleOpenDelete(maintenance)}
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
            <DataTable
                columns={columns}
                data={maintenanceData?.data || []}
                isLoading={isLoading}
                page={page}
                totalPages={maintenanceData?.totalPages || 1}
                totalItems={maintenanceData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="No maintenance records found."
                searchValue={search}
                onSearchChange={(value) => {
                    setSearch(value);
                    setPage(1);
                }}
                searchPlaceholder="Search by asset name or code..."
            />

            {/* Add/Edit Modal */}
            <Dialog open={isAddOpen || isEditOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsAddOpen(false);
                    setIsEditOpen(false);
                }
            }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{isEditOpen ? "Edit Maintenance" : "Add Maintenance"}</DialogTitle>
                        <DialogDescription>
                            {isEditOpen ? "Update maintenance record" : "Record a new maintenance activity"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                        {message && (
                            <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Asset *</Label>
                            <Select value={formAssetId} onValueChange={setFormAssetId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih asset..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {assetsData?.data?.map((asset) => (
                                        <SelectItem key={asset.id} value={asset.id}>
                                            {asset.name} - {asset.locations?.name || "No location"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {formAssetId && (
                                <div className="p-3 rounded-md bg-muted text-sm">
                                    <p className="font-medium">{assetsData?.data?.find(a => a.id === formAssetId)?.name}</p>
                                    <p className="text-muted-foreground">
                                        {assetsData?.data?.find(a => a.id === formAssetId)?.locations?.name || "No location"}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type *</Label>
                                <Select value={formType} onValueChange={setFormType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="repair">Repair</SelectItem>
                                        <SelectItem value="upgrade">Upgrade</SelectItem>
                                        <SelectItem value="cleaning">Cleaning</SelectItem>
                                        <SelectItem value="inspection">Inspection</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Cost</Label>
                                <Input
                                    type="number"
                                    value={formCost}
                                    onChange={(e) => setFormCost(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="What was done..."
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Performed By</Label>
                                <Select value={formPerformedBy} onValueChange={setFormPerformedBy}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih teknisi..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {usersData?.map((user) => (
                                            <SelectItem key={user.id} value={user.full_name || user.username || user.id}>
                                                {user.full_name || user.username}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={formPerformedAt}
                                    onChange={(e) => setFormPerformedAt(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Next Maintenance</Label>
                            <Input
                                type="date"
                                value={formNextMaintenance}
                                onChange={(e) => setFormNextMaintenance(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={formNotes}
                                onChange={(e) => setFormNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={2}
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
                        <AlertDialogTitle>Delete Maintenance Record</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this maintenance record? This action cannot be undone.
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
