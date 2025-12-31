"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendWhatsAppMessage, formatPhoneNumber } from "@/lib/fonnte/client";

type CreateBorrowingInput = {
    asset_id: string;
    borrower_location_id: string;
    borrower_user_id?: string; // Optional - admin can specify on behalf of user
    borrow_date: string;
    expected_return_date?: string;
    purpose: string;
    notes?: string;
};

type ActionResult = {
    success: boolean;
    error?: string;
    id?: string;
};

// Create borrowing request
export async function createBorrowingRequest(input: CreateBorrowingInput): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        // Get asset's current location
        const { data: asset } = await supabase
            .from("assets")
            .select("location_id, is_borrowable, name")
            .eq("id", input.asset_id)
            .single();

        if (!asset) {
            return { success: false, error: "Asset not found" };
        }

        if (!asset.is_borrowable) {
            return { success: false, error: "Asset tidak bisa dipinjam" };
        }

        // Check if asset is currently being borrowed
        const { data: activeBorrowing } = await supabase
            .from("asset_borrowings")
            .select("id")
            .eq("asset_id", input.asset_id)
            .in("status", ["pending", "approved", "borrowed"])
            .limit(1)
            .single();

        if (activeBorrowing) {
            return { success: false, error: "Asset sedang dipinjam dan belum dikembalikan" };
        }

        const { data, error } = await supabase
            .from("asset_borrowings")
            .insert({
                asset_id: input.asset_id,
                borrower_location_id: input.borrower_location_id,
                borrower_user_id: input.borrower_user_id || user.id,
                original_location_id: asset.location_id,
                borrow_date: input.borrow_date,
                expected_return_date: input.expected_return_date || null,
                purpose: input.purpose,
                notes: input.notes || null,
                status: "pending",
                created_by: user.id,
            })
            .select("id")
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets/borrowing");
        return { success: true, id: data.id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Approve borrowing request
export async function approveBorrowing(borrowingId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const { error } = await supabase
            .from("asset_borrowings")
            .update({
                status: "approved",
                approved_by: user.id,
                approved_at: new Date().toISOString(),
            })
            .eq("id", borrowingId);

        if (error) {
            return { success: false, error: error.message };
        }

        // Send WhatsApp notification
        try {
            const { data: borrowing } = await supabase
                .from("asset_borrowings")
                .select(`
                    borrower_user_id,
                    assets(name),
                    borrower:profiles!asset_borrowings_borrower_user_id_fkey(full_name, whatsapp_phone)
                `)
                .eq("id", borrowingId)
                .single();

            const borrower = borrowing?.borrower as unknown as { full_name: string; whatsapp_phone: string } | null;
            const assets = borrowing?.assets as unknown as { name: string } | null;
            if (borrower?.whatsapp_phone) {
                await sendWhatsAppMessage({
                    target: formatPhoneNumber(borrower.whatsapp_phone),
                    message: `✅ *Peminjaman Disetujui!*\n\nHalo ${borrower.full_name},\n\nPeminjaman asset "${assets?.name}" telah disetujui.\nSilakan ambil asset di lokasi asal.\n\nTerima kasih! 🙏`,
                });
            }
        } catch (notifError) {
            console.error("WhatsApp notification error:", notifError);
        }

        revalidatePath("/assets/borrowing");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Reject borrowing request
export async function rejectBorrowing(borrowingId: string, reason?: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        const { error } = await supabase
            .from("asset_borrowings")
            .update({
                status: "rejected",
                approved_by: user.id,
                approved_at: new Date().toISOString(),
                notes: reason || null,
            })
            .eq("id", borrowingId);

        if (error) {
            return { success: false, error: error.message };
        }

        // Send WhatsApp notification
        try {
            const { data: borrowing } = await supabase
                .from("asset_borrowings")
                .select(`
                    assets(name),
                    borrower:profiles!asset_borrowings_borrower_user_id_fkey(full_name, whatsapp_phone)
                `)
                .eq("id", borrowingId)
                .single();

            const borrower = borrowing?.borrower as unknown as { full_name: string; whatsapp_phone: string } | null;
            const assets = borrowing?.assets as unknown as { name: string } | null;
            if (borrower?.whatsapp_phone) {
                await sendWhatsAppMessage({
                    target: formatPhoneNumber(borrower.whatsapp_phone),
                    message: `❌ *Peminjaman Ditolak*\n\nHalo ${borrower.full_name},\n\nMaaf, peminjaman asset "${assets?.name}" ditolak.${reason ? `\nAlasan: ${reason}` : ""}\n\nSilakan hubungi admin untuk info lebih lanjut.`,
                });
            }
        } catch (notifError) {
            console.error("WhatsApp notification error:", notifError);
        }

        revalidatePath("/assets/borrowing");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Confirm asset has been borrowed (picked up)
export async function confirmBorrowed(borrowingId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        // Get borrowing details
        const { data: borrowing } = await supabase
            .from("asset_borrowings")
            .select("asset_id, borrower_location_id")
            .eq("id", borrowingId)
            .single();

        if (!borrowing) {
            return { success: false, error: "Borrowing not found" };
        }

        // Update borrowing status
        const { error } = await supabase
            .from("asset_borrowings")
            .update({ status: "borrowed" })
            .eq("id", borrowingId);

        if (error) {
            return { success: false, error: error.message };
        }

        // Update asset location to borrower's location
        await supabase
            .from("assets")
            .update({ location_id: borrowing.borrower_location_id })
            .eq("id", borrowing.asset_id);

        revalidatePath("/assets/borrowing");
        revalidatePath("/assets");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Return borrowed asset
export async function returnAsset(borrowingId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();
        const authClient = await createClient();
        const { data: { user } } = await authClient.auth.getUser();

        if (!user) {
            return { success: false, error: "Not authenticated" };
        }

        // Get borrowing details
        const { data: borrowing } = await supabase
            .from("asset_borrowings")
            .select("asset_id, original_location_id")
            .eq("id", borrowingId)
            .single();

        if (!borrowing) {
            return { success: false, error: "Borrowing not found" };
        }

        // Update borrowing status
        const { error } = await supabase
            .from("asset_borrowings")
            .update({
                status: "returned",
                actual_return_date: new Date().toISOString(),
                returned_by: user.id,
                returned_at: new Date().toISOString(),
            })
            .eq("id", borrowingId);

        if (error) {
            return { success: false, error: error.message };
        }

        // Return asset to original location
        await supabase
            .from("assets")
            .update({ location_id: borrowing.original_location_id })
            .eq("id", borrowing.asset_id);

        revalidatePath("/assets/borrowing");
        revalidatePath("/assets");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// Delete borrowing request (only pending)
export async function deleteBorrowing(borrowingId: string): Promise<ActionResult> {
    try {
        const supabase = createAdminClient();

        const { error } = await supabase
            .from("asset_borrowings")
            .delete()
            .eq("id", borrowingId)
            .eq("status", "pending");

        if (error) {
            return { success: false, error: error.message };
        }

        revalidatePath("/assets/borrowing");
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
