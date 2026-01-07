"use server";

// Try Gemini first, fallback to Groq if configured
const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

export async function askGemini(
    question: string,
    ticketContext: string
): Promise<string> {
    const systemPrompt = `Kamu adalah AI Assistant IT Helpdesk untuk rumah sakit. 
Tugasmu membantu staff IT menyelesaikan masalah berdasarkan riwayat tiket yang sudah diselesaikan.

ATURAN:
1. Jawab dalam Bahasa Indonesia yang jelas dan ringkas
2. Berikan langkah-langkah yang actionable
3. Jika ada tiket serupa di riwayat, sebutkan solusi yang pernah berhasil
4. Jika tidak ada riwayat serupa, berikan troubleshooting umum
5. Format jawaban dengan bullet points untuk kemudahan baca

RIWAYAT TIKET YANG RELEVAN:
${ticketContext || "Tidak ada riwayat tiket yang relevan ditemukan."}`;

    // Try Groq first (more reliable)
    if (GROQ_API_KEY) {
        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: question }
                    ],
                    temperature: 0.7,
                    max_tokens: 1024,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices?.[0]?.message?.content || "Tidak ada respons dari AI";
            }
            console.error("Groq API error:", await response.text());
        } catch (error) {
            console.error("Groq error:", error);
        }
    }

    // Fallback to Gemini
    if (GEMINI_API_KEY) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `${systemPrompt}\n\nPertanyaan: ${question}` }] }]
                    }),
                }
            );

            if (response.ok) {
                const data = await response.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || "Tidak ada respons dari AI";
            }
            console.error("Gemini API error:", await response.text());
        } catch (error) {
            console.error("Gemini error:", error);
        }
    }

    throw new Error("Tidak ada API key yang valid. Silakan konfigurasi GROQ_API_KEY atau GOOGLE_GEMINI_API_KEY di .env.local");
}
