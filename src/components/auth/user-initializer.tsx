"use client";

import { useAuthStore, UserProfile } from "@/stores/auth-store";
import { useEffect, useRef } from "react";

type UserInitializerProps = {
    user: UserProfile | null;
};

export function UserInitializer({ user }: UserInitializerProps) {
    const setUser = useAuthStore((state) => state.setUser);
    const initialized = useRef(false);

    useEffect(() => {
        if (!initialized.current && user) {
            setUser(user);
            initialized.current = true;
        }
    }, [user, setUser]);

    return null;
}
