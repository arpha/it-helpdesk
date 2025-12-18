import AssetsClient from "./_components/assets-client";

export default function AssetsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
                <p className="text-muted-foreground">
                    Manage IT assets with tracking and depreciation
                </p>
            </div>
            <AssetsClient />
        </div>
    );
}
