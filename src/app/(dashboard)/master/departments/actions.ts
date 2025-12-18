"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type CreateDepartmentInput = {
    name: string;
    description?: string | null;
};

type UpdateDepartmentInput = {
    id: string;
    name: string;
    description?: string | null;
};

type ActionResult = {
    success: boolean;
    error?: string;
};

export async function createDepartment(
    input: CreateDepartmentInput
): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase.from("departments").insert({
            name: input.name,
            description: input.description || null,
        });

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        revalidatePath("/master/departments");

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

export async function updateDepartment(
    input: UpdateDepartmentInput
): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("departments")
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

        revalidatePath("/master/departments");

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

export async function deleteDepartment(id: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase.from("departments").delete().eq("id", id);

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        revalidatePath("/master/departments");

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
