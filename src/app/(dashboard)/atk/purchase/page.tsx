import PurchaseClient from "./_components/purchase-client";

export const metadata = {
    title: "Submission | SI-Mantap",
};

export default function ATKPurchasePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Submission</h1>
                <p className="text-muted-foreground">
                    Create submission with Excel export
                </p>
            </div>
            <PurchaseClient />
        </div>
    );
}
