"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Package,
    Truck,
    Wrench,
    HandCoins,
    RefreshCcw,
    Loader2,
} from "lucide-react";
import {
    getAssetSummary,
    getDistributionReport,
    getMaintenanceReport,
    getBorrowingReport,
    getRefreshCycleReport,
    AssetSummary,
    DistributionReport,
    MaintenanceReport,
    BorrowingReport,
    RefreshCycleAsset,
} from "../actions";

const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-600",
    maintenance: "bg-yellow-500/10 text-yellow-600",
    damage: "bg-red-500/10 text-red-600",
    disposed: "bg-gray-500/10 text-gray-600",
};

const refreshStatusColors: Record<string, string> = {
    good: "bg-green-500/10 text-green-600",
    warning: "bg-yellow-500/10 text-yellow-600",
    critical: "bg-orange-500/10 text-orange-600",
    expired: "bg-red-500/10 text-red-600",
};

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDate(date: string | null): string {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export default function ReportsClient() {
    const [activeTab, setActiveTab] = useState("summary");
    const [isLoading, setIsLoading] = useState(true);

    // Data states
    const [summary, setSummary] = useState<AssetSummary | null>(null);
    const [distributions, setDistributions] = useState<DistributionReport[]>([]);
    const [maintenances, setMaintenances] = useState<MaintenanceReport[]>([]);
    const [borrowings, setBorrowings] = useState<BorrowingReport[]>([]);
    const [refreshCycle, setRefreshCycle] = useState<RefreshCycleAsset[]>([]);

    // Filters
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    useEffect(() => {
        loadData();
    }, [activeTab, startDate, endDate]);

    async function loadData() {
        setIsLoading(true);
        try {
            switch (activeTab) {
                case "summary":
                    const summaryData = await getAssetSummary();
                    setSummary(summaryData);
                    break;
                case "distribution":
                    const distData = await getDistributionReport(startDate || undefined, endDate || undefined);
                    setDistributions(distData);
                    break;
                case "maintenance":
                    const maintData = await getMaintenanceReport();
                    setMaintenances(maintData);
                    break;
                case "borrowing":
                    const borrowData = await getBorrowingReport();
                    setBorrowings(borrowData);
                    break;
                case "refresh":
                    const refreshData = await getRefreshCycleReport();
                    setRefreshCycle(refreshData);
                    break;
            }
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Asset Reports</h1>
                <p className="text-muted-foreground">Comprehensive reports and analytics for asset management</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="summary" className="flex gap-2">
                        <Package className="h-4 w-4" />
                        <span className="hidden sm:inline">Summary</span>
                    </TabsTrigger>
                    <TabsTrigger value="distribution" className="flex gap-2">
                        <Truck className="h-4 w-4" />
                        <span className="hidden sm:inline">Distribution</span>
                    </TabsTrigger>
                    <TabsTrigger value="maintenance" className="flex gap-2">
                        <Wrench className="h-4 w-4" />
                        <span className="hidden sm:inline">Maintenance</span>
                    </TabsTrigger>
                    <TabsTrigger value="borrowing" className="flex gap-2">
                        <HandCoins className="h-4 w-4" />
                        <span className="hidden sm:inline">Borrowing</span>
                    </TabsTrigger>
                    <TabsTrigger value="refresh" className="flex gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        <span className="hidden sm:inline">Refresh Cycle</span>
                    </TabsTrigger>
                </TabsList>

                {/* Summary Tab */}
                <TabsContent value="summary" className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : summary && (
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Total Assets</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-4xl font-bold">{summary.totalAssets}</div>
                                </CardContent>
                            </Card>

                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>By Status</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {summary.byStatus.map(s => (
                                                <div key={s.status} className="flex justify-between items-center">
                                                    <Badge className={statusColors[s.status] || "bg-gray-500/10"}>
                                                        {s.status}
                                                    </Badge>
                                                    <span className="font-medium">{s.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>By Category</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {summary.byCategory.map(c => (
                                                <div key={c.category} className="flex justify-between items-center">
                                                    <span className="text-sm">{c.category}</span>
                                                    <span className="font-medium">{c.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Top 10 Locations</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {summary.byLocation.map(l => (
                                            <div key={l.location} className="flex justify-between items-center">
                                                <span className="text-sm">{l.location}</span>
                                                <span className="font-medium">{l.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>

                {/* Distribution Tab */}
                <TabsContent value="distribution" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Filter</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4">
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="border-b">
                                            <tr>
                                                <th className="text-left p-4">Document</th>
                                                <th className="text-left p-4">Date</th>
                                                <th className="text-left p-4">Destination</th>
                                                <th className="text-left p-4">Receiver</th>
                                                <th className="text-left p-4">Assets</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {distributions.map(d => (
                                                <tr key={d.id} className="border-b">
                                                    <td className="p-4 font-medium">{d.document_number || "-"}</td>
                                                    <td className="p-4">{formatDate(d.distributed_at)}</td>
                                                    <td className="p-4">{d.destination}</td>
                                                    <td className="p-4">{d.receiver}</td>
                                                    <td className="p-4">
                                                        {d.assets.map(a => a.name).join(", ")}
                                                    </td>
                                                </tr>
                                            ))}
                                            {distributions.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                                                        No distribution records found
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Maintenance Tab */}
                <TabsContent value="maintenance" className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-4 md:grid-cols-3">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Total Maintenance Cost</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {formatCurrency(maintenances.reduce((sum, m) => sum + m.total_cost, 0))}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Assets Maintained</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{maintenances.length}</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Total Records</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {maintenances.reduce((sum, m) => sum + m.maintenance_count, 0)}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Maintenance by Asset</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="border-b">
                                                <tr>
                                                    <th className="text-left p-4">Asset</th>
                                                    <th className="text-left p-4">Code</th>
                                                    <th className="text-right p-4">Count</th>
                                                    <th className="text-right p-4">Total Cost</th>
                                                    <th className="text-left p-4">Last Maintenance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {maintenances.slice(0, 20).map(m => (
                                                    <tr key={m.asset_id} className="border-b">
                                                        <td className="p-4 font-medium">{m.asset_name}</td>
                                                        <td className="p-4 text-muted-foreground">{m.asset_code}</td>
                                                        <td className="p-4 text-right">{m.maintenance_count}</td>
                                                        <td className="p-4 text-right">{formatCurrency(m.total_cost)}</td>
                                                        <td className="p-4">{formatDate(m.last_maintenance)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>

                {/* Borrowing Tab */}
                <TabsContent value="borrowing" className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Total Borrowable Assets</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{borrowings.length}</div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Currently On-Loan</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-yellow-600">
                                            {borrowings.filter(b => b.current_status === "borrowed").length}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Borrowing Statistics by Asset</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="border-b">
                                                <tr>
                                                    <th className="text-left p-4">Asset</th>
                                                    <th className="text-left p-4">Code</th>
                                                    <th className="text-right p-4">Times Borrowed</th>
                                                    <th className="text-right p-4">Avg Duration</th>
                                                    <th className="text-left p-4">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {borrowings.slice(0, 20).map(b => (
                                                    <tr key={b.asset_id} className="border-b">
                                                        <td className="p-4 font-medium">{b.asset_name}</td>
                                                        <td className="p-4 text-muted-foreground">{b.asset_code}</td>
                                                        <td className="p-4 text-right">{b.borrow_count}</td>
                                                        <td className="p-4 text-right">
                                                            {b.avg_duration_days ? `${b.avg_duration_days} days` : "-"}
                                                        </td>
                                                        <td className="p-4">
                                                            {b.current_status === "borrowed" && (
                                                                <Badge className="bg-yellow-500/10 text-yellow-600">On-Loan</Badge>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>

                {/* Refresh Cycle Tab */}
                <TabsContent value="refresh" className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-4 md:grid-cols-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Expired</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-red-600">
                                            {refreshCycle.filter(a => a.status === "expired").length}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Critical (&lt;90 days)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-orange-600">
                                            {refreshCycle.filter(a => a.status === "critical").length}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Warning (&lt;1 year)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-yellow-600">
                                            {refreshCycle.filter(a => a.status === "warning").length}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Good</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-green-600">
                                            {refreshCycle.filter(a => a.status === "good").length}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Asset Refresh Schedule</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="border-b">
                                                <tr>
                                                    <th className="text-left p-4">Asset</th>
                                                    <th className="text-left p-4">Code</th>
                                                    <th className="text-left p-4">Category</th>
                                                    <th className="text-left p-4">Purchase Date</th>
                                                    <th className="text-right p-4">Life (years)</th>
                                                    <th className="text-right p-4">Days Left</th>
                                                    <th className="text-left p-4">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {refreshCycle.slice(0, 30).map(a => (
                                                    <tr key={a.id} className="border-b">
                                                        <td className="p-4 font-medium">{a.name}</td>
                                                        <td className="p-4 text-muted-foreground">{a.asset_code}</td>
                                                        <td className="p-4">{a.category}</td>
                                                        <td className="p-4">{formatDate(a.purchase_date)}</td>
                                                        <td className="p-4 text-right">{a.useful_life_years}</td>
                                                        <td className="p-4 text-right">
                                                            {a.days_remaining < 0 ? "Expired" : a.days_remaining}
                                                        </td>
                                                        <td className="p-4">
                                                            <Badge className={refreshStatusColors[a.status]}>
                                                                {a.status}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
