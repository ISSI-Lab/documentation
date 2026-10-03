import React, { useState, useEffect } from 'react';
import {
  X,
  FilePlus,
  Sparkles,
  FolderKanban,
  Users,
  User as UserIcon,
  Globe,
  Lock,
  Building2,
  Send,
  CheckSquare,
  MessageSquare,
  Share2,
} from 'lucide-react';
import { DocumentCreatePayload, DocumentType, Organization, Project, Team, Template, User } from '../../types';

interface CreateDocumentModalProps {
  isOpen: boolean;
  templates: Template[];
  organizations?: Organization[];
  teams?: Team[]; // compatibility alias
  projects: Project[];
  currentUser?: User | null;
  initialSelectedTemplateId?: string | null;
  initialSelectedProjectId?: string | null;
  initialSelectedOrganizationId?: string | null;
  initialSelectedTeamId?: string | null; // compatibility alias
  onClose: () => void;
  onCreate: (payload: DocumentCreatePayload) => Promise<void>;
}

export const CreateDocumentModal: React.FC<CreateDocumentModalProps> = ({
  isOpen,
  templates,
  organizations: propOrganizations,
  teams: propTeams,
  projects,
  currentUser,
  initialSelectedTemplateId,
  initialSelectedProjectId,
  initialSelectedOrganizationId,
  initialSelectedTeamId,
  onClose,
  onCreate,
}) => {
  const organizations = propOrganizations || propTeams || [];
  const initialOrgId = initialSelectedOrganizationId || initialSelectedTeamId || null;

  // Determine initial scope
  const getInitialScope = (): 'personal' | 'organization' => {
    if (initialOrgId) return 'organization';
    if (initialSelectedProjectId) {
      const p = projects.find((proj) => proj.id === initialSelectedProjectId);
      if (p && (p.organization_id || p.team_id)) return 'organization';
    }
    return organizations.length > 0 ? 'organization' : 'personal';
  };

  const [scope, setScope] = useState<'personal' | 'organization'>('personal');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('project_shared');
  const [isSubmittable, setIsSubmittable] = useState(false);
  const [author, setAuthor] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state when opened or inputs change
  useEffect(() => {
    if (isOpen) {
      const initialScopeVal = getInitialScope();
      setScope(initialScopeVal);

      let targetOrgId = '';
      if (initialOrgId) {
        targetOrgId = initialOrgId;
      } else if (initialSelectedProjectId) {
        const p = projects.find((proj) => proj.id === initialSelectedProjectId);
        if (p?.organization_id || p?.team_id) {
          targetOrgId = (p.organization_id || p.team_id)!;
        }
      } else if (organizations.length > 0) {
        targetOrgId = organizations[0].id;
      }
      setSelectedOrgId(targetOrgId);

      setProjectId(initialSelectedProjectId || null);
      setTitle('');
      setTagsInput('');
      setDocumentType('project_shared');
      setIsSubmittable(false);
      setError(null);
      setAuthor(currentUser?.name || currentUser?.username || '');

      // Select template
      if (initialSelectedTemplateId) {
        setTemplateId(initialSelectedTemplateId);
      } else {
        const availableTpls = templates.filter((t) => {
          if (t.visibility === 'public') return true;
          if (initialScopeVal === 'personal') return !t.organization_id && !t.team_id;
          return t.organization_id === targetOrgId || t.team_id === targetOrgId;
        });
        setTemplateId(availableTpls.length > 0 ? availableTpls[0].id : (templates[0]?.id || ''));
      }
    }
  }, [isOpen, initialSelectedTemplateId, initialSelectedProjectId, initialOrgId, organizations, projects, currentUser]);

  // Filter projects based on current scope & organization
  const availableProjects = projects.filter((p) => {
    const pOrgId = p.organization_id || p.team_id;
    if (scope === 'personal') {
      return !pOrgId;
    } else {
      return selectedOrgId ? pOrgId === selectedOrgId : true;
    }
  });

  // Filter templates based on current scope & organization
  const availableTemplates = templates.filter((t) => {
    if (t.visibility === 'public') return true;
    const tOrgId = t.organization_id || t.team_id;
    if (scope === 'personal') {
      return !tOrgId;
    } else {
      return selectedOrgId ? tOrgId === selectedOrgId : true;
    }
  });

  // If current templateId is not in availableTemplates, auto-select first available
  useEffect(() => {
    if (availableTemplates.length > 0 && !availableTemplates.some((t) => t.id === templateId)) {
      setTemplateId(availableTemplates[0].id);
    }
  }, [scope, selectedOrgId, availableTemplates, templateId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Document title is required.');
      return;
    }
    if (!templateId) {
      setError('Please select a template to base this document on.');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const targetOrgId = scope === 'organization' ? (selectedOrgId || null) : null;

      await onCreate({
        title: title.trim(),
        template_id: templateId,
        organization_id: targetOrgId,
        team_id: targetOrgId,
        project_id: projectId || null,
        document_type: documentType,
        is_submittable: isSubmittable,
        author: author.trim() || currentUser?.name || currentUser?.username || 'Anonymous',
        tags,
      });

      // Reset form on success
      setTitle('');
      setTagsInput('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create document.');
    } finally {
      setCreating(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white border border-slate-300 max-w-xl w-full p-6 shadow-xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-200">
          <div className="p-2.5 bg-blue-50 text-blue-600 border border-blue-200">
            <FilePlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create New Document</h2>
            <p className="text-xs text-slate-500">
              Author a new specification or document using reusable blueprints.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Scope Selection: Personal vs Organization */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Document Ownership & Scope *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Personal Option */}
              <div
                onClick={() => {
                  setScope('personal');
                  setProjectId(null);
                }}
                className={`p-3 border cursor-pointer transition-all ${
                  scope === 'personal'
                    ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-600 shadow-sm'
                    : 'bg-white border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-600" /> Personal Document
                  </span>
                  {scope === 'personal' && (
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 font-bold rounded">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Private to your personal workspace (without an organization).
                </p>
              </div>

              {/* Organization Option */}
              <div
                onClick={() => {
                  setScope('organization');
                  if (!selectedOrgId && organizations.length > 0) {
                    setSelectedOrgId(organizations[0].id);
                  }
                }}
                className={`p-3 border cursor-pointer transition-all ${
                  scope === 'organization'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-1 ring-indigo-600 shadow-sm'
                    : 'bg-white border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Organization Document
                  </span>
                  {scope === 'organization' && (
                    <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 font-bold rounded">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Collaborate and co-author with members of your organization.
                </p>
              </div>
            </div>
          </div>

          {/* Organization Selector when scope === 'organization' */}
          {scope === 'organization' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Select Target Organization *
              </label>
              {organizations.length > 0 ? (
                <select
                  value={selectedOrgId}
                  onChange={(e) => {
                    setSelectedOrgId(e.target.value);
                    setProjectId(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                >
                  {organizations.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.user_role ? `(${t.user_role})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  You are not a member of any organization yet. Switch to Personal Document or join/create an organization first.
                </div>
              )}
            </div>
          )}

          {/* Document Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Document Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. ADR-0004: Redis Cluster for Session Caching"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Project Selector (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <FolderKanban className="w-3.5 h-3.5 text-blue-600" /> Project Workspace (Optional)
            </label>
            <select
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value ? e.target.value : null)}
              className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="">(No Project / Standalone Document)</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Document Type: Personal Document vs Project Shared Document */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5 text-blue-600" /> Document Type & Collaboration
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Project Shared Document */}
              <div
                onClick={() => setDocumentType('project_shared')}
                className={`p-3 border cursor-pointer transition-all ${
                  documentType === 'project_shared'
                    ? 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-600 shadow-sm'
                    : 'bg-white border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-600" /> Project Shared Document
                  </span>
                  {documentType === 'project_shared' && (
                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 font-bold rounded">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Shared editing among team & project members.
                </p>
              </div>

              {/* Personal Document */}
              <div
                onClick={() => setDocumentType('personal')}
                className={`p-3 border cursor-pointer transition-all ${
                  documentType === 'personal'
                    ? 'bg-purple-50/70 border-purple-600 ring-1 ring-purple-600 shadow-sm'
                    : 'bg-white border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-purple-600" /> Personal Document
                  </span>
                  {documentType === 'personal' && (
                    <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.2 font-bold rounded">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Individual document authored per person.
                </p>
              </div>
            </div>
          </div>

          {/* Submittable Deliverable Toggle */}
          <div className="p-3.5 bg-slate-50 border border-slate-200">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isSubmittable}
                onChange={(e) => setIsSubmittable(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>Submittable Document (Enable Submissions)</span>
                  {isSubmittable && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 font-bold rounded">
                      Submissions Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {isSubmittable
                    ? documentType === 'personal'
                      ? "Each person has their own submission for the project creator to view and comment."
                      : "Team members edit together and submit according to team. The project creator can view and comment on each team's submission."
                    : 'When disabled, this document functions as a standard collaborative document.'}
                </p>
              </div>
            </label>
          </div>

          {/* Template Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              Base Template Blueprint *
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              {availableTemplates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title} ({tpl.visibility === 'public' ? 'Public Pool' : (tpl.organization_id || tpl.team_id) ? 'Organization Template' : 'Personal'} - {tpl.document_elements?.length || 0} sections)
                </option>
              ))}
            </select>

            {/* Template Info Card */}
            {selectedTemplate && (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <div className="flex items-center justify-between font-medium text-slate-800 mb-1">
                  <span className="flex items-center gap-1.5">
                    {selectedTemplate.visibility === 'public' ? (
                      <Globe className="w-3.5 h-3.5 text-blue-600" />
                    ) : (selectedTemplate.organization_id || selectedTemplate.team_id) ? (
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    {selectedTemplate.description || 'Standard document template'}
                  </span>
                  <span className="text-blue-600 font-semibold text-[10px] bg-blue-50 px-2 py-0.5 border border-blue-200 rounded">
                    {selectedTemplate.document_elements?.length || 0} sections
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Author & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Author
              </label>
              <input
                type="text"
                placeholder="e.g. Alex Morgan, Tech Lead"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. cache, redis, v2"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-50 transition-colors cursor-pointer border border-blue-700"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {creating ? 'Creating Document...' : 'Create & Start Writing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
