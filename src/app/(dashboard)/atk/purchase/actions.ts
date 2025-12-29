"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CreatePurchaseInput = {
    title: string;
    notes?: string;
    items: { item_id: string; quantity: number; unit_price: number }[];
};

type UpdatePurchaseInput = {
    purchase_id: string;
    title: string;
    notes?: string;
    items: { item_id: string; quantity: number; unit_price: number }[];
};

type SuccessPurchaseInput = {
    purchase_id: string;
    received_items: { item_id: string; received_quantity: number }[]; // actual quantities received
};

type ActionResult = {
    success: boolean;
    error?: string;
    id?: string;
};

async function uploadPhoto(photoData: string, purchaseId: string): Promise<string | null> {
    try {
        const supabase = createAdminClient();
        const base64Data = photoData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        const fileName = `purchase_${purchaseId}_${Date.now()}.jpg`;
        const filePath = `purchase_photos/${fileName}`;

        const { error } = await supabase.storage
            .from("images")
            .upload(filePath, buffer, {
                contentType: "image/jpeg",
                upsert: true,
            });

        if (error) return null;

        const { data: urlData } = supabase.storage.from("images").getPublicUrl(filePath);
        return urlData.publicUrl;
    } catch {
        return null;
    }
}

export async function createPurchaseRequest(input: CreatePurchaseInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const totalAmount = input.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

        const { data: purchase, error: purchaseError } = await supabase
            .from("atk_purchase_requests")
            .insert({
                title: input.title,
                notes: input.notes || null,
                total_amount: totalAmount,
                status: "draft",
                created_by: user.id,
            })
            .select("id")
            .single();

        if (purchaseError) {
            return { success: false, error: purchaseError.message };
        }

        const purchaseItems = input.items.map((item) => ({
            purchase_id: purchase.id,
            item_id: item.item_id,
            quantity: item.quantity,
            price: item.unit_price,
            subtotal: item.quantity * item.unit_price,
        }));

        const { error: itemsError } = await supabase
            .from("atk_purchase_items")
            .insert(purchaseItems);

        if (itemsError) {
            return { success: false, error: itemsError.message };
        }

        revalidatePath("/atk/purchase");
        return { success: true, id: purchase.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function updatePurchaseRequest(input: UpdatePurchaseInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // Check if still draft
        const { data: existing } = await supabase
            .from("atk_purchase_requests")
            .select("status")
            .eq("id", input.purchase_id)
            .single();

        if (existing?.status !== "draft") {
            return { success: false, error: "Only draft requests can be edited" };
        }

        const totalAmount = input.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

        const { error: updateError } = await supabase
            .from("atk_purchase_requests")
            .update({
                title: input.title,
                notes: input.notes || null,
                total_amount: totalAmount,
            })
            .eq("id", input.purchase_id);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        // Delete old items and insert new ones
        await supabase
            .from("atk_purchase_items")
            .delete()
            .eq("purchase_id", input.purchase_id);

        const purchaseItems = input.items.map((item) => ({
            purchase_id: input.purchase_id,
            item_id: item.item_id,
            quantity: item.quantity,
            price: item.unit_price,
            subtotal: item.quantity * item.unit_price,
        }));

        const { error: itemsError } = await supabase
            .from("atk_purchase_items")
            .insert(purchaseItems);

        if (itemsError) {
            return { success: false, error: itemsError.message };
        }

        revalidatePath("/atk/purchase");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Submit: draft -> process
export async function submitPurchaseRequest(purchaseId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("atk_purchase_requests")
            .update({ status: "process" })
            .eq("id", purchaseId);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/atk/purchase");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Mark as success: process -> success (adds stock based on received quantities)
export async function markPurchaseSuccess(input: SuccessPurchaseInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        if (!input.received_items || input.received_items.length === 0) {
            return { success: false, error: "No items to verify" };
        }

        // Add stock for each received item
        for (const item of input.received_items) {
            if (item.received_quantity <= 0) continue;

            // Get current stock
            const { data: atkItem } = await supabase
                .from("atk_items")
                .select("stock_quantity")
                .eq("id", item.item_id)
                .single();

            if (atkItem) {
                // Update stock (ADD received quantity)
                await supabase
                    .from("atk_items")
                    .update({
                        stock_quantity: atkItem.stock_quantity + item.received_quantity,
                    })
                    .eq("id", item.item_id);

                // Create stock history
                await supabase.from("atk_stock_history").insert({
                    item_id: item.item_id,
                    type: "in",
                    quantity: item.received_quantity,
                    reference_id: input.purchase_id,
                    notes: "Purchase request fulfilled - verified receipt",
                    created_by: user.id,
                });
            }
        }

        // Update request status
        const { error } = await supabase
            .from("atk_purchase_requests")
            .update({
                status: "success",
                approved_by: user.id,
                approved_at: new Date().toISOString(),
            })
            .eq("id", input.purchase_id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/atk/purchase");
        revalidatePath("/atk/items");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function deletePurchaseRequest(purchaseId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // Only allow deleting draft
        const { data: existing } = await supabase
            .from("atk_purchase_requests")
            .select("status")
            .eq("id", purchaseId)
            .single();

        if (existing?.status !== "draft") {
            return { success: false, error: "Only draft requests can be deleted" };
        }

        const { error } = await supabase
            .from("atk_purchase_requests")
            .delete()
            .eq("id", purchaseId);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/atk/purchase");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
