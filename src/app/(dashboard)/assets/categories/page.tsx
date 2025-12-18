import CategoriesClient from "./_components/categories-client";

export default function AssetCategoriesPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Asset Categories</h1>
                <p className="text-muted-foreground">
                    Manage asset categories
                </p>
            </div>
            <CategoriesClient />
        </div>
    );
}
