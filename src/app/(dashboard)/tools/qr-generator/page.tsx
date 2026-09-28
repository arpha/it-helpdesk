"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Download,
    Printer,
    Upload,
    Link as LinkIcon,
    RefreshCw,
    Save,
    Trash2,
    Eye,
    Search,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Palette,
    Copy,
    Check,
    ExternalLink,
    SlidersHorizontal,
    Image as ImageIcon,
    Plus,
    X,
    QrCode as QrIcon
} from "lucide-react";
import QRCode from "qrcode";
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

export interface QRTheme {
    id: string;
    name: string;
    gradientStart: string;
    gradientEnd: string;
    cardBg: string;
    textColor: string;
    dotColor: string;
    swatchClass: string;
}

const QR_THEMES: QRTheme[] = [
    {
        id: "modern_indigo",
        name: "Indigo Violet",
        gradientStart: "#2563eb",
        gradientEnd: "#7c3aed",
        cardBg: "#ffffff",
        textColor: "#ffffff",
        dotColor: "#000000",
        swatchClass: "from-blue-600 to-violet-600",
    },
    {
        id: "emerald_teal",
        name: "Emerald Mint",
        gradientStart: "#059669",
        gradientEnd: "#0d9488",
        cardBg: "#ffffff",
        textColor: "#ffffff",
        dotColor: "#000000",
        swatchClass: "from-emerald-600 to-teal-600",
    },
    {
        id: "sunset_glow",
        name: "Sunset Rose",
        gradientStart: "#f97316",
        gradientEnd: "#e11d48",
        cardBg: "#ffffff",
        textColor: "#ffffff",
        dotColor: "#000000",
        swatchClass: "from-orange-500 to-rose-600",
    },
    {
        id: "ocean_cyan",
        name: "Ocean Breeze",
        gradientStart: "#0284c7",
        gradientEnd: "#2563eb",
        cardBg: "#ffffff",
        textColor: "#ffffff",
        dotColor: "#000000",
        swatchClass: "from-sky-600 to-blue-600",
    },
    {
        id: "midnight_slate",
        name: "Midnight Dark",
        gradientStart: "#0f172a",
        gradientEnd: "#1e293b",
        cardBg: "#ffffff",
        textColor: "#ffffff",
        dotColor: "#000000",
        swatchClass: "from-slate-900 to-slate-800",
    },
    {
        id: "ruby_crimson",
        name: "Ruby Flame",
        gradientStart: "#dc2626",
        gradientEnd: "#991b1b",
        cardBg: "#ffffff",
        textColor: "#ffffff",
        dotColor: "#000000",
        swatchClass: "from-red-600 to-red-800",
    },
    {
        id: "minimal_mono",
        name: "Monokrom",
        gradientStart: "#f1f5f9",
        gradientEnd: "#cbd5e1",
        cardBg: "#ffffff",
        textColor: "#0f172a",
        dotColor: "#000000",
        swatchClass: "from-slate-200 to-slate-400 border border-slate-300",
    },
];

