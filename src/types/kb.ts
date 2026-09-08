export type KBCategory = 
  | 'Printer'
  | 'Jaringan & Wi-Fi'
  | 'SIMRS'
  | 'Hardware & PC'
  | 'Software'
  | 'Email & Akun'
  | 'Umum';

export interface KBArticle {
  id: string;
  title: string;
  slug?: string | null;
  category: KBCategory | string;
  content: string;
  summary?: string | null;
  tags?: string[];
  is_published: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  source_ticket_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
}

export interface KBArticleFormData {
  title: string;
  category: string;
  content: string;
  summary?: string;
  tags?: string[];
  is_published?: boolean;
  source_ticket_id?: string;
}

export interface AIDeflectionLog {
  id: string;
  user_id?: string | null;
  user_query: string;
  ai_response?: string | null;
  status: 'pending' | 'resolved_by_ai' | 'escalated_to_ticket';
  suggested_article_ids?: string[];
  created_ticket_id?: string | null;
  created_at: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  articles?: Partial<KBArticle>[];
  timestamp: string;
}
