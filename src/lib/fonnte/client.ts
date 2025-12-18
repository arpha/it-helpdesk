/**
 * Fonnte WhatsApp API Client
 * Documentation: https://fonnte.com/api
 */

const FONNTE_BASE_URL = "https://api.fonnte.com";

type SendMessageParams = {
    target: string; // Phone number with country code (e.g., 628123456789)
    message: string;
    countryCode?: string;
};

type SendMessageResponse = {
    status: boolean;
    detail?: string;
    id?: string;
};

type FonnteWebhookPayload = {
    device: string;
    sender: string;
    message: string;
    member: string;
    name: string;
    url?: string;
};

/**
 * Send WhatsApp message via Fonnte API
 */
export async function sendWhatsAppMessage(
    params: SendMessageParams
): Promise<SendMessageResponse> {
    const apiKey = process.env.FONNTE_API_KEY;

    if (!apiKey) {
        console.error("FONNTE_API_KEY not configured");
        return { status: false, detail: "API key not configured" };
    }

    try {
        const response = await fetch(`${FONNTE_BASE_URL}/send`, {
            method: "POST",
            headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                target: params.target,
                message: params.message,
                countryCode: params.countryCode || "62",
            }),
        });

        const data = await response.json();
        return {
            status: data.status === true,
            detail: data.detail,
            id: data.id,
        };
    } catch (error) {
        console.error("Fonnte send error:", error);
        return {
            status: false,
            detail: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Format phone number to E.164 format (without +)
 */
export function formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, "");

    // If starts with 0, replace with 62 (Indonesia)
    if (cleaned.startsWith("0")) {
        cleaned = "62" + cleaned.substring(1);
    }

    // If doesn't start with country code, add 62
    if (!cleaned.startsWith("62")) {
        cleaned = "62" + cleaned;
    }

    return cleaned;
}

/**
 * Parse incoming Fonnte webhook payload
 */
export function parseFonnteWebhook(body: unknown): FonnteWebhookPayload | null {
    if (!body || typeof body !== "object") return null;

    const payload = body as Record<string, unknown>;

    if (
        typeof payload.sender !== "string" ||
        typeof payload.message !== "string"
    ) {
        return null;
    }

    return {
        device: String(payload.device || ""),
        sender: String(payload.sender),
        message: String(payload.message),
        member: String(payload.member || ""),
        name: String(payload.name || ""),
        url: payload.url ? String(payload.url) : undefined,
    };
}

export type { SendMessageParams, SendMessageResponse, FonnteWebhookPayload };
