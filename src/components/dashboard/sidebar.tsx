"use client";

import {
    LayoutDashboard,
    Users,
    Ticket,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    MonitorCog,
    Database,
    Building2,
    Menu,
    Package,
    PackageSearch,
    ClipboardList,
    ShoppingCart,
    PackagePlus,
    PackageMinus,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSidebarStore } from "@/stores/sidebar-store";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useEffect, useState } from "react";
import { UserMenu } from "./user-menu";

type MenuItem = {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
};

type MenuGroup = {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: MenuItem[];
};

const menuItems: MenuItem[] = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Tickets",
        href: "/tickets",
        icon: Ticket,
    },
];

const menuGroups: MenuGroup[] = [
    {
        title: "Master",
        icon: Database,
        items: [
            {
                title: "Users",
                href: "/master/users",
                icon: Users,
            },
            {
                title: "Locations",
                href: "/master/locations",
                icon: Building2,
            },
        ],
    },
    {
        title: "ATK Management",
        icon: Package,
        items: [
            {
                title: "Items",
                href: "/atk/items",
                icon: PackageSearch,
            },
            {
                title: "Requests",
                href: "/atk/requests",
                icon: ClipboardList,
            },
            {
                title: "Submission",
                href: "/atk/purchase",
                icon: ShoppingCart,
            },
        ],
    },
    {
        title: "Management Assets",
        icon: MonitorCog,
        items: [
            {
                title: "Assets",
                href: "/assets",
                icon: Database,
            },
            {
                title: "Categories",
                href: "/assets/categories",
                icon: Building2,
            },
            {
                title: "Maintenance",
                href: "/assets/maintenance",
                icon: ClipboardList,
            },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const { isOpen, toggle } = useSidebarStore();
    const [isMobile, setIsMobile] = useState(false);
    const [openGroups, setOpenGroups] = useState<string[]>([]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Auto expand group if current path matches
    useEffect(() => {
        menuGroups.forEach((group) => {
            const hasActiveItem = group.items.some(
                (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
            );
            if (hasActiveItem && !openGroups.includes(group.title)) {
                setOpenGroups((prev) => [...prev, group.title]);
            }
        });
    }, [pathname]);

    const toggleGroup = (title: string) => {
        setOpenGroups((prev) =>
            prev.includes(title)
                ? prev.filter((g) => g !== title)
                : [...prev, title]
        );
    };

    const SidebarContent = () => (
        <nav className="flex flex-col gap-1 p-2">
            {/* Regular Menu Items */}
            {menuItems.map((item) => {
                const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                    <TooltipProvider key={item.href} delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                        "hover:bg-accent hover:text-accent-foreground",
                                        isActive
                                            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    <item.icon className="h-5 w-5 shrink-0" />
                                    {(isOpen || isMobile) && <span>{item.title}</span>}
                                </Link>
                            </TooltipTrigger>
                            {!isOpen && !isMobile && (
                                <TooltipContent side="right">
                                    <p>{item.title}</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                );
            })}

            {/* Menu Groups with Dropdown */}
            {menuGroups.map((group) => {
                const isGroupOpen = openGroups.includes(group.title);
                const hasActiveItem = group.items.some(
                    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
                );

                if (!isOpen && !isMobile) {
                    // Collapsed state - show tooltip with group items
                    return (
                        <TooltipProvider key={group.title} delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => toggle()}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full",
                                            "hover:bg-accent hover:text-accent-foreground",
                                            hasActiveItem ? "text-primary" : "text-muted-foreground"
                                        )}
                                    >
                                        <group.icon className="h-5 w-5 shrink-0" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p>{group.title}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                }

                return (
                    <Collapsible
                        key={group.title}
                        open={isGroupOpen}
                        onOpenChange={() => toggleGroup(group.title)}
                    >
                        <CollapsibleTrigger asChild>
                            <button
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    "hover:bg-accent hover:text-accent-foreground",
                                    hasActiveItem ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                <group.icon className="h-5 w-5 shrink-0" />
                                <span className="flex-1 text-left">{group.title}</span>
                                <ChevronDown
                                    className={cn(
                                        "h-4 w-4 transition-transform",
                                        isGroupOpen && "rotate-180"
                                    )}
                                />
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 pt-1">
                            {group.items.map((item) => {
                                // Check if this is an exact match or starts with (for sub-routes)
                                // But don't match parent if a more specific child matches
                                const isExactMatch = pathname === item.href;
                                const isChildMatch = pathname.startsWith(`${item.href}/`);
                                // Check if there's a more specific sibling that matches
                                const hasSiblingMatch = group.items.some(
                                    (sibling) => sibling.href !== item.href &&
                                        (pathname === sibling.href || pathname.startsWith(`${sibling.href}/`))
                                );
                                const isActive = isExactMatch || (isChildMatch && !hasSiblingMatch);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                            "hover:bg-accent hover:text-accent-foreground",
                                            isActive
                                                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        <item.icon className="h-4 w-4 shrink-0" />
                                        <span>{item.title}</span>
                                    </Link>
                                );
                            })}
                        </CollapsibleContent>
                    </Collapsible>
                );
            })}
        </nav>
    );

    // Mobile sidebar (Sheet)
    if (isMobile) {
        return (
            <Sheet>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0 flex flex-col">
                    <SheetHeader className="border-b px-4 py-3">
                        <SheetTitle className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                                <MonitorCog className="h-4 w-4 text-primary-foreground" />
                            </div>
                            <span className="text-lg font-semibold">IT Helpdesk</span>
                        </SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-auto">
                        <SidebarContent />
                    </div>
                    {/* User Menu for Mobile */}
                    <div className="border-t p-2">
                        <UserMenu isCollapsed={false} />
                    </div>
                </SheetContent>
            </Sheet>
        );
    }

    // Desktop sidebar
    return (
        <aside
            className={cn(
                "hidden md:flex flex-col border-r bg-card transition-all duration-300",
                isOpen ? "w-64" : "w-16"
            )}
        >
            {/* Logo & Toggle Button */}
            <div className="flex h-14 items-center justify-between border-b px-3">
                <div
                    className={cn(
                        "flex items-center gap-2",
                        !isOpen && "cursor-pointer hover:opacity-80"
                    )}
                    onClick={!isOpen ? toggle : undefined}
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                        <MonitorCog className="h-4 w-4 text-primary-foreground" />
                    </div>
                    {isOpen && <span className="text-lg font-semibold">IT Helpdesk</span>}
                </div>
                {isOpen && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-auto py-2">
                <SidebarContent />
            </div>

            {/* User Menu */}
            <div className="border-t p-2">
                <UserMenu isCollapsed={!isOpen} />
            </div>
        </aside>
    );
}
