import { Suspense } from "react";
import FingerprintsClient from "./_components/fingerprints-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
    title: "Fingerprint | SI-Mantap",
};

function FingerprintsTableSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="rounded-md border">
                <div className="p-4 space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function FingerprintsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Fingerprint</h1>
                <p className="text-muted-foreground">
                    Kelola data fingerprint pengguna
                </p>
            </div>

            <Suspense fallback={<FingerprintsTableSkeleton />}>
                <FingerprintsClient />
            </Suspense>
        </div>
    );
}
