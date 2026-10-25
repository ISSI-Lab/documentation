import React, { useState, useEffect } from 'react';
import {
  X,
  FileCode,
  Sparkles,
  FolderKanban,
  User as UserIcon,
  Globe,
  Lock,
  Building2,
  Settings,
} from 'lucide-react';
import { CompilerType, LatexTemplate, Organization, Project, User } from '../../../types';
import { api } from '../../../api/client';

interface CreateLatexDocumentModalProps {
  isOpen: boolean;
  templates?: LatexTemplate[];
  projects: Project[];
  organizations?: Organization[];
  currentUser?: User | null;
  initialTemplateId?: string | null;
  initialProjectId?: string | null;
  onClose: () => void;
  onCreated: (documentId: string) => void;
  showToast?: (message: string, type?: 'success' | 'error') => void;
}

export const CreateLatexDocumentModal: React.FC<CreateLatexDocumentModalProps> = ({
  isOpen,
  templates: propTemplates = [],
  projects,
  organizations = [],
  currentUser,
  initialTemplateId,
  initialProjectId,
  onClose,
  onCreated,
  showToast,
}) => {
  const [fetchedTemplates, setFetchedTemplates] = useState<LatexTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId || 'blank');
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [author, setAuthor] = useState('');
  const [compiler, setCompiler] = useState<CompilerType>('pdflatex');
  const [showCompilerSettings, setShowCompilerSettings] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterAccessibleTemplates = (list: LatexTemplate[]): LatexTemplate[] => {
    if (!currentUser) {
      return list.filter((t) => t.visibility === 'public');
    }
    return list.filter((t) => {
      if (t.visibility === 'public') return true;
      if (initialTemplateId && t.id === initialTemplateId) return true;
      if (currentUser.user_type === 'organizer') return true;
      const orgId = t.organization_id || t.team_id;
      if (!orgId) {
        return !t.created_by || t.created_by === currentUser.id;
      }
      return organizations.some((o) => o.id === orgId) || t.created_by === currentUser.id;
    });
  };

  const templates = filterAccessibleTemplates(
    fetchedTemplates.length > 0 ? fetchedTemplates : propTemplates
  );

  useEffect(() => {
    if (isOpen) {
      const targetTplId = initialTemplateId || 'blank';
      setSelectedTemplateId(targetTplId);
      setProjectId(initialProjectId || null);
      setAuthor(currentUser?.name || currentUser?.username || '');
      setShowCompilerSettings(false);
      setError(null);

      const initialPool = filterAccessibleTemplates(
        propTemplates.length > 0 ? propTemplates : fetchedTemplates
      );
      if (targetTplId !== 'blank') {
        const selected = initialPool.find((t) => t.id === targetTplId);
        if (selected) {
          setTitle(`${selected.title} - Draft`);
          setCompiler(selected.compiler || 'pdflatex');
        } else {
          setTitle('');
          setCompiler('pdflatex');
        }
      } else {
        setTitle('');
        setCompiler('pdflatex');
      }

      loadTemplates(targetTplId);
    }
  }, [isOpen, initialTemplateId]);

  const loadTemplates = async (targetTplId?: string) => {
    try {
      const list = await api.listLatexTemplates();
      setFetchedTemplates(list);
      const accessible = filterAccessibleTemplates(list);
      const idToSelect = targetTplId ?? initialTemplateId ?? 'blank';
      if (idToSelect && idToSelect !== 'blank' && accessible.some((t) => t.id === idToSelect)) {
        setSelectedTemplateId(idToSelect);
        const selected = accessible.find((t) => t.id === idToSelect);
        if (selected) {
          setTitle((prev) => (prev.trim() ? prev : `${selected.title} - Draft`));
          setCompiler(selected.compiler || 'pdflatex');
        }
      }
    } catch (err: any) {
      console.warn('Could not load LaTeX templates:', err.message);
    }
  };

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (tplId === 'blank') {
      setTitle((prev) => (!prev.trim() || prev.endsWith(' - Draft') ? 'Untitled LaTeX Document' : prev));
      setCompiler('pdflatex');
    } else {
      const selected = templates.find((t) => t.id === tplId);
      if (selected) {
        setTitle((prev) =>
          !prev.trim() || prev === 'Untitled LaTeX Document' || prev.endsWith(' - Draft')
            ? `${selected.title} - Draft`
            : prev
        );
        setCompiler(selected.compiler || 'pdflatex');
      }
    }
  };

  const selectedTemplate =
    selectedTemplateId !== 'blank' ? templates.find((t) => t.id === selectedTemplateId) || null : null;
  const selectedTplOrgId = selectedTemplate?.organization_id || selectedTemplate?.team_id || null;
  const selectedTplOrg = selectedTplOrgId ? organizations.find((o) => o.id === selectedTplOrgId) : null;

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Document title is required');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const targetTemplateId = selectedTemplateId === 'blank' ? 'tpl-latex-blank' : selectedTemplateId;
      const targetProject = projects.find((p) => p.id === projectId);
      const orgId = targetProject?.organization_id || null;

      const created = await api.createDocument({
        title: title.trim(),
        template_id: targetTemplateId,
        project_id: projectId || null,
        organization_id: orgId,
        format: 'latex',
        compiler,
        author: author.trim() || undefined,
        document_type: projectId ? 'project_shared' : 'personal',
      });

      showToast?.('LaTeX document created successfully', 'success');
      onCreated(created.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create LaTeX document');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white max-w-2xl w-full border border-slate-300 shadow-2xl mui-paper flex flex-col my-8 max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">New LaTeX Document</h2>
              <p className="text-xs text-slate-500">Create a multi-file LaTeX project from a template or start blank</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200">
              {error}
            </div>
          )}

          {/* 1. Template Selection (Dropdown Menu) */}
          <div>
            <label
              htmlFor="latex-template-select"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Select LaTeX Starter Template
            </label>
            <select
              id="latex-template-select"
              data-testid="latex-template-select"
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="w-full text-xs border border-slate-300 px-3 py-2 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            >
              <option value="blank">
                Blank Project (Clean main.tex - 1 file)
              </option>
              {templates.map((tpl) => {
                const tplOrgId = tpl.organization_id || tpl.team_id || null;
                const tplOrg = tplOrgId ? organizations.find((o) => o.id === tplOrgId) : null;
                const scopeLabel =
                  tpl.visibility === 'public'
                    ? 'Public Pool'
                    : tplOrgId
                    ? tplOrg
                      ? tplOrg.name
                      : 'Organization Template'
                    : 'Personal';
                const fileCount = tpl.template_files?.length || 1;
                return (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title} ({scopeLabel} - {(tpl.compiler || 'pdflatex').toUpperCase()} - {fileCount}{' '}
                    {fileCount === 1 ? 'file' : 'files'})
                  </option>
                );
              })}
            </select>

            {/* Selected Template Summary */}
            {selectedTemplate ? (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <div className="flex items-center justify-between gap-2 font-medium text-slate-800">
                  <span className="flex items-center gap-1.5 min-w-0">
                    {selectedTemplate.visibility === 'public' ? (
                      <Globe className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    ) : selectedTplOrgId ? (
                      <Building2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    )}
                    <span className="truncate">
                      {selectedTemplate.description || 'Pre-configured multi-file LaTeX project template.'}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="px-1.5 py-0.5 bg-white text-slate-600 font-semibold text-[10px] border border-slate-200">
                      {selectedTemplate.visibility === 'public'
                        ? 'Public'
                        : selectedTplOrgId
                        ? selectedTplOrg
                          ? selectedTplOrg.name
                          : 'Organization'
                        : 'Personal'}
                    </span>
                    <span className="uppercase px-1.5 py-0.5 bg-slate-100 text-slate-700 font-semibold text-[10px] border border-slate-200">
                      {selectedTemplate.compiler || 'pdflatex'}
                    </span>
                    <span className="text-indigo-700 font-semibold text-[10px] bg-indigo-50 px-2 py-0.5 border border-indigo-200">
                      {selectedTemplate.template_files?.length || 1} files
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>
                    Start with a clean, minimal <code>main.tex</code> file and configure your own structure.
                  </span>
                </span>
                <span className="text-indigo-700 font-semibold text-[10px] bg-indigo-50 px-2 py-0.5 border border-indigo-200 flex-shrink-0">
                  1 file
                </span>
              </div>
            )}
          </div>

          {/* 2. Document Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Document Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Consensus Verification Report"
              className="w-full text-xs border border-slate-300 px-3 py-2 outline-none focus:border-indigo-600 bg-white"
            />
          </div>

          {/* 3. Project & Author Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                <FolderKanban className="w-3.5 h-3.5 mr-1 text-slate-500" />
                Project (Optional)
              </label>
              <select
                value={projectId || ''}
                onChange={(e) => setProjectId(e.target.value ? e.target.value : null)}
                className="w-full text-xs border border-slate-300 px-3 py-2 outline-none focus:border-indigo-600 bg-white"
              >
                <option value="">Personal Document (No Project)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                <UserIcon className="w-3.5 h-3.5 mr-1 text-slate-500" />
                Author Name
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author name"
                className="w-full text-xs border border-slate-300 px-3 py-2 outline-none focus:border-indigo-600 bg-white"
              />
            </div>
          </div>

          {/* 4. Compiler Engine (Hidden behind Settings Icon Button) */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-slate-600">
                <span>Compile Engine:</span>
                <span className="uppercase px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                  {compiler}
                </span>
              </div>
              <button
                type="button"
                data-testid="modal-latex-settings-btn"
                onClick={() => setShowCompilerSettings((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border transition-colors cursor-pointer ${
                  showCompilerSettings
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-300'
                }`}
                title="Configure TeX Compiler Engine"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            </div>

            {showCompilerSettings && (
              <div
                data-testid="modal-latex-settings-panel"
                className="mt-3 p-3 bg-slate-50 border border-slate-200 space-y-2"
              >
                <label className="block text-xs font-semibold text-slate-700">
                  TeX Compiler Engine
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['pdflatex', 'xelatex', 'lualatex'] as CompilerType[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCompiler(c)}
                      className={`py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                        compiler === c
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {c === 'pdflatex' ? 'pdfLaTeX (Standard)' : c === 'xelatex' ? 'XeLaTeX (Fonts)' : 'LuaLaTeX'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 border border-slate-300 bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
          >
            {creating ? 'Creating Project...' : 'Create LaTeX Document'}
          </button>
        </div>
      </div>
    </div>
  );
};
