"use client";

import { DataTable, Column, SortDirection } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { useFingerprints, Fingerprint } from "@/hooks/api/use-fingerprints";
import { useAllUsers } from "@/hooks/api/use-all-users";
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
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Pencil, Trash2, Loader2, Plus, Search, Check, ChevronsUpDown } from "lucide-react";
import { useState, useTransition, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFingerprint, updateFingerprint, deleteFingerprint } from "../actions";

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export default function FingerprintsClient() {
    const { page, limit, search, searchInput, setPage, setLimit, setSearch } =
        useDataTable();
    const queryClient = useQueryClient();

    const { data: fingerprintsData, isLoading } = useFingerprints({ page, limit, search });
    const { data: allUsers } = useAllUsers();

    // Sort state
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);

    // Modal states
    const [selectedFingerprint, setSelectedFingerprint] = useState<Fingerprint | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [openUserSelect, setOpenUserSelect] = useState(false);

    // Form state for Add
    const [addUserId, setAddUserId] = useState("");
    const [addPicu, setAddPicu] = useState("");
    const [addVk, setAddVk] = useState("");
    const [addNeo1, setAddNeo1] = useState("");
    const [addNeo2, setAddNeo2] = useState("");
    const [addAbsensi, setAddAbsensi] = useState("");

    // Form state for Edit
    const [editPicu, setEditPicu] = useState("");
    const [editVk, setEditVk] = useState("");
    const [editNeo1, setEditNeo1] = useState("");
    const [editNeo2, setEditNeo2] = useState("");
    const [editAbsensi, setEditAbsensi] = useState("");

    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [addMessage, setAddMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Filter out users that already have fingerprint data
    const availableUsers = useMemo(() => {
        if (!allUsers) return [];
        const existingUserIds = new Set(
            (fingerprintsData?.data || []).map((fp) => fp.user_id)
        );
        return allUsers.filter((user) => !existingUserIds.has(user.id));
    }, [allUsers, fingerprintsData?.data]);

    const handleEdit = (fp: Fingerprint) => {
        setSelectedFingerprint(fp);
        setEditPicu(fp.finger_picu || "");
        setEditVk(fp.finger_vk || "");
        setEditNeo1(fp.finger_neo1 || "");
        setEditNeo2(fp.finger_neo2 || "");
        setEditAbsensi(fp.finger_absensi || "");
        setMessage(null);
        setIsEditOpen(true);
    };

    const handleDelete = (fp: Fingerprint) => {
        setSelectedFingerprint(fp);
        setIsDeleteOpen(true);
    };

    const handleOpenAdd = () => {
        setAddUserId("");
        setAddPicu("");
        setAddVk("");
        setAddNeo1("");
        setAddNeo2("");
        setAddAbsensi("");
        setAddMessage(null);
        setIsAddOpen(true);
    };

    const handleSaveAdd = () => {
        setAddMessage(null);

        if (!addUserId) {
            setAddMessage({ type: "error", text: "Pilih user terlebih dahulu" });
            return;
        }

        startTransition(async () => {
            const result = await createFingerprint({
                user_id: addUserId,
                finger_picu: addPicu || null,
                finger_vk: addVk || null,
                finger_neo1: addNeo1 || null,
                finger_neo2: addNeo2 || null,
                finger_absensi: addAbsensi || null,
            });

            if (result.success) {
                setAddMessage({ type: "success", text: "Data fingerprint berhasil ditambahkan!" });
                queryClient.invalidateQueries({ queryKey: ["fingerprints"] });
                setTimeout(() => {
                    setIsAddOpen(false);
                }, 1000);
            } else {
                setAddMessage({ type: "error", text: result.error || "Gagal menambahkan data" });
            }
        });
    };

    const handleSaveEdit = () => {
        if (!selectedFingerprint) return;
        setMessage(null);

        startTransition(async () => {
            const result = await updateFingerprint({
                id: selectedFingerprint.id,
                finger_picu: editPicu || null,
                finger_vk: editVk || null,
                finger_neo1: editNeo1 || null,
                finger_neo2: editNeo2 || null,
                finger_absensi: editAbsensi || null,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Data fingerprint berhasil diupdate!" });
                queryClient.invalidateQueries({ queryKey: ["fingerprints"] });
                setTimeout(() => {
                    setIsEditOpen(false);
                }, 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Gagal mengupdate data" });
            }
        });
    };

    const handleConfirmDelete = () => {
        if (!selectedFingerprint) return;

        startTransition(async () => {
            const result = await deleteFingerprint(selectedFingerprint.id);

            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["fingerprints"] });
                setIsDeleteOpen(false);
            } else {
                alert(result.error || "Gagal menghapus data");
            }
        });
    };

    const columns: Column<Fingerprint>[] = [
        {
            key: "user",
            header: "User",
            cell: (row) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={row.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                            {getInitials(row.profiles?.full_name || "")}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <span className="font-medium">{row.profiles?.full_name || "-"}</span>
                        <p className="text-xs text-muted-foreground">{row.profiles?.username || ""}</p>
                    </div>
                </div>
            ),
        },
        {
            key: "finger_picu",
            header: "PICU",
            cell: (row) => (
                <span className="text-muted-foreground font-mono text-sm">
                    {row.finger_picu || "-"}
                </span>
            ),
        },
        {
            key: "finger_vk",
            header: "VK",
            cell: (row) => (
                <span className="text-muted-foreground font-mono text-sm">
                    {row.finger_vk || "-"}
                </span>
            ),
        },
        {
            key: "finger_neo1",
            header: "Neo 1",
            cell: (row) => (
                <span className="text-muted-foreground font-mono text-sm">
                    {row.finger_neo1 || "-"}
                </span>
            ),
        },
        {
            key: "finger_neo2",
            header: "Neo 2",
            cell: (row) => (
                <span className="text-muted-foreground font-mono text-sm">
                    {row.finger_neo2 || "-"}
                </span>
            ),
        },
        {
            key: "finger_absensi",
            header: "Absensi",
            cell: (row) => (
                <span className="text-muted-foreground font-mono text-sm">
                    {row.finger_absensi || "-"}
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

    // Sort data locally
    const sortedData = useMemo(() => {
        const data = fingerprintsData?.data || [];
        if (!sortColumn || !sortDirection) return data;

        return [...data].sort((a, b) => {
            let aVal = "";
            let bVal = "";

            if (sortColumn === "user") {
                aVal = a.profiles?.full_name || "";
                bVal = b.profiles?.full_name || "";
            } else {
                aVal = (a as Record<string, unknown>)[sortColumn] as string || "";
                bVal = (b as Record<string, unknown>)[sortColumn] as string || "";
            }

            const comparison = aVal.localeCompare(bVal);
            return sortDirection === "asc" ? comparison : -comparison;
        });
    }, [fingerprintsData?.data, sortColumn, sortDirection]);

    const handleSortChange = (column: string, direction: SortDirection) => {
        setSortColumn(direction ? column : null);
        setSortDirection(direction);
    };

    return (
        <>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4">
                <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-sm sm:ml-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari user..."
                        value={searchInput}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <DataTable
                columns={columns}
                data={sortedData}
                isLoading={isLoading}
                page={page}
                totalPages={fingerprintsData?.totalPages || 1}
                totalItems={fingerprintsData?.totalItems}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                emptyMessage="Belum ada data fingerprint."
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSortChange={handleSortChange}
                searchPlaceholder="Cari user..."
                searchValue={searchInput}
                onSearchChange={setSearch}
                hideSearch={true}
                toolbarAction={
                    <Button onClick={handleOpenAdd} size="sm">
                        <Plus className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Add Fingerprint</span>
                    </Button>
                }
            />

            {/* Add Fingerprint Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tambah Fingerprint</DialogTitle>
                        <DialogDescription>Tambahkan data fingerprint untuk user</DialogDescription>
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

                        <div className="space-y-2 flex flex-col">
                            <Label>User *</Label>
                            <Popover open={openUserSelect} onOpenChange={setOpenUserSelect}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openUserSelect}
                                        className="w-full justify-between font-normal"
                                    >
                                        {addUserId
                                            ? availableUsers.find((user) => user.id === addUserId)?.full_name
                                            : "Cari user..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari nama atau username..." />
                                        <CommandList>
                                            <CommandEmpty>User tidak ditemukan.</CommandEmpty>
                                            <CommandGroup>
                                                {availableUsers.map((user) => (
                                                    <CommandItem
                                                        key={user.id}
                                                        value={`${user.full_name} ${user.username}`}
                                                        onSelect={() => {
                                                            setAddUserId(user.id);
                                                            setOpenUserSelect(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                addUserId === user.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {user.full_name} ({user.username})
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_picu">ID Finger PICU</Label>
                            <Input
                                id="add_picu"
                                value={addPicu}
                                onChange={(e) => setAddPicu(e.target.value)}
                                placeholder="Masukkan ID finger PICU"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_vk">ID Finger VK</Label>
                            <Input
                                id="add_vk"
                                value={addVk}
                                onChange={(e) => setAddVk(e.target.value)}
                                placeholder="Masukkan ID finger VK"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_neo1">ID Finger Neo 1</Label>
                            <Input
                                id="add_neo1"
                                value={addNeo1}
                                onChange={(e) => setAddNeo1(e.target.value)}
                                placeholder="Masukkan ID finger Neo 1"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_neo2">ID Finger Neo 2</Label>
                            <Input
                                id="add_neo2"
                                value={addNeo2}
                                onChange={(e) => setAddNeo2(e.target.value)}
                                placeholder="Masukkan ID finger Neo 2"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="add_absensi">ID Finger Absensi</Label>
                            <Input
                                id="add_absensi"
                                value={addAbsensi}
                                onChange={(e) => setAddAbsensi(e.target.value)}
                                placeholder="Masukkan ID finger Absensi"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                                Batal
                            </Button>
                            <Button onClick={handleSaveAdd} disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Simpan
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Fingerprint Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Fingerprint</DialogTitle>
                        <DialogDescription>
                            Edit data fingerprint untuk {selectedFingerprint?.profiles?.full_name || "user"}
                        </DialogDescription>
                    </DialogHeader>
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

                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={selectedFingerprint?.profiles?.avatar_url || undefined} />
                                <AvatarFallback>
                                    {getInitials(selectedFingerprint?.profiles?.full_name || "")}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{selectedFingerprint?.profiles?.full_name}</p>
                                <p className="text-sm text-muted-foreground">{selectedFingerprint?.profiles?.username}</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_picu">ID Finger PICU</Label>
                            <Input
                                id="edit_picu"
                                value={editPicu}
                                onChange={(e) => setEditPicu(e.target.value)}
                                placeholder="Masukkan ID finger PICU"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_vk">ID Finger VK</Label>
                            <Input
                                id="edit_vk"
                                value={editVk}
                                onChange={(e) => setEditVk(e.target.value)}
                                placeholder="Masukkan ID finger VK"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_neo1">ID Finger Neo 1</Label>
                            <Input
                                id="edit_neo1"
                                value={editNeo1}
                                onChange={(e) => setEditNeo1(e.target.value)}
                                placeholder="Masukkan ID finger Neo 1"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_neo2">ID Finger Neo 2</Label>
                            <Input
                                id="edit_neo2"
                                value={editNeo2}
                                onChange={(e) => setEditNeo2(e.target.value)}
                                placeholder="Masukkan ID finger Neo 2"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_absensi">ID Finger Absensi</Label>
                            <Input
                                id="edit_absensi"
                                value={editAbsensi}
                                onChange={(e) => setEditAbsensi(e.target.value)}
                                placeholder="Masukkan ID finger Absensi"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                                Batal
                            </Button>
                            <Button onClick={handleSaveEdit} disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    "Simpan Perubahan"
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
                        <AlertDialogTitle>Hapus Data Fingerprint</AlertDialogTitle>
                        <AlertDialogDescription>
                            Apakah Anda yakin ingin menghapus data fingerprint untuk{" "}
                            <strong>{selectedFingerprint?.profiles?.full_name}</strong>?
                            Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isPending}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Menghapus...
                                </>
                            ) : (
                                "Hapus"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
