import LocationsClient from "./_components/locations-client";

export default function LocationsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
                <p className="text-muted-foreground">
                    Manage locations in your organization
                </p>
            </div>
            <LocationsClient />
        </div>
    );
}
