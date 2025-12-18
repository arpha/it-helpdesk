import Link from "next/link";
import { User, Shield } from "lucide-react";

export const metadata = {
    title: "Settings | IT Helpdesk RSUD Cicalengka",
};

const settingsLinks = [
    {
        title: "Profile",
        description: "Update your profile information",
        href: "/settings/profile",
        icon: User,
    },
    {
        title: "Security",
        description: "Manage your password and security settings",
        href: "/settings/security",
        icon: Shield,
    },
];

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account settings
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {settingsLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-start gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <link.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-medium">{link.title}</h3>
                            <p className="text-sm text-muted-foreground">{link.description}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
