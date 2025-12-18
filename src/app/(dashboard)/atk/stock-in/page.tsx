import StockInClient from "./_components/stock-in-client";

export default function StockInPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Stock In</h1>
                <p className="text-muted-foreground">
                    Add incoming stock to inventory
                </p>
            </div>
            <StockInClient />
        </div>
    );
}
