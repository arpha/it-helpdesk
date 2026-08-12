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
        const formData = new FormData();
        formData.append("target", params.target);
        formData.append("message", params.message);
        if (params.countryCode) {
            formData.append("countryCode", params.countryCode);
        }

        console.log("Fonnte API - Sending to target:", params.target);
        console.log("Fonnte API - Message length:", params.message.length);
        console.log("Fonnte API - API Key present:", !!apiKey, "Key prefix:", apiKey.substring(0, 8) + "...");

        const response = await fetch(`${FONNTE_BASE_URL}/send`, {
            method: "POST",
            headers: {
                Authorization: apiKey,
            },
            body: formData,
        });

        const responseText = await response.text();
        console.log("Fonnte API - Response status:", response.status);
        console.log("Fonnte API - Response body:", responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            console.error("Fonnte API - Failed to parse response as JSON:", responseText);
            return { status: false, detail: `Non-JSON response: ${responseText}` };
        }

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

// In-memory cache for group ID mapping (LID -> real group ID)
const groupIdCache = new Map<string, string>();
let groupCacheTimestamp = 0;
const GROUP_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch/sync WhatsApp groups from Fonnte
 */
export async function fetchGroups(): Promise<boolean> {
    const apiKey = process.env.FONNTE_API_KEY;
    if (!apiKey) return false;

    try {
        const response = await fetch(`${FONNTE_BASE_URL}/fetch-group`, {
            method: "POST",
            headers: { Authorization: apiKey },
        });
        const data = await response.json();
        console.log("Fonnte fetch-group result:", JSON.stringify(data));
        return data.status === true;
    } catch (error) {
        console.error("Fonnte fetch-group error:", error);
        return false;
    }
}

/**
 * Get list of WhatsApp groups with their IDs
 */
export async function getWhatsAppGroups(): Promise<{ id: string; name: string }[]> {
    const apiKey = process.env.FONNTE_API_KEY;
    if (!apiKey) return [];

    try {
        const response = await fetch(`${FONNTE_BASE_URL}/get-whatsapp-group`, {
            method: "POST",
            headers: { Authorization: apiKey },
        });
        const data = await response.json();
        console.log("Fonnte get-whatsapp-group count:", Array.isArray(data) ? data.length : "not array");
        
        if (Array.isArray(data)) {
            return data.map((g: { id: string; name: string }) => ({
                id: g.id,
                name: g.name,
            }));
        }
        
        // Some Fonnte responses wrap in { data: [...] }
        if (data.data && Array.isArray(data.data)) {
            return data.data.map((g: { id: string; name: string }) => ({
                id: g.id,
                name: g.name,
            }));
        }

        console.log("Fonnte get-whatsapp-group full response:", JSON.stringify(data));
        return [];
    } catch (error) {
        console.error("Fonnte get-whatsapp-group error:", error);
        return [];
    }
}

/**
 * Resolve a group sender ID (possibly LID format) to a valid Fonnte group ID.
 * Falls back to the member's phone number if group ID cannot be resolved.
 */
export async function resolveGroupTarget(senderGroupId: string, memberPhone?: string): Promise<string> {
    // If sender already contains a dash (standard format), use it directly
    if (senderGroupId.includes("-") && senderGroupId.includes("@g.us")) {
        return senderGroupId;
    }

    // Check cache first
    if (groupIdCache.has(senderGroupId) && (Date.now() - groupCacheTimestamp) < GROUP_CACHE_TTL) {
        console.log("Using cached group ID for:", senderGroupId, "->", groupIdCache.get(senderGroupId));
        return groupIdCache.get(senderGroupId)!;
    }

    // Sync groups then get list
    console.log("Syncing Fonnte groups to resolve LID:", senderGroupId);
    await fetchGroups();
    
    // Wait a moment for sync to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const groups = await getWhatsAppGroups();
    groupCacheTimestamp = Date.now();

    // Cache all group IDs
    for (const group of groups) {
        console.log("Found group:", group.name, "->", group.id);
        groupIdCache.set(group.id, group.id);
    }

    // Try to find a matching group
    if (groupIdCache.has(senderGroupId)) {
        return groupIdCache.get(senderGroupId)!;
    }

    // If we have groups, try to find one - for LID format we just pick the first matching @g.us group
    // since we can't directly map LID to standard format
    for (const group of groups) {
        if (group.id.includes("@g.us") && group.id.includes("-")) {
            console.log("Resolved LID", senderGroupId, "to group:", group.name, "->", group.id);
            groupIdCache.set(senderGroupId, group.id);
            return group.id;
        }
    }

    // Fallback: send to member's phone number directly
    if (memberPhone) {
        console.log("Could not resolve group ID, falling back to member phone:", memberPhone);
        return memberPhone;
    }

    return senderGroupId;
}
