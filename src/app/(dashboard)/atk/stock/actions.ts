"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type StockInput = {
    item_id: string;
    quantity: number;
    notes?: string;
};

type ActionResult = {
    success: boolean;
    error?: string;
};

export async function stockIn(input: StockInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        // Insert stock history
        const { error: historyError } = await supabase.from("atk_stock_history").insert({
            item_id: input.item_id,
            type: "in",
            quantity: input.quantity,
            notes: input.notes || null,
            created_by: user.id,
        });

        if (historyError) {
            return { success: false, error: historyError.message };
        }

        // Update item stock
        const { data: item } = await supabase
            .from("atk_items")
            .select("stock_quantity")
            .eq("id", input.item_id)
            .single();

        if (item) {
            await supabase
                .from("atk_items")
                .update({ stock_quantity: item.stock_quantity + input.quantity })
                .eq("id", input.item_id);
        }

        revalidatePath("/atk/items");
        revalidatePath("/atk/stock-in");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function stockOut(input: StockInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        // Check current stock
        const { data: item } = await supabase
            .from("atk_items")
            .select("stock_quantity")
            .eq("id", input.item_id)
            .single();

        if (!item || item.stock_quantity < input.quantity) {
            return { success: false, error: "Insufficient stock" };
        }

        // Insert stock history
        const { error: historyError } = await supabase.from("atk_stock_history").insert({
            item_id: input.item_id,
            type: "out",
            quantity: input.quantity,
            notes: input.notes || null,
            created_by: user.id,
        });

        if (historyError) {
            return { success: false, error: historyError.message };
        }

        // Update item stock
        await supabase
            .from("atk_items")
            .update({ stock_quantity: item.stock_quantity - input.quantity })
            .eq("id", input.item_id);

        revalidatePath("/atk/items");
        revalidatePath("/atk/stock-out");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
