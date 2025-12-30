"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertTriangle, Clock, Calendar, CheckCircle, ShoppingCart } from "lucide-react";
import { useEffect, useRef, useTransition } from "react";

type Recommendation = {
    id: string;
    item_id: string;
    current_stock: number;
    avg_daily_usage: number;
    reorder_point: number;
    suggested_qty: number;
    days_until_reorder: number;
    priority: "urgent" | "soon" | "planned" | "safe";
    estimated_stockout_date: string | null;
    atk_items: {
        id: string;
        name: string;
        stock_quantity: number;
        min_stock: number;
        unit: string;
        price: number;
        type: string;
    };
};

async function fetchRecommendations(): Promise<Recommendation[]> {
    const res = await fetch("/api/ai/reorder-recommendations");
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
}

export default function ReorderClient() {
    const { data: recommendations, isLoading, refetch } = useQuery({
        queryKey: ["reorder-recommendations"],
        queryFn: fetchRecommendations,
    });
    const [isPending, startTransition] = useTransition();

    // Auto-calculate on mount
    const hasCalculated = useRef(false);
    useEffect(() => {
        if (!hasCalculated.current) {
            hasCalculated.current = true;
            fetch("/api/ai/reorder-recommendations", { method: "POST" })
                .then(() => refetch())
                .catch(console.error);
        }
    }, [refetch]);

    const runCalculation = () => {
        startTransition(async () => {
            await fetch("/api/ai/reorder-recommendations", { method: "POST" });
            refetch();
        });
    };

    const getPriorityBadge = (priority: string) => {
        const config = {
            urgent: { label: "Urgent", className: "bg-red-500/10 text-red-600", icon: AlertTriangle },
            soon: { label: "Soon", className: "bg-orange-500/10 text-orange-600", icon: Clock },
            planned: { label: "Planned", className: "bg-blue-500/10 text-blue-600", icon: Calendar },
            safe: { label: "Safe", className: "bg-green-500/10 text-green-600", icon: CheckCircle },
        };
        const c = config[priority as keyof typeof config] || config.safe;
        const Icon = c.icon;
        return (
            <Badge variant="secondary" className={`gap-1 ${c.className}`}>
                <Icon className="h-3 w-3" />
                {c.label}
            </Badge>
        );
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const urgentItems = recommendations?.filter(r => r.priority === "urgent") || [];
    const soonItems = recommendations?.filter(r => r.priority === "soon") || [];
    const plannedItems = recommendations?.filter(r => r.priority === "planned") || [];
    const safeItems = recommendations?.filter(r => r.priority === "safe") || [];

    const needsAction = [...urgentItems, ...soonItems];

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                        Reorder Recommendations
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">Smart reorder suggestions based on usage patterns</p>
                </div>
                <Button onClick={runCalculation} disabled={isPending} className="gap-2 w-full sm:w-auto">
                    <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                    {isPending ? "Calculating..." : "Recalculate"}
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="border-red-500/50">
                    <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Urgent
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <p className="text-2xl sm:text-3xl font-bold text-red-500">{urgentItems.length}</p>
                        <p className="text-xs text-muted-foreground">Need reorder now</p>
                    </CardContent>
                </Card>
                <Card className="border-orange-500/50">
                    <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-500" />
                            Soon
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <p className="text-2xl sm:text-3xl font-bold text-orange-500">{soonItems.length}</p>
                        <p className="text-xs text-muted-foreground">Within 7 days</p>
                    </CardContent>
                </Card>
                <Card className="border-blue-500/50">
                    <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            Planned
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <p className="text-2xl sm:text-3xl font-bold text-blue-500">{plannedItems.length}</p>
                        <p className="text-xs text-muted-foreground">Within 14 days</p>
                    </CardContent>
                </Card>
                <Card className="border-green-500/50">
                    <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Safe
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <p className="text-2xl sm:text-3xl font-bold text-green-500">{safeItems.length}</p>
                        <p className="text-xs text-muted-foreground">Stock sufficient</p>
                    </CardContent>
                </Card>
            </div>

            {/* Action Required */}
            {needsAction.length > 0 && (
                <Card className="border-orange-500/30">
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg text-orange-600">⚠️ Action Required</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Items that need to be reordered soon</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="space-y-3">
                            {needsAction.map((rec) => (
                                <div
                                    key={rec.id}
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg gap-3"
                                >
                                    <div className="space-y-1 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium text-sm sm:text-base">{rec.atk_items?.name}</p>
                                            {getPriorityBadge(rec.priority)}
                                        </div>
                                        <p className="text-xs sm:text-sm text-muted-foreground">
                                            Stock: {rec.current_stock} {rec.atk_items?.unit} |
                                            Reorder Point: {rec.reorder_point} |
                                            Usage: {rec.avg_daily_usage.toFixed(1)}/day
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-left sm:text-right">
                                            <p className="font-semibold text-sm">Order: {rec.suggested_qty} {rec.atk_items?.unit}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Est. {formatCurrency(rec.suggested_qty * (rec.atk_items?.price || 0))}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* All Recommendations */}
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">All Recommendations</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Complete list sorted by urgency</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <div className="space-y-3">
                        {recommendations?.length === 0 && (
                            <p className="text-center text-muted-foreground py-8 text-sm">
                                No recommendations yet. Click "Recalculate" to generate.
                            </p>
                        )}
                        {recommendations?.map((rec) => (
                            <div
                                key={rec.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg gap-2"
                            >
                                <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium text-sm truncate">{rec.atk_items?.name}</p>
                                        {getPriorityBadge(rec.priority)}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Stock: {rec.current_stock} | Point: {rec.reorder_point} |
                                        {rec.days_until_reorder === 999 ? " No usage" : ` ${rec.days_until_reorder}d until reorder`}
                                    </p>
                                </div>
                                <div className="text-left sm:text-right">
                                    <p className="font-semibold text-sm">Suggest: {rec.suggested_qty}</p>
                                    {rec.estimated_stockout_date && (
                                        <p className="text-xs text-muted-foreground">
                                            Empty: {new Date(rec.estimated_stockout_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
