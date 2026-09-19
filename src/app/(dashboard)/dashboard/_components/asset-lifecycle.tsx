"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, Laptop, Monitor, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import { DecisionDashboardData } from "../types";

interface AssetLifecycleProps {
    data: DecisionDashboardData["assets"];
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(amount);
}

export default function AssetLifecycle({ data }: AssetLifecycleProps) {
    const totalCountedAge = data.aging.prime + data.aging.optimal + data.aging.nearEol;
    const nearEolPercent = totalCountedAge > 0 ? Math.round((data.aging.nearEol / totalCountedAge) * 100) : 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">
                        Kesehatan Aset & Perencanaan Investasi IT
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Pertimbangan keputusan penggantian hardware uzur dan kontrol biaya servis
                    </p>
                </div>
                <Link href="/assets" className="text-xs text-primary font-medium hover:underline">
                    Daftar Semua Aset →
                </Link>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                {/* Usia Uzur (Replacement Plan) */}
                <Card className={data.aging.nearEol > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                            Aset Uzur (Usia ≥ 4 Tahun)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                {data.aging.nearEol} Unit
                            </span>
                            <span className="text-xs text-muted-foreground">({nearEolPercent}% dari total)</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Perangkat mendekati / melewati masa pakai ekonomis (risiko downtime tinggi).
                        </p>
                    </CardContent>
                </Card>

                {/* Dalam Perbaikan */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                            Aset Sedang Dalam Perbaikan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                            {data.maintenanceAssets} Unit
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Sedang diservis atau menunggu suku cadang.
                        </p>
                    </CardContent>
                </Card>

                {/* Biaya Servis Bulan Ini */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                            Biaya Pemeliharaan Bulan Ini
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {formatCurrency(data.recentMaintenanceCostThisMonth)}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Realisasi pengeluaran perbaikan & servis bulan ini.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Asset Age Distribution Bar */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-primary" />
                        Peta Distribusi Usia & Siklus Hidup Hardware
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Gambaran kondisi fisik perangkat untuk pengajuan anggaran belanja modal (CAPEX)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Visual Segmented Progress Bar */}
                    <div className="w-full bg-muted rounded-lg h-4 flex overflow-hidden">
                        <div
                            style={{ width: `${totalCountedAge > 0 ? (data.aging.prime / totalCountedAge) * 100 : 33}%` }}
                            className="bg-emerald-500 hover:opacity-90 transition-all"
                            title={`Prima: ${data.aging.prime} unit`}
                        />
                        <div
                            style={{ width: `${totalCountedAge > 0 ? (data.aging.optimal / totalCountedAge) * 100 : 33}%` }}
                            className="bg-blue-500 hover:opacity-90 transition-all"
                            title={`Optimal: ${data.aging.optimal} unit`}
                        />
                        <div
                            style={{ width: `${totalCountedAge > 0 ? (data.aging.nearEol / totalCountedAge) * 100 : 34}%` }}
                            className="bg-amber-500 hover:opacity-90 transition-all"
                            title={`Mendekati Uzur: ${data.aging.nearEol} unit`}
                        />
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                            <div>
                                <span className="font-semibold block">Usia &lt; 2 Tahun (Prima)</span>
                                <span className="text-[11px] text-muted-foreground">{data.aging.prime} unit aktif</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                            <div>
                                <span className="font-semibold block">Usia 2 - 4 Tahun (Optimal)</span>
                                <span className="text-[11px] text-muted-foreground">{data.aging.optimal} unit operasional</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <div className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
                            <div>
                                <span className="font-semibold block text-amber-700 dark:text-amber-400">
                                    Usia ≥ 4 Tahun (Peremajaan)
                                </span>
                                <span className="text-[11px] text-muted-foreground">{data.aging.nearEol} unit butuh evaluasi</span>
                            </div>
                        </div>
                    </div>

                    {data.aging.unknown > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                            💡 <em>Catatan:</em> <strong>{totalCountedAge}</strong> unit terdata siklus usianya ({data.aging.unknown} unit lainnya belum memiliki tanggal perolehan di data master aset).
                        </p>
                    )}

                    {/* At-risk Assets mini table */}
                    {data.atRiskAssets.length > 0 && (
                        <div className="pt-2 border-t space-y-2">
                            <span className="text-xs font-semibold text-foreground">
                                Perangkat Prioritas Evaluasi Penggantian:
                            </span>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {data.atRiskAssets.map(asset => (
                                    <Link
                                        key={asset.id}
                                        href={`/assets`}
                                        className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted border text-xs transition-colors"
                                    >
                                        <div className="truncate mr-2">
                                            <span className="font-medium block truncate">{asset.name}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                {asset.asset_code} {asset.location ? `• ${asset.location}` : ""}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {asset.ageYears >= 4 && (
                                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                                                    {asset.ageYears} Thn
                                                </Badge>
                                            )}
                                            <Badge
                                                variant="secondary"
                                                className={`text-[10px] uppercase ${
                                                    asset.status === "maintenance"
                                                        ? "text-yellow-600 bg-yellow-500/10"
                                                        : "text-muted-foreground"
                                                }`}
                                            >
                                                {asset.status}
                                            </Badge>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
