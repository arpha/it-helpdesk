import { createAdminClient } from "@/lib/supabase/admin";

export async function searchTickets(keyword: string) {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from("tickets")
        .select("title, description, resolution_notes, category, status")
        .eq("status", "resolved")
        .textSearch("title_description", keyword, {
            type: "websearch",
            config: "english"
        })
        .limit(5);

    // Fallback if textSearch not available or no results
    if (!data || data.length === 0) {
        const { data: fallback } = await supabase
            .from("tickets")
            .select("title, description, resolution_notes, category, status")
            .eq("status", "resolved")
            .ilike("title", `%${keyword}%`)
            .limit(5);
        return fallback || [];
    }
    return data;
}

export async function searchAssets(keyword: string) {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from("assets")
        .select(`
            name, 
            code, 
            serial_number, 
            status, 
            specifications,
            location:locations(name),
            assigned_to:profiles(full_name),
            category:asset_categories(name)
        `)
        .or(`name.ilike.%${keyword}%,code.ilike.%${keyword}%,serial_number.ilike.%${keyword}%`) // Simple search first
        .limit(5);

    // If search by name yields no results, try search by category via separate query or just rely on getAssetCount for aggregates
    // But for broad search, we might want to enable deep filtering if needed. 
    // For now, let's keep searchAssets simple to avoid complex OR across joins which can be tricky in Supabase syntax without referenced table.
    // Actually, to filter by category name in searchAssets, we need !inner join.
    // Let's stick to name/code/serial for specific asset search.
    // AND update getAssetCount for the aggregate query which is the main issue.
    return data || [];
}

export async function checkStock(keyword: string) {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from("atk_items")
        .select("name, stock_quantity, unit, category")
        .ilike("name", `%${keyword}%`)
        .limit(5);
    return data || [];
}

export async function searchProfiles(keyword: string) {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from("profiles")
        .select("full_name, email, phone, role, department")
        .ilike("full_name", `%${keyword}%`)
        .limit(5);
    return data || [];
}

export async function searchLocations(keyword: string) {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from("locations")
        .select("name, building, floor, description")
        .ilike("name", `%${keyword}%`)
        .limit(5);
    return data || [];
}

export async function getAssetCount(keyword: string = "") {
    try {
        const supabase = createAdminClient();

        // Diagnostic: Check if key is present (don't log the key itself)
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error("CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in process.env");
            return -1; // Code for missing config
        }

        // Strategy: Fallback to simplest possible query (No relations)
        // This determines if the issue is RLS/Auth or Data Structure
        const { data, error } = await supabase
            .from("assets")
            .select("id, name, asset_code, status");

        if (error) {
            console.error("Supabase Error in getAssetCount:", error);
            return -2; // Code for DB Error
        }

        if (!data) return 0;

        console.log(`[getAssetCount] Fetched ${data.length} raw assets. First item:`, data[0]?.name);

        // If no keyword, return total
        if (!keyword || ["aset", "asset", "barang"].includes(keyword.toLowerCase())) {
            return data.length;
        }

        const lowerKeyword = keyword.toLowerCase();

        // Simple filter (Name/Code only for now to guarantee at least THESE work)
        const filtered = data.filter((asset: any) => {
            return (
                asset.name?.toLowerCase().includes(lowerKeyword) ||
                asset.asset_code?.toLowerCase().includes(lowerKeyword)
            );
        });

        // Note: We temporarily removed Category filter to isolate the "0 result" issue.
        // If this works (returns 94 for total), we know the issue was the Relation.

        return filtered.length;
    } catch (e) {
        console.error("Exception in getAssetCount:", e);
        return -3;
    }
}




export async function getTicketStats() {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from("tickets")
        .select("status");

    const stats = {
        total: data?.length || 0,
        open: data?.filter(t => t.status === "open").length || 0,
        resolved: data?.filter(t => t.status === "resolved").length || 0,
        in_progress: data?.filter(t => t.status === "in_progress").length || 0
    };
    return stats;
}

