import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import ReportsClient from "./_components/reports-client";

export const metadata = {
    title: "Ticket Reports | SI-Mantap",
};

export default function TicketReportsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        }>
            <ReportsClient />
        </Suspense>
    );
}
