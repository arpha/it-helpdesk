import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        const supabase = await createClient();

        // Get all active items
        const { data: items, error: itemsError } = await supabase
            .from("atk_items")
            .select("id, stock_quantity")
            .eq("is_active", true);

        if (itemsError) throw itemsError;

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        const analytics = [];

        for (const item of items || []) {
            // Get stock history for this item
            const { data: history } = await supabase
                .from("atk_stock_history")
                .select("type, quantity, created_at")
                .eq("item_id", item.id)
                .eq("type", "out")
                .order("created_at", { ascending: false });

            // Calculate days since last out
            const lastOutRecord = history?.[0];
            const lastOutDate = lastOutRecord ? new Date(lastOutRecord.created_at) : null;
            const daysSinceLastOut = lastOutDate
                ? Math.floor((now.getTime() - lastOutDate.getTime()) / (1000 * 60 * 60 * 24))
                : 999; // 999 means never used

            // Calculate 30-day and 90-day usage
            const totalOut30d = history
                ?.filter(h => new Date(h.created_at) >= thirtyDaysAgo)
                .reduce((sum, h) => sum + h.quantity, 0) || 0;

            const totalOut90d = history
                ?.filter(h => new Date(h.created_at) >= ninetyDaysAgo)
                .reduce((sum, h) => sum + h.quantity, 0) || 0;

            // Calculate average daily usage (based on 90 days)
            const avgDailyUsage = totalOut90d / 90;

            // Calculate turnover rate (usage / stock)
            const turnoverRate = item.stock_quantity > 0
                ? totalOut90d / item.stock_quantity
                : 0;

            // Determine health status
            // Healthy: used within 7 days
            // Slow: 8-90 days
            // Dead: > 90 days
            let healthStatus: "healthy" | "slow" | "dead" | "unknown" = "unknown";
            if (daysSinceLastOut <= 7) {
                healthStatus = "healthy";
            } else if (daysSinceLastOut <= 90) {
                healthStatus = "slow";
            } else {
                healthStatus = "dead";
            }

            // Also check if item has never been used
            if (!lastOutRecord && item.stock_quantity > 0) {
                healthStatus = "dead";
            }

            analytics.push({
                item_id: item.id,
                days_since_last_out: daysSinceLastOut,
                total_out_30d: totalOut30d,
                total_out_90d: totalOut90d,
                avg_daily_usage: avgDailyUsage,
                turnover_rate: turnoverRate,
                health_status: healthStatus,
                last_out_date: lastOutDate?.toISOString() || null,
                calculated_at: now.toISOString(),
            });
        }

        // Upsert analytics data
        for (const record of analytics) {
            const { error: upsertError } = await supabase
                .from("atk_item_analytics")
                .upsert(record, { onConflict: "item_id" });

            if (upsertError) {
                console.error("Upsert error for item:", record.item_id, upsertError);
            }
        }

        // Count by status
        const summary = {
            healthy: analytics.filter(a => a.health_status === "healthy").length,
            slow: analytics.filter(a => a.health_status === "slow").length,
            dead: analytics.filter(a => a.health_status === "dead").length,
            total: analytics.length,
        };

        return NextResponse.json({
            success: true,
            message: "Inventory analysis completed",
            summary,
        });
    } catch (error) {
        console.error("Inventory analysis error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to analyze inventory" },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("atk_item_analytics")
            .select(`
                *,
                atk_items(id, name, stock_quantity, min_stock, unit, price, type)
            `)
            .order("days_since_last_out", { ascending: false });

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("Get analytics error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get analytics" },
            { status: 500 }
        );
    }
}
