"use server";

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

type Message = {
    role: "user" | "assistant";
    content: string;
};

/**
 * Get relevant database schema based on message content
 */
function getRelevantSchema(message: string): string {
    const msgLower = message.toLowerCase();
    const schemas: string[] = [];

    schemas.push(`DATABASE SCHEMA (gunakan untuk generate SQL query jika diperlukan):`);

    // Check for asset-related keywords
    const assetKeywords = ["aset", "asset", "perangkat", "device", "laptop", "printer", "komputer", "pc",
        "monitor", "scanner", "server", "cctv", "ac", "ups", "telepon", "hub", "switch", "router",
        "keyboard", "mouse", "kabel", "di ruang", "di lantai", "di gedung", "di lokasi", "di kinanti",
        "aktif", "rusak", "damage", "maintenance", "serial", "sn", "kode", "code", "nomor"];

    const hasAssetCode = /\bAST-\d{4}-\d{4}\b/i.test(message);

    if (hasAssetCode || assetKeywords.some(k => msgLower.includes(k))) {
        schemas.push(`
TABEL: assets (Aset IT)
- id, asset_code, name, serial_number, status ('active','maintenance','damage','disposed')
- category_id → asset_categories(id)
- location_id → locations(id)

TABEL: asset_categories
- id, name (Laptop, Printer, Komputer, Telepon, Hub, Switch, Monitor, dll)

TABEL: locations
- id, name (contoh: "Kinanti 3A", "Instalasi Farmasi")

CONTOH QUERY ASSETS:
- List aset: SELECT a.name, a.asset_code, a.status FROM assets a JOIN asset_categories ac ON a.category_id = ac.id JOIN locations l ON a.location_id = l.id WHERE ac.name ILIKE '%laptop%' AND l.name ILIKE '%Kinanti%' LIMIT 20
- Jumlah aset: SELECT COUNT(*) as total FROM assets a JOIN asset_categories ac ON a.category_id = ac.id WHERE ac.name ILIKE '%printer%'`);
    }

    // Check for stock/ATK keywords
    const stockKeywords = ["stok", "stock", "atk", "tinta", "kertas", "sparepart", "consumable", "barang", "persediaan"];

    if (stockKeywords.some(k => msgLower.includes(k))) {
        schemas.push(`
TABEL: atk_items (Stok Barang/ATK)
- id, name, stock_quantity, unit, category, price

CONTOH QUERY STOK:
- Jumlah stok: SELECT SUM(stock_quantity) as total FROM atk_items WHERE name ILIKE '%tinta%' AND name ILIKE '%canon%'
- List stok: SELECT name, stock_quantity, unit FROM atk_items WHERE name ILIKE '%keyboard%' LIMIT 20`);
    }

    // Check for ticket/maintenance keywords
    const ticketKeywords = ["tiket", "ticket", "keluhan", "masalah", "laporan", "open", "resolved", "pending",
        "maintenance", "perbaikan", "solusi", "error", "rusak", "kendala", "trouble", "fix"];

    if (ticketKeywords.some(k => msgLower.includes(k))) {
        schemas.push(`
TABEL: tickets (Tiket Helpdesk & Maintenance Log)
- id, title, description, category ('hardware','software','network','data')
- priority ('low','medium','high','urgent'), status ('open','in_progress','resolved','closed')
- resolution_notes (catatan penyelesaian/solusi teknis), resolved_at
- created_by → profiles(id), assigned_to → profiles(id)

CONTOH QUERY TIKET/SOLUSI:
- Cari solusi printer: SELECT title, resolution_notes FROM tickets WHERE title ILIKE '%printer%' AND status = 'resolved' AND resolution_notes IS NOT NULL LIMIT 5
- List tiket open: SELECT title, status, priority FROM tickets WHERE status = 'open' LIMIT 20`);
    }

    if (schemas.length === 1) {
        schemas.push(`
Tidak ada query database yang diperlukan untuk pertanyaan ini.
Berikan jawaban troubleshooting IT umum berdasarkan pengetahuan Anda.`);
    }

    return schemas.join("\n");
}

/**
 * Natural conversation AI with Groq API
 */
