import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "admin" | "user" | "staff_it" | "manager_it";

export type UserProfile = {
    id: string;
    full_name: string;
    role: UserRole;
    department_id: string | null;
    avatar_url: string | null;
    whatsapp_phone: string | null;
    created_at: string;
    updated_at: string;
};

type AuthState = {
    user: UserProfile | null;
    setUser: (user: UserProfile | null) => void;
    clearUser: () => void;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            setUser: (user) => set({ user }),
            clearUser: () => set({ user: null }),
        }),
        {
            name: "auth-storage",
        }
    )
);
