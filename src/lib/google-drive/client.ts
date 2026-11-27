/**
 * Lightweight Google Drive REST API v3 Client (OAuth2 Refresh Token)
 * Tanpa dependency berat — pure fetch untuk performa optimal di Vercel Serverless.
 */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;

export function isGoogleDriveConfigured(): boolean {
    return Boolean(
        process.env.GOOGLE_DRIVE_CLIENT_ID &&
            process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
            process.env.GOOGLE_DRIVE_REFRESH_TOKEN &&
            process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    );
}

export async function getGoogleDriveAccessToken(): Promise<string> {
    const now = Date.now();
    if (cachedAccessToken && now < cachedTokenExpiresAt - 60_000) {
        return cachedAccessToken;
    }

    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Konfigurasi OAuth2 Google Drive belum lengkap.");
    }

    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });

    const data = (await res.json()) as {
        access_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
    };

    if (!res.ok || !data.access_token) {
        throw new Error(
            data.error_description ||
                data.error ||
                "Gagal mendapatkan access token Google Drive."
        );
    }

    cachedAccessToken = data.access_token;
    cachedTokenExpiresAt = now + (data.expires_in || 3600) * 1000;
    return data.access_token;
}

function escapeDriveQueryValue(val: string): string {
    return val.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Cari subfolder dengan nama tertentu di dalam parentId; buat baru jika belum ada
 */
export async function findOrCreateFolder(
    accessToken: string,
    folderName: string,
    parentId: string
): Promise<string> {
    const cleanName = folderName.trim() || "Umum";
    const escaped = escapeDriveQueryValue(cleanName);
    const q = `mimeType='application/vnd.google-apps.folder' and name='${escaped}' and '${parentId}' in parents and trashed=false`;

    const searchParams = new URLSearchParams({
        q,
        fields: "files(id,name)",
        pageSize: "1",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
    });

    const searchRes = await fetch(`${DRIVE_API_BASE}/files?${searchParams.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
        const searchData = (await searchRes.json()) as {
            files?: Array<{ id: string; name: string }>;
        };
        if (searchData.files && searchData.files.length > 0) {
            return searchData.files[0].id;
        }
    }

    const createRes = await fetch(
        `${DRIVE_API_BASE}/files?supportsAllDrives=true&fields=id`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: cleanName,
                mimeType: "application/vnd.google-apps.folder",
                parents: [parentId],
            }),
        }
    );

    const created = (await createRes.json()) as {
        id?: string;
        error?: { message?: string };
    };

    if (!createRes.ok || !created.id) {
        throw new Error(
            created.error?.message || `Gagal membuat folder "${cleanName}" di Google Drive.`
        );
    }

    return created.id;
}

/**
 * Buat Resumable Upload Session URL agar browser dapat mengunggah file langsung ke Google Drive
 * (bebas dari batas payload 4.5 MB Vercel).
 */
export async function createDriveResumableUploadSession(params: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    yearFolder: string;
    categoryFolder: string;
    origin?: string | null;
}): Promise<{ uploadUrl: string; folderId: string }> {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) {
        throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID belum dikonfigurasi.");
    }

    const accessToken = await getGoogleDriveAccessToken();

    // Buat/cari struktur folder: Root / Tahun / Kategori
    const yearFolderId = await findOrCreateFolder(
        accessToken,
        params.yearFolder,
        rootFolderId
    );
    const categoryFolderId = await findOrCreateFolder(
        accessToken,
        params.categoryFolder,
        yearFolderId
    );

    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": params.mimeType || "application/octet-stream",
        "X-Upload-Content-Length": String(params.fileSize),
    };

    // Penting agar browser diizinkan CORS saat PUT langsung ke uploadUrl
    if (params.origin) {
        headers["Origin"] = params.origin;
    }

    const res = await fetch(
        `${DRIVE_UPLOAD_BASE}/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,mimeType`,
        {
            method: "POST",
            headers,
            body: JSON.stringify({
                name: params.fileName,
                parents: [categoryFolderId],
            }),
        }
    );

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gagal membuat sesi upload Google Drive: ${errText}`);
    }

    const uploadUrl = res.headers.get("location");
    if (!uploadUrl) {
        throw new Error("Google Drive tidak mengembalikan upload session URL.");
    }

    return { uploadUrl, folderId: categoryFolderId };
}

/**
 * Aktifkan akses baca (anyone with link -> reader) agar file bisa dipreview & diunduh di aplikasi
 */
export async function makeDriveFileReadable(fileId: string): Promise<{
    downloadUrl: string;
    previewUrl: string;
    viewUrl: string;
}> {
    const accessToken = await getGoogleDriveAccessToken();

    const permRes = await fetch(
        `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                role: "reader",
                type: "anyone",
            }),
        }
    );

    if (!permRes.ok) {
        const errText = await permRes.text();
        console.error("Warning setting Google Drive permission:", errText);
    }

    return {
        downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
        previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        viewUrl: `https://drive.google.com/file/d/${fileId}/view`,
    };
}

/**
 * Hapus file dari Google Drive saat lampiran dibuang / laporan dihapus
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
    if (!isGoogleDriveConfigured() || !fileId) return false;

    try {
        const accessToken = await getGoogleDriveAccessToken();
        const res = await fetch(
            `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );
        return res.ok || res.status === 404;
    } catch (err) {
        console.error("Error deleting Google Drive file:", err);
        return false;
    }
}
