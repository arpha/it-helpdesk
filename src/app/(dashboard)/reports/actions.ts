"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
    processReportDeadlineReminders,
    sendSingleReportReminder,
} from "@/lib/reports/deadline-reminder";
import {
    getReportAttachments,
    type Report,
    type ReportAttachment,
    type ReportCategory,
    type ReportFilterParams,
    type ReportLog,
    type ReportLogAction,
    type ReportLogChange,
    type ReportStats,
} from "@/types/report";

const REPORT_SELECT = `
    *,
    category:report_categories(*),
    assigned_profile:profiles!reports_assigned_to_fkey(id, full_name, username, role),
    created_profile:profiles!reports_created_by_fkey(id, full_name, username, role),
    reviewed_profile:profiles!reports_reviewed_by_fkey(id, full_name, username, role),
    approved_profile:profiles!reports_approved_by_fkey(id, full_name, username, role)
`;

function getTodayDateString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

async function getClientIp(): Promise<string | null> {
    try {
        const hdrs = await headers();
        const forwarded = hdrs.get("x-forwarded-for");
        if (forwarded) {
            return forwarded.split(",")[0].trim();
        }
        return hdrs.get("x-real-ip") || null;
    } catch {
        return null;
    }
}

async function getCurrentUserWithRole() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { supabase, user: null, role: null as string | null };

    const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

    return {
        supabase,
        user,
        role: (profile?.role as string) || "user",
        fullName: (profile?.full_name as string) || user.email || "Pengguna",
    };
}

/**
 * Helper internal: wajib mencatat setiap aktivitas ke tabel report_logs untuk audit keamanan
 */
async function logReportChange(params: {
    reportId: string;
    action: ReportLogAction;
    performedBy: string;
    notes?: string | null;
    changes?: Record<string, ReportLogChange> | null;
}) {
    const supabase = await createClient();
    const ipAddress = await getClientIp();

    const { error } = await supabase.from("report_logs").insert([
        {
            report_id: params.reportId,
            action: params.action,
            performed_by: params.performedBy,
            notes: params.notes || null,
            changes:
                params.changes && Object.keys(params.changes).length > 0
                    ? params.changes
                    : null,
            ip_address: ipAddress,
        },
    ]);

    if (error) {
        console.error("Error writing report audit log:", error);
    }
}

/**
 * Ambil daftar kategori laporan
 */
export async function getReportCategories() {
    const { supabase, user } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized", data: [] as ReportCategory[] };

    const { data, error } = await supabase
        .from("report_categories")
        .select("*")
        .order("name", { ascending: true });

    if (error) {
        console.error("Error fetching report categories:", error);
        return { success: false, error: error.message, data: [] as ReportCategory[] };
    }

    return { success: true, data: (data || []) as ReportCategory[] };
}

/**
 * Tambah kategori laporan baru (admin & manager_it)
 */
export async function createReportCategory(payload: {
    name: string;
    description?: string;
    color: string;
}) {
    const { supabase, user, role } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!["admin", "manager_it"].includes(role || "")) {
        return { success: false, error: "Hanya Admin atau Manager IT yang dapat mengelola kategori." };
    }

    const name = payload.name.trim();
    if (!name) return { success: false, error: "Nama kategori wajib diisi." };

    const { data, error } = await supabase
        .from("report_categories")
        .insert([
            {
                name,
                description: payload.description?.trim() || null,
                color: payload.color || "blue",
            },
        ])
        .select()
        .single();

    if (error) {
        console.error("Error creating report category:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/reports");
    return { success: true, data: data as ReportCategory };
}

/**
 * Hapus kategori laporan (admin & manager_it)
 */
export async function deleteReportCategory(id: string) {
    const { supabase, user, role } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!["admin", "manager_it"].includes(role || "")) {
        return { success: false, error: "Hanya Admin atau Manager IT yang dapat menghapus kategori." };
    }

    const { error } = await supabase.from("report_categories").delete().eq("id", id);
    if (error) {
        console.error("Error deleting report category:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/reports");
    return { success: true };
}

/**
 * Ambil daftar laporan dengan filter, search, dan pagination
 */
