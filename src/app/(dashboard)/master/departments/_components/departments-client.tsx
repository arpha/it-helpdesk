"use client";

import { DataTable, Column } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { useDepartmentsPage, Department } from "@/hooks/api/use-departments-page";
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
import { createDepartment, updateDepartment, deleteDepartment } from "../actions";

export default function DepartmentsClient() {
    const { page, limit, search, searchInput, setPage, setLimit, setSearch } =
        useDataTable();
    const queryClient = useQueryClient();

    const { data: departmentsData, isLoading } = useDepartmentsPage({ page, limit, search });

    // Modal states
    const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
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

    const handleView = (dept: Department) => {
        setSelectedDepartment(dept);
        setIsViewOpen(true);
    };

    const handleEdit = (dept: Department) => {
        setSelectedDepartment(dept);
        setEditName(dept.name);
        setEditDescription(dept.description || "");
        setMessage(null);
        setIsEditOpen(true);
    };

    const handleDelete = (dept: Department) => {
        setSelectedDepartment(dept);
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
            setAddMessage({ type: "error", text: "Department name is required" });
            return;
        }

        startTransition(async () => {
            const result = await createDepartment({
                name: addName,
                description: addDescription || null,
            });

            if (result.success) {
                setAddMessage({ type: "success", text: "Department created successfully!" });
                queryClient.invalidateQueries({ queryKey: ["departments"] });
                setTimeout(() => {
                    setIsAddOpen(false);
                }, 1000);
            } else {
                setAddMessage({ type: "error", text: result.error || "Failed to create department" });
            }
        });
    };

    const handleSaveEdit = () => {
        if (!selectedDepartment) return;
        setMessage(null);

        if (!editName) {
            setMessage({ type: "error", text: "Department name is required" });
            return;
        }

        startTransition(async () => {
            const result = await updateDepartment({
                id: selectedDepartment.id,
                name: editName,
                description: editDescription || null,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Department updated successfully!" });
                queryClient.invalidateQueries({ queryKey: ["departments"] });
                setTimeout(() => {
                    setIsEditOpen(false);
                }, 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed to update department" });
            }
        });
    };

    const handleConfirmDelete = () => {
        if (!selectedDepartment) return;

        startTransition(async () => {
            const result = await deleteDepartment(selectedDepartment.id);

            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["departments"] });
                setIsDeleteOpen(false);
            } else {
                alert(result.error || "Failed to delete department");
            }
        });
    };

    const columns: Column<Department>[] = [
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
                        placeholder="Search departments..."
                        value={searchInput}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full"
                    />
                </div>
            </div>

            <DataTable
                columns={columns}
                data={departmentsData?.data || []}
                isLoading={isLoading}
                page={page}
                totalPages={departmentsData?.totalPages || 1}
                totalItems={departmentsData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="No departments found."
                searchValue={searchInput}
                onSearchChange={setSearch}
                hideSearch={true}
                toolbarAction={
                    <Button onClick={handleOpenAdd} size="sm">
                        <Plus className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Add Department</span>
                    </Button>
                }
            />

            {/* Add Department Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New Department</DialogTitle>
                        <DialogDescription>Create a new department</DialogDescription>
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
                                placeholder="Department name"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_description">Description</Label>
                            <Textarea
                                id="add_description"
                                value={addDescription}
                                onChange={(e) => setAddDescription(e.target.value)}
                                placeholder="Department description (optional)"
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
                                        Create Department
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
                        <DialogTitle>Department Details</DialogTitle>
                        <DialogDescription>View department information</DialogDescription>
                    </DialogHeader>
                    {selectedDepartment && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Name</span>
                                    <span className="font-medium">{selectedDepartment.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Description</span>
                                    <span className="text-right max-w-[200px]">
                                        {selectedDepartment.description || "-"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Created At</span>
                                    <span>
                                        {new Date(selectedDepartment.created_at).toLocaleDateString("id-ID", {
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
                        <DialogTitle>Edit Department</DialogTitle>
                        <DialogDescription>Update department information</DialogDescription>
                    </DialogHeader>
                    {selectedDepartment && (
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
                        <AlertDialogTitle>Delete Department</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{selectedDepartment?.name}</strong>?
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
