"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { LogOut, User, ChevronUp, Loader2, Check, Upload, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { logout } from "@/app/(auth)/logout/actions";
import { useState, useTransition, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { updateProfile, uploadProfileAvatar } from "@/app/(dashboard)/settings/profile/actions";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/api/use-current-user";

type UserMenuProps = {
    isCollapsed?: boolean;
};

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

export function UserMenu({ isCollapsed = false }: UserMenuProps) {
    const { user } = useCurrentUser();
    const setUser = useAuthStore((state) => state.setUser);
    const queryClient = useQueryClient();
    const [isPending, startTransition] = useTransition();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [fullName, setFullName] = useState("");
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string>("");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLogout = () => {
        startTransition(async () => {
            await logout();
        });
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                setAvatarPreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleOpenProfile = () => {
        if (user) {
            setFullName(user.full_name);
            setAvatarFile(null);
            setAvatarPreview(user.avatar_url || "");
            setMessage(null);
        }
        setIsProfileOpen(true);
    };

    const handleSaveProfile = () => {
        setMessage(null);
        startTransition(async () => {
            let avatarUrl: string | undefined = undefined;

            // Upload new avatar if provided
            if (avatarFile) {
                const formData = new FormData();
                formData.append("file", avatarFile);

                const uploadResult = await uploadProfileAvatar(formData);
                if (!uploadResult.success) {
                    setMessage({ type: "error", text: uploadResult.error || "Failed to upload avatar" });
                    return;
                }
                avatarUrl = uploadResult.url;
            }

            const result = await updateProfile({
                full_name: fullName,
                avatar_url: avatarUrl,
            });

            if (result.success) {
                setMessage({ type: "success", text: "Profile updated!" });
                if (user) {
                    setUser({
                        ...user,
                        full_name: fullName,
                        avatar_url: avatarUrl || user.avatar_url,
                    });
                }
                // Invalidate queries to refresh the data
                queryClient.invalidateQueries({ queryKey: ["users"] });
                queryClient.invalidateQueries({ queryKey: ["currentUser"] });
                setTimeout(() => {
                    setIsProfileOpen(false);
                }, 1000);
            } else {
                setMessage({ type: "error", text: result.error || "Failed to update" });
            }
        });
    };

    if (!user) {
        return (
            <div className="flex items-center gap-3 p-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                {!isCollapsed && (
                    <div className="flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="mt-1 h-3 w-16" />
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left border border-border/50 bg-card/60 hover:bg-muted/70 transition-all shadow-2xs group cursor-pointer"
                        disabled={isPending}
                    >
                        <div className="relative shrink-0">
                            <Avatar className="h-9 w-9 ring-1 ring-border">
                                <AvatarImage src={user.avatar_url || undefined} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                    {getInitials(user.full_name)}
                                </AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                        </div>
                        {!isCollapsed && (
                            <>
                                <div className="flex-1 overflow-hidden">
                                    <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{user.full_name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground uppercase tracking-wider">
                                            {roleLabels[user.role] || user.role}
                                        </span>
                                    </div>
                                </div>
                                <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                            </>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-56">
                    <DropdownMenuLabel>
                        <div className="flex flex-col">
                            <span>{user.full_name}</span>
                            <span className="text-xs font-normal text-muted-foreground capitalize">
                                {user.role.replace("_", " ")}
                            </span>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleOpenProfile} className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleLogout}
                        disabled={isPending}
                        className="text-destructive focus:text-destructive cursor-pointer"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        {isPending ? "Logging out..." : "Logout"}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile Modal */}
            <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Profile</DialogTitle>
                        <DialogDescription>
                            Update your profile information
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
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

                        {/* Avatar Upload */}
                        <div className="space-y-2">
                            <Label>Avatar</Label>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={avatarPreview || undefined} />
                                    <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                                        {getInitials(fullName || user.full_name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleAvatarChange}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload
                                    </Button>
                                    {avatarFile && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setAvatarFile(null);
                                                setAvatarPreview(user.avatar_url || "");
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Full Name */}
                        <div className="space-y-2">
                            <Label htmlFor="modal_full_name">Full Name</Label>
                            <Input
                                id="modal_full_name"
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
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsProfileOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveProfile} disabled={isPending}>
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
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
