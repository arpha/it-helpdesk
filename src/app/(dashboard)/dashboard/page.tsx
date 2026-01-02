import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Ticket,
    CheckCircle,
    Building2,
    Package,
    AlertTriangle,
    ClipboardList,
    TrendingUp,
    Monitor,
    Wrench,
    HandCoins,
    Truck,
    Clock,
    ArrowRight,
} from "lucide-react";
import Link from "next/link";

export const metadata = {
    title: "Dashboard | SI-Mantap",
};

async function getDashboardStats() {
    const supabase = createAdminClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Core stats
    const [
        { count: userCount },
        { count: openTickets },
        { count: inProgressTickets },
        { count: resolvedToday },
        { count: locationCount },
        { count: totalAssets },
        { count: activeAssets },
        { count: maintenanceAssets },
        { count: totalItems },
        { count: pendingRequests },
        { count: pendingBorrowings },
        { count: pendingDistributions },
    ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "resolved").gte("resolved_at", today.toISOString()),
        supabase.from("locations").select("*", { count: "exact", head: true }),
        supabase.from("assets").select("*", { count: "exact", head: true }),
        supabase.from("assets").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("assets").select("*", { count: "exact", head: true }).eq("status", "maintenance"),
        supabase.from("atk_items").select("*", { count: "exact", head: true }),
        supabase.from("atk_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("asset_borrowings").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("asset_distributions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    // Low stock items
    const { data: lowStockData } = await supabase
        .from("atk_items")
        .select("id, stock_quantity, min_stock");
    const lowStockCount = (lowStockData || []).filter(item =>
        item.stock_quantity <= (item.min_stock || 0)
    ).length;

    // Recent tickets
    const { data: recentTickets } = await supabase
        .from("tickets")
        .select("id, title, status, priority, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

    // Recent borrowings
    const { data: recentBorrowings } = await supabase
        .from("asset_borrowings")
        .select("id, status, borrow_date, assets(name)")
        .order("created_at", { ascending: false })
        .limit(5);

    // Urgent restock
    const { count: urgentRestock } = await supabase
        .from("atk_predictions")
        .select("*", { count: "exact", head: true })
        .lte("days_until_min_stock", 14);

    return {
        userCount: userCount || 0,
        openTickets: openTickets || 0,
        inProgressTickets: inProgressTickets || 0,
        resolvedToday: resolvedToday || 0,
        locationCount: locationCount || 0,
        totalAssets: totalAssets || 0,
        activeAssets: activeAssets || 0,
        maintenanceAssets: maintenanceAssets || 0,
        totalItems: totalItems || 0,
        lowStockCount,
        pendingRequests: pendingRequests || 0,
        pendingBorrowings: pendingBorrowings || 0,
        pendingDistributions: pendingDistributions || 0,
        urgentRestock: urgentRestock || 0,
        recentTickets: recentTickets || [],
        recentBorrowings: recentBorrowings || [],
    };
}

const statusColors: Record<string, string> = {
    open: "bg-blue-500/10 text-blue-600",
    in_progress: "bg-yellow-500/10 text-yellow-600",
    resolved: "bg-green-500/10 text-green-600",
    pending: "bg-gray-500/10 text-gray-600",
    borrowed: "bg-orange-500/10 text-orange-600",
    returned: "bg-green-500/10 text-green-600",
};

const priorityColors: Record<string, string> = {
    low: "text-gray-500",
    medium: "text-yellow-500",
    high: "text-orange-500",
    urgent: "text-red-500",
};

function formatDate(date: string) {
    return new Date(date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
    });
}

export default async function DashboardPage() {
    const stats = await getDashboardStats();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                    Selamat datang di SI-Mantap — Sistem Informasi Manajemen Aset & Peralatan
                </p>
            </div>

            {/* Quick Stats - Tickets */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
                        <Ticket className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-500">{stats.openTickets}</div>
                        <p className="text-xs text-muted-foreground">Menunggu diproses</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-yellow-500">{stats.inProgressTickets}</div>
                        <p className="text-xs text-muted-foreground">Sedang dikerjakan</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-500">{stats.resolvedToday}</div>
                        <p className="text-xs text-muted-foreground">Selesai hari ini</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.userCount}</div>
                        <p className="text-xs text-muted-foreground">Pengguna terdaftar</p>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Actions Alert */}
            {(stats.pendingRequests > 0 || stats.pendingBorrowings > 0 || stats.pendingDistributions > 0) && (
                <Card className="border-orange-500/50 bg-orange-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            Perlu Tindakan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4">
                            {stats.pendingRequests > 0 && (
                                <Link href="/atk/requests" className="flex items-center gap-2 text-sm hover:underline">
                                    <ClipboardList className="h-4 w-4" />
                                    <span className="font-medium text-orange-500">{stats.pendingRequests}</span> request ATK pending
                                    <ArrowRight className="h-3 w-3" />
                                </Link>
                            )}
                            {stats.pendingBorrowings > 0 && (
                                <Link href="/assets/borrowing" className="flex items-center gap-2 text-sm hover:underline">
                                    <HandCoins className="h-4 w-4" />
                                    <span className="font-medium text-orange-500">{stats.pendingBorrowings}</span> peminjaman pending
                                    <ArrowRight className="h-3 w-3" />
                                </Link>
                            )}
                            {stats.pendingDistributions > 0 && (
                                <Link href="/assets/distribution" className="flex items-center gap-2 text-sm hover:underline">
                                    <Truck className="h-4 w-4" />
                                    <span className="font-medium text-orange-500">{stats.pendingDistributions}</span> distribusi pending
                                    <ArrowRight className="h-3 w-3" />
                                </Link>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Tickets */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Tiket Terbaru</CardTitle>
                                <CardDescription>5 tiket terakhir yang masuk</CardDescription>
                            </div>
                            <Link href="/tickets" className="text-sm text-primary hover:underline">
                                Lihat semua →
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.recentTickets.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">Tidak ada tiket</p>
                            ) : (
                                stats.recentTickets.map((ticket: { id: string; title: string; status: string; priority: string; created_at: string }) => (
                                    <Link
                                        key={ticket.id}
                                        href={`/tickets/${ticket.id}`}
                                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Ticket className={`h-4 w-4 flex-shrink-0 ${priorityColors[ticket.priority] || "text-muted-foreground"}`} />
                                            <span className="text-sm truncate">{ticket.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs text-muted-foreground">{formatDate(ticket.created_at)}</span>
                                            <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Assets Overview */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Asset Overview</CardTitle>
                                <CardDescription>Status aset saat ini</CardDescription>
                            </div>
                            <Link href="/assets" className="text-sm text-primary hover:underline">
                                Lihat semua →
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                <Monitor className="h-8 w-8 text-muted-foreground" />
                                <div>
                                    <p className="text-2xl font-bold">{stats.totalAssets}</p>
                                    <p className="text-xs text-muted-foreground">Total Assets</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
                                <CheckCircle className="h-8 w-8 text-green-500" />
                                <div>
                                    <p className="text-2xl font-bold text-green-500">{stats.activeAssets}</p>
                                    <p className="text-xs text-muted-foreground">Active</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10">
                                <Wrench className="h-8 w-8 text-yellow-500" />
                                <div>
                                    <p className="text-2xl font-bold text-yellow-500">{stats.maintenanceAssets}</p>
                                    <p className="text-xs text-muted-foreground">Maintenance</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                <Building2 className="h-8 w-8 text-muted-foreground" />
                                <div>
                                    <p className="text-2xl font-bold">{stats.locationCount}</p>
                                    <p className="text-xs text-muted-foreground">Locations</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ATK Stats */}
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
                    <Card className={stats.lowStockCount > 0 ? "border-red-500/50 bg-red-500/5" : ""}>
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
                    <Card className={stats.pendingRequests > 0 ? "border-yellow-500/50 bg-yellow-500/5" : ""}>
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
                    <Card className={stats.urgentRestock > 0 ? "border-orange-500/50 bg-orange-500/5" : ""}>
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
