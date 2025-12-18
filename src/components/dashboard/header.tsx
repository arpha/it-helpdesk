"use client";

import { usePathname } from "next/navigation";
import { DarkmodeToggle } from "@/components/common/darkmode-toggle";
import { Breadcrumb } from "./breadcrumb";

export function Header() {
    const pathname = usePathname();

    return (
        <header className="flex h-14 items-center justify-between border-b bg-card px-6 pl-14 md:pl-6">
            <div className="flex items-center gap-4">
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
