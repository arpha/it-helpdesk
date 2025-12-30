import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage, formatPhoneNumber } from "@/lib/fonnte/client";

const LEAD_TIME_DAYS = 14; // 2 weeks lead time

// Helper to get day of week (0 = Sunday, 6 = Saturday)
function getDayOfWeek(dateStr: string): number {
    return new Date(dateStr).getDay();
}

// Helper to check if date is in last week of month
function isMonthEnd(dateStr: string): boolean {
    const date = new Date(dateStr);
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() >= lastDayOfMonth - 6;
}

// Calculate standard deviation
function calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
}

// Detect trend (increasing, decreasing, stable)
function detectTrend(weeklyData: number[]): { trend: string; percentage: number } {
    if (weeklyData.length < 2) return { trend: "stable", percentage: 0 };

    const firstHalf = weeklyData.slice(0, Math.floor(weeklyData.length / 2));
    const secondHalf = weeklyData.slice(Math.floor(weeklyData.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (firstAvg === 0) return { trend: "stable", percentage: 0 };

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent > 15) return { trend: "increasing", percentage: changePercent };
    if (changePercent < -15) return { trend: "decreasing", percentage: changePercent };
    return { trend: "stable", percentage: changePercent };
}

export async function POST() {
    try {
        const supabase = createAdminClient();

        // Get all ATK items with stock history
        const { data: items, error: itemsError } = await supabase
            .from("atk_items")
            .select("id, name, stock_quantity, min_stock");

        if (itemsError) {
            return NextResponse.json({ error: itemsError.message }, { status: 500 });
        }

        const predictions = [];
        const lowStockItems = [];
        const now = new Date();

        for (const item of items || []) {
            // Get usage history for last 90 days (for better pattern analysis)
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            const { data: history } = await supabase
                .from("atk_stock_history")
                .select("quantity, created_at")
                .eq("item_id", item.id)
                .eq("type", "out")
                .gte("created_at", ninetyDaysAgo.toISOString())
                .order("created_at", { ascending: true });

            // ===== WEEKLY PATTERN ANALYSIS =====
            const dayOfWeekUsage: number[] = [0, 0, 0, 0, 0, 0, 0]; // Sun to Sat
            const dayOfWeekCount: number[] = [0, 0, 0, 0, 0, 0, 0];
            let monthEndUsage = 0;
            let monthEndCount = 0;
            let normalUsage = 0;
            let normalCount = 0;

            // Weekly totals for trend detection
            const weeklyTotals: number[] = [];
            let currentWeek = -1;
            let weekTotal = 0;

            for (const h of history || []) {
                const dayIdx = getDayOfWeek(h.created_at);
                dayOfWeekUsage[dayIdx] += h.quantity;
                dayOfWeekCount[dayIdx]++;

                // Month-end spike detection
                if (isMonthEnd(h.created_at)) {
                    monthEndUsage += h.quantity;
                    monthEndCount++;
                } else {
                    normalUsage += h.quantity;
                    normalCount++;
                }

                // Weekly trend
                const weekNum = Math.floor((now.getTime() - new Date(h.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000));
                if (weekNum !== currentWeek) {
                    if (currentWeek !== -1) weeklyTotals.push(weekTotal);
                    currentWeek = weekNum;
                    weekTotal = h.quantity;
                } else {
                    weekTotal += h.quantity;
                }
            }
            if (weekTotal > 0) weeklyTotals.push(weekTotal);

            // Calculate day-of-week averages
            const dayOfWeekAvg = dayOfWeekUsage.map((total, idx) =>
                dayOfWeekCount[idx] > 0 ? total / dayOfWeekCount[idx] : 0
            );

            // Calculate average daily usage (last 30 days for more accurate recent data)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentHistory = (history || []).filter(h => new Date(h.created_at) >= thirtyDaysAgo);
            const totalUsage30d = recentHistory.reduce((sum, h) => sum + h.quantity, 0);
            const avgDailyUsage = totalUsage30d / 30;

            // ===== TREND DETECTION =====
            const trendInfo = detectTrend(weeklyTotals.reverse()); // reverse to chronological order

            // ===== CONFIDENCE INTERVAL =====
            const dailyUsages = (history || []).reduce((acc: { [key: string]: number }, h) => {
                const dateKey = h.created_at.split("T")[0];
                acc[dateKey] = (acc[dateKey] || 0) + h.quantity;
                return acc;
            }, {});
            const dailyValues = Object.values(dailyUsages);
            const stdDev = calculateStdDev(dailyValues);
            const confidenceMargin = 1.96 * (stdDev / Math.sqrt(dailyValues.length || 1)); // 95% CI
            const usageLowerBound = Math.max(0, avgDailyUsage - confidenceMargin);
            const usageUpperBound = avgDailyUsage + confidenceMargin;

            // ===== MONTH-END SPIKE =====
            const avgMonthEndDaily = monthEndCount > 0 ? monthEndUsage / monthEndCount : 0;
            const avgNormalDaily = normalCount > 0 ? normalUsage / normalCount : 0;
            const monthEndMultiplier = avgNormalDaily > 0 ? avgMonthEndDaily / avgNormalDaily : 1;
            const hasMonthEndSpike = monthEndMultiplier > 1.3; // 30% higher

            // Calculate days until min_stock
            const stockAboveMin = item.stock_quantity - (item.min_stock || 0);
            const daysUntilMin = avgDailyUsage > 0 ? Math.floor(stockAboveMin / avgDailyUsage) : 999;

            // Predict date when stock reaches min_stock
            const predictedDate = new Date();
            predictedDate.setDate(predictedDate.getDate() + daysUntilMin);

            // Generate recommendation with enhanced info
            let recommendation = "";
            let shouldNotify = false;

            if (daysUntilMin <= LEAD_TIME_DAYS) {
                recommendation = `⚠️ URGENT: Need restock now! Stock reaches minimum in ${daysUntilMin} days.`;
                shouldNotify = true;
            } else if (daysUntilMin <= LEAD_TIME_DAYS * 2) {
                recommendation = `📋 Order in ${daysUntilMin - LEAD_TIME_DAYS} days.`;
            } else {
                recommendation = `✅ Stock safe for ${daysUntilMin} days.`;
            }

            // Add trend info to recommendation
            if (trendInfo.trend === "increasing") {
                recommendation += ` 📈 Usage increasing (+${Math.abs(trendInfo.percentage).toFixed(0)}%)`;
            } else if (trendInfo.trend === "decreasing") {
                recommendation += ` 📉 Usage decreasing (${trendInfo.percentage.toFixed(0)}%)`;
            }

            // Add month-end warning
            if (hasMonthEndSpike) {
                recommendation += ` ⚡ Month-end spike detected (${monthEndMultiplier.toFixed(1)}x normal)`;
            }

            // Calculate confidence based on data availability and consistency
            const dataPoints = history?.length || 0;
            const baseConfidence = Math.min(1, dataPoints / 20);
            const consistencyFactor = stdDev > 0 ? Math.max(0.5, 1 - (stdDev / (avgDailyUsage || 1))) : 1;
            const confidence = baseConfidence * consistencyFactor;

            // Upsert prediction with enhanced data
            const peakDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeekAvg.indexOf(Math.max(...dayOfWeekAvg))];

            await supabase
                .from("atk_predictions")
                .upsert({
                    item_id: item.id,
                    avg_daily_usage: avgDailyUsage,
                    days_until_min_stock: daysUntilMin,
                    predicted_min_date: predictedDate.toISOString().split("T")[0],
                    recommendation,
                    confidence,
                    trend: trendInfo.trend,
                    trend_percentage: trendInfo.percentage,
                    peak_day: peakDay,
                    month_end_multiplier: monthEndMultiplier,
                    usage_lower: usageLowerBound,
                    usage_upper: usageUpperBound,
                    calculated_at: new Date().toISOString(),
                }, { onConflict: "item_id" });

            predictions.push({
                item_name: item.name,
                avg_daily_usage: avgDailyUsage.toFixed(2),
                usage_range: `${usageLowerBound.toFixed(1)} - ${usageUpperBound.toFixed(1)}`,
                days_until_min: daysUntilMin,
                trend: trendInfo.trend,
                trend_percentage: trendInfo.percentage.toFixed(1),
                month_end_spike: hasMonthEndSpike ? `${monthEndMultiplier.toFixed(1)}x` : "none",
                peak_day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeekAvg.indexOf(Math.max(...dayOfWeekAvg))],
                confidence: (confidence * 100).toFixed(0) + "%",
                recommendation,
            });

            if (shouldNotify) {
                lowStockItems.push({
                    name: item.name,
                    stock: item.stock_quantity,
                    min_stock: item.min_stock,
                    days_left: daysUntilMin,
                });
            }
        }

        // Send WhatsApp notification to admins if there are low stock items
        if (lowStockItems.length > 0) {
            const { data: admins } = await supabase
                .from("profiles")
                .select("full_name, whatsapp_phone")
                .eq("role", "admin");

            const message = `🚨 *ALERT: Low Stock ATK*\n\n` +
                lowStockItems.map(item =>
                    `• *${item.name}*\n  Stock: ${item.stock} (min: ${item.min_stock})\n  Remaining: ${item.days_left} days`
                ).join("\n\n") +
                `\n\n_Restock now (lead time: ${LEAD_TIME_DAYS} days)_`;

            for (const admin of admins || []) {
                if (admin.whatsapp_phone) {
                    try {
                        await sendWhatsAppMessage({
                            target: formatPhoneNumber(admin.whatsapp_phone),
                            message,
                        });
                    } catch (e) {
                        console.error("Failed to send WA to admin:", e);
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            predictions_count: predictions.length,
            low_stock_count: lowStockItems.length,
            predictions,
        });
    } catch (error) {
        console.error("Prediction error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