export async function getReports(params?: ReportFilterParams) {
    const { supabase, user } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    const today = getTodayDateString();

    let query = supabase.from("reports").select(REPORT_SELECT, { count: "exact" });

    if (params?.search && params.search.trim()) {
        const q = params.search.trim();
        query = query.or(
            `title.ilike.%${q}%,report_number.ilike.%${q}%,description.ilike.%${q}%`
        );
    }

    if (params?.category_id && params.category_id !== "all") {
        query = query.eq("category_id", params.category_id);
    }

    if (params?.status && params.status !== "all") {
        if (params.status === "overdue") {
            query = query
                .in("status", ["pending", "draft", "revision", "overdue"])
                .lt("deadline", today);
        } else if (["pending", "draft", "revision"].includes(params.status)) {
            query = query.eq("status", params.status).gte("deadline", today);
        } else {
            query = query.eq("status", params.status);
        }
    }

    if (params?.period_type && params.period_type !== "all") {
        query = query.eq("period_type", params.period_type);
    }

    if (params?.priority && params.priority !== "all") {
        query = query.eq("priority", params.priority);
    }

    if (params?.assigned_to && params.assigned_to !== "all") {
        query = query.eq("assigned_to", params.assigned_to);
    }

    const { data, count, error } = await query
        .order("deadline", { ascending: true })
        .order("created_at", { ascending: false })
        .range(start, end);

    if (error) {
        console.error("Error fetching reports:", error);
        return { success: false, error: error.message };
    }

    return {
        success: true,
        data: (data || []) as Report[],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
    };
}

/**
 * Ambil detail 1 laporan beserta audit trail logs
 */
export async function getReportById(id: string) {
    const { supabase, user } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };

    const [{ data: report, error: reportError }, { data: logs, error: logsError }] =
        await Promise.all([
            supabase.from("reports").select(REPORT_SELECT).eq("id", id).single(),
            supabase
                .from("report_logs")
                .select(
                    `*, performer:profiles!report_logs_performed_by_fkey(id, full_name, username, role)`
                )
                .eq("report_id", id)
                .order("created_at", { ascending: false }),
        ]);

    if (reportError) {
        console.error("Error fetching report detail:", reportError);
        return { success: false, error: reportError.message };
    }

    if (logsError) {
        console.error("Error fetching report logs:", logsError);
    }

    return {
        success: true,
        data: report as Report,
        logs: (logs || []) as ReportLog[],
    };
}

/**
 * Ambil riwayat audit trail per laporan
 */
export async function getReportLogs(reportId: string) {
    const { supabase, user } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized", data: [] as ReportLog[] };

    const { data, error } = await supabase
        .from("report_logs")
        .select(
            `*, performer:profiles!report_logs_performed_by_fkey(id, full_name, username, role)`
        )
        .eq("report_id", reportId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching report logs:", error);
        return { success: false, error: error.message, data: [] as ReportLog[] };
    }

    return { success: true, data: (data || []) as ReportLog[] };
}

/**
 * Buat atau perbarui laporan + upload file + WAJIB catat audit trail
 */
