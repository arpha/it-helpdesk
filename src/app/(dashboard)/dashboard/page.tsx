import { Suspense } from "react";
import { getDecisionDashboardData } from "./actions";
import SlaLegendBanner from "./_components/sla-legend-banner";
import ActionCenter from "./_components/action-center";
import HelpdeskInsights from "./_components/helpdesk-insights";
import AssetLifecycle from "./_components/asset-lifecycle";
import ProcurementRecommendations from "./_components/procurement-recommendations";
import { Loader2 } from "lucide-react";

export const metadata = {
    title: "Executive Dashboard | SI-Mantap",
};

export const revalidate = 0; // Fresh real-time data for decision making

export default async function DashboardPage() {
    const data = await getDecisionDashboardData();

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                        Papan Kendali Eksekutif & Operasional
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Sistem Informasi Manajemen Aset, Peralatan & Dukungan IT (SI-Mantap)
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Sinkronisasi Data Terkini</span>
                </div>
            </div>

            {/* SLA Legend Banner (Panduan Batas Waktu untuk Teknisi) */}
            <SlaLegendBanner />

            {/* 1. Action Center: Tiket Overdue, Stok Habis (0), & Approval */}
            <ActionCenter data={data.actionCenter} />

            {/* 2. Helpdesk Performance & Root Cause Analysis */}
            <HelpdeskInsights data={data.helpdesk} />

            {/* 3. Asset Lifecycle & Capex Replacement Planning */}
            <AssetLifecycle data={data.assets} />

            {/* 4. ATK & Consumables Reorder & Budget Forecast */}
            <ProcurementRecommendations data={data.procurement} />
        </div>
    );
}
