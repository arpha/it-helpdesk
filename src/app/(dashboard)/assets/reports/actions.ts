"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type AssetSummary = {
    totalAssets: number;
    byStatus: { status: string; count: number }[];
    byCategory: { category: string; count: number }[];
    byLocation: { location: string; count: number }[];
};

export type DistributionReport = {
    id: string;
    document_number: string | null;
    distributed_at: string | null;
    destination: string;
    receiver: string;
    assets: { name: string; asset_code: string }[];
};

export type MaintenanceReport = {
    asset_id: string;
    asset_name: string;
    asset_code: string;
    total_cost: number;
    maintenance_count: number;
    last_maintenance: string | null;
};

export type BorrowingReport = {
    asset_id: string;
    asset_name: string;
    asset_code: string;
    borrow_count: number;
    current_status: string | null;
    avg_duration_days: number | null;
};

export type RefreshCycleAsset = {
    id: string;
    name: string;
    asset_code: string;
    category: string;
    purchase_date: string | null;
    useful_life_years: number;
    days_remaining: number;
    status: "good" | "warning" | "critical" | "expired";
};

export async function getAssetSummary(): Promise<AssetSummary> {
    const supabase = createAdminClient();

    // Total assets
    const { count: totalAssets } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true });

    // By status
    const { data: statusData } = await supabase
        .from("assets")
        .select("status");

    const statusCounts = new Map<string, number>();
    statusData?.forEach(a => {
        const s = a.status || "unknown";
        statusCounts.set(s, (statusCounts.get(s) || 0) + 1);
    });
    const byStatus = Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }));

    // By category
    const { data: catData } = await supabase
        .from("assets")
        .select("asset_categories(name)");

    const catCounts = new Map<string, number>();
    catData?.forEach(a => {
        const cat = a.asset_categories as unknown as { name: string } | null;
        const c = cat?.name || "Uncategorized";
        catCounts.set(c, (catCounts.get(c) || 0) + 1);
    });
    const byCategory = Array.from(catCounts.entries()).map(([category, count]) => ({ category, count }));

    // By location
    const { data: locData } = await supabase
        .from("assets")
        .select("locations(name)");

    const locCounts = new Map<string, number>();
    locData?.forEach(a => {
        const loc = a.locations as unknown as { name: string } | null;
        const l = loc?.name || "No Location";
        locCounts.set(l, (locCounts.get(l) || 0) + 1);
    });
    const byLocation = Array.from(locCounts.entries())
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return {
        totalAssets: totalAssets || 0,
        byStatus,
        byCategory,
        byLocation,
    };
}

export async function getDistributionReport(startDate?: string, endDate?: string): Promise<DistributionReport[]> {
    const supabase = createAdminClient();

    let query = supabase
        .from("asset_distributions")
        .select(`
            id,
            document_number,
            distributed_at,
            locations:destination_location_id(name),
            profiles:receiver_id(full_name),
            asset_distribution_items(
                assets(name, asset_code)
            )
        `)
        .eq("status", "completed")
        .order("distributed_at", { ascending: false });

    if (startDate) {
        query = query.gte("distributed_at", startDate);
    }
    if (endDate) {
        query = query.lte("distributed_at", endDate);
    }

    const { data } = await query.limit(100);

    return (data || []).map(d => ({
        id: d.id,
        document_number: d.document_number,
        distributed_at: d.distributed_at,
        destination: (d.locations as unknown as { name: string } | null)?.name || "-",
        receiver: (d.profiles as unknown as { full_name: string } | null)?.full_name || "-",
        assets: ((d.asset_distribution_items || []) as unknown as { assets: { name: string; asset_code: string } | null }[])
            .map(i => i.assets)
            .filter((a): a is { name: string; asset_code: string } => a !== null),
    }));
}

