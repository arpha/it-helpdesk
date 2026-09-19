"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Activity,
    CheckCircle2,
    Clock,
    Flame,
    Layers,
    ShieldCheck,
    Ticket,
    TrendingUp,
    Wrench,
} from "lucide-react";
import Link from "next/link";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";
import { DecisionDashboardData, SLA_CONFIG } from "../types";

const CATEGORY_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

interface HelpdeskInsightsProps {
    data: DecisionDashboardData["helpdesk"];
}

export default function HelpdeskInsights({ data }: HelpdeskInsightsProps) {
    const totalActive = data.openTickets + data.inProgressTickets;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">
                        Kinerja Helpdesk & Analisis Gangguan
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Evaluasi kecepatan respon, kepatuhan SLA, dan pola kendala berulang
                    </p>
                </div>
                <Link href="/tickets/reports" className="text-xs text-primary font-medium hover:underline">
                    Laporan Lengkap Tiket →
                </Link>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Tiket Aktif</CardTitle>
                        <Ticket className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalActive}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {data.openTickets} menunggu, {data.inProgressTickets} sedang diproses
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Rata-Rata Waktu Selesai (MTTR)</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {data.mttrHours} <span className="text-xs font-normal text-muted-foreground">Jam</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Rata-rata kecepatan penyelesaian 30 hari terakhir
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Kepatuhan SLA</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                {data.slaComplianceRate}%
                            </span>
                            <span className="text-xs text-muted-foreground">tepat waktu</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                            <div
                                className="bg-emerald-500 h-full rounded-full transition-all"
                                style={{ width: `${data.slaComplianceRate}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Selesai Hari Ini</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{data.resolvedToday}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Tiket berhasil diselesaikan per hari ini
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts & Breakdown */}
            <div className="grid gap-4 lg:grid-cols-7">
                {/* 14-Day Trend Chart */}
                <Card className="lg:col-span-4">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Tren Volume Tiket (14 Hari Terakhir)
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Perbandingan tiket baru masuk vs tiket yang berhasil diselesaikan teknisi
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[240px] w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            borderColor: "hsl(var(--border))",
                                            borderRadius: "8px",
                                            fontSize: "12px",
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="created"
                                        name="Tiket Masuk"
                                        stroke="#3b82f6"
                                        fillOpacity={1}
                                        fill="url(#colorCreated)"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="resolved"
                                        name="Tiket Selesai"
                                        stroke="#10b981"
                                        fillOpacity={1}
                                        fill="url(#colorResolved)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Category Pareto Breakdown */}
                <Card className="lg:col-span-3">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Layers className="h-4 w-4 text-primary" />
                            Kategori Gangguan Terbanyak
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Akar masalah utama yang paling sering dilaporkan
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="h-[150px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.categoryBreakdown} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                                    <XAxis type="number" tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                                    <Tooltip
                                        formatter={(val) => [`${val} Tiket`, "Jumlah"]}
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            borderColor: "hsl(var(--border))",
                                            borderRadius: "8px",
                                            fontSize: "12px",
                                        }}
                                    />
                                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                        {data.categoryBreakdown.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Breakdown Legend with % */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                            {data.categoryBreakdown.map((cat, idx) => (
                                <div key={cat.name} className="flex items-center justify-between p-1.5 rounded bg-muted/40">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                                        />
                                        <span className="truncate">{cat.name}</span>
                                    </div>
                                    <span className="font-semibold ml-1">{cat.percentage}%</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Active Tickets List with SLA countdown */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Flame className="h-4 w-4 text-orange-500" />
                                Tiket Aktif & Batas Waktu SLA
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Memantau sisa waktu penanganan sebelum jatuh tempo
                            </CardDescription>
                        </div>
                        <Link href="/tickets" className="text-xs text-primary font-medium hover:underline">
                            Kelola Semua Tiket →
                        </Link>
                    </div>
                </CardHeader>
                <CardContent>
                    {data.recentTickets.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Tidak ada tiket aktif saat ini.</p>
                    ) : (
                        <div className="space-y-2">
                            {data.recentTickets.map(ticket => {
                                const isUrgent = ticket.isOverdue;
                                return (
                                    <Link
                                        key={ticket.id}
                                        href={`/tickets/${ticket.id}`}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-foreground truncate max-w-[280px] sm:max-w-md">
                                                    {ticket.title}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground capitalize">
                                                    Kategori: {ticket.category}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Badge
                                                variant="outline"
                                                className={`text-[11px] uppercase ${
                                                    ticket.priority === "urgent"
                                                        ? "text-red-600 border-red-500/30"
                                                        : ticket.priority === "high"
                                                        ? "text-orange-600 border-orange-500/30"
                                                        : "text-muted-foreground"
                                                }`}
                                            >
                                                {ticket.priority}
                                            </Badge>

                                            {ticket.isOverdue ? (
                                                <Badge variant="destructive" className="text-[11px] font-mono">
                                                    Terlewat SLA ({ticket.remainingHours}h)
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                                                >
                                                    Sisa {ticket.remainingHours} Jam
                                                </Badge>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
