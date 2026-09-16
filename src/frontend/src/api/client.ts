import {
  DemoUser,
  Document,
  DocumentCreatePayload,
  DocumentUpdatePayload,
  Project,
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
    try {
      const errJson = await response.json();
      if (errJson.error) {
        errorDetail = errJson.error;
      } else if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
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
  }): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(res.token);
    return res;
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

  async getMe(): Promise<{ user: User; teams: Team[] }> {
    return request<{ user: User; teams: Team[] }>('/auth/me');
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

  // Teams
  async listTeams(): Promise<Team[]> {
    return request<Team[]>('/teams');
  },

  async createTeam(payload: { name: string; description?: string }): Promise<Team> {
    return request<Team>('/teams', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async joinTeam(payload: { join_code: string }): Promise<{ message: string; team: Team }> {
    return request<{ message: string; team: Team }>('/teams/join', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getTeam(id: string): Promise<{ team: Team }> {
    return request<{ team: Team }>(`/teams/${encodeURIComponent(id)}`);
  },

  async updateTeam(id: string, payload: { name?: string; description?: string }): Promise<Team> {
    return request<Team>(`/teams/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async regenerateTeamJoinToken(id: string): Promise<{ join_code: string }> {
    return request<{ join_code: string }>(`/teams/${encodeURIComponent(id)}/regenerate-token`, {
      method: 'POST',
    });
  },

  async addTeamMember(teamId: string, payload: { userId?: string; usernameOrEmail?: string; role?: 'manager' | 'member' }): Promise<{ message: string }> {
    return request<{ message: string }>(`/teams/${encodeURIComponent(teamId)}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateMemberRole(teamId: string, targetUserId: string, role: 'manager' | 'member'): Promise<{ message: string }> {
    return request<{ message: string }>(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(targetUserId)}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  async removeTeamMember(teamId: string, targetUserId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(targetUserId)}`, {
      method: 'DELETE',
    });
  },

  // Projects
  async listProjects(teamId?: string): Promise<Project[]> {
    const query = teamId ? `?team_id=${encodeURIComponent(teamId)}` : '';
    return request<Project[]>(`/projects${query}`);
  },

  async getProject(id: string): Promise<Project> {
    return request<Project>(`/projects/${encodeURIComponent(id)}`);
  },

  async createProject(payload: { team_id: string; name: string; description?: string }): Promise<Project> {
    return request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
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
    team_id?: string;
    visibility?: 'public' | 'private';
    tag?: string;
    search?: string;
  }): Promise<Template[]> {
    const sp = new URLSearchParams();
    if (params?.team_id) sp.append('team_id', params.team_id);
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
      body: JSON.stringify(payload),
    });
  },

  async updateTemplate(id: string, payload: Partial<TemplateCreatePayload>): Promise<Template> {
    return request<Template>(`/templates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
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
    team_id?: string;
    project_id?: string;
    template_id?: string;
    search?: string;
    tag?: string;
  }): Promise<Document[]> {
    const sp = new URLSearchParams();
    if (params?.team_id) sp.append('team_id', params.team_id);
    if (params?.project_id) sp.append('project_id', params.project_id);
    if (params?.template_id) sp.append('template_id', params.template_id);
    if (params?.search) sp.append('search', params.search);
    if (params?.tag) sp.append('tag', params.tag);
    const query = sp.toString() ? `?${sp.toString()}` : '';
    return request<Document[]>(`/documents${query}`);
  },

  async getDocument(id: string): Promise<Document> {
    return request<Document>(`/documents/${encodeURIComponent(id)}`);
  },

  async createDocument(payload: DocumentCreatePayload): Promise<Document> {
    return request<Document>('/documents', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateDocument(id: string, payload: DocumentUpdatePayload): Promise<Document> {
    return request<Document>(`/documents/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
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
