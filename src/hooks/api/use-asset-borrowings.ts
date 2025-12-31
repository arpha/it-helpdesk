"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type AssetBorrowing = {
    id: string;
    asset_id: string;
    borrower_location_id: string | null;
    borrower_user_id: string | null;
    original_location_id: string | null;
    status: "pending" | "approved" | "borrowed" | "returned" | "rejected";
    borrow_date: string | null;
    expected_return_date: string | null;
    actual_return_date: string | null;
    purpose: string | null;
    notes: string | null;
    approved_by: string | null;
    approved_at: string | null;
    returned_by: string | null;
    returned_at: string | null;
    created_at: string;
    updated_at: string;
    assets: {
        id: string;
        name: string;
        asset_code: string;
    } | null;
    borrower_location: {
        name: string;
    } | null;
    original_location: {
        name: string;
    } | null;
    borrower: {
        full_name: string;
    } | null;
    approver: {
        full_name: string;
    } | null;
};

type UseBorrowingsParams = {
    page: number;
    limit: number;
    status?: string;
};

type BorrowingsResult = {
    data: AssetBorrowing[];
    totalItems: number;
    totalPages: number;
};

async function fetchBorrowings(params: UseBorrowingsParams): Promise<BorrowingsResult> {
    const supabase = createClient();
    const { page, limit, status } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("asset_borrowings")
        .select(
            `
            *,
            assets(id, name, asset_code),
            borrower_location:locations!asset_borrowings_borrower_location_id_fkey(name),
            original_location:locations!asset_borrowings_original_location_id_fkey(name),
            borrower:profiles!asset_borrowings_borrower_user_id_fkey(full_name),
            approver:profiles!asset_borrowings_approved_by_fkey(full_name)
        `,
            { count: "exact" }
        );

    if (status && status !== "all") {
        query = query.eq("status", status);
    }

    const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) {
        throw new Error(error.message);
    }

    return {
        data: (data as unknown as AssetBorrowing[]) || [],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useAssetBorrowings(params: UseBorrowingsParams) {
    return useQuery({
        queryKey: ["asset-borrowings", params.page, params.limit, params.status],
        queryFn: () => fetchBorrowings(params),
    });
}

// Fetch borrowable assets only
export type BorrowableAsset = {
    id: string;
    name: string;
    asset_code: string;
    locations: { name: string } | null;
};

async function fetchBorrowableAssets(): Promise<BorrowableAsset[]> {
    const supabase = createClient();

    // Get assets with active borrowings
    const { data: activeBorrowings } = await supabase
        .from("asset_borrowings")
        .select("asset_id")
        .in("status", ["pending", "approved", "borrowed"]);

    const borrowedAssetIds = activeBorrowings?.map(b => b.asset_id) || [];

    let query = supabase
        .from("assets")
        .select("id, name, asset_code, locations(name)")
        .eq("is_borrowable", true)
        .eq("status", "active")
        .order("name");

    // Exclude assets currently being borrowed
    if (borrowedAssetIds.length > 0) {
        query = query.not("id", "in", `(${borrowedAssetIds.join(",")})`);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return (data as unknown as BorrowableAsset[]) || [];
}

export function useBorrowableAssets() {
    return useQuery({
        queryKey: ["borrowable-assets"],
        queryFn: fetchBorrowableAssets,
    });
}
