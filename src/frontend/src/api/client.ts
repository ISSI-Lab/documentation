import {
  DemoUser,
  Document,
  DocumentCreatePayload,
  DocumentUpdatePayload,
  DocumentSubmission,
  SubmissionComment,
  Project,
  Organization,
  OrganizationTeam,
  OrganizationTeamMember,
  Team,
  TeamAssignmentSet,
  TeamAssignmentSetItem,
  ProjectTeamAssignment,
  ProjectIndividualMember,
  ProjectAssociationType,
  ProjectDocumentCreationPermission,
  Template,
  TemplateCreatePayload,
  User,
  UserType,
} from '../types';

const API_BASE = '/api/v1';
const TOKEN_STORAGE_KEY = 'docforge_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getStoredToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    let errData: any = {};
    try {
      errData = await response.json();
      if (errData.error) {
        errorDetail = errData.error;
      } else if (errData.detail) {
        errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // ignore
    }
    const err: any = new Error(errorDetail);
    err.status = response.status;
    err.data = errData;
    err.requires_verification = errData.requires_verification;
    err.user_id = errData.user_id;
    err.email = errData.email;
    err.verification_token = errData.verification_token;
    err.expires_in_seconds = errData.expires_in_seconds;
    err.expired = errData.expired;
    throw err;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Auth
  async register(payload: {
    username: string;
    email: string;
    password: string;
    name?: string;
    user_type?: UserType;
  }): Promise<{
    message: string;
    requires_verification: boolean;
    user_id: string;
    email: string;
    username: string;
    verification_token: string;
    expires_in_seconds: number;
    user?: User;
  }> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyAccount(payload: {
    userId?: string;
    usernameOrEmail?: string;
    token: string;
  }): Promise<{ user: User; token: string; message: string }> {
    const res = await request<{ user: User; token: string; message: string }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },

  async resendVerification(payload: {
    userId?: string;
    usernameOrEmail?: string;
  }): Promise<{
    message: string;
    user_id: string;
    email: string;
    verification_token: string;
    expires_in_seconds: number;
  }> {
    return request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async login(payload: {
    usernameOrEmail: string;
    password: string;
  }): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User; organizations: Organization[]; teams: Organization[] }> {
    const res = await request<any>('/auth/me');
    const orgs = res.organizations || res.teams || [];
    return {
      user: res.user,
      organizations: orgs,
      teams: orgs,
    };
  },

  async updateProfile(payload: {
    name?: string;
    email?: string;
    user_type?: UserType;
  }): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },

  async searchUsers(query: string): Promise<User[]> {
    return request<User[]>(`/auth/users?q=${encodeURIComponent(query)}`);
  },

  async getDemoUsers(): Promise<DemoUser[]> {
    return request<DemoUser[]>('/auth/demo-users');
  },

  logout(): void {
    setStoredToken(null);
  },

  // Organizations
  async listOrganizations(): Promise<Organization[]> {
    return request<Organization[]>('/organizations');
  },

  async createOrganization(payload: { name: string; description?: string }): Promise<Organization> {
    return request<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async joinOrganization(payload: { join_code: string }): Promise<{ message: string; organization: Organization; team: Organization }> {
    const res = await request<any>('/organizations/join', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const org = res.organization || res.team;
    return {
      message: res.message,
      organization: org,
      team: org,
    };
  },

  async getOrganization(id: string): Promise<{ organization: Organization; team: Organization }> {
    const res = await request<any>(`/organizations/${encodeURIComponent(id)}`);
    const org = res.organization || res.team;
    return {
      organization: org,
      team: org,
    };
  },

  async updateOrganization(id: string, payload: { name?: string; description?: string }): Promise<Organization> {
    return request<Organization>(`/organizations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async regenerateOrganizationJoinToken(id: string): Promise<{ join_code: string }> {
    return request<{ join_code: string }>(`/organizations/${encodeURIComponent(id)}/regenerate-token`, {
      method: 'POST',
    });
  },

  async addOrganizationMember(
    orgId: string,
    payload: { userId?: string; usernameOrEmail?: string; role?: 'manager' | 'member' }
  ): Promise<{ message: string }> {
    return request<{ message: string }>(`/organizations/${encodeURIComponent(orgId)}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateOrganizationMemberRole(
    orgId: string,
    targetUserId: string,
    role: 'manager' | 'member'
  ): Promise<{ message: string }> {
    return request<{ message: string }>(
      `/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(targetUserId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }
    );
  },

  async removeOrganizationMember(orgId: string, targetUserId: string): Promise<{ message: string }> {
    return request<{ message: string }>(
      `/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(targetUserId)}`,
      {
        method: 'DELETE',
      }
    );
  },

  async deleteOrganization(id: string): Promise<void> {
    await request<void>(`/organizations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Backwards compatibility aliases for Team
  listTeams(): Promise<Team[]> {
    return this.listOrganizations();
  },

  deleteTeam(id: string): Promise<void> {
    return this.deleteOrganization(id);
  },

  createTeam(payload: { name: string; description?: string }): Promise<Team> {
    return this.createOrganization(payload);
  },

  joinTeam(payload: { join_code: string }): Promise<{ message: string; team: Team }> {
    return this.joinOrganization(payload);
  },

  getTeam(id: string): Promise<{ team: Team }> {
    return this.getOrganization(id);
  },

  updateTeam(id: string, payload: { name?: string; description?: string }): Promise<Team> {
    return this.updateOrganization(id, payload);
  },

  regenerateTeamJoinToken(id: string): Promise<{ join_code: string }> {
    return this.regenerateOrganizationJoinToken(id);
  },

  addTeamMember(
    teamId: string,
    payload: { userId?: string; usernameOrEmail?: string; role?: 'manager' | 'member' }
  ): Promise<{ message: string }> {
    return this.addOrganizationMember(teamId, payload);
  },

  updateMemberRole(teamId: string, targetUserId: string, role: 'manager' | 'member'): Promise<{ message: string }> {
    return this.updateOrganizationMemberRole(teamId, targetUserId, role);
  },

  removeTeamMember(teamId: string, targetUserId: string): Promise<{ message: string }> {
    return this.removeOrganizationMember(teamId, targetUserId);
  },

  // Projects
  async listProjects(orgOrTeamId?: string): Promise<Project[]> {
    const query = orgOrTeamId ? `?organization_id=${encodeURIComponent(orgOrTeamId)}` : '';
    return request<Project[]>(`/projects${query}`);
  },

  async getProject(id: string): Promise<Project> {
    return request<Project>(`/projects/${encodeURIComponent(id)}`);
  },

  async createProject(payload: {
    organization_id?: string | null;
    team_id?: string | null;
    name: string;
    description?: string;
    association_type?: ProjectAssociationType;
    document_creation_permission?: ProjectDocumentCreationPermission;
  }): Promise<Project> {
    return request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        organization_id: payload.organization_id || payload.team_id || null,
      }),
    });
  },

  async updateProject(
    id: string,
    payload: {
      name?: string;
      description?: string;
      document_creation_permission?: ProjectDocumentCreationPermission;
    }
  ): Promise<Project> {
    return request<Project>(`/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteProject(id: string): Promise<void> {
    return request<void>(`/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Templates
  async listTemplates(params?: {
    organization_id?: string;
    team_id?: string;
    visibility?: 'public' | 'private';
    tag?: string;
    search?: string;
  }): Promise<Template[]> {
    const sp = new URLSearchParams();
    const orgId = params?.organization_id || params?.team_id;
    if (orgId) sp.append('organization_id', orgId);
    if (params?.visibility) sp.append('visibility', params.visibility);
    if (params?.tag) sp.append('tag', params.tag);
    if (params?.search) sp.append('search', params.search);
    const qs = sp.toString() ? `?${sp.toString()}` : '';
    return request<Template[]>(`/templates${qs}`);
  },

  async getTemplate(id: string): Promise<Template> {
    return request<Template>(`/templates/${encodeURIComponent(id)}`);
  },

  async createTemplate(payload: TemplateCreatePayload): Promise<Template> {
    return request<Template>('/templates', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        organization_id: payload.organization_id || payload.team_id || null,
      }),
    });
  },

  async updateTemplate(id: string, payload: Partial<TemplateCreatePayload>): Promise<Template> {
    return request<Template>(`/templates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...payload,
        organization_id: payload.organization_id !== undefined ? payload.organization_id : payload.team_id,
      }),
    });
  },

  async deleteTemplate(id: string): Promise<void> {
    return request<void>(`/templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async resetSeedTemplates(): Promise<Template[]> {
    return request<Template[]>('/templates/actions/reset-seeds', {
      method: 'POST',
    });
  },

  // Documents
  async listDocuments(params?: {
    organization_id?: string;
    team_id?: string;
    project_id?: string;
    template_id?: string;
    search?: string;
    tag?: string;
    scope?: string;
  }): Promise<Document[]> {
    const sp = new URLSearchParams();
    const orgId = params?.organization_id || params?.team_id;
    if (orgId) sp.append('organization_id', orgId);
    if (params?.project_id) sp.append('project_id', params.project_id);
    if (params?.template_id) sp.append('template_id', params.template_id);
    if (params?.search) sp.append('search', params.search);
    if (params?.tag) sp.append('tag', params.tag);
    if (params?.scope) sp.append('scope', params.scope);
    const query = sp.toString() ? `?${sp.toString()}` : '';
    return request<Document[]>(`/documents${query}`);
  },

  async getDocument(id: string): Promise<Document> {
    return request<Document>(`/documents/${encodeURIComponent(id)}`);
  },

  async createDocument(payload: DocumentCreatePayload): Promise<Document> {
    return request<Document>('/documents', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        organization_id: payload.organization_id || payload.team_id || null,
      }),
    });
  },

  async updateDocument(id: string, payload: DocumentUpdatePayload): Promise<Document> {
    return request<Document>(`/documents/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...payload,
        organization_id: payload.organization_id !== undefined ? payload.organization_id : payload.team_id,
      }),
    });
  },

  async deleteDocument(id: string): Promise<void> {
    return request<void>(`/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async copyDocument(id: string): Promise<Document> {
    return request<Document>(`/documents/${encodeURIComponent(id)}/copy`, {
      method: 'POST',
    });
  },

  getMarkdownExportUrl(id: string): string {
    return `${API_BASE}/documents/${encodeURIComponent(id)}/export/markdown`;
  },

  // Document Submissions & Creator Review
  async listDocumentSubmissions(documentId: string): Promise<DocumentSubmission[]> {
    return request<DocumentSubmission[]>(`/documents/${encodeURIComponent(documentId)}/submissions`);
  },

  async getMySubmission(documentId: string): Promise<DocumentSubmission> {
    return request<DocumentSubmission>(`/documents/${encodeURIComponent(documentId)}/my-submission`);
  },

  async getSubmission(documentId: string, submissionId: string): Promise<DocumentSubmission> {
    return request<DocumentSubmission>(
      `/documents/${encodeURIComponent(documentId)}/submissions/${encodeURIComponent(submissionId)}`
    );
  },

  async updateSubmission(
    documentId: string,
    submissionId: string,
    payload: { elements_data?: Record<string, any> }
  ): Promise<DocumentSubmission> {
    return request<DocumentSubmission>(
      `/documents/${encodeURIComponent(documentId)}/submissions/${encodeURIComponent(submissionId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  async submitDocument(
    documentId: string,
    submissionId: string
  ): Promise<{ message: string; submission: DocumentSubmission }> {
    return request<any>(
      `/documents/${encodeURIComponent(documentId)}/submissions/${encodeURIComponent(submissionId)}/submit`,
      {
        method: 'POST',
      }
    );
  },

  async unsubmitDocument(
    documentId: string,
    submissionId: string
  ): Promise<{ message: string; submission: DocumentSubmission }> {
    return request<any>(
      `/documents/${encodeURIComponent(documentId)}/submissions/${encodeURIComponent(submissionId)}/unsubmit`,
      {
        method: 'POST',
      }
    );
  },

  async updateSubmissionStatus(
    documentId: string,
    submissionId: string,
    status: 'draft' | 'submitted' | 'reviewed'
  ): Promise<DocumentSubmission> {
    return request<DocumentSubmission>(
      `/documents/${encodeURIComponent(documentId)}/submissions/${encodeURIComponent(submissionId)}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }
    );
  },

  async listSubmissionComments(documentId: string, submissionId: string): Promise<SubmissionComment[]> {
    return request<SubmissionComment[]>(
      `/documents/${encodeURIComponent(documentId)}/submissions/${encodeURIComponent(submissionId)}/comments`
    );
  },

  async addSubmissionComment(
    documentId: string,
    submissionId: string,
    payload: { content: string }
  ): Promise<SubmissionComment> {
    return request<SubmissionComment>(
      `/documents/${encodeURIComponent(documentId)}/submissions/${encodeURIComponent(submissionId)}/comments`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  // Organization Teams
  async listOrganizationTeams(orgId: string): Promise<OrganizationTeam[]> {
    return request<OrganizationTeam[]>(`/organizations/${encodeURIComponent(orgId)}/teams`);
  },

  async createOrganizationTeam(
    orgId: string,
    payload: { name: string; description?: string; set_id?: string; initial_members?: { userId: string; role?: string }[] }
  ): Promise<OrganizationTeam> {
    return request<OrganizationTeam>(`/organizations/${encodeURIComponent(orgId)}/teams`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createTeamInSet(
    orgId: string,
    setId: string,
    payload: { name: string; description?: string; initial_members?: { userId: string; role?: string }[] }
  ): Promise<OrganizationTeam> {
    return request<OrganizationTeam>(
      `/organizations/${encodeURIComponent(orgId)}/team-assignment-sets/${encodeURIComponent(setId)}/teams`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async getOrganizationTeam(orgId: string, teamId: string): Promise<OrganizationTeam> {
    return request<OrganizationTeam>(`/organizations/${encodeURIComponent(orgId)}/teams/${encodeURIComponent(teamId)}`);
  },

  async updateOrganizationTeam(
    orgId: string,
    teamId: string,
    payload: { name?: string; description?: string }
  ): Promise<OrganizationTeam> {
    return request<OrganizationTeam>(
      `/organizations/${encodeURIComponent(orgId)}/teams/${encodeURIComponent(teamId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  async deleteOrganizationTeam(orgId: string, teamId: string): Promise<void> {
    return request<void>(`/organizations/${encodeURIComponent(orgId)}/teams/${encodeURIComponent(teamId)}`, {
      method: 'DELETE',
    });
  },

  async addOrganizationTeamMember(
    orgId: string,
    teamId: string,
    payload: { userId: string; role?: 'lead' | 'member' }
  ): Promise<{ message: string }> {
    return request<{ message: string }>(
      `/organizations/${encodeURIComponent(orgId)}/teams/${encodeURIComponent(teamId)}/members`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async updateOrganizationTeamMemberRole(
    orgId: string,
    teamId: string,
    userId: string,
    role: 'lead' | 'member'
  ): Promise<{ message: string }> {
    return request<{ message: string }>(
      `/organizations/${encodeURIComponent(orgId)}/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }
    );
  },

  async removeOrganizationTeamMember(orgId: string, teamId: string, userId: string): Promise<{ message: string }> {
    return request<{ message: string }>(
      `/organizations/${encodeURIComponent(orgId)}/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
  },

  // Team Assignment Sets
  async listTeamAssignmentSets(orgId: string): Promise<TeamAssignmentSet[]> {
    return request<TeamAssignmentSet[]>(`/organizations/${encodeURIComponent(orgId)}/team-assignment-sets`);
  },

  async createTeamAssignmentSet(
    orgId: string,
    payload: {
      name: string;
      description?: string;
      team_ids?: string[];
      items?: { team_id: string; assigned_role?: string }[];
    }
  ): Promise<TeamAssignmentSet> {
    return request<TeamAssignmentSet>(`/organizations/${encodeURIComponent(orgId)}/team-assignment-sets`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getTeamAssignmentSet(orgId: string, setId: string): Promise<TeamAssignmentSet> {
    return request<TeamAssignmentSet>(
      `/organizations/${encodeURIComponent(orgId)}/team-assignment-sets/${encodeURIComponent(setId)}`
    );
  },

  async updateTeamAssignmentSet(
    orgId: string,
    setId: string,
    payload: {
      name?: string;
      description?: string;
      team_ids?: string[];
      items?: { team_id: string; assigned_role?: string }[];
    }
  ): Promise<TeamAssignmentSet> {
    return request<TeamAssignmentSet>(
      `/organizations/${encodeURIComponent(orgId)}/team-assignment-sets/${encodeURIComponent(setId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  async deleteTeamAssignmentSet(orgId: string, setId: string): Promise<void> {
    return request<void>(`/organizations/${encodeURIComponent(orgId)}/team-assignment-sets/${encodeURIComponent(setId)}`, {
      method: 'DELETE',
    });
  },

  async cloneTeamAssignmentSet(
    orgId: string,
    setId: string,
    payload?: { name?: string; description?: string }
  ): Promise<TeamAssignmentSet> {
    return request<TeamAssignmentSet>(
      `/organizations/${encodeURIComponent(orgId)}/team-assignment-sets/${encodeURIComponent(setId)}/clone`,
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }
    );
  },

  // Project Team Assignments
  async getProjectTeams(projectId: string): Promise<{
    project_id: string;
    organization_id: string | null;
    association_type?: ProjectAssociationType;
    team_assignment_set_id: string | null;
    team_assignment_set_name: string | null;
    assigned_teams: ProjectTeamAssignment[];
  }> {
    return request<any>(`/projects/${encodeURIComponent(projectId)}/teams`);
  },

  async assignProjectTeam(
    projectId: string,
    payload: { team_id: string; assigned_role?: string }
  ): Promise<{ message: string; assigned_teams: ProjectTeamAssignment[] }> {
    return request<any>(`/projects/${encodeURIComponent(projectId)}/teams`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async removeProjectTeam(projectId: string, teamId: string): Promise<{ message: string }> {
    return request<{ message: string }>(
      `/projects/${encodeURIComponent(projectId)}/teams/${encodeURIComponent(teamId)}`,
      {
        method: 'DELETE',
      }
    );
  },

  async associateProjectTeamAssignmentSet(
    projectId: string,
    payload: { team_assignment_set_id: string | null; apply_teams?: boolean }
  ): Promise<Project> {
    return request<Project>(`/projects/${encodeURIComponent(projectId)}/team-assignment-set`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async saveProjectAsTeamAssignmentSet(
    projectId: string,
    payload: { name: string; description?: string }
  ): Promise<{ message: string; set: TeamAssignmentSet }> {
    return request<any>(`/projects/${encodeURIComponent(projectId)}/save-as-team-assignment-set`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async cloneProjectTeamAssignmentSet(
    projectId: string,
    payload?: { name?: string; description?: string; source_set_id?: string }
  ): Promise<Project> {
    return request<Project>(`/projects/${encodeURIComponent(projectId)}/clone-set`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },

  // Project Association Mode & Individual Members
  async updateProjectAssignmentMode(
    projectId: string,
    payload: {
      association_type: ProjectAssociationType;
      team_assignment_set_id?: string | null;
      members?: Array<{ user_id: string; role?: string }>;
    }
  ): Promise<Project> {
    return request<Project>(`/projects/${encodeURIComponent(projectId)}/assignment-mode`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getProjectIndividualMembers(projectId: string): Promise<{
    project_id: string;
    association_type: ProjectAssociationType;
    individual_members: ProjectIndividualMember[];
  }> {
    return request<any>(`/projects/${encodeURIComponent(projectId)}/individual-members`);
  },

  async addProjectIndividualMember(
    projectId: string,
    payload: { user_id: string; role?: string }
  ): Promise<{ message: string; individual_members: ProjectIndividualMember[] }> {
    return request<any>(`/projects/${encodeURIComponent(projectId)}/individual-members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateProjectIndividualMemberRole(
    projectId: string,
    memberUserId: string,
    role: string
  ): Promise<{ message: string; individual_members: ProjectIndividualMember[] }> {
    return request<any>(
      `/projects/${encodeURIComponent(projectId)}/individual-members/${encodeURIComponent(memberUserId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }
    );
  },

  async removeProjectIndividualMember(
    projectId: string,
    memberUserId: string
  ): Promise<{ message: string; individual_members: ProjectIndividualMember[] }> {
    return request<any>(
      `/projects/${encodeURIComponent(projectId)}/individual-members/${encodeURIComponent(memberUserId)}`,
      {
        method: 'DELETE',
      }
    );
  },
};

