export const SLA_CONFIG: Record<string, { hours: number; label: string; bgBadge: string }> = {
    urgent: { hours: 4, label: "Urgent (Maks 4 Jam)", bgBadge: "bg-red-500/10 text-red-600 border-red-500/20" },
    high: { hours: 8, label: "High (Maks 8 Jam)", bgBadge: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
    medium: { hours: 24, label: "Medium (Maks 24 Jam)", bgBadge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
    low: { hours: 48, label: "Low (Maks 48 Jam)", bgBadge: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
};

export interface OverdueTicket {
    id: string;
    title: string;
    priority: "urgent" | "high" | "medium" | "low";
    status: string;
    category: string;
    created_at: string;
    elapsedHours: number;
    allowedHours: number;
    hoursOverdue: number;
    technicianName: string;
}

export interface ReorderItem {
    id: string;
    name: string;
    unit: string;
    price: number;
    stock_quantity: number;
    min_stock: number;
    suggestedQty: number;
    estimatedCost: number;
    urgency: "critical" | "warning";
}

export interface DecisionDashboardData {
    // 1. Action Center
    actionCenter: {
        overdueCount: number;
        overdueTickets: OverdueTicket[];
        zeroStockCount: number;
        lowStockCount: number;
        pendingApprovalsCount: number;
        pendingRequests: number;
        pendingBorrowings: number;
        pendingDistributions: number;
    };
    // 2. Helpdesk & SLA
    helpdesk: {
        openTickets: number;
        inProgressTickets: number;
        resolvedToday: number;
        mttrHours: number;
        slaComplianceRate: number;
        categoryBreakdown: { name: string; count: number; percentage: number }[];
        dailyTrend: { date: string; created: number; resolved: number }[];
        technicianLoads: { name: string; activeCount: number; resolvedCount: number }[];
        recentTickets: {
            id: string;
            title: string;
            status: string;
            priority: string;
            created_at: string;
            category: string;
            remainingHours: number;
            isOverdue: boolean;
        }[];
    };
    // 3. Asset Intelligence
    assets: {
        totalAssets: number;
        activeAssets: number;
        maintenanceAssets: number;
        damagedAssets: number;
        aging: {
            prime: number;
            optimal: number;
            nearEol: number;
            unknown: number;
        };
        recentMaintenanceCostThisMonth: number;
        atRiskAssets: {
            id: string;
            name: string;
            asset_code: string;
            ageYears: number;
            status: string;
            condition: string;
            location: string | null;
        }[];
    };
    // 4. ATK & Consumables Procurement
    procurement: {
        totalItems: number;
        totalEstimatedBudget: number;
        criticalReorderItems: ReorderItem[];
    };
}
