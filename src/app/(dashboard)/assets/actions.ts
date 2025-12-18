"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CreateAssetInput = {
    asset_code: string;
    category_id?: string;
    name: string;
    brand?: string;
    model?: string;
    serial_number?: string;
    purchase_date?: string;
    purchase_price?: number;
    warranty_expiry?: string;
    useful_life_years?: number;
    status?: string;
    condition?: string;
    location?: string;
    department_id?: string;
    assigned_to?: string;
    image_url?: string;
    notes?: string;
};

type UpdateAssetInput = CreateAssetInput & {
    id: string;
};

type ActionResult = {
    success: boolean;
    error?: string;
    id?: string;
    url?: string;
};

export async function createAsset(input: CreateAssetInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const { data, error } = await supabase
            .from("assets")
            .insert({
                asset_code: input.asset_code,
                category_id: input.category_id || null,
                name: input.name,
                brand: input.brand || null,
                model: input.model || null,
                serial_number: input.serial_number || null,
                purchase_date: input.purchase_date || null,
                purchase_price: input.purchase_price || 0,
                warranty_expiry: input.warranty_expiry || null,
                useful_life_years: input.useful_life_years || 5,
                status: input.status || "active",
                condition: input.condition || "good",
                location: input.location || null,
                department_id: input.department_id || null,
                assigned_to: input.assigned_to || null,
                image_url: input.image_url || null,
                notes: input.notes || null,
                created_by: user.id,
            })
            .select("id")
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets");
        return { success: true, id: data.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function updateAsset(input: UpdateAssetInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("assets")
            .update({
                asset_code: input.asset_code,
                category_id: input.category_id || null,
                name: input.name,
                brand: input.brand || null,
                model: input.model || null,
                serial_number: input.serial_number || null,
                purchase_date: input.purchase_date || null,
                purchase_price: input.purchase_price || 0,
                warranty_expiry: input.warranty_expiry || null,
                useful_life_years: input.useful_life_years || 5,
                status: input.status || "active",
                condition: input.condition || "good",
                location: input.location || null,
                department_id: input.department_id || null,
                assigned_to: input.assigned_to || null,
                image_url: input.image_url || null,
                notes: input.notes || null,
            })
            .eq("id", input.id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function deleteAsset(id: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("assets")
            .delete()
            .eq("id", id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function uploadAssetImage(formData: FormData): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const file = formData.get("file") as File;
        const assetId = formData.get("assetId") as string;

        if (!file) {
            return { success: false, error: "No file provided" };
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `asset_${assetId}_${Date.now()}.${fileExt}`;
        const filePath = `assets/${fileName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from("images")
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) {
            return { success: false, error: uploadError.message };
        }

        const { data: urlData } = supabase.storage.from("images").getPublicUrl(filePath);

        return { success: true, url: urlData.publicUrl };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Generate next asset code
export async function generateAssetCode(categoryPrefix: string): Promise<string> {
    const supabase = createAdminClient();
    const year = new Date().getFullYear();
    const prefix = `${categoryPrefix}-${year}`;

    const { data } = await supabase
        .from("assets")
        .select("asset_code")
        .ilike("asset_code", `${prefix}%`)
        .order("asset_code", { ascending: false })
        .limit(1);

    if (data && data.length > 0) {
        const lastCode = data[0].asset_code;
        const lastNum = parseInt(lastCode.split("-").pop() || "0");
        return `${prefix}-${String(lastNum + 1).padStart(4, "0")}`;
    }

    return `${prefix}-0001`;
}
