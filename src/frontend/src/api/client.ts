import {
  Document,
  DocumentCreatePayload,
  DocumentUpdatePayload,
  Template,
  TemplateCreatePayload,
} from '../types';

const API_BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
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
  // Templates
  async listTemplates(): Promise<Template[]> {
    return request<Template[]>('/templates');
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
  async listDocuments(templateId?: string, search?: string): Promise<Document[]> {
    const params = new URLSearchParams();
    if (templateId) params.append('template_id', templateId);
    if (search) params.append('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';
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
