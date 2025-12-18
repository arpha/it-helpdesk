"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type ATKPurchaseItem = {
    id: string;
    item_id: string;
    quantity: number;
    price: number;
    subtotal: number;
    atk_items: {
        name: string;
        unit: string;
        type: string;
    };
};

export type ATKPurchaseRequest = {
    id: string;
    title: string;
    status: "draft" | "process" | "success";
    total_amount: number;
    notes: string | null;
    created_by: string;
    approved_by: string | null;
    approved_at: string | null;
    approval_signature_url: string | null;
    created_at: string;
    updated_at: string;
    creator: {
        full_name: string;
    } | null;
    approver: {
        full_name: string;
    } | null;
    atk_purchase_items: ATKPurchaseItem[];
};

type UsePurchaseRequestsParams = {
    page: number;
    limit: number;
    status?: string;
};

type PurchaseRequestsResult = {
    data: ATKPurchaseRequest[];
    totalItems: number;
    totalPages: number;
};

async function fetchPurchaseRequests(params: UsePurchaseRequestsParams): Promise<PurchaseRequestsResult> {
    const supabase = createClient();
    const { page, limit, status } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("atk_purchase_requests")
        .select(
            `
      *,
      creator:created_by(full_name),
      approver:approved_by(full_name),
      atk_purchase_items(
        id,
        item_id,
        quantity,
        price,
        subtotal,
        atk_items(name, unit, type)
      )
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
        data: (data as unknown as ATKPurchaseRequest[]) || [],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function usePurchaseRequests(params: UsePurchaseRequestsParams) {
    return useQuery({
        queryKey: ["purchase-requests", params.page, params.limit, params.status],
        queryFn: () => fetchPurchaseRequests(params),
    });
}
