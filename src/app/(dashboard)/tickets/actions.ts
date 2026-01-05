"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CreateTicketInput = {
    title: string;
    description?: string;
    category: string;
    priority: string;
    location_id?: string;
    asset_id?: string;
    requester_id?: string; // ID pelapor (jika admin buat untuk orang lain)
};

type UpdateTicketInput = {
    id: string;
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    status?: string;
    assigned_to?: string;
    asset_id?: string;
};

type CompleteTicketInput = {
    id: string;
    resolution_notes?: string;
    repair_type?: string;
    asset_id?: string;
    parts?: { item_id: string; quantity: number }[];
};

type ActionResult = {
    success: boolean;
    error?: string;
    id?: string;
};

// Get least busy technician (staff_it or admin with fewest active tickets)
async function getLeastBusyTechnician(): Promise<string | null> {
    const supabase = createAdminClient();

    // Get all active technicians (staff_it and admin)
    const { data: technicians } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["staff_it", "admin"])
        .neq("is_active", false);

    if (!technicians || technicians.length === 0) {
        return null;
    }

    // Count active tickets per technician
    const { data: ticketCounts } = await supabase
        .from("tickets")
        .select("assigned_to")
        .in("status", ["open", "in_progress"])
        .not("assigned_to", "is", null);

    // Create count map
    const countMap = new Map<string, number>();
    technicians.forEach(t => countMap.set(t.id, 0));
    ticketCounts?.forEach(t => {
        if (t.assigned_to && countMap.has(t.assigned_to)) {
            countMap.set(t.assigned_to, (countMap.get(t.assigned_to) || 0) + 1);
        }
    });

    // Find technician with least tickets
    let minCount = Infinity;
    let leastBusyId: string | null = null;

    for (const [id, count] of countMap) {
        if (count < minCount) {
            minCount = count;
            leastBusyId = id;
        }
    }

    return leastBusyId;
}

