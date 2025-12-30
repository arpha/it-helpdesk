import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createClient();

        // Get all items with analytics
        const { data: items, error: itemsError } = await supabase
            .from("atk_items")
            .select(`
                id, name, stock_quantity, min_stock, price, is_active,
                atk_item_analytics(health_status, days_since_last_out, turnover_rate)
            `)
            .eq("is_active", true);

        if (itemsError) throw itemsError;

        // Calculate summary
        let healthy = 0, slow = 0, dead = 0, unknown = 0;
        let totalValue = 0;
        let deadStockValue = 0;
        let lowStockCount = 0;
        const slowMovingItems: Array<{
            id: string;
            name: string;
            stock: number;
            value: number;
            days_since_last_out: number;
        }> = [];
        const alerts: Array<{
            type: "warning" | "danger";
            message: string;
            item_name: string;
        }> = [];

        for (const item of items || []) {
            // Analytics is returned as array, get first element
            const analyticsArray = item.atk_item_analytics as unknown as Array<{
                health_status: string;
                days_since_last_out: number;
                turnover_rate: number;
            }> | null;
            const analytics = analyticsArray?.[0];
            const itemValue = item.stock_quantity * item.price;
            totalValue += itemValue;

            // Count by health status
            const status = analytics?.health_status || "unknown";
            if (status === "healthy") healthy++;
            else if (status === "slow") slow++;
            else if (status === "dead") dead++;
            else unknown++;

            // Calculate dead stock value
            if (status === "dead") {
                deadStockValue += itemValue;
                slowMovingItems.push({
                    id: item.id,
                    name: item.name,
                    stock: item.stock_quantity,
                    value: itemValue,
                    days_since_last_out: analytics?.days_since_last_out || 999,
                });
            } else if (status === "slow") {
                slowMovingItems.push({
                    id: item.id,
                    name: item.name,
                    stock: item.stock_quantity,
                    value: itemValue,
                    days_since_last_out: analytics?.days_since_last_out || 0,
                });
            }

            // Check for low stock
            if (item.stock_quantity <= item.min_stock) {
                lowStockCount++;
                alerts.push({
                    type: item.stock_quantity === 0 ? "danger" : "warning",
                    message: item.stock_quantity === 0
                        ? "Out of stock!"
                        : `Stock (${item.stock_quantity}) at or below minimum (${item.min_stock})`,
                    item_name: item.name,
                });
            }

            // Alert for dead stock with high value
            if (status === "dead" && itemValue > 500000) {
                alerts.push({
                    type: "warning",
                    message: `Dead stock worth ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(itemValue)} - Consider redistribution or disposal`,
                    item_name: item.name,
                });
            }
        }

        // Sort slow moving items by days since last out
        slowMovingItems.sort((a, b) => b.days_since_last_out - a.days_since_last_out);

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    healthy,
                    slow,
                    dead,
                    unknown,
                    total: items?.length || 0,
                    totalValue,
                    deadStockValue,
                    lowStockCount,
                },
                slowMovingItems: slowMovingItems.slice(0, 10),
                alerts: alerts.slice(0, 10),
            },
        });
    } catch (error) {
        console.error("Inventory health error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get inventory health" },
            { status: 500 }
        );
    }
}
