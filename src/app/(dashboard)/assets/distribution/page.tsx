import DistributionClient from "./_components/distribution-client";

export const metadata = {
    title: "Distribusi Asset | IT Helpdesk",
    description: "Manage asset distribution",
};

export default function DistributionPage() {
    return (
        <div className="container mx-auto py-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Distribusi Asset</h1>
                <p className="text-muted-foreground">Kelola distribusi asset ke instalasi</p>
            </div>
            <DistributionClient />
        </div>
    );
}
