"use client";

import { DarkmodeToggle } from "@/components/common/darkmode-toggle";
import { Breadcrumb } from "./breadcrumb";
import { Sidebar } from "./sidebar";

export function Header() {
    return (
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4">
                {/* Mobile Sidebar Toggle - only visible on mobile */}
                <div className="md:hidden">
                    <Sidebar />
                </div>
                {/* Breadcrumb */}
                <Breadcrumb />
            </div>

            <div className="flex items-center gap-2">
                {/* Darkmode Toggle */}
                <DarkmodeToggle />
            </div>
        </header>
    );
}
