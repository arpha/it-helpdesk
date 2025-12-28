"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type CreateLocationInput = {
    name: string;
    description?: string | null;
};

type UpdateLocationInput = {
    id: string;
    name: string;
    description?: string | null;
};

type ActionResult = {
    success: boolean;
    error?: string;
};

export async function createLocation(
    input: CreateLocationInput
): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase.from("locations").insert({
            name: input.name,
            description: input.description || null,
        });

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        revalidatePath("/master/locations");

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}

export async function updateLocation(
    input: UpdateLocationInput
): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("locations")
            .update({
                name: input.name,
                description: input.description || null,
            })
            .eq("id", input.id);

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        revalidatePath("/master/locations");

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}

export async function deleteLocation(id: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase.from("locations").delete().eq("id", id);

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        revalidatePath("/master/locations");

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}
