import BorrowingClient from "./_components/borrowing-client";

export default function BorrowingPage() {
    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Asset Borrowing</h1>
                <p className="text-muted-foreground">
                    Manage asset borrowing between locations
                </p>
            </div>
            <BorrowingClient />
        </div>
    );
}
