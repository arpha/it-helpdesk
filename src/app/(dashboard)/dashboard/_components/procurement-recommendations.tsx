"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, DollarSign, Package, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { DecisionDashboardData } from "../actions";

interface ProcurementProps {
    data: DecisionDashboardData["procurement"];
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(amount);
}

export default function ProcurementRecommendations({ data }: ProcurementProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">
                        Logistik ATK & Proyeksi Anggaran Pengadaan
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Estimasi belanja kebutuhan restock otomatis untuk mencegah kekosongan barang
                    </p>
                </div>
                <Link href="/atk/purchase" className="text-xs text-primary font-medium hover:underline">
                    Buat Pengajuan PO →
                </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                {/* Financial Summary Box */}
                <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-primary" />
                            Estimasi Anggaran Restock ATK
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Kebutuhan biaya untuk mengembalikan stok ke batas aman
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <span className="text-3xl font-extrabold text-foreground tracking-tight">
                                {formatCurrency(data.totalEstimatedBudget)}
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">
                                Berdasarkan {data.criticalReorderItems.length} item prioritas yang di bawah batas minimum
                            </p>
                        </div>

                        <div className="p-3 rounded-lg bg-card border text-xs space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Formula Pengadaan:</span>
                                <span className="font-mono font-medium">2× Min Stok - Sisa</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Item Terdaftar:</span>
                                <span className="font-semibold">{data.totalItems} Barang</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-1">
                            <Link
                                href="/atk/purchase"
                                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                            >
                                <ShoppingCart className="h-3.5 w-3.5" />
                                Proses Permintaan Pembelian (PO)
                            </Link>
                            <Link
                                href="/atk/stock-opname"
                                className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Verifikasi Fisik di Stock Opname <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Priority Reorder Table */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Package className="h-4 w-4 text-primary" />
                                    Daftar Barang Prioritas Restock Kritis
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Diurutkan dari barang yang sudah habis total (0) dan paling mendekati batas kritis
                                </CardDescription>
                            </div>
                            <Link href="/atk/items" className="text-xs text-primary hover:underline">
                                Semua Barang →
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {data.criticalReorderItems.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6">
                                Semua stok ATK dan sparepart berada dalam kondisi aman.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b text-muted-foreground text-left">
                                            <th className="pb-2 font-medium">Nama Barang</th>
                                            <th className="pb-2 font-medium text-center">Sisa Stok</th>
                                            <th className="pb-2 font-medium text-center">Batas Min</th>
                                            <th className="pb-2 font-medium text-center">Saran Beli</th>
                                            <th className="pb-2 font-medium text-right">Est. Biaya</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {data.criticalReorderItems.map((item) => (
                                            <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="py-2.5 pr-2 font-medium truncate max-w-[200px]">
                                                    <div className="flex items-center gap-2">
                                                        {item.urgency === "critical" && (
                                                            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                                        )}
                                                        <span className="truncate">{item.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 text-center font-bold font-mono">
                                                    {item.stock_quantity === 0 ? (
                                                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                                            HABIS (0)
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-amber-600 dark:text-amber-400">
                                                            {item.stock_quantity} {item.unit}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 text-center text-muted-foreground">
                                                    {item.min_stock} {item.unit}
                                                </td>
                                                <td className="py-2.5 text-center font-semibold text-primary">
                                                    +{item.suggestedQty} {item.unit}
                                                </td>
                                                <td className="py-2.5 text-right font-mono text-foreground font-semibold">
                                                    {formatCurrency(item.estimatedCost)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
