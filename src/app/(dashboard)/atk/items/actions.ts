"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type ItemType = "atk" | "sparepart";

type CreateItemInput = {
    type: ItemType;
    name: string;
    description?: string | null;
    unit: string;
    price: number;
    stock_quantity?: number;
    min_stock?: number;
    image_url?: string | null;
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
