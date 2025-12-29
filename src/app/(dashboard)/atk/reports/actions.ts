"use server";

import { createAdminClient } from "@/lib/supabase/admin";

type DateRange = {
    startDate: string;
    endDate: string;
};

type UsageReportResult = {
    summary: {
        totalUsageOut: number;
        totalStockIn: number;
        totalCost: number;
        uniqueItems: number;
        requestsCount: number;
    };
    trendData: {
        date: string;
        usage: number;
        stockIn: number;
    }[];
    topItems: {
        name: string;
        usage: number;
        cost: number;
    }[];
    usageByLocation: {
        location: string;
        usage: number;
    }[];
    stockHistory: {
        id: string;
        item_name: string;
        type: string;
        quantity: number;
        notes: string | null;
        created_at: string;
        created_by_name: string | null;
    }[];
};

export async function getUsageReport(range: DateRange): Promise<UsageReportResult> {
    const supabase = createAdminClient();
    const { startDate, endDate } = range;

    // Get stock history for the period
    const { data: stockHistory } = await supabase
        .from("atk_stock_history")
        .select(`
            id,
            item_id,
            type,
            quantity,
            notes,
            created_at,
            atk_items(name, price),
            profiles:created_by(full_name)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59")
        .order("created_at", { ascending: false });

    // Calculate summary
    let totalUsageOut = 0;
    let totalStockIn = 0;
    let totalCost = 0;
    const uniqueItemIds = new Set<string>();
    const itemUsageMap = new Map<string, { name: string; usage: number; cost: number }>();
    const trendMap = new Map<string, { usage: number; stockIn: number }>();

    for (const record of stockHistory || []) {
        const itemData = record.atk_items as any;
        const itemName = itemData?.name || "Unknown";
        const itemPrice = itemData?.price || 0;

        uniqueItemIds.add(record.item_id);

        // Get date string for trend
        const dateStr = record.created_at.split("T")[0];
        if (!trendMap.has(dateStr)) {
            trendMap.set(dateStr, { usage: 0, stockIn: 0 });
        }
        const trend = trendMap.get(dateStr)!;

        if (record.type === "out") {
            totalUsageOut += record.quantity;
            totalCost += record.quantity * itemPrice;
            trend.usage += record.quantity;

            // Track per item
            if (!itemUsageMap.has(record.item_id)) {
                itemUsageMap.set(record.item_id, { name: itemName, usage: 0, cost: 0 });
            }
            const itemStats = itemUsageMap.get(record.item_id)!;
            itemStats.usage += record.quantity;
            itemStats.cost += record.quantity * itemPrice;
        } else if (record.type === "in") {
            totalStockIn += record.quantity;
            trend.stockIn += record.quantity;
        }
    }

    // Get requests count for the period
    const { count: requestsCount } = await supabase
        .from("atk_requests")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");

    // Get usage by location from requests
    const { data: requestsData } = await supabase
        .from("atk_requests")
        .select(`
            id,
            location_id,
            locations(name),
            atk_request_items(quantity, approved_quantity)
        `)
        .eq("status", "completed")
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");

    const locationMap = new Map<string, { name: string; usage: number }>();
    for (const req of requestsData || []) {
        const locationData = req.locations as any;
        const locationName = locationData?.name || "Unknown";
        const locationId = req.location_id || "unknown";

        if (!locationMap.has(locationId)) {
            locationMap.set(locationId, { name: locationName, usage: 0 });
        }

        const items = req.atk_request_items as any[];
        const totalQty = items.reduce((sum, item) => sum + (item.approved_quantity || item.quantity), 0);
        locationMap.get(locationId)!.usage += totalQty;
    }

    // Format trend data - sort by date
    const trendData = Array.from(trendMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Format top items - sort by usage descending, take top 10
    const topItems = Array.from(itemUsageMap.values())
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 10);

    // Format usage by location - sort by usage descending
    const usageByLocation = Array.from(locationMap.values())
        .sort((a, b) => b.usage - a.usage)
        .map(loc => ({ location: loc.name, usage: loc.usage }));

    // Format stock history for table
    const formattedHistory = (stockHistory || []).map(record => {
        const itemData = record.atk_items as any;
        const profileData = record.profiles as any;
        return {
            id: record.id,
            item_name: itemData?.name || "Unknown",
            type: record.type,
            quantity: record.quantity,
            notes: record.notes,
            created_at: record.created_at,
            created_by_name: profileData?.full_name || null,
        };
    });

    return {
        summary: {
            totalUsageOut,
            totalStockIn,
            totalCost,
            uniqueItems: uniqueItemIds.size,
            requestsCount: requestsCount || 0,
        },
        trendData,
        topItems,
        usageByLocation,
        stockHistory: formattedHistory,
    };
}
