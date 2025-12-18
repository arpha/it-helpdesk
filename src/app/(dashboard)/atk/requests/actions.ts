"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendWhatsAppMessage, formatPhoneNumber } from "@/lib/fonnte/client";

type CreateRequestInput = {
    notes?: string;
    items: { item_id: string; quantity: number }[];
};

type ApproveRequestInput = {
    request_id: string;
    approved_quantities: { item_id: string; quantity: number }[];
};

type CompleteRequestInput = {
    request_id: string;
    signature_data: string; // base64 data URL
};

type ActionResult = {
    success: boolean;
    error?: string;
    id?: string;
};

// Upload signature to storage
async function uploadSignature(signatureData: string, requestId: string): Promise<string | null> {
    try {
        const supabase = createAdminClient();

        // Convert base64 to blob
        const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        const fileName = `${requestId}_${Date.now()}.png`;
        const filePath = `signatures/${fileName}`;

        const { error } = await supabase.storage
            .from("images")
            .upload(filePath, buffer, {
                contentType: "image/png",
                upsert: true,
            });

        if (error) {
            console.error("Upload signature error:", error);
            return null;
        }

        const { data: urlData } = supabase.storage
            .from("images")
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    } catch (error) {
        console.error("Upload signature failed:", error);
        return null;
    }
}

export async function createRequest(input: CreateRequestInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        // Get user profile for department
        const { data: profile } = await supabase
            .from("profiles")
            .select("department_id")
            .eq("id", user.id)
            .single();

        // Create request
        const { data: request, error: requestError } = await supabase
            .from("atk_requests")
            .insert({
                requester_id: user.id,
                department_id: profile?.department_id || null,
                notes: input.notes || null,
                status: "pending",
            })
            .select("id")
            .single();

        if (requestError) {
            return { success: false, error: requestError.message };
        }

        // Insert request items
        const requestItems = input.items.map((item) => ({
            request_id: request.id,
            item_id: item.item_id,
            quantity: item.quantity,
        }));

        const { error: itemsError } = await supabase
            .from("atk_request_items")
            .insert(requestItems);

        if (itemsError) {
            return { success: false, error: itemsError.message };
        }

        revalidatePath("/atk/requests");
        return { success: true, id: request.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function approveRequest(input: ApproveRequestInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        // Update request status (no signature on approve)
        const { error: updateError } = await supabase
            .from("atk_requests")
            .update({
                status: "approved",
                approved_by: user.id,
                approved_at: new Date().toISOString(),
            })
            .eq("id", input.request_id);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        // Update approved quantities for each item
        for (const item of input.approved_quantities) {
            await supabase
                .from("atk_request_items")
                .update({ approved_quantity: item.quantity })
                .eq("request_id", input.request_id)
                .eq("item_id", item.item_id);
        }

        // Send WhatsApp notification to requester
        try {
            const { data: requesterProfile } = await supabase
                .from("profiles")
                .select("full_name, whatsapp_phone")
                .eq("id", (await supabase.from("atk_requests").select("requester_id").eq("id", input.request_id).single()).data?.requester_id)
                .single();

            if (requesterProfile?.whatsapp_phone) {
                await sendWhatsAppMessage({
                    target: formatPhoneNumber(requesterProfile.whatsapp_phone),
                    message: `🎉 *Request ATK Disetujui!*\n\nHalo ${requesterProfile.full_name},\n\nRequest ATK Anda telah disetujui.\nSilakan ambil di Gudang IT.\n\nTerima kasih! 🙏`,
                });
            }
        } catch (notifError) {
            console.error("WhatsApp notification error:", notifError);
        }

        revalidatePath("/atk/requests");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function rejectRequest(requestId: string, reason?: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const { error } = await supabase
            .from("atk_requests")
            .update({
                status: "rejected",
                approved_by: user.id,
                approved_at: new Date().toISOString(),
                notes: reason || null,
            })
            .eq("id", requestId);

        if (error) {
            return { success: false, error: error.message };
        }

        // Send WhatsApp notification to requester
        try {
            const { data: request } = await supabase
                .from("atk_requests")
                .select("requester_id")
                .eq("id", requestId)
                .single();

            if (request?.requester_id) {
                const { data: requesterProfile } = await supabase
                    .from("profiles")
                    .select("full_name, whatsapp_phone")
                    .eq("id", request.requester_id)
                    .single();

                if (requesterProfile?.whatsapp_phone) {
                    await sendWhatsAppMessage({
                        target: formatPhoneNumber(requesterProfile.whatsapp_phone),
                        message: `❌ *Request ATK Ditolak*\n\nHalo ${requesterProfile.full_name},\n\nMaaf, request ATK Anda ditolak.${reason ? `\nAlasan: ${reason}` : ""}\n\nSilakan hubungi admin untuk info lebih lanjut.`,
                    });
                }
            }
        } catch (notifError) {
            console.error("WhatsApp notification error:", notifError);
        }

        revalidatePath("/atk/requests");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function completeRequest(input: CompleteRequestInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        // Upload signature
        const signatureUrl = await uploadSignature(input.signature_data, input.request_id);
        if (!signatureUrl) {
            return { success: false, error: "Failed to upload signature" };
        }

        // Get request items
        const { data: items } = await supabase
            .from("atk_request_items")
            .select("item_id, approved_quantity")
            .eq("request_id", input.request_id);

        if (!items) {
            return { success: false, error: "No items found" };
        }

        // Deduct stock for each item
        for (const item of items) {
            if (item.approved_quantity && item.approved_quantity > 0) {
                // Get current stock
                const { data: atkItem } = await supabase
                    .from("atk_items")
                    .select("stock_quantity")
                    .eq("id", item.item_id)
                    .single();

                if (atkItem) {
                    // Update stock
                    await supabase
                        .from("atk_items")
                        .update({
                            stock_quantity: Math.max(0, atkItem.stock_quantity - item.approved_quantity),
                        })
                        .eq("id", item.item_id);

                    // Create stock history
                    await supabase.from("atk_stock_history").insert({
                        item_id: item.item_id,
                        type: "out",
                        quantity: item.approved_quantity,
                        reference_id: input.request_id,
                        notes: `Request fulfilled`,
                        created_by: user.id,
                    });
                }
            }
        }

        // Update request status with signature
        const { error } = await supabase
            .from("atk_requests")
            .update({
                status: "completed",
                approval_signature_url: signatureUrl,
            })
            .eq("id", input.request_id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/atk/requests");
        revalidatePath("/atk/items");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function deleteRequest(requestId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("atk_requests")
            .delete()
            .eq("id", requestId);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/atk/requests");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
