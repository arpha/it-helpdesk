"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createReportCategory, deleteReportCategory } from "../actions";
import { toast } from "sonner";
import { Loader2, Plus, Tag, Trash2 } from "lucide-react";
import { CATEGORY_COLOR_CLASSES, type ReportCategory } from "@/types/report";

interface CategoryManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: ReportCategory[];
    onSuccess: () => void;
}

const COLOR_OPTIONS = [
    { value: "blue", label: "Biru" },
    { value: "green", label: "Hijau" },
    { value: "red", label: "Merah" },
    { value: "orange", label: "Oranye" },
    { value: "purple", label: "Ungu" },
    { value: "cyan", label: "Cyan" },
    { value: "gray", label: "Abu-abu" },
];

export function CategoryManagerDialog({
    open,
    onOpenChange,
    categories,
    onSuccess,
}: CategoryManagerDialogProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [color, setColor] = useState("blue");
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            const res = await createReportCategory({ name, description, color });
            if (res.success) {
                toast.success("Kategori baru ditambahkan.");
                setName("");
                setDescription("");
                setColor("blue");
                onSuccess();
            } else {
                toast.error(res.error || "Gagal menambah kategori.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await deleteReportCategory(id);
            if (res.success) {
                toast.success("Kategori dihapus.");
                onSuccess();
            } else {
                toast.error(res.error || "Gagal menghapus kategori.");
            }
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5 text-primary" />
                        Kelola Kategori Laporan
                    </DialogTitle>
                    <DialogDescription>
                        Tambah atau hapus kategori untuk mengelompokkan laporan inventaris.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreate} className="space-y-3 rounded-xl border p-3.5 bg-muted/20">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1 sm:col-span-2">
                            <Label htmlFor="cat-name" className="text-xs">
                                Nama Kategori *
                            </Label>
                            <Input
                                id="cat-name"
                                placeholder="Contoh: Laporan Audit Internal"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Warna Badge</Label>
                            <Select value={color} onValueChange={setColor}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {COLOR_OPTIONS.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>
                                            {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Deskripsi singkat (opsional)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="flex-1"
                        />
                        <Button type="submit" size="sm" disabled={isSaving} className="shrink-0">
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Tambah
                                </>
                            )}
                        </Button>
                    </div>
                </form>

                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Daftar Kategori ({categories.length})
                    </p>
                    <div className="divide-y rounded-xl border">
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                            >
                                <div className="min-w-0 space-y-0.5">
                                    <Badge
                                        variant="outline"
                                        className={
                                            CATEGORY_COLOR_CLASSES[cat.color] ||
                                            CATEGORY_COLOR_CLASSES.gray
                                        }
                                    >
                                        {cat.name}
                                    </Badge>
                                    {cat.description && (
                                        <p className="text-xs text-muted-foreground truncate">
                                            {cat.description}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                    disabled={deletingId === cat.id}
                                    onClick={() => handleDelete(cat.id)}
                                >
                                    {deletingId === cat.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                </Button>
                            </div>
                        ))}
                        {categories.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-6">
                                Belum ada kategori.
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
