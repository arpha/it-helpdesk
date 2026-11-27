"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ChevronLeft,
    ChevronRight,
    Download,
    ExternalLink,
    FileSpreadsheet,
    FileText,
    Image as ImageIcon,
    Loader2,
    ZoomIn,
    ZoomOut,
    RotateCcw,
} from "lucide-react";
import { formatFileSize, type ReportAttachment } from "@/types/report";

interface ReportFilePreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attachments: ReportAttachment[];
    initialIndex?: number;
}

type PreviewKind = "pdf" | "image" | "spreadsheet" | "office" | "other";

function detectPreviewKind(att: ReportAttachment): PreviewKind {
    const name = (att.name || "").toLowerCase();
    const mime = (att.type || "").toLowerCase();

    if (name.endsWith(".pdf") || mime.includes("pdf")) return "pdf";
    if (
        /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name) ||
        mime.startsWith("image/")
    ) {
        return "image";
    }
    if (
        /\.(xlsx|xls|csv)$/.test(name) ||
        mime.includes("spreadsheet") ||
        mime.includes("excel") ||
        mime.includes("csv")
    ) {
        return "spreadsheet";
    }
    if (
        /\.(docx?|pptx?)$/.test(name) ||
        mime.includes("word") ||
        mime.includes("presentation") ||
        mime.includes("powerpoint")
    ) {
        return "office";
    }
    return "other";
}

interface ParsedSheet {
    name: string;
    rows: string[][];
}