export async function createTicket(input: CreateTicketInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        // Get user's location
        const { data: profile } = await supabase
            .from("profiles")
            .select("location_id")
            .eq("id", user.id)
            .single();

        // Get least busy technician for auto-assign
        const assigneeId = await getLeastBusyTechnician();

        // Get requester's profile for location fallback
        const requesterId = input.requester_id || null;
        const requesterIdForLocation = requesterId || user.id;

        const { data: requesterProfile } = await supabase
            .from("profiles")
            .select("location_id, full_name")
            .eq("id", requesterIdForLocation)
            .single();

        const { data, error } = await supabase
            .from("tickets")
            .insert({
                title: input.title,
                description: input.description,
                category: input.category,
                priority: input.priority,
                status: assigneeId ? "in_progress" : "open",
                created_by: user.id, // Siapa yang input
                requester_id: requesterId, // Siapa pelapor (null jika sama dengan created_by)
                assigned_to: assigneeId,
                location_id: input.location_id || requesterProfile?.location_id || profile?.location_id,
                asset_id: input.asset_id || null,
            })
            .select("id, title, category, priority")
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        // Send WhatsApp notification to assigned technician
        if (assigneeId && data) {
            const { data: assignee } = await supabase
                .from("profiles")
                .select("full_name, whatsapp_phone")
                .eq("id", assigneeId)
                .single();

            const { data: creator } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", user.id)
                .single();

            if (assignee?.whatsapp_phone) {
                const { sendWhatsAppMessage, formatPhoneNumber } = await import("@/lib/fonnte/client");

                await sendWhatsAppMessage({
                    target: formatPhoneNumber(assignee.whatsapp_phone),
                    message: `🎫 *TICKET BARU UNTUK ANDA*

📋 *Judul:* ${data.title}
📂 *Kategori:* ${data.category}
⚡ *Prioritas:* ${data.priority?.toUpperCase()}
👤 *Pelapor:* ${creator?.full_name || "User"}

Anda telah di-assign otomatis ke tiket ini.
Silakan login ke IT Helpdesk untuk detail lebih lanjut.`,
                });
            }
        }

        revalidatePath("/tickets");
        return { success: true, id: data.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function updateTicket(input: UpdateTicketInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const updateData: Record<string, unknown> = {};
        if (input.title) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.category) updateData.category = input.category;
        if (input.priority) updateData.priority = input.priority;
        if (input.status) updateData.status = input.status;
        if (input.assigned_to) updateData.assigned_to = input.assigned_to;
        if (input.asset_id !== undefined) updateData.asset_id = input.asset_id || null;

        const { error } = await supabase
            .from("tickets")
            .update(updateData)
            .eq("id", input.id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/tickets");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function assignTicket(ticketId: string, assigneeId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // Get ticket details with location
        const { data: ticket } = await supabase
            .from("tickets")
            .select("title, category, priority, created_by, profiles:created_by(full_name), locations:location_id(name)")
            .eq("id", ticketId)
            .single();

        const { error } = await supabase
            .from("tickets")
            .update({
                assigned_to: assigneeId,
                status: "in_progress",
            })
            .eq("id", ticketId);

        if (error) {
            return { success: false, error: error.message };
        }

        // Send WhatsApp notification to assigned technician
        const { data: assignee } = await supabase
            .from("profiles")
            .select("full_name, whatsapp_phone")
            .eq("id", assigneeId)
            .single();

        if (assignee?.whatsapp_phone && ticket) {
            const { sendWhatsAppMessage, formatPhoneNumber } = await import("@/lib/fonnte/client");
            const creatorName = Array.isArray(ticket.profiles)
                ? ticket.profiles[0]?.full_name
                : (ticket.profiles as { full_name: string } | null)?.full_name || "User";
            const deptName = Array.isArray(ticket.locations)
                ? ticket.locations[0]?.name
                : (ticket.locations as { name: string } | null)?.name || "-";

            await sendWhatsAppMessage({
                target: formatPhoneNumber(assignee.whatsapp_phone),
                message: `🎫 *TICKET BARU UNTUK ANDA*

📋 *Judul:* ${ticket.title}
📂 *Kategori:* ${ticket.category}
⚡ *Prioritas:* ${ticket.priority?.toUpperCase()}
👤 *Pelapor:* ${creatorName}
🏢 *Departemen:* ${deptName}

Silakan login ke IT Helpdesk untuk detail lebih lanjut.`,
            });
        }

        revalidatePath("/tickets");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function reassignTicket(ticketId: string, newAssigneeId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // Get ticket details with current assignee
        const { data: ticket } = await supabase
            .from("tickets")
            .select("title, category, priority, assigned_to, created_by, profiles:created_by(full_name)")
            .eq("id", ticketId)
            .single();

        if (!ticket) {
            return { success: false, error: "Ticket not found" };
        }

        const previousAssigneeId = ticket.assigned_to;

        // Update ticket with new assignee
        const { error } = await supabase
            .from("tickets")
            .update({ assigned_to: newAssigneeId })
            .eq("id", ticketId);

        if (error) {
            return { success: false, error: error.message };
        }

        const { sendWhatsAppMessage, formatPhoneNumber } = await import("@/lib/fonnte/client");
        const creatorName = Array.isArray(ticket.profiles)
            ? ticket.profiles[0]?.full_name
            : (ticket.profiles as { full_name: string } | null)?.full_name || "User";

        // Notify previous technician
        if (previousAssigneeId) {
            const { data: prevAssignee } = await supabase
                .from("profiles")
                .select("full_name, whatsapp_phone")
                .eq("id", previousAssigneeId)
                .single();

            if (prevAssignee?.whatsapp_phone) {
                await sendWhatsAppMessage({
                    target: formatPhoneNumber(prevAssignee.whatsapp_phone),
                    message: `🔄 *TICKET DIALIHKAN*

📋 *Judul:* ${ticket.title}
📂 *Kategori:* ${ticket.category}

Ticket ini telah dialihkan ke teknisi lain.
Terima kasih atas kerjasamanya.`,
                });
            }
        }

        // Notify new technician
        const { data: newAssignee } = await supabase
            .from("profiles")
            .select("full_name, whatsapp_phone")
            .eq("id", newAssigneeId)
            .single();

        if (newAssignee?.whatsapp_phone) {
            await sendWhatsAppMessage({
                target: formatPhoneNumber(newAssignee.whatsapp_phone),
                message: `🔄 *TICKET DIALIHKAN KEPADA ANDA*

📋 *Judul:* ${ticket.title}
📂 *Kategori:* ${ticket.category}
⚡ *Prioritas:* ${ticket.priority?.toUpperCase()}
👤 *Pelapor:* ${creatorName}

Ticket ini dialihkan dari teknisi lain kepada Anda.
Silakan login ke IT Helpdesk untuk detail lebih lanjut.`,
            });
        }

        revalidatePath("/tickets");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function completeTicket(input: CompleteTicketInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        // Get ticket details
        const { data: ticket, error: ticketError } = await supabase
            .from("tickets")
            .select("asset_id, location_id, created_by")
            .eq("id", input.id)
            .single();

        if (ticketError) {
            return { success: false, error: ticketError.message };
        }

        // 1. Update ticket status to resolved
        const { error: updateError } = await supabase
            .from("tickets")
            .update({
                status: "resolved",
                resolution_notes: input.resolution_notes,
                resolved_at: new Date().toISOString(),
                resolved_by: user.id,
            })
            .eq("id", input.id);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        // 2. If parts were used, create ATK request with status approved
        if (input.parts && input.parts.length > 0) {
            // Insert ticket parts for record
            const ticketParts = input.parts.map(p => ({
                ticket_id: input.id,
                item_id: p.item_id,
                quantity: p.quantity,
            }));

            await supabase.from("ticket_parts").insert(ticketParts);

            // Get location from asset (either from ticket or from form input)
            const assetIdForLocation = ticket?.asset_id || input.asset_id;
            let assetLocationId: string | null = null;

            if (assetIdForLocation) {
                const { data: asset } = await supabase
                    .from("assets")
                    .select("location_id")
                    .eq("id", assetIdForLocation)
                    .single();
                assetLocationId = asset?.location_id || null;
            }

            // Create ATK request with approved status (auto-approve from ticket)
            const { data: atkRequest, error: atkError } = await supabase
                .from("atk_requests")
                .insert({
                    requester_id: ticket?.created_by || user.id,
                    ticket_id: input.id,
                    location_id: assetLocationId,
                    notes: `From Ticket - Auto generated`,
                    status: "approved",
                    approved_by: user.id,
                    approved_at: new Date().toISOString(),
                })
                .select("id")
                .single();

            if (atkError) {
                console.error("Failed to create ATK request:", atkError);
            }

            // Create ATK request items with approved quantity = requested quantity
            if (atkRequest) {
                const requestItems = input.parts.map(p => ({
                    request_id: atkRequest.id,
                    item_id: p.item_id,
                    quantity: p.quantity,
                    approved_quantity: p.quantity,
                }));

                await supabase.from("atk_request_items").insert(requestItems);
            }
        }

        // 3. If asset is linked (from ticket or form), create maintenance record
        const assetId = ticket?.asset_id || input.asset_id;
        if (assetId) {
            // Update ticket with asset_id if provided from form
            if (input.asset_id && !ticket?.asset_id) {
                await supabase
                    .from("tickets")
                    .update({ asset_id: input.asset_id })
                    .eq("id", input.id);
            }

            // Calculate total cost from parts
            let totalCost = 0;
            let partsDescription = "";

            if (input.parts && input.parts.length > 0) {
                // Get item prices
                const itemIds = input.parts.map(p => p.item_id);
                const { data: items } = await supabase
                    .from("atk_items")
                    .select("id, name, price")
                    .in("id", itemIds);

                const itemPriceMap = new Map(items?.map(i => [i.id, { price: i.price || 0, name: i.name }]) || []);

                const partDetails: string[] = [];
                input.parts.forEach(p => {
                    const item = itemPriceMap.get(p.item_id);
                    if (item) {
                        const partCost = item.price * p.quantity;
                        totalCost += partCost;
                        partDetails.push(`${item.name} x${p.quantity} = Rp${partCost.toLocaleString()}`);
                    }
                });
                partsDescription = `Parts used:\n${partDetails.join("\n")}`;
            }

            await supabase.from("asset_maintenance").insert({
                asset_id: assetId,
                type: input.repair_type || "repair",
                description: `Ticket resolution: ${input.resolution_notes || "Completed"}`,
                notes: partsDescription,
                performed_by: user.id,
                performed_at: new Date().toISOString(),
                cost: totalCost,
            });
        }

        revalidatePath("/tickets");
        revalidatePath("/atk/items");
        revalidatePath("/assets/maintenance");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function deleteTicket(id: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("tickets")
            .delete()
            .eq("id", id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/tickets");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
