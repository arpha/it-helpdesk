import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    parseFonnteWebhook,
    sendWhatsAppMessage,
    formatPhoneNumber,
} from "@/lib/fonnte/client";
import {
    parseATKRequest,
    matchWithCatalog,
    getHelpMessage,
} from "@/lib/fonnte/parser";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Debug log - check Vercel Function Logs
        console.log("Webhook received:", JSON.stringify(body));

        const payload = parseFonnteWebhook(body);

        if (!payload) {
            console.log("Invalid payload, returning 400");
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const { sender, message } = payload;
        const supabase = createAdminClient();

        // Normalize phone number
        const normalizedPhone = formatPhoneNumber(sender);

        // Find user by WhatsApp phone
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name, department_id")
            .eq("whatsapp_phone", normalizedPhone)
            .single();

        if (profileError || !profile) {
            // User not registered
            await sendWhatsAppMessage({
                target: normalizedPhone,
                message: `❌ Nomor WhatsApp Anda belum terdaftar.

Silakan daftar terlebih dahulu di website IT Helpdesk dan tambahkan nomor WhatsApp di profil Anda.`,
            });
            return NextResponse.json({ status: "unregistered" });
        }

        const lowerMessage = message.toLowerCase().trim();

        // Handle /help command
        if (lowerMessage === "/help" || lowerMessage === "help") {
            await sendWhatsAppMessage({
                target: normalizedPhone,
                message: getHelpMessage(),
            });
            return NextResponse.json({ status: "help_sent" });
        }

        // Handle /daftar command - list available items
        if (lowerMessage === "/daftar" || lowerMessage === "daftar") {
            const { data: items } = await supabase
                .from("atk_items")
                .select("name, unit, stock_quantity")
                .order("name");

            if (items && items.length > 0) {
                const itemList = items
                    .map((item, i) => `${i + 1}. ${item.name} (${item.unit}) - Stok: ${item.stock_quantity}`)
                    .join("\n");

                await sendWhatsAppMessage({
                    target: normalizedPhone,
                    message: `📦 *Daftar Barang ATK*\n\n${itemList}`,
                });
            } else {
                await sendWhatsAppMessage({
                    target: normalizedPhone,
                    message: "Tidak ada barang ATK tersedia.",
                });
            }
            return NextResponse.json({ status: "list_sent" });
        }

        // Handle /status command
        if (lowerMessage === "/status" || lowerMessage === "status") {
            const { data: requests } = await supabase
                .from("atk_requests")
                .select("id, status, created_at")
                .eq("requested_by", profile.id)
                .order("created_at", { ascending: false })
                .limit(5);

            if (requests && requests.length > 0) {
                const statusList = requests
                    .map(req => {
                        const statusEmoji = req.status === "approved" ? "✅" :
                            req.status === "rejected" ? "❌" : "⏳";
                        const date = new Date(req.created_at).toLocaleDateString("id-ID");
                        return `${statusEmoji} ${req.id.slice(0, 8)} - ${req.status} (${date})`;
                    })
                    .join("\n");

                await sendWhatsAppMessage({
                    target: normalizedPhone,
                    message: `📋 *Status Request ATK Anda*\n\n${statusList}`,
                });
            } else {
                await sendWhatsAppMessage({
                    target: normalizedPhone,
                    message: "Anda belum memiliki request ATK.",
                });
            }
            return NextResponse.json({ status: "status_sent" });
        }

        // Handle /atk request
        if (lowerMessage.startsWith("/atk") || lowerMessage.startsWith("atk")) {
            const parsed = parseATKRequest(message);

            if (!parsed.isValid) {
                await sendWhatsAppMessage({
                    target: normalizedPhone,
                    message: `❌ Format tidak valid.\n\n${parsed.error}\n\nKetik /help untuk bantuan.`,
                });
                return NextResponse.json({ status: "invalid_format" });
            }

            // Get catalog items
            const { data: catalogItems } = await supabase
                .from("atk_items")
                .select("id, name, unit");

            if (!catalogItems || catalogItems.length === 0) {
                await sendWhatsAppMessage({
                    target: normalizedPhone,
                    message: "❌ Tidak ada barang ATK tersedia.",
                });
                return NextResponse.json({ status: "no_items" });
            }

            // Match parsed items with catalog
            const matched = matchWithCatalog(parsed.items, catalogItems);
            const unmatched = matched.filter(m => !m.itemId);

            if (unmatched.length > 0) {
                const unmatchedNames = unmatched.map(m => m.parsedItem.name).join(", ");
                await sendWhatsAppMessage({
                    target: normalizedPhone,
                    message: `❌ Barang tidak ditemukan: ${unmatchedNames}\n\nKetik /daftar untuk melihat daftar barang yang tersedia.`,
                });
                return NextResponse.json({ status: "items_not_found" });
            }

            // Create ATK request
            const { data: newRequest, error: requestError } = await supabase
                .from("atk_requests")
                .insert({
                    requested_by: profile.id,
                    department_id: profile.department_id,
                    status: "pending",
                    notes: parsed.purpose,
                    source: "whatsapp",
                })
                .select("id")
                .single();

            if (requestError || !newRequest) {
                await sendWhatsAppMessage({
                    target: normalizedPhone,
                    message: "❌ Gagal membuat request. Silakan coba lagi.",
                });
                return NextResponse.json({ status: "error", error: requestError?.message });
            }

            // Create request items
            const requestItems = matched.map(m => ({
                request_id: newRequest.id,
                item_id: m.itemId,
                quantity: m.parsedItem.quantity,
            }));

            await supabase.from("atk_request_items").insert(requestItems);

            // Send confirmation
            const itemList = matched
                .map(m => `• ${m.match} × ${m.parsedItem.quantity} ${m.parsedItem.unit}`)
                .join("\n");

            await sendWhatsAppMessage({
                target: normalizedPhone,
                message: `✅ *Request ATK Berhasil!*

📝 *Items:*
${itemList}

📋 *Keperluan:* ${parsed.purpose || "-"}
🆔 *No. Request:* ${newRequest.id.slice(0, 8)}

Status akan dikirim via WhatsApp.`,
            });

            return NextResponse.json({ status: "success", requestId: newRequest.id });
        }

        // Unknown command
        await sendWhatsAppMessage({
            target: normalizedPhone,
            message: `Halo ${profile.full_name}! 👋

Ketik /help untuk bantuan cara request ATK.`,
        });

        return NextResponse.json({ status: "greeting_sent" });
    } catch (error) {
        console.error("Webhook error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// Fonnte sends GET for verification
export async function GET() {
    return NextResponse.json({ status: "Webhook active" });
}
