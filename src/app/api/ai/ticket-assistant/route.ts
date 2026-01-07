import { NextRequest, NextResponse } from "next/server";
import { askGemini } from "@/lib/gemini/client";
import {
    searchAssets,
    checkStock,
    searchTickets,
    searchProfiles,
    searchLocations,
    getAssetCount,
    getTicketStats
} from "@/lib/ai/tools";

export async function POST(request: NextRequest) {
    try {
        const { message } = await request.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // 1. Intent Classification & Keyword Extraction via AI
        const intentPrompt = `
        Analisis pertanyaan user berikut dan tentukan INTENT (tujuan) dan KEYWORD (kata kunci) pencarian.
        
        Pilihan INTENT:
        - CHECK_STOCK (jika tanya sisa/jumlah barang ATK/habis pakai)
        - SEARCH_ASSET (jika tanya info/lokasi/spek spesifik aset. TAPI jika tanya "jumlah", "total", atau "berapa aset", gunakan STATS)
        - STATS (jika tanya JUMLAH TOTAL aset, tiket, atau statistik umum sistem)
        - SEARCH_USER (jika tanya info orang/teknisi)
        - SEARCH_LOCATION (jika tanya info ruangan/gedung)
        - TROUBLESHOOT (jika tanya cara memperbaiki error/masalah teknis)
        - OTHER (jika sapaan atau pertanyaan umum)

        Format output JSON:
        {"intent": "INTENT_NAME", "keyword": "search_keyword"}

        Contoh:
        "Tinta hitam ada berapa?" -> {"intent": "CHECK_STOCK", "keyword": "tinta hitam"}
        "Berapa jumlah aset kita?" -> {"intent": "STATS", "keyword": "aset"}
        "Ada berapa laptop?" -> {"intent": "STATS", "keyword": "laptop"}
        "Total printer di kantor?" -> {"intent": "STATS", "keyword": "printer"}
        "Ada berapa total tiket?" -> {"intent": "STATS", "keyword": "tiket"}
        "Cari laptop aset kantor" -> {"intent": "SEARCH_ASSET", "keyword": "laptop"}
        
        Pertanyaan: "${message}"
        `;

        const classificationRaw = await askGemini(intentPrompt, "");
        // Clean markdown code blocks if any
        const cleanJson = classificationRaw.replace(/```json/g, "").replace(/```/g, "").trim();

        let classification;
        try {
            classification = JSON.parse(cleanJson);
        } catch (e) {
            // Fallback default
            classification = { intent: "TROUBLESHOOT", keyword: message };
        }

        // FORCE FIX: Smart Intent Overrides
        const msgLower = message.toLowerCase();

        // Cek indikator pertanyaan statistik/jumlah
        const isStatsQuestion = msgLower.includes("total") || msgLower.includes("jumlah") || msgLower.startsWith("berapa") || msgLower.includes(" ada berapa ");

        if (isStatsQuestion) {
            // Jika pertanyaan jumlah tiket
            if (msgLower.includes("tiket") || msgLower.includes("ticket")) {
                classification.intent = "STATS";
                classification.keyword = "tiket";
            }
            // Jika pertanyaan aset/barang spesifik (bukan tiket)
            else {
                classification.intent = "STATS";
                // Jika keyword dari AI kosong atau tidak relevan, coba ambil dari pesan
                // Tapi biasanya keyword dari AI sudah benar (misal 'laptop'), jadi kita biarkan/paksa keywordnya
                if (!classification.keyword || classification.keyword === "aset") {
                    // Extract noun simple logic (fallback)
                    if (msgLower.includes("laptop")) classification.keyword = "laptop";
                    else if (msgLower.includes("printer")) classification.keyword = "printer";
                    else if (msgLower.includes("komputer") || msgLower.includes("pc")) classification.keyword = "pc";
                    else if (msgLower.includes("monitor")) classification.keyword = "monitor";
                }
            }
        }


        console.log("AI Intent:", classification);

        // 2. Data Fetching based on Intent
        let contextData = "";
        let relatedData: any[] = [];
        const { intent, keyword } = classification;

        if (intent === "CHECK_STOCK") {
            const items = await checkStock(keyword);
            relatedData = items;
            contextData = items.length > 0
                ? `DATA STOK BARANG:\n${items.map((i: any) => `- ${i.name}: ${i.stock_quantity} ${i.unit} (Kategori: ${i.category})`).join("\n")}`
                : "Data stok tidak ditemukan.";

        } else if (intent === "SEARCH_ASSET") {
            const assets = await searchAssets(keyword);
            relatedData = assets;
            contextData = assets.length > 0
                // @ts-ignore
                ? `DATA ASET:\n${assets.map((a: any) => `- ${a.name} (${a.code})\n  Serial: ${a.serial_number}\n  Status: ${a.status}\n  Lokasi: ${a.location?.name || '-'} \n  Peminjam: ${a.assigned_to?.full_name || '-'}\n`).join("\n")}`
                : "Data aset tidak ditemukan.";

        } else if (intent === "STATS") {
            if (keyword.toLowerCase().includes("tiket") || keyword.toLowerCase().includes("ticket")) {
                const stats = await getTicketStats();
                contextData = `DATA STATISTIK TIKET:\nTotal: ${stats.total}\nResolved: ${stats.resolved}\nOpen: ${stats.open}\nIn Progress: ${stats.in_progress}`;
            } else {
                // Default ke aset (bisa filter by keyword misal "laptop")
                const count = await getAssetCount(keyword);
                const itemType = ["aset", "asset", "barang"].includes(keyword.toLowerCase()) ? "Total Aset Terdaftar" : `Total Aset "${keyword}"`;
                contextData = `DATA STATISTIK:\n${itemType}: ${count} unit`;
            }


        } else if (intent === "SEARCH_USER") {
            const users = await searchProfiles(keyword);
            relatedData = users;
            contextData = users.length > 0
                ? `DATA USER/TEKNISI:\n${users.map((u: any) => `- ${u.full_name} (${u.role})\n  Dept: ${u.department || '-'}\n  Email: ${u.email}\n  Telp: ${u.phone || '-'}`).join("\n")}`
                : "Data user tidak ditemukan.";

        } else if (intent === "SEARCH_LOCATION") {
            const locs = await searchLocations(keyword);
            relatedData = locs;
            contextData = locs.length > 0
                ? `DATA LOKASI:\n${locs.map((l: any) => `- ${l.name} (Gedung: ${l.building}, Lantai: ${l.floor})\n  Info: ${l.description || '-'}`).join("\n")}`
                : "Data lokasi tidak ditemukan.";

        } else if (intent === "TROUBLESHOOT") {
            const tickets = await searchTickets(keyword);
            relatedData = tickets;
            contextData = tickets.length > 0
                ? `RIWAYAT TIKET SERUPA:\n${tickets.map((t: any) => `- Masalah: ${t.title}\n  Solusi: ${t.resolution_notes}`).join("\n\n")}`
                : "Tidak ada riwayat tiket serupa.";
        }

        // 3. Final Answer Synthesis
        const finalPrompt = `
        Anda adalah IT Helpdesk Assistant. Jawab pertanyaan user berdasarkan DATA KONTEKS berikut.
        
        DATA KONTEKS:
        ${contextData}

        PERTANYAAN USER: "${message}"

        INSTRUKSI UTAMA:
        1. JIKA DATA ADA DI KONTEKS: Langsung jawab intinya. JANGAN minta maaf atau bilang "tidak menemukan data". Gunakan data angka/fakta yang ada.
        2. JIKA DATA KOSONG: Katakan dengan sopan bahwa data tidak ditemukan di database.
        3. JIKA USER TANYA "DETAIL" TAPI KONTEKS HANYA ANGKA TOTAL: Jelaskan bahwa Anda tidak bisa menampilkan detail semua sekaligus, dan minta user mencari lebih spesifik (contoh: "Cari laptop", "Lihat printer").
        4. Jawab dalam Bahasa Indonesia yang natural, ringkas, dan membantu.
        `;

        const finalResponse = await askGemini(finalPrompt, "");

        return NextResponse.json({
            success: true,
            response: finalResponse,
            debug: { intent, keyword, dataCount: relatedData.length }
        });

    } catch (error) {
        console.error("AI Assistant Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
