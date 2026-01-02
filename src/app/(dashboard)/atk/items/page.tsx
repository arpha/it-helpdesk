import ItemsClient from "./_components/items-client";

export const metadata = {
    title: "Items | SI-Mantap",
};

export default function ATKItemsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Stuff Items</h1>
                <p className="text-muted-foreground">
                    Manage Stuff items
                </p>
            </div>
            <ItemsClient />
        </div>
    );
}
