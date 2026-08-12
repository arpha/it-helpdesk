import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    parseFonnteWebhook,
    sendWhatsAppMessage,
    formatPhoneNumber,
    resolveGroupTarget,
} from "@/lib/fonnte/client";

// In-memory conversation state (use Redis in production for multi-instance)
const conversationState = new Map<string, {
    step: string;
    data: {
        category?: string;
        priority?: string;
        description?: string;
        // Borrowing fields
        borrowing_search?: string;
        borrowing_assets?: { id: string; name: string; asset_code: string; location: string }[];
        selected_asset_id?: string;
        borrowing_locations?: { id: string; name: string }[];
        selected_location_id?: string;
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
*3.* 📦 Pinjam Asset
*4.* ❓ Bantuan`;
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

*Cara Pinjam Asset:*
1. Ketik *3* atau *pinjam*
2. Ketik nama asset yang dicari
3. Pilih asset dari hasil pencarian
4. Masukkan lokasi dan tujuan

*Commands:*
• *1* atau *ticket* - Buat ticket baru
• *2* atau *status* - Cek status ticket
• *3* atau *pinjam* - Pinjam asset
• *4* atau *help* - Tampilkan bantuan
• *batal* - Batalkan proses`;
}

export async function POST(request: NextRequest) {
    try {
        cleanupOldConversations();

        let body: any = {};
        const contentType = request.headers.get("content-type") || "";
        
        if (contentType.includes("application/json")) {
            body = await request.json();
        } else {
            // Support form data (x-www-form-urlencoded) sent by Fonnte
            const formData = await request.formData();
            formData.forEach((value, key) => {
                body[key] = value;
            });
        }
        
        console.log("Webhook received body:", JSON.stringify(body));

        const payload = parseFonnteWebhook(body);

        if (!payload) {
            console.log("Invalid payload, returning 400");
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const { sender, message, member, name } = payload;
        const supabase = createAdminClient();

        // Detect if this is a group message or explicit tag
        const isGroupMessage = sender.includes("@g.us") || sender.includes("-") || !!member;
        const lowerMsg = message.toLowerCase();
        const hasHelpdeskTag = lowerMsg.includes("#halokangit");
        const hasCheckTag = lowerMsg.includes("#cektiket");
        const hasAnyTag = hasHelpdeskTag || hasCheckTag;

        if (isGroupMessage || hasAnyTag) {
            // Ignore group messages without any recognized tag to prevent bot spam
            if (!hasAnyTag) {
                return NextResponse.json({ status: "ignored_no_tag" });
            }

            const senderPhone = member || sender;

            // ============================================
            // HANDLER: #cektiket [ID Tiket]
            // ============================================
            if (hasCheckTag) {
                const ticketIdMatch = message.match(/#cektiket\s+([a-zA-Z0-9\-]+)/i);
                
                if (!ticketIdMatch) {
                    const resolvedTarget = await resolveGroupTarget(sender, senderPhone);
                    await sendWhatsAppMessage({
                        target: resolvedTarget,
                        message: `❌ Format salah.\n\nGunakan format:\n*#cektiket [ID Tiket]*\n\nContoh:\n#cektiket 651EEEC1`
                    });
                    return NextResponse.json({ status: "check_ticket_invalid_format" });
                }

                const ticketIdInput = ticketIdMatch[1].toLowerCase();
                console.log("Checking ticket status for:", ticketIdInput);

                // Search ticket by ID prefix (short ID)
                const { data: tickets, error: searchErr } = await supabase
                    .from("tickets")
                    .select("id, title, description, category, priority, status, created_at, assigned_to, resolved_at, resolution_notes")
                    .order("created_at", { ascending: false })
                    .limit(50);

                if (searchErr || !tickets) {
                    console.error("Error searching tickets:", searchErr);
                    const resolvedTarget = await resolveGroupTarget(sender, senderPhone);
                    await sendWhatsAppMessage({
                        target: resolvedTarget,
                        message: "❌ Terjadi kesalahan saat mencari tiket. Silakan coba lagi."
                    });
                    return NextResponse.json({ status: "check_ticket_error" });
                }

                // Find ticket matching the short ID prefix
                const matchedTicket = tickets.find(t => 
                    t.id.toLowerCase().startsWith(ticketIdInput)
                );

                const resolvedTarget = await resolveGroupTarget(sender, senderPhone);

                if (!matchedTicket) {
                    await sendWhatsAppMessage({
                        target: resolvedTarget,
                        message: `❌ Tiket dengan ID *${ticketIdInput.toUpperCase()}* tidak ditemukan.\n\nPastikan ID tiket sudah benar.`
                    });
                    return NextResponse.json({ status: "ticket_not_found" });
                }

                // Map status to emoji and label
                const statusMap: Record<string, string> = {
                    open: "🟡 Open (Menunggu)",
                    in_progress: "🔵 In Progress (Dikerjakan)",
                    resolved: "🟢 Resolved (Selesai)",
                    closed: "⚫ Closed (Ditutup)",
                    draft: "⚪ Draft"
                };

                const priorityMap: Record<string, string> = {
                    low: "🟢 Low",
                    medium: "🟡 Medium",
                    high: "🟠 High",
                    urgent: "🔴 Urgent"
                };

                const ticketStatus = statusMap[matchedTicket.status] || matchedTicket.status;
                const ticketPriority = priorityMap[matchedTicket.priority] || matchedTicket.priority;
                const createdDate = new Date(matchedTicket.created_at).toLocaleString("id-ID", { 
                    timeZone: "Asia/Jakarta",
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit"
                });

                let statusMessage = `📋 *STATUS TIKET*

🆔 *ID:* ${matchedTicket.id.slice(0, 8).toUpperCase()}
📌 *Judul:* ${matchedTicket.title}
📊 *Status:* ${ticketStatus}
⚡ *Prioritas:* ${ticketPriority}
📂 *Kategori:* ${matchedTicket.category}
📅 *Dibuat:* ${createdDate}`;

                if (matchedTicket.status === "resolved" && matchedTicket.resolution_notes) {
                    statusMessage += `\n\n✅ *Catatan Penyelesaian:*\n${matchedTicket.resolution_notes}`;
                }

                if (matchedTicket.resolved_at) {
                    const resolvedDate = new Date(matchedTicket.resolved_at).toLocaleString("id-ID", {
                        timeZone: "Asia/Jakarta",
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit"
                    });
                    statusMessage += `\n📅 *Diselesaikan:* ${resolvedDate}`;
                }

                await sendWhatsAppMessage({
                    target: resolvedTarget,
                    message: statusMessage
                });

                return NextResponse.json({ status: "ticket_status_sent" });
            }

            // ============================================
            // HANDLER: #halokangit (Buat Tiket Baru)
            // ============================================

            // 1. Parse ticket info from the message
            const nameMatch = message.match(/Nama\s*:\s*(.+)/i);
            const unitMatch = message.match(/Unit\s*:\s*(.+)/i);
            const kendalaMatch = message.match(/Kendala\s*:\s*(.+)/i);

            const reporterName = nameMatch ? nameMatch[1].trim() : (name || "User WA");
            const unitName = unitMatch ? unitMatch[1].trim() : "-";
            const aduanText = kendalaMatch ? kendalaMatch[1].trim() : message.replace(/#halokangit/gi, "").replace(/#ithelpdesk/gi, "").trim();

            // 2. Find profile by sender's phone
            let creatorProfile = null;
            const normalizedSenderPhone = formatPhoneNumber(senderPhone);
            const last9Digits = normalizedSenderPhone.slice(-9);

            const { data: matchedProfile } = await supabase
                .from("profiles")
                .select("id, full_name, is_active")
                .ilike("whatsapp_phone", `%${last9Digits}`)
                .single();

            if (matchedProfile && matchedProfile.is_active !== false) {
                creatorProfile = matchedProfile;
            }

            // Fallback to first Admin profile if sender is unregistered
            if (!creatorProfile) {
                const { data: adminProfiles } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("role", "admin")
                    .limit(1);

                if (adminProfiles && adminProfiles.length > 0) {
                    creatorProfile = adminProfiles[0];
                }
            }

            if (!creatorProfile) {
                console.error("No admin profile found for fallback creation");
                return NextResponse.json({ error: "No fallback admin profile available" }, { status: 500 });
            }

            const formattedPhone = formatPhoneNumber(senderPhone);
            const displaySenderPhone = formattedPhone.startsWith("+") ? formattedPhone : `+${formattedPhone}`;

            // 3. Create ticket in database
            const cleanTitle = `[WA] ${aduanText.slice(0, 50)}${aduanText.length > 50 ? '...' : ''}`;
            const fullDescription = `Aduan via WhatsApp Group\nPelapor: ${reporterName}\nUnit: ${unitName}\nPengirim (WA): ${displaySenderPhone}\n\nDetail Masalah:\n${aduanText}`;

            // Auto-assign to least busy technician
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

            const { data: newTicket, error: insertErr } = await supabase
                .from("tickets")
                .insert({
                    title: cleanTitle,
                    description: fullDescription,
                    category: "hardware",
                    priority: "medium",
                    status: assigneeId ? "in_progress" : "open",
                    created_by: creatorProfile.id,
                    assigned_to: assigneeId
                })
                .select("id")
                .single();

            if (insertErr || !newTicket) {
                console.error("Failed to insert WA ticket:", insertErr);
                return NextResponse.json({ error: "Database error" }, { status: 500 });
            }

            const ticketIdShort = newTicket.id.slice(0, 8).toUpperCase();

            // 4. Send response message to WhatsApp Group
            const replyMessage = `🎫 *TIKET BERHASIL DIBUAT!*

🆔 *ID Tiket:* ${ticketIdShort}
👤 *Pelapor:* ${reporterName}
🏢 *Unit:* ${unitName}
📝 *Kendala:* ${aduanText}

Aduan Anda telah terdaftar di IT Helpdesk.${assigneeId ? "\n✅ Tiket sudah ditugaskan ke Teknisi IT." : ""}`;

            // Resolve LID group ID to valid Fonnte group ID
            const resolvedTarget = await resolveGroupTarget(sender, senderPhone);
            console.log("Sending WA reply to:", sender, "-> resolved:", resolvedTarget);
            console.log("Reply message:", replyMessage);

            const sendResult = await sendWhatsAppMessage({
                target: resolvedTarget,
                message: replyMessage
            });

            console.log("Fonnte send result:", JSON.stringify(sendResult));

            // 5. Send notification to assigned technician's private WhatsApp
            if (assigneeId) {
                try {
                    const { data: assignee } = await supabase
                        .from("profiles")
                        .select("full_name, whatsapp_phone")
                        .eq("id", assigneeId)
                        .single();

                    if (assignee?.whatsapp_phone) {
                        console.log("Sending assignment notification to technician WA:", assignee.whatsapp_phone);
                        const techMessage = `🎫 *TICKET BARU UNTUK ANDA (VIA WA GROUP)*

🆔 *ID Tiket:* ${ticketIdShort}
📋 *Judul:* ${cleanTitle}
👤 *Pelapor:* ${reporterName}
🏢 *Unit:* ${unitName}
📱 *Pengirim:* ${displaySenderPhone}

Anda telah di-assign otomatis ke tiket ini.
Silakan login ke IT Helpdesk untuk menindaklanjuti.`;

                        await sendWhatsAppMessage({
                            target: formatPhoneNumber(assignee.whatsapp_phone),
                            message: techMessage,
                        });
                    }
                } catch (techNotifyErr) {
                    console.error("Error sending notification to technician:", techNotifyErr);
                }
            }

            return NextResponse.json({ status: "group_ticket_created", ticketId: newTicket.id, sendResult });
        }

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
                .select("id, full_name, is_active")
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
                .select("id, full_name, whatsapp_phone, is_active")
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

        // Check if user is active
        if (profile.is_active === false) {
            await sendWhatsAppMessage({
                target: normalizedPhone,
                message: `❌ Akun Anda tidak aktif.

Silakan hubungi Admin IT untuk mengaktifkan kembali akun Anda.`,
            });
            return NextResponse.json({ status: "inactive_user" });
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

        // PINJAM command - Asset Borrowing
        if (lowerMessage === "3" || lowerMessage === "pinjam" || lowerMessage === "/pinjam") {
            conversationState.set(normalizedPhone, {
                step: "borrowing_search",
                data: {},
                timestamp: Date.now(),
            });
            await sendWhatsAppMessage({
                target: normalizedPhone,
                message: `📦 *Pinjam Asset*

Ketik nama/jenis asset yang ingin Anda pinjam.
Contoh: laptop, printer, proyektor

Ketik *batal* untuk batalkan.`,
            });
            return NextResponse.json({ status: "borrowing_search_prompt" });
        }

        if (lowerMessage === "4" || lowerMessage === "help" || lowerMessage === "/help") {
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
    state: {
        step: string;
        data: {
            category?: string;
            priority?: string;
            description?: string;
            borrowing_search?: string;
            borrowing_assets?: { id: string; name: string; asset_code: string; location: string }[];
            selected_asset_id?: string;
            borrowing_locations?: { id: string; name: string }[];
            selected_location_id?: string;
        };
        timestamp: number
    }
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

    // Borrowing Step 1: Search for assets
    if (step === "borrowing_search") {
        data.borrowing_search = message;

        // Get assets with active borrowings
        const { data: activeBorrowings } = await supabase
            .from("asset_borrowings")
            .select("asset_id")
            .in("status", ["pending", "approved", "borrowed"]);

        const borrowedAssetIds = activeBorrowings?.map(b => b.asset_id) || [];

        // Search for borrowable assets matching the keyword, excluding borrowed ones
        let assetQuery = supabase
            .from("assets")
            .select("id, name, asset_code, locations(name)")
            .eq("is_borrowable", true)
            .eq("status", "active")
            .ilike("name", `%${message}%`)
            .limit(5);

        if (borrowedAssetIds.length > 0) {
            assetQuery = assetQuery.not("id", "in", `(${borrowedAssetIds.join(",")})`);
        }

        const { data: assets } = await assetQuery;

        if (!assets || assets.length === 0) {
            await sendWhatsAppMessage({
                target: phone,
                message: `❌ Asset "${message}" tidak ditemukan atau tidak tersedia untuk dipinjam.

Coba kata kunci lain atau ketik *batal* untuk kembali.`,
            });
            return NextResponse.json({ status: "no_assets_found" });
        }

        // Store assets in state
        data.borrowing_assets = assets.map(a => ({
            id: a.id,
            name: a.name,
            asset_code: a.asset_code,
            location: (a.locations as unknown as { name: string })?.name || "-"
        }));

        conversationState.set(phone, { step: "borrowing_select", data, timestamp: Date.now() });

        const assetList = assets
            .map((a, i) => {
                const loc = (a.locations as unknown as { name: string })?.name || "-";
                return `*${i + 1}.* ${a.name}\n    📍 ${loc} | 📋 ${a.asset_code}`;
            })
            .join("\n\n");

        await sendWhatsAppMessage({
            target: phone,
            message: `📦 *Asset Tersedia:*

${assetList}

Ketik angka (1-${assets.length}) untuk memilih asset.`,
        });

        return NextResponse.json({ status: "borrowing_assets_listed" });
    }

    // Borrowing Step 2: Select asset, then ask for purpose
    if (step === "borrowing_select") {
        const index = parseInt(message) - 1;
        const assets = data.borrowing_assets || [];

        if (index < 0 || index >= assets.length) {
            await sendWhatsAppMessage({
                target: phone,
                message: `❌ Pilihan tidak valid. Ketik angka 1-${assets.length}.`,
            });
            return NextResponse.json({ status: "invalid_asset_selection" });
        }

        const selectedAsset = assets[index];
        data.selected_asset_id = selectedAsset.id;
        conversationState.set(phone, { step: "borrowing_confirm", data, timestamp: Date.now() });

        await sendWhatsAppMessage({
            target: phone,
            message: `✅ Asset dipilih: *${selectedAsset.name}*

📍 Lokasi saat ini: ${selectedAsset.location}

📝 *Ketik tujuan/alasan peminjaman:*`,
        });

        return NextResponse.json({ status: "borrowing_purpose_prompt" });
    }

    // Borrowing Step 3: Enter purpose and create request
    if (step === "borrowing_confirm") {
        const purpose = message.trim();

        if (!purpose) {
            await sendWhatsAppMessage({
                target: phone,
                message: `❌ Tujuan peminjaman tidak boleh kosong.

Ketik tujuan/alasan peminjaman:`,
            });
            return NextResponse.json({ status: "empty_purpose" });
        }

        const assetId = data.selected_asset_id;
        const selectedAsset = data.borrowing_assets?.find(a => a.id === assetId);

        // Get asset's original location
        const { data: asset } = await supabase
            .from("assets")
            .select("location_id, is_borrowable")
            .eq("id", assetId)
            .single();

        if (!asset || !asset.is_borrowable) {
            conversationState.delete(phone);
            await sendWhatsAppMessage({
                target: phone,
                message: `❌ Asset tidak tersedia untuk dipinjam.

Ketik *3* untuk cari asset lain.`,
            });
            return NextResponse.json({ status: "asset_unavailable" });
        }

        // Create borrowing request (no location needed)
        const { data: borrowing, error } = await supabase
            .from("asset_borrowings")
            .insert({
                asset_id: assetId,
                borrower_user_id: profile.id,
                original_location_id: asset.location_id,
                borrow_date: new Date().toISOString(),
                purpose: purpose,
                status: "pending",
                created_by: profile.id,
            })
            .select("id")
            .single();

        conversationState.delete(phone);

        if (error || !borrowing) {
            await sendWhatsAppMessage({
                target: phone,
                message: `❌ Gagal membuat request peminjaman.

Silakan coba lagi atau hubungi Admin IT.`,
            });
            return NextResponse.json({ status: "borrowing_error", error: error?.message });
        }

        await sendWhatsAppMessage({
            target: phone,
            message: `✅ *REQUEST PEMINJAMAN BERHASIL!*

📦 *Asset:* ${selectedAsset?.name}
👤 *Peminjam:* ${profile.full_name}
📝 *Tujuan:* ${purpose}

⏳ Menunggu approval dari Admin IT.
Anda akan diberitahu via WhatsApp setelah disetujui.`,
        });

        // Notify admin/staff_it about new borrowing request
        const { data: admins } = await supabase
            .from("profiles")
            .select("id, full_name, whatsapp_phone")
            .in("role", ["admin", "staff_it"]);

        if (admins && admins.length > 0) {
            for (const admin of admins) {
                if (admin.whatsapp_phone) {
                    await sendWhatsAppMessage({
                        target: formatPhoneNumber(admin.whatsapp_phone),
                        message: `📦 *REQUEST PEMINJAMAN BARU*

👤 *Peminjam:* ${profile.full_name}
📦 *Asset:* ${selectedAsset?.name}
📝 *Tujuan:* ${purpose}

Silakan login ke IT Helpdesk untuk approve/reject.`,
                    });
                }
            }
        }

        return NextResponse.json({ status: "borrowing_created", borrowingId: borrowing.id });
    }

    return NextResponse.json({ status: "unknown_step" });
}

// Fonnte sends GET for verification
export async function GET() {
    return NextResponse.json({ status: "Webhook active" });
}
