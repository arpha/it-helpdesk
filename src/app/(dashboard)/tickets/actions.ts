"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CreateTicketInput = {
    title: string;
    description?: string;
    category: string;
    priority: string;
    department_id?: string;
    asset_id?: string;
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

export async function createTicket(input: CreateTicketInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        // Get user's department
        const { data: profile } = await supabase
            .from("profiles")
            .select("department_id")
            .eq("id", user.id)
            .single();

        const { data, error } = await supabase
            .from("tickets")
            .insert({
                title: input.title,
                description: input.description,
                category: input.category,
                priority: input.priority,
                status: "open",
                created_by: user.id,
                department_id: input.department_id || profile?.department_id,
                asset_id: input.asset_id || null,
            })
            .select("id")
            .single();

        if (error) {
            return { success: false, error: error.message };
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
            .select("asset_id")
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

        // 2. If parts were used, add to ticket_parts and reduce stock
        if (input.parts && input.parts.length > 0) {
            // Insert ticket parts
            const ticketParts = input.parts.map(p => ({
                ticket_id: input.id,
                item_id: p.item_id,
                quantity: p.quantity,
            }));

            await supabase.from("ticket_parts").insert(ticketParts);

            // Reduce ATK stock for each part
            for (const part of input.parts) {
                // Get current stock
                const { data: item } = await supabase
                    .from("atk_items")
                    .select("stock_quantity")
                    .eq("id", part.item_id)
                    .single();

                if (item) {
                    const newStock = Math.max(0, item.stock_quantity - part.quantity);
                    await supabase
                        .from("atk_items")
                        .update({ stock_quantity: newStock })
                        .eq("id", part.item_id);
                }
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

            const partsDescription = input.parts?.length
                ? `Parts used: ${input.parts.map(p => `${p.quantity}x`).join(", ")}`
                : "";

            await supabase.from("asset_maintenance").insert({
                asset_id: assetId,
                type: input.repair_type || "repair",
                description: `Ticket resolution: ${input.resolution_notes || "Completed"}`,
                notes: partsDescription,
                performed_by: user.id,
                performed_at: new Date().toISOString(),
                cost: 0,
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
