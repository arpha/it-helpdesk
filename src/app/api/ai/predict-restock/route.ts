import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage, formatPhoneNumber } from "@/lib/fonnte/client";

const LEAD_TIME_DAYS = 14; // 2 weeks lead time

export async function POST() {
    try {
        const supabase = createAdminClient();

        // Get all ATK items with stock history
        const { data: items, error: itemsError } = await supabase
            .from("atk_items")
            .select("id, name, stock_quantity, min_stock");

        if (itemsError) {
            return NextResponse.json({ error: itemsError.message }, { status: 500 });
        }

        const predictions = [];
        const lowStockItems = [];

        for (const item of items || []) {
            // Get usage history for last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: history } = await supabase
                .from("atk_stock_history")
                .select("quantity, created_at")
                .eq("item_id", item.id)
                .eq("type", "out")
                .gte("created_at", thirtyDaysAgo.toISOString());

            // Calculate average daily usage
            const totalUsage = (history || []).reduce((sum, h) => sum + h.quantity, 0);
            const avgDailyUsage = totalUsage / 30;

            // Calculate days until min_stock
            const stockAboveMin = item.stock_quantity - (item.min_stock || 0);
            const daysUntilMin = avgDailyUsage > 0 ? Math.floor(stockAboveMin / avgDailyUsage) : 999;

            // Predict date when stock reaches min_stock
            const predictedDate = new Date();
            predictedDate.setDate(predictedDate.getDate() + daysUntilMin);

            // Generate recommendation
            let recommendation = "";
            let shouldNotify = false;

            if (daysUntilMin <= LEAD_TIME_DAYS) {
                recommendation = `⚠️ URGENT: Perlu restock segera! Stok akan mencapai minimum dalam ${daysUntilMin} hari.`;
                shouldNotify = true;
            } else if (daysUntilMin <= LEAD_TIME_DAYS * 2) {
                recommendation = `📋 Perlu order dalam ${daysUntilMin - LEAD_TIME_DAYS} hari.`;
            } else {
                recommendation = `✅ Stok aman untuk ${daysUntilMin} hari.`;
            }

            // Calculate confidence based on data availability
            const confidence = Math.min(1, (history?.length || 0) / 10);

            // Upsert prediction
            await supabase
                .from("atk_predictions")
                .upsert({
                    item_id: item.id,
                    avg_daily_usage: avgDailyUsage,
                    days_until_min_stock: daysUntilMin,
                    predicted_min_date: predictedDate.toISOString().split("T")[0],
                    recommendation,
                    confidence,
                    calculated_at: new Date().toISOString(),
                }, { onConflict: "item_id" });

            predictions.push({
                item_name: item.name,
                avg_daily_usage: avgDailyUsage.toFixed(2),
                days_until_min: daysUntilMin,
                recommendation,
            });

            if (shouldNotify) {
                lowStockItems.push({
                    name: item.name,
                    stock: item.stock_quantity,
                    min_stock: item.min_stock,
                    days_left: daysUntilMin,
                });
            }
        }

        // Send WhatsApp notification to admins if there are low stock items
        if (lowStockItems.length > 0) {
            const { data: admins } = await supabase
                .from("profiles")
                .select("full_name, whatsapp_phone")
                .eq("role", "admin");

            const message = `🚨 *ALERT: Stok ATK Menipis*\n\n` +
                lowStockItems.map(item =>
                    `• *${item.name}*\n  Stok: ${item.stock} (min: ${item.min_stock})\n  Sisa: ${item.days_left} hari`
                ).join("\n\n") +
                `\n\n_Segera lakukan restock (lead time: ${LEAD_TIME_DAYS} hari)_`;

            for (const admin of admins || []) {
                if (admin.whatsapp_phone) {
                    try {
                        await sendWhatsAppMessage({
                            target: formatPhoneNumber(admin.whatsapp_phone),
                            message,
                        });
                    } catch (e) {
                        console.error("Failed to send WA to admin:", e);
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            predictions_count: predictions.length,
            low_stock_count: lowStockItems.length,
            predictions,
        });
    } catch (error) {
        console.error("Prediction error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
