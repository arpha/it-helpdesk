"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  SelectValue,
} from "@/components/ui/select";
import { saveKBArticle } from "../actions";
import { toast } from "sonner";
import type { KBArticle, KBCategory } from "@/types/kb";

const CATEGORIES: KBCategory[] = [
  "Printer",
  "Jaringan & Wi-Fi",
  "SIMRS",
  "Hardware & PC",
  "Software",
  "Email & Akun",
  "Umum",
];

interface KBDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article?: KBArticle | null;
  onSuccess: () => void;
}

export function KBDialog({
  open,
  onOpenChange,
  article,
  onSuccess,
}: KBDialogProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Umum");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  useEffect(() => {
    if (article) {
      setTitle(article.title || "");
      setCategory(article.category || "Umum");
      setContent(article.content || "");
      setSummary(article.summary || "");
      setTagsInput(article.tags ? article.tags.join(", ") : "");
      setIsPublished(article.is_published ?? true);
    } else {
      setTitle("");
      setCategory("Umum");
      setContent("");
      setSummary("");
      setTagsInput("");
      setIsPublished(true);
    }
  }, [article, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Judul dan isi artikel wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const result = await saveKBArticle({
        id: article?.id,
        title,
        category,
        content,
        summary,
        tags,
        is_published: isPublished,
      });

      if (result.success) {
        toast.success(
          article ? "Artikel KB berhasil diperbarui" : "Artikel KB berhasil ditambahkan"
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error || "Gagal menyimpan artikel");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {article ? "Edit Artikel Knowledge Base" : "Tambah Artikel Knowledge Base"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">Judul Panduan / Masalah *</Label>
            <Input
              id="title"
              placeholder="Contoh: Cara Mengatasi Printer Offline pada Windows 11"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Kategori *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Pilih Kategori" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tag (Pisahkan koma)</Label>
              <Input
                id="tags"
                placeholder="printer, offline, windows, spooler"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Ringkasan Singkat</Label>
            <Input
              id="summary"
              placeholder="Ringkasan 1-2 kalimat untuk hasil pencarian cepat"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Solusi & Langkah-Langkah Panduan * (Markdown)</Label>
            <Textarea
              id="content"
              rows={8}
              placeholder="Tuliskan langkah-langkah solusi di sini. Anda dapat menggunakan format Markdown (misal: 1. Langkah pertama, 2. Langkah kedua)..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_published"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <Label htmlFor="is_published">
                {isPublished ? "Terbit (Public)" : "Draft (Internal Only)"}
              </Label>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Artikel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
