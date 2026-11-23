import { NextRequest, NextResponse } from "next/server";
import { processReportDeadlineReminders } from "@/lib/reports/deadline-reminder";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_API_KEY;
    // Jika secret belum dikonfigurasi, izinkan (untuk local dev)
    if (!cronSecret) return true;

    const authHeader = request.headers.get("authorization");
    return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";
    const result = await processReportDeadlineReminders({ dryRun });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";
    const result = await processReportDeadlineReminders({ dryRun });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
