"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export const SLA_CONFIG: Record<string, { hours: number; label: string; bgBadge: string }> = {
    urgent: { hours: 4, label: "Urgent (Maks 4 Jam)", bgBadge: "bg-red-500/10 text-red-600 border-red-500/20" },
    high: { hours: 8, label: "High (Maks 8 Jam)", bgBadge: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
    medium: { hours: 24, label: "Medium (Maks 24 Jam)", bgBadge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
    low: { hours: 48, label: "Low (Maks 48 Jam)", bgBadge: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
};

export interface OverdueTicket {
    id: string;
    title: string;
    priority: "urgent" | "high" | "medium" | "low";
    status: string;
    category: string;
    created_at: string;
    elapsedHours: number;
    allowedHours: number;
    hoursOverdue: number;
    technicianName: string;
}

export interface ReorderItem {
    id: string;
    name: string;
    unit: string;
    price: number;
    stock_quantity: number;
    min_stock: number;
    suggestedQty: number;
    estimatedCost: number;
    urgency: "critical" | "warning";
}

export interface DecisionDashboardData {
    // 1. Action Center
    actionCenter: {
        overdueCount: number;
        overdueTickets: OverdueTicket[];
        zeroStockCount: number;
        lowStockCount: number;
        pendingApprovalsCount: number;
        pendingRequests: number;
        pendingBorrowings: number;
        pendingDistributions: number;
    };
    // 2. Helpdesk & SLA
    helpdesk: {
        openTickets: number;
        inProgressTickets: number;
        resolvedToday: number;
        mttrHours: number; // Mean time to resolve
        slaComplianceRate: number; // % tickets resolved within SLA
        categoryBreakdown: { name: string; count: number; percentage: number }[];
        dailyTrend: { date: string; created: number; resolved: number }[];
        technicianLoads: { name: string; activeCount: number; resolvedCount: number }[];
        recentTickets: {
            id: string;
            title: string;
            status: string;
            priority: string;
            created_at: string;
            category: string;
            remainingHours: number;
            isOverdue: boolean;
        }[];
    };
    // 3. Asset Intelligence
    assets: {
        totalAssets: number;
        activeAssets: number;
        maintenanceAssets: number;
        damagedAssets: number;
        aging: {
            prime: number; // < 2 years
            optimal: number; // 2 - 4 years
            nearEol: number; // >= 4 years (Replacement plan / uzur)
            unknown: number;
        };
        recentMaintenanceCostThisMonth: number;
        atRiskAssets: {
            id: string;
            name: string;
            asset_code: string;
            ageYears: number;
            status: string;
            condition: string;
            location: string | null;
        }[];
    };
    // 4. ATK & Consumables Procurement
    procurement: {
        totalItems: number;
        totalEstimatedBudget: number;
        criticalReorderItems: ReorderItem[];
    };
}

export async function getDecisionDashboardData(): Promise<DecisionDashboardData> {
    const supabase = createAdminClient();
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run core queries in parallel
    const [
        { data: allActiveTickets },
        { data: resolvedPast30Days },
        { data: createdPast14Days },
        { data: resolvedPast14Days },
        { data: atkItems },
        { count: pendingRequests },
        { count: pendingBorrowings },
        { count: pendingDistributions },
        { data: assetsList },
        { data: maintenanceRecords },
    ] = await Promise.all([
        // Active tickets (open, in_progress)
        supabase
            .from("tickets")
            .select(`
                id,
                title,
                priority,
                status,
                category,
                created_at,
                assigned_to,
                profiles:assigned_to(full_name)
            `)
            .in("status", ["open", "in_progress"])
            .order("created_at", { ascending: true }),

        // Tickets resolved in past 30 days (for MTTR and SLA Compliance calculation)
        supabase
            .from("tickets")
            .select("id, priority, created_at, resolved_at")
            .eq("status", "resolved")
            .gte("resolved_at", thirtyDaysAgo.toISOString()),

        // Created tickets in past 14 days
        supabase
            .from("tickets")
            .select("created_at")
            .gte("created_at", new Date(now.getTime() - 14 * 86400000).toISOString()),

        // Resolved tickets in past 14 days
        supabase
            .from("tickets")
            .select("resolved_at")
            .eq("status", "resolved")
            .gte("resolved_at", new Date(now.getTime() - 14 * 86400000).toISOString()),

        // ATK Items with stock
        supabase
            .from("atk_items")
            .select("id, name, unit, price, stock_quantity, min_stock")
            .order("stock_quantity", { ascending: true }),

        // Pending counts
        supabase.from("atk_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("asset_borrowings").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("asset_distributions").select("*", { count: "exact", head: true }).eq("status", "pending"),

        // Assets list
        supabase
            .from("assets")
            .select("id, name, asset_code, purchase_date, useful_life_years, status, condition, location"),

        // Maintenance records in this month
        supabase
            .from("asset_maintenance")
            .select("cost, performed_at")
            .gte("performed_at", firstDayCurrentMonth.toISOString().split("T")[0]),
    ]);

    // 1. Process SLA & Overdue Tickets
    const overdueTicketsList: OverdueTicket[] = [];
    let openCount = 0;
    let inProgressCount = 0;
    const categoryCounts: Record<string, number> = {
        hardware: 0,
        software: 0,
        network: 0,
        data: 0,
    };
    const technicianLoadMap: Record<string, { active: number; resolved: number }> = {};

    (allActiveTickets || []).forEach(ticket => {
        if (ticket.status === "open") openCount++;
        if (ticket.status === "in_progress") inProgressCount++;

        const cat = (ticket.category || "hardware").toLowerCase();
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

        const techProfile = ticket.profiles as unknown as { full_name?: string } | null;
        const techName = techProfile?.full_name || (ticket.assigned_to ? "Teknisi" : "Belum Ditugaskan");
        if (!technicianLoadMap[techName]) {
            technicianLoadMap[techName] = { active: 0, resolved: 0 };
        }
        technicianLoadMap[techName].active++;

        const createdAt = new Date(ticket.created_at).getTime();
        const elapsedHours = Math.max(0, (now.getTime() - createdAt) / (1000 * 60 * 60));
        const slaLimit = SLA_CONFIG[ticket.priority]?.hours || 24;

        if (elapsedHours > slaLimit) {
            overdueTicketsList.push({
                id: ticket.id,
                title: ticket.title,
                priority: ticket.priority as "urgent" | "high" | "medium" | "low",
                status: ticket.status,
                category: ticket.category,
                created_at: ticket.created_at,
                elapsedHours: Math.round(elapsedHours),
                allowedHours: slaLimit,
                hoursOverdue: Math.round(elapsedHours - slaLimit),
                technicianName: techName,
            });
        }
    });

    // Sort overdue tickets by most hours overdue
    overdueTicketsList.sort((a, b) => b.hoursOverdue - a.hoursOverdue);

    // 2. MTTR & SLA Compliance Rate from resolved past 30 days
    let totalResolutionHours = 0;
    let compliantCount = 0;
    let resolvedTodayCount = 0;
    const resolvedPast30 = resolvedPast30Days || [];

    resolvedPast30.forEach(t => {
        if (!t.resolved_at) return;
        const resTime = new Date(t.resolved_at).getTime();
        const creTime = new Date(t.created_at).getTime();
        const durationHours = Math.max(0, (resTime - creTime) / (1000 * 60 * 60));
        totalResolutionHours += durationHours;

        const slaLimit = SLA_CONFIG[t.priority]?.hours || 24;
        if (durationHours <= slaLimit) {
            compliantCount++;
        }

        if (new Date(t.resolved_at) >= today) {
            resolvedTodayCount++;
        }
    });

    const mttrHours = resolvedPast30.length > 0 ? Number((totalResolutionHours / resolvedPast30.length).toFixed(1)) : 0;
    const slaComplianceRate = resolvedPast30.length > 0 ? Math.round((compliantCount / resolvedPast30.length) * 100) : 100;

    // 3. Category Breakdown for chart
    const totalCatCount = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
    const categoryBreakdown = Object.entries(categoryCounts).map(([cat, count]) => {
        const labels: Record<string, string> = {
            hardware: "Hardware & Perangkat",
            software: "Software & Aplikasi",
            network: "Jaringan & Internet",
            data: "Data & Database",
        };
        return {
            name: labels[cat] || cat,
            count,
            percentage: totalCatCount > 0 ? Math.round((count / totalCatCount) * 100) : 0,
        };
    });

    // 4. 14 Days Ticket Trend
    const dailyTrendMap: Record<string, { created: number; resolved: number }> = {};
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        dailyTrendMap[key] = { created: 0, resolved: 0 };
    }

    (createdPast14Days || []).forEach(t => {
        const key = t.created_at.split("T")[0];
        if (dailyTrendMap[key]) dailyTrendMap[key].created++;
    });

    (resolvedPast14Days || []).forEach(t => {
        if (t.resolved_at) {
            const key = t.resolved_at.split("T")[0];
            if (dailyTrendMap[key]) dailyTrendMap[key].resolved++;
        }
    });

    const dailyTrend = Object.entries(dailyTrendMap).map(([date, counts]) => ({
        date: new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        created: counts.created,
        resolved: counts.resolved,
    }));

    // 5. Recent active tickets with countdown / overdue status
    const recentTickets = (allActiveTickets || []).slice(0, 6).map(ticket => {
        const createdAt = new Date(ticket.created_at).getTime();
        const elapsedHours = (now.getTime() - createdAt) / (1000 * 60 * 60);
        const slaLimit = SLA_CONFIG[ticket.priority]?.hours || 24;
        const remaining = Math.round(slaLimit - elapsedHours);
        return {
            id: ticket.id,
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
            category: ticket.category,
            created_at: ticket.created_at,
            remainingHours: remaining,
            isOverdue: remaining < 0,
        };
    });

    // 6. Assets Aging & Health
    let primeAssets = 0;
    let optimalAssets = 0;
    let nearEolAssets = 0;
    let unknownAge = 0;
    let activeAssetsCount = 0;
    let maintenanceAssetsCount = 0;
    let damagedAssetsCount = 0;
    const atRiskAssetsList: DecisionDashboardData["assets"]["atRiskAssets"] = [];

    const allAssets = assetsList || [];
    allAssets.forEach(asset => {
        if (asset.status === "active") activeAssetsCount++;
        if (asset.status === "maintenance") maintenanceAssetsCount++;
        if (asset.status === "damage" || asset.status === "disposed") damagedAssetsCount++;

        let ageYears = 0;
        if (asset.purchase_date) {
            const pDate = new Date(asset.purchase_date);
            ageYears = (now.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            if (ageYears < 2) {
                primeAssets++;
            } else if (ageYears < 4) {
                optimalAssets++;
            } else {
                nearEolAssets++;
                atRiskAssetsList.push({
                    id: asset.id,
                    name: asset.name,
                    asset_code: asset.asset_code,
                    ageYears: Number(ageYears.toFixed(1)),
                    status: asset.status,
                    condition: asset.condition || "good",
                    location: asset.location,
                });
            }
        } else {
            unknownAge++;
        }

        // Also flag if in maintenance or poor condition regardless of age
        if (asset.status === "maintenance" || asset.condition === "poor") {
            if (!atRiskAssetsList.some(item => item.id === asset.id)) {
                atRiskAssetsList.push({
                    id: asset.id,
                    name: asset.name,
                    asset_code: asset.asset_code,
                    ageYears: Number(ageYears.toFixed(1)),
                    status: asset.status,
                    condition: asset.condition || "good",
                    location: asset.location,
                });
            }
        }
    });

    // Sort at risk assets (oldest and worst condition first)
    atRiskAssetsList.sort((a, b) => b.ageYears - a.ageYears);

    const recentMaintenanceCostThisMonth = (maintenanceRecords || []).reduce(
        (sum, m) => sum + (Number(m.cost) || 0),
        0
    );

    // 7. ATK / Consumables Reorder Recommendations
    const allAtk = atkItems || [];
    let zeroStockCount = 0;
    let lowStockCount = 0;
    let totalEstimatedBudget = 0;
    const criticalReorderItems: ReorderItem[] = [];

    allAtk.forEach(item => {
        const qty = item.stock_quantity ?? 0;
        const min = item.min_stock ?? 5;
        const price = Number(item.price) || 0;

        if (qty === 0) zeroStockCount++;
        if (qty <= min) {
            lowStockCount++;
            const targetStock = min * 2;
            const suggestedQty = Math.max(targetStock - qty, 1);
            const estimatedCost = suggestedQty * price;
            totalEstimatedBudget += estimatedCost;

            criticalReorderItems.push({
                id: item.id,
                name: item.name,
                unit: item.unit,
                price,
                stock_quantity: qty,
                min_stock: min,
                suggestedQty,
                estimatedCost,
                urgency: qty === 0 ? "critical" : "warning",
            });
        }
    });

    // Sort reorders: critical (qty = 0) first, then lowest stock ratio
    criticalReorderItems.sort((a, b) => {
        if (a.stock_quantity === 0 && b.stock_quantity > 0) return -1;
        if (b.stock_quantity === 0 && a.stock_quantity > 0) return 1;
        return a.stock_quantity / (a.min_stock || 1) - b.stock_quantity / (b.min_stock || 1);
    });

    const technicianLoads = Object.entries(technicianLoadMap).map(([name, data]) => ({
        name,
        activeCount: data.active,
        resolvedCount: data.resolved,
    }));

    return {
        actionCenter: {
            overdueCount: overdueTicketsList.length,
            overdueTickets: overdueTicketsList.slice(0, 5),
            zeroStockCount,
            lowStockCount,
            pendingApprovalsCount: (pendingRequests || 0) + (pendingBorrowings || 0) + (pendingDistributions || 0),
            pendingRequests: pendingRequests || 0,
            pendingBorrowings: pendingBorrowings || 0,
            pendingDistributions: pendingDistributions || 0,
        },
        helpdesk: {
            openTickets: openCount,
            inProgressTickets: inProgressCount,
            resolvedToday: resolvedTodayCount,
            mttrHours,
            slaComplianceRate,
            categoryBreakdown,
            dailyTrend,
            technicianLoads,
            recentTickets,
        },
        assets: {
            totalAssets: allAssets.length,
            activeAssets: activeAssetsCount,
            maintenanceAssets: maintenanceAssetsCount,
            damagedAssets: damagedAssetsCount,
            aging: {
                prime: primeAssets,
                optimal: optimalAssets,
                nearEol: nearEolAssets,
                unknown: unknownAge,
            },
            recentMaintenanceCostThisMonth,
            atRiskAssets: atRiskAssetsList.slice(0, 6),
        },
        procurement: {
            totalItems: allAtk.length,
            totalEstimatedBudget,
            criticalReorderItems: criticalReorderItems.slice(0, 6),
        },
    };
}
