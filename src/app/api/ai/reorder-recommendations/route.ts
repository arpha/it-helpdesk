import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type ReorderRecommendation = {
    item_id: string;
    current_stock: number;
    avg_daily_usage: number;
    reorder_point: number;
    suggested_qty: number;
    days_until_reorder: number;
    priority: "urgent" | "soon" | "planned" | "safe";
    estimated_stockout_date: string | null;
};

export async function POST() {
    try {
        const supabase = await createClient();

        // Get all active items with their stock history
        const { data: items, error: itemsError } = await supabase
            .from("atk_items")
            .select("id, name, stock_quantity, min_stock, lead_time_days")
            .eq("is_active", true);

        if (itemsError) throw itemsError;

        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const recommendations: ReorderRecommendation[] = [];

        for (const item of items || []) {
            // Get stock out history for this item (last 90 days)
            const { data: history } = await supabase
                .from("atk_stock_history")
                .select("quantity, created_at")
                .eq("item_id", item.id)
                .eq("type", "out")
                .gte("created_at", ninetyDaysAgo.toISOString());

            // Calculate average daily usage
            const totalOut = history?.reduce((sum, h) => sum + h.quantity, 0) || 0;
            const avgDailyUsage = totalOut / 90;

            // Calculate safety stock (using 1.65 z-score for 95% service level)
            const leadTime = item.lead_time_days || 7;
            const safetyStock = Math.ceil(1.65 * avgDailyUsage * Math.sqrt(leadTime));

            // Calculate reorder point
            const reorderPoint = Math.ceil((avgDailyUsage * leadTime) + safetyStock);

            // Calculate days until stock reaches reorder point
            let daysUntilReorder = 999;
            if (avgDailyUsage > 0) {
                daysUntilReorder = Math.floor((item.stock_quantity - reorderPoint) / avgDailyUsage);
                if (daysUntilReorder < 0) daysUntilReorder = 0;
            }

            // Calculate suggested order quantity (Economic Order Quantity simplified)
            // Using average 30-day demand as order quantity
            const suggestedQty = Math.max(Math.ceil(avgDailyUsage * 30), item.min_stock);

            // Determine priority
            let priority: "urgent" | "soon" | "planned" | "safe" = "safe";
            if (item.stock_quantity <= reorderPoint || daysUntilReorder <= 0) {
                priority = "urgent";
            } else if (daysUntilReorder <= 7) {
                priority = "soon";
            } else if (daysUntilReorder <= 14) {
                priority = "planned";
            }

            // Calculate estimated stockout date
            let estimatedStockoutDate: string | null = null;
            if (avgDailyUsage > 0) {
                const daysUntilEmpty = Math.floor(item.stock_quantity / avgDailyUsage);
                const stockoutDate = new Date(now.getTime() + daysUntilEmpty * 24 * 60 * 60 * 1000);
                estimatedStockoutDate = stockoutDate.toISOString().split("T")[0];
            }

            recommendations.push({
                item_id: item.id,
                current_stock: item.stock_quantity,
                avg_daily_usage: avgDailyUsage,
                reorder_point: reorderPoint,
                suggested_qty: suggestedQty,
                days_until_reorder: daysUntilReorder,
                priority,
                estimated_stockout_date: estimatedStockoutDate,
            });

            // Update item with reorder point
            await supabase
                .from("atk_items")
                .update({
                    reorder_point: reorderPoint,
                    suggested_order_qty: suggestedQty
                })
                .eq("id", item.id);
        }

        // Upsert recommendations
        for (const rec of recommendations) {
            await supabase
                .from("atk_reorder_recommendations")
                .upsert({
                    ...rec,
                    calculated_at: now.toISOString(),
                }, { onConflict: "item_id" });
        }

        // Summary
        const summary = {
            urgent: recommendations.filter(r => r.priority === "urgent").length,
            soon: recommendations.filter(r => r.priority === "soon").length,
            planned: recommendations.filter(r => r.priority === "planned").length,
            safe: recommendations.filter(r => r.priority === "safe").length,
            total: recommendations.length,
        };

        return NextResponse.json({
            success: true,
            message: "Reorder recommendations calculated",
            summary,
        });
    } catch (error) {
        console.error("Reorder recommendations error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to calculate recommendations" },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("atk_reorder_recommendations")
            .select(`
                *,
                atk_items(id, name, stock_quantity, min_stock, unit, price, type)
            `)
            .order("days_until_reorder", { ascending: true });

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("Get recommendations error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get recommendations" },
            { status: 500 }
        );
    }
}
