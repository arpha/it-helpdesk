"use server";

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
const MODELS_TO_TRY = [
    process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "qwen/qwen3.6-27b",
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile"
];

type Message = {
    role: "user" | "assistant";
    content: string;
};

/**
 * Call Groq Chat Completions API with automatic model fallbacks
 */
async function callGroqChatCompletions(
    messages: { role: string; content: string }[],
    temperature = 0.3,
    maxTokens = 2048
): Promise<string> {
    const apiKey = GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY belum dikonfigurasi di Environment Variables / .env.local");
    }

    let lastError: Error | null = null;

    // Try models in order until one succeeds
    for (const model of MODELS_TO_TRY) {
        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                    max_tokens: maxTokens
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices?.[0]?.message?.content || "";
            }

            const errorText = await response.text();
            console.warn(`Groq model ${model} failed (${response.status}):`, errorText);

            if (response.status === 404 || errorText.includes("model_not_found") || errorText.includes("does not exist")) {
                lastError = new Error(`Model ${model} tidak ditemukan.`);
                continue;
            }

            throw new Error(`Groq API error (${response.status}): ${errorText}`);
        } catch (err: any) {
            lastError = err;
            if (err.message?.includes("Groq API error (401)")) {
                throw err;
            }
        }
    }

    throw lastError || new Error("Semua model Groq gagal dipanggil.");
}

/**
 * Get full database schema for robust SQL generation
 */
function getRelevantSchema(): string {
    return `DATABASE SCHEMA SI MANTAP (Gunakan untuk generate SQL query jika user menanyakan data/stok/aset/tiket):

TABEL 1: assets (Aset IT / Perangkat / Komputer / Laptop / Printer / Monitor / Scanner / Server / UPS / CCTV / Telepon / Switch / Router)
- id, asset_code, name, serial_number, status ('active','maintenance','damage','disposed')
- category_id → asset_categories(id)
- location_id → locations(id)

TABEL 2: asset_categories (Kategori Aset)
- id, name (Laptop, Printer, Komputer, Telepon, Hub, Switch, Monitor, Scanner, Server, dll)

TABEL 3: locations (Lokasi / Ruangan / Gedung)
- id, name (contoh: "Kinanti 3A", "Instalasi Farmasi", "IGD", "Poliklinik", "Ruang Direksi")

TABEL 4: atk_items (Stok Barang / ATK / Consumable / Tinta / Kertas / Mouse / Keyboard / Cable / Sparepart)
- id, name, stock_quantity, unit, category, price

TABEL 5: tickets (Tiket Helpdesk / Masalah / Kendala / Maintenance Log)
- id, title, description, category ('hardware','software','network','data')
- priority ('low','medium','high','urgent'), status ('open','in_progress','resolved','closed')
- resolution_notes (catatan solusi teknis), created_at, resolved_at
- created_by → profiles(id), assigned_to → profiles(id)

CONTOH KONDISI & QUERY SQL VALID:
- Mencari Aset atau Perangkat berdasarkan Nama/Tipe/Lokasi:
  SELECT a.name, a.asset_code, a.status, l.name as location_name FROM assets a JOIN asset_categories ac ON a.category_id = ac.id JOIN locations l ON a.location_id = l.id WHERE a.name ILIKE '%laptop%' OR l.name ILIKE '%farmasi%' LIMIT 20
- Mencari Stok Barang/ATK/Tinta:
  SELECT name, stock_quantity, unit FROM atk_items WHERE name ILIKE '%tinta%' OR name ILIKE '%kertas%' LIMIT 20
- Mencari Tiket atau Solusi Perbaikan Terkait:
  SELECT title, status, resolution_notes FROM tickets WHERE title ILIKE '%printer%' OR description ILIKE '%printer%' LIMIT 10`;
}

/**
 * Natural conversation AI with Groq API
 */
export async function askGroqNatural(
    message: string,
    history: Message[] = []
): Promise<{ response: string; sql?: string; data?: unknown }> {
    const schema = getRelevantSchema();

    const systemPrompt = `Kamu adalah AI Assistant IT Helpdesk untuk rumah sakit SI MANTAP.

KEMAMPUAN:
1. Menjawab pertanyaan troubleshooting IT umum dan teknis
2. Mengambil data riil dari database (Aset IT, Stok Barang/ATK, Tiket Helpdesk) dengan membuat query SQL
3. Memahami konteks percakapan sebelumnya

${schema}

ATURAN PENTING GENERATE SQL:
1. Jawab selalu dalam Bahasa Indonesia yang ramah dan profesional.
2. Jika pertanyaan pengguna membutuhkan data riil (misal: cek stok, list aset, jumlah barang, status tiket, lokasi perangkat, solusi tiket sebelumnya), WAJIB buat query SQL yang valid.
3. HANYA gunakan perintah SELECT untuk SQL. Selalu sertakan LIMIT (maksimal 20).
4. Gunakan operator ILIKE untuk pencarian teks agar tidak case-sensitive (contoh: ILIKE '%printer%').
5. Pemetaan warna tinta printer: biru=cyan, merah=magenta, kuning=yellow, hitam=hitam.
6. Jika pengguna menanyakan lokasi lanjutan (misal: "lalu kalau di ruangan IGD?"), gunakan konteks lokasi dari percakapan sebelumnya.

FORMAT RESPONSE KETIKA PERLU QUERY DATABASE:
[SQL]
SELECT ... FROM ... WHERE ... LIMIT 20
[/SQL]

FORMAT RESPONSE KETIKA TIDAK PERLU DATABASE (Hanya konsultasi/pertanyaan umum):
Langsung jawab dengan teks penjelasan biasa tanpa tag [SQL].`;

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
        const aiResponse = await callGroqChatCompletions(formattedMessages, 0.2, 2048);

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
    if (!GROQ_API_KEY) return "Data ditemukan.";

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
        return await callGroqChatCompletions([{ role: "user", content: prompt }], 0.3, 1024);
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
        return await callGroqChatCompletions(formattedMessages, 0.3, 2048);
    } catch (error) {
        console.error("Groq RAG error:", error);
        throw error;
    }
}
