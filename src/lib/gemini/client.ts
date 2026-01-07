"use server";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";

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

    // Always include base info
    schemas.push(`DATABASE SCHEMA (gunakan untuk generate SQL query jika diperlukan):`);

    // Check for asset-related keywords (very broad)
    const assetKeywords = ["aset", "asset", "perangkat", "device", "laptop", "printer", "komputer", "pc",
        "monitor", "scanner", "server", "cctv", "ac", "ups", "telepon", "hub", "switch", "router",
        "keyboard", "mouse", "kabel", "di ruang", "di lantai", "di gedung", "di lokasi", "di kinanti",
        "aktif", "rusak", "damage", "maintenance", "serial", "sn", "kode", "code", "nomor"];

    // Also check for Asset Code pattern (e.g. AST-2026-0001)
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

    // If no specific schema detected, include general troubleshooting note
    if (schemas.length === 1) {
        schemas.push(`
Tidak ada query database yang diperlukan untuk pertanyaan ini.
Berikan jawaban troubleshooting IT umum berdasarkan pengetahuan Anda.`);
    }

    return schemas.join("\n");
}

/**
 * Natural conversation AI with dynamic schema injection
 */
export async function askGeminiNatural(
    message: string,
    history: Message[] = []
): Promise<{ response: string; sql?: string; data?: unknown }> {
    if (!GEMINI_API_KEY) {
        throw new Error("GOOGLE_GEMINI_API_KEY tidak dikonfigurasi di .env.local");
    }

    const relevantSchema = getRelevantSchema(message);

    // Build conversation history string
    const historyText = history.length > 0
        ? history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join("\n")
        : "";

    const systemPrompt = `Kamu adalah AI Assistant IT Helpdesk untuk rumah sakit.

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
  
- Jika TIDAK perlu query, langsung jawab dengan teks biasa.

${historyText ? `RIWAYAT PERCAKAPAN:\n${historyText}\n` : ""}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 2048,
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API error:", errorText);
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
        console.error("Gemini natural error:", error);
        throw error;
    }
}

/**
 * Summarize query results into natural language answer
 */
export async function summarizeQueryResult(
    question: string,
    data: any[]
): Promise<string> {
    if (!GEMINI_API_KEY) return "Data ditemukan.";

    const dataString = JSON.stringify(data).substring(0, 5000); // Limit context size

    const prompt = `
Context: User bertanya "${question}"
Data dari Database: ${dataString}

Tugasmu:
Jawab pertanyaan user secara natural berdasarkan Data dari Database di atas.
- JANGAN menyebutkan "berdasarkan data database" atau hal teknis.
- Langsung jawab dengan informasi yang relevan.
- Jika data berupa solusi maintenance (col: resolution_notes), rangkum solusinya menjadi langkah-langkah yang bisa dicoba user.
- Jika data berupa list aset, sebutkan ringkasannya.
- Gunakan Bahasa Indonesia yang luwes dan membantu.
`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 1024,
                    }
                }),
            }
        );

        if (response.ok) {
            const result = await response.json();
            return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }
    } catch (e) {
        console.error("Summarize error:", e);
    }

    return "";
}

/**
 * Legacy function for backward compatibility
 */
export async function askGemini(
    question: string,
    ticketContext: string
): Promise<string> {
    const result = await askGeminiNatural(question, []);
    return result.response;
}
