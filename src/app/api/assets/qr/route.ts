import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createCanvas } from "canvas";

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

        // Create Canvas for beautiful QR
        const size = 1000;
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext("2d");

        // 1. Get QR Data Matrix
        const qr = QRCode.create(assetUrl, { errorCorrectionLevel: 'H' });
        const modules = qr.modules;
        const moduleCount = modules.size;

        // 2. Setup Background & Frame (matching qr-generator)
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, "#2563eb");
        gradient.addColorStop(1, "#7c3aed");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        const qrPadding = 50;
        const qrSize = size - (qrPadding * 2);

        ctx.fillStyle = "#ffffff";
        // roundedRect polyfill for node canvas
        ctx.beginPath();
        const rectRadius = 50;
        ctx.moveTo(qrPadding + rectRadius, qrPadding);
        ctx.lineTo(qrPadding + qrSize - rectRadius, qrPadding);
        ctx.bezierCurveTo(qrPadding + qrSize, qrPadding, qrPadding + qrSize, qrPadding + rectRadius, qrPadding + qrSize, qrPadding + rectRadius);
        ctx.lineTo(qrPadding + qrSize, qrPadding + qrSize - rectRadius);
        ctx.bezierCurveTo(qrPadding + qrSize, qrPadding + qrSize, qrPadding + qrSize - rectRadius, qrPadding + qrSize, qrPadding + qrSize - rectRadius, qrPadding + qrSize);
        ctx.lineTo(qrPadding + rectRadius, qrPadding + qrSize);
        ctx.bezierCurveTo(qrPadding, qrPadding + qrSize, qrPadding, qrPadding + qrSize - rectRadius, qrPadding, qrPadding + qrSize - rectRadius);
        ctx.lineTo(qrPadding, qrPadding + rectRadius);
        ctx.bezierCurveTo(qrPadding, qrPadding, qrPadding + rectRadius, qrPadding, qrPadding + rectRadius, qrPadding);
        ctx.closePath();
        ctx.fill();

        // 3. Draw Stylized Modules
        const cellSize = (qrSize - 60) / moduleCount;
        const startX = qrPadding + 30;
        const startY = qrPadding + 30;

        ctx.fillStyle = "#000000";

        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                const isDark = modules.get(row, col);
                if (!isDark) continue;

                // Skip Finder Patterns
                const isFinderPattern =
                    (row < 7 && col < 7) ||
                    (row < 7 && col >= moduleCount - 7) ||
                    (row >= moduleCount - 7 && col < 7);

                if (isFinderPattern) continue;

                // Draw Rounded Dots
                const x = startX + col * cellSize + cellSize / 2;
                const y = startY + row * cellSize + cellSize / 2;

                ctx.beginPath();
                ctx.arc(x, y, cellSize * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 4. Draw Custom Finder Patterns (Eyes)
        // Polyfill roundRect for eyes
        const drawEye = (x: number, y: number) => {
            const eyeSize = cellSize * 7;
            const drawRoundRect = (xOff: number, yOff: number, w: number, h: number, r: number) => {
                ctx.beginPath();
                ctx.moveTo(xOff + r, yOff);
                ctx.lineTo(xOff + w - r, yOff);
                ctx.bezierCurveTo(xOff + w, yOff, xOff + w, yOff + r, xOff + w, yOff + r);
                ctx.lineTo(xOff + w, yOff + h - r);
                ctx.bezierCurveTo(xOff + w, yOff + h, xOff + w - r, yOff + h, xOff + w - r, yOff + h);
                ctx.lineTo(xOff + r, yOff + h);
                ctx.bezierCurveTo(xOff, yOff + h, xOff, yOff + h - r, xOff, yOff + h - r);
                ctx.lineTo(xOff, yOff + r);
                ctx.bezierCurveTo(xOff, yOff, xOff + r, yOff, xOff + r, yOff);
                ctx.closePath();
            };

            // Outer ring
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = cellSize;
            drawRoundRect(x + cellSize / 2, y + cellSize / 2, eyeSize - cellSize, eyeSize - cellSize, eyeSize * 0.25);
            ctx.stroke();

            // Inner dot
            ctx.fillStyle = "#000000";
            drawRoundRect(x + cellSize * 2, y + cellSize * 2, eyeSize - cellSize * 4, eyeSize - cellSize * 4, eyeSize * 0.15);
            ctx.fill();
        };

        drawEye(startX, startY); // Top Left
        drawEye(startX + (moduleCount - 7) * cellSize, startY); // Top Right
        drawEye(startX, startY + (moduleCount - 7) * cellSize); // Bottom Left

        // Generate data URL from canvas
        const qrDataUrl = canvas.toDataURL("image/png");

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