export default function QRGeneratorPage() {
    const [text, setText] = useState("");
    const [name, setName] = useState("");
    const [logo, setLogo] = useState<string | null>(null);
    const [logoId, setLogoId] = useState<string | null>(null);
    const [selectedThemeId, setSelectedThemeId] = useState<string>("modern_indigo");
    const [dotStyle, setDotStyle] = useState<"rounded" | "square">("rounded");
    const [showBottomText, setShowBottomText] = useState(true);
    const [bottomText, setBottomText] = useState("PINDAI SAYA");
    const [copiedContentId, setCopiedContentId] = useState<string | null>(null);
    const [copiedImage, setCopiedImage] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const logoImgRef = useRef<HTMLImageElement | null>(null);
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

    const activeTheme = QR_THEMES.find((t) => t.id === selectedThemeId) || QR_THEMES[0];

    useEffect(() => {
        fetchHistory();
        fetchLogos();
    }, []);

    const fetchHistory = async (p = page, q = searchQuery) => {
        setIsLoading(true);
        const res = await getQRCodes({ page: p, search: q, pageSize: 8 });
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
            setPage(1);
            fetchHistory(1, searchQuery);
        }, 400);
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

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const originalSizeKB = (file.size / 1024).toFixed(0);

        const reader = new FileReader();
        reader.onload = (event) => {
            const raw = event.target?.result as string;

            // Auto-compress: resize to max 300x300 and encode as JPEG 85%
            const img = new window.Image();
            img.onload = () => {
                const MAX = 300;
                const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);

                const offscreen = document.createElement("canvas");
                offscreen.width = w;
                offscreen.height = h;
                const ctx = offscreen.getContext("2d")!;
                ctx.drawImage(img, 0, 0, w, h);
                const compressed = offscreen.toDataURL("image/png");

                const compressedSizeKB = Math.round((compressed.length * 0.75) / 1024);
                if (file.size > 100 * 1024) {
                    toast.success(`Logo dioptimalkan: ${originalSizeKB}KB → ${compressedSizeKB}KB`);
                } else {
                    toast.success("Logo berhasil diunggah!");
                }

                setLogo(compressed);
                setLogoId(null);
            };
            img.src = raw;
        };
        reader.readAsDataURL(file);
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
        setBottomText("PINDAI SAYA");
        toast.info("Siap membuat desain QR baru");
    };

    // Preload logo image once when logo src changes
    useEffect(() => {
        if (!logo) {
            logoImgRef.current = null;
            return;
        }
        const img = new window.Image();
        img.onload = () => {
            logoImgRef.current = img;
            generateQR();
        };
        img.src = logo;
    }, [logo]);

    useEffect(() => {
        const timer = setTimeout(() => {
            generateQR();
        }, 200);
        return () => clearTimeout(timer);
    }, [text, logo, selectedThemeId, dotStyle, showBottomText, bottomText]);

    const generateQR = () => {
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
        const bottomBannerHeight = showBottomText && bottomText.trim() ? 180 : 0;
        canvas.width = size;
        canvas.height = size + bottomBannerHeight;

        try {
            // 1. Get QR Data Matrix
            const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
            const modules = qr.modules;
            const moduleCount = modules.size;

            // 2. Setup Background & Frame
            const gradient = ctx.createLinearGradient(0, 0, size, size + bottomBannerHeight);
            gradient.addColorStop(0, activeTheme.gradientStart);
            gradient.addColorStop(1, activeTheme.gradientEnd);

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size + bottomBannerHeight);

            const qrPadding = 56;
            const qrSize = size - qrPadding * 2;
            ctx.fillStyle = activeTheme.cardBg;
            ctx.beginPath();
            ctx.roundRect(qrPadding, qrPadding, qrSize, qrSize, 44);
            ctx.fill();

            // 3. Draw Modules
            const cellSize = (qrSize - 64) / moduleCount;
            const startX = qrPadding + 32;
            const startY = qrPadding + 32;

            ctx.fillStyle = activeTheme.dotColor;

            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    const isDark = modules.get(row, col);
                    if (!isDark) continue;

                    // Skip Finder Patterns
                    const isFinderPattern =
                        (row < 7 && col < 7) ||
                        (row < 7 && col >= moduleCount - 7) ||
                        (row >= moduleCount - 7 && col < 7);

                    if (isFinderPattern) continue;

                    if (dotStyle === "rounded") {
                        const x = startX + col * cellSize + cellSize / 2;
                        const y = startY + row * cellSize + cellSize / 2;
                        ctx.beginPath();
                        ctx.arc(x, y, cellSize * 0.42, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        const x = startX + col * cellSize;
                        const y = startY + row * cellSize;
                        ctx.fillRect(x, y, cellSize * 0.95, cellSize * 0.95);
                    }
                }
            }

            // 4. Draw Custom Finder Patterns (Eyes)
            const drawEye = (x: number, y: number) => {
                const eyeSize = cellSize * 7;

                // Outer ring
                ctx.strokeStyle = activeTheme.dotColor;
                ctx.lineWidth = cellSize;
                ctx.beginPath();
                ctx.roundRect(
                    x + cellSize / 2,
                    y + cellSize / 2,
                    eyeSize - cellSize,
                    eyeSize - cellSize,
                    dotStyle === "rounded" ? eyeSize * 0.25 : 0
                );
                ctx.stroke();

                // Inner dot
                ctx.fillStyle = activeTheme.dotColor;
                ctx.beginPath();
                ctx.roundRect(
                    x + cellSize * 2,
                    y + cellSize * 2,
                    eyeSize - cellSize * 4,
                    eyeSize - cellSize * 4,
                    dotStyle === "rounded" ? eyeSize * 0.18 : 0
                );
                ctx.fill();
            };

            drawEye(startX, startY); // Top Left
            drawEye(startX + (moduleCount - 7) * cellSize, startY); // Top Right
            drawEye(startX, startY + (moduleCount - 7) * cellSize); // Bottom Left

            // 5. Draw Logo
            if (logo && logoImgRef.current) {
                const logoImg = logoImgRef.current;
                const logoSize = qrSize * 0.24;
                const center = size / 2;

                // White circle background with subtle shadow
                ctx.save();
                ctx.beginPath();
                ctx.arc(center, center, logoSize / 2 + 12, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.shadowColor = "rgba(0,0,0,0.18)";
                ctx.shadowBlur = 12;
                ctx.fill();
                ctx.restore();

                // Clip & draw logo
                ctx.save();
                ctx.beginPath();
                ctx.arc(center, center, logoSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(logoImg, center - logoSize / 2, center - logoSize / 2, logoSize, logoSize);
                ctx.restore();
            }

            // 6. Text at Bottom
            if (showBottomText && bottomText.trim()) {
                ctx.fillStyle = activeTheme.textColor;
                ctx.font = "bold 74px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(bottomText.trim().toUpperCase(), size / 2, size + bottomBannerHeight / 2);
            }

            setQrDataUrl(canvas.toDataURL("image/png"));
        } catch (err) {
            console.error(err);
        }
    };

    const downloadQR = () => {
        if (!qrDataUrl) return;
        const link = document.createElement("a");
        const cleanName = (name || "qr-code").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
        link.download = `${cleanName}-${Date.now()}.png`;
        link.href = qrDataUrl;
        link.click();
        toast.success("QR Code berhasil diunduh dalam resolusi HD!");
    };

    const copyImageToClipboard = async () => {
        if (!canvasRef.current) return;
        try {
            canvasRef.current.toBlob(async (blob) => {
                if (blob) {
                    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                    setCopiedImage(true);
                    toast.success("Gambar QR berhasil disalin! Siap ditempel (Ctrl+V) ke dokumen atau chat.");
                    setTimeout(() => setCopiedImage(false), 2500);
                }
            });
        } catch {
            toast.error("Browser tidak mendukung penyalinan gambar langsung.");
        }
    };

    const printQR = () => {
        const win = window.open("", "_blank");
        if (!win) return;
        win.document.write(`
            <html>
                <head>
                    <title>Cetak QR Code - ${name || "SI-Mantap"}</title>
                    <style>
                        body {
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            margin: 0;
                            font-family: sans-serif;
                            background-color: #ffffff;
                        }
                        .qr-card {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            padding: 24px;
                            border: 1px solid #e2e8f0;
                            border-radius: 16px;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.06);
                        }
                        img {
                            max-width: 7cm;
                            max-height: 7cm;
                            border-radius: 12px;
                        }
                        .title {
                            margin-top: 14px;
                            font-size: 16px;
                            font-weight: bold;
                            color: #1e293b;
                        }
                        .content {
                            margin-top: 4px;
                            font-size: 12px;
                            color: #64748b;
                            max-width: 7cm;
                            word-break: break-all;
                            text-align: center;
                        }
                    </style>
                </head>
                <body onload="window.print();window.close()">
                    <div class="qr-card">
                        <img src="${qrDataUrl}" />
                        ${name ? `<div class="title">${name}</div>` : ""}
                        <div class="content">${text}</div>
                    </div>
                </body>
            </html>
        `);
        win.document.close();
    };

    const handleSave = async () => {
        if (!text || !name) {
            toast.error("Nama dan Tautan/Konten QR wajib diisi terlebih dahulu!");
            return;
        }

        setIsSaving(true);
        let finalLogoId = logoId;
        let finalLogoData = finalLogoId ? null : logo;

        if (logo && !finalLogoId) {
            const logoRes = await saveLogo(`Logo untuk ${name}`, logo);
            if (logoRes.success && logoRes.data) {
                finalLogoId = logoRes.data.id;
                finalLogoData = null;
                setLogoId(finalLogoId);
                fetchLogos();
            }
        }

        const res = await saveQRCode({
            id: editingId,
            name,
            content: text,
            logo_id: finalLogoId,
            logo_data: finalLogoData,
        });

        if (res.success) {
            toast.success(editingId ? "QR Code berhasil diperbarui!" : "QR Code berhasil disimpan ke riwayat!");
            const savedId = res.data.id;
            setEditingId(savedId);

            const newItem: CustomQR = {
                id: savedId,
                name,
                content: text,
                logo_data: logo,
                logo_id: finalLogoId,
                created_at: res.data.created_at || new Date().toISOString(),
                created_by: res.data.created_by || null,
            };

            setHistory((prev) => {
                if (editingId) {
                    return prev.map((item) => (item.id === editingId ? newItem : item));
                } else {
                    return [newItem, ...prev];
                }
            });
        } else {
            toast.error("Gagal menyimpan: " + res.error);
        }
        setIsSaving(false);
    };

    const handleDelete = async (id: string) => {
        const res = await deleteQRCode(id);
        if (res.success) {
            toast.success("QR Code berhasil dihapus dari riwayat!");
            if (editingId === id) {
                handleNew();
            }
            fetchHistory();
        } else {
            toast.error("Gagal menghapus: " + res.error);
        }
    };

    const loadFromHistory = (qr: CustomQR) => {
        setQrDataUrl(null);
        setText(qr.content);
        setName(qr.name);
        setLogo(qr.logo_data);
        setLogoId(qr.logo_id);
        setEditingId(qr.id);

        if (qr.logo_id) {
            setActiveTab("library");
        } else if (qr.logo_data) {
            setActiveTab("upload");
        }

        toast.info(`Memuat data "${qr.name}"`);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCopyContent = (content: string, id: string) => {
        navigator.clipboard.writeText(content);
        setCopiedContentId(id);
        toast.success("Konten link berhasil disalin!");
        setTimeout(() => setCopiedContentId(null), 2000);
    };

    const isUrl = (val: string) => /^https?:\/\//i.test(val.trim());

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-blue-600/10 via-violet-600/10 to-transparent p-6 sm:p-8 backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                            <Sparkles className="h-3.5 w-3.5" /> Studio QR Code Generator
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                            Pembuat Kode QR Profesional
                        </h1>
                        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                            Buat kode QR kustom beresolusi tinggi dengan logo instansi, pilihan palet warna modern, dan teks penjelas yang siap dicetak atau dibagikan.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {editingId && (
                            <Button variant="outline" size="sm" onClick={handleNew} className="gap-2">
                                <Plus className="h-4 w-4" /> Buat Baru
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Studio Layout: 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Customization Controls */}
                <div className="lg:col-span-7 space-y-6">
                    {/* Step 1: Content & Label */}
                    <Card className="shadow-xs border-border/60">
                        <CardHeader className="pb-4 border-b">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <LinkIcon className="h-4 w-4 text-blue-500" />
                                1. Informasi & Konten QR
                            </CardTitle>
                            <CardDescription>
                                Masukkan nama identitas QR dan tujuan tautan URL atau teks yang akan dipindai.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="name" className="text-xs font-semibold">Nama / Label QR *</Label>
                                    {editingId && (
                                        <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-500/10 border-amber-500/20">
                                            Sedang Diedit
                                        </Badge>
                                    )}
                                </div>
                                <Input
                                    id="name"
                                    placeholder="Contoh: Wi-Fi Tamu RS, Formulir Pendaftaran, SOP Server"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="h-10"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="url" className="text-xs font-semibold">Link URL atau Teks Konten *</Label>
                                    {isUrl(text) && (
                                        <a
                                            href={text}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                                        >
                                            Uji Buka Tautan <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                                <Input
                                    id="url"
                                    placeholder="https://contoh-link.com atau teks apa saja..."
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    className="h-10 font-mono text-xs"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Step 2: Styling & Colors */}
                    <Card className="shadow-xs border-border/60">
                        <CardHeader className="pb-4 border-b">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Palette className="h-4 w-4 text-violet-500" />
                                2. Desain, Palet Warna & Tampilan
                            </CardTitle>
                            <CardDescription>
                                Pilih tema warna gradien, bentuk titik modul, dan label teks bawah.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-6">
                            {/* Color Theme Selector */}
                            <div className="space-y-2.5">
                                <Label className="text-xs font-semibold">Palet Warna Bingkai</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    {QR_THEMES.map((theme) => {
                                        const isSelected = selectedThemeId === theme.id;
                                        return (
                                            <button
                                                key={theme.id}
                                                type="button"
                                                onClick={() => setSelectedThemeId(theme.id)}
                                                className={cn(
                                                    "group relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all",
                                                    isSelected
                                                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                                                        : "hover:border-border hover:bg-muted/40"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "h-6 w-6 rounded-full bg-gradient-to-br shadow-inner shrink-0",
                                                        theme.swatchClass
                                                    )}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-medium text-foreground truncate">
                                                        {theme.name}
                                                    </p>
                                                </div>
                                                {isSelected && (
                                                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Dot Style & Bottom Text Toggle */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                {/* Dot Style */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">Gaya Titik QR</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant={dotStyle === "rounded" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setDotStyle("rounded")}
                                            className="h-9 text-xs"
                                        >
                                            Bulat Halus
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={dotStyle === "square" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setDotStyle("square")}
                                            className="h-9 text-xs"
                                        >
                                            Kotak Klasik
                                        </Button>
                                    </div>
                                </div>

                                {/* Bottom Banner Toggle */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">Format Bingkai</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant={showBottomText ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setShowBottomText(true)}
                                            className="h-9 text-xs"
                                        >
                                            Dengan Teks
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={!showBottomText ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setShowBottomText(false)}
                                            className="h-9 text-xs"
                                        >
                                            Persegi Saja
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Text Input (if enabled) */}
                            {showBottomText && (
                                <div className="space-y-1.5 pt-1">
                                    <Label htmlFor="bottomText" className="text-xs font-semibold">Teks Label Bawah</Label>
                                    <Input
                                        id="bottomText"
                                        placeholder="Contoh: PINDAI SAYA, SCAN DISINI, IT HELPDESK"
                                        value={bottomText}
                                        onChange={(e) => setBottomText(e.target.value)}
                                        className="h-9 text-xs uppercase"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Step 3: Logo Integration */}
                    <Card className="shadow-xs border-border/60">
                        <CardHeader className="pb-4 border-b">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4 text-emerald-500" />
                                        3. Sisipkan Logo di Tengah (Opsional)
                                    </CardTitle>
                                    <CardDescription>
                                        Tambahkan logo instansi untuk identitas visual yang profesional.
                                    </CardDescription>
                                </div>
                                {logo && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setLogo(null); setLogoId(null); }}
                                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                    >
                                        <X className="h-3.5 w-3.5 mr-1" /> Hapus Logo
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {/* Selected Logo Preview Chip */}
                            {logo && (
                                <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/40 text-xs">
                                    <div className="h-10 w-10 rounded-md border bg-white p-1 shrink-0 overflow-hidden flex items-center justify-center">
                                        <img src={logo} alt="Logo Terpilih" className="h-full w-full object-contain" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-foreground truncate">
                                            {logoId ? logos.find((l) => l.id === logoId)?.name || "Logo Terpilih" : "Logo Kustom Terunggah"}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">Siap dipasang di titik tengah QR Code</p>
                                    </div>
                                </div>
                            )}

                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 h-9">
                                    <TabsTrigger value="upload" className="text-xs">Unggah Logo Baru</TabsTrigger>
                                    <TabsTrigger value="library" className="text-xs">Perpustakaan Logo ({logos.length})</TabsTrigger>
                                </TabsList>

                                <TabsContent value="upload" className="pt-3">
                                    <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 hover:bg-muted/30 transition-colors">
                                        <Upload className="h-8 w-8 text-muted-foreground/60 mb-2" />
                                        <p className="text-xs font-semibold text-foreground">Klik untuk memilih file logo</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, atau SVG (Otomatis dioptimalkan)</p>
                                        <Input
                                            id="logoUpload"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            className="mt-3 max-w-xs cursor-pointer text-xs"
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="library" className="pt-3">
                                    <ScrollArea className="h-36 border rounded-xl p-2.5 bg-muted/10">
                                        {logos.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground text-xs">
                                                <ImageIcon className="h-6 w-6 mb-1 opacity-40" />
                                                <p>Belum ada logo tersimpan di perpustakaan.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                {logos.map((l) => {
                                                    const isSelected = logoId === l.id;
                                                    return (
                                                        <button
                                                            key={l.id}
                                                            type="button"
                                                            onClick={() => handleSelectLogo(l)}
                                                            className={cn(
                                                                "group relative flex flex-col items-center p-2 rounded-lg border transition-all text-center",
                                                                isSelected
                                                                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                                                                    : "hover:border-border hover:bg-muted/40"
                                                            )}
                                                            title={l.name}
                                                        >
                                                            <div className="h-10 w-full rounded bg-white p-1 flex items-center justify-center mb-1 overflow-hidden">
                                                                <img src={l.data} alt={l.name} className="h-full w-full object-contain" />
                                                            </div>
                                                            <span className="text-[10px] font-medium text-foreground truncate w-full">
                                                                {l.name}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Live Studio Preview Panel (Sticky) */}
                <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
                    <Card className="shadow-md border-border/60 overflow-hidden">
                        <CardHeader className="pb-3 border-b bg-muted/30">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <QrIcon className="h-4 w-4 text-primary" />
                                    Pratinjau Hasil Live
                                </CardTitle>
                                <Badge variant="secondary" className="text-[11px] font-medium">
                                    {activeTheme.name}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 flex flex-col items-center justify-center">
                            {/* Visual Display Box */}
                            <div className="w-full flex flex-col items-center justify-center min-h-[360px] rounded-xl bg-radial from-muted/50 to-muted/10 border p-4 relative overflow-hidden">
                                {qrDataUrl ? (
                                    <div className="flex flex-col items-center space-y-3">
                                        <div className="relative group">
                                            <img
                                                src={qrDataUrl}
                                                alt="Pratinjau QR Code"
                                                className="w-64 max-w-full rounded-2xl shadow-xl transition-transform duration-300 group-hover:scale-[1.02]"
                                            />
                                        </div>
                                        <p className="text-[11px] text-muted-foreground font-mono">
                                            Resolusi HD 1000px • Format PNG
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center p-8 space-y-3 text-muted-foreground">
                                        <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center border border-dashed">
                                            <QrIcon className="h-8 w-8 opacity-40" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-foreground">Menunggu Masukan Konten</p>
                                            <p className="text-xs text-muted-foreground max-w-xs">
                                                Ketik nama dan URL atau teks di panel kiri untuk melihat pratinjau instan di sini.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Hidden canvas for generation */}
                            <canvas ref={canvasRef} className="hidden" />

                            {/* Studio Action Buttons */}
                            <div className="w-full space-y-2.5 pt-5">
                                <div className="grid grid-cols-2 gap-2.5">
                                    <Button
                                        className="w-full gap-2 shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                                        disabled={!qrDataUrl}
                                        onClick={downloadQR}
                                    >
                                        <Download className="h-4 w-4" />
                                        Unduh PNG
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="w-full gap-2"
                                        disabled={!qrDataUrl}
                                        onClick={copyImageToClipboard}
                                    >
                                        {copiedImage ? (
                                            <>
                                                <Check className="h-4 w-4 text-emerald-600" />
                                                Tersalin!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-4 w-4" />
                                                Salin Gambar
                                            </>
                                        )}
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    <Button
                                        variant="secondary"
                                        className="w-full gap-2"
                                        disabled={!qrDataUrl || isSaving}
                                        onClick={handleSave}
                                    >
                                        <Save className="h-4 w-4" />
                                        {isSaving ? "Menyimpan..." : editingId ? "Perbarui" : "Simpan Riwayat"}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="w-full gap-2"
                                        disabled={!qrDataUrl}
                                        onClick={printQR}
                                    >
                                        <Printer className="h-4 w-4" />
                                        Cetak Lembar
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* History Table Section */}
            <div className="pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold tracking-tight">Koleksi & Riwayat QR Code</h2>
                            <Badge variant="outline" className="text-xs">
                                {totalCount} Tersimpan
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Daftar kode QR yang pernah Anda simpan, siap dipakai atau dicetak kembali kapan saja.
                        </p>
                    </div>

                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari berdasarkan nama atau isi..."
                            className="pl-9 h-9 text-xs bg-background"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <Card className="shadow-xs border-border/60 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow>
                                <TableHead className="w-12 text-center">#</TableHead>
                                <TableHead>Nama QR</TableHead>
                                <TableHead>Tautan / Konten</TableHead>
                                <TableHead className="text-center">Logo</TableHead>
                                <TableHead>Tanggal Dibuat</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                                        Memuat data riwayat QR...
                                    </TableCell>
                                </TableRow>
                            ) : history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        <QrIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                        <p className="font-medium text-foreground text-sm">Belum Ada Riwayat QR Code</p>
                                        <p className="text-xs mt-1">Buat kode QR baru menggunakan formulir di atas lalu klik "Simpan Riwayat".</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                history.map((qr, index) => (
                                    <TableRow key={qr.id} className="hover:bg-muted/30">
                                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                            {(page - 1) * 8 + index + 1}
                                        </TableCell>
                                        <TableCell>
                                            <p className="font-semibold text-sm text-foreground">{qr.name}</p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 max-w-[260px]">
                                                <span className="truncate text-xs font-mono text-muted-foreground">
                                                    {qr.content}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                                                    onClick={() => handleCopyContent(qr.content, qr.id)}
                                                    title="Salin Link/Teks"
                                                >
                                                    {copiedContentId === qr.id ? (
                                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {qr.logo_data ? (
                                                <div className="h-7 w-7 rounded-md border bg-white p-0.5 mx-auto overflow-hidden flex items-center justify-center shadow-2xs">
                                                    <img src={qr.logo_data} alt="logo" className="h-full w-full object-contain" />
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {new Date(qr.created_at).toLocaleDateString("id-ID", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric"
                                            })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center gap-1.5">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs gap-1.5"
                                                    onClick={() => loadFromHistory(qr)}
                                                >
                                                    <Eye className="h-3.5 w-3.5" /> Muat
                                                </Button>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Hapus QR Code ini?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Data <strong>{qr.name}</strong> akan dihapus permanen dari sistem.
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
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t bg-muted/20">
                            <div className="text-xs text-muted-foreground">
                                Menampilkan {(page - 1) * 8 + 1} sampai {Math.min(page * 8, totalCount)} dari {totalCount} data
                            </div>
                            <div className="flex gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                                    Sebelumnya
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    Selanjutnya
                                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
