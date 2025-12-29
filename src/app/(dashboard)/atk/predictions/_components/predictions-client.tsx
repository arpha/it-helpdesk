"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useTransition } from "react";

type Prediction = {
    id: string;
    avg_daily_usage: number;
    days_until_min_stock: number;
    predicted_min_date: string;
    recommendation: string;
    confidence: number;
    calculated_at: string;
    atk_items: {
        name: string;
        stock_quantity: number;
        min_stock: number;
    };
};

async function fetchPredictions(): Promise<Prediction[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("atk_predictions")
        .select(`
            *,
            atk_items(name, stock_quantity, min_stock)
        `)
        .order("days_until_min_stock", { ascending: true });

    if (error) throw error;
    return data as Prediction[];
}

export default function PredictionsClient() {
    const { data: predictions, isLoading, refetch } = useQuery({
        queryKey: ["atk-predictions"],
        queryFn: fetchPredictions,
    });
    const [isPending, startTransition] = useTransition();

    const runPrediction = () => {
        startTransition(async () => {
            await fetch("/api/ai/predict-restock", { method: "POST" });
            refetch();
        });
    };

    const getStatusBadge = (days: number) => {
        if (days <= 14) {
            return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Urgent</Badge>;
        } else if (days <= 28) {
            return <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-500"><Clock className="h-3 w-3" /> Warning</Badge>;
        }
        return <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-500"><CheckCircle className="h-3 w-3" /> Safe</Badge>;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const urgentItems = predictions?.filter(p => p.days_until_min_stock <= 14) || [];
    const warningItems = predictions?.filter(p => p.days_until_min_stock > 14 && p.days_until_min_stock <= 28) || [];
    const safeItems = predictions?.filter(p => p.days_until_min_stock > 28) || [];

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold">AI Stock Prediction</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">Restock prediction analysis based on usage patterns</p>
                </div>
                <Button onClick={runPrediction} disabled={isPending} className="gap-2 w-full sm:w-auto">
                    <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                    <span className="sm:inline">{isPending ? "Calculating..." : "Update Prediction"}</span>
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-3 sm:gap-4 grid-cols-3">
                <Card className="border-destructive/50">
                    <CardHeader className="p-3 sm:pb-2 sm:p-6">
                        <CardTitle className="text-sm sm:text-lg flex items-center gap-1 sm:gap-2">
                            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                            <span className="hidden sm:inline">Urgent</span>
                        </CardTitle>
                        <CardDescription className="hidden sm:block">Needs restock immediately (&lt; 14 days)</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <p className="text-xl sm:text-3xl font-bold text-destructive">{urgentItems.length}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">Urgent</p>
                    </CardContent>
                </Card>
                <Card className="border-yellow-500/50">
                    <CardHeader className="p-3 sm:pb-2 sm:p-6">
                        <CardTitle className="text-sm sm:text-lg flex items-center gap-1 sm:gap-2">
                            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                            <span className="hidden sm:inline">Warning</span>
                        </CardTitle>
                        <CardDescription className="hidden sm:block">Needs order in 14-28 days</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <p className="text-xl sm:text-3xl font-bold text-yellow-500">{warningItems.length}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">Warning</p>
                    </CardContent>
                </Card>
                <Card className="border-green-500/50">
                    <CardHeader className="p-3 sm:pb-2 sm:p-6">
                        <CardTitle className="text-sm sm:text-lg flex items-center gap-1 sm:gap-2">
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                            <span className="hidden sm:inline">Safe</span>
                        </CardTitle>
                        <CardDescription className="hidden sm:block">Stock is safe (&gt; 28 days)</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <p className="text-xl sm:text-3xl font-bold text-green-500">{safeItems.length}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">Safe</p>
                    </CardContent>
                </Card>
            </div>

            {/* Predictions List */}
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">Prediction Details</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <div className="space-y-3 sm:space-y-4">
                        {predictions?.length === 0 && (
                            <p className="text-center text-muted-foreground py-8 text-sm">
                                No prediction data yet. Click "Update Prediction" to start analysis.
                            </p>
                        )}
                        {predictions?.map((pred) => (
                            <div
                                key={pred.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg gap-2 sm:gap-4"
                            >
                                <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium text-sm sm:text-base truncate">{pred.atk_items?.name}</p>
                                        {getStatusBadge(pred.days_until_min_stock)}
                                    </div>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                        Stock: {pred.atk_items?.stock_quantity} | Min: {pred.atk_items?.min_stock} |
                                        Usage: {pred.avg_daily_usage.toFixed(1)}/day
                                    </p>
                                </div>
                                <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                                    <p className="font-semibold text-sm sm:text-base">
                                        {pred.days_until_min_stock === 999
                                            ? "∞"
                                            : `${pred.days_until_min_stock} days`}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Predicted: {formatDate(pred.predicted_min_date)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
