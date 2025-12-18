import StockOutClient from "./_components/stock-out-client";

export default function StockOutPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Stock Out</h1>
                <p className="text-muted-foreground">
                    Remove stock from inventory
                </p>
            </div>
            <StockOutClient />
        </div>
    );
}