export function ReportFilePreviewDialog({
    open,
    onOpenChange,
    attachments,
    initialIndex = 0,
}: ReportFilePreviewDialogProps) {
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);
    const [officeEngine, setOfficeEngine] = useState<"microsoft" | "google">("microsoft");

    // Spreadsheet local preview state
    const [sheets, setSheets] = useState<ParsedSheet[]>([]);
    const [activeSheetIdx, setActiveSheetIdx] = useState(0);
    const [isLoadingSheet, setIsLoadingSheet] = useState(false);
    const [sheetError, setSheetError] = useState<string | null>(null);
    const [useOfficeForExcel, setUseOfficeForExcel] = useState(false);

    useEffect(() => {
        if (open) {
            setActiveIndex(
                Math.min(Math.max(0, initialIndex), Math.max(0, attachments.length - 1))
            );
            setZoom(1);
            setOfficeEngine("microsoft");
            setUseOfficeForExcel(false);
        }
    }, [open, initialIndex, attachments.length]);

    const current = attachments[activeIndex] || null;
    const kind = current ? detectPreviewKind(current) : "other";

    // Parse Excel / CSV secara lokal agar cepat dan tidak bergantung viewer eksternal
    useEffect(() => {
        if (!open || !current || kind !== "spreadsheet" || useOfficeForExcel) {
            return;
        }

        let cancelled = false;
        setIsLoadingSheet(true);
        setSheetError(null);
        setSheets([]);
        setActiveSheetIdx(0);

        (async () => {
            try {
                const res = await fetch(current.url);
                if (!res.ok) throw new Error("Gagal mengambil file dari server.");
                const buffer = await res.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: "array" });

                const parsed: ParsedSheet[] = workbook.SheetNames.map((sheetName) => {
                    const sheet = workbook.Sheets[sheetName];
                    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
                        header: 1,
                        defval: "",
                    });
                    const normalized = rawRows.slice(0, 500).map((row) =>
                        (Array.isArray(row) ? row : []).map((cell) =>
                            cell === null || cell === undefined ? "" : String(cell)
                        )
                    );
                    return { name: sheetName, rows: normalized };
                });

                if (!cancelled) {
                    setSheets(parsed);
                }
            } catch (err) {
                console.error("Spreadsheet preview error:", err);
                if (!cancelled) {
                    setSheetError(
                        err instanceof Error
                            ? err.message
                            : "Gagal memuat pratinjau Excel."
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingSheet(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, current?.url, kind, useOfficeForExcel]);

    if (!current) return null;

    const officeViewerUrl =
        officeEngine === "microsoft"
            ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(current.url)}`
            : `https://docs.google.com/gview?url=${encodeURIComponent(current.url)}&embedded=true`;

    const activeSheet = sheets[activeSheetIdx];
    const maxCols = activeSheet
        ? Math.max(1, ...activeSheet.rows.map((r) => r.length))
        : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[960px] w-[95vw] h-[88vh] flex flex-col p-4 gap-3">
                <DialogHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b pr-8">
                    <div className="space-y-1 min-w-0">
                        <DialogTitle className="text-base font-semibold truncate flex items-center gap-2">
                            {kind === "image" ? (
                                <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                            ) : kind === "spreadsheet" ? (
                                <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                                <FileText className="h-4 w-4 text-primary shrink-0" />
                            )}
                            <span className="truncate">{current.name}</span>
                        </DialogTitle>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatFileSize(current.size)}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">
                                {current.name.split(".").pop() || "FILE"}
                            </Badge>
                            {attachments.length > 1 && (
                                <span>
                                    File {activeIndex + 1} dari {attachments.length}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {attachments.length > 1 && (
                            <div className="flex items-center gap-1 mr-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={activeIndex === 0}
                                    onClick={() => {
                                        setActiveIndex((i) => Math.max(0, i - 1));
                                        setZoom(1);
                                    }}
                                    title="File sebelumnya"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={activeIndex === attachments.length - 1}
                                    onClick={() => {
                                        setActiveIndex((i) =>
                                            Math.min(attachments.length - 1, i + 1)
                                        );
                                        setZoom(1);
                                    }}
                                    title="File berikutnya"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {kind === "image" && (
                            <div className="flex items-center gap-1 mr-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                                    title="Perkecil"
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setZoom(1)}
                                    title="Reset zoom"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                                    title="Perbesar"
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {kind === "office" && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() =>
                                    setOfficeEngine((e) =>
                                        e === "microsoft" ? "google" : "microsoft"
                                    )
                                }
                                title="Ganti viewer jika dokumen tidak muncul"
                            >
                                Viewer: {officeEngine === "microsoft" ? "Office" : "Google"}
                            </Button>
                        )}

                        {kind === "spreadsheet" && !current.name.toLowerCase().endsWith(".csv") && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => setUseOfficeForExcel((v) => !v)}
                            >
                                {useOfficeForExcel ? "Mode Tabel Cepat" : "Mode Office Viewer"}
                            </Button>
                        )}

                        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                            <a href={current.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Tab Baru
                            </a>
                        </Button>

                        <Button size="sm" className="h-8 text-xs" asChild>
                            <a
                                href={current.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={current.name || undefined}
                            >
                                <Download className="h-3.5 w-3.5 mr-1" />
                                Unduh
                            </a>
                        </Button>
                    </div>
                </DialogHeader>

                {/* Preview Body */}
                <div className="flex-1 w-full min-h-0 bg-muted/30 rounded-xl border overflow-hidden flex flex-col">
                    {kind === "pdf" && (
                        <iframe
                            src={`${current.url}#toolbar=1`}
                            className="w-full h-full border-0"
                            title={current.name}
                        />
                    )}

                    {kind === "image" && (
                        <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                            <img
                                src={current.url}
                                alt={current.name}
                                style={{
                                    transform: `scale(${zoom})`,
                                    transformOrigin: "center center",
                                }}
                                className="max-w-full max-h-full object-contain transition-transform duration-150 rounded-md shadow-sm"
                            />
                        </div>
                    )}

                    {kind === "office" && (
                        <iframe
                            key={`${current.url}-${officeEngine}`}
                            src={officeViewerUrl}
                            className="w-full h-full border-0 bg-white"
                            title={current.name}
                        />
                    )}

                    {kind === "spreadsheet" && useOfficeForExcel && (
                        <iframe
                            key={`${current.url}-office`}
                            src={officeViewerUrl}
                            className="w-full h-full border-0 bg-white"
                            title={current.name}
                        />
                    )}

                    {kind === "spreadsheet" && !useOfficeForExcel && (
                        <div className="flex flex-col h-full min-h-0">
                            {isLoadingSheet ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <span className="text-sm">Memuat pratinjau spreadsheet...</span>
                                </div>
                            ) : sheetError ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                                    <p className="text-sm text-destructive">{sheetError}</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setUseOfficeForExcel(true)}
                                    >
                                        Coba Buka dengan Office Viewer
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    {sheets.length > 1 && (
                                        <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-card overflow-x-auto shrink-0">
                                            {sheets.map((sh, idx) => (
                                                <Button
                                                    key={sh.name}
                                                    type="button"
                                                    size="sm"
                                                    variant={
                                                        activeSheetIdx === idx
                                                            ? "default"
                                                            : "outline"
                                                    }
                                                    className="h-7 text-xs shrink-0"
                                                    onClick={() => setActiveSheetIdx(idx)}
                                                >
                                                    {sh.name}
                                                </Button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex-1 overflow-auto bg-background">
                                        {activeSheet && activeSheet.rows.length > 0 ? (
                                            <table className="w-full border-collapse text-xs">
                                                <tbody>
                                                    {activeSheet.rows.map((row, rIdx) => (
                                                        <tr
                                                            key={rIdx}
                                                            className={
                                                                rIdx === 0
                                                                    ? "bg-muted/60 font-semibold sticky top-0"
                                                                    : "hover:bg-muted/30"
                                                            }
                                                        >
                                                            <td className="border border-border/60 px-2 py-1.5 text-center text-muted-foreground bg-muted/30 w-10 select-none">
                                                                {rIdx + 1}
                                                            </td>
                                                            {Array.from({ length: maxCols }).map(
                                                                (_, cIdx) => (
                                                                    <td
                                                                        key={cIdx}
                                                                        className="border border-border/60 px-2.5 py-1.5 whitespace-pre-wrap max-w-[320px] align-top"
                                                                    >
                                                                        {row[cIdx] ?? ""}
                                                                    </td>
                                                                )
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-8 text-center text-sm text-muted-foreground">
                                                Sheet ini kosong.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {kind === "other" && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                            <FileText className="h-12 w-12 opacity-40" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">
                                    Pratinjau langsung tidak tersedia untuk format file ini.
                                </p>
                                <p className="text-xs">
                                    Silakan unduh atau buka di tab baru untuk melihat isinya.
                                </p>
                            </div>
                            <Button size="sm" asChild>
                                <a
                                    href={current.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={current.name || undefined}
                                >
                                    <Download className="h-4 w-4 mr-1.5" />
                                    Unduh File
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
