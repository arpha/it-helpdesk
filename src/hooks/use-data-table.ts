"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useDebounce } from "./use-debounce";

export type DataTableState = {
    page: number;
    limit: number;
    search: string;
};

export type UseDataTableOptions = {
    defaultLimit?: number;
    defaultPage?: number;
    debounceMs?: number;
};

export function useDataTable(options: UseDataTableOptions = {}) {
    const { defaultLimit = 10, defaultPage = 1, debounceMs = 300 } = options;

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    // Parse from URL or use defaults
    const page = Number(searchParams.get("page")) || defaultPage;
    const limit = Number(searchParams.get("limit")) || defaultLimit;
    const searchQuery = searchParams.get("search") || "";

    const [searchInput, setSearchInput] = useState(searchQuery);
    const debouncedSearch = useDebounce(searchInput, debounceMs);

    // Create query string
    const createQueryString = useCallback(
        (params: Record<string, string | number | null>) => {
            const newSearchParams = new URLSearchParams(searchParams.toString());

            Object.entries(params).forEach(([key, value]) => {
                if (value === null || value === "") {
                    newSearchParams.delete(key);
                } else {
                    newSearchParams.set(key, String(value));
                }
            });

            return newSearchParams.toString();
        },
        [searchParams]
    );

    // Update URL with new params
    const updateUrl = useCallback(
        (params: Record<string, string | number | null>) => {
            startTransition(() => {
                const queryString = createQueryString(params);
                router.push(`${pathname}?${queryString}`, { scroll: false });
            });
        },
        [createQueryString, pathname, router]
    );

    // Handlers
    const setPage = useCallback(
        (newPage: number) => {
            updateUrl({ page: newPage });
        },
        [updateUrl]
    );

    const setLimit = useCallback(
        (newLimit: number) => {
            updateUrl({ limit: newLimit, page: 1 }); // Reset to page 1 when changing limit
        },
        [updateUrl]
    );

    const setSearch = useCallback(
        (search: string) => {
            setSearchInput(search);
        },
        []
    );

    // Effect to update URL when debounced search changes
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (debouncedSearch !== searchQuery) {
            updateUrl({ search: debouncedSearch || null, page: 1 });
        }
    }, [debouncedSearch, searchQuery, updateUrl]);

    return {
        page,
        limit,
        search: debouncedSearch,
        searchInput,
        isPending,
        setPage,
        setLimit,
        setSearch,
    };
}
