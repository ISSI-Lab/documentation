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

export interface VerificationToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  used_at?: string | null;
}

export interface UserWithPassword extends User {
  password_hash: string;
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
  creator_name?: string;
  creator_username?: string;
  is_creator?: boolean;
  created_at: string;
  updated_at: string;
  members?: OrganizationMember[];
  user_role?: OrganizationRole;
  members_count?: number;
  projects_count?: number;
  documents_count?: number;
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
export type ProjectDocumentCreationPermission = 'creator_only' | 'all_members';

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
  team_id?: string | null;
  association_type?: ProjectAssociationType;
  document_creation_permission?: ProjectDocumentCreationPermission;
  team_assignment_set_id?: string | null;
  team_assignment_set_name?: string | null;
  name: string;
  description: string;
  created_by: string;
  creator_name?: string;
  creator_username?: string;
  created_at: string;
  updated_at: string;
  documents_count?: number;
  assigned_teams?: ProjectTeamAssignment[];
  individual_members?: ProjectIndividualMember[];
}

export type DocumentElementType =
  | 'iteration_container'
  | 'iteration_group'
  | 'pure_markdown'
  | 'interactive_field'
  | 'interactive_list'
  | 'repeatable_list'
  | 'markdown'
  | 'short_text'
  | 'select'
  | 'callout'
  | 'code'
  | 'checklist';

export type ContainerChildType = 'key_value' | 'markdown_text' | 'markdown_readonly';

export interface ContainerChildElement {
  id: string;
  type: ContainerChildType;
  key?: string; // For key_value: fixed key edited by template editor (viewed by writer)
  label?: string; // For markdown_text / key_value: display title or heading
  description?: string; // Guidance / instructions for document writer
  placeholder?: string; // Placeholder hint
  content?: string; // For markdown_readonly: pure markdown text view-only
  default_value?: string; // Default starter value for markdown_text or key_value
}

export interface IterationFieldConfig {
  id?: string;
  key: string; // e.g. "Reason", "Todo", "Response"
  label?: string;
  description?: string;
  placeholder?: string;
  default_value?: string;
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
  view_markdown?: string | null;
  iteration_fields?: IterationFieldConfig[] | null;
  container_children?: ContainerChildElement[] | null;
}

export interface EditableItem {
  id: string;
  description: string;
  value: string;
  title?: string;
  content?: string;
}

export interface IterationGroupItem {
  id: string;
  iteration_number?: number;
  title?: string;
  values?: Record<string, any>;
  fields?: Array<{ key: string; value: string }>;
}

export type RepeatableSubItem = EditableItem;

export type TemplateVisibility = 'private' | 'public';

export interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  visibility: TemplateVisibility;
  organization_id: string | null;
  team_id?: string | null;
  created_by: string | null;
  creator_name?: string;
  creator_username?: string;
  tags: string[];
  document_elements: DocumentElementConfig[];
  created_at: string;
  updated_at: string;
}

export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'published';
export type DocumentType = 'personal' | 'project_shared';
export type SubmissionType = 'personal' | 'team';
export type SubmissionStatus = 'draft' | 'submitted' | 'reviewed';

export interface SubmissionComment {
  id: string;
  submission_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentSubmission {
  id: string;
  document_id: string;
  project_id: string;
  submission_type: SubmissionType;
  user_id?: string | null;
  user_name?: string;
  user_email?: string;
  team_id?: string | null;
  team_name?: string;
  status: SubmissionStatus;
  elements_data: Record<string, any>;
  compiled_markdown: string;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
  comments_count?: number;
  comments?: SubmissionComment[];
  document_title?: string;
  document_type?: DocumentType;
  project_name?: string;
  template_title?: string;
  document_creator_id?: string;
}

export interface Document {
  id: string;
  title: string;
  project_id: string | null;
  project_association_type?: ProjectAssociationType | null;
  organization_id: string | null;
  team_id?: string | null;
  assigned_team_id?: string | null;
  assigned_team_name?: string | null;
  template_id: string;
  template_title: string;
  document_type: DocumentType;
  is_submittable: boolean;
  copied_from_id?: string | null;
  master_creator_id?: string | null;
  status: DocumentStatus;
  author: string;
  created_by: string | null;
  creator_name?: string;
  creator_username?: string;
  last_edited_by: string | null;
  tags: string[];
  elements_data: Record<string, any>;
  compiled_markdown: string;
  submissions_count?: number;
  copies_count?: number;
  created_at: string;
  updated_at: string;
}

