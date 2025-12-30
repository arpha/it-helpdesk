import { Metadata } from "next";
import HealthDashboardClient from "./_components/health-dashboard-client";

export const metadata: Metadata = {
    title: "Inventory Health | IT Governance",
};

export default function HealthPage() {
    return <HealthDashboardClient />;
}
