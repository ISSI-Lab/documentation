export type UserType = 'organizer' | 'regular';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  user_type: UserType;
  created_at: string;
  updated_at: string;
}

export interface DemoUser {
  id: string;
  username: string;
  name: string;
  email: string;
  password?: string;
  user_type: UserType;
}

export type TeamRole = 'manager' | 'member';

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  username?: string;
  name?: string;
  email?: string;
  user_type?: UserType;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  join_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: TeamMember[];
  user_role?: TeamRole;
  members_count?: number;
  projects?: Project[];
}

export interface Project {
  id: string;
  team_id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  documents_count?: number;
}

export type DocumentElementType =
  | 'markdown'
  | 'short_text'
  | 'select'
  | 'callout'
  | 'code'
  | 'checklist'
  | 'repeatable_list';

export interface RepeatableSubItem {
  id: string;
  title: string;
  content: string;
}

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

export type TemplateVisibility = 'private' | 'public';

export interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  visibility: TemplateVisibility;
  team_id: string | null;
  created_by: string | null;
  tags: string[];
  document_elements: DocumentElementConfig[];
  created_at: string;
  updated_at: string;
}

export interface TemplateCreatePayload {
  title: string;
  description: string;
  category: string;
  icon: string;
  visibility?: TemplateVisibility;
  team_id?: string | null;
  tags?: string[];
  document_elements: DocumentElementConfig[];
}

export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'published';

export interface Document {
  id: string;
  title: string;
  project_id: string | null;
  team_id: string | null;
  template_id: string;
  template_title: string;
  status: DocumentStatus;
  author: string;
  created_by: string | null;
  last_edited_by: string | null;
  tags: string[];
  elements_data: Record<string, any>;
  compiled_markdown: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentCreatePayload {
  title: string;
  template_id: string;
  project_id?: string | null;
  author?: string;
  tags?: string[];
  elements_data?: Record<string, any>;
}

export interface DocumentUpdatePayload {
  title?: string;
  status?: DocumentStatus;
  author?: string;
  project_id?: string | null;
  tags?: string[];
  elements_data?: Record<string, any>;
}
