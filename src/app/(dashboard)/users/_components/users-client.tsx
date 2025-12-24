"use client";

import { DataTable, Column } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { useUsers, UserProfile } from "@/hooks/api/use-users";
import { useDepartments } from "@/hooks/api/use-departments";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { MoreHorizontal, Pencil, Trash2, Eye, Loader2, Check, Plus, Upload, X } from "lucide-react";
import { useState, useTransition, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createUser, updateUser, deleteUser, uploadAvatar } from "../actions";

const roleColors: Record<string, string> = {
    admin: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
    user: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
    staff_it: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
    manager_it: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
};

const roleLabels: Record<string, string> = {
    admin: "Admin",
    user: "User",
    staff_it: "Staff IT",
    manager_it: "Manager IT",
};

const roles = ["admin", "user", "staff_it", "manager_it"] as const;

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export default function UsersClient() {
    const { page, limit, search, searchInput, setPage, setLimit, setSearch } =
        useDataTable();
    const queryClient = useQueryClient();

    const { data: usersData, isLoading } = useUsers({ page, limit, search });
    const { data: departments } = useDepartments();

    // Modal states
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Form state
    const [editFullName, setEditFullName] = useState("");
    const [editUsername, setEditUsername] = useState("");
    const [editRole, setEditRole] = useState<string>("");
    const [editDepartment, setEditDepartment] = useState<string>("");
    const [editAvatarUrl, setEditAvatarUrl] = useState<string>("");
    const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
    const [editAvatarPreview, setEditAvatarPreview] = useState<string>("");
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Add user form state
    const [addEmail, setAddEmail] = useState("");
    const [addPassword, setAddPassword] = useState("");
    const [addUsername, setAddUsername] = useState("");
    const [addFullName, setAddFullName] = useState("");
    const [addRole, setAddRole] = useState<string>("user");
    const [addDepartment, setAddDepartment] = useState<string>("");
    const [addAvatarFile, setAddAvatarFile] = useState<File | null>(null);
    const [addAvatarPreview, setAddAvatarPreview] = useState<string>("");
    const [addMessage, setAddMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const addFileInputRef = useRef<HTMLInputElement>(null);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    const handleAddAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAddAvatarFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                setAddAvatarPreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEditAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setEditAvatarFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                setEditAvatarPreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleView = (user: UserProfile) => {
        setSelectedUser(user);
        setIsViewOpen(true);
    };

    const handleEdit = (user: UserProfile) => {
        setSelectedUser(user);
        setEditFullName(user.full_name);
        setEditUsername(user.username || "");
        setEditRole(user.role);
        setEditDepartment(user.department_id || "");
        setEditAvatarUrl(user.avatar_url || "");
        setEditAvatarFile(null);
        setEditAvatarPreview(user.avatar_url || "");
        setMessage(null);
        setIsEditOpen(true);
    };

    const handleDelete = (user: UserProfile) => {
        setSelectedUser(user);
        setIsDeleteOpen(true);
    };

    const handleOpenAdd = () => {
        setAddEmail("");
        setAddPassword("");
        setAddUsername("");
        setAddFullName("");
        setAddRole("user");
        setAddDepartment("");
        setAddAvatarFile(null);
        setAddAvatarPreview("");
        setAddMessage(null);
        setIsAddOpen(true);
    };

    const handleSaveAdd = () => {
        setAddMessage(null);

        if (!addEmail || !addPassword || !addFullName || !addUsername) {
            setAddMessage({ type: "error", text: "Please fill all required fields" });
            return;
        }

        startTransition(async () => {
            let avatarUrl: string | null = null;

            // Upload avatar if provided
            if (addAvatarFile) {
                const formData = new FormData();
                formData.append("file", addAvatarFile);
                formData.append("userId", addEmail.split("@")[0] + "_" + Date.now());

                const uploadResult = await uploadAvatar(formData);
                if (!uploadResult.success) {
                    setAddMessage({ type: "error", text: uploadResult.error || "Failed to upload avatar" });
                    return;
                }
                avatarUrl = uploadResult.url || null;
            }

            const result = await createUser({
                email: addEmail,
                password: addPassword,
                username: addUsername,
                full_name: addFullName,
                role: addRole as "admin" | "user" | "staff_it" | "manager_it",
                department_id: addDepartment || null,
                avatar_url: avatarUrl,
            });

            if (result.success) {
                setAddMessage({ type: "success", text: "User created successfully!" });
                queryClient.invalidateQueries({ queryKey: ["users"] });
                setTimeout(() => {
                    setIsAddOpen(false);
                }, 1000);
            } else {
                setAddMessage({ type: "error", text: result.error || "Failed to create user" });
            }
        });
    };

    const handleSaveEdit = () => {
        if (!selectedUser) return;
        setMessage(null);

        startTransition(async () => {
            let avatarUrl: string | undefined = undefined;

            // Upload new avatar if provided
            if (editAvatarFile) {
                const formData = new FormData();
                formData.append("file", editAvatarFile);
                formData.append("userId", selectedUser.id);

                const uploadResult = await uploadAvatar(formData);
                if (!uploadResult.success) {
                    setMessage({ type: "error", text: uploadResult.error || "Failed to upload avatar" });
                    return;
                }
                avatarUrl = uploadResult.url;
            }

            const result = await updateUser({
                id: selectedUser.id,
                username: editUsername || undefined,
                full_name: editFullName,
                role: editRole as "admin" | "user" | "staff_it" | "manager_it",
                department_id: editDepartment || null,
                avatar_url: avatarUrl,
            });

            if (result.success) {
                setMessage({ type: "success", text: "User updated successfully!" });
                queryClient.invalidateQueries({ queryKey: ["users"] });
                setTimeout(() => {
                    setIsEditOpen(false);
                }, 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed to update user" });
            }
        });
    };

    const handleConfirmDelete = () => {
        if (!selectedUser) return;

        startTransition(async () => {
            const result = await deleteUser(selectedUser.id);

            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["users"] });
                setIsDeleteOpen(false);
            } else {
                alert(result.error || "Failed to delete user");
            }
        });
    };

    const columns: Column<UserProfile>[] = [
        {
            key: "user",
            header: "User",
            cell: (row) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={row.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                            {getInitials(row.full_name)}
                        </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{row.full_name}</span>
                </div>
            ),
        },
        {
            key: "role",
            header: "Role",
            cell: (row) => (
                <Badge variant="secondary" className={roleColors[row.role]}>
                    {roleLabels[row.role]}
                </Badge>
            ),
        },
        {
            key: "department",
            header: "Department",
            cell: (row) => (
                <span className="text-muted-foreground">
                    {row.departments?.name || "-"}
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
            <DataTable
                columns={columns}
                data={usersData?.data || []}
                isLoading={isLoading}
                searchValue={searchInput}
                onSearchChange={setSearch}
                searchPlaceholder="Search users..."
                page={page}
                totalPages={usersData?.totalPages || 1}
                totalItems={usersData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="No users found."
                toolbarAction={
                    <Button onClick={handleOpenAdd}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add User
                    </Button>
                }
            />

            {/* Add User Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>Create a new user account</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
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

                        {/* Avatar Upload */}
                        <div className="space-y-2">
                            <Label>Avatar</Label>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={addAvatarPreview || undefined} />
                                    <AvatarFallback>
                                        {addFullName ? getInitials(addFullName) : "?"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex gap-2">
                                    <input
                                        ref={addFileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleAddAvatarChange}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addFileInputRef.current?.click()}
                                    >
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload
                                    </Button>
                                    {addAvatarPreview && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setAddAvatarFile(null);
                                                setAddAvatarPreview("");
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_email">Email *</Label>
                            <Input
                                id="add_email"
                                type="email"
                                value={addEmail}
                                onChange={(e) => setAddEmail(e.target.value)}
                                placeholder="user@example.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_password">Password *</Label>
                            <Input
                                id="add_password"
                                type="password"
                                value={addPassword}
                                onChange={(e) => setAddPassword(e.target.value)}
                                placeholder="Min. 6 characters"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_username">Username *</Label>
                            <Input
                                id="add_username"
                                value={addUsername}
                                onChange={(e) => setAddUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                placeholder="john.doe"
                            />
                            <p className="text-xs text-muted-foreground">Lowercase, no spaces (for login)</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_full_name">Full Name *</Label>
                            <Input
                                id="add_full_name"
                                value={addFullName}
                                onChange={(e) => setAddFullName(e.target.value)}
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={addRole} onValueChange={setAddRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {roleLabels[role]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Select value={addDepartment} onValueChange={setAddDepartment}>
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
                                        Create User
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
                        <DialogTitle>User Details</DialogTitle>
                        <DialogDescription>View user information</DialogDescription>
                    </DialogHeader>
                    {selectedUser && (
                        <div className="space-y-4 py-4">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={selectedUser.avatar_url || undefined} />
                                    <AvatarFallback className="text-lg">
                                        {getInitials(selectedUser.full_name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium text-lg">{selectedUser.full_name}</p>
                                    <Badge variant="secondary" className={roleColors[selectedUser.role]}>
                                        {roleLabels[selectedUser.role]}
                                    </Badge>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Department</span>
                                    <span>{selectedUser.departments?.name || "-"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Created At</span>
                                    <span>
                                        {new Date(selectedUser.created_at).toLocaleDateString("id-ID", {
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
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>Update user information</DialogDescription>
                    </DialogHeader>
                    {selectedUser && (
                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
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

                            {/* Avatar Upload */}
                            <div className="space-y-2">
                                <Label>Avatar</Label>
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={editAvatarPreview || undefined} />
                                        <AvatarFallback className="text-lg">
                                            {getInitials(editFullName || selectedUser.full_name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex gap-2">
                                        <input
                                            ref={editFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleEditAvatarChange}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => editFileInputRef.current?.click()}
                                        >
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload
                                        </Button>
                                        {editAvatarPreview && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setEditAvatarFile(null);
                                                    setEditAvatarPreview(editAvatarUrl);
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit_username">Username</Label>
                                <Input
                                    id="edit_username"
                                    value={editUsername}
                                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                />
                                <p className="text-xs text-muted-foreground">Lowercase, no spaces (for login)</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit_full_name">Full Name</Label>
                                <Input
                                    id="edit_full_name"
                                    value={editFullName}
                                    onChange={(e) => setEditFullName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Role</Label>
                                <Select value={editRole} onValueChange={setEditRole}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem key={role} value={role}>
                                                {roleLabels[role]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Department</Label>
                                <Select value={editDepartment} onValueChange={setEditDepartment}>
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
                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{selectedUser?.full_name}</strong>?
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
