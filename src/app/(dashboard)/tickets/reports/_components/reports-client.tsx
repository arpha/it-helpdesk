"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    BarChart3,
    TrendingDown,
    TrendingUp,
    Ticket,
    CheckCircle,
    Clock,
    Loader2,
    FileSpreadsheet,
    Calendar,
    Users,
} from "lucide-react";
import {
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
    PieChart,
    Pie,
    Cell,
} from "recharts";
import * as XLSX from "xlsx";
import { getTicketReport } from "../actions";

// Helper functions
function formatDuration(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)} m`;
    if (hours < 24) return `${hours.toFixed(1)} h`;
    return `${(hours / 24).toFixed(1)} d`;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
    });
}

function getCurrentMonthRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
        startDate: firstDay.toISOString().split("T")[0],
        endDate: lastDay.toISOString().split("T")[0],
    };
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#413ea0"];

type ReportData = Awaited<ReturnType<typeof getTicketReport>>;

export default function ReportsClient() {
    const defaultRange = getCurrentMonthRange();
    const [startDate, setStartDate] = useState(defaultRange.startDate);
    const [endDate, setEndDate] = useState(defaultRange.endDate);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isPending, startTransition] = useTransition();

    const fetchReport = () => {
        startTransition(async () => {
            const data = await getTicketReport({ startDate, endDate });
            setReportData(data);
        });
    };

    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleExportExcel = () => {
        if (!reportData) return;

        const summaryData = [
            { Metric: "Total Created", Value: reportData.summary.totalCreated },
            { Metric: "Total Resolved", Value: reportData.summary.totalResolved },
            { Metric: "Open (Active)", Value: reportData.summary.openCount },
            { Metric: "Avg Resolution Time", Value: formatDuration(reportData.summary.avgResolutionTimeHours) },
        ];

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryData), "Summary");
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(reportData.trendData),
            "Trends"
        );
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(reportData.durationStats),
            "Duration Dist"
        );
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(reportData.technicianStats),
            "Technicians"
        );
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(reportData.categoryStats),
            "Categories"
        );

        XLSX.writeFile(workbook, `Ticket_Report_${startDate}_${endDate}.xlsx`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-6 w-6" />
                        Ticket Reports
                    </h1>
                    <p className="text-muted-foreground">Performance and statistics analysis</p>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                        <Label className="text-xs">From</Label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-36"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">To</Label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-36"
                        />
                    </div>
                    <Button onClick={fetchReport} disabled={isPending}>
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                        <span className="ml-2">Apply</span>
                    </Button>
                    <Button variant="outline" onClick={handleExportExcel} disabled={!reportData}>
                        <FileSpreadsheet className="h-4 w-4" />
                        <span className="ml-2">Export</span>
                    </Button>
                </div>
            </div>

            {reportData ? (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Created</CardTitle>
                                <Ticket className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{reportData.summary.totalCreated}</div>
                                <p className="text-xs text-muted-foreground">tickets in period</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Resolved</CardTitle>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{reportData.summary.totalResolved}</div>
                                <p className="text-xs text-muted-foreground">tickets closed</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Open (New)</CardTitle>
                                <TrendingUp className="h-4 w-4 text-orange-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{reportData.summary.openCount}</div>
                                <p className="text-xs text-muted-foreground">still active from period</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
                                <Clock className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatDuration(reportData.summary.avgResolutionTimeHours)}</div>
                                <p className="text-xs text-muted-foreground">average time</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Trend Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Created vs Resolved Trend</CardTitle>
                                <CardDescription>Daily ticket volume</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-0">
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={reportData.trendData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tickFormatter={formatDate} fontSize={12} />
                                        <YAxis fontSize={12} />
                                        <Tooltip labelFormatter={(label) => formatDate(label as string)} />
                                        <Legend />
                                        <Area type="monotone" dataKey="created" name="Created" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                                        <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Duration Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Resolution Time Distribution</CardTitle>
                                <CardDescription>How long it takes to resolve tickets</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-0">
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={reportData.durationStats} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" fontSize={12} />
                                        <YAxis dataKey="range" type="category" width={80} fontSize={12} />
                                        <Tooltip />
                                        <Bar dataKey="count" name="Tickets" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row 2 */}
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>By Category</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={reportData.categoryStats}
                                            dataKey="count"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            fill="#8884d8"
                                            label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                        >
                                            {reportData.categoryStats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>By Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={reportData.statusStats}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="status" fontSize={12} />
                                        <YAxis fontSize={12} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#ffc658" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>By Priority</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={reportData.priorityStats}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="priority" fontSize={12} />
                                        <YAxis fontSize={12} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#ff8042" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Technician Performance */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Technician Performance</CardTitle>
                            <CardDescription>Resolved vs Assigned in period</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={reportData.technicianStats}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" fontSize={12} />
                                    <YAxis fontSize={12} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="resolved" name="Resolved" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="assigned" name="Assigned" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            )}
        </div>
    );
}
