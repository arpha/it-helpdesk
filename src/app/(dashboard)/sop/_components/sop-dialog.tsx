"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { saveSOPDocument } from "../actions";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";
import type { SOPDocument, SOPCategory } from "@/types/sop";

interface SOPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documentToEdit?: SOPDocument | null;
    onSuccess: () => void;
}

const CATEGORIES: SOPCategory[] = ['Helpdesk', 'Assets', 'ATK', 'IT Security', 'Umum'];

export function SOPDialog({ open, onOpenChange, documentToEdit, onSuccess }: SOPDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [title, setTitle] = useState("");
    const [documentNumber, setDocumentNumber] = useState("");
    const [category, setCategory] = useState<SOPCategory>("Umum");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState<"published" | "draft">("published");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    useEffect(() => {
        if (documentToEdit) {
            setTitle(documentToEdit.title || "");
            setDocumentNumber(documentToEdit.document_number || "");
            setCategory(documentToEdit.category || "Umum");
            setDescription(documentToEdit.description || "");
            setStatus(documentToEdit.status || "published");
            setSelectedFile(null);
        } else {
            setTitle("");
            setDocumentNumber("");
            setCategory("Umum");
            setDescription("");
            setStatus("published");
            setSelectedFile(null);
        }
    }, [documentToEdit, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error("Judul dokumen wajib diisi");
            return;
        }

        if (!documentToEdit && !selectedFile) {
            toast.error("File PDF wajib diunggah untuk dokumen baru");
            return;
        }

        setIsSubmitting(true);

        try {
            const formData = new FormData();
            if (documentToEdit) {
                formData.append("id", documentToEdit.id);
                formData.append("existing_file_url", documentToEdit.file_url || "");
                formData.append("existing_file_name", documentToEdit.file_name || "");
                formData.append("existing_file_size", (documentToEdit.file_size || 0).toString());
            }

            formData.append("title", title);
            formData.append("document_number", documentNumber);
            formData.append("category", category);
            formData.append("description", description);
            formData.append("status", status);

            if (selectedFile) {
                formData.append("file", selectedFile);
            }

            const res = await saveSOPDocument(formData);

            if (res.success) {
                toast.success(documentToEdit ? "Dokumen SOP diperbarui" : "Dokumen SOP berhasil diunggah");
                onOpenChange(false);
                onSuccess();
            } else {
                toast.error(res.error || "Gagal menyimpan dokumen");
            }
        } catch (error) {
            console.error(error);
            toast.error("Terjadi kesalahan saat menyimpan dokumen");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        {documentToEdit ? "Edit Dokumen SOP" : "Unggah Dokumen SOP PDF"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="title">Judul SOP / Pedoman <span className="text-destructive">*</span></Label>
                        <Input
                            id="title"
                            placeholder="Contoh: SOP Penanganan Gangguan Jaringan"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="doc_num">Nomor Dokumen</Label>
                            <Input
                                id="doc_num"
                                placeholder="Contoh: SOP/IT/2026/001"
                                value={documentNumber}
                                onChange={(e) => setDocumentNumber(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Kategori <span className="text-destructive">*</span></Label>
                            <Select value={category} onValueChange={(val) => setCategory(val as SOPCategory)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((cat) => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Deskripsi Singkat / Catatan</Label>
                        <Textarea
                            id="description"
                            placeholder="Ringkasan atau catatan mengenai SOP ini..."
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>File PDF <span className="text-destructive">{documentToEdit ? "" : "*"}</span></Label>
                        <div className="flex flex-col gap-2">
                            <Input
                                id="pdf_file"
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
                                            toast.error("File harus berformat PDF");
                                            e.target.value = "";
                                            return;
                                        }
                                        // Limit to 4 MB max due to serverless payload limits
                                        const maxBytes = 4 * 1024 * 1024;
                                        if (file.size > maxBytes) {
                                            toast.error("Ukuran file PDF terlalu besar. Batas maksimal adalah 4 MB.");
                                            e.target.value = "";
                                            setSelectedFile(null);
                                            return;
                                        }
                                        setSelectedFile(file);
                                    }
                                }}
                                className="cursor-pointer"
                            />
                            {documentToEdit && !selectedFile && (
                                <p className="text-xs text-muted-foreground truncate">
                                    File saat ini: <span className="font-medium">{documentToEdit.file_name}</span> (Biarkan kosong jika tidak diubah)
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Status Publikasi</Label>
                        <Select value={status} onValueChange={(val) => setStatus(val as "published" | "draft")}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="published">Published (Dapat dibaca semua)</SelectItem>
                                <SelectItem value="draft">Draft (Hanya Pengelola)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    {documentToEdit ? "Simpan Perubahan" : "Unggah & Simpan"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
