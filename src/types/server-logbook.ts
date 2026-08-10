export type VisitorType = 'internal_it' | 'vendor' | 'maintenance' | 'other';

export interface ServerRoomLog {
    id: string;
    visitor_name: string;
    visitor_type: VisitorType;
    company_or_unit?: string | null;
    purpose: string;
    temperature?: number | null;
    check_in_time: string;
    check_out_time?: string | null;
    status: 'active' | 'completed';
    notes?: string | null;
    created_at: string;
}

export interface ServerRoomLogFilterParams {
    search?: string;
    visitor_type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
}
