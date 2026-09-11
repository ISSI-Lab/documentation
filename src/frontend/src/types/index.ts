export type DocumentElementType =
  | 'markdown'
  | 'short_text'
  | 'select'
  | 'callout'
  | 'code'
  | 'checklist';

export interface DocumentElementConfig {
  id: string;
  label: string;
  description: string;
  field_type: DocumentElementType;
  placeholder: string;
  default_value: string;
  required: boolean;
  order: number;
  options?: string[] | null;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  document_elements: DocumentElementConfig[];
  created_at: string;
  updated_at: string;
}

export interface TemplateCreatePayload {
  title: string;
  description: string;
  category: string;
  icon: string;
  document_elements: DocumentElementConfig[];
}

export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'published';

export interface Document {
  id: string;
  title: string;
  template_id: string;
  template_title: string;
  status: DocumentStatus;
  author: string;
  tags: string[];
  elements_data: Record<string, any>;
  compiled_markdown: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentCreatePayload {
  title: string;
  template_id: string;
  author?: string;
  tags?: string[];
  elements_data?: Record<string, any>;
}

export interface DocumentUpdatePayload {
  title?: string;
  status?: DocumentStatus;
  author?: string;
  tags?: string[];
  elements_data?: Record<string, any>;
}
