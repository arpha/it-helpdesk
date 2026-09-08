"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Bot,
  Sparkles,
  Edit,
  Trash2,
  Tag,
  ArrowRight,
} from "lucide-react";
import { KBDialog } from "./kb-dialog";
import { AIAssistantModal } from "./ai-assistant-modal";
import {
  getKBArticles,
  deleteKBArticle,
  rateKBArticle,
  getKBArticleBySlugOrId,
} from "../actions";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import type { KBArticle, KBCategory } from "@/types/kb";
import { useSearchParams } from "next/navigation";

const CATEGORIES: ("All" | KBCategory)[] = [
  "All",
  "Printer",
  "Jaringan & Wi-Fi",
  "SIMRS",
  "Hardware & PC",
  "Software",
  "Email & Akun",
  "Umum",
];

export function KBClient() {
  const searchParams = useSearchParams();
  const articleIdParam = searchParams.get("id");

  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KBArticle | null>(null);

  const [readerOpen, setReaderOpen] = useState(false);
  const [readingArticle, setReadingArticle] = useState<KBArticle | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const { user } = useAuthStore();
  const canManage = user?.role === "admin" || user?.role === "staff_it" || user?.role === "manager_it";

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await getKBArticles({
        search: search.trim(),
        category: selectedCategory,
      });
      if (res.success && res.data) {
        setArticles(res.data);
      }
    } catch (err) {
      toast.error("Gagal memuat artikel Knowledge Base");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [search, selectedCategory]);

  useEffect(() => {
    if (articleIdParam) {
      getKBArticleBySlugOrId(articleIdParam).then((res) => {
        if (res.success && res.data) {
          setReadingArticle(res.data);
          setReaderOpen(true);
        }
      });
    }
  }, [articleIdParam]);

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus artikel ini?")) return;
    try {
      const res = await deleteKBArticle(id);
      if (res.success) {
        toast.success("Artikel berhasil dihapus");
        fetchArticles();
      } else {
        toast.error(res.error || "Gagal menghapus artikel");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleRate = async (articleId: string, isHelpful: boolean) => {
    try {
      const res = await rateKBArticle(articleId, isHelpful);
      if (res.success) {
        toast.success("Terima kasih atas umpan balik Anda!");
        if (readingArticle && readingArticle.id === articleId) {
          setReadingArticle((prev) =>
            prev
              ? {
                  ...prev,
                  helpful_count: isHelpful ? prev.helpful_count + 1 : prev.helpful_count,
                  not_helpful_count: !isHelpful
                    ? prev.not_helpful_count + 1
                    : prev.not_helpful_count,
                }
              : null
          );
        }
        fetchArticles();
      }
    } catch (err) {
      toast.error("Gagal mengirim umpan balik");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 p-6 md:p-8 text-primary-foreground shadow-lg">
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur-md">
            <BookOpen className="h-3.5 w-3.5" /> Pusat Pengetahuan IT & Trouble-shooting
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Temukan Solusi Kendala IT Secara Mandiri
          </h1>
          <p className="text-sm opacity-90">
            Cari artikel panduan lengkap atau tanyakan langsung ke Asisten AI 24/7 SI MANTAP untuk penyelesaian kendala serba cepat.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <Button
              onClick={() => setAiModalOpen(true)}
              className="bg-white text-primary hover:bg-white/90 shadow-md font-semibold gap-2"
            >
              <Bot className="h-4 w-4" />
              Tanya Asisten AI 24/7
              <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            </Button>

            {canManage && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingArticle(null);
                  setDialogOpen(true);
                }}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 gap-2"
              >
                <Plus className="h-4 w-4" /> Tambah Artikel KB
              </Button>
            )}
          </div>
        </div>

        {/* Decorative Grid Pattern */}
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      </div>

      {/* Search & Categories Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari panduan, solusi printer, jaringan, SIMRS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="whitespace-nowrap text-xs rounded-full"
            >
              {cat === "All" ? "Semua Kategori" : cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse h-48 bg-muted/40" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl bg-card space-y-3">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold">Tidak Ada Artikel Ditemukan</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Belum ada panduan yang sesuai dengan pencarian Anda. Coba kata kunci lain atau tanyakan ke AI Assistant.
          </p>
          <Button onClick={() => setAiModalOpen(true)} variant="outline" className="gap-2">
            <Bot className="h-4 w-4" /> Tanya AI Assistant
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col hover:border-primary/50 transition-all hover:shadow-md group cursor-pointer"
              onClick={() => {
                setReadingArticle(item);
                setReaderOpen(true);
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {item.category}
                  </Badge>
                  {canManage && (
                    <div
                      className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingArticle(item);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
                  {item.title}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-2 mt-1">
                  {item.summary || item.content.slice(0, 100)}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1" />

              <CardFooter className="pt-2 border-t text-xs text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> {item.view_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" /> {item.helpful_count || 0}
                  </span>
                </div>
                <span className="text-primary font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Baca Solusi <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* KB Article Dialog (Add / Edit) */}
      <KBDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        article={editingArticle}
        onSuccess={fetchArticles}
      />

      {/* Floating AI Assistant Widget Modal */}
      <AIAssistantModal open={aiModalOpen} onOpenChange={setAiModalOpen} />

      {/* Reader Modal (View Article Details) */}
      <Dialog open={readerOpen} onOpenChange={setReaderOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {readingArticle && (
            <div className="space-y-4 py-2">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{readingArticle.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Oleh {readingArticle.author_name || "Tim IT"}
                  </span>
                </div>
                <DialogTitle className="text-xl font-bold">
                  {readingArticle.title}
                </DialogTitle>
              </DialogHeader>

              {/* Tags */}
              {readingArticle.tags && readingArticle.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {readingArticle.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs gap-1">
                      <Tag className="h-3 w-3" /> {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Article Content */}
              <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed p-4 bg-muted/30 rounded-xl whitespace-pre-wrap border">
                {readingArticle.content}
              </div>

              {/* Helpful Feedback Box */}
              <div className="p-4 border rounded-xl bg-card flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <span className="font-medium text-muted-foreground">
                  Apakah artikel panduan ini membantu menyelesaikan masalah Anda?
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => handleRate(readingArticle.id, true)}
                  >
                    <ThumbsUp className="h-4 w-4" /> Ya ({readingArticle.helpful_count || 0})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                    onClick={() => handleRate(readingArticle.id, false)}
                  >
                    <ThumbsDown className="h-4 w-4" /> Tidak ({readingArticle.not_helpful_count || 0})
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
