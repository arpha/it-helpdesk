"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ServerRoomLog, ServerRoomLogFilterParams } from "@/types/server-logbook";

export async function checkInServerRoom(data: {
    visitor_name: string;
    visitor_type: string;
    company_or_unit?: string;
    purpose: string;
    temperature?: number;
    notes?: string;
}) {
    const supabase = await createClient();

    const insertData = {
        visitor_name: data.visitor_name,
        visitor_type: data.visitor_type,
        company_or_unit: data.company_or_unit || null,
        purpose: data.purpose,
        temperature: data.temperature || null,
        notes: data.notes || null,
        check_in_time: new Date().toISOString(),
        status: "active",
    };

    const { data: log, error } = await supabase
        .from("server_room_logs")
        .insert([insertData])
        .select()
        .single();

    if (error) {
        console.error("Error check-in server room:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/master/server-logbook");
    return { success: true, data: log as ServerRoomLog };
}

export async function checkOutServerRoom(logId: string) {
    const supabase = await createClient();

    const { data: log, error } = await supabase
        .from("server_room_logs")
        .update({
            check_out_time: new Date().toISOString(),
            status: "completed",
        })
        .eq("id", logId)
        .select()
        .single();

    if (error) {
        console.error("Error check-out server room:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/master/server-logbook");
    return { success: true, data: log as ServerRoomLog };
}

export async function getActiveLogById(logId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("server_room_logs")
        .select("*")
        .eq("id", logId)
        .eq("status", "active")
        .single();

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true, data: data as ServerRoomLog };
}

export async function getServerRoomLogs(params?: ServerRoomLogFilterParams) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    let query = supabase
        .from("server_room_logs")
        .select("*", { count: "exact" });

    if (params?.search) {
        query = query.or(`visitor_name.ilike.%${params.search}%,company_or_unit.ilike.%${params.search}%,purpose.ilike.%${params.search}%`);
    }

    if (params?.visitor_type && params.visitor_type !== "all") {
        query = query.eq("visitor_type", params.visitor_type);
    }

    if (params?.status && params.status !== "all") {
        query = query.eq("status", params.status);
    }

    if (params?.startDate) {
        query = query.gte("check_in_time", params.startDate);
    }

    if (params?.endDate) {
        query = query.lte("check_in_time", params.endDate);
    }

    const { data, count, error } = await query
        .order("check_in_time", { ascending: false })
        .range(start, end);

    if (error) {
        console.error("Error fetching server room logs:", error);
        return { success: false, error: error.message };
    }

    return {
        success: true,
        data: (data || []) as ServerRoomLog[],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
    };
}

export async function getServerRoomStats() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    try {
        // 1. Get current active visitors count (any time)
        const { count: activeCount, error: activeErr } = await supabase
            .from("server_room_logs")
            .select("*", { count: "exact", head: true })
            .eq("status", "active");

        if (activeErr) throw activeErr;

        // 2. Get today's logs for today count
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayISO = startOfToday.toISOString();

        const { data: todayLogs, error: todayErr } = await supabase
            .from("server_room_logs")
            .select("temperature")
            .gte("check_in_time", startOfTodayISO);

        if (todayErr) throw todayErr;

        const todayCount = todayLogs?.length || 0;

        // 3. Get monthly logs for average temperature
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const startOfMonthISO = startOfMonth.toISOString();

        const { data: monthlyLogs, error: monthlyErr } = await supabase
            .from("server_room_logs")
            .select("temperature")
            .gte("check_in_time", startOfMonthISO);

        if (monthlyErr) throw monthlyErr;

        // Calculate average temperature of this month
        const temps = monthlyLogs
            ?.filter(l => l.temperature !== null && l.temperature !== undefined)
            .map(l => l.temperature as number) || [];

        const avgTemp = temps.length > 0
            ? temps.reduce((acc, curr) => acc + curr, 0) / temps.length
            : null;

        return {
            success: true,
            data: {
                activeCount: activeCount || 0,
                todayCount,
                avgTemp
            }
        };
    } catch (error: any) {
        console.error("Error getting server room stats:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteServerRoomLog(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const { error } = await supabase
        .from("server_room_logs")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting log:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/master/server-logbook");
    return { success: true };
}

export async function addManualServerRoomLog(data: {
    visitor_name: string;
    visitor_type: string;
    company_or_unit?: string;
    purpose: string;
    temperature?: number;
    check_in_time: string;
    check_out_time?: string;
    notes?: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const status = data.check_out_time ? "completed" : "active";

    const insertData = {
        visitor_name: data.visitor_name,
        visitor_type: data.visitor_type,
        company_or_unit: data.company_or_unit || null,
        purpose: data.purpose,
        temperature: data.temperature || null,
        check_in_time: data.check_in_time,
        check_out_time: data.check_out_time || null,
        status: status,
        notes: data.notes || null,
    };

    const { data: log, error } = await supabase
        .from("server_room_logs")
        .insert([insertData])
        .select()
        .single();

    if (error) {
        console.error("Error adding manual log:", error);
        return { success: false, error: error.message };
    }

    revalidatePath("/master/server-logbook");
    return { success: true, data: log as ServerRoomLog };
}
