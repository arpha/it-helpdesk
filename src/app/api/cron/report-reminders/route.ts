import { NextRequest, NextResponse } from "next/server";
import { processReportDeadlineReminders } from "@/lib/reports/deadline-reminder";
import { generateScheduledReports } from "@/lib/reports/schedule-generator";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_API_KEY;
    // Jika secret belum dikonfigurasi, izinkan (untuk local dev)
    if (!cronSecret) return true;

    const authHeader = request.headers.get("authorization");
    return authHeader === `Bearer ${cronSecret}`;
}

async function runDailyJobs(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";

    // 1. Auto-generate laporan rutin (Bulanan, Triwulanan, Tahunan) yang masuk jendela H-N
    const scheduleGeneration = dryRun
        ? null
        : await generateScheduledReports();

    // 2. Kirim notifikasi WA pengingat deadline (H-7, H-3, dan 1x Overdue)
    const reminders = await processReportDeadlineReminders({ dryRun });

    const overallSuccess =
        reminders.success && (scheduleGeneration ? scheduleGeneration.success : true);

    return NextResponse.json(
        {
            success: overallSuccess,
            scheduleGeneration,
            reminders,
        },
        { status: overallSuccess ? 200 : 500 }
    );
}

export async function GET(request: NextRequest) {
    return runDailyJobs(request);
}

export async function POST(request: NextRequest) {
    return runDailyJobs(request);
}
