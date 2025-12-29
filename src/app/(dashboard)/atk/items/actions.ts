"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type ItemType = "consumable" | "sparepart";

type CreateItemInput = {
    type: ItemType;
    name: string;
    description?: string | null;
    unit: string;
    price: number;
    stock_quantity?: number;
    min_stock?: number;
    image_url?: string | null;
    is_active?: boolean;
};

type UpdateItemInput = {
    id: string;
    type: ItemType;
    name: string;
    description?: string | null;
    unit: string;
    price: number;
    min_stock?: number;
    image_url?: string | null;
    is_active?: boolean;
};

type ActionResult = {
    success: boolean;
    error?: string;
    url?: string;
};

export async function uploadItemImage(formData: FormData): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const file = formData.get("file") as File;
        const itemId = formData.get("itemId") as string;

        if (!file) {
            return { success: false, error: "No file provided" };
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${itemId || Date.now()}.${fileExt}`;
        const filePath = `items/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from("images")
            .upload(filePath, file, {
                upsert: true,
                contentType: file.type,
            });

        if (uploadError) {
            return { success: false, error: uploadError.message };
        }

        const { data: urlData } = supabase.storage
            .from("images")
            .getPublicUrl(filePath);

        return { success: true, url: urlData.publicUrl };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Upload failed",
        };
    }
}

export async function createItem(input: CreateItemInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase.from("atk_items").insert({
            type: input.type,
            name: input.name,
            description: input.description || null,
            unit: input.unit,
            price: input.price,
            stock_quantity: input.stock_quantity || 0,
            min_stock: input.min_stock || 5,
            image_url: input.image_url || null,
            is_active: input.is_active !== undefined ? input.is_active : true,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/atk/items");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function updateItem(input: UpdateItemInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("atk_items")
            .update({
                type: input.type,
                name: input.name,
                description: input.description || null,
                unit: input.unit,
                price: input.price,
                min_stock: input.min_stock || 5,
                image_url: input.image_url || null,
                is_active: input.is_active !== undefined ? input.is_active : true,
            })
            .eq("id", input.id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/atk/items");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function deleteItem(id: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // Get item to check for image
        const { data: item } = await supabase
            .from("atk_items")
            .select("image_url")
            .eq("id", id)
            .single();

        // Delete image if exists
        if (item?.image_url) {
            const urlParts = item.image_url.split("/");
            const fileName = urlParts[urlParts.length - 1];
            const filePath = `items/${fileName}`;
            await supabase.storage.from("images").remove([filePath]);
        }

        const { error } = await supabase.from("atk_items").delete().eq("id", id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/atk/items");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

type ImportItemInput = {
    type: ItemType;
    name: string;
    description?: string | null;
    unit: string;
    price: number;
    stock_quantity?: number;
    min_stock?: number;
    is_active?: boolean;
};

type BulkImportResult = {
    success: boolean;
    imported: number;
    failed: number;
    errors: string[];
    details: {
        name: string;
        type: string;
        unit: string;
        price: number;
        stock: number;
        status: "success" | "failed";
        error?: string;
    }[];
};

export async function bulkImportItems(items: ImportItemInput[]): Promise<BulkImportResult> {
    const supabase = createAdminClient();
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];
    const details: BulkImportResult["details"] = [];

    for (const item of items) {
        try {
            // Validate required fields
            if (!item.name || !item.unit || item.price === undefined) {
                failed++;
                const errorMsg = "Missing required fields (name, unit, or price)";
                errors.push(`Item "${item.name || 'unknown'}": ${errorMsg}`);
                details.push({
                    name: item.name || "unknown",
                    type: item.type || "consumable",
                    unit: item.unit || "-",
                    price: Number(item.price) || 0,
                    stock: Number(item.stock_quantity) || 0,
                    status: "failed",
                    error: errorMsg,
                });
                continue;
            }

            // Validate type
            const validTypes = ["consumable", "sparepart"];
            const itemType = validTypes.includes(item.type?.toLowerCase())
                ? item.type.toLowerCase() as ItemType
                : "consumable";

            const { error } = await supabase.from("atk_items").insert({
                type: itemType,
                name: item.name.trim(),
                description: item.description || null,
                unit: item.unit.toLowerCase().trim(),
                price: Number(item.price) || 0,
                stock_quantity: Number(item.stock_quantity) || 0,
                min_stock: Number(item.min_stock) || 5,
                is_active: item.is_active !== undefined ? item.is_active : true,
            });

            if (error) {
                failed++;
                errors.push(`Item "${item.name}": ${error.message}`);
                details.push({
                    name: item.name,
                    type: itemType,
                    unit: item.unit,
                    price: Number(item.price) || 0,
                    stock: Number(item.stock_quantity) || 0,
                    status: "failed",
                    error: error.message,
                });
            } else {
                imported++;
                details.push({
                    name: item.name,
                    type: itemType,
                    unit: item.unit,
                    price: Number(item.price) || 0,
                    stock: Number(item.stock_quantity) || 0,
                    status: "success",
                });
            }
        } catch (error) {
            failed++;
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            errors.push(`Item "${item.name}": ${errorMsg}`);
            details.push({
                name: item.name || "unknown",
                type: item.type || "consumable",
                unit: item.unit || "-",
                price: Number(item.price) || 0,
                stock: Number(item.stock_quantity) || 0,
                status: "failed",
                error: errorMsg,
            });
        }
    }

    revalidatePath("/atk/items");
    return { success: failed === 0, imported, failed, errors, details };
}
