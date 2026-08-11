"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Key,
    Search,
    Printer,
    RefreshCw,
    Trash2,
    Clock,
    UserCheck,
    Thermometer,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet,
    QrCode,
    Plus
} from "lucide-react";
import { getServerRoomLogs, deleteServerRoomLog, addManualServerRoomLog } from "@/app/public/server-logbook/actions";
import { toast } from "sonner";
import QRCode from "qrcode";
import * as XLSX from "xlsx";
import type { ServerRoomLog, VisitorType } from "@/types/server-logbook";

const visitorLabels: Record<VisitorType, string> = {
    internal_it: "Petugas IT",
    vendor: "Vendor Luar",
    maintenance: "Maintenance",
    other: "Lainnya"
};

const visitorColors: Record<VisitorType, string> = {
    internal_it: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
    vendor: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
    maintenance: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
    other: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20"
};

export default function AdminServerLogbookPage() {
    const [logs, setLogs] = useState<ServerRoomLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [visitorFilter, setVisitorFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    
    // Stats
    const [activeCount, setActiveCount] = useState(0);
    const [avgTemp, setAvgTemp] = useState<number | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // QR Print Dialog
    const [qrDialogOpen, setQrDialogOpen] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Manual Entry Form states
    const [manualDialogOpen, setManualDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [visitorName, setVisitorName] = useState("");
    const [visitorType, setVisitorType] = useState<VisitorType>("internal_it");
    const [companyOrUnit, setCompanyOrUnit] = useState("");
    const [purpose, setPurpose] = useState("");
    const [temperature, setTemperature] = useState("");
    const [checkInTime, setCheckInTime] = useState("");
    const [checkOutTime, setCheckOutTime] = useState("");
    const [notes, setNotes] = useState("");

    const fetchLogs = async (p = page, q = searchQuery, vis = visitorFilter, stat = statusFilter) => {
        setIsLoading(true);
        const res = await getServerRoomLogs({
            page: p,
            search: q,
            visitor_type: vis,
            status: stat,
            pageSize: 10
        });

        if (res.success && res.data) {
            setLogs(res.data);
            setTotalPages(res.totalPages || 1);
            setTotalCount(res.count || 0);

            // Calculate active visitors count in current fetch (or general logic)
            // Realistically to get active visitor stats we query from DB
            const activeItems = res.data.filter(l => l.status === "active").length;
            setActiveCount(activeItems);

            // Calculate Average Temp
            const logsWithTemp = res.data.filter(l => l.temperature !== null && l.temperature !== undefined);
            if (logsWithTemp.length > 0) {
                const totalTemp = logsWithTemp.reduce((acc, curr) => acc + (curr.temperature || 0), 0);
                setAvgTemp(totalTemp / logsWithTemp.length);
            } else {
                setAvgTemp(null);
            }
        } else if (res.error) {
            toast.error("Gagal memuat logbook: " + res.error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchLogs(1, searchQuery, visitorFilter, statusFilter);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        fetchLogs(page, searchQuery, visitorFilter, statusFilter);
    }, [page, visitorFilter, statusFilter]);

    const handleDelete = async (id: string) => {
        const res = await deleteServerRoomLog(id);
        if (res.success) {
            toast.success("Catatan logbook berhasil dihapus");
            fetchLogs();
        } else {
            toast.error("Gagal menghapus catatan: " + res.error);
        }
    };

    const handleOpenManualDialog = () => {
        setVisitorName("");
        setVisitorType("internal_it");
        setCompanyOrUnit("");
        setPurpose("");
        setTemperature("");
        
        // Auto fill local check-in time format yyyy-MM-ddThh:mm
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16);
        setCheckInTime(localISOTime);
        setCheckOutTime("");
        setNotes("");
        setManualDialogOpen(true);
    };

    const handleSaveManualLog = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!visitorName.trim()) {
            toast.error("Nama pengunjung wajib diisi");
            return;
        }
        if (!purpose.trim()) {
            toast.error("Tujuan akses wajib diisi");
            return;
        }
        if (!checkInTime) {
            toast.error("Waktu masuk wajib diisi");
            return;
        }

        setIsSubmitting(true);
        try {
            const tempVal = temperature.trim() ? parseFloat(temperature) : undefined;
            const res = await addManualServerRoomLog({
                visitor_name: visitorName,
                visitor_type: visitorType,
                company_or_unit: companyOrUnit,
                purpose: purpose,
                temperature: tempVal,
                check_in_time: new Date(checkInTime).toISOString(),
                check_out_time: checkOutTime ? new Date(checkOutTime).toISOString() : undefined,
                notes: notes
            });

            if (res.success) {
                toast.success("Catatan manual berhasil disimpan");
                setManualDialogOpen(false);
                fetchLogs();
            } else {
                toast.error(res.error || "Gagal menyimpan log manual");
            }
        } catch (error) {
            console.error(error);
            toast.error("Terjadi kesalahan koneksi");
        } finally {
            setIsSubmitting(false);
        }
    };

    const generateQRLabel = async () => {
        setQrDialogOpen(true);
        // Generate QR code for public endpoint path
        const publicUrl = `${window.location.origin}/public/server-logbook`;
        
        // Wait dialog to render canvas
        setTimeout(async () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            canvas.width = 600;
            canvas.height = 750;

            // Background White
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, 600, 750);

            // Border
            ctx.strokeStyle = "#020617";
            ctx.lineWidth = 15;
            ctx.strokeRect(20, 20, 560, 710);

            // Header Banner
            ctx.fillStyle = "#2563eb";
            ctx.fillRect(30, 30, 540, 120);

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 36px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("SERVER ROOM ACCESS", 300, 85);
            ctx.font = "bold 20px sans-serif";
            ctx.fillText("SCAN TO RECORD LOGBOOK", 300, 120);

            // Generate QR Code data into offscreen
            const qrCanvas = document.createElement("canvas");
            await QRCode.toCanvas(qrCanvas, publicUrl, {
                width: 380,
                margin: 2,
                color: {
                    dark: "#000000",
                    light: "#ffffff"
                }
            });

            // Draw QR into main canvas
            ctx.drawImage(qrCanvas, 110, 190, 380, 380);

            // Footer Text
            ctx.fillStyle = "#020617";
            ctx.font = "bold 24px sans-serif";
            ctx.fillText("PINTU MASUK RUANG SERVER", 300, 630);
            ctx.font = "18px sans-serif";
            ctx.fillStyle = "#64748b";
            ctx.fillText("Harap Scan QR sebelum Masuk & Keluar", 300, 665);
            ctx.font = "bold 14px monospace";
            ctx.fillStyle = "#94a3b8";
            ctx.fillText("SI-MANTAP SECURITY SYSTEM", 300, 700);

            setQrCodeUrl(canvas.toDataURL("image/png"));
        }, 150);
    };

    const printQRLabel = () => {
        if (!qrCodeUrl) return;
        const win = window.open("", "_blank");
        if (!win) return;
        win.document.write(`
            <html>
                <head>
                    <title>Print Label QR Pintu Ruang Server</title>
                    <style>
                        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                        img { max-width: 12cm; max-height: 15cm; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; }
                    </style>
                </head>
                <body onload="window.print();window.close()">
                    <img src="${qrCodeUrl}" />
                </body>
            </html>
        `);
        win.document.close();
    };

    const handleExportExcel = () => {
        const formatted = logs.map((log) => ({
            "Nama Pengunjung": log.visitor_name,
            "Tipe": visitorLabels[log.visitor_type] || log.visitor_type,
            "Instansi / Unit": log.company_or_unit || "-",
            "Tujuan Akses": log.purpose,
            "Suhu (°C)": log.temperature || "-",
            "Jam Masuk": new Date(log.check_in_time).toLocaleString("id-ID"),
            "Jam Keluar": log.check_out_time ? new Date(log.check_out_time).toLocaleString("id-ID") : "Masih di Ruangan",
            "Status": log.status === "active" ? "Aktif (Di Dalam)" : "Selesai",
            "Catatan": log.notes || "-"
        }));

        const worksheet = XLSX.utils.json_to_sheet(formatted);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Server Room Logs");
        XLSX.writeFile(workbook, `server_room_logs_${Date.now()}.xlsx`);
        toast.success("Berhasil mengekspor data ke Excel");
    };

    return (
        <div className="container mx-auto py-6 space-y-6 max-w-6xl">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Key className="h-8 w-8 text-primary" />
                        Logbook Ruang Server
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Monitoring & audit akses keamanan pintu masuk Ruang Server Utama.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button onClick={handleOpenManualDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Tambah Log Manual
                    </Button>
                    <Button variant="outline" onClick={generateQRLabel}>
                        <QrCode className="h-4 w-4 mr-2" />
                        Cetak QR Pintu
                    </Button>
                    <Button onClick={handleExportExcel} variant="secondary">
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Ekspor Excel
                    </Button>
                </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">Aktif Di Ruangan</span>
                            <div className="text-3xl font-bold text-blue-500">{activeCount} Orang</div>
                        </div>
                        <UserCheck className="h-10 w-10 text-blue-500/50" />
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">Rata-Rata Suhu Ruangan</span>
                            <div className="text-3xl font-bold text-green-500">
                                {avgTemp ? `${avgTemp.toFixed(1)} °C` : "N/A"}
                            </div>
                        </div>
                        <Thermometer className="h-10 w-10 text-green-500/50" />
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">Total Log Hari Ini</span>
                            <div className="text-3xl font-bold text-purple-500">{totalCount} Akses</div>
                        </div>
                        <Clock className="h-10 w-10 text-purple-500/50" />
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari nama, instansi, tujuan..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <Select value={visitorFilter} onValueChange={setVisitorFilter}>
                            <SelectTrigger className="w-40 bg-background">
                                <SelectValue placeholder="Tipe Pengunjung" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Tipe</SelectItem>
                                <SelectItem value="internal_it">Petugas IT</SelectItem>
                                <SelectItem value="vendor">Vendor Luar</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                <SelectItem value="other">Lainnya</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-40 bg-background">
                                <SelectValue placeholder="Status Kehadiran" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="active">Aktif (Di Dalam)</SelectItem>
                                <SelectItem value="completed">Selesai (Check-Out)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            {/* Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama Pengunjung</TableHead>
                            <TableHead>Instansi / Unit</TableHead>
                            <TableHead>Tujuan Akses</TableHead>
                            <TableHead>Suhu (°C)</TableHead>
                            <TableHead>Waktu Masuk</TableHead>
                            <TableHead>Waktu Keluar</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-12">
                                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                                    Memuat histori logbook...
                                </TableCell>
                            </TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                    Belum ada log akses yang tercatat.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        <div className="font-medium">{log.visitor_name}</div>
                                        <Badge variant="outline" className={`mt-1 font-normal ${visitorColors[log.visitor_type]}`}>
                                            {visitorLabels[log.visitor_type] || log.visitor_type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {log.company_or_unit || "-"}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={log.purpose}>
                                        {log.purpose}
                                    </TableCell>
                                    <TableCell>
                                        {log.temperature ? (
                                            <span className="font-medium text-green-600 flex items-center gap-1">
                                                <Thermometer className="h-3.5 w-3.5" />
                                                {log.temperature} °C
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {new Date(log.check_in_time).toLocaleString("id-ID", {
                                            day: "numeric",
                                            month: "short",
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        })} WIB
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {log.check_out_time ? (
                                            `${new Date(log.check_out_time).toLocaleString("id-ID", {
                                                day: "numeric",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })} WIB`
                                        ) : (
                                            <span className="text-blue-500 font-semibold flex items-center gap-1 animate-pulse">
                                                <Clock className="h-3 w-3" /> Di dalam
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={log.status === "active" ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" : "bg-green-500/10 text-green-500 hover:bg-green-500/20"}>
                                            {log.status === "active" ? "Aktif" : "Selesai"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Hapus Catatan"
                                                    className="text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Hapus Catatan Logbook?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Catatan akses untuk <strong>{log.visitor_name}</strong> akan dihapus permanen.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDelete(log.id)}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Hapus
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            Menampilkan {(page - 1) * 10 + 1} - {Math.min(page * 10, totalCount)} dari {totalCount} log
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Sebelumnya
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                Selanjutnya
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Manual Entry Dialog */}
            <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Tambah Logbook Manual</DialogTitle>
                        <DialogDescription>
                            Input data kunjungan ruang server secara manual untuk keperluan pencatatan audit.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveManualLog} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="visitor_name">Nama Pengunjung <span className="text-destructive">*</span></Label>
                            <Input
                                id="visitor_name"
                                value={visitorName}
                                onChange={(e) => setVisitorName(e.target.value)}
                                placeholder="Nama lengkap pengunjung..."
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipe Pengunjung</Label>
                                <Select value={visitorType} onValueChange={(val) => setVisitorType(val as VisitorType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="internal_it">Petugas IT</SelectItem>
                                        <SelectItem value="vendor">Vendor Luar</SelectItem>
                                        <SelectItem value="maintenance">Maintenance</SelectItem>
                                        <SelectItem value="other">Lainnya</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="unit">Instansi / Unit</Label>
                                <Input
                                    id="unit"
                                    value={companyOrUnit}
                                    onChange={(e) => setCompanyOrUnit(e.target.value)}
                                    placeholder="SIMRS / CV. Tech"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="purpose">Tujuan Akses <span className="text-destructive">*</span></Label>
                                <Input
                                    id="purpose"
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    placeholder="Misal: Perbaikan UPS"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="temp">Suhu Ruangan (°C)</Label>
                                <Input
                                    id="temp"
                                    type="number"
                                    step="0.1"
                                    value={temperature}
                                    onChange={(e) => setTemperature(e.target.value)}
                                    placeholder="Misal: 20.5"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="in_time">Waktu Masuk <span className="text-destructive">*</span></Label>
                                <Input
                                    id="in_time"
                                    type="datetime-local"
                                    value={checkInTime}
                                    onChange={(e) => setCheckInTime(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="out_time">Waktu Keluar (Opsional)</Label>
                                <Input
                                    id="out_time"
                                    type="datetime-local"
                                    value={checkOutTime}
                                    onChange={(e) => setCheckOutTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Keterangan / Catatan</Label>
                            <Textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Tambahan catatan khusus..."
                                rows={2}
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setManualDialogOpen(false)} disabled={isSubmitting}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Menyimpan..." : "Simpan Catatan"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Print QR Code Pintu Dialog */}
            <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <QrCode className="h-5 w-5 text-primary" />
                            Label QR Code Pintu Ruang Server
                        </DialogTitle>
                        <DialogDescription>
                            Cetak label ini dan tempelkan di depan pintu Ruang Server Utama.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg border border-dashed">
                        {qrCodeUrl ? (
                            <img src={qrCodeUrl} alt="QR Pintu Preview" className="max-w-[280px] rounded border shadow-md bg-white" />
                        ) : (
                            <div className="h-64 w-64 bg-slate-900 animate-pulse rounded border flex items-center justify-center text-muted-foreground">
                                Generating QR Label...
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>

                    <DialogFooter className="sm:justify-between gap-2">
                        <Button variant="outline" onClick={() => setQrDialogOpen(false)}>
                            Batal
                        </Button>
                        <Button onClick={printQRLabel} disabled={!qrCodeUrl}>
                            <Printer className="h-4 w-4 mr-2" />
                            Cetak Sekarang
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
