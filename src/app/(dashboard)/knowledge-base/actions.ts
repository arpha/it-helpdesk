"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { KBArticle, KBArticleFormData } from "@/types/kb";

export async function getKBArticles(params?: {
  search?: string;
  category?: string;
  is_published?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();

  const page = params?.page || 1;
  const pageSize = params?.pageSize || 12;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from("knowledge_base_articles")
    .select("*, profiles:created_by(full_name)", { count: "exact" });

  if (params?.is_published !== undefined) {
    query = query.eq("is_published", params.is_published);
  }

  if (params?.category && params.category !== "All") {
    query = query.eq("category", params.category);
  }

  if (params?.search) {
    query = query.or(
      `title.ilike.%${params.search}%,content.ilike.%${params.search}%,summary.ilike.%${params.search}%`
    );
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    console.error("Error fetching KB articles:", error);
    return { success: false, error: error.message };
  }

  const formattedData: KBArticle[] = (data || []).map((item: any) => ({
    ...item,
    author_name: item.profiles?.full_name || "Tim IT",
  }));

  return {
    success: true,
    data: formattedData,
    count: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

export async function getKBArticleBySlugOrId(idOrSlug: string) {
  const supabase = await createClient();

  let query = supabase
    .from("knowledge_base_articles")
    .select("*, profiles:created_by(full_name)");

  if (idOrSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    query = query.eq("id", idOrSlug);
  } else {
    query = query.eq("slug", idOrSlug);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return { success: false, error: "Artikel tidak ditemukan" };
  }

  // Increment view count asynchronously
  await supabase
    .from("knowledge_base_articles")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("id", data.id);

  return {
    success: true,
    data: {
      ...data,
      author_name: data.profiles?.full_name || "Tim IT",
    } as KBArticle,
  };
}

export async function saveKBArticle(payload: KBArticleFormData & { id?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const slug = payload.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const dataToSave = {
    title: payload.title,
    slug,
    category: payload.category || "Umum",
    content: payload.content,
    summary: payload.summary || payload.content.slice(0, 150) + "...",
    tags: payload.tags || [],
    is_published: payload.is_published ?? true,
    source_ticket_id: payload.source_ticket_id || null,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (payload.id) {
    result = await supabase
      .from("knowledge_base_articles")
      .update(dataToSave)
      .eq("id", payload.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from("knowledge_base_articles")
      .insert([{ ...dataToSave, created_by: user.id }])
      .select()
      .single();
  }

  if (result.error) {
    console.error("Error saving KB article:", result.error);
    return { success: false, error: result.error.message };
  }

  revalidatePath("/knowledge-base");
  return { success: true, data: result.data as KBArticle };
}

export async function deleteKBArticle(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("knowledge_base_articles")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting KB article:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/knowledge-base");
  return { success: true };
}

export async function rateKBArticle(id: string, isHelpful: boolean) {
  const supabase = await createClient();

  const { data: article } = await supabase
    .from("knowledge_base_articles")
    .select("helpful_count, not_helpful_count")
    .eq("id", id)
    .single();

  if (!article) return { success: false, error: "Article not found" };

  const updateData = isHelpful
    ? { helpful_count: (article.helpful_count || 0) + 1 }
    : { not_helpful_count: (article.not_helpful_count || 0) + 1 };

  const { error } = await supabase
    .from("knowledge_base_articles")
    .update(updateData)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  return { success: true };
}

export async function convertTicketToKB(ticketId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  // Fetch ticket details
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (error || !ticket) {
    return { success: false, error: "Tiket tidak ditemukan" };
  }

  const defaultTitle = `Solusi: ${ticket.title}`;
  const defaultCategory = ticket.category || "Umum";
  const defaultContent = `### Kendala\n${ticket.description || "Tidak ada deskripsi"}\n\n### Solusi Penanganan\n${ticket.resolution_notes || ticket.notes || "Solusi telah diterapkan oleh teknisi IT."}`;

  const draftPayload: KBArticleFormData = {
    title: defaultTitle,
    category: defaultCategory,
    content: defaultContent,
    summary: `Panduan penyelesaian masalah ${ticket.title}`,
    is_published: false, // Create as draft first
    source_ticket_id: ticketId,
    tags: ["solusi-tiket", defaultCategory.toLowerCase()],
  };

  const saveResult = await saveKBArticle(draftPayload);
  return saveResult;
}
