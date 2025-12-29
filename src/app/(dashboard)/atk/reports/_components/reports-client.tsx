"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    BarChart3,
    TrendingDown,
    TrendingUp,
    Package,
    ClipboardList,
    DollarSign,
    Loader2,
    FileSpreadsheet,
    Calendar,
} from "lucide-react";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    AreaChart,
    Area,
} from "recharts";
import * as XLSX from "xlsx";
import { getUsageReport } from "../actions";

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
    });
}

// Get first and last day of current month
function getCurrentMonthRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
        startDate: firstDay.toISOString().split("T")[0],
        endDate: lastDay.toISOString().split("T")[0],
    };
}

type ReportData = Awaited<ReturnType<typeof getUsageReport>>;

export default function ReportsClient() {
    const defaultRange = getCurrentMonthRange();
    const [startDate, setStartDate] = useState(defaultRange.startDate);
    const [endDate, setEndDate] = useState(defaultRange.endDate);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const fetchReport = () => {
        startTransition(async () => {
            const data = await getUsageReport({ startDate, endDate });
            setReportData(data);
            setIsInitialLoad(false);
        });
    };

    // Fetch on initial load
    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleExportExcel = () => {
        if (!reportData) return;

        // Summary sheet
        const summaryData = [
            { Metric: "Total Usage (Out)", Value: reportData.summary.totalUsageOut },
            { Metric: "Total Stock In", Value: reportData.summary.totalStockIn },
            { Metric: "Total Cost", Value: formatCurrency(reportData.summary.totalCost) },
            { Metric: "Unique Items", Value: reportData.summary.uniqueItems },
            { Metric: "Total Requests", Value: reportData.summary.requestsCount },
        ];

        // Top items sheet
        const topItemsData = reportData.topItems.map((item, idx) => ({
            No: idx + 1,
            "Item Name": item.name,
            "Total Usage": item.usage,
            "Total Cost": item.cost,
        }));

        // Usage by location sheet
        const locationData = reportData.usageByLocation.map((loc, idx) => ({
            No: idx + 1,
            Location: loc.location,
            "Total Usage": loc.usage,
        }));

        // Stock history sheet
        const historyData = reportData.stockHistory.map((record, idx) => ({
            No: idx + 1,
            Date: new Date(record.created_at).toLocaleDateString("en-US"),
            "Item Name": record.item_name,
            Type: record.type === "in" ? "In" : "Out",
            Quantity: record.quantity,
            Notes: record.notes || "-",
            "By": record.created_by_name || "-",
        }));

        const workbook = XLSX.utils.book_new();

        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

        const topItemsSheet = XLSX.utils.json_to_sheet(topItemsData);
        XLSX.utils.book_append_sheet(workbook, topItemsSheet, "Top Items");

        const locationSheet = XLSX.utils.json_to_sheet(locationData);
        XLSX.utils.book_append_sheet(workbook, locationSheet, "By Location");

        const historySheet = XLSX.utils.json_to_sheet(historyData);
        XLSX.utils.book_append_sheet(workbook, historySheet, "History");

        XLSX.writeFile(workbook, `Usage_Report_${startDate}_${endDate}.xlsx`);
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
                        Usage Reports
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">Usage analysis for Consumable/Sparepart items</p>
                </div>

                {/* Date Range Filter */}
                <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                        <Label htmlFor="startDate" className="text-xs">From</Label>
                        <Input
                            id="startDate"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-[130px] sm:w-36"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="endDate" className="text-xs">To</Label>
                        <Input
                            id="endDate"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-[130px] sm:w-36"
                        />
                    </div>
                    <Button onClick={fetchReport} disabled={isPending} size="sm" className="sm:size-default">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                        <span className="ml-1 sm:ml-2">Apply</span>
                    </Button>
                    <Button variant="outline" onClick={handleExportExcel} disabled={!reportData} size="sm" className="sm:size-default">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span className="ml-1 sm:ml-2 hidden sm:inline">Export</span>
                    </Button>
                </div>
            </div>

            {isPending && !reportData ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : reportData ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                                <CardTitle className="text-xs sm:text-sm font-medium">Total Out</CardTitle>
                                <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                            </CardHeader>
                            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                                <div className="text-lg sm:text-2xl font-bold">{reportData.summary.totalUsageOut.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">units</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                                <CardTitle className="text-xs sm:text-sm font-medium">Total In</CardTitle>
                                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                            </CardHeader>
                            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                                <div className="text-lg sm:text-2xl font-bold">{reportData.summary.totalStockIn.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">units</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                                <CardTitle className="text-xs sm:text-sm font-medium">Total Cost</CardTitle>
                                <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                                <div className="text-lg sm:text-2xl font-bold">{formatCurrency(reportData.summary.totalCost)}</div>
                                <p className="text-xs text-muted-foreground">value</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                                <CardTitle className="text-xs sm:text-sm font-medium">Items</CardTitle>
                                <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                                <div className="text-lg sm:text-2xl font-bold">{reportData.summary.uniqueItems}</div>
                                <p className="text-xs text-muted-foreground">unique</p>
                            </CardContent>
                        </Card>
                        <Card className="col-span-2 sm:col-span-1">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-1 sm:pb-2">
                                <CardTitle className="text-xs sm:text-sm font-medium">Requests</CardTitle>
                                <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                                <div className="text-lg sm:text-2xl font-bold">{reportData.summary.requestsCount}</div>
                                <p className="text-xs text-muted-foreground">total</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Trend Chart */}
                    <Card>
                        <CardHeader className="p-4 sm:p-6">
                            <CardTitle className="text-base sm:text-lg">Stock In vs Out Trend</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">Daily comparison of incoming and outgoing items</CardDescription>
                        </CardHeader>
                        <CardContent className="p-2 sm:p-6 pt-0">
                            {reportData.trendData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <AreaChart data={reportData.trendData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip
                                            labelFormatter={(label) => `Date: ${formatDate(label as string)}`}
                                        />
                                        <Legend />
                                        <Area
                                            type="monotone"
                                            dataKey="stockIn"
                                            name="In"
                                            stroke="#22c55e"
                                            fill="#22c55e"
                                            fillOpacity={0.3}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="usage"
                                            name="Out"
                                            stroke="#ef4444"
                                            fill="#ef4444"
                                            fillOpacity={0.3}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-64 text-muted-foreground">
                                    No data for this period
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Two Column Charts */}
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        {/* Top 10 Items */}
                        <Card>
                            <CardHeader className="p-4 sm:p-6">
                                <CardTitle className="text-base sm:text-lg">Top 10 Most Used Items</CardTitle>
                                <CardDescription className="text-xs sm:text-sm">Items with highest usage</CardDescription>
                            </CardHeader>
                            <CardContent className="p-2 sm:p-6 pt-0">
                                {reportData.topItems.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={reportData.topItems} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" tick={{ fontSize: 10 }} />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                width={80}
                                                tick={{ fontSize: 9 }}
                                            />
                                            <Tooltip />
                                            <Bar dataKey="usage" name="Usage" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-48 sm:h-64 text-muted-foreground text-sm">
                                        No data
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Usage by Location */}
                        <Card>
                            <CardHeader className="p-4 sm:p-6">
                                <CardTitle className="text-base sm:text-lg">Usage by Location</CardTitle>
                                <CardDescription className="text-xs sm:text-sm">Total usage per unit/room</CardDescription>
                            </CardHeader>
                            <CardContent className="p-2 sm:p-6 pt-0">
                                {reportData.usageByLocation.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={reportData.usageByLocation} margin={{ bottom: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="location"
                                                tick={{ fontSize: 9 }}
                                                angle={-45}
                                                textAnchor="end"
                                                interval={0}
                                                height={60}
                                            />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip />
                                            <Bar dataKey="usage" name="Usage" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-48 sm:h-64 text-muted-foreground text-sm">
                                        No completed requests
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recent History Table */}
                    <Card>
                        <CardHeader className="p-4 sm:p-6">
                            <CardTitle className="text-base sm:text-lg">Recent History</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">Last 20 transactions in period</CardDescription>
                        </CardHeader>
                        <CardContent className="p-2 sm:p-6 pt-0">
                            {reportData.stockHistory.length > 0 ? (
                                <div className="overflow-x-auto -mx-2 sm:mx-0">
                                    <table className="w-full text-xs sm:text-sm min-w-[400px]">
                                        <thead className="bg-muted">
                                            <tr>
                                                <th className="text-left p-2 sm:p-3">Date</th>
                                                <th className="text-left p-2 sm:p-3">Item</th>
                                                <th className="text-center p-2 sm:p-3">Type</th>
                                                <th className="text-right p-2 sm:p-3">Qty</th>
                                                <th className="text-left p-2 sm:p-3 hidden sm:table-cell">Notes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportData.stockHistory.slice(0, 20).map((record) => (
                                                <tr key={record.id} className="border-b">
                                                    <td className="p-2 sm:p-3 text-muted-foreground whitespace-nowrap">
                                                        {new Date(record.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                    </td>
                                                    <td className="p-2 sm:p-3 font-medium max-w-[120px] sm:max-w-none truncate">{record.item_name}</td>
                                                    <td className="p-2 sm:p-3 text-center">
                                                        <Badge
                                                            variant="secondary"
                                                            className={
                                                                record.type === "in"
                                                                    ? "bg-green-500/10 text-green-600"
                                                                    : "bg-red-500/10 text-red-600"
                                                            }
                                                        >
                                                            {record.type === "in" ? "In" : "Out"}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-2 sm:p-3 text-right font-medium">{record.quantity}</td>
                                                    <td className="p-2 sm:p-3 text-muted-foreground hidden sm:table-cell">{record.notes || "-"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-32 text-muted-foreground">
                                    No transactions in this period
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                    Click "Apply" to load the report
                </div>
            )}
        </div>
    );
}
