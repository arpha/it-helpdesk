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
 * Get full database schema with explicit relationship mapping (JOIN profiles)
 */
function getRelevantSchema(): string {
    return `DATABASE SCHEMA SI MANTAP (Gunakan untuk generate SQL query jika user menanyakan data/stok/aset/pemegang aset/tiket):

TABEL 1: profiles (Data Pegawai / Pengguna / Pemegang Aset / Pelapor / Teknisi IT)
- id (UUID), full_name (Nama Lengkap Pegawai), email, role ('admin','staff_it','user'), location_id → locations(id)

TABEL 2: assets (Aset IT / Perangkat / Komputer / Laptop / Printer / Monitor / Scanner / Server / UPS / CCTV / Telepon / Switch / Router)
- id (UUID), asset_code, name, serial_number, status ('active','maintenance','damage','disposed')
- category_id → asset_categories(id)
- location_id → locations(id)
- assigned_to → profiles(id) (UUID Pemegang/Pengguna Aset saat ini. PENTING: Gunakan LEFT JOIN profiles p ON a.assigned_to = p.id untuk mengambil Nama Pemegang/Pengguna aset!)

TABEL 3: asset_assignments (Riwayat Penyerahan / Pemegang Aset)
- id, asset_id → assets(id), user_id → profiles(id), assigned_at, returned_at

TABEL 4: asset_categories (Kategori Aset)
- id, name (Laptop, Printer, Komputer, Telepon, Hub, Switch, Monitor, Scanner, Server, dll)

TABEL 5: locations (Lokasi / Ruangan / Gedung)
- id, name (contoh: "Kinanti 3A", "Instalasi Farmasi", "IGD", "Poliklinik", "Ruang Direksi")

TABEL 6: atk_items (Stok Barang / ATK / Consumable / Tinta / Kertas / Mouse / Keyboard / Cable / Sparepart)
- id, name, stock_quantity, unit, category, price

TABEL 7: tickets (Tiket Helpdesk / Masalah / Kendala / Maintenance Log)
- id, title, description, category ('hardware','software','network','data')
- priority ('low','medium','high','urgent'), status ('open','in_progress','resolved','closed')
- resolution_notes (catatan solusi teknis), created_at, resolved_at
- created_by → profiles(id) (Pelapor), assigned_to → profiles(id) (Teknisi IT yang menangani)

CONTOH QUERY SQL RELASI PENUH (JOIN PROFILES & LOCATIONS):
- Mencari Pemegang / Pengguna Aset atau Laptop (WAJIB JOIN profiles):
  SELECT a.name as asset_name, a.asset_code, a.status, p.full_name as holder_name, l.name as location_name FROM assets a LEFT JOIN profiles p ON a.assigned_to = p.id LEFT JOIN locations l ON a.location_id = l.id WHERE a.name ILIKE '%laptop%' OR p.full_name ILIKE '%budi%' LIMIT 20

- Mencari Aset Berdasarkan Nama Pegawai Pemegang:
  SELECT a.name as asset_name, a.asset_code, a.status, p.full_name as holder_name FROM assets a JOIN profiles p ON a.assigned_to = p.id WHERE p.full_name ILIKE '%ahmad%' LIMIT 20

- Mencari Tiket Beserta Pelapor & Teknisi Penanggung Jawab:
  SELECT t.title, t.status, creator.full_name as pelapor, tech.full_name as teknisi FROM tickets t LEFT JOIN profiles creator ON t.created_by = creator.id LEFT JOIN profiles tech ON t.assigned_to = tech.id WHERE t.status = 'open' LIMIT 10`;
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
2. Mengambil data riil dari database (Aset IT, Pemegang Aset/Pegawai, Stok Barang/ATK, Tiket Helpdesk) dengan membuat query SQL
3. Memahami konteks percakapan sebelumnya

${schema}

ATURAN PENTING GENERATE SQL:
1. Jawab selalu dalam Bahasa Indonesia yang ramah dan profesional.
2. Jika pengguna menanyakan PEMEGANG/PENGGUNA aset (misal: "Laptop X dipegang siapa?", "Aset yang dibawa Budi", "Siapa yang pakai printer Y?"), WAJIB gunakan LEFT JOIN profiles p ON a.assigned_to = p.id dan ambil kolom p.full_name.
3. HANYA gunakan perintah SELECT untuk SQL. Selalu sertakan LIMIT (maksimal 20).
4. Gunakan operator ILIKE untuk pencarian teks agar tidak case-sensitive (contoh: ILIKE '%laptop%').
5. Pemetaan warna tinta printer: biru=cyan, merah=magenta, kuning=yellow, hitam=hitam.
6. Jika pengguna menanyakan lokasi lanjutan, gunakan konteks lokasi dari percakapan sebelumnya.

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
- Jika data mencantumkan nama pemegang/pegawai (col: holder_name atau full_name), sebutkan secara jelas siapa pemegang aset tersebut.
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
