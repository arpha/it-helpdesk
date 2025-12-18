"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type ATKRequestItem = {
    id: string;
    item_id: string;
    quantity: number;
    approved_quantity: number | null;
    atk_items: {
        name: string;
        unit: string;
        type: string;
    };
};

export type ATKRequest = {
    id: string;
    requester_id: string;
    department_id: string | null;
    status: "pending" | "approved" | "rejected" | "completed";
    notes: string | null;
    approved_by: string | null;
    approved_at: string | null;
    approval_signature_url: string | null;
    created_at: string;
    updated_at: string;
    profiles: {
        full_name: string;
    } | null;
    departments: {
        name: string;
    } | null;
    approver: {
        full_name: string;
    } | null;
    atk_request_items: ATKRequestItem[];
};

type UseATKRequestsParams = {
    page: number;
    limit: number;
    status?: string;
    myRequestsOnly?: boolean;
    userId?: string;
};

type ATKRequestsResult = {
    data: ATKRequest[];
    totalItems: number;
    totalPages: number;
};

async function fetchATKRequests(params: UseATKRequestsParams): Promise<ATKRequestsResult> {
    const supabase = createClient();
    const { page, limit, status, myRequestsOnly, userId } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("atk_requests")
        .select(
            `
      *,
      profiles:requester_id(full_name),
      departments:department_id(name),
      approver:approved_by(full_name),
      atk_request_items(
        id,
        item_id,
        quantity,
        approved_quantity,
        atk_items(name, unit, type)
      )
    `,
            { count: "exact" }
        );

    if (status && status !== "all") {
        query = query.eq("status", status);
    }

    if (myRequestsOnly && userId) {
        query = query.eq("requester_id", userId);
    }

    const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) {
        throw new Error(error.message);
    }

    return {
        data: (data as unknown as ATKRequest[]) || [],
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
    };
}

export function useATKRequests(params: UseATKRequestsParams) {
    return useQuery({
        queryKey: ["atk-requests", params.page, params.limit, params.status, params.myRequestsOnly, params.userId],
        queryFn: () => fetchATKRequests(params),
    });
}
