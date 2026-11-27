"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileStack, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ReportStats } from "@/types/report";

interface ReportStatsCardsProps {
    stats?: ReportStats;
    isLoading?: boolean;
    onFilterClick?: (filter: "all" | "pending" | "overdue" | "approved") => void;
}

export function ReportStatsCards({
    stats,
    isLoading,
    onFilterClick,
}: ReportStatsCardsProps) {
    const cards = [
        {
            key: "all" as const,
            title: "Total Laporan",
            value: stats?.total ?? 0,
            subtitle: "Semua laporan terinventarisir",
            icon: FileStack,
            iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
            borderHover: "hover:border-blue-500/40",
        },
        {
            key: "pending" as const,
            title: "Belum Selesai",
            value: stats?.pending ?? 0,
            subtitle:
                stats && stats.dueSoon > 0
                    ? `${stats.dueSoon} mendekati deadline (≤7 hari)`
                    : "Belum selesai & sedang dikerjakan",
            icon: Clock,
            iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            borderHover: "hover:border-amber-500/40",
        },
        {
            key: "overdue" as const,
            title: "Jatuh Tempo / Terlambat",
            value: stats?.overdue ?? 0,
            subtitle:
                stats && stats.overdue > 0
                    ? "Segera ditindaklanjuti!"
                    : "Tidak ada yang terlambat",
            icon: AlertTriangle,
            iconBg: "bg-red-500/10 text-red-600 dark:text-red-400",
            borderHover: "hover:border-red-500/40",
            highlight: (stats?.overdue ?? 0) > 0,
        },
        {
            key: "approved" as const,
            title: "Selesai / Terarsip",
            value: stats?.approved ?? 0,
            subtitle: "Laporan sudah selesai & terarsip",
            icon: CheckCircle2,
            iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            borderHover: "hover:border-emerald-500/40",
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
                <Card
                    key={card.key}
                    onClick={() => onFilterClick?.(card.key)}
                    className={`transition-all ${
                        onFilterClick ? "cursor-pointer hover:shadow-md" : ""
                    } ${card.borderHover} ${
                        card.highlight ? "border-red-500/40 bg-red-500/[0.02]" : ""
                    }`}
                >
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">
                                {card.title}
                            </p>
                            {isLoading ? (
                                <Skeleton className="h-8 w-16" />
                            ) : (
                                <p className="text-2xl font-bold tracking-tight">
                                    {card.value}
                                </p>
                            )}
                            <p
                                className={`text-[11px] truncate ${
                                    card.highlight
                                        ? "text-red-600 dark:text-red-400 font-medium"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {card.subtitle}
                            </p>
                        </div>
                        <div className={`p-2.5 rounded-xl shrink-0 ${card.iconBg}`}>
                            <card.icon className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
