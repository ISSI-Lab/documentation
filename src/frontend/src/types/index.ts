export type UserType = 'organizer' | 'regular';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  user_type: UserType;
  is_verified?: boolean;
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

export type OrganizationRole = 'owner' | 'manager' | 'member';
export type TeamRole = OrganizationRole;

export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  joined_at: string;
  username?: string;
  name?: string;
  email?: string;
  user_type?: UserType;
}
export type TeamMember = OrganizationMember;

export interface Organization {
  id: string;
  name: string;
  description: string;
  join_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: OrganizationMember[];
  user_role?: OrganizationRole;
  members_count?: number;
  projects?: Project[];
}
export type Team = Organization;

export interface OrganizationTeamMember {
  team_id: string;
  user_id: string;
  role: string; // 'lead' | 'member'
  joined_at: string;
  username?: string;
  name?: string;
  email?: string;
  user_type?: UserType;
}

export interface OrganizationTeam {
  id: string;
  organization_id: string;
  set_id?: string | null;
  set_name?: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  members_count?: number;
  members?: OrganizationTeamMember[];
}

export interface TeamAssignmentSetItem {
  set_id: string;
  team_id: string;
  assigned_role?: string | null;
  team_name?: string;
  team_description?: string;
  members_count?: number;
}

export interface TeamAssignmentSet {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  teams_count?: number;
  teams?: OrganizationTeam[];
  items?: TeamAssignmentSetItem[];
  associated_projects_count?: number;
}

export interface ProjectTeamAssignment {
  id: string;
  project_id: string;
  team_id: string;
  assigned_role?: string | null;
  assigned_at: string;
  team_name?: string;
  team_description?: string;
  members_count?: number;
  members?: OrganizationTeamMember[];
}

export type ProjectAssociationType = 'team' | 'individual';

export interface ProjectIndividualMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  assigned_at: string;
  user_name?: string;
  user_email?: string;
}

export interface Project {
  id: string;
  organization_id: string | null;
  team_id?: string | null; // compatibility
  association_type?: ProjectAssociationType;
  team_assignment_set_id?: string | null;
  team_assignment_set_name?: string | null;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  documents_count?: number;
  assigned_teams?: ProjectTeamAssignment[];
  individual_members?: ProjectIndividualMember[];
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
  organization_id: string | null;
  team_id?: string | null; // compatibility
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
  organization_id?: string | null;
  team_id?: string | null; // compatibility
  tags?: string[];
  document_elements: DocumentElementConfig[];
}

export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'published';

export interface Document {
  id: string;
  title: string;
  project_id: string | null;
  organization_id: string | null;
  team_id?: string | null; // compatibility
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
  organization_id?: string | null;
  team_id?: string | null; // compatibility
  author?: string;
  tags?: string[];
  elements_data?: Record<string, any>;
}

export interface DocumentUpdatePayload {
  title?: string;
  status?: DocumentStatus;
  author?: string;
  project_id?: string | null;
  organization_id?: string | null;
  team_id?: string | null; // compatibility
  tags?: string[];
  elements_data?: Record<string, any>;
}
