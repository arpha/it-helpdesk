"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Clock, PackageX, User, Wrench } from "lucide-react";
import Link from "next/link";
import { DecisionDashboardData } from "../actions";

interface ActionCenterProps {
    data: DecisionDashboardData["actionCenter"];
}

export default function ActionCenter({ data }: ActionCenterProps) {
    const hasUrgentIssues = data.overdueCount > 0 || data.zeroStockCount > 0 || data.pendingApprovalsCount > 0;

    if (!hasUrgentIssues) {
        return (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                <div className="text-sm">
                    <span className="font-semibold">Semua Layanan Berjalan Lancar: </span>
                    Tidak ada tiket terlambat (*overdue*), tidak ada stok barang yang habis total, dan tidak ada persetujuan tertunda hari ini.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                        Pusat Kendali & Tindakan Cepat (Action Center)
                    </h2>
                </div>
                <span className="text-xs text-muted-foreground">Prioritas keputusan hari ini</span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {/* 1. Tiket Melebihi SLA */}
                <Card className={`transition-all ${data.overdueCount > 0 ? "border-red-500/40 bg-gradient-to-br from-red-500/10 via-background to-background shadow-sm shadow-red-500/5" : ""}`}>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
                                <AlertCircle className="h-4 w-4" />
                                Tiket Melebihi Batas SLA
                            </CardTitle>
                            <Badge variant={data.overdueCount > 0 ? "destructive" : "secondary"}>
                                {data.overdueCount} Tiket
                            </Badge>
                        </div>
                        <CardDescription className="text-xs">
                            Tiket aktif yang melewati batas waktu penyelesaian
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {data.overdueCount === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">Semua tiket masih dalam batas SLA aman.</p>
                        ) : (
                            <div className="space-y-2">
                                {data.overdueTickets.map((ticket) => (
                                    <Link
                                        key={ticket.id}
                                        href={`/tickets/${ticket.id}`}
                                        className="block p-2 rounded-lg bg-card/80 border border-red-500/20 hover:border-red-500/50 hover:bg-accent/40 transition-colors"
                                    >
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-semibold text-foreground truncate max-w-[180px]">
                                                {ticket.title}
                                            </span>
                                            <span className="text-red-600 dark:text-red-400 font-bold">
                                                +{ticket.hoursOverdue} Jam
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {ticket.technicianName}
                                            </span>
                                            <span className="uppercase font-medium text-[10px] px-1.5 py-0.2 rounded bg-muted">
                                                {ticket.priority} (Maks {ticket.allowedHours}h)
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}

                        <Link
                            href="/tickets?status=open,in_progress"
                            className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline pt-1"
                        >
                            Tinjau semua tiket aktif <ArrowRight className="h-3 w-3" />
                        </Link>
                    </CardContent>
                </Card>

                {/* 2. Stok Habis Total */}
                <Card className={`transition-all ${data.zeroStockCount > 0 ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-background to-background shadow-sm shadow-amber-500/5" : ""}`}>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                <PackageX className="h-4 w-4" />
                                Stok ATK/Sparepart Habis Total
                            </CardTitle>
                            <Badge variant={data.zeroStockCount > 0 ? "destructive" : "secondary"}>
                                {data.zeroStockCount} Item
                            </Badge>
                        </div>
                        <CardDescription className="text-xs">
                            Stok berada di angka 0 dan tidak dapat memenuhi permintaan
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-2xl font-bold text-foreground">
                            {data.zeroStockCount}{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                                dari total {data.lowStockCount} item di bawah batas minimum
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Barang yang stoknya 0 berpotensi menghentikan operasional pelayanan unit kerja.
                        </p>

                        <div className="pt-2">
                            <Link
                                href="/atk/items"
                                className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                            >
                                Buka katalog ATK & stok menipis <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Permintaan Menunggu Persetujuan */}
                <Card className={`transition-all ${data.pendingApprovalsCount > 0 ? "border-blue-500/40 bg-gradient-to-br from-blue-500/10 via-background to-background shadow-sm shadow-blue-500/5" : ""}`}>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <Clock className="h-4 w-4" />
                                Menunggu Tindakan / Approval
                            </CardTitle>
                            <Badge variant={data.pendingApprovalsCount > 0 ? "default" : "secondary"}>
                                {data.pendingApprovalsCount} Antrean
                            </Badge>
                        </div>
                        <CardDescription className="text-xs">
                            Pengajuan yang membutuhkan verifikasi manajemen/admin
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2 text-xs">
                            <Link
                                href="/atk/requests"
                                className="flex items-center justify-between p-2 rounded-lg bg-card/80 border border-border hover:border-primary/50 transition-colors"
                            >
                                <span>Permintaan ATK Pegawai</span>
                                <span className="font-bold text-foreground">{data.pendingRequests} Menunggu</span>
                            </Link>
                            <Link
                                href="/assets/borrowing"
                                className="flex items-center justify-between p-2 rounded-lg bg-card/80 border border-border hover:border-primary/50 transition-colors"
                            >
                                <span>Peminjaman Aset / Laptop</span>
                                <span className="font-bold text-foreground">{data.pendingBorrowings} Menunggu</span>
                            </Link>
                            <Link
                                href="/assets/distribution"
                                className="flex items-center justify-between p-2 rounded-lg bg-card/80 border border-border hover:border-primary/50 transition-colors"
                            >
                                <span>Distribusi Aset Baru</span>
                                <span className="font-bold text-foreground">{data.pendingDistributions} Menunggu</span>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
