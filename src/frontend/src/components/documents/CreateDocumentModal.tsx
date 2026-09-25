import React, { useState, useEffect } from 'react';
import { X, FilePlus, Sparkles, FolderKanban, Users, User as UserIcon, Globe, Lock } from 'lucide-react';
import { DocumentCreatePayload, Project, Team, Template, User } from '../../types';

interface CreateDocumentModalProps {
  isOpen: boolean;
  templates: Template[];
  teams?: Team[];
  projects: Project[];
  currentUser?: User | null;
  initialSelectedTemplateId?: string | null;
  initialSelectedProjectId?: string | null;
  initialSelectedTeamId?: string | null;
  onClose: () => void;
  onCreate: (payload: DocumentCreatePayload) => Promise<void>;
}

export const CreateDocumentModal: React.FC<CreateDocumentModalProps> = ({
  isOpen,
  templates,
  teams = [],
  projects,
  currentUser,
  initialSelectedTemplateId,
  initialSelectedProjectId,
  initialSelectedTeamId,
  onClose,
  onCreate,
}) => {
  // Determine initial scope
  const getInitialScope = (): 'personal' | 'team' => {
    if (initialSelectedTeamId) return 'team';
    if (initialSelectedProjectId) {
      const p = projects.find((proj) => proj.id === initialSelectedProjectId);
      if (p && p.team_id) return 'team';
    }
    return teams.length > 0 ? 'team' : 'personal';
  };

  const [scope, setScope] = useState<'personal' | 'team'>('personal');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [author, setAuthor] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state when opened or inputs change
  useEffect(() => {
    if (isOpen) {
      const initialScopeVal = getInitialScope();
      setScope(initialScopeVal);

      let targetTeamId = '';
      if (initialSelectedTeamId) {
        targetTeamId = initialSelectedTeamId;
      } else if (initialSelectedProjectId) {
        const p = projects.find((proj) => proj.id === initialSelectedProjectId);
        if (p?.team_id) {
          targetTeamId = p.team_id;
        }
      } else if (teams.length > 0) {
        targetTeamId = teams[0].id;
      }
      setSelectedTeamId(targetTeamId);

      setProjectId(initialSelectedProjectId || null);
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
          if (initialScopeVal === 'personal') return t.team_id === null;
          return t.team_id === targetTeamId;
        });
        setTemplateId(availableTpls.length > 0 ? availableTpls[0].id : (templates[0]?.id || ''));
      }
    }
  }, [isOpen, initialSelectedTemplateId, initialSelectedProjectId, initialSelectedTeamId, teams, projects, currentUser]);

  // Filter projects based on current scope & team
  const availableProjects = projects.filter((p) => {
    if (scope === 'personal') {
      return p.team_id === null;
    } else {
      return selectedTeamId ? p.team_id === selectedTeamId : true;
    }
  });

  // Filter templates based on current scope & team
  const availableTemplates = templates.filter((t) => {
    if (t.visibility === 'public') return true;
    if (scope === 'personal') {
      return t.team_id === null;
    } else {
      return selectedTeamId ? t.team_id === selectedTeamId : true;
    }
  });

  // If current templateId is not in availableTemplates, auto-select first available
  useEffect(() => {
    if (availableTemplates.length > 0 && !availableTemplates.some((t) => t.id === templateId)) {
      setTemplateId(availableTemplates[0].id);
    }
  }, [scope, selectedTeamId, availableTemplates, templateId]);

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

      const targetTeamId = scope === 'team' ? (selectedTeamId || null) : null;

      await onCreate({
        title: title.trim(),
        template_id: templateId,
        team_id: targetTeamId,
        project_id: projectId || null,
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
          {/* Scope Selection: Personal vs Team */}
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
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 font-bold">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Private to your personal workspace (without a team).
                </p>
              </div>

              {/* Team Option */}
              <div
                onClick={() => {
                  setScope('team');
                  if (!selectedTeamId && teams.length > 0) {
                    setSelectedTeamId(teams[0].id);
                  }
                }}
                className={`p-3 border cursor-pointer transition-all ${
                  scope === 'team'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-1 ring-indigo-600 shadow-sm'
                    : 'bg-white border-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-indigo-600" /> Team Document
                  </span>
                  {scope === 'team' && (
                    <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 font-bold">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Collaborate and co-author with members of your team.
                </p>
              </div>
            </div>
          </div>

          {/* Team Selector when scope === 'team' */}
          {scope === 'team' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-600" /> Select Target Team *
              </label>
              {teams.length > 0 ? (
                <select
                  value={selectedTeamId}
                  onChange={(e) => {
                    setSelectedTeamId(e.target.value);
                    setProjectId(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.user_role ? `(${t.user_role})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  You are not a member of any team yet. Switch to Personal Document or join/create a team first.
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
                  {tpl.title} ({tpl.visibility === 'public' ? 'Public Pool' : tpl.team_id ? 'Team Template' : 'Personal'} - {tpl.document_elements?.length || 0} sections)
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
                    ) : selectedTemplate.team_id ? (
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    {selectedTemplate.description || 'Standard document template'}
                  </span>
                  <span className="text-blue-600 font-semibold text-[10px] bg-blue-50 px-2 py-0.5 border border-blue-200">
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
