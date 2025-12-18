export const metadata = {
    title: "Dashboard | IT Helpdesk RSUD Cicalengka",
};

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                    Welcome to IT Helpdesk RSUD Cicalengka
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Stats Cards */}
                <div className="rounded-lg border bg-card p-6">
                    <div className="text-sm font-medium text-muted-foreground">
                        Total Users
                    </div>
                    <div className="mt-2 text-3xl font-bold">0</div>
                </div>
                <div className="rounded-lg border bg-card p-6">
                    <div className="text-sm font-medium text-muted-foreground">
                        Open Tickets
                    </div>
                    <div className="mt-2 text-3xl font-bold">0</div>
                </div>
                <div className="rounded-lg border bg-card p-6">
                    <div className="text-sm font-medium text-muted-foreground">
                        Resolved Today
                    </div>
                    <div className="mt-2 text-3xl font-bold">0</div>
                </div>
                <div className="rounded-lg border bg-card p-6">
                    <div className="text-sm font-medium text-muted-foreground">
                        Departments
                    </div>
                    <div className="mt-2 text-3xl font-bold">0</div>
                </div>
            </div>
        </div>
    );
}
