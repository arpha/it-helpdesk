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
    ClipboardCheck,
    ShoppingCart,
    PackagePlus,
    PackageMinus,
    BarChart3,
    FileText,
    Activity,
    Truck,
    QrCode,
    Fingerprint,
    BookOpen,
    ShieldCheck,
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
import { useAuthStore } from "@/stores/auth-store";
import { useSidebarPendingCounts } from "@/hooks/api/use-sidebar-pending-counts";

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
];

const menuGroups: MenuGroup[] = [
    {
        title: "Helpdesk",
        icon: Ticket,
        items: [
            {
                title: "Semua Tiket",
                href: "/tickets",
                icon: ClipboardList,
            },
            {
                title: "QR Generator",
                href: "/qr-generator",
                icon: QrCode,
            },
            {
                title: "Konversi OCR",
                href: "/tools/convert",
                icon: FileText,
            },
        ],
    },
    {
        title: "SOP & Pedoman",
        icon: BookOpen,
        items: [
            {
                title: "Dokumen SOP",
                href: "/sop",
                icon: FileText,
            },
            {
                title: "Knowledge Base",
                href: "/knowledge-base",
                icon: BookOpen,
            },
        ],
    },
    {
        title: "Master Data",
        icon: Database,
        items: [
            {
                title: "Data Pengguna",
                href: "/master/users",
                icon: Users,
            },
            {
                title: "Lokasi & Unit",
                href: "/master/locations",
                icon: Building2,
            },
            {
                title: "Mesin Fingerprint",
                href: "/master/fingerprints",
                icon: Fingerprint,
            },
            {
                title: "Logbook Server",
                href: "/master/server-logbook",
                icon: ShieldCheck,
            },
        ],
    },
    {
        title: "Inventaris & ATK",
        icon: Package,
        items: [
            {
                title: "Daftar Barang",
                href: "/atk/items",
                icon: PackageSearch,
            },
            {
                title: "Permintaan ATK",
                href: "/atk/requests",
                icon: ClipboardList,
            },
            {
                title: "Pengadaan Barang",
                href: "/atk/purchase",
                icon: ShoppingCart,
            },
            {
                title: "Laporan Pemakaian",
                href: "/atk/reports",
                icon: BarChart3,
            },
            {
                title: "Stock Opname",
                href: "/atk/stock-opname",
                icon: ClipboardCheck,
            },
        ],
    },
    {
        title: "Manajemen Aset IT",
        icon: MonitorCog,
        items: [
            {
                title: "Daftar Aset",
                href: "/assets",
                icon: Database,
            },
            {
                title: "Kategori Aset",
                href: "/assets/categories",
                icon: Building2,
            },
            {
                title: "Pemeliharaan Aset",
                href: "/assets/maintenance",
                icon: Activity,
            },
            {
                title: "Peminjaman Aset",
                href: "/assets/borrowing",
                icon: Package,
            },
            {
                title: "Distribusi Aset",
                href: "/assets/distribution",
                icon: Truck,
            },
            {
                title: "Laporan Aset",
                href: "/assets/reports",
                icon: BarChart3,
            },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const { isOpen, toggle } = useSidebarStore();
    const [isMobile, setIsMobile] = useState(false);
    const [openGroups, setOpenGroups] = useState<string[]>([]);
    const { data: pendingCounts = {} } = useSidebarPendingCounts();

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

    const { user } = useAuthStore();
    const role = user?.role || "user";

    // Filter menu items and groups based on role
    const filteredMenuItems = menuItems.filter(item => {
        if (role === "admin") return true;
        if (role === "user") {
            return item.href === "/dashboard";
        }
        return true; // Default for staff_it and manager_it
    });

    const filteredMenuGroups = menuGroups.map(group => {
        if (role === "admin") return group;

        // Special case for "user" role
        if (role === "user") {
            // Keep QR Generator in Helpdesk, keep SOP & Pedoman, hide other groups
            if (group.title === "Helpdesk") {
                return {
                    ...group,
                    items: group.items.filter(item => item.href === "/qr-generator")
                };
            }
            if (group.title === "SOP & Pedoman") {
                return group;
            }
            return null; // Hide other groups
        }

        return group;
    }).filter(group => group !== null && group.items.length > 0) as MenuGroup[];

    const SidebarContent = () => (
        <nav className="flex flex-col gap-1.5 px-3 py-2">
            {/* Regular Menu Items */}
            {filteredMenuItems.map((item) => {
                const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                const pendingCount = pendingCounts[item.href] || 0;
                return (
                    <TooltipProvider key={item.href} delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all group relative",
                                        isActive
                                            ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-foreground font-semibold shadow-2xs border-l-2 border-primary"
                                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                    )}
                                >
                                    <div className="relative">
                                        <item.icon className={cn(
                                            "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                        )} />
                                        {!isOpen && !isMobile && pendingCount > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                            </span>
                                        )}
                                    </div>
                                    {(isOpen || isMobile) && (
                                        <>
                                            <span className="truncate flex-1">{item.title}</span>
                                            {pendingCount > 0 && (
                                                <span
                                                    title={`${pendingCount} perlu persetujuan / pending`}
                                                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-2xs shrink-0"
                                                >
                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                    {pendingCount > 99 ? "99+" : pendingCount}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </Link>
                            </TooltipTrigger>
                            {!isOpen && !isMobile && (
                                <TooltipContent side="right">
                                    <div className="flex items-center gap-1.5">
                                        <span>{item.title}</span>
                                        {pendingCount > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-500">
                                                {pendingCount} pending
                                            </span>
                                        )}
                                    </div>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                );
            })}

            {/* Menu Groups with Dropdown */}
            {filteredMenuGroups.map((group) => {
                const isGroupOpen = openGroups.includes(group.title);
                const hasActiveItem = group.items.some(
                    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
                );
                const groupPendingCount = group.items.reduce(
                    (sum, item) => sum + (pendingCounts[item.href] || 0),
                    0
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
                                            "relative flex items-center justify-center rounded-xl p-2.5 text-sm font-medium transition-all w-full cursor-pointer",
                                            hasActiveItem
                                                ? "bg-primary/10 text-primary dark:bg-primary/20"
                                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                        )}
                                    >
                                        <group.icon className="h-5 w-5 shrink-0" />
                                        {groupPendingCount > 0 && (
                                            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                            </span>
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-semibold">{group.title}</p>
                                        {groupPendingCount > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-500">
                                                {groupPendingCount} pending
                                            </span>
                                        )}
                                    </div>
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
                        className="space-y-1"
                    >
                        <CollapsibleTrigger asChild>
                            <button
                                className={cn(
                                    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all cursor-pointer group",
                                    hasActiveItem
                                        ? "text-foreground font-semibold"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )}
                            >
                                <div className={cn(
                                    "p-1 rounded-lg transition-colors relative",
                                    hasActiveItem ? "bg-primary/10 text-primary" : "text-muted-foreground group-hover:text-foreground"
                                )}>
                                    <group.icon className="h-4 w-4 shrink-0" />
                                </div>
                                <span className="flex-1 text-left text-xs uppercase tracking-wider font-semibold truncate">{group.title}</span>
                                {groupPendingCount > 0 && (
                                    <span
                                        title={`${groupPendingCount} belum selesai / pending`}
                                        className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-2xs mr-1 shrink-0"
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        {groupPendingCount > 99 ? "99+" : groupPendingCount}
                                    </span>
                                )}
                                <ChevronDown
                                    className={cn(
                                        "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                                        isGroupOpen && "rotate-180"
                                    )}
                                />
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-3 pt-0.5 pb-1">
                            <div className="border-l-2 border-border/50 ml-2.5 pl-2.5 space-y-1">
                                {group.items.map((item) => {
                                    const isExactMatch = pathname === item.href;
                                    const isChildMatch = pathname.startsWith(`${item.href}/`);
                                    const hasSiblingMatch = group.items.some(
                                        (sibling) => sibling.href !== item.href &&
                                            (pathname === sibling.href || pathname.startsWith(`${sibling.href}/`))
                                    );
                                    const isActive = isExactMatch || (isChildMatch && !hasSiblingMatch);
                                    const pendingCount = pendingCounts[item.href] || 0;

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all group relative",
                                                isActive
                                                    ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-foreground font-semibold shadow-2xs"
                                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                            )}
                                        >
                                            <item.icon className={cn(
                                                "h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110",
                                                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                            )} />
                                            <span className="truncate flex-1">{item.title}</span>

                                            {pendingCount > 0 ? (
                                                <span
                                                    title={`${pendingCount} belum selesai / pending`}
                                                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-2xs shrink-0"
                                                >
                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                    {pendingCount > 99 ? "99+" : pendingCount}
                                                </span>
                                            ) : isActive ? (
                                                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                                            ) : null}
                                        </Link>
                                    );
                                })}
                            </div>
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
                    <SheetHeader className="border-b border-border/60 px-4 py-3.5">
                        <SheetTitle className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 shadow-sm shadow-primary/20 text-white">
                                <MonitorCog className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-base font-bold tracking-tight text-foreground leading-tight">SI-Mantap</span>
                                <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">IT Helpdesk & Asset</span>
                            </div>
                        </SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-auto">
                        <SidebarContent />
                    </div>
                    {/* User Menu for Mobile */}
                    <div className="border-t border-border/60 p-3">
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
                "hidden md:flex flex-col border-r border-border/60 bg-card transition-all duration-300",
                isOpen ? "w-64" : "w-16"
            )}
        >
            {/* Logo & Toggle Button */}
            <div className="flex h-16 items-center justify-between border-b border-border/60 px-3.5">
                <div
                    className={cn(
                        "flex items-center gap-2.5",
                        !isOpen && "cursor-pointer hover:opacity-80 justify-center w-full"
                    )}
                    onClick={!isOpen ? toggle : undefined}
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 shadow-sm shadow-primary/20 text-white shrink-0">
                        <MonitorCog className="h-5 w-5" />
                    </div>
                    {isOpen && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-base font-bold tracking-tight text-foreground leading-tight">SI-Mantap</span>
                            <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">IT Helpdesk & Asset</span>
                        </div>
                    )}
                </div>
                {isOpen && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all" onClick={toggle}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-auto py-2">
                <SidebarContent />
            </div>

            {/* User Menu */}
            <div className="border-t border-border/60 p-3">
                <UserMenu isCollapsed={!isOpen} />
            </div>
        </aside>
    );
}
