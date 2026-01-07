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

// ==========================================
// TEXT-TO-SQL FUNCTIONS
// ==========================================

const ALLOWED_TABLES = [
    'assets',
    'tickets',
    'profiles',
    'locations',
    'atk_items',
    'asset_maintenance',
    'asset_categories',
    'atk_requests'
];

/**
 * Get database schema description for AI context
 */
export function getSchemaDescription(): string {
    return `
DATABASE SCHEMA:

1. assets (Daftar Aset IT)
   - id: UUID (primary key)
   - asset_code: VARCHAR (kode aset, contoh: AST-2026-0001)
   - name: VARCHAR (nama aset)
   - serial_number: VARCHAR
   - status: ENUM ('active', 'maintenance', 'damage', 'disposed')
   - category_id: UUID → asset_categories(id)
   - location_id: UUID → locations(id)
   - assigned_to: UUID → profiles(id)
   - purchase_date: DATE
   - created_at: TIMESTAMP

2. asset_categories (Kategori Aset)
   - id: UUID
   - name: VARCHAR (contoh: Laptop, Printer, Komputer, Telepon, Hub, Switch, Monitor, Scanner, Server, CCTV, AC, UPS)
   PENTING: Jika mencari perangkat/aset seperti telepon, hub, switch, dll → query dari tabel assets dengan JOIN asset_categories

3. tickets (Tiket Helpdesk)
   - id: UUID
   - title: VARCHAR
   - description: TEXT
   - category: ENUM ('hardware', 'software', 'network', 'data')
   - priority: ENUM ('low', 'medium', 'high', 'urgent')
   - status: ENUM ('open', 'in_progress', 'resolved', 'closed')
   - created_by: UUID → profiles(id)
   - assigned_to: UUID → profiles(id)
   - created_at: TIMESTAMP
   - resolved_at: TIMESTAMP

4. profiles (User/Staff)
   - id: UUID
   - full_name: VARCHAR
   - email: VARCHAR
   - role: ENUM ('admin', 'staff', 'user')
   - phone: VARCHAR
   - location_id: UUID → locations(id)

5. locations (Lokasi/Ruangan)
   - id: UUID
   - name: VARCHAR (contoh: "Kinanti 3A", "Instalasi Farmasi", "Ruang IT")
   - description: TEXT

6. atk_items (Barang ATK/Habis Pakai)
   - id: UUID
   - name: VARCHAR
   - stock_quantity: INTEGER
   - unit: VARCHAR
   - category: VARCHAR

7. asset_maintenance (Riwayat Perawatan Aset)
   - id: UUID
   - asset_id: UUID → assets(id)
   - type: ENUM ('repair', 'upgrade', 'cleaning', 'inspection')
   - description: TEXT
   - cost: DECIMAL
   - performed_at: DATE
   - performed_by: VARCHAR

CATATAN PENTING:
- Gunakan ILIKE untuk pencarian case-insensitive
- Selalu gunakan LIMIT untuk membatasi hasil
- Untuk JOIN, gunakan nama tabel yang benar
- Format tanggal: 'YYYY-MM-DD'

PANDUAN MEMILIH TABEL:
- atk_items: Untuk barang habis pakai/consumables (stok, ATK, tinta, kertas, keyboard, mouse, sparepart)
  → Jika ada kata "stok", "stock", "barang", "ATK" → gunakan atk_items
- assets: Untuk aset IT tetap (laptop, printer, komputer, monitor, scanner)
  → Jika ada kata "aset", "asset" → gunakan assets
- Jika ragu antara atk_items atau assets, periksa konteks "stok" = atk_items, "aset" = assets

SINONIM WARNA TINTA:
- biru / blue = cyan → gunakan ILIKE '%cyan%'
- merah / red = magenta → gunakan ILIKE '%magenta%'
- kuning / yellow = yellow → gunakan ILIKE '%yellow%'
- hitam / black = hitam → gunakan ILIKE '%hitam%'
`;
}

/**
 * Validate SQL query for safety
 */
export function validateSqlQuery(sql: string): { valid: boolean; error?: string } {
    const upperSql = sql.toUpperCase().trim();

    // Must start with SELECT
    if (!upperSql.startsWith('SELECT')) {
        return { valid: false, error: 'Hanya query SELECT yang diizinkan' };
    }

    // Block dangerous keywords
    const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE'];
    for (const keyword of dangerousKeywords) {
        if (upperSql.includes(keyword)) {
            return { valid: false, error: `Keyword "${keyword}" tidak diizinkan` };
        }
    }

    // Check if uses allowed tables only
    const tablePattern = /FROM\s+([a-zA-Z_]+)/gi;
    const joinPattern = /JOIN\s+([a-zA-Z_]+)/gi;

    const fromMatches = [...sql.matchAll(tablePattern)];
    const joinMatches = [...sql.matchAll(joinPattern)];

    const usedTables = [...fromMatches, ...joinMatches].map(m => m[1].toLowerCase());

    for (const table of usedTables) {
        if (!ALLOWED_TABLES.includes(table)) {
            return { valid: false, error: `Tabel "${table}" tidak diizinkan` };
        }
    }

    // Must have LIMIT (except for COUNT/SUM aggregate queries)
    const isAggregateQuery = upperSql.includes('COUNT(') || upperSql.includes('SUM(') || upperSql.includes('AVG(') || upperSql.includes('MAX(') || upperSql.includes('MIN(');
    if (!upperSql.includes('LIMIT') && !isAggregateQuery) {
        return { valid: false, error: 'Query harus memiliki LIMIT' };
    }

    return { valid: true };
}

/**
 * Execute read-only SQL query
 */
export async function executeReadOnlyQuery(sql: string): Promise<{ data: any[] | null; error: string | null }> {
    // Validate first
    const validation = validateSqlQuery(sql);
    if (!validation.valid) {
        return { data: null, error: validation.error || 'Query tidak valid' };
    }

    try {
        const supabase = createAdminClient();

        // Use Supabase's rpc to execute raw SQL
        // Note: This requires a database function to be created
        // Alternative: Parse SQL and convert to Supabase query builder

        // For now, we'll use the simpler approach of executing via REST API
        const { data, error } = await supabase.rpc('execute_readonly_sql', {
            query_text: sql
        });

        if (error) {
            console.error("SQL Execution Error:", error);
            return { data: null, error: error.message };
        }

        return { data: data || [], error: null };
    } catch (e) {
        console.error("Exception in executeReadOnlyQuery:", e);
        return { data: null, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}
