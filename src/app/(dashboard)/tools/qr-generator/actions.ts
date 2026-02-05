"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type QRLogo = {
    id: string;
    name: string;
    data: string;
    created_at: string;
};

export type CustomQR = {
    id: string;
    name: string;
    content: string;
    logo_data: string | null;
    logo_id: string | null;
    created_at: string;
    created_by: string | null;
};

export async function saveQRCode(data: {
    id?: string | null;
    name: string;
    content: string;
    logo_data: string | null;
    logo_id?: string | null
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const insertData = {
        name: data.name,
        content: data.content,
        logo_data: data.logo_data,
        logo_id: data.logo_id || null,
        created_by: user?.id,
    };

    let query;
    if (data.id) {
        // Update existing
        query = supabase
            .from("custom_qrs")
            .update(insertData)
            .eq("id", data.id)
            .select()
            .single();
    } else {
        // Create new
        query = supabase
            .from("custom_qrs")
            .insert([insertData])
            .select()
            .single();
    }

    const { data: qr, error } = await query;

    if (error) {
        console.error("Error saving/updating QR:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/tools/qr-generator");
    return { success: true, data: qr };
}

export async function saveLogo(name: string, data: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: logo, error } = await supabase
        .from("qr_logos")
        .insert([{ name, data, created_by: user?.id }])
        .select()
        .single();

    if (error) {
        console.error("Error saving logo:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data: logo as QRLogo };
}

export async function getLogos() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("qr_logos")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching logos:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data: data as QRLogo[] };
}

export async function getQRCodes(params?: {
    search?: string;
    page?: number;
    pageSize?: number;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    // Fetch user role
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    const role = profile?.role || "user";

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    let query = supabase
        .from("custom_qrs")
        .select(`
            *,
            qr_logos (data)
        `, { count: "exact" });

    // Apply role-based filtering
    if (role === "user") {
        query = query.eq("created_by", user.id);
    }

    if (params?.search) {
        query = query.or(`name.ilike.%${params.search}%,content.ilike.%${params.search}%`);
    }

    const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(start, end);

    if (error) {
        console.error("Error fetching QRs:", error);
        return { success: false, error: error.message };
    }

    // Map logo_id data back to logo_data if present
    const mappedData = data.map((qr: any) => {
        const logoData = Array.isArray(qr.qr_logos)
            ? qr.qr_logos[0]?.data
            : qr.qr_logos?.data;

        return {
            ...qr,
            logo_data: logoData || qr.logo_data
        };
    });

    return {
        success: true,
        data: mappedData as CustomQR[],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
    };
}

export async function deleteQRCode(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    // Fetch user role
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    const role = profile?.role || "user";

    let query = supabase.from("custom_qrs").delete().eq("id", id);

    // Apply ownership check for "user" role
    if (role === "user") {
        query = query.eq("created_by", user.id);
    }

    const { error } = await query;

    if (error) {
        console.error("Error deleting QR:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/tools/qr-generator");
    return { success: true };
}
