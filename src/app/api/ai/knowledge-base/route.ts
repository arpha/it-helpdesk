import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askGeminiRAG } from "@/lib/gemini/client";

export async function POST(request: NextRequest) {
  try {
    const { query, history = [] } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    let user = null;
    let kbArticles: any[] = [];
    let sopDocuments: any[] = [];

    // Safely attempt Supabase database queries
    try {
      const supabase = await createClient();
      const { data: authData } = await supabase.auth.getUser();
      user = authData?.user || null;

      const searchTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 2);

      // Search KB Articles
      let kbQuery = supabase
        .from("knowledge_base_articles")
        .select("id, title, category, summary, content")
        .eq("is_published", true);

      if (searchTerms.length > 0) {
        kbQuery = kbQuery.or(
          searchTerms
            .map((term: string) => `title.ilike.%${term}%,content.ilike.%${term}%`)
            .join(",")
        );
      }
      const { data: kbData } = await kbQuery.limit(3);
      if (kbData) kbArticles = kbData;

      // Search SOP Documents
      let sopQuery = supabase
        .from("sop_documents")
        .select("id, title, category, description")
        .eq("status", "published");

      if (searchTerms.length > 0) {
        sopQuery = sopQuery.or(
          searchTerms
            .map((term: string) => `title.ilike.%${term}%,description.ilike.%${term}%`)
            .join(",")
        );
      }
      const { data: sopData } = await sopQuery.limit(3);
      if (sopData) sopDocuments = sopData;
    } catch (dbErr) {
      console.warn("KB Database Search Warning (non-fatal):", dbErr);
    }

    // Call Gemini AI RAG
    let aiResponse = "";
    try {
      aiResponse = await askGeminiRAG(
        query,
        kbArticles,
        sopDocuments,
        history
      );
    } catch (aiErr) {
      console.error("Gemini AI RAG Call Error:", aiErr);
      return NextResponse.json(
        {
          success: false,
          error: aiErr instanceof Error ? aiErr.message : "Gagal memproses jawaban AI Gemini.",
        },
        { status: 500 }
      );
    }

    // Log deflection session (non-blocking)
    let logId: string | null = null;
    try {
      const supabase = await createClient();
      const suggestedArticleIds = kbArticles.map((a) => a.id);
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

      if (logEntry) logId = logEntry.id;
    } catch (logErr) {
      console.warn("Logging deflection error (non-fatal):", logErr);
    }

    return NextResponse.json({
      success: true,
      logId,
      response: aiResponse,
      articles: kbArticles,
      sops: sopDocuments,
    });
  } catch (error) {
    console.error("AI KB Route Fatal Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan pada AI Assistant",
      },
      { status: 500 }
    );
  }
}
