"use client";

import { DataTable, Column, SortDirection } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { useFingerprints, Fingerprint } from "@/hooks/api/use-fingerprints";
import { useFingerprintMachines } from "@/hooks/api/use-fingerprint-machines";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    MoreHorizontal,
    Pencil,
    Trash2,
    Loader2,
    Plus,
    Search,
    Check,
    ChevronsUpDown,
    QrCode,
    Settings2,
    Printer,
    Download,
    ExternalLink,
    Copy,
    Building2,
    UserCheck,
    UserX,
    Cpu,
    MapPin,
    AlertCircle,
} from "lucide-react";
import { useState, useTransition, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { createFingerprint, updateFingerprint, deleteFingerprint } from "../actions";
import {
    createFingerprintMachine,
    updateFingerprintMachine,
    deleteFingerprintMachine,
} from "../machines-actions";
import { DEFAULT_MACHINES, type FingerprintMachine } from "@/types/fingerprint";

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
    const { data: machines = [], isLoading: isLoadingMachines } = useFingerprintMachines();
    const { data: allUsers } = useAllUsers();

    // Sort state
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);

    // Modal states
    const [selectedFingerprint, setSelectedFingerprint] = useState<Fingerprint | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isQROpen, setIsQROpen] = useState(false);
    const [isManageMachinesOpen, setIsManageMachinesOpen] = useState(false);
    const [openUserSelect, setOpenUserSelect] = useState(false);
    const [openEditUserSelect, setOpenEditUserSelect] = useState(false);

    // Form state for Add Person
    const [addName, setAddName] = useState("");
    const [addUserId, setAddUserId] = useState<string>("");
    const [addMachineEntries, setAddMachineEntries] = useState<Record<string, string>>({});

    // Form state for Edit Person
    const [editName, setEditName] = useState("");
    const [editUserId, setEditUserId] = useState<string>("");
    const [editMachineEntries, setEditMachineEntries] = useState<Record<string, string>>({});

    // Form state for Manage Machines
    const [newMachineName, setNewMachineName] = useState("");
    const [newMachineCode, setNewMachineCode] = useState("");
    const [newMachineLocation, setNewMachineLocation] = useState("");
    const [isAddingMachine, setIsAddingMachine] = useState(false);
    const [editingMachine, setEditingMachine] = useState<FingerprintMachine | null>(null);
    const [editMachineName, setEditMachineName] = useState("");
    const [editMachineLocation, setEditMachineLocation] = useState("");

    // QR Codes generation state: machineCode -> dataUrl
    const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});

    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [addMessage, setAddMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Active machines list (falls back to DEFAULT_MACHINES if empty)
    const activeMachines = useMemo(() => {
        if (!machines || machines.length === 0) return DEFAULT_MACHINES;
        const filtered = machines.filter((m) => m.is_active !== false);
        return filtered.length > 0 ? filtered : DEFAULT_MACHINES;
    }, [machines]);

    // Available users for linking (exclude those already linked to other fingerprints)
    const availableUsers = useMemo(() => {
        if (!allUsers) return [];
        const existingUserIds = new Set(
            (fingerprintsData?.data || [])
                .map((fp) => fp.user_id)
                .filter(Boolean)
        );
        return allUsers.filter((user) => !existingUserIds.has(user.id));
    }, [allUsers, fingerprintsData?.data]);

    // Generate QR codes for all machines when QR modal is opened
    useEffect(() => {
        if (!isQROpen || machines.length === 0) return;

        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const urls: Record<string, string> = {};

        Promise.all(
            machines.map(async (m) => {
                const targetUrl = `${origin}/public/fingerprint/${m.code}`;
                try {
                    const dataUrl = await QRCode.toDataURL(targetUrl, {
                        width: 400,
                        margin: 2,
                        errorCorrectionLevel: "H",
                        color: {
                            dark: "#0f172a",
                            light: "#ffffff",
                        },
                    });
                    urls[m.code] = dataUrl;
                } catch (err) {
                    console.error("Error generating QR:", err);
                }
            })
        ).then(() => {
            setQrCodeUrls(urls);
        });
    }, [isQROpen, machines]);

    const handleOpenAdd = () => {
        setAddName("");
        setAddUserId("");
        setAddMachineEntries({});
        setAddMessage(null);
        setIsAddOpen(true);
    };

    const handleSelectUserForAdd = (user: { id: string; full_name: string | null }) => {
        setAddUserId(user.id);
        // Auto-fill full name from user profile
        if (user.full_name) {
            setAddName(user.full_name);
        }
        setOpenUserSelect(false);
    };

    const handleClearUserForAdd = () => {
        setAddUserId("");
        setOpenUserSelect(false);
    };

    const handleSelectUserForEdit = (user: { id: string; full_name: string | null }) => {
        setEditUserId(user.id);
        if (!editName && user.full_name) {
            setEditName(user.full_name);
        }
        setOpenEditUserSelect(false);
    };

    const handleClearUserForEdit = () => {
        setEditUserId("");
        setOpenEditUserSelect(false);
    };

    const handleEdit = (fp: Fingerprint) => {
        setSelectedFingerprint(fp);
        setEditName(fp.name || fp.profiles?.full_name || "");
        setEditUserId(fp.user_id || "");

        // Populate machine entries
        const initialEntries: Record<string, string> = {};
        activeMachines.forEach((m) => {
            const val =
                fp.entries?.[m.code] ||
                (fp as any)[`finger_${m.code}`] ||
                (m.code === "picu" ? fp.finger_picu : null) ||
                (m.code === "vk" ? fp.finger_vk : null) ||
                (m.code === "neo1" ? fp.finger_neo1 : null) ||
                (m.code === "neo2" ? fp.finger_neo2 : null) ||
                (m.code === "absensi" ? fp.finger_absensi : null) ||
                "";
            initialEntries[m.code] = val;
        });
        setEditMachineEntries(initialEntries);

        setMessage(null);
        setIsEditOpen(true);
    };

    const handleDelete = (fp: Fingerprint) => {
        setSelectedFingerprint(fp);
        setIsDeleteOpen(true);
    };

    const handleSaveAdd = () => {
        if (!addName.trim()) {
            setAddMessage({ type: "error", text: "Nama Lengkap wajib diisi" });
            return;
        }

        setAddMessage(null);
        startTransition(async () => {
            const result = await createFingerprint({
                name: addName.trim(),
                user_id: addUserId || null,
                machine_entries: addMachineEntries,
            });

            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["fingerprints"] });
                setIsAddOpen(false);
                toast.success("Data fingerprint berhasil ditambahkan");
            } else {
                setAddMessage({
                    type: "error",
                    text: result.error || "Gagal menambahkan data fingerprint",
                });
            }
        });
    };

    const handleSaveEdit = () => {
        if (!selectedFingerprint) return;
        if (!editName.trim()) {
            setMessage({ type: "error", text: "Nama Lengkap wajib diisi" });
            return;
        }

        setMessage(null);
        startTransition(async () => {
            const result = await updateFingerprint({
                id: selectedFingerprint.id,
                name: editName.trim(),
                user_id: editUserId || null,
                machine_entries: editMachineEntries,
            });

            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["fingerprints"] });
                setIsEditOpen(false);
                toast.success("Data fingerprint berhasil diperbarui");
            } else {
                setMessage({
                    type: "error",
                    text: result.error || "Gagal memperbarui data",
                });
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
                toast.success("Data fingerprint berhasil dihapus");
            } else {
                toast.error(result.error || "Gagal menghapus data");
            }
        });
    };

    // Auto-generate slug when typing machine name
    const handleMachineNameChange = (val: string) => {
        setNewMachineName(val);
        const slug = val
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        setNewMachineCode(slug);
    };

    const handleAddMachine = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMachineName.trim() || !newMachineCode.trim()) {
            toast.error("Nama dan kode mesin wajib diisi");
            return;
        }

        setIsAddingMachine(true);
        const res = await createFingerprintMachine({
            name: newMachineName.trim(),
            code: newMachineCode.trim(),
            location: newMachineLocation.trim() || null,
        });

        if (res.success) {
            queryClient.invalidateQueries({ queryKey: ["fingerprint_machines"] });
            setNewMachineName("");
            setNewMachineCode("");
            setNewMachineLocation("");
            toast.success("Mesin finger baru berhasil ditambahkan!");
        } else {
            toast.error(res.error || "Gagal menambahkan mesin");
        }
        setIsAddingMachine(false);
    };

    const handleSaveEditMachine = async () => {
        if (!editingMachine) return;
        const res = await updateFingerprintMachine({
            id: editingMachine.id,
            name: editMachineName.trim(),
            location: editMachineLocation.trim() || null,
        });

        if (res.success) {
            queryClient.invalidateQueries({ queryKey: ["fingerprint_machines"] });
            setEditingMachine(null);
            toast.success("Data mesin berhasil diperbarui");
        } else {
            toast.error(res.error || "Gagal memperbarui mesin");
        }
    };

    const handleDeleteMachine = async (machine: FingerprintMachine) => {
        if (!confirm(`Hapus mesin '${machine.name}'? Data ID di mesin ini akan ikut terhapus.`)) return;

        const res = await deleteFingerprintMachine(machine.id);
        if (res.success) {
            queryClient.invalidateQueries({ queryKey: ["fingerprint_machines"] });
            queryClient.invalidateQueries({ queryKey: ["fingerprints"] });
            toast.success("Mesin berhasil dihapus");
        } else {
            toast.error(res.error || "Gagal menghapus mesin");
        }
    };

    const printSingleQR = (machine: FingerprintMachine) => {
        const qrUrl = qrCodeUrls[machine.code];
        if (!qrUrl) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cetak QR - ${machine.name}</title>
                <style>
                    @page { 
                        size: auto; 
                        margin: 10mm; 
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: flex-start;
                        padding: 10mm 0;
                        margin: 0;
                        background: #fff;
                        color: #0f172a;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .card {
                        width: 50mm;
                        padding: 3mm 4mm 4mm 4mm;
                        border: 1.5px dashed #0f172a;
                        border-radius: 3mm;
                        text-align: center;
                        background: #fff;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .title {
                        font-size: 13px;
                        font-weight: 800;
                        color: #0f172a;
                        line-height: 1.2;
                        margin-bottom: 2px;
                    }
                    .location {
                        font-size: 9px;
                        font-weight: 500;
                        color: #475569;
                        margin-bottom: 2px;
                        line-height: 1.2;
                    }
                    .qr-container {
                        width: 4cm;
                        height: 4cm;
                        margin: 2mm 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .qr-container img {
                        width: 4cm !important;
                        height: 4cm !important;
                        max-width: 4cm !important;
                        max-height: 4cm !important;
                        display: block;
                        object-fit: contain;
                    }
                    .instruction {
                        font-size: 9.5px;
                        font-weight: 800;
                        color: #0f172a;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                        line-height: 1.2;
                        margin-top: 2px;
                    }
                    @media print {
                        body {
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="title">${machine.name}</div>
                    ${machine.location ? `<div class="location">${machine.location}</div>` : ""}
                    <div class="qr-container">
                        <img src="${qrUrl}" alt="QR Code 4x4cm" />
                    </div>
                    <div class="instruction">SCAN UNTUK DAFTAR FINGER</div>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 300);
    };

    // Columns Definition
    const columns: Column<Fingerprint>[] = [
        {
            key: "name",
            header: "Pegawai / User",
            cell: (row) => {
                const isLinked = !!row.user_id && !!row.profiles;
                return (
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={row.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-muted font-bold text-foreground">
                                {getInitials(row.name || "P")}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{row.name || "-"}</span>
                                {isLinked ? (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                                        <UserCheck className="h-2.5 w-2.5 mr-0.5" />
                                        Terhubung
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground border-dashed">
                                        Non-Akun
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {isLinked ? `@${row.profiles?.username}` : "Tanpa Akun Login"}
                            </p>
                        </div>
                    </div>
                );
            },
        },
        // Dynamic Machine Columns
        ...activeMachines.map((machine) => ({
            key: `machine_${machine.code}`,
            header: machine.name.replace("Mesin Finger ", "").replace("Mesin ", ""),
            cell: (row: Fingerprint) => {
                const val =
                    row.entries?.[machine.code] ||
                    (row as any)[`finger_${machine.code}`] ||
                    (machine.code === "picu" ? row.finger_picu : null) ||
                    (machine.code === "vk" ? row.finger_vk : null) ||
                    (machine.code === "neo1" ? row.finger_neo1 : null) ||
                    (machine.code === "neo2" ? row.finger_neo2 : null) ||
                    (machine.code === "absensi" ? row.finger_absensi : null);
                if (!val) return <span className="text-muted-foreground/40 font-mono text-sm">-</span>;
                return (
                    <span className="font-mono text-sm font-semibold bg-muted/60 px-2 py-0.5 rounded border border-border/50 text-foreground">
                        {val}
                    </span>
                );
            },
        })),
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
                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEdit(row)} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Fingerprint
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleDelete(row)}
                            className="text-destructive cursor-pointer"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus Data
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    // Local Sorting
    const sortedData = useMemo(() => {
        const data = fingerprintsData?.data || [];
        if (!sortColumn || !sortDirection) return data;

        return [...data].sort((a, b) => {
            let aVal = "";
            let bVal = "";

            if (sortColumn === "name") {
                aVal = a.name || "";
                bVal = b.name || "";
            } else if (sortColumn.startsWith("machine_")) {
                const code = sortColumn.replace("machine_", "");
                aVal = a.entries?.[code] || (a as any)[`finger_${code}`] || "";
                bVal = b.entries?.[code] || (b as any)[`finger_${code}`] || "";
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
                        placeholder="Cari nama pegawai atau ID finger..."
                        value={searchInput}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <DataTable
                columns={columns}
                data={sortedData}
                isLoading={isLoading || isLoadingMachines}
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
                searchPlaceholder="Cari pegawai..."
                searchValue={searchInput}
                onSearchChange={setSearch}
                hideSearch={true}
                toolbarAction={
                    <div className="flex items-center gap-2">
                        {/* Barcode Mesin Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsQROpen(true)}
                            className="h-9 shadow-sm"
                        >
                            <QrCode className="h-4 w-4 mr-1.5 text-primary" />
                            <span className="hidden sm:inline">Barcode Mesin</span>
                        </Button>

                        {/* Kelola Mesin Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsManageMachinesOpen(true)}
                            className="h-9 shadow-sm"
                        >
                            <Settings2 className="h-4 w-4 mr-1.5 text-muted-foreground" />
                            <span className="hidden sm:inline">Kelola Mesin</span>
                        </Button>

                        {/* Add Fingerprint Button */}
                        <Button onClick={handleOpenAdd} size="sm" className="h-9 shadow-sm">
                            <Plus className="h-4 w-4 mr-1.5" />
                            <span>Tambah Fingerprint</span>
                        </Button>
                    </div>
                }
            />

            {/* ========================================================================= */}
            {/* ADD FINGERPRINT MODAL */}
            {/* ========================================================================= */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>Tambah Data Fingerprint</DialogTitle>
                        <DialogDescription>
                            Daftarkan nama pegawai dan nomor ID fingerprint untuk setiap mesin.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 px-6 py-2 overflow-y-auto flex-1">
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

                        {/* Input Nama Lengkap (Wajib) */}
                        <div className="space-y-2">
                            <Label htmlFor="add_name" className="text-sm font-semibold">
                                Nama Lengkap <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="add_name"
                                value={addName}
                                onChange={(e) => setAddName(e.target.value)}
                                placeholder="Masukkan nama lengkap pegawai..."
                                className="h-10"
                                autoFocus
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Nama identitas pemilik sidik jari di database helpdesk.
                            </p>
                        </div>

                        {/* Hubungkan Data User (Opsional) */}
                        <div className="space-y-2 p-3.5 rounded-lg border bg-muted/30">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Hubungkan Akun User (Opsional)
                                </Label>
                                {addUserId && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClearUserForAdd}
                                        className="h-6 text-xs text-destructive hover:bg-destructive/10"
                                    >
                                        <UserX className="h-3 w-3 mr-1" />
                                        Lepaskan
                                    </Button>
                                )}
                            </div>

                            <Popover open={openUserSelect} onOpenChange={setOpenUserSelect}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openUserSelect}
                                        className="w-full justify-between font-normal h-10 bg-background"
                                    >
                                        {addUserId ? (
                                            <div className="flex items-center gap-2">
                                                <UserCheck className="h-4 w-4 text-primary" />
                                                <span>
                                                    {availableUsers.find((user) => user.id === addUserId)?.full_name || "Akun Terpilih"}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                Pilih akun user untuk dihubungkan (opsional)...
                                            </span>
                                        )}
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
                                                        onSelect={() => handleSelectUserForAdd(user)}
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
                            <p className="text-[11px] text-muted-foreground">
                                Jika dipilih, nama lengkap otomatis terisi dengan nama akun user.
                            </p>
                        </div>

                        {/* ID Mesin Finger Dinamis */}
                        <div className="space-y-3 pt-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                                Nomor ID Mesin Fingerprint
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {activeMachines.map((machine) => (
                                    <div key={machine.code} className="space-y-1.5 p-2.5 rounded-lg border bg-background">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor={`add_${machine.code}`} className="text-xs font-medium truncate">
                                                {machine.name}
                                            </Label>
                                            {machine.location && (
                                                <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                                                    {machine.location}
                                                </span>
                                            )}
                                        </div>
                                        <Input
                                            id={`add_${machine.code}`}
                                            value={addMachineEntries[machine.code] || ""}
                                            onChange={(e) =>
                                                setAddMachineEntries((prev) => ({
                                                    ...prev,
                                                    [machine.code]: e.target.value,
                                                }))
                                            }
                                            placeholder="Contoh: 203"
                                            className="h-9 font-mono text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 p-6 pt-3 border-t bg-muted/20">
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
                                    Simpan Fingerprint
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ========================================================================= */}
            {/* EDIT FINGERPRINT MODAL */}
            {/* ========================================================================= */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>Edit Data Fingerprint</DialogTitle>
                        <DialogDescription>
                            Perbarui identitas dan nomor ID fingerprint untuk {selectedFingerprint?.name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 px-6 py-2 overflow-y-auto flex-1">
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

                        {/* Input Nama Lengkap */}
                        <div className="space-y-2">
                            <Label htmlFor="edit_name" className="text-sm font-semibold">
                                Nama Lengkap <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="edit_name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Masukkan nama lengkap..."
                                className="h-10"
                            />
                        </div>

                        {/* Hubungkan Akun User */}
                        <div className="space-y-2 p-3.5 rounded-lg border bg-muted/30">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Hubungkan Akun User (Opsional)
                                </Label>
                                {editUserId && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClearUserForEdit}
                                        className="h-6 text-xs text-destructive hover:bg-destructive/10"
                                    >
                                        <UserX className="h-3 w-3 mr-1" />
                                        Lepaskan
                                    </Button>
                                )}
                            </div>

                            <Popover open={openEditUserSelect} onOpenChange={setOpenEditUserSelect}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openEditUserSelect}
                                        className="w-full justify-between font-normal h-10 bg-background"
                                    >
                                        {editUserId ? (
                                            <div className="flex items-center gap-2">
                                                <UserCheck className="h-4 w-4 text-primary" />
                                                <span>
                                                    {allUsers?.find((user) => user.id === editUserId)?.full_name ||
                                                        selectedFingerprint?.profiles?.full_name ||
                                                        "Akun Terhubung"}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                Pilih akun user untuk dihubungkan...
                                            </span>
                                        )}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari nama atau username..." />
                                        <CommandList>
                                            <CommandEmpty>User tidak ditemukan.</CommandEmpty>
                                            <CommandGroup>
                                                {allUsers?.map((user) => (
                                                    <CommandItem
                                                        key={user.id}
                                                        value={`${user.full_name} ${user.username}`}
                                                        onSelect={() => handleSelectUserForEdit(user)}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                editUserId === user.id ? "opacity-100" : "opacity-0"
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

                        {/* Dynamic Machine Entries */}
                        <div className="space-y-3 pt-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                                Nomor ID Mesin Fingerprint
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {activeMachines.map((machine) => (
                                    <div key={machine.code} className="space-y-1.5 p-2.5 rounded-lg border bg-background">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor={`edit_${machine.code}`} className="text-xs font-medium truncate">
                                                {machine.name}
                                            </Label>
                                            {machine.location && (
                                                <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                                                    {machine.location}
                                                </span>
                                            )}
                                        </div>
                                        <Input
                                            id={`edit_${machine.code}`}
                                            value={editMachineEntries[machine.code] || ""}
                                            onChange={(e) =>
                                                setEditMachineEntries((prev) => ({
                                                    ...prev,
                                                    [machine.code]: e.target.value,
                                                }))
                                            }
                                            placeholder="Kosongkan jika belum terdaftar"
                                            className="h-9 font-mono text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 p-6 pt-3 border-t bg-muted/20">
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
                </DialogContent>
            </Dialog>

            {/* ========================================================================= */}
            {/* DELETE ALERT DIALOG */}
            {/* ========================================================================= */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Data Fingerprint?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini akan menghapus data sidik jari untuk{" "}
                            <strong>{selectedFingerprint?.name}</strong> di seluruh mesin. Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isPending}
                        >
                            {isPending ? "Menghapus..." : "Hapus"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ========================================================================= */}
            {/* BARCODE / QR MESIN MODAL */}
            {/* ========================================================================= */}
            <Dialog open={isQROpen} onOpenChange={setIsQROpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-3 border-b">
                        <div className="flex items-center gap-2">
                            <QrCode className="h-5 w-5 text-primary" />
                            <DialogTitle>Barcode / QR Code Mesin Fingerprint</DialogTitle>
                        </div>
                        <DialogDescription>
                            Cetak atau unduh barcode untuk ditempel di samping setiap mesin fisik agar pegawai dapat mendaftar mandiri.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {activeMachines.map((machine) => {
                                const qrData = qrCodeUrls[machine.code];
                                const origin = typeof window !== "undefined" ? window.location.origin : "";
                                const publicUrl = `${origin}/public/fingerprint/${machine.code}`;

                                return (
                                    <div
                                        key={machine.code}
                                        className="border rounded-2xl p-5 bg-card flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow relative group"
                                    >
                                        <Badge variant="outline" className="mb-2 text-[10px] tracking-wide uppercase font-semibold">
                                            {machine.code}
                                        </Badge>
                                        <h3 className="font-bold text-base text-foreground mb-0.5">
                                            {machine.name}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
                                            <MapPin className="h-3 w-3 text-primary" />
                                            {machine.location || "Lokasi belum diatur"}
                                        </p>

                                        {/* QR Canvas / Image Preview */}
                                        <div className="p-3 bg-white rounded-xl border shadow-inner mb-4">
                                            {qrData ? (
                                                <img
                                                    src={qrData}
                                                    alt={`QR ${machine.name}`}
                                                    className="w-44 h-44 object-contain"
                                                />
                                            ) : (
                                                <div className="w-44 h-44 flex items-center justify-center text-muted-foreground">
                                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-[11px] text-muted-foreground mb-4 line-clamp-2">
                                            Scan QR ini untuk pendaftaran mandiri dengan ID 3-digit acak
                                        </p>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 w-full mt-auto">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(publicUrl);
                                                    toast.success(`Link untuk ${machine.name} berhasil disalin!`);
                                                }}
                                                className="flex-1 text-xs h-8"
                                            >
                                                <Copy className="h-3.5 w-3.5 mr-1" />
                                                Salin Link
                                            </Button>

                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => printSingleQR(machine)}
                                                disabled={!qrData}
                                                className="flex-1 text-xs h-8"
                                                title="Cetak Label QR (Ukuran Barcode 4x4cm)"
                                            >
                                                <Printer className="h-3.5 w-3.5 mr-1" />
                                                Cetak (4x4cm)
                                            </Button>

                                            {qrData && (
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    asChild
                                                    className="h-8 w-8 shrink-0"
                                                    title="Unduh Gambar QR Barcode"
                                                >
                                                    <a href={qrData} download={`qr-${machine.code}-4x4cm.png`}>
                                                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </a>
                                                </Button>
                                            )}

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => window.open(publicUrl, "_blank")}
                                                className="h-8 w-8 shrink-0"
                                                title="Buka Halaman Scan"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-4 border-t bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
                        <span>Total: {activeMachines.length} Mesin Fingerprint Aktif</span>
                        <Button variant="outline" onClick={() => setIsQROpen(false)}>
                            Tutup
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ========================================================================= */}
            {/* KELOLA MESIN FINGERPRINT MODAL */}
            {/* ========================================================================= */}
            <Dialog open={isManageMachinesOpen} onOpenChange={setIsManageMachinesOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-3 border-b">
                        <div className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-primary" />
                            <DialogTitle>Kelola Mesin Fingerprint</DialogTitle>
                        </div>
                        <DialogDescription>
                            Tambah mesin finger baru atau perbarui nama dan lokasi mesin yang sudah ada.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto space-y-6 flex-1">
                        {/* Form Tambah Mesin Baru */}
                        <form onSubmit={handleAddMachine} className="p-4 rounded-xl border bg-muted/20 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                <Plus className="h-3.5 w-3.5" />
                                Tambah Mesin Finger Baru
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="m_name" className="text-xs font-medium">
                                        Nama Mesin <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="m_name"
                                        value={newMachineName}
                                        onChange={(e) => handleMachineNameChange(e.target.value)}
                                        placeholder="Contoh: Mesin Finger IGD"
                                        className="h-9 text-xs"
                                        required
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="m_code" className="text-xs font-medium">
                                        Kode / Slug URL <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="m_code"
                                        value={newMachineCode}
                                        onChange={(e) => setNewMachineCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))}
                                        placeholder="igd"
                                        className="h-9 text-xs font-mono"
                                        required
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="m_location" className="text-xs font-medium">
                                        Lokasi Fisik
                                    </Label>
                                    <Input
                                        id="m_location"
                                        value={newMachineLocation}
                                        onChange={(e) => setNewMachineLocation(e.target.value)}
                                        placeholder="Ruang IGD Lt. 1"
                                        className="h-9 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-1">
                                <Button type="submit" size="sm" disabled={isAddingMachine} className="h-8 text-xs">
                                    {isAddingMachine ? (
                                        <>
                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                                            Tambahkan Mesin
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>

                        {/* List Existing Machines */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Daftar Seluruh Mesin ({machines.length})
                            </h4>

                            <div className="divide-y rounded-xl border bg-card">
                                {machines.map((m) => {
                                    const isEditingThis = editingMachine?.id === m.id;

                                    if (isEditingThis) {
                                        return (
                                            <div key={m.id} className="p-3.5 space-y-2 bg-muted/30">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <Input
                                                        value={editMachineName}
                                                        onChange={(e) => setEditMachineName(e.target.value)}
                                                        placeholder="Nama Mesin"
                                                        className="h-8 text-xs"
                                                    />
                                                    <Input
                                                        value={editMachineLocation}
                                                        onChange={(e) => setEditMachineLocation(e.target.value)}
                                                        placeholder="Lokasi"
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div className="flex justify-end gap-1.5">
                                                    <Button variant="ghost" size="sm" onClick={() => setEditingMachine(null)} className="h-7 text-xs">
                                                        Batal
                                                    </Button>
                                                    <Button size="sm" onClick={handleSaveEditMachine} className="h-7 text-xs">
                                                        Simpan
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={m.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                    <Cpu className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm">{m.name}</span>
                                                        <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5">
                                                            {m.code}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <MapPin className="h-3 w-3 text-muted-foreground/60" />
                                                        {m.location || "Lokasi belum diatur"}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => {
                                                        setEditingMachine(m);
                                                        setEditMachineName(m.name);
                                                        setEditMachineLocation(m.location || "");
                                                    }}
                                                    title="Edit Mesin"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteMachine(m)}
                                                    title="Hapus Mesin"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t bg-muted/20 flex justify-end">
                        <Button variant="outline" onClick={() => setIsManageMachinesOpen(false)}>
                            Tutup
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
