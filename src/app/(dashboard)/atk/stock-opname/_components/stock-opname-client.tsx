"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Plus,
    MoreHorizontal,
    ClipboardCheck,
    Loader2,
    CheckCircle,
    XCircle,
    Eye,
    Trash2,
    AlertTriangle,
} from "lucide-react";
import {
    getStockOpnameSessions,
    getStockOpnameItems,
    createStockOpnameSession,
    updateOpnameItemCount,
    completeStockOpname,
    cancelStockOpname,
    deleteStockOpname,
    StockOpnameSession,
    StockOpnameItem,
} from "../actions";

const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-600",
    in_progress: "bg-blue-500/10 text-blue-600",
    completed: "bg-green-500/10 text-green-600",
    cancelled: "bg-red-500/10 text-red-600",
};

const statusLabels: Record<string, string> = {
    draft: "Draft",
    in_progress: "In Progress",
    completed: "Selesai",
    cancelled: "Dibatalkan",
};

function formatDate(date: string | null): string {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function StockOpnameClient() {
    const [sessions, setSessions] = useState<StockOpnameSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<StockOpnameSession | null>(null);
    const [sessionItems, setSessionItems] = useState<StockOpnameItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Modal states
    const [isNewOpen, setIsNewOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isCompleteOpen, setIsCompleteOpen] = useState(false);
    const [isCancelOpen, setIsCancelOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Form states
    const [notes, setNotes] = useState("");
    const [itemCounts, setItemCounts] = useState<Record<string, { qty: string; notes: string }>>({});
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [itemSearch, setItemSearch] = useState("");

    useEffect(() => {
        loadSessions();
    }, []);

    async function loadSessions() {
        setIsLoading(true);
        try {
            const data = await getStockOpnameSessions();
            setSessions(data);
        } finally {
            setIsLoading(false);
        }
    }

    async function loadSessionItems(sessionId: string) {
        const items = await getStockOpnameItems(sessionId);
        setSessionItems(items);

        // Initialize item counts from existing data
        const counts: Record<string, { qty: string; notes: string }> = {};
        items.forEach(item => {
            counts[item.id] = {
                qty: item.physical_quantity !== null ? String(item.physical_quantity) : "",
                notes: item.notes || "",
            };
        });
        setItemCounts(counts);
    }

    function handleCreate() {
        startTransition(async () => {
            const result = await createStockOpnameSession(notes || undefined);
            if (result.success) {
                setMessage({ type: "success", text: "Sesi stock opname berhasil dibuat" });
                setIsNewOpen(false);
                setNotes("");
                loadSessions();
            } else {
                setMessage({ type: "error", text: result.error || "Gagal membuat sesi" });
            }
        });
    }

    function handleView(session: StockOpnameSession) {
        setSelectedSession(session);
        loadSessionItems(session.id);
        setIsViewOpen(true);
    }

    function handleSaveCount(itemId: string) {
        const count = itemCounts[itemId];
        if (!count || count.qty === "") return;

        startTransition(async () => {
            const result = await updateOpnameItemCount(itemId, parseInt(count.qty), count.notes || undefined);
            if (result.success) {
                if (selectedSession) {
                    loadSessionItems(selectedSession.id);
                    loadSessions();
                }
            }
        });
    }

    function handleComplete() {
        if (!selectedSession) return;

        startTransition(async () => {
            const result = await completeStockOpname(selectedSession.id);
            if (result.success) {
                setMessage({ type: "success", text: "Stock opname selesai. Stok telah disesuaikan." });
                setIsCompleteOpen(false);
                setIsViewOpen(false);
                loadSessions();
            } else {
                setMessage({ type: "error", text: result.error || "Gagal menyelesaikan opname" });
            }
        });
    }

    function handleCancel() {
        if (!selectedSession) return;

        startTransition(async () => {
            const result = await cancelStockOpname(selectedSession.id);
            if (result.success) {
                setIsCancelOpen(false);
                setIsViewOpen(false);
                loadSessions();
            }
        });
    }

    function handleDelete() {
        if (!selectedSession) return;

        startTransition(async () => {
            const result = await deleteStockOpname(selectedSession.id);
            if (result.success) {
                setIsDeleteOpen(false);
                loadSessions();
            }
        });
    }

    const itemsWithDifference = sessionItems.filter(i => i.physical_quantity !== null && i.difference !== 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Stock Opname</h1>
                    <p className="text-muted-foreground">Pengecekan dan penyesuaian stok fisik</p>
                </div>
                <Button onClick={() => setIsNewOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Session
                </Button>
            </div>

            {message && (
                <div className={`p-4 rounded-md ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                    {message.text}
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <div className="grid gap-4">
                    {sessions.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                Belum ada sesi stock opname
                            </CardContent>
                        </Card>
                    ) : (
                        sessions.map(session => (
                            <Card key={session.id} className="hover:bg-muted/50 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
                                            <div>
                                                <p className="font-semibold">{session.session_code}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatDate(session.created_at)} • {session.profiles?.full_name}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <Badge className={statusColors[session.status]}>
                                                    {statusLabels[session.status]}
                                                </Badge>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {session.counted_count}/{session.item_count} items
                                                </p>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleView(session)}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        {session.status === "completed" ? "Lihat Detail" : "Input Count"}
                                                    </DropdownMenuItem>
                                                    {session.status !== "completed" && session.status !== "cancelled" && (
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setSelectedSession(session);
                                                                setIsDeleteOpen(true);
                                                            }}
                                                            className="text-red-600"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Hapus
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* New Session Modal */}
            <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sesi Stock Opname Baru</DialogTitle>
                        <DialogDescription>
                            Mulai sesi baru untuk pengecekan stok fisik
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Catatan (opsional)</Label>
                            <Textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Catatan untuk sesi ini..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewOpen(false)}>Batal</Button>
                        <Button onClick={handleCreate} disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Buat Sesi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View/Edit Modal */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="w-[95vw] max-w-[1200px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedSession?.session_code}
                            <Badge className={statusColors[selectedSession?.status || "draft"]}>
                                {statusLabels[selectedSession?.status || "draft"]}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription>
                            Input jumlah stok fisik untuk setiap item
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Summary Cards */}
                        {itemsWithDifference.length > 0 && (
                            <Card className="border-yellow-500/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                        Items dengan Selisih
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-yellow-600">{itemsWithDifference.length}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Search */}
                        <div className="mb-4">
                            <Input
                                placeholder="Cari nama barang..."
                                value={itemSearch}
                                onChange={e => setItemSearch(e.target.value)}
                                className="w-full max-w-sm"
                            />
                        </div>

                        {/* Items Table */}
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="text-left p-3">Item</th>
                                        <th className="text-right p-3 w-24">Sistem</th>
                                        <th className="text-right p-3 w-28">Fisik</th>
                                        <th className="text-right p-3 w-24">Selisih</th>
                                        <th className="p-3 w-40">Notes</th>
                                        <th className="p-3 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessionItems
                                        .filter(item =>
                                            !itemSearch ||
                                            item.atk_items?.name?.toLowerCase().includes(itemSearch.toLowerCase())
                                        )
                                        .map(item => {
                                            const count = itemCounts[item.id] || { qty: "", notes: "" };
                                            const isCounted = item.physical_quantity !== null;
                                            const hasDiff = isCounted && item.difference !== 0;

                                            return (
                                                <tr key={item.id} className={`border-t ${hasDiff ? "bg-yellow-500/5" : ""}`}>
                                                    <td className="p-3">
                                                        <div className="font-medium">{item.atk_items?.name}</div>
                                                        <div className="text-sm text-muted-foreground">{item.atk_items?.unit}</div>
                                                    </td>
                                                    <td className="p-3 text-right font-medium">{item.system_quantity}</td>
                                                    <td className="p-3">
                                                        {selectedSession?.status !== "completed" ? (
                                                            <Input
                                                                type="number"
                                                                value={count.qty}
                                                                onChange={e => setItemCounts(prev => ({
                                                                    ...prev,
                                                                    [item.id]: { ...prev[item.id], qty: e.target.value }
                                                                }))}
                                                                className="w-24 text-center text-base font-medium"
                                                                min="0"
                                                            />
                                                        ) : (
                                                            <div className="text-right font-medium">
                                                                {item.physical_quantity ?? "-"}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className={`p-3 text-right font-medium ${hasDiff ? (item.difference > 0 ? "text-green-600" : "text-red-600") : ""}`}>
                                                        {isCounted ? (item.difference > 0 ? `+${item.difference}` : item.difference) : "-"}
                                                    </td>
                                                    <td className="p-3">
                                                        {selectedSession?.status !== "completed" ? (
                                                            <Input
                                                                value={count.notes}
                                                                onChange={e => setItemCounts(prev => ({
                                                                    ...prev,
                                                                    [item.id]: { ...prev[item.id], notes: e.target.value }
                                                                }))}
                                                                placeholder="Notes..."
                                                                className="w-full text-sm"
                                                            />
                                                        ) : (
                                                            <span className="text-sm">{item.notes || "-"}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        {selectedSession?.status !== "completed" && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleSaveCount(item.id)}
                                                                disabled={isPending || count.qty === ""}
                                                            >
                                                                {isCounted ? <CheckCircle className="h-4 w-4 text-green-600" /> : "Save"}
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {selectedSession?.status !== "completed" && selectedSession?.status !== "cancelled" && (
                        <DialogFooter className="gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsCancelOpen(true);
                                }}
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                Batalkan
                            </Button>
                            <Button
                                onClick={() => setIsCompleteOpen(true)}
                                disabled={sessionItems.every(i => i.physical_quantity === null)}
                            >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Selesai & Adjust Stok
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* Complete Confirmation */}
            <AlertDialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Selesaikan Stock Opname?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {itemsWithDifference.length > 0 ? (
                                <>
                                    Terdapat <strong>{itemsWithDifference.length}</strong> item dengan selisih stok.
                                    Stok akan disesuaikan berdasarkan hasil penghitungan fisik.
                                </>
                            ) : (
                                "Tidak ada selisih stok. Opname akan ditandai selesai."
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleComplete} disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Ya, Selesaikan
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Cancel Confirmation */}
            <AlertDialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Batalkan Stock Opname?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Sesi ini akan dibatalkan dan tidak dapat dilanjutkan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Tidak</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">
                            Ya, Batalkan
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Sesi Stock Opname?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Sesi {selectedSession?.session_code} akan dihapus permanen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Ya, Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
