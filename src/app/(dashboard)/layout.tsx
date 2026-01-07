import { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { UserInitializer } from "@/components/auth/user-initializer";
import { ChatWidget } from "@/components/ai/chat-widget";
import { cookies } from "next/headers";
import { UserProfile } from "@/stores/auth-store";

type DashboardLayoutProps = {
    children: ReactNode;
};

async function getUserFromCookie(): Promise<UserProfile | null> {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("user_profile");

    if (!userCookie?.value) {
        return null;
    }

    try {
        return JSON.parse(userCookie.value) as UserProfile;
    } catch {
        return null;
    }
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
    const user = await getUserFromCookie();

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Initialize user store */}
            <UserInitializer user={user} />

            {/* Sidebar - hidden on mobile, visible on desktop */}
            <div className="hidden md:flex h-full">
                <Sidebar />
            </div>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <Header />

                {/* Page Content */}
                <main className="flex-1 overflow-auto p-6">{children}</main>
            </div>

            {/* AI Chat Assistant */}
            <ChatWidget />
        </div>
    );
}

