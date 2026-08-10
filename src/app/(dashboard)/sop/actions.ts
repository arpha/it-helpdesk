"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SOPDocument, SOPFilterParams } from "@/types/sop";

export async function getSOPDocuments(params?: SOPFilterParams) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    let query = supabase
        .from("sop_documents")
        .select(`
            *,
            profiles:created_by (full_name, email)
        `, { count: "exact" });

    if (params?.search) {
        query = query.or(`title.ilike.%${params.search}%,document_number.ilike.%${params.search}%,description.ilike.%${params.search}%`);
    }

    if (params?.category && params.category !== "All") {
        query = query.eq("category", params.category);
    }

    const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(start, end);

    if (error) {
        console.error("Error fetching SOP documents:", error);
        return { success: false, error: error.message };
    }

    return {
        success: true,
        data: (data || []) as SOPDocument[],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
    };
}

export async function saveSOPDocument(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const id = formData.get("id") as string | null;
    const title = formData.get("title") as string;
    const document_number = formData.get("document_number") as string || null;
    const category = formData.get("category") as string;
    const description = formData.get("description") as string || null;
    const status = (formData.get("status") as string) || "published";

    let file_url = formData.get("existing_file_url") as string || "";
    let file_name = formData.get("existing_file_name") as string || "";
    let file_size = parseInt((formData.get("existing_file_size") as string) || "0", 10);

    const file = formData.get("file") as File | null;

    if (file && file.size > 0) {
        const fileExt = file.name.split(".").pop();
        const fileName = `sop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `sop_files/${fileName}`;

        // Upload to supabase storage bucket 'documents'
        const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(filePath, file, { upsert: true });

        if (uploadError) {
            console.error("Error uploading file:", uploadError);
            return { success: false, error: "Gagal mengunggah file PDF: " + uploadError.message };
        }

        const { data: publicUrlData } = supabase.storage
            .from("documents")
            .getPublicUrl(filePath);

        file_url = publicUrlData.publicUrl;
        file_name = file.name;
        file_size = file.size;
    }

    if (!file_url) {
        return { success: false, error: "File PDF wajib diunggah" };
    }

    const payload = {
        title,
        document_number,
        category,
        description,
        file_url,
        file_name,
        file_size,
        status,
        updated_at: new Date().toISOString()
    };

    let result;
    if (id) {
        result = await supabase
            .from("sop_documents")
            .update(payload)
            .eq("id", id)
            .select()
            .single();
    } else {
        result = await supabase
            .from("sop_documents")
            .insert([{ ...payload, created_by: user.id }])
            .select()
            .single();
    }

    if (result.error) {
        console.error("Error saving SOP document:", result.error);
        return { success: false, error: result.error.message };
    }

    revalidatePath("/sop");
    return { success: true, data: result.data };
}

export async function deleteSOPDocument(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const { error } = await supabase
        .from("sop_documents")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting SOP document:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/sop");
    return { success: true };
}
