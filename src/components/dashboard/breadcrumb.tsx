"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { Fragment, useMemo } from "react";

type BreadcrumbItem = {
    label: string;
    href: string;
    isLast: boolean;
};

const routeLabels: Record<string, string> = {
    dashboard: "Dashboard",
    users: "Users",
    tickets: "Tickets",
    settings: "Settings",
    create: "Create",
    edit: "Edit",
};

export function Breadcrumb() {
    const pathname = usePathname();

    const breadcrumbs = useMemo(() => {
        const segments = pathname.split("/").filter(Boolean);

        const items: BreadcrumbItem[] = segments.map((segment, index) => {
            const href = "/" + segments.slice(0, index + 1).join("/");
            const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
            const isLast = index === segments.length - 1;

            return { label, href, isLast };
        });

        return items;
    }, [pathname]);

    if (breadcrumbs.length === 0) {
        return (
            <nav className="flex items-center gap-1 text-sm text-muted-foreground">
                <Home className="h-4 w-4" />
                <span className="font-medium text-foreground">Home</span>
            </nav>
        );
    }

    return (
        <nav className="flex items-center gap-1 text-sm">
            <Link
                href="/dashboard"
                className="text-muted-foreground hover:text-foreground transition-colors"
            >
                <Home className="h-4 w-4" />
            </Link>

            {breadcrumbs.map((item) => (
                <Fragment key={item.href}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    {item.isLast ? (
                        <span className="font-medium text-foreground">{item.label}</span>
                    ) : (
                        <Link
                            href={item.href}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {item.label}
                        </Link>
                    )}
                </Fragment>
            ))}
        </nav>
    );
}