export async function saveReport(formData: FormData) {
    const { supabase, user, role } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };

    const id = (formData.get("id") as string | null) || null;
    const title = ((formData.get("title") as string) || "").trim();
    const report_number = ((formData.get("report_number") as string) || "").trim() || null;
    const category_id = ((formData.get("category_id") as string) || "").trim() || null;
    const description = ((formData.get("description") as string) || "").trim() || null;
    const period_type = ((formData.get("period_type") as string) || "monthly").trim();
    const period_start = ((formData.get("period_start") as string) || "").trim() || null;
    const period_end = ((formData.get("period_end") as string) || "").trim() || null;
    const deadline = ((formData.get("deadline") as string) || "").trim();
    const priority = ((formData.get("priority") as string) || "normal").trim();
    const status = ((formData.get("status") as string) || "pending").trim();
    const assigned_to = ((formData.get("assigned_to") as string) || "").trim() || null;
    const editReason = ((formData.get("edit_reason") as string) || "").trim() || null;

    if (!title) return { success: false, error: "Judul laporan wajib diisi." };
    if (!deadline) return { success: false, error: "Tanggal deadline wajib diisi." };

    let existingReport: Report | null = null;
    if (id) {
        const { data: oldData, error: oldError } = await supabase
            .from("reports")
            .select(REPORT_SELECT)
            .eq("id", id)
            .single();

        if (oldError || !oldData) {
            return { success: false, error: "Laporan yang akan diedit tidak ditemukan." };
        }
        existingReport = oldData as Report;
    }

    const existingAttachments = getReportAttachments(existingReport);

    // Parse lampiran lama yang dipertahankan oleh user saat edit
    let keptAttachments: ReportAttachment[] = existingAttachments;
    const keptAttachmentsRaw = formData.get("kept_attachments") as string | null;
    if (id && keptAttachmentsRaw !== null) {
        try {
            const parsed = JSON.parse(keptAttachmentsRaw);
            if (Array.isArray(parsed)) {
                keptAttachments = parsed.filter(
                    (a): a is ReportAttachment =>
                        !!a && typeof a.url === "string" && typeof a.name === "string"
                );
            }
        } catch {
            keptAttachments = existingAttachments;
        }
    }

    // Kumpulkan semua file baru (mendukung multi-file "files" dan legacy single "file")
    const rawFiles = [
        ...formData.getAll("files"),
        ...formData.getAll("file"),
    ].filter((f): f is File => f instanceof File && f.size > 0);

    const maxBytes = 10 * 1024 * 1024; // 10 MB per file
    for (const f of rawFiles) {
        if (f.size > maxBytes) {
            return {
                success: false,
                error: `Ukuran file "${f.name}" terlalu besar. Batas maksimal 10 MB per file.`,
            };
        }
    }

    const nowIso = new Date().toISOString();
    const newlyUploaded: ReportAttachment[] = [];

    for (const file of rawFiles) {
        const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin";
        const safeFileName = `report_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const filePath = `attachments/${safeFileName}`;

        const { error: uploadError } = await supabase.storage
            .from("reports")
            .upload(filePath, file, { upsert: true });

        if (uploadError) {
            console.error("Error uploading report file:", uploadError);
            return {
                success: false,
                error: `Gagal mengunggah file "${file.name}": ${uploadError.message}`,
            };
        }

        const { data: publicUrlData } = supabase.storage
            .from("reports")
            .getPublicUrl(filePath);

        newlyUploaded.push({
            url: publicUrlData.publicUrl,
            name: file.name,
            size: file.size,
            type: file.type || null,
            uploaded_at: nowIso,
        });
    }

    const finalAttachments: ReportAttachment[] = [...keptAttachments, ...newlyUploaded];
    const primaryAttachment = finalAttachments[0] || null;

    // Hapus file fisik di storage jika ada lampiran lama yang dibuang saat edit
    if (id && existingAttachments.length > 0) {
        const keptUrls = new Set(keptAttachments.map((a) => a.url));
        const removedAttachments = existingAttachments.filter((a) => !keptUrls.has(a.url));
        if (removedAttachments.length > 0) {
            const marker = "/storage/v1/object/public/reports/";
            const pathsToRemove = removedAttachments
                .map((a) => {
                    const idx = a.url.indexOf(marker);
                    return idx !== -1
                        ? decodeURIComponent(a.url.substring(idx + marker.length))
                        : null;
                })
                .filter((p): p is string => !!p);

            if (pathsToRemove.length > 0) {
                await supabase.storage.from("reports").remove(pathsToRemove);
            }
        }
    }

    const oldFileNames = existingAttachments.map((a) => a.name).join(", ");
    const newFileNames = finalAttachments.map((a) => a.name).join(", ");
    const attachmentsChanged = oldFileNames !== newFileNames;

    const payload: Record<string, unknown> = {
        title,
        report_number,
        category_id,
        description,
        period_type,
        period_start,
        period_end,
        deadline,
        priority,
        status,
        assigned_to,
        attachments: finalAttachments,
        file_url: primaryAttachment?.url || null,
        file_name: primaryAttachment?.name || null,
        file_size: primaryAttachment?.size || 0,
        file_type: primaryAttachment?.type || null,
        updated_at: nowIso,
    };

    if (status === "submitted" && (!existingReport || existingReport.status !== "submitted")) {
        payload.submitted_at = nowIso;
    }

    if (id && existingReport) {
        // Hitung JSON diff before/after untuk audit trail keamanan
        const changes: Record<string, ReportLogChange> = {};

        // Resolve nama kategori & PIC baru agar diff mudah dibaca
        let newCategoryName: string | null = null;
        if (category_id && category_id !== existingReport.category_id) {
            const { data: catData } = await supabase
                .from("report_categories")
                .select("name")
                .eq("id", category_id)
                .single();
            newCategoryName = catData?.name || category_id;
        }

        let newPicName: string | null = null;
        if (assigned_to && assigned_to !== existingReport.assigned_to) {
            const { data: picData } = await supabase
                .from("profiles")
                .select("full_name, username")
                .eq("id", assigned_to)
                .single();
            newPicName = picData?.full_name || picData?.username || assigned_to;
        }

        const trackField = (field: string, oldVal: unknown, newVal: unknown) => {
            const normalizedOld = oldVal ?? null;
            const normalizedNew = newVal ?? null;
            if (normalizedOld !== normalizedNew) {
                changes[field] = { old: normalizedOld, new: normalizedNew };
            }
        };

        trackField("title", existingReport.title, title);
        trackField("report_number", existingReport.report_number, report_number);
        if ((existingReport.category_id ?? null) !== (category_id ?? null)) {
            changes.category_id = {
                old: existingReport.category?.name || existingReport.category_id || null,
                new: newCategoryName || null,
            };
        }
        trackField("description", existingReport.description, description);
        trackField("period_type", existingReport.period_type, period_type);
        trackField("period_start", existingReport.period_start, period_start);
        trackField("period_end", existingReport.period_end, period_end);
        trackField("deadline", existingReport.deadline, deadline);
        trackField("priority", existingReport.priority, priority);
        trackField("status", existingReport.status, status);
        if ((existingReport.assigned_to ?? null) !== (assigned_to ?? null)) {
            changes.assigned_to = {
                old:
                    existingReport.assigned_profile?.full_name ||
                    existingReport.assigned_profile?.username ||
                    existingReport.assigned_to ||
                    null,
                new: newPicName || null,
            };
        }
        if (attachmentsChanged) {
            changes.attachments = {
                old: oldFileNames || null,
                new: newFileNames || null,
            };
        }

        const { data: updated, error: updateError } = await supabase
            .from("reports")
            .update(payload)
            .eq("id", id)
            .select(REPORT_SELECT)
            .single();

        if (updateError) {
            console.error("Error updating report:", updateError);
            return { success: false, error: updateError.message };
        }

        const isOwnerOrPic =
            existingReport.created_by === user.id || existingReport.assigned_to === user.id;
        const isEditingOthers = !isOwnerOrPic && !["admin", "manager_it"].includes(role || "");

        const auditPrefix = isEditingOthers
            ? "[Audit: Edit laporan milik pengguna lain]"
            : "";
        const combinedNotes = [auditPrefix, editReason].filter(Boolean).join(" ").trim() || null;

        const logAction: ReportLogAction =
            attachmentsChanged && Object.keys(changes).length === 1
                ? existingAttachments.length > 0
                    ? "file_replaced"
                    : "file_uploaded"
                : "updated";

        await logReportChange({
            reportId: id,
            action: logAction,
            performedBy: user.id,
            notes: combinedNotes,
            changes,
        });

        revalidatePath("/reports");
        revalidatePath("/reports/calendar");
        return { success: true, data: updated as Report };
    } else {
        // Create baru
        const { data: created, error: insertError } = await supabase
            .from("reports")
            .insert([{ ...payload, created_by: user.id }])
            .select(REPORT_SELECT)
            .single();

        if (insertError || !created) {
            console.error("Error creating report:", insertError);
            return { success: false, error: insertError?.message || "Gagal membuat laporan." };
        }

        await logReportChange({
            reportId: created.id,
            action: "created",
            performedBy: user.id,
            notes: editReason || "Laporan baru dibuat.",
            changes: {
                title: { old: null, new: title },
                deadline: { old: null, new: deadline },
                status: { old: null, new: status },
            },
        });

        if (newlyUploaded.length > 0) {
            const uploadedNames = newlyUploaded.map((a) => a.name).join(", ");
            await logReportChange({
                reportId: created.id,
                action: "file_uploaded",
                performedBy: user.id,
                notes: `Mengunggah ${newlyUploaded.length} file: ${uploadedNames}`,
                changes: { attachments: { old: null, new: uploadedNames } },
            });
        }

        revalidatePath("/reports");
        revalidatePath("/reports/calendar");
        return { success: true, data: created as Report };
    }
}

/**
 * Submit laporan (ubah status menjadi 'submitted')
 */
export async function submitReport(id: string, notes?: string) {
    const { supabase, user } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: existing, error: fetchError } = await supabase
        .from("reports")
        .select("id, status, title")
        .eq("id", id)
        .single();

    if (fetchError || !existing) {
        return { success: false, error: "Laporan tidak ditemukan." };
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
        .from("reports")
        .update({
            status: "submitted",
            submitted_at: nowIso,
            updated_at: nowIso,
        })
        .eq("id", id)
        .select(REPORT_SELECT)
        .single();

    if (error) {
        console.error("Error submitting report:", error);
        return { success: false, error: error.message };
    }

    await logReportChange({
        reportId: id,
        action: "submitted",
        performedBy: user.id,
        notes: notes?.trim() || "Laporan disubmit untuk direview.",
        changes: {
            status: { old: existing.status, new: "submitted" },
        },
    });

    revalidatePath("/reports");
    revalidatePath("/reports/calendar");
    return { success: true, data: data as Report };
}

/**
 * Review / Approve / Request Revision / Reject laporan (hanya admin & manager_it)
 */
export async function reviewReport(params: {
    id: string;
    action: "review" | "approved" | "revision" | "rejected";
    notes?: string;
}) {
    const { supabase, user, role } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!["admin", "manager_it"].includes(role || "")) {
        return {
            success: false,
            error: "Hanya Admin atau Manager IT yang dapat mereview atau menyetujui laporan.",
        };
    }

    const { data: existing, error: fetchError } = await supabase
        .from("reports")
        .select("id, status, reviewer_notes, revision_notes")
        .eq("id", params.id)
        .single();

    if (fetchError || !existing) {
        return { success: false, error: "Laporan tidak ditemukan." };
    }

    const nowIso = new Date().toISOString();
    const notesText = params.notes?.trim() || null;

    const updatePayload: Record<string, unknown> = {
        status: params.action,
        updated_at: nowIso,
    };

    let logAction: ReportLogAction = "reviewed";

    if (params.action === "review") {
        updatePayload.reviewed_by = user.id;
        updatePayload.reviewed_at = nowIso;
        if (notesText) updatePayload.reviewer_notes = notesText;
        logAction = "reviewed";
    } else if (params.action === "approved") {
        updatePayload.approved_by = user.id;
        updatePayload.approved_at = nowIso;
        if (notesText) updatePayload.reviewer_notes = notesText;
        logAction = "approved";
    } else if (params.action === "revision") {
        updatePayload.reviewed_by = user.id;
        updatePayload.reviewed_at = nowIso;
        updatePayload.revision_notes = notesText;
        logAction = "revision_requested";
    } else if (params.action === "rejected") {
        updatePayload.reviewed_by = user.id;
        updatePayload.reviewed_at = nowIso;
        updatePayload.reviewer_notes = notesText;
        logAction = "rejected";
    }

    const { data, error } = await supabase
        .from("reports")
        .update(updatePayload)
        .eq("id", params.id)
        .select(REPORT_SELECT)
        .single();

    if (error) {
        console.error("Error reviewing report:", error);
        return { success: false, error: error.message };
    }

    await logReportChange({
        reportId: params.id,
        action: logAction,
        performedBy: user.id,
        notes: notesText,
        changes: {
            status: { old: existing.status, new: params.action },
        },
    });

    revalidatePath("/reports");
    revalidatePath("/reports/calendar");
    return { success: true, data: data as Report };
}

/**
 * Hapus laporan (hanya admin & manager_it)
 */
export async function deleteReport(id: string) {
    const { supabase, user, role } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!["admin", "manager_it"].includes(role || "")) {
        return {
            success: false,
            error: "Hanya Admin atau Manager IT yang dapat menghapus laporan.",
        };
    }

    const { data: existing } = await supabase
        .from("reports")
        .select("id, file_url, attachments")
        .eq("id", id)
        .single();

    // Hapus semua file lampiran di storage jika ada
    const allAttachments = getReportAttachments(existing as Report | null);
    const urlsToRemove = new Set<string>(allAttachments.map((a) => a.url));
    if (existing?.file_url) {
        urlsToRemove.add(existing.file_url);
    }

    if (urlsToRemove.size > 0) {
        const marker = "/storage/v1/object/public/reports/";
        const storagePaths = Array.from(urlsToRemove)
            .map((url) => {
                const idx = url.indexOf(marker);
                return idx !== -1 ? decodeURIComponent(url.substring(idx + marker.length)) : null;
            })
            .filter((p): p is string => !!p);

        if (storagePaths.length > 0) {
            await supabase.storage.from("reports").remove(storagePaths);
        }
    }

    const { error } = await supabase.from("reports").delete().eq("id", id);

    if (error) {
        console.error("Error deleting report:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/reports");
    revalidatePath("/reports/calendar");
    return { success: true };
}

/**
 * Statistik ringkasan laporan untuk Stats Cards
 */
export async function getReportStats(): Promise<{
    success: boolean;
    data?: ReportStats;
    error?: string;
}> {
    const { supabase, user } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data, error } = await supabase
        .from("reports")
        .select("id, status, deadline");

    if (error) {
        console.error("Error fetching report stats:", error);
        return { success: false, error: error.message };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let total = 0;
    let pending = 0;
    let dueSoon = 0;
    let overdue = 0;
    let approved = 0;

    for (const row of data || []) {
        total++;
        const st = row.status as string;
        if (st === "approved") {
            approved++;
            continue;
        }
        if (st === "rejected") {
            continue;
        }

        const [y, m, d] = (row.deadline as string).split("-").map(Number);
        const dl = new Date(y, (m || 1) - 1, d || 1);
        const daysLeft = Math.round((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const isIncomplete = ["pending", "draft", "revision", "overdue"].includes(st);

        if (isIncomplete && daysLeft < 0) {
            overdue++;
        } else {
            pending++;
            if (isIncomplete && daysLeft >= 0 && daysLeft <= 7) {
                dueSoon++;
            }
        }
    }

    return {
        success: true,
        data: { total, pending, dueSoon, overdue, approved },
    };
}

/**
 * Ambil daftar laporan berdasarkan rentang bulan deadline untuk halaman Kalender
 */
export async function getReportsByDeadline(year: number, month: number) {
    const { supabase, user } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized", data: [] as Report[] };

    // month: 1-12
    const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data, error } = await supabase
        .from("reports")
        .select(REPORT_SELECT)
        .gte("deadline", startStr)
        .lte("deadline", endStr)
        .order("deadline", { ascending: true })
        .order("priority", { ascending: false });

    if (error) {
        console.error("Error fetching reports by deadline:", error);
        return { success: false, error: error.message, data: [] as Report[] };
    }

    return { success: true, data: (data || []) as Report[] };
}

/**
 * Trigger manual pengecekan & pengiriman WA reminder (H-7, H-3, Overdue) — hanya admin & manager_it
 */
export async function triggerReportDeadlineReminders() {
    const { user, role } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!["admin", "manager_it"].includes(role || "")) {
        return {
            success: false,
            error: "Hanya Admin atau Manager IT yang dapat mengirim pengingat WA massal.",
        };
    }

    return await processReportDeadlineReminders();
}

/**
 * Kirim pengingat WA langsung ke PIC untuk 1 laporan tertentu — hanya admin & manager_it
 */
export async function sendManualReportReminder(reportId: string) {
    const { user, role } = await getCurrentUserWithRole();
    if (!user) return { success: false, error: "Unauthorized" };
    if (!["admin", "manager_it"].includes(role || "")) {
        return {
            success: false,
            error: "Hanya Admin atau Manager IT yang dapat mengirim pengingat WA.",
        };
    }

    return await sendSingleReportReminder(reportId);
}
