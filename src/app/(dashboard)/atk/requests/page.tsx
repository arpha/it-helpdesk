import RequestsClient from "./_components/requests-client";

export const metadata = {
    title: "Requests | SI-Mantap",
};

export default function ATKRequestsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Stuff Requests</h1>
                <p className="text-muted-foreground">
                    Manage item requests from users
                </p>
            </div>
            <RequestsClient />
        </div>
    );
}
