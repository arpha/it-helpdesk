"use client";

import { DataTable, Column } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { useLocationsPage, Location } from "@/hooks/api/use-locations-page";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoreHorizontal, Pencil, Trash2, Eye, Loader2, Check, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createLocation, updateLocation, deleteLocation } from "../actions";

export default function LocationsClient() {
    const { page, limit, search, searchInput, setPage, setLimit, setSearch } =
        useDataTable();
    const queryClient = useQueryClient();

    const { data: locationsData, isLoading } = useLocationsPage({ page, limit, search });

    // Modal states
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Form state
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Add form state
    const [addName, setAddName] = useState("");
    const [addDescription, setAddDescription] = useState("");
    const [addMessage, setAddMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleView = (loc: Location) => {
        setSelectedLocation(loc);
        setIsViewOpen(true);
    };

    const handleEdit = (loc: Location) => {
        setSelectedLocation(loc);
        setEditName(loc.name);
        setEditDescription(loc.description || "");
        setMessage(null);
        setIsEditOpen(true);
    };

    const handleDelete = (loc: Location) => {
        setSelectedLocation(loc);
        setIsDeleteOpen(true);
    };

    const handleOpenAdd = () => {
        setAddName("");
        setAddDescription("");
        setAddMessage(null);
        setIsAddOpen(true);
    };

    const handleSaveAdd = () => {
        setAddMessage(null);

        if (!addName) {
            setAddMessage({ type: "error", text: "Location name is required" });
            return;
        }

        startTransition(async () => {
            const result = await createLocation({
                name: addName,
                description: addDescription || null,
            });

            if (result.success) {
                setAddMessage({ type: "success", text: "Location created successfully!" });
                queryClient.invalidateQueries({ queryKey: ["locations"] });
                setTimeout(() => {
                    setIsAddOpen(false);
                }, 1000);
            } else {
                setAddMessage({ type: "error", text: result.error || "Failed to create location" });
            }
        });
    };

    const handleSaveEdit = () => {
        if (!selectedLocation) return;
        setMessage(null);

        if (!editName) {
            setMessage({ type: "error", text: "Location name is required" });
            return;
        }

        startTransition(async () => {
            const result = await updateLocation({
                id: selectedLocation.id,
                name: editName,
                description: editDescription || null,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Location updated successfully!" });
                queryClient.invalidateQueries({ queryKey: ["locations"] });
                setTimeout(() => {
                    setIsEditOpen(false);
                }, 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed to update location" });
            }
        });
    };

    const handleConfirmDelete = () => {
        if (!selectedLocation) return;

        startTransition(async () => {
            const result = await deleteLocation(selectedLocation.id);

            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["locations"] });
                setIsDeleteOpen(false);
            } else {
                alert(result.error || "Failed to delete location");
            }
        });
    };

    const columns: Column<Location>[] = [
        {
            key: "name",
            header: "Name",
            cell: (row) => <span className="font-medium">{row.name}</span>,
        },
        {
            key: "description",
            header: "Description",
            cell: (row) => (
                <span className="text-muted-foreground line-clamp-2">
                    {row.description || "-"}
                </span>
            ),
        },
        {
            key: "created_at",
            header: "Created At",
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
                            <span className="sr-only">Open menu</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleView(row)} className="cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" />
                            View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(row)} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleDelete(row)}
                            className="text-destructive cursor-pointer"
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
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4">
                <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-sm sm:ml-auto">
                    <Input
                        placeholder="Search locations..."
                        value={searchInput}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full"
                    />
                </div>
            </div>

            <DataTable
                columns={columns}
                data={locationsData?.data || []}
                isLoading={isLoading}
                page={page}
                totalPages={locationsData?.totalPages || 1}
                totalItems={locationsData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="No locations found."
                searchValue={searchInput}
                onSearchChange={setSearch}
                hideSearch={true}
                toolbarAction={
                    <Button onClick={handleOpenAdd} size="sm">
                        <Plus className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Add Location</span>
                    </Button>
                }
            />

            {/* Add Location Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New Location</DialogTitle>
                        <DialogDescription>Create a new location</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {addMessage && (
                            <div
                                className={`rounded-md p-3 text-sm ${addMessage.type === "success"
                                    ? "bg-green-500/10 text-green-600"
                                    : "bg-destructive/10 text-destructive"
                                    }`}
                            >
                                {addMessage.text}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="add_name">Name *</Label>
                            <Input
                                id="add_name"
                                value={addName}
                                onChange={(e) => setAddName(e.target.value)}
                                placeholder="Location name"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_description">Description</Label>
                            <Textarea
                                id="add_description"
                                value={addDescription}
                                onChange={(e) => setAddDescription(e.target.value)}
                                placeholder="Location description (optional)"
                                rows={3}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveAdd} disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create Location
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Modal */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Location Details</DialogTitle>
                        <DialogDescription>View location information</DialogDescription>
                    </DialogHeader>
                    {selectedLocation && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Name</span>
                                    <span className="font-medium">{selectedLocation.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Description</span>
                                    <span className="text-right max-w-[200px]">
                                        {selectedLocation.description || "-"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Created At</span>
                                    <span>
                                        {new Date(selectedLocation.created_at).toLocaleDateString("id-ID", {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Location</DialogTitle>
                        <DialogDescription>Update location information</DialogDescription>
                    </DialogHeader>
                    {selectedLocation && (
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
                                <Label htmlFor="edit_name">Name *</Label>
                                <Input
                                    id="edit_name"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit_description">Description</Label>
                                <Textarea
                                    id="edit_description"
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveEdit} disabled={isPending}>
                                    {isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            Save Changes
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Location</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{selectedLocation?.name}</strong>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
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
