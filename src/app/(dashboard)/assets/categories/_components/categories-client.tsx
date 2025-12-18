"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAssetCategories, AssetCategory } from "@/hooks/api/use-asset-categories";
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
import { MoreHorizontal, Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { createAssetCategory, updateAssetCategory, deleteAssetCategory } from "../actions";

export default function CategoriesClient() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    const { data: categoriesData, isLoading } = useAssetCategories({ page, limit });

    // Modal states
    const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Form states
    const [formName, setFormName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const resetForm = () => {
        setFormName("");
        setFormDescription("");
        setMessage(null);
    };

    const handleOpenAdd = () => {
        resetForm();
        setIsAddOpen(true);
    };

    const handleOpenEdit = (category: AssetCategory) => {
        setSelectedCategory(category);
        setFormName(category.name);
        setFormDescription(category.description || "");
        setMessage(null);
        setIsEditOpen(true);
    };

    const handleOpenDelete = (category: AssetCategory) => {
        setSelectedCategory(category);
        setIsDeleteOpen(true);
    };

    const handleCreate = () => {
        setMessage(null);
        if (!formName.trim()) {
            setMessage({ type: "error", text: "Nama wajib diisi" });
            return;
        }

        startTransition(async () => {
            const result = await createAssetCategory({
                name: formName,
                description: formDescription || undefined,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Category created!" });
                queryClient.invalidateQueries({ queryKey: ["asset-categories"] });
                setTimeout(() => setIsAddOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleUpdate = () => {
        if (!selectedCategory) return;
        setMessage(null);
        if (!formName.trim()) {
            setMessage({ type: "error", text: "Nama wajib diisi" });
            return;
        }

        startTransition(async () => {
            const result = await updateAssetCategory({
                id: selectedCategory.id,
                name: formName,
                description: formDescription || undefined,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Category updated!" });
                queryClient.invalidateQueries({ queryKey: ["asset-categories"] });
                setTimeout(() => setIsEditOpen(false), 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed" });
            }
        });
    };

    const handleDelete = () => {
        if (!selectedCategory) return;
        startTransition(async () => {
            const result = await deleteAssetCategory(selectedCategory.id);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["asset-categories"] });
                setIsDeleteOpen(false);
            }
        });
    };

    const columns: Column<AssetCategory>[] = [
        {
            key: "name",
            header: "Name",
            cell: (category) => (
                <span className="font-medium">{category.name}</span>
            ),
        },
        {
            key: "description",
            header: "Description",
            cell: (category) => (
                <span className="text-muted-foreground">{category.description || "-"}</span>
            ),
        },
        {
            key: "actions",
            header: "",
            className: "w-12",
            cell: (category) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleOpenEdit(category)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleOpenDelete(category)}
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
                data={categoriesData?.data || []}
                isLoading={isLoading}
                page={page}
                totalPages={categoriesData?.totalPages || 1}
                totalItems={categoriesData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="No categories found."
                toolbarAction={
                    <Button onClick={handleOpenAdd}>
                        <Plus className="mr-2 h-4 w-4" />Add Category
                    </Button>
                }
            />

            {/* Add Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Category</DialogTitle>
                        <DialogDescription>Create a new asset category</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {message && (
                            <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                {message.text}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g., Komputer"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="Category description..."
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Category</DialogTitle>
                        <DialogDescription>Update category details</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {message && (
                            <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                {message.text}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="edit_name">Name *</Label>
                            <Input
                                id="edit_name"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g., Komputer"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_description">Description</Label>
                            <Textarea
                                id="edit_description"
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="Category description..."
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleUpdate} disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Category</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{selectedCategory?.name}&quot;? This action cannot be undone.
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