export async function askGroqNatural(
    message: string,
    history: Message[] = []
): Promise<{ response: string; sql?: string; data?: unknown }> {
    const apiKey = GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY tidak dikonfigurasi di Environment Variables / .env.local");
    }

    const relevantSchema = getRelevantSchema(message);

    const systemPrompt = `Kamu adalah AI Assistant IT Helpdesk untuk rumah sakit SI MANTAP.

KEMAMPUAN:
1. Menjawab pertanyaan troubleshooting IT
2. Query database untuk mencari informasi aset, tiket, stok barang
3. Memahami konteks percakapan sebelumnya

${relevantSchema}

ATURAN PENTING:
1. Jawab dalam Bahasa Indonesia
2. Jika perlu query database, generate SQL yang valid
3. Untuk SQL: HANYA SELECT, selalu gunakan LIMIT, gunakan ILIKE untuk search
4. Untuk warna tinta: biru=cyan, merah=magenta, kuning=yellow, hitam=hitam
5. Jika ada riwayat percakapan tentang lokasi, gunakan lokasi tersebut untuk pertanyaan lanjutan

FORMAT RESPONSE:
- Jika PERLU query database, response dengan format:
  [SQL]
  <query sql di sini>
  [/SQL]
  
- Jika TIDAK perlu query, langsung jawab dengan teks biasa.`;

    const formattedMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt }
    ];

    for (const h of history) {
        formattedMessages.push({
            role: h.role === "user" ? "user" : "assistant",
            content: h.content
        });
    }

    formattedMessages.push({ role: "user", content: message });

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages: formattedMessages,
                temperature: 0.3,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Groq API error status:", response.status, "details:", errorText);
            throw new Error(`Groq API error: ${response.status} (${errorText})`);
        }

        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content || "";

        // Check if response contains SQL
        const sqlMatch = aiResponse.match(/\[SQL\]([\s\S]*?)\[\/SQL\]/);
        if (sqlMatch) {
            const sql = sqlMatch[1].trim()
                .replace(/```sql/gi, "")
                .replace(/```/g, "")
                .replace(/;+\s*$/g, "")
                .trim();

            return {
                response: aiResponse.replace(/\[SQL\][\s\S]*?\[\/SQL\]/, "").trim(),
                sql
            };
        }

        return { response: aiResponse };
    } catch (error) {
        console.error("Groq natural error:", error);
        throw error;
    }
}

/**
 * Summarize query results into natural language answer using Groq
 */
export async function summarizeQueryResultGroq(
    question: string,
    data: any[]
): Promise<string> {
    const apiKey = GROQ_API_KEY;
    if (!apiKey) return "Data ditemukan.";

    const dataString = JSON.stringify(data).substring(0, 5000);

    const prompt = `Context: User bertanya "${question}"
Data dari Database: ${dataString}

Tugasmu:
Jawab pertanyaan user secara natural berdasarkan Data dari Database di atas.
- JANGAN menyebutkan "berdasarkan data database" atau hal teknis.
- Langsung jawab dengan informasi yang relevan.
- Jika data berupa solusi maintenance (col: resolution_notes), rangkum solusinya menjadi langkah-langkah yang bisa dicoba user.
- Jika data berupa list aset, sebutkan ringkasannya.
- Gunakan Bahasa Indonesia yang luwes dan membantu.`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.4,
                max_tokens: 1024
            })
        });

        if (response.ok) {
            const result = await response.json();
            return result.choices?.[0]?.message?.content || "";
        }
    } catch (e) {
        console.error("Groq Summarize error:", e);
    }

    return "";
}

/**
 * Knowledge Base RAG Assistant function using Groq
 */
export async function askGroqRAG(
    userQuery: string,
    kbArticles: { id: string; title: string; category: string; summary?: string; content: string }[],
    sopDocuments: { id: string; title: string; category: string; description?: string }[] = [],
    history: Message[] = []
): Promise<string> {
    const apiKey = GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY belum dikonfigurasi di Environment Variables server/Vercel.");
    }

    const kbContext = kbArticles.length > 0
        ? kbArticles.map((art, i) => `[Artikel #${i + 1}] Judul: ${art.title} (Kategori: ${art.category})\nSolusi: ${art.content}`).join("\n\n")
        : "Tidak ada artikel KB khusus.";

    const sopContext = sopDocuments.length > 0
        ? sopDocuments.map((sop, i) => `[SOP #${i + 1}] ${sop.title} (Kategori: ${sop.category})`).join("\n")
        : "Tidak ada SOP khusus.";

    const systemPrompt = `Kamu adalah Asisten IT Helpdesk Pintar untuk SI MANTAP (Rumah Sakit).
Tugasmu adalah membantu staf dan pengguna memecahkan masalah IT mandiri (Self-Service Troubleshooting) secara ramah, cepat, dan jelas.

DOKUMEN PENGETAHUAN YANG TERSEDIA:
${kbContext}

${sopContext}

ATURAN JAWABAN:
1. Berikan langkah-langkah penanganan mandiri secara terstruktur (menggunakan nomor/bullet point markdown).
2. Jika ada informasi dari artikel KB atau SOP di atas yang relevan, utamakan mengutip solusi dari dokumen tersebut.
3. Gunakan bahasa Indonesia yang santun, profesional, dan mudah dipahami oleh pengguna non-teknis.
4. Di akhir jawaban, tanyakan apakah panduan ini berhasil menyelesaikan kendala mereka atau jika mereka butuh bantuan teknisi IT.`;

    const formattedMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt }
    ];

    for (const h of history) {
        formattedMessages.push({
            role: h.role === "user" ? "user" : "assistant",
            content: h.content
        });
    }

    formattedMessages.push({ role: "user", content: userQuery });

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages: formattedMessages,
                temperature: 0.3,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Groq RAG API error status:", response.status, "details:", errorText);
            throw new Error(`Groq API error: ${response.status} (${errorText})`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Maaf, saya tidak dapat memproses panduan saat ini.";
    } catch (error) {
        console.error("Groq RAG error:", error);
        throw error;
    }
}
