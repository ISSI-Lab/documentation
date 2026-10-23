import React, { useState, useEffect } from 'react';
import {
  X,
  FileCode,
  Sparkles,
  BookOpen,
  Presentation,
  Check,
  FolderKanban,
  User as UserIcon,
} from 'lucide-react';
import { CompilerType, LatexTemplate, Organization, Project, User } from '../../../types';
import { api } from '../../../api/client';

interface CreateLatexDocumentModalProps {
  isOpen: boolean;
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
  projects,
  currentUser,
  initialTemplateId,
  initialProjectId,
  onClose,
  onCreated,
  showToast,
}) => {
  const [templates, setTemplates] = useState<LatexTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('blank');
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [author, setAuthor] = useState('');
  const [compiler, setCompiler] = useState<CompilerType>('pdflatex');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setProjectId(initialProjectId || null);
      setSelectedTemplateId(initialTemplateId || 'blank');
      setAuthor(currentUser?.name || currentUser?.username || '');
      setCompiler('pdflatex');
      setError(null);
      loadTemplates();
    }
  }, [isOpen, initialTemplateId, initialProjectId, currentUser]);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const list = await api.listLatexTemplates();
      setTemplates(list);
      if (initialTemplateId && list.some((t) => t.id === initialTemplateId)) {
        setSelectedTemplateId(initialTemplateId);
        const selected = list.find((t) => t.id === initialTemplateId);
        if (selected) {
          setTitle(`${selected.title} - Draft`);
          setCompiler(selected.compiler || 'pdflatex');
        }
      }
    } catch (err: any) {
      console.warn('Could not load LaTeX templates:', err.message);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (tplId === 'blank') {
      setTitle('Untitled LaTeX Document');
      setCompiler('pdflatex');
    } else {
      const selected = templates.find((t) => t.id === tplId);
      if (selected) {
        setTitle(`${selected.title} - Draft`);
        setCompiler(selected.compiler || 'pdflatex');
      }
    }
  };

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

          {/* 1. Template Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select LaTeX Starter Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Blank Template Option */}
              <div
                onClick={() => handleSelectTemplate('blank')}
                className={`p-3.5 border cursor-pointer transition-all ${
                  selectedTemplateId === 'blank'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">Blank Project</span>
                  </div>
                  {selectedTemplateId === 'blank' && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Start with a clean, minimal <code>main.tex</code> file and configure your own structure.
                </p>
              </div>

              {/* Seed Templates */}
              {templates.map((tpl) => {
                const isSelected = selectedTemplateId === tpl.id;
                const isBeamer = tpl.category === 'Presentation' || tpl.title.includes('Beamer');
                const isReport = tpl.category === 'Technical Report' || tpl.title.includes('Report');

                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className={`p-3.5 border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2 truncate">
                        {isBeamer ? (
                          <Presentation className="w-4 h-4 text-indigo-600" />
                        ) : isReport ? (
                          <BookOpen className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <FileCode className="w-4 h-4 text-indigo-600" />
                        )}
                        <span className="text-xs font-bold text-slate-900 truncate">{tpl.title}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{tpl.description}</p>
                    <div className="mt-2 flex items-center space-x-2 text-[10px] text-slate-400">
                      <span className="uppercase px-1.5 py-0.5 bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                        {tpl.compiler}
                      </span>
                      <span>{tpl.template_files?.length || 1} files</span>
                    </div>
                  </div>
                );
              })}
            </div>
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

          {/* 4. Compiler Engine */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">TeX Compiler Engine</label>
            <div className="grid grid-cols-3 gap-2">
              {(['pdflatex', 'xelatex', 'lualatex'] as CompilerType[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCompiler(c)}
                  className={`py-2 text-xs font-semibold border transition-colors ${
                    compiler === c
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {c === 'pdflatex' ? 'pdfLaTeX (Standard)' : c === 'xelatex' ? 'XeLaTeX (Fonts)' : 'LuaLaTeX'}
                </button>
              ))}
            </div>
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
