import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const assetId = searchParams.get("id");

        if (!assetId) {
            return NextResponse.json(
                { success: false, error: "Asset ID required" },
                { status: 400 }
            );
        }

        // Generate URL to public asset view page
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
        const assetUrl = `${baseUrl}/public/assets/${assetId}`;

        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(assetUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: "#000000",
                light: "#ffffff"
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                qrCode: qrDataUrl,
                assetUrl
            }
        });
    } catch (error) {
        console.error("QR generation error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to generate QR code" },
            { status: 500 }
        );
    }
}
