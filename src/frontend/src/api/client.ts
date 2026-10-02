import {
  DemoUser,
  Document,
  DocumentCreatePayload,
  DocumentUpdatePayload,
  Project,
  Organization,
  Team,
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

  // Backwards compatibility aliases for Team
  listTeams(): Promise<Team[]> {
    return this.listOrganizations();
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
  }): Promise<Project> {
    return request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        organization_id: payload.organization_id || payload.team_id || null,
      }),
    });
  },

  async updateProject(id: string, payload: { name?: string; description?: string }): Promise<Project> {
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

  getMarkdownExportUrl(id: string): string {
    return `${API_BASE}/documents/${encodeURIComponent(id)}/export/markdown`;
  },
};
