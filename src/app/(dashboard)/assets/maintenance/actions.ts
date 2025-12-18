"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CreateMaintenanceInput = {
    asset_id: string;
    type: string;
    description?: string;
    cost?: number;
    performed_by?: string;
    performed_at?: string;
    next_maintenance?: string;
    notes?: string;
};

type UpdateMaintenanceInput = CreateMaintenanceInput & {
    id: string;
};

type ActionResult = {
    success: boolean;
    error?: string;
    id?: string;
};

export async function createMaintenance(input: CreateMaintenanceInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const { data, error } = await supabase
            .from("asset_maintenance")
            .insert({
                asset_id: input.asset_id,
                type: input.type,
                description: input.description || null,
                cost: input.cost || 0,
                performed_by: input.performed_by || null,
                performed_at: input.performed_at || null,
                next_maintenance: input.next_maintenance || null,
                notes: input.notes || null,
                created_by: user.id,
            })
            .select("id")
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets/maintenance");
        return { success: true, id: data.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function updateMaintenance(input: UpdateMaintenanceInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("asset_maintenance")
            .update({
                asset_id: input.asset_id,
                type: input.type,
                description: input.description || null,
                cost: input.cost || 0,
                performed_by: input.performed_by || null,
                performed_at: input.performed_at || null,
                next_maintenance: input.next_maintenance || null,
                notes: input.notes || null,
            })
            .eq("id", input.id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets/maintenance");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function deleteMaintenance(id: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("asset_maintenance")
            .delete()
            .eq("id", id);

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets/maintenance");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
