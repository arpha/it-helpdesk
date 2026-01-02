"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type StockOpnameSession = {
    id: string;
    session_code: string;
    status: "draft" | "in_progress" | "completed" | "cancelled";
    notes: string | null;
    created_by: string | null;
    completed_by: string | null;
    completed_at: string | null;
    created_at: string;
    profiles: {
        full_name: string | null;
    } | null;
    item_count?: number;
    counted_count?: number;
};

export type StockOpnameItem = {
    id: string;
    session_id: string;
    item_id: string;
    system_quantity: number;
    physical_quantity: number | null;
    difference: number;
    notes: string | null;
    counted_by: string | null;
    counted_at: string | null;
    atk_items: {
        name: string;
        unit: string;
        stock_quantity: number;
    } | null;
};

type ActionResult = {
    success: boolean;
    error?: string;
    id?: string;
};

// Generate session code
async function generateSessionCode(): Promise<string> {
    const supabase = createAdminClient();
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;

    const { data } = await supabase
        .from("stock_opname_sessions")
        .select("session_code")
        .like("session_code", `${prefix}%`)
        .order("session_code", { ascending: false })
        .limit(1);

    let nextNumber = 1;
    if (data && data.length > 0) {
        const lastCode = data[0].session_code;
        const lastNumber = parseInt(lastCode.replace(prefix, ""), 10);
        nextNumber = lastNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

// Get all sessions
export async function getStockOpnameSessions(): Promise<StockOpnameSession[]> {
    const supabase = createAdminClient();

    const { data } = await supabase
        .from("stock_opname_sessions")
        .select(`
            *,
            profiles:created_by(full_name)
        `)
        .order("created_at", { ascending: false });

    // Get item counts
    const sessions = data || [];
    for (const session of sessions) {
        const { count: itemCount } = await supabase
            .from("stock_opname_items")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id);

        const { count: countedCount } = await supabase
            .from("stock_opname_items")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id)
            .not("physical_quantity", "is", null);

        (session as StockOpnameSession).item_count = itemCount || 0;
        (session as StockOpnameSession).counted_count = countedCount || 0;
    }

    return sessions as StockOpnameSession[];
}

// Get session items
export async function getStockOpnameItems(sessionId: string): Promise<StockOpnameItem[]> {
    const supabase = createAdminClient();

    const { data } = await supabase
        .from("stock_opname_items")
        .select(`
            *,
            atk_items(name, unit, stock_quantity)
        `)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

    return (data as StockOpnameItem[]) || [];
}

// Create new session
export async function createStockOpnameSession(notes?: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const sessionCode = await generateSessionCode();

        // Create session
        const { data: session, error: sessionError } = await supabase
            .from("stock_opname_sessions")
            .insert({
                session_code: sessionCode,
                status: "draft",
                notes,
                created_by: user.id,
            })
            .select("id")
            .single();

        if (sessionError) {
            return { success: false, error: sessionError.message };
        }

        // Get all ATK items and add to session
        const { data: items } = await supabase
            .from("atk_items")
            .select("id, stock_quantity");

        if (items && items.length > 0) {
            const opnameItems = items.map(item => ({
                session_id: session.id,
                item_id: item.id,
                system_quantity: item.stock_quantity || 0,
            }));

            await supabase.from("stock_opname_items").insert(opnameItems);
        }

        revalidatePath("/atk/stock-opname");
        return { success: true, id: session.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Update item count
export async function updateOpnameItemCount(
    itemId: string,
    physicalQuantity: number,
    notes?: string
): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const { error } = await supabase
            .from("stock_opname_items")
            .update({
                physical_quantity: physicalQuantity,
                notes,
                counted_by: user.id,
                counted_at: new Date().toISOString(),
            })
            .eq("id", itemId);

        if (error) {
            return { success: false, error: error.message };
        }

        // Update session status to in_progress if draft
        const { data: item } = await supabase
            .from("stock_opname_items")
            .select("session_id")
            .eq("id", itemId)
            .single();

        if (item) {
            await supabase
                .from("stock_opname_sessions")
                .update({ status: "in_progress" })
                .eq("id", item.session_id)
                .eq("status", "draft");
        }

        revalidatePath("/atk/stock-opname");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Complete session and adjust stock
export async function completeStockOpname(sessionId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        // Get all items with differences
        const { data: items } = await supabase
            .from("stock_opname_items")
            .select("item_id, physical_quantity, difference")
            .eq("session_id", sessionId)
            .not("physical_quantity", "is", null);

        if (!items || items.length === 0) {
            return { success: false, error: "No items have been counted" };
        }

        // Adjust stock for items with differences
        for (const item of items) {
            if (item.difference !== 0 && item.physical_quantity !== null) {
                await supabase
                    .from("atk_items")
                    .update({ stock_quantity: item.physical_quantity })
                    .eq("id", item.item_id);
            }
        }

        // Mark session as completed
        const { error } = await supabase
            .from("stock_opname_sessions")
            .update({
                status: "completed",
                completed_by: user.id,
                completed_at: new Date().toISOString(),
            })
            .eq("id", sessionId);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/atk/stock-opname");
        revalidatePath("/atk/items");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Cancel session
export async function cancelStockOpname(sessionId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("stock_opname_sessions")
            .update({ status: "cancelled" })
            .eq("id", sessionId);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/atk/stock-opname");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Delete session
export async function deleteStockOpname(sessionId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("stock_opname_sessions")
            .delete()
            .eq("id", sessionId);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/atk/stock-opname");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
