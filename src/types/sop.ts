export type SOPCategory = 'Helpdesk' | 'Assets' | 'ATK' | 'IT Security' | 'Umum';

export interface SOPDocument {
    id: string;
    title: string;
    document_number?: string | null;
    category: SOPCategory;
    description?: string | null;
    file_url: string;
    file_name: string;
    file_size?: number | null;
    status: 'draft' | 'published';
    created_by?: string | null;
    created_at: string;
    updated_at: string;
    profiles?: {
        full_name?: string | null;
        email?: string | null;
    } | null;
}

export interface SOPFilterParams {
    search?: string;
    category?: string;
    page?: number;
    pageSize?: number;
}
