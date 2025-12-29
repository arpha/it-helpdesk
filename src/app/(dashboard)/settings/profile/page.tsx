import { Suspense } from "react";
import ProfileForm from "./_components/profile-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
    title: "Profile Settings | IT Governance",
};

function ProfileFormSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
        </div>
    );
}

export default function ProfilePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
                <p className="text-muted-foreground">
                    Manage your profile information
                </p>
            </div>

            <div className="max-w-2xl">
                <Suspense fallback={<ProfileFormSkeleton />}>
                    <ProfileForm />
                </Suspense>
            </div>
        </div>
    );
}
