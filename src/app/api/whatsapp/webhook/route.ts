import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    parseFonnteWebhook,
    sendWhatsAppMessage,
    formatPhoneNumber,
} from "@/lib/fonnte/client";

// In-memory conversation state (use Redis in production for multi-instance)
const conversationState = new Map<string, {
    step: string;
    data: {
        category?: string;
        priority?: string;
        description?: string;
    };
    timestamp: number;
}>();

// Cleanup old conversations (5 minutes timeout)
function cleanupOldConversations() {
    const now = Date.now();
    for (const [phone, state] of conversationState) {
        if (now - state.timestamp > 5 * 60 * 1000) {
            conversationState.delete(phone);
        }
    }
}

const CATEGORIES = ["hardware", "software", "data", "network"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

function getMainMenu(name: string) {
    return `Halo *${name}*! 👋

Selamat datang di IT Helpdesk.

Ketik angka untuk memilih:
*1.* 🎫 Buat Ticket Baru
*2.* 📋 Cek Status Ticket
*3.* ❓ Bantuan`;
}

function getCategoryMenu() {
    return `📂 *Pilih Kategori Masalah:*

*1.* 💻 Hardware (PC, Laptop, Printer, dll)
*2.* 🖥️ Software (Aplikasi, Error, dll)
*3.* 💾 Data (Backup, Recovery, dll)
*4.* 🌐 Network (Internet, WiFi, dll)

Ketik angka 1-4:`;
}

function getPriorityMenu() {
    return `⚡ *Pilih Prioritas:*

*1.* 🟢 Low (Bisa ditunda)
*2.* 🟡 Medium (Perlu segera)
*3.* 🟠 High (Penting)
*4.* 🔴 Urgent (Sangat mendesak)

Ketik angka 1-4:`;
}

function getHelpMessage() {
    return `❓ *Bantuan IT Helpdesk*

*Cara Buat Ticket:*
1. Ketik *1* atau *ticket*
2. Pilih kategori (1-4)
3. Pilih prioritas (1-4)
4. Ketik deskripsi masalah

*Commands:*
• *1* atau *ticket* - Buat ticket baru
• *2* atau *status* - Cek status ticket
• *3* atau *help* - Tampilkan bantuan
• *batal* - Batalkan proses`;
}

export async function POST(request: NextRequest) {
    try {
        cleanupOldConversations();

        const body = await request.json();
        console.log("Webhook received:", JSON.stringify(body));

        const payload = parseFonnteWebhook(body);

        if (!payload) {
            console.log("Invalid payload, returning 400");
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const { sender, message } = payload;
        const supabase = createAdminClient();

        const normalizedPhone = formatPhoneNumber(sender);
        console.log("Sender:", sender, "Normalized:", normalizedPhone);

        // Try multiple phone formats for matching
        const phoneVariants = [
            normalizedPhone,
            normalizedPhone.replace(/^62/, "0"),
            normalizedPhone.replace(/^62/, ""),
            sender,
        ];

        // Find user by WhatsApp phone
        let profile = null;
        for (const phone of phoneVariants) {
            console.log("Trying phone variant:", phone);
            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name")
                .eq("whatsapp_phone", phone)
                .single();

            console.log("Query result:", { data, error: error?.message });

            if (data) {
                profile = data;
                console.log("Profile found:", profile);
                break;
            }
        }

        // Fallback: partial match
        if (!profile) {
            const last9Digits = normalizedPhone.slice(-9);
            console.log("Fallback: searching with last 9 digits:", last9Digits);
            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, whatsapp_phone")
                .ilike("whatsapp_phone", `%${last9Digits}`)
                .single();

            console.log("Fallback result:", { data, error: error?.message });
            if (data) profile = data;
        }

        if (!profile) {
            await sendWhatsAppMessage({
                target: normalizedPhone,
                message: `❌ Nomor WhatsApp Anda belum terdaftar.

Silakan hubungi Admin IT untuk mendaftarkan nomor Anda.`,
            });
            return NextResponse.json({ status: "unregistered" });
        }

        const lowerMessage = message.toLowerCase().trim();
        const state = conversationState.get(normalizedPhone);

        // Handle cancel command
        if (lowerMessage === "batal" || lowerMessage === "cancel") {
            conversationState.delete(normalizedPhone);
            await sendWhatsAppMessage({
                target: normalizedPhone,
                message: "❌ Proses dibatalkan.\n\n" + getMainMenu(profile.full_name),
            });
            return NextResponse.json({ status: "cancelled" });
        }

        // Handle conversation state
        if (state) {
            return await handleConversation(supabase, normalizedPhone, profile, lowerMessage, state);
        }

        // Main menu commands
        if (lowerMessage === "1" || lowerMessage === "ticket" || lowerMessage === "/ticket") {
            conversationState.set(normalizedPhone, {
                step: "select_category",
                data: {},
                timestamp: Date.now(),
            });
            await sendWhatsAppMessage({
                target: normalizedPhone,
                message: getCategoryMenu(),
            });
            return NextResponse.json({ status: "category_menu" });
        }

        if (lowerMessage === "2" || lowerMessage === "status" || lowerMessage === "/status") {
            const { data: tickets } = await supabase
                .from("tickets")
                .select("id, title, status, priority, created_at")
                .eq("created_by", profile.id)
                .order("created_at", { ascending: false })
                .limit(5);

            if (tickets && tickets.length > 0) {
                const statusEmojis: Record<string, string> = {
                    open: "🟡",
                    in_progress: "🔵",
                    resolved: "✅",
                    closed: "⚫",
                };
                const ticketList = tickets
                    .map(t => {
                        const emoji = statusEmojis[t.status] || "⏳";
                        const date = new Date(t.created_at).toLocaleDateString("id-ID");
                        return `${emoji} *${t.title}*\n   Status: ${t.status} | ${date}`;
                    })
                    .join("\n\n");

                await sendWhatsAppMessage({
                    target: normalizedPhone,
                    message: `📋 *Ticket Anda (5 Terakhir):*\n\n${ticketList}`,
                });
            } else {
                await sendWhatsAppMessage({
                    target: normalizedPhone,
                    message: "📋 Anda belum memiliki ticket.\n\nKetik *1* untuk buat ticket baru.",
                });
            }
            return NextResponse.json({ status: "status_sent" });
        }

        if (lowerMessage === "3" || lowerMessage === "help" || lowerMessage === "/help") {
            await sendWhatsAppMessage({
                target: normalizedPhone,
                message: getHelpMessage(),
            });
            return NextResponse.json({ status: "help_sent" });
        }

        // Default: show main menu
        await sendWhatsAppMessage({
            target: normalizedPhone,
            message: getMainMenu(profile.full_name),
        });

        return NextResponse.json({ status: "menu_sent" });
    } catch (error) {
        console.error("Webhook error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

async function handleConversation(
    supabase: ReturnType<typeof createAdminClient>,
    phone: string,
    profile: { id: string; full_name: string },
    message: string,
    state: { step: string; data: { category?: string; priority?: string; description?: string }; timestamp: number }
) {
    const { step, data } = state;

    // Step 1: Select category
    if (step === "select_category") {
        const categoryIndex = parseInt(message) - 1;
        if (categoryIndex >= 0 && categoryIndex < CATEGORIES.length) {
            data.category = CATEGORIES[categoryIndex];
            conversationState.set(phone, { step: "select_priority", data, timestamp: Date.now() });
            await sendWhatsAppMessage({
                target: phone,
                message: `✅ Kategori: *${data.category.toUpperCase()}*\n\n` + getPriorityMenu(),
            });
            return NextResponse.json({ status: "priority_menu" });
        } else {
            await sendWhatsAppMessage({
                target: phone,
                message: "❌ Pilihan tidak valid. Ketik angka 1-4.\n\n" + getCategoryMenu(),
            });
            return NextResponse.json({ status: "invalid_category" });
        }
    }

    // Step 2: Select priority
    if (step === "select_priority") {
        const priorityIndex = parseInt(message) - 1;
        if (priorityIndex >= 0 && priorityIndex < PRIORITIES.length) {
            data.priority = PRIORITIES[priorityIndex];
            conversationState.set(phone, { step: "enter_description", data, timestamp: Date.now() });
            await sendWhatsAppMessage({
                target: phone,
                message: `✅ Prioritas: *${data.priority.toUpperCase()}*

📝 *Ketik deskripsi masalah Anda:*

(Jelaskan secara singkat masalah yang dialami)`,
            });
            return NextResponse.json({ status: "description_prompt" });
        } else {
            await sendWhatsAppMessage({
                target: phone,
                message: "❌ Pilihan tidak valid. Ketik angka 1-4.\n\n" + getPriorityMenu(),
            });
            return NextResponse.json({ status: "invalid_priority" });
        }
    }

    // Step 3: Enter description & create ticket
    if (step === "enter_description") {
        data.description = message;

        // Get least busy technician for auto-assign
        const { data: technicians } = await supabase
            .from("profiles")
            .select("id")
            .in("role", ["staff_it", "admin"]);

        let assigneeId: string | null = null;
        if (technicians && technicians.length > 0) {
            const { data: ticketCounts } = await supabase
                .from("tickets")
                .select("assigned_to")
                .in("status", ["open", "in_progress"])
                .not("assigned_to", "is", null);

            const countMap = new Map<string, number>();
            technicians.forEach(t => countMap.set(t.id, 0));
            ticketCounts?.forEach(t => {
                if (t.assigned_to && countMap.has(t.assigned_to)) {
                    countMap.set(t.assigned_to, (countMap.get(t.assigned_to) || 0) + 1);
                }
            });

            let minCount = Infinity;
            for (const [id, count] of countMap) {
                if (count < minCount) {
                    minCount = count;
                    assigneeId = id;
                }
            }
        }

        // Create ticket in database
        const { data: ticket, error } = await supabase
            .from("tickets")
            .insert({
                title: `[WA] ${data.description?.slice(0, 50)}...`,
                description: data.description,
                category: data.category,
                priority: data.priority,
                status: assigneeId ? "in_progress" : "open",
                created_by: profile.id,
                assigned_to: assigneeId,
                // location_id removed - not in profiles table
            })
            .select("id, title, category, priority")
            .single();

        conversationState.delete(phone);

        if (error || !ticket) {
            await sendWhatsAppMessage({
                target: phone,
                message: "❌ Gagal membuat ticket. Silakan coba lagi.\n\nKetik *1* untuk mencoba lagi.",
            });
            return NextResponse.json({ status: "error", error: error?.message });
        }

        const ticketId = ticket.id.slice(0, 8).toUpperCase();

        // Send notification to assigned technician
        if (assigneeId) {
            const { data: assignee } = await supabase
                .from("profiles")
                .select("full_name, whatsapp_phone")
                .eq("id", assigneeId)
                .single();

            if (assignee?.whatsapp_phone) {
                await sendWhatsAppMessage({
                    target: formatPhoneNumber(assignee.whatsapp_phone),
                    message: `🎫 *TICKET BARU UNTUK ANDA*

📋 *Judul:* ${ticket.title}
📂 *Kategori:* ${ticket.category}
⚡ *Prioritas:* ${ticket.priority?.toUpperCase()}
👤 *Pelapor:* ${profile.full_name}

Anda telah di-assign otomatis ke tiket ini.
Silakan login ke IT Helpdesk untuk detail lebih lanjut.`,
                });
            }
        }

        await sendWhatsAppMessage({
            target: phone,
            message: `✅ *TICKET BERHASIL DIBUAT!*

🆔 *ID:* ${ticketId}
📂 *Kategori:* ${data.category}
⚡ *Prioritas:* ${data.priority}
📝 *Deskripsi:* ${data.description}
${assigneeId ? "\n✅ Ticket sudah di-assign ke teknisi." : ""}
Tim IT akan segera merespon ticket Anda.
Ketik *2* untuk cek status ticket.`,
        });

        return NextResponse.json({ status: "ticket_created", ticketId: ticket.id });
    }

    return NextResponse.json({ status: "unknown_step" });
}

// Fonnte sends GET for verification
export async function GET() {
    return NextResponse.json({ status: "Webhook active" });
}
