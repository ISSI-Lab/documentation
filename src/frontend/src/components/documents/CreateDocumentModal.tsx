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

  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('personal');
  const [isSubmittable, setIsSubmittable] = useState(false);
  const [author, setAuthor] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state when opened or props change
  useEffect(() => {
    if (isOpen) {
      let targetOrgId = '';
      if (initialSelectedProjectId) {
        const p = projects.find((proj) => proj.id === initialSelectedProjectId);
        if (p?.organization_id || p?.team_id) {
          targetOrgId = (p.organization_id || p.team_id)!;
        }
      } else if (initialOrgId) {
        targetOrgId = initialOrgId;
      } else if (organizations.length > 0) {
        targetOrgId = organizations[0].id;
      }
      setSelectedOrgId(targetOrgId);

      const targetProjId = initialSelectedProjectId || null;
      setProjectId(targetProjId);

      const targetProj = projects.find((proj) => proj.id === targetProjId);
      const isIndiv = targetProj?.association_type === 'individual';
      const isPersonalWs = !targetProj && !targetOrgId;

      // Force personal if individual project or personal workspace
      setDocumentType(isIndiv || isPersonalWs ? 'personal' : 'project_shared');
      setIsSubmittable(false);
      setTitle('');
      setTagsInput('');
      setError(null);
      setAuthor(currentUser?.name || currentUser?.username || '');

      // Select template
      if (initialSelectedTemplateId) {
        setTemplateId(initialSelectedTemplateId);
      } else {
        const availableTpls = templates.filter((t) => {
          if (t.visibility === 'public') return true;
          if (!targetOrgId) return !t.organization_id && !t.team_id;
          return t.organization_id === targetOrgId || t.team_id === targetOrgId;
        });
        setTemplateId(availableTpls.length > 0 ? availableTpls[0].id : (templates[0]?.id || ''));
      }
    }
  }, [isOpen, initialSelectedTemplateId, initialSelectedProjectId, initialOrgId, organizations, projects, currentUser]);

  // Selected project details
  const selectedProject = projects.find((p) => p.id === projectId);
  const isIndividualProject = selectedProject?.association_type === 'individual';
  const isTeamProject = selectedProject?.association_type === 'team';
  const isPersonalWorkspace = !projectId && !selectedOrgId;

  const currentOrg = organizations.find((o) => o.id === selectedOrgId);
  const isOrgCreator = Boolean(
    currentOrg?.is_creator ||
    (currentOrg?.created_by && currentUser?.id && currentOrg.created_by === currentUser.id) ||
    currentOrg?.user_role === 'owner'
  );
  const isSelectedProjectCreatorOnly = selectedProject?.document_creation_permission === 'creator_only';
  const isProjectCreator = Boolean(
    selectedProject?.created_by && currentUser?.id && selectedProject.created_by === currentUser.id
  );
  const canCreateInSelectedProject =
    !selectedProject ||
    !isSelectedProjectCreatorOnly ||
    isProjectCreator ||
    isOrgCreator;

  // Filter projects based on selected organization
  const availableProjects = projects.filter((p) => {
    const pOrgId = p.organization_id || p.team_id;
    if (!selectedOrgId) {
      return !pOrgId;
    } else {
      return pOrgId === selectedOrgId;
    }
  });

  // Filter templates based on current organization
  const availableTemplates = templates.filter((t) => {
    if (t.visibility === 'public') return true;
    const tOrgId = t.organization_id || t.team_id;
    if (!selectedOrgId) {
      return !tOrgId;
    } else {
      return tOrgId === selectedOrgId;
    }
  });

  // Strict constraint: individual projects and personal workspaces MUST be personal documents
  useEffect(() => {
    if ((isIndividualProject || isPersonalWorkspace) && documentType !== 'personal') {
      setDocumentType('personal');
    }
  }, [isIndividualProject, isPersonalWorkspace, documentType]);

  // If current templateId is not in availableTemplates, auto-select first available
  useEffect(() => {
    if (availableTemplates.length > 0 && !availableTemplates.some((t) => t.id === templateId)) {
      setTemplateId(availableTemplates[0].id);
    }
  }, [selectedOrgId, availableTemplates, templateId]);

  if (!isOpen) return null;

  // Handle changing organization
  const handleOrgChange = (newOrgId: string) => {
    setSelectedOrgId(newOrgId);
    if (projectId) {
      const proj = projects.find((p) => p.id === projectId);
      const projOrg = proj?.organization_id || proj?.team_id || '';
      if (projOrg !== newOrgId) {
        setProjectId(null);
      }
    }
  };

  // Handle changing project
  const handleProjectChange = (newProjId: string | null) => {
    setProjectId(newProjId);
    if (newProjId) {
      const proj = projects.find((p) => p.id === newProjId);
      if (proj && (proj.organization_id || proj.team_id)) {
        setSelectedOrgId((proj.organization_id || proj.team_id)!);
      }
      if (proj?.association_type === 'individual') {
        setDocumentType('personal');
      }
    }
  };

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
    if (selectedProject && !canCreateInSelectedProject) {
      setError('This project is restricted to Creator Only. Only the project creator can author documents in this project.');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const targetOrgId = selectedOrgId || null;

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
              Author a new specification or deliverable using reusable blueprints.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Workspace & Project Location */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Organization Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Workspace Location
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => handleOrgChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white rounded"
                >
                  <option value="">Personal Workspace (Private)</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} {org.user_role ? `(${org.user_role})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Workspace Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FolderKanban className="w-3.5 h-3.5 text-blue-600" /> Project Workspace (Optional)
                </label>
                <select
                  value={projectId || ''}
                  onChange={(e) => handleProjectChange(e.target.value ? e.target.value : null)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white rounded"
                >
                  <option value="">(No Project / Standalone)</option>
                  {availableProjects.map((p) => {
                    const isCreatorOnly = p.document_creation_permission === 'creator_only';
                    const isProjCreator = Boolean(p.created_by && currentUser?.id && p.created_by === currentUser.id);
                    const canCreate = !isCreatorOnly || isProjCreator || isOrgCreator;
                    return (
                      <option key={p.id} value={p.id} disabled={!canCreate}>
                        {p.name} {p.association_type ? `(${p.association_type === 'individual' ? 'Individual' : 'Team Formation'})` : ''} {!canCreate ? '(Locked: Creator Only)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {selectedProject && !canCreateInSelectedProject && (
              <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  This project allows document creation by <strong>Owner/Creator Only</strong>. You cannot create documents in this project.
                </span>
              </div>
            )}
          </div>

          {/* Document Type & Collaboration (Single Unified Selector) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5 text-blue-600" /> Document Type & Collaboration *
              </label>
              {isIndividualProject && (
                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-600" /> Individual Project: Personal Only
                </span>
              )}
              {isTeamProject && (
                <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                  Team Formation: Choose Personal or Shared
                </span>
              )}
              {isPersonalWorkspace && (
                <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                  Personal Workspace: Personal Only
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Personal Document Option */}
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
                  {isIndividualProject
                    ? 'Individual deliverable authored per person (Required for individual project).'
                    : isTeamProject
                    ? 'Individual deliverable authored separately by each team member.'
                    : 'Individual personal document authored by you.'}
                </p>
              </div>

              {/* Project Shared Document Option */}
              <div
                onClick={() => {
                  if (!isIndividualProject && !isPersonalWorkspace) {
                    setDocumentType('project_shared');
                  }
                }}
                className={`p-3 border transition-all ${
                  isIndividualProject || isPersonalWorkspace
                    ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                    : documentType === 'project_shared'
                    ? 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-600 shadow-sm cursor-pointer'
                    : 'bg-white border-slate-300 hover:border-slate-400 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-600" /> Project Shared Document
                  </span>
                  {isIndividualProject ? (
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 font-semibold rounded">
                      Unavailable
                    </span>
                  ) : isPersonalWorkspace ? (
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 font-semibold rounded">
                      Unavailable
                    </span>
                  ) : documentType === 'project_shared' ? (
                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 font-bold rounded">
                      Selected
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {isIndividualProject
                    ? 'Unavailable: This project is assigned by individuals. Documents under it only allow Personal Documents.'
                    : isPersonalWorkspace
                    ? 'Unavailable: Shared editing requires an organization or team project.'
                    : isTeamProject
                    ? 'Shared deliverable authored together by assigned squad/team.'
                    : 'Shared editing among team & project members.'}
                </p>
              </div>
            </div>
          </div>

          {/* Submittable Deliverable Toggle */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded">
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

          {/* Base Template Blueprint */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              Base Template Blueprint *
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white rounded"
            >
              {availableTemplates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title} ({tpl.visibility === 'public' ? 'Public Pool' : (tpl.organization_id || tpl.team_id) ? 'Organization Template' : 'Personal'} - {tpl.document_elements?.length || 0} sections)
                </option>
              ))}
            </select>

            {/* Template Info Card */}
            {selectedTemplate && (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 text-xs text-slate-600 rounded">
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
                className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none rounded"
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
                className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none rounded"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !canCreateInSelectedProject}
              className="inline-flex items-center px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-50 transition-colors cursor-pointer border border-blue-700 rounded"
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
