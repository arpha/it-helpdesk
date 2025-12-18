import DepartmentsClient from "./_components/departments-client";

export default function DepartmentsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
                <p className="text-muted-foreground">
                    Manage departments in your organization
                </p>
            </div>
            <DepartmentsClient />
        </div>
    );
}
