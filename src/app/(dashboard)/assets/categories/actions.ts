"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CreateCategoryInput = {
    name: string;
    description?: string;
};

type UpdateCategoryInput = {
    id: string;
    name: string;
    description?: string;
};

type ActionResult = {
    success: boolean;
    error?: string;
    id?: string;
};

export async function createAssetCategory(input: CreateCategoryInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from("asset_categories")
            .insert({
                name: input.name,
                description: input.description || null,
            })
            .select("id")
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets/categories");
        return { success: true, id: data.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function updateAssetCategory(input: UpdateCategoryInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("asset_categories")
            .update({
                name: input.name,
                description: input.description || null,
            })
            .eq("id", input.id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets/categories");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function deleteAssetCategory(id: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("asset_categories")
            .delete()
            .eq("id", id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets/categories");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
