"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CreateDistributionInput = {
    destination_location_id: string;
    receiver_id: string;
    notes?: string;
    items: {
        asset_id: string;
        condition: "Baru" | "Bekas";
    }[];
};

type ActionResult = {
    success: boolean;
    error?: string;
    id?: string;
};

async function generateDocumentNumber(): Promise<string> {
    const supabase = createAdminClient();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `SBBK-${year}${month}`;

    // Get the latest document number for this month
    const { data } = await supabase
        .from("asset_distributions")
        .select("document_number")
        .like("document_number", `${prefix}%`)
        .order("document_number", { ascending: false })
        .limit(1)
        .single();

    let nextNumber = 1;
    if (data?.document_number) {
        const lastNumber = parseInt(data.document_number.split("-").pop() || "0");
        nextNumber = lastNumber + 1;
    }

    return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

export async function createDistribution(input: CreateDistributionInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "User not authenticated" };
        }

        if (!input.items || input.items.length === 0) {
            return { success: false, error: "Pilih minimal 1 asset" };
        }

        // Create distribution (without document number - generated on print)
        const { data: distribution, error: distError } = await supabase
            .from("asset_distributions")
            .insert({
                destination_location_id: input.destination_location_id,
                receiver_id: input.receiver_id,
                notes: input.notes || null,
                status: "draft",
                created_by: user.id,
            })
            .select("id")
            .single();

        if (distError || !distribution) {
            return { success: false, error: distError?.message || "Failed to create distribution" };
        }

        // Create distribution items
        const items = input.items.map((item) => ({
            distribution_id: distribution.id,
            asset_id: item.asset_id,
            condition: item.condition,
        }));

        const { error: itemsError } = await supabase
            .from("asset_distribution_items")
            .insert(items);

        if (itemsError) {
            // Rollback - delete the distribution
            await supabase.from("asset_distributions").delete().eq("id", distribution.id);
            return { success: false, error: itemsError.message };
        }

        revalidatePath("/assets/distribution");
        return { success: true, id: distribution.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function confirmDistribution(
    distributionId: string,
    receiverSignatureUrl: string
): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "User not authenticated" };
        }

        // Get distribution with items
        const { data: distribution, error: fetchError } = await supabase
            .from("asset_distributions")
            .select(`
                id,
                destination_location_id,
                receiver_id,
                asset_distribution_items(asset_id)
            `)
            .eq("id", distributionId)
            .single();

        if (fetchError || !distribution) {
            return { success: false, error: "Distribution not found" };
        }

        // Update distribution status
        const { error: updateError } = await supabase
            .from("asset_distributions")
            .update({
                status: "completed",
                distributed_by: user.id,
                distributed_at: new Date().toISOString(),
                received_at: new Date().toISOString(),
                receiver_signature_url: receiverSignatureUrl,
            })
            .eq("id", distributionId);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        // Update asset locations and assigned_to
        const assetIds = distribution.asset_distribution_items.map((item: { asset_id: string }) => item.asset_id);
        const { error: assetError } = await supabase
            .from("assets")
            .update({
                location_id: distribution.destination_location_id,
                assigned_to: distribution.receiver_id
            })
            .in("id", assetIds);

        if (assetError) {
            console.error("Error updating assets:", assetError);
        }

        revalidatePath("/assets/distribution");
        revalidatePath("/assets");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function deleteDistribution(distributionId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // Check if distribution is draft
        const { data: distribution } = await supabase
            .from("asset_distributions")
            .select("status")
            .eq("id", distributionId)
            .single();

        if (distribution?.status === "completed") {
            return { success: false, error: "Cannot delete completed distribution" };
        }

        const { error } = await supabase
            .from("asset_distributions")
            .delete()
            .eq("id", distributionId);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets/distribution");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Upload signature
export async function uploadDistributionSignature(formData: FormData): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const file = formData.get("file") as File;
        const distributionId = formData.get("distributionId") as string;

        if (!file || !distributionId) {
            return { success: false, error: "Missing file or distribution ID" };
        }

        const fileName = `distribution_${distributionId}_${Date.now()}.png`;
        const filePath = `signatures/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from("images")
            .upload(filePath, file, {
                contentType: "image/png",
                upsert: true,
            });

        if (uploadError) {
            return { success: false, error: uploadError.message };
        }

        const { data: urlData } = supabase.storage.from("images").getPublicUrl(filePath);

        return { success: true, id: urlData.publicUrl };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Generate document number for printing (only if not already generated)
export async function generateDocumentNumberForPrint(distributionId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // Check if document number already exists
        const { data: existing } = await supabase
            .from("asset_distributions")
            .select("document_number")
            .eq("id", distributionId)
            .single();

        if (existing?.document_number) {
            // Already has document number
            return { success: true, id: existing.document_number };
        }

        // Generate new document number
        const documentNumber = await generateDocumentNumber();

        // Update distribution with document number
        const { error } = await supabase
            .from("asset_distributions")
            .update({ document_number: documentNumber })
            .eq("id", distributionId);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets/distribution");
        return { success: true, id: documentNumber };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
