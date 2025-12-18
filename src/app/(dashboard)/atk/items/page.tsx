import ItemsClient from "./_components/items-client";

export default function ATKItemsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">ATK Items</h1>
                <p className="text-muted-foreground">
                    Manage ATK and Sparepart items
                </p>
            </div>
            <ItemsClient />
        </div>
    );
}
