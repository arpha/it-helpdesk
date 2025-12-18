import { create } from "zustand";
import { persist } from "zustand/middleware";

type SidebarState = {
    isOpen: boolean;
    toggle: () => void;
    setOpen: (open: boolean) => void;
};

export const useSidebarStore = create<SidebarState>()(
    persist(
        (set) => ({
            isOpen: true,
            toggle: () => set((state) => ({ isOpen: !state.isOpen })),
            setOpen: (open) => set({ isOpen: open }),
        }),
        {
            name: "sidebar-storage",
        }
    )
);
