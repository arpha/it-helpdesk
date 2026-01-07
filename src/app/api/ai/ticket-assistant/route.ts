import { NextRequest, NextResponse } from "next/server";
import { askGeminiNatural, summarizeQueryResult } from "@/lib/gemini/client";
import { executeReadOnlyQuery, validateSqlQuery } from "@/lib/ai/tools";

export async function POST(request: NextRequest) {
    try {
        const { message: rawMessage, history = [] } = await request.json();

        if (!rawMessage) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // Preprocess message: replace color synonyms
        const colorReplacements: [RegExp, string][] = [
            [/\b(warna\s+)?biru\b/gi, 'cyan'],
            [/\b(warna\s+)?merah\b/gi, 'magenta'],
            [/\b(warna\s+)?kuning\b/gi, 'yellow'],
            [/\b(warna\s+)?hitam\b/gi, 'hitam'],
            [/\bblue\b/gi, 'cyan'],
            [/\bred\b/gi, 'magenta'],
            [/\bblack\b/gi, 'hitam'],
            [/\byellow\b/gi, 'yellow'],
        ];

        let message = rawMessage;
        for (const [pattern, replacement] of colorReplacements) {
            message = message.replace(pattern, replacement);
        }

        // Check for follow-up question (short/abbreviated question that needs context)
        const isFollowUp = message.length < 30 && (
            message.toLowerCase().startsWith('kalau') ||
            message.toLowerCase().startsWith('bagaimana dengan') ||
            message.toLowerCase().startsWith('terus') ||
            message.toLowerCase().startsWith('lalu') ||
            message.toLowerCase().startsWith('dan') ||
            message.match(/^\??[a-z ]+\?$/i)
        );

        // If follow-up, try to expand with context from previous messages
        if (isFollowUp && history.length > 0) {
            const previousUserMessages = history
                .filter((h: { role: string }) => h.role === 'user')
                .map((h: { content: string }) => h.content);

            if (previousUserMessages.length > 0) {
                // Search ALL previous messages for location pattern
                let location = '';
                for (let i = previousUserMessages.length - 1; i >= 0; i--) {
                    if (i === previousUserMessages.length - 1) continue;

                    const prevMsg = previousUserMessages[i];
                    const locationMatch = prevMsg.match(/di\s+([^\?]+)/i);
                    if (locationMatch) {
                        location = locationMatch[1].trim();
                        break;
                    }
                }

                if (location) {
                    const expandedKeyword = message
                        .replace(/kalau/gi, '')
                        .replace(/bagaimana dengan/gi, '')
                        .replace(/\?/g, '')
                        .trim();

                    message = `list ${expandedKeyword} di ${location}`;
                    console.log("Expanded follow-up:", message);
                }
            }
        }

        console.log("Preprocessed message:", message);

        // Call AI with natural conversation
        const aiResult = await askGeminiNatural(message, history);

        let finalResponse = aiResult.response;
        let queryData = null;
        let generatedSql = aiResult.sql || null;

        // If AI generated SQL, execute it
        if (aiResult.sql) {
            console.log("AI generated SQL:", aiResult.sql);

            // Validate SQL
            const validation = validateSqlQuery(aiResult.sql);
            if (!validation.valid) {
                console.log("SQL validation failed:", validation.error);
                finalResponse = `Maaf, query tidak valid: ${validation.error}`;
            } else {
                // Execute query
                const queryResult = await executeReadOnlyQuery(aiResult.sql);

                if (queryResult.error) {
                    console.log("SQL execution error:", queryResult.error);
                    finalResponse = `Maaf, terjadi kesalahan saat mengambil data: ${queryResult.error}`;
                } else {
                    queryData = queryResult.data;
                    console.log("Query result:", queryData);

                    // Format the data into response
                    if (Array.isArray(queryData) && queryData.length > 0) {
                        // Check if it's a count query
                        const firstRow = queryData[0];
                        if (firstRow.total !== undefined || firstRow.count !== undefined) {
                            const count = firstRow.total ?? firstRow.count;
                            finalResponse = `${aiResult.response || "Berikut hasilnya:"}\n\nTotal: **${count}**`;
                        } else {
                            // DATA FOUND: Use AI to Summarize the result nicely (Second Pass)
                            const summary = await summarizeQueryResult(message, queryData);
                            if (summary) {
                                finalResponse = summary;
                            } else {
                                // Fallback to list formatting if summary fails
                                const formattedItems = queryData.map((item: Record<string, unknown>) => {
                                    const parts = [];
                                    if (item.name) parts.push(`**${item.name}**`);
                                    if (item.asset_code) parts.push(`(${item.asset_code})`);
                                    if (item.serial_number) parts.push(`[SN: ${item.serial_number}]`);
                                    if (item.status) parts.push(`- ${item.status}`);
                                    if (item.resolution_notes) parts.push(`\n   💡 Solusi: ${item.resolution_notes}`);

                                    // Add any other columns
                                    Object.entries(item).forEach(([key, value]) => {
                                        if (!['name', 'asset_code', 'serial_number', 'status', 'stock_quantity', 'unit', 'location_name', 'resolution_notes'].includes(key)) {
                                            parts.push(`${key}: ${value}`);
                                        }
                                    });

                                    return `• ${parts.join(' ')}`;
                                }).join('\n');
                                finalResponse = `${aiResult.response || "Berikut hasilnya:"}\n\n${formattedItems}`;
                            }
                        }
                    } else if (Array.isArray(queryData) && queryData.length === 0) {
                        finalResponse = `Tidak ditemukan data yang sesuai dengan pencarian Anda.`;
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            response: finalResponse,
            debug: {
                preprocessedMessage: message,
                generatedSql,
                queryData
            }
        });

    } catch (error) {
        console.error("AI ticket-assistant error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Terjadi kesalahan",
                response: "Maaf, terjadi kesalahan saat memproses permintaan Anda."
            },
            { status: 500 }
        );
    }
}
