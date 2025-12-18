import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage, formatPhoneNumber } from "@/lib/fonnte/client";

export async function POST(request: NextRequest) {
    try {
        // Simple API key check for internal use
        const authHeader = request.headers.get("authorization");
        const internalKey = process.env.INTERNAL_API_KEY;

        if (internalKey && authHeader !== `Bearer ${internalKey}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { phone, message } = body as { phone: string; message: string };

        if (!phone || !message) {
            return NextResponse.json(
                { error: "Phone and message are required" },
                { status: 400 }
            );
        }

        const formattedPhone = formatPhoneNumber(phone);
        const result = await sendWhatsAppMessage({
            target: formattedPhone,
            message,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Send message error:", error);
        return NextResponse.json(
            { error: "Failed to send message" },
            { status: 500 }
        );
    }
}
