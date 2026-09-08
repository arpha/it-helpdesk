"use server";

import { askGroqNatural, summarizeQueryResultGroq, askGroqRAG } from "@/lib/groq/client";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || "";

type Message = {
    role: "user" | "assistant";
    content: string;
};

/**
 * Natural conversation AI with Groq (with optional fallback to Gemini if key exists)
 */
export async function askGeminiNatural(
    message: string,
    history: Message[] = []
): Promise<{ response: string; sql?: string; data?: unknown }> {
    if (GROQ_API_KEY || !GEMINI_API_KEY) {
        return askGroqNatural(message, history);
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `User: ${message}` }]
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
            console.error("Gemini API error status:", response.status, "details:", errorText);
            throw new Error(`Gemini API error: ${response.status} (${errorText})`);
        }

        const data = await response.json();
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return { response: aiResponse };
    } catch (error) {
        console.error("Fallback Gemini natural error, falling back to Groq if possible:", error);
        return askGroqNatural(message, history);
    }
}

/**
 * Summarize query results into natural language answer
 */
export async function summarizeQueryResult(
    question: string,
    data: any[]
): Promise<string> {
    return summarizeQueryResultGroq(question, data);
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

/**
 * Knowledge Base RAG Assistant function
 */
export async function askGeminiRAG(
    userQuery: string,
    kbArticles: { id: string; title: string; category: string; summary?: string; content: string }[],
    sopDocuments: { id: string; title: string; category: string; description?: string }[] = [],
    history: Message[] = []
): Promise<string> {
    return askGroqRAG(userQuery, kbArticles, sopDocuments, history);
}
