"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { useState, useTransition } from "react";
import { updateProfile } from "../actions";
import { Loader2, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

const roleLabels: Record<string, string> = {
    admin: "Admin",
    user: "User",
    staff_it: "Staff IT",
    manager_it: "Manager IT",
};

export default function ProfileForm() {
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);
    const [fullName, setFullName] = useState(user?.full_name || "");
    const [whatsappPhone, setWhatsappPhone] = useState(user?.whatsapp_phone || "");
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        startTransition(async () => {
            const result = await updateProfile({
                full_name: fullName,
                whatsapp_phone: whatsappPhone
            });

            if (result.success) {
                setMessage({ type: "success", text: "Profile updated successfully!" });
                // Update local store
                if (user) {
                    setUser({ ...user, full_name: fullName, whatsapp_phone: whatsappPhone });
                }
            } else {
                setMessage({ type: "error", text: result.error || "Failed to update profile" });
            }
        });
    };

    if (!user) {
        return (
            <Card>
                <CardContent className="p-6">
                    <p className="text-muted-foreground">Loading user data...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                    Update your profile information here
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Avatar & Role */}
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                                {getInitials(user.full_name)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium">{user.full_name}</p>
                            <Badge variant="secondary" className="mt-1">
                                {roleLabels[user.role]}
                            </Badge>
                        </div>
                    </div>

                    {/* Message */}
                    {message && (
                        <div
                            className={`rounded-md p-3 text-sm ${message.type === "success"
                                ? "bg-green-500/10 text-green-600"
                                : "bg-destructive/10 text-destructive"
                                }`}
                        >
                            {message.text}
                        </div>
                    )}

                    {/* Full Name */}
                    <div className="space-y-2">
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                            id="full_name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Enter your full name"
                        />
                    </div>

                    {/* Role (readonly) */}
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Input value={roleLabels[user.role]} disabled className="bg-muted" />
                        <p className="text-xs text-muted-foreground">
                            Role can only be changed by an administrator
                        </p>
                    </div>

                    {/* WhatsApp Phone */}
                    <div className="space-y-2">
                        <Label htmlFor="whatsapp_phone">WhatsApp Phone</Label>
                        <Input
                            id="whatsapp_phone"
                            value={whatsappPhone}
                            onChange={(e) => setWhatsappPhone(e.target.value)}
                            placeholder="e.g., 08123456789"
                        />
                        <p className="text-xs text-muted-foreground">
                            For receiving ATK request notifications via WhatsApp
                        </p>
                    </div>

                    {/* Submit Button */}
                    <Button type="submit" disabled={isPending}>
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
