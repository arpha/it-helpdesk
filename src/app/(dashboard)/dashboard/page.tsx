import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Ticket, CheckCircle, Building2, Package, AlertTriangle, ClipboardList, TrendingUp } from "lucide-react";
import Link from "next/link";

export const metadata = {
    title: "Dashboard | IT Governance",
};

async function getDashboardStats() {
    const supabase = createAdminClient();

    // Get user count
    const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

    // Get open tickets count
    const { count: openTickets } = await supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]);

    // Get resolved today count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: resolvedToday } = await supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved")
        .gte("resolved_at", today.toISOString());

    // Get locations count
    const { count: locationCount } = await supabase
        .from("locations")
        .select("*", { count: "exact", head: true });

    // Get total ATK items
    const { count: totalItems } = await supabase
        .from("atk_items")
        .select("*", { count: "exact", head: true });

    // Get low stock items (stock <= min_stock)
    const { data: lowStockData } = await supabase
        .from("atk_items")
        .select("id, stock_quantity, min_stock");

    const lowStockCount = (lowStockData || []).filter(item =>
        item.stock_quantity <= (item.min_stock || 0)
    ).length;

    // Get pending requests
    const { count: pendingRequests } = await supabase
        .from("atk_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

    // Get urgent restock (from predictions)
    const { count: urgentRestock } = await supabase
        .from("atk_predictions")
        .select("*", { count: "exact", head: true })
        .lte("days_until_min_stock", 14);

    return {
        userCount: userCount || 0,
        openTickets: openTickets || 0,
        resolvedToday: resolvedToday || 0,
        locationCount: locationCount || 0,
        totalItems: totalItems || 0,
        lowStockCount,
        pendingRequests: pendingRequests || 0,
        urgentRestock: urgentRestock || 0,
    };
}

export default async function DashboardPage() {
    const stats = await getDashboardStats();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                    Welcome to IT Governance
                </p>
            </div>

            {/* IT Governance Stats */}
            <div>
                <h2 className="text-lg font-semibold mb-3">IT Governance</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.userCount}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
                            <Ticket className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.openTickets}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.resolvedToday}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Locations</CardTitle>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.locationCount}</div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Management Stuffs Stats */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Management Stuffs</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalItems}</div>
                            <Link href="/atk/items" className="text-xs text-muted-foreground hover:underline">
                                View all items →
                            </Link>
                        </CardContent>
                    </Card>
                    <Card className={stats.lowStockCount > 0 ? "border-red-500/50" : ""}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
                            <AlertTriangle className={`h-4 w-4 ${stats.lowStockCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${stats.lowStockCount > 0 ? "text-red-500" : ""}`}>
                                {stats.lowStockCount}
                            </div>
                            <p className="text-xs text-muted-foreground">Items below minimum</p>
                        </CardContent>
                    </Card>
                    <Card className={stats.pendingRequests > 0 ? "border-yellow-500/50" : ""}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                            <ClipboardList className={`h-4 w-4 ${stats.pendingRequests > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${stats.pendingRequests > 0 ? "text-yellow-500" : ""}`}>
                                {stats.pendingRequests}
                            </div>
                            <Link href="/atk/requests" className="text-xs text-muted-foreground hover:underline">
                                View requests →
                            </Link>
                        </CardContent>
                    </Card>
                    <Card className={stats.urgentRestock > 0 ? "border-orange-500/50" : ""}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Urgent Restock</CardTitle>
                            <TrendingUp className={`h-4 w-4 ${stats.urgentRestock > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${stats.urgentRestock > 0 ? "text-orange-500" : ""}`}>
                                {stats.urgentRestock}
                            </div>
                            <Link href="/atk/predictions" className="text-xs text-muted-foreground hover:underline">
                                View AI predictions →
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
