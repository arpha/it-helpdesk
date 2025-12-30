"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, TrendingUp, Package, AlertTriangle, DollarSign, Activity, Clock } from "lucide-react";
import { useEffect, useRef, useTransition } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type HealthData = {
    summary: {
        healthy: number;
        slow: number;
        dead: number;
        unknown: number;
        total: number;
        totalValue: number;
        deadStockValue: number;
        lowStockCount: number;
    };
    slowMovingItems: {
        id: string;
        name: string;
        stock: number;
        value: number;
        days_since_last_out: number;
    }[];
    alerts: {
        type: "warning" | "danger";
        message: string;
        item_name: string;
    }[];
};

async function fetchHealthData(): Promise<HealthData> {
    const res = await fetch("/api/ai/inventory-health");
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
}

export default function HealthDashboardClient() {
    const { data: healthData, isLoading, refetch } = useQuery({
        queryKey: ["inventory-health"],
        queryFn: fetchHealthData,
    });
    const [isPending, startTransition] = useTransition();

    // Auto-refresh on mount
    const hasRefreshed = useRef(false);
    useEffect(() => {
        if (!hasRefreshed.current) {
            hasRefreshed.current = true;
            fetch("/api/ai/analyze-inventory", { method: "POST" })
                .then(() => refetch())
                .catch(console.error);
        }
    }, [refetch]);

    const runAnalysis = () => {
        startTransition(async () => {
            await fetch("/api/ai/analyze-inventory", { method: "POST" });
            refetch();
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const pieData = [
        { name: "Healthy", value: healthData?.summary.healthy || 0, color: "#22c55e" },
        { name: "Slow", value: healthData?.summary.slow || 0, color: "#eab308" },
        { name: "Dead", value: healthData?.summary.dead || 0, color: "#ef4444" },
    ].filter(d => d.value > 0);

    const barData = healthData?.slowMovingItems.slice(0, 10).map(item => ({
        name: item.name.length > 15 ? item.name.substring(0, 15) + "..." : item.name,
        days: item.days_since_last_out,
        value: item.value,
    })) || [];

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <Activity className="h-5 w-5 sm:h-6 sm:w-6" />
                        Inventory Health
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">Overview of inventory health status</p>
                </div>
                <Button onClick={runAnalysis} disabled={isPending} className="gap-2 w-full sm:w-auto">
                    <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                    {isPending ? "Analyzing..." : "Refresh Analysis"}
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            Total Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <p className="text-2xl sm:text-3xl font-bold">{healthData?.summary.total || 0}</p>
                        <p className="text-xs text-muted-foreground">Active items</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            Inventory Value
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <p className="text-xl sm:text-2xl font-bold">{formatCurrency(healthData?.summary.totalValue || 0)}</p>
                        <p className="text-xs text-muted-foreground">Total stock value</p>
                    </CardContent>
                </Card>
                <Card className="border-red-500/50">
                    <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <Clock className="h-4 w-4 text-red-500" />
                            Dead Stock Value
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <p className="text-xl sm:text-2xl font-bold text-red-500">{formatCurrency(healthData?.summary.deadStockValue || 0)}</p>
                        <p className="text-xs text-muted-foreground">Not moving &gt;90 days</p>
                    </CardContent>
                </Card>
                <Card className="border-orange-500/50">
                    <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            Low Stock
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <p className="text-2xl sm:text-3xl font-bold text-orange-500">{healthData?.summary.lowStockCount || 0}</p>
                        <p className="text-xs text-muted-foreground">Below min stock</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                {/* Health Distribution Pie Chart */}
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">Health Distribution</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Items by health status</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                                No health data available
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Slow Moving Items Bar Chart */}
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">Top Slow-Moving Items</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Days since last usage</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        {barData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 10 }}>
                                    <XAxis type="number" tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} />
                                    <Tooltip formatter={(value) => [`${value} days`, "Days Idle"]} />
                                    <Bar dataKey="days" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                                No slow-moving items
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Alerts Section */}
            {healthData?.alerts && healthData.alerts.length > 0 && (
                <Card className="border-orange-500/30">
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg text-orange-600">⚠️ Alerts</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Issues requiring attention</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="space-y-2">
                            {healthData.alerts.map((alert, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-start gap-3 p-3 rounded-lg ${alert.type === "danger" ? "bg-red-500/10" : "bg-orange-500/10"
                                        }`}
                                >
                                    <AlertTriangle className={`h-4 w-4 mt-0.5 ${alert.type === "danger" ? "text-red-500" : "text-orange-500"
                                        }`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">{alert.item_name}</p>
                                        <p className="text-xs text-muted-foreground">{alert.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Health Status Legend */}
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">Health Status Guide</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                        <div className="flex items-start gap-3">
                            <Badge className="bg-green-500">🟢 Healthy</Badge>
                            <p className="text-xs text-muted-foreground">Used within 7 days - Active item</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <Badge className="bg-yellow-500">🟡 Slow</Badge>
                            <p className="text-xs text-muted-foreground">8-90 days no usage - Monitor closely</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <Badge className="bg-red-500">🔴 Dead</Badge>
                            <p className="text-xs text-muted-foreground">&gt;90 days no usage - Consider action</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
