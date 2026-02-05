"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, Printer, Upload, Link as LinkIcon, RefreshCw, Type, Save, Trash2, Eye, Search, ChevronLeft, ChevronRight } from "lucide-react";
import QRCode from "qrcode";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { saveQRCode, getQRCodes, deleteQRCode, getLogos, saveLogo, type CustomQR, type QRLogo } from "./actions";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function QRGeneratorPage() {
    const [text, setText] = useState("");
    const [name, setName] = useState("");
    const [logo, setLogo] = useState<string | null>(null);
    const [logoId, setLogoId] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [history, setHistory] = useState<CustomQR[]>([]);
    const [logos, setLogosList] = useState<QRLogo[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("upload");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        fetchHistory();
        fetchLogos();
    }, []);

    const fetchHistory = async (p = page, q = searchQuery) => {
        setIsLoading(true);
        const res = await getQRCodes({ page: p, search: q, pageSize: 10 });
        if (res.success && res.data) {
            setHistory(res.data);
            setTotalPages(res.totalPages || 1);
            setTotalCount(res.count || 0);
        }
        setIsLoading(false);
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1); // Reset to page 1 on new search
            fetchHistory(1, searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch on page change
    useEffect(() => {
        fetchHistory(page, searchQuery);
    }, [page]);

    const fetchLogos = async () => {
        const res = await getLogos();
        if (res.success && res.data) {
            setLogosList(res.data);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Data = event.target?.result as string;
                setLogo(base64Data);
                setLogoId(null); // Reset library selection

                // Prompt to save to library
                toast.promise(
                    saveLogo(file.name, base64Data),
                    {
                        loading: 'Menyimpan logo ke perpustakaan...',
                        success: (res) => {
                            if (res.success && res.data) {
                                setLogoId(res.data.id);
                                fetchLogos();
                                setActiveTab("library");
                                return 'Logo ditambahkan ke perpustakaan';
                            }
                            return 'Gagal menyimpan logo ke perpustakaan';
                        },
                        error: 'Gagal menyimpan logo'
                    }
                );
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSelectLogo = (l: QRLogo) => {
        setLogo(l.data);
        setLogoId(l.id);
        toast.info(`Logo "${l.name}" dipilih`);
    };

    const handleNew = () => {
        setText("");
        setName("");
        setLogo(null);
        setLogoId(null);
        setEditingId(null);
        setQrDataUrl(null);
        toast.info("Siap untuk membuat QR baru");
    };

    useEffect(() => {
        // Debounce generation for better performance
        const timer = setTimeout(() => {
            generateQR();
        }, 300);
        return () => clearTimeout(timer);
    }, [text, logo]);

    const generateQR = async () => {
        if (!text) {
            setQrDataUrl(null);
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Settings
        const size = 1000;
        canvas.width = size;
        canvas.height = size + 200;

        try {
            // 1. Get QR Data Matrix
            const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
            const modules = qr.modules;
            const moduleCount = modules.size;

            // 2. Setup Background & Frame
            const gradient = ctx.createLinearGradient(0, 0, size, size + 200);
            gradient.addColorStop(0, "#2563eb");
            gradient.addColorStop(1, "#7c3aed");

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size + 200);

            const qrPadding = 50;
            const qrSize = size - (qrPadding * 2);
            ctx.fillStyle = "#ffffff";
            ctx.roundRect(qrPadding, qrPadding, qrSize, qrSize, 50);
            ctx.fill();

            // 3. Draw Stylized Modules
            const cellSize = (qrSize - 60) / moduleCount;
            const startX = qrPadding + 30;
            const startY = qrPadding + 30;

            ctx.fillStyle = "#000000";

            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    const isDark = modules.get(row, col);
                    if (!isDark) continue;

                    // Skip Finder Patterns (the big eyes) for custom drawing
                    const isFinderPattern =
                        (row < 7 && col < 7) ||
                        (row < 7 && col >= moduleCount - 7) ||
                        (row >= moduleCount - 7 && col < 7);

                    if (isFinderPattern) continue;

                    // Draw Rounded Dots
                    const x = startX + col * cellSize + cellSize / 2;
                    const y = startY + row * cellSize + cellSize / 2;

                    ctx.beginPath();
                    ctx.arc(x, y, cellSize * 0.4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // 4. Draw Custom Finder Patterns (Eyes)
            const drawEye = (x: number, y: number) => {
                const eyeSize = cellSize * 7;

                // Outer ring
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = cellSize;
                ctx.beginPath();
                ctx.roundRect(x + cellSize / 2, y + cellSize / 2, eyeSize - cellSize, eyeSize - cellSize, eyeSize * 0.25);
                ctx.stroke();

                // Inner dot
                ctx.fillStyle = "#000000";
                ctx.beginPath();
                ctx.roundRect(x + cellSize * 2, y + cellSize * 2, eyeSize - cellSize * 4, eyeSize - cellSize * 4, eyeSize * 0.15);
                ctx.fill();
            };

            drawEye(startX, startY); // Top Left
            drawEye(startX + (moduleCount - 7) * cellSize, startY); // Top Right
            drawEye(startX, startY + (moduleCount - 7) * cellSize); // Bottom Left

            // 5. Draw Logo
            if (logo) {
                const logoImg = new window.Image();
                logoImg.src = logo;
                await new Promise((resolve) => {
                    logoImg.onload = resolve;
                });

                const logoSize = qrSize * 0.25;
                const center = size / 2;

                // White circle behind logo
                ctx.beginPath();
                ctx.arc(center, center, (logoSize / 2) + 10, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.fill();

                ctx.save();
                ctx.beginPath();
                ctx.arc(center, center, logoSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(logoImg, center - logoSize / 2, center - logoSize / 2, logoSize, logoSize);
                ctx.restore();
            }

            // 6. Text
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 80px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("SCAN ME", size / 2, size + 110);

            setQrDataUrl(canvas.toDataURL("image/png"));
        } catch (err) {
            console.error(err);
        }
    };

    const downloadQR = () => {
        if (!qrDataUrl) return;
        const link = document.createElement("a");
        link.download = `qr-code-${name || Date.now()}.png`;
        link.href = qrDataUrl;
        link.click();
    };

    const printQR = () => {
        const win = window.open("", "_blank");
        if (!win) return;
        win.document.write(`
            <html>
                <head>
                    <title>Print QR Code - ${name}</title>
                    <style>
                        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                        img { max-width: 6cm; max-height: 6cm; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; }
                    </style>
                </head>
                <body onload="window.print();window.close()">
                    <img src="${qrDataUrl}" />
                </body>
            </html>
        `);
        win.document.close();
    };

    const handleSave = async () => {
        if (!text || !name) {
            toast.error("Nama dan Konten QR wajib diisi");
            return;
        }

        setIsSaving(true);
        let finalLogoId = logoId;

        // If we have a logo but no ID (not in library yet), save it now
        if (logo && !finalLogoId) {
            const logoRes = await saveLogo(`Logo for ${name}`, logo);
            if (logoRes.success && logoRes.data) {
                finalLogoId = logoRes.data.id;
                setLogoId(finalLogoId);
                fetchLogos();
                toast.success("Logo juga disimpan ke perpustakaan");
            }
        }

        const res = await saveQRCode({
            id: editingId,
            name,
            content: text,
            logo_id: finalLogoId,
            logo_data: finalLogoId ? null : logo
        });

        if (res.success) {
            toast.success(editingId ? "QR Code diperbarui" : "QR Code disimpan");
            setEditingId(res.data.id);
            fetchHistory();
        } else {
            toast.error("Gagal menyimpan: " + res.error);
        }
        setIsSaving(false);
    };

    const handleDelete = async (id: string) => {
        const res = await deleteQRCode(id);
        if (res.success) {
            toast.success("QR Code dihapus");
            fetchHistory();
        } else {
            toast.error("Gagal menghapus: " + res.error);
        }
    };

    const loadFromHistory = (qr: CustomQR) => {
        // Reset canvas first to show loading if needed
        setQrDataUrl(null);

        setText(qr.content);
        setName(qr.name);
        setLogo(qr.logo_data);
        setLogoId(qr.logo_id);
        setEditingId(qr.id);

        // Switch tab based on whether it has a library logo or direct upload
        if (qr.logo_id) {
            setActiveTab("library");
        } else if (qr.logo_data) {
            setActiveTab("upload");
        }

        toast.info(`Memuat kembali "${qr.name}"`);
        window.scrollTo({ top: 0, behavior: "smooth" });

        // generateQR will be triggered by useEffect [text, logo]
    };

    return (
        <div className="container mx-auto py-8 max-w-5xl">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Controls */}
                <div className="flex-1 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">QR Generator</h1>
                            <p className="text-muted-foreground mt-2">Buat QR Code kustom dengan logo dan desain cantik.</p>
                        </div>
                        {editingId && (
                            <Button variant="outline" size="sm" onClick={handleNew}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Buat Baru
                            </Button>
                        )}
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <LinkIcon className="h-5 w-5" />
                                Konfigurasi QR
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama / Label QR</Label>
                                <Input
                                    id="name"
                                    placeholder="Contoh: Link Guest Wi-Fi"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="url">Link atau Teks</Label>
                                <Input
                                    id="url"
                                    placeholder="Masukkan URL atau teks di sini..."
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                />
                            </div>

                            <div className="space-y-4">
                                <Label>Logo QR Code</Label>
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="upload">Unggah Baru</TabsTrigger>
                                        <TabsTrigger value="library">Dari Perpustakaan</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="upload" className="pt-2">
                                        <div className="flex gap-2">
                                            <Input
                                                id="logo"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                className="cursor-pointer"
                                            />
                                            {logo && (
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => { setLogo(null); setLogoId(null); }}
                                                    title="Hapus Logo"
                                                >
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="library" className="pt-2">
                                        <ScrollArea className="h-32 border rounded-md p-2">
                                            {logos.length === 0 ? (
                                                <p className="text-center text-xs text-muted-foreground py-8">Perpustakaan kosong.</p>
                                            ) : (
                                                <div className="grid grid-cols-5 gap-2">
                                                    {logos.map((l) => (
                                                        <button
                                                            key={l.id}
                                                            onClick={() => handleSelectLogo(l)}
                                                            className={cn(
                                                                "h-12 w-full rounded border overflow-hidden transition-all",
                                                                logoId === l.id ? "border-primary ring-2 ring-primary" : "hover:border-primary/50"
                                                            )}
                                                            title={l.name}
                                                        >
                                                            <img src={l.data} alt={l.name} className="h-full w-full object-contain bg-white" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </ScrollArea>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex gap-3">
                        <Button
                            className="flex-1"
                            disabled={!qrDataUrl}
                            onClick={downloadQR}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            PNG
                        </Button>
                        <Button
                            variant="secondary"
                            className="flex-1"
                            disabled={!qrDataUrl || isSaving}
                            onClick={handleSave}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            {isSaving ? "Menyimpan..." : editingId ? "Perbarui" : "Simpan"}
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1"
                            disabled={!qrDataUrl}
                            onClick={printQR}
                        >
                            <Printer className="mr-2 h-4 w-4" />
                            Cetak
                        </Button>
                    </div>
                </div>

                {/* Preview */}
                <div className="w-full md:w-[400px] flex flex-col items-center">
                    <Label className="mb-4 text-lg font-semibold">Pratinjau</Label>
                    <Card className="w-full aspect-[4/5] flex items-center justify-center bg-slate-50 relative overflow-hidden border-dashed border-2">
                        {qrDataUrl ? (
                            <div className="p-8 w-full h-full flex items-center justify-center">
                                <img
                                    src={qrDataUrl}
                                    alt="QR Preview"
                                    className="max-w-full max-h-full shadow-2xl rounded-xl"
                                />
                            </div>
                        ) : (
                            <div className="text-center p-8 text-muted-foreground">
                                <QrCode className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                <p>Masukkan teks untuk melihat pratinjau</p>
                            </div>
                        )}
                    </Card>
                    <canvas ref={canvasRef} className="hidden" />
                </div>
            </div>

            {/* History Table */}
            <div className="mt-20 space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold">Riwayat QR</h2>
                        <p className="text-muted-foreground">Kelola daftar QR code yang telah disimpan.</p>
                    </div>
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari nama atau konten..."
                            className="pl-9 bg-background"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama</TableHead>
                                <TableHead>Konten</TableHead>
                                <TableHead>Logo</TableHead>
                                <TableHead>Tanggal</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                                        Memuat riwayat...
                                    </TableCell>
                                </TableRow>
                            ) : history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Belum ada data.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                history.map((qr) => (
                                    <TableRow key={qr.id}>
                                        <TableCell className="font-medium">{qr.name}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">{qr.content}</TableCell>
                                        <TableCell>
                                            {qr.logo_data ? (
                                                <div className="h-8 w-8 rounded overflow-hidden border bg-white">
                                                    <img src={qr.logo_data} alt="logo" className="h-full w-full object-contain" />
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">No Logo</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(qr.created_at).toLocaleDateString("id-ID", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric"
                                            })}
                                        </TableCell>
                                        <TableCell className="text-right flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                title="Lihat & Edit"
                                                onClick={() => loadFromHistory(qr)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10 border-destructive/20">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Hapus QR ini?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Data <strong>{qr.name}</strong> akan dihapus permanen.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDelete(qr.id)}
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
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t">
                            <div className="text-sm text-muted-foreground">
                                Menampilkan {(page - 1) * 10 + 1} - {Math.min(page * 10, totalCount)} dari {totalCount} data
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Sebelumnya
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    Selanjutnya
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

// Minimal Lucide Icon if not imported
function QrCode({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <rect width="5" height="5" x="3" y="3" rx="1" />
            <rect width="5" height="5" x="16" y="3" rx="1" />
            <rect width="5" height="5" x="3" y="16" rx="1" />
            <path d="M21 16V21H16" />
            <path d="M21 11H16V16" />
            <path d="M12 16H8V21" />
            <path d="M11 11H8V3" />
            <path d="M12 7h1" />
        </svg>
    );
}
