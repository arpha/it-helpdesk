import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import ReportsClient from "./_components/reports-client";

export const metadata = {
    title: "Usage Reports | SI-Mantap",
};

export default function ReportsPage() {
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
