export type DocumentElementType =
  | 'markdown'
  | 'short_text'
  | 'select'
  | 'callout'
  | 'code'
  | 'checklist'
  | 'repeatable_list';

export interface DocumentElementConfig {
  id: string;
  label: string;
  description: string;
  field_type: DocumentElementType;
  level: number; // 1 = H2 Section, 2 = H3 Subsection, 3 = H4 Sub-subsection
  placeholder: string;
  default_value: any;
  required: boolean;
  order: number;
  options?: string[] | null;
}

export interface RepeatableSubItem {
  id: string;
  title: string;
  content: string;
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
