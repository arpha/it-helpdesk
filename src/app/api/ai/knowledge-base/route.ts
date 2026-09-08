import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askGeminiRAG } from "@/lib/gemini/client";

export async function POST(request: NextRequest) {
  try {
    const { query, history = [] } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Search matching KB articles
    const searchTerms = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    
    let kbQuery = supabase
      .from("knowledge_base_articles")
      .select("id, title, category, summary, content")
      .eq("is_published", true);

    if (searchTerms.length > 0) {
      kbQuery = kbQuery.or(
        searchTerms.map((term: string) => `title.ilike.%${term}%,content.ilike.%${term}%`).join(",")
      );
    }

    const { data: kbArticles } = await kbQuery.limit(3);

    // 2. Search matching SOP documents
    let sopQuery = supabase
      .from("sop_documents")
      .select("id, title, category, description")
      .eq("status", "published");

    if (searchTerms.length > 0) {
      sopQuery = sopQuery.or(
        searchTerms.map((term: string) => `title.ilike.%${term}%,description.ilike.%${term}%`).join(",")
      );
    }

    const { data: sopDocuments } = await sopQuery.limit(3);

    // 3. Ask Gemini RAG
    const aiResponse = await askGeminiRAG(
      query,
      kbArticles || [],
      sopDocuments || [],
      history
    );

    // 4. Log deflection session
    const suggestedArticleIds = (kbArticles || []).map((a) => a.id);

    const { data: logEntry } = await supabase
      .from("ai_deflection_logs")
      .insert([
        {
          user_id: user?.id || null,
          user_query: query,
          ai_response: aiResponse,
          status: "pending",
          suggested_article_ids: suggestedArticleIds,
        },
      ])
      .select("id")
      .single();

    return NextResponse.json({
      success: true,
      logId: logEntry?.id || null,
      response: aiResponse,
      articles: kbArticles || [],
      sops: sopDocuments || [],
    });
  } catch (error) {
    console.error("AI KB Route Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan pada AI Assistant",
      },
      { status: 500 }
    );
  }
}
