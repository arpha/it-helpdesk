import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    createDriveResumableUploadSession,
    isGoogleDriveConfigured,
} from "@/lib/google-drive/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!isGoogleDriveConfigured()) {
            return NextResponse.json({ configured: false }, { status: 200 });
        }

        const body = (await request.json()) as {
            fileName?: string;
            mimeType?: string;
            fileSize?: number;
            year?: string;
            categoryName?: string;
        };

        const fileName = (body.fileName || "").trim();
        const fileSize = Number(body.fileSize || 0);
        const mimeType = body.mimeType || "application/octet-stream";

        if (!fileName || fileSize <= 0) {
            return NextResponse.json(
                { error: "Nama dan ukuran file wajib diisi." },
                { status: 400 }
            );
        }

        const maxBytes = 50 * 1024 * 1024; // 50 MB per file untuk Google Drive
        if (fileSize > maxBytes) {
            return NextResponse.json(
                { error: "Ukuran file melebihi batas maksimal 50 MB." },
                { status: 400 }
            );
        }

        const yearFolder = body.year || String(new Date().getFullYear());
        const categoryFolder = (body.categoryName || "").trim() || "Tanpa Kategori";
        const origin = request.headers.get("origin");

        const { uploadUrl, folderId } = await createDriveResumableUploadSession({
            fileName,
            mimeType,
            fileSize,
            yearFolder,
            categoryFolder,
            origin,
        });

        return NextResponse.json({
            configured: true,
            uploadUrl,
            folderId,
        });
    } catch (error) {
        console.error("Google Drive upload-session error:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Gagal membuat sesi upload Google Drive.",
            },
            { status: 500 }
        );
    }
}