export async function getMaintenanceReport(): Promise<MaintenanceReport[]> {
    const supabase = createAdminClient();

    const { data } = await supabase
        .from("asset_maintenance")
        .select(`
            asset_id,
            cost,
            performed_at,
            assets(name, asset_code)
        `)
        .order("performed_at", { ascending: false });

    // Group by asset
    const assetMap = new Map<string, {
        asset_name: string;
        asset_code: string;
        total_cost: number;
        count: number;
        last_maintenance: string | null;
    }>();

    data?.forEach(m => {
        const asset = m.assets as unknown as { name: string; asset_code: string } | null;
        if (!asset) return;

        const existing = assetMap.get(m.asset_id);
        if (existing) {
            existing.total_cost += m.cost || 0;
            existing.count++;
            if (!existing.last_maintenance || (m.performed_at && m.performed_at > existing.last_maintenance)) {
                existing.last_maintenance = m.performed_at;
            }
        } else {
            assetMap.set(m.asset_id, {
                asset_name: asset.name,
                asset_code: asset.asset_code,
                total_cost: m.cost || 0,
                count: 1,
                last_maintenance: m.performed_at,
            });
        }
    });

    return Array.from(assetMap.entries())
        .map(([asset_id, data]) => ({
            asset_id,
            asset_name: data.asset_name,
            asset_code: data.asset_code,
            total_cost: data.total_cost,
            maintenance_count: data.count,
            last_maintenance: data.last_maintenance,
        }))
        .sort((a, b) => b.total_cost - a.total_cost);
}

export async function getBorrowingReport(): Promise<BorrowingReport[]> {
    const supabase = createAdminClient();

    const { data } = await supabase
        .from("asset_borrowings")
        .select(`
            asset_id,
            status,
            borrow_date,
            return_date,
            actual_return_date,
            assets(name, asset_code)
        `)
        .order("created_at", { ascending: false });

    // Group by asset
    const assetMap = new Map<string, {
        asset_name: string;
        asset_code: string;
        count: number;
        current_status: string | null;
        total_days: number;
        completed_borrows: number;
    }>();

    data?.forEach(b => {
        const asset = b.assets as unknown as { name: string; asset_code: string } | null;
        if (!asset) return;

        const existing = assetMap.get(b.asset_id);
        let duration = 0;
        if (b.actual_return_date && b.borrow_date) {
            duration = Math.ceil((new Date(b.actual_return_date).getTime() - new Date(b.borrow_date).getTime()) / (1000 * 60 * 60 * 24));
        }

        if (existing) {
            existing.count++;
            if (b.status === "borrowed") {
                existing.current_status = "borrowed";
            }
            if (b.status === "returned" && duration > 0) {
                existing.total_days += duration;
                existing.completed_borrows++;
            }
        } else {
            assetMap.set(b.asset_id, {
                asset_name: asset.name,
                asset_code: asset.asset_code,
                count: 1,
                current_status: b.status === "borrowed" ? "borrowed" : null,
                total_days: duration,
                completed_borrows: b.status === "returned" && duration > 0 ? 1 : 0,
            });
        }
    });

    return Array.from(assetMap.entries())
        .map(([asset_id, data]) => ({
            asset_id,
            asset_name: data.asset_name,
            asset_code: data.asset_code,
            borrow_count: data.count,
            current_status: data.current_status,
            avg_duration_days: data.completed_borrows > 0
                ? Math.round(data.total_days / data.completed_borrows)
                : null,
        }))
        .sort((a, b) => b.borrow_count - a.borrow_count);
}

export async function getRefreshCycleReport(): Promise<RefreshCycleAsset[]> {
    const supabase = createAdminClient();

    const { data } = await supabase
        .from("assets")
        .select(`
            id,
            name,
            asset_code,
            purchase_date,
            useful_life_years,
            asset_categories(name)
        `)
        .eq("status", "active")
        .not("purchase_date", "is", null)
        .order("purchase_date", { ascending: true });

    const today = new Date();

    return (data || []).map(a => {
        const purchaseDate = new Date(a.purchase_date!);
        const endOfLife = new Date(purchaseDate);
        endOfLife.setFullYear(endOfLife.getFullYear() + (a.useful_life_years || 5));

        const daysRemaining = Math.ceil((endOfLife.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let status: "good" | "warning" | "critical" | "expired" = "good";
        if (daysRemaining <= 0) status = "expired";
        else if (daysRemaining <= 90) status = "critical";
        else if (daysRemaining <= 365) status = "warning";

        return {
            id: a.id,
            name: a.name,
            asset_code: a.asset_code,
            category: (a.asset_categories as unknown as { name: string } | null)?.name || "Uncategorized",
            purchase_date: a.purchase_date,
            useful_life_years: a.useful_life_years || 5,
            days_remaining: daysRemaining,
            status,
        };
    }).sort((a, b) => a.days_remaining - b.days_remaining);
}
