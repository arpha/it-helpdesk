"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    BookOpen,
    Search,
    Plus,
    FileText,
    Download,
    Eye,
    Edit3,
    Trash2,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    FileDown,
    ShieldAlert
} from "lucide-react";
import { getSOPDocuments, deleteSOPDocument } from "./actions";
import { SOPDialog } from "./_components/sop-dialog";
import { SOPViewerDialog } from "./_components/sop-viewer-dialog";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import type { SOPDocument, SOPCategory } from "@/types/sop";

const CATEGORIES: (SOPCategory | "All")[] = ["All", "Helpdesk", "Assets", "ATK", "IT Security", "Umum"];

function formatFileSize(bytes?: number | null) {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SOPPage() {
    const { user } = useAuthStore();
    const role = user?.role || "user";
    const canManage = ["admin", "staff_it", "manager_it"].includes(role);

    const [documents, setDocuments] = useState<SOPDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<SOPCategory | "All">("All");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Modals
    const [dialogOpen, setDialogOpen] = useState(false);
    const [documentToEdit, setDocumentToEdit] = useState<SOPDocument | null>(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [documentToView, setDocumentToView] = useState<SOPDocument | null>(null);

    const fetchDocuments = async (p = page, q = searchQuery, cat = selectedCategory) => {
        setIsLoading(true);
        const res = await getSOPDocuments({
            page: p,
            search: q,
            category: cat,
            pageSize: 10
        });

        if (res.success && res.data) {
            setDocuments(res.data);
            setTotalPages(res.totalPages || 1);
            setTotalCount(res.count || 0);
        } else if (res.error) {
            toast.error("Gagal memuat dokumen: " + res.error);
        }
        setIsLoading(false);
    };

    // Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchDocuments(1, searchQuery, selectedCategory);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Filter & Page changes
    useEffect(() => {
        fetchDocuments(page, searchQuery, selectedCategory);
    }, [page, selectedCategory]);

    const handleCreate = () => {
        setDocumentToEdit(null);
        setDialogOpen(true);
    };

    const handleEdit = (doc: SOPDocument) => {
        setDocumentToEdit(doc);
        setDialogOpen(true);
    };

    const handleView = (doc: SOPDocument) => {
        setDocumentToView(doc);
        setViewerOpen(true);
    };

    const handleDelete = async (id: string) => {
        const res = await deleteSOPDocument(id);
        if (res.success) {
            toast.success("Dokumen SOP berhasil dihapus");
            fetchDocuments();
        } else {
            toast.error("Gagal menghapus dokumen: " + res.error);
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <BookOpen className="h-8 w-8 text-primary" />
                        SOP & Pedoman Center
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Pusat dokumen Standar Operasional Prosedur dan Pedoman Kerja SI-Mantap.
                    </p>
                </div>

                {canManage && (
                    <Button onClick={handleCreate} className="shrink-0">
                        <Plus className="h-4 w-4 mr-2" />
                        Unggah SOP PDF
                    </Button>
                )}
            </div>

            {/* Filter & Search Controls */}
            <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari judul, nomor dokumen..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        {CATEGORIES.map((cat) => (
                            <Button
                                key={cat}
                                variant={selectedCategory === cat ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setSelectedCategory(cat);
                                    setPage(1);
                                }}
                            >
                                {cat === "All" ? "Semua Kategori" : cat}
                            </Button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Documents Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Dokumen</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead>Ukuran File</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Tanggal</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12">
                                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                                    Memuat daftar dokumen SOP...
                                </TableCell>
                            </TableRow>
                        ) : documents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                    Belum ada dokumen SOP yang ditemukan.
                                </TableCell>
                            </TableRow>
                        ) : (
                            documents.map((doc) => (
                                <TableRow key={doc.id}>
                                    <TableCell className="max-w-[300px]">
                                        <div className="font-medium truncate flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-red-500 shrink-0" />
                                            <span className="truncate">{doc.title}</span>
                                        </div>
                                        {doc.document_number && (
                                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                                No: {doc.document_number}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-muted/50">
                                            {doc.category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {formatFileSize(doc.file_size)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={doc.status === "published" ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"}>
                                            {doc.status === "published" ? "Published" : "Draft"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(doc.created_at).toLocaleDateString("id-ID", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric"
                                        })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Pratinjau PDF"
                                                onClick={() => handleView(doc)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Unduh PDF"
                                                asChild
                                            >
                                                <a href={doc.file_url} download={doc.file_name}>
                                                    <Download className="h-4 w-4" />
                                                </a>
                                            </Button>

                                            {canManage && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Edit Metadata"
                                                        onClick={() => handleEdit(doc)}
                                                    >
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>

                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                title="Hapus Dokumen"
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Hapus Dokumen SOP?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Dokumen <strong>{doc.title}</strong> akan dihapus secara permanen.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => handleDelete(doc.id)}
                                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                >
                                                                    Hapus
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </>
                                            )}
                                        </div>
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
                            Menampilkan {(page - 1) * 10 + 1} - {Math.min(page * 10, totalCount)} dari {totalCount} dokumen
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

            {/* Upload/Edit Dialog */}
            <SOPDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                documentToEdit={documentToEdit}
                onSuccess={() => fetchDocuments()}
            />

            {/* Viewer Dialog */}
            <SOPViewerDialog
                open={viewerOpen}
                onOpenChange={setViewerOpen}
                document={documentToView}
            />
        </div>
    );
}
