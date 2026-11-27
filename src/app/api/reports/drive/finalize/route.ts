import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    isGoogleDriveConfigured,
    makeDriveFileReadable,
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
            return NextResponse.json(
                { error: "Google Drive belum dikonfigurasi." },
                { status: 400 }
            );
        }

        const body = (await request.json()) as { fileId?: string };
        const fileId = (body.fileId || "").trim();

        if (!fileId) {
            return NextResponse.json({ error: "fileId wajib diisi." }, { status: 400 });
        }

        const urls = await makeDriveFileReadable(fileId);
        return NextResponse.json({ success: true, ...urls });
    } catch (error) {
        console.error("Google Drive finalize error:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Gagal mengaktifkan akses file Google Drive.",
            },
            { status: 500 }
        );
    }
}
