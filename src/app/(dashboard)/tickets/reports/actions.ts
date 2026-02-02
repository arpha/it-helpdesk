"use server";

import { createAdminClient } from "@/lib/supabase/admin";

type DateRange = {
    startDate: string;
    endDate: string;
};

type TicketReportResult = {
    summary: {
        totalCreated: number;
        totalResolved: number;
        openCount: number; // Created in period and still open/active
        avgResolutionTimeHours: number;
    };
    trendData: {
        date: string;
        created: number;
        resolved: number;
    }[];
    categoryStats: {
        name: string;
        count: number;
    }[];
    statusStats: {
        status: string;
        count: number;
    }[];
    priorityStats: {
        priority: string;
        count: number;
    }[];
    durationStats: {
        range: string;
        count: number;
    }[];
    technicianStats: {
        name: string;
        assigned: number;
        resolved: number;
    }[];
};

export async function getTicketReport(range: DateRange): Promise<TicketReportResult> {
    const supabase = createAdminClient();
    const { startDate, endDate } = range;
    const endDateTime = endDate + "T23:59:59";

    // 1. Fetch Tickets CREATED in range
    const { data: createdTickets } = await supabase
        .from("tickets")
        .select(`
            id,
            created_at,
            category,
            priority,
            status,
            assigned_to,
            profiles:assigned_to(full_name)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDateTime);

    // 2. Fetch Tickets RESOLVED in range
    const { data: resolvedTickets } = await supabase
        .from("tickets")
        .select(`
            id,
            created_at,
            resolved_at,
            resolved_by,
            profiles:resolved_by(full_name)
        `)
        .gte("resolved_at", startDate)
        .lte("resolved_at", endDateTime)
        .not("resolved_at", "is", null);

    // --- Process Summary ---
    const totalCreated = createdTickets?.length || 0;
    const totalResolved = resolvedTickets?.length || 0;
    // Count currently open/in_progress from the CREATED batch
    const openCount = createdTickets?.filter(t => ["open", "in_progress"].includes(t.status)).length || 0;

    // --- Process Duration (from Resolved tickets) ---
    let totalDurationMs = 0;
    const durationBuckets = {
        "< 1 Jam": 0,
        "1 - 4 Jam": 0,
        "4 - 24 Jam": 0,
        "1 - 3 Hari": 0,
        "> 3 Hari": 0,
    };

    resolvedTickets?.forEach(t => {
        if (t.created_at && t.resolved_at) {
            const start = new Date(t.created_at).getTime();
            const end = new Date(t.resolved_at).getTime();
            const duration = end - start;
            totalDurationMs += duration;

            const hours = duration / (1000 * 60 * 60);

            if (hours < 1) durationBuckets["< 1 Jam"]++;
            else if (hours < 4) durationBuckets["1 - 4 Jam"]++;
            else if (hours < 24) durationBuckets["4 - 24 Jam"]++;
            else if (hours < 72) durationBuckets["1 - 3 Hari"]++;
            else durationBuckets["> 3 Hari"]++;
        }
    });

    const avgResolutionTimeHours = totalResolved > 0 ? (totalDurationMs / totalResolved) / (1000 * 60 * 60) : 0;

    const durationStats = Object.entries(durationBuckets).map(([range, count]) => ({
        range,
        count
    }));

    // --- Process Trend ---
    const trendMap = new Map<string, { created: number; resolved: number }>();

    // Fill with created counts
    createdTickets?.forEach(t => {
        const date = t.created_at.split("T")[0];
        if (!trendMap.has(date)) trendMap.set(date, { created: 0, resolved: 0 });
        trendMap.get(date)!.created++;
    });

    // Fill with resolved counts
    resolvedTickets?.forEach(t => {
        const date = t.resolved_at!.split("T")[0];
        if (!trendMap.has(date)) trendMap.set(date, { created: 0, resolved: 0 });
        trendMap.get(date)!.resolved++;
    });

    const trendData = Array.from(trendMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // --- Process Category Stats (from Created) ---
    const catMap = new Map<string, number>();
    createdTickets?.forEach(t => {
        const cat = t.category;
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });
    const categoryStats = Array.from(catMap.entries()).map(([name, count]) => ({ name, count }));

    // --- Process Status Stats (from Created - Current status of tickets created in period) ---
    const statusMap = new Map<string, number>();
    createdTickets?.forEach(t => {
        const status = t.status;
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });
    const statusStats = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

    // --- Process Priority Stats (from Created) ---
    const prioMap = new Map<string, number>();
    createdTickets?.forEach(t => {
        const prio = t.priority;
        prioMap.set(prio, (prioMap.get(prio) || 0) + 1);
    });
    const priorityStats = Array.from(prioMap.entries()).map(([priority, count]) => ({ priority, count }));

    // --- Process Technician Stats ---
    // We combine info: Assigned (from Created tickets) and Resolved (from Resolved tickets)
    // Note: Technician might resolve a ticket created BEFORE the period, but we count it as "Resolved Performance" in this period.
    // For "Assigned", we count tickets created in this period and assigned to them.
    const techMap = new Map<string, { name: string; assigned: number; resolved: number }>();

    createdTickets?.forEach(t => {
        if (t.assigned_to) {
            const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
            const name = (profile as any)?.full_name || "Unknown";

            if (!techMap.has(t.assigned_to)) techMap.set(t.assigned_to, { name, assigned: 0, resolved: 0 });
            techMap.get(t.assigned_to)!.assigned++;
        }
    });

    resolvedTickets?.forEach(t => {
        if (t.resolved_by) {
            const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
            const name = (profile as any)?.full_name || "Unknown";

            if (!techMap.has(t.resolved_by)) techMap.set(t.resolved_by, { name, assigned: 0, resolved: 0 });
            techMap.get(t.resolved_by)!.resolved++;
        }
    });

    const technicianStats = Array.from(techMap.values())
        .sort((a, b) => b.resolved - a.resolved); // Sort by most resolved

    return {
        summary: {
            totalCreated,
            totalResolved,
            openCount,
            avgResolutionTimeHours,
        },
        trendData,
        categoryStats,
        statusStats,
        priorityStats,
        durationStats,
        technicianStats,
    };
}
