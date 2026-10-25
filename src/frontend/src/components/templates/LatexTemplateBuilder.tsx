import React, { useState } from 'react';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Save,
  FileCode,
  AlertCircle,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  Presentation,
  FileText,
} from 'lucide-react';
import {
  CompilerType,
  LatexTemplate,
  LatexTemplateCreatePayload,
  LatexTemplateFileEntry,
  Organization,
  Team,
  TemplateVisibility,
} from '../../types';

interface LatexTemplateBuilderProps {
  initialTemplate?: LatexTemplate | null;
  activeOrganizationId?: string | null;
  activeTeamId?: string | null;
  organizations?: Organization[];
  teams?: Team[];
  onSave: (payload: LatexTemplateCreatePayload) => Promise<void>;
  onCancel: () => void;
  onCopyTemplate?: (template: LatexTemplate) => void;
}

export const LatexTemplateBuilder: React.FC<LatexTemplateBuilderProps> = ({
  initialTemplate,
  activeOrganizationId,
  activeTeamId,
  organizations: propOrganizations,
  teams: propTeams,
  onSave,
  onCancel,
  onCopyTemplate,
}) => {
  const organizations = propOrganizations || propTeams || [];
  const initialActiveOrgId = activeOrganizationId || activeTeamId || null;

  const [title, setTitle] = useState(initialTemplate?.title || '');
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [category, setCategory] = useState(initialTemplate?.category || 'Academic');
  const [compiler, setCompiler] = useState<CompilerType>(initialTemplate?.compiler || 'pdflatex');
  const [icon, setIcon] = useState(initialTemplate?.icon || 'file-code-2');

  const initialScope: 'personal' | 'organization' | 'public' = initialTemplate
    ? initialTemplate.visibility === 'public'
      ? 'public'
      : initialTemplate.organization_id || initialTemplate.team_id
      ? 'organization'
      : 'personal'
    : organizations.length > 0 && initialActiveOrgId
    ? 'organization'
    : 'personal';

  const [scope, setScope] = useState<'personal' | 'organization' | 'public'>(initialScope);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    initialTemplate?.organization_id ||
      initialTemplate?.team_id ||
      initialActiveOrgId ||
      (organizations.length > 0 ? organizations[0].id : '')
  );
  const [tagsInput, setTagsInput] = useState(
    initialTemplate?.tags && Array.isArray(initialTemplate.tags)
      ? initialTemplate.tags.join(', ')
      : 'latex, academic'
  );

  const [files, setFiles] = useState<LatexTemplateFileEntry[]>(
    initialTemplate?.template_files && initialTemplate.template_files.length > 0
      ? initialTemplate.template_files.map((f) => ({ ...f }))
      : [
          {
            name: 'main.tex',
            path: 'main.tex',
            is_main: true,
            content: `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{Document Title}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
Provide a concise summary of the technical or research document here.
\\end{abstract}

\\section{Introduction}
Write your introduction here and cite references \\cite{sample2026}.

\\section{Methodology \\& Architecture}
\\begin{equation}
  f(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi)\\,e^{2 \\pi i \\xi x} \\,d\\xi
\\end{equation}

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}
`,
          },
          {
            name: 'references.bib',
            path: 'references.bib',
            is_main: false,
            content: `@article{sample2026,
  author = {Author, First and Collaborator, Second},
  title = {Structured Multi-File LaTeX Authoring in DocForge},
  journal = {Journal of Systems Engineering},
  year = {2026},
  volume = {14},
  pages = {1--12}
}
`,
          },
        ]
  );

  const [activeFileIdx, setActiveFileIdx] = useState<number>(0);
  const [newFileName, setNewFileName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddFile = () => {
    const cleanName = newFileName.trim() || `section_${files.length + 1}.tex`;
    if (files.some((f) => f.path.toLowerCase() === cleanName.toLowerCase())) {
      setError(`A file named "${cleanName}" already exists in this template.`);
      return;
    }
    setError(null);
    const isBib = cleanName.endsWith('.bib');
    const starterContent = isBib
      ? `@article{ref${files.length + 1},\n  author = {Author Name},\n  title = {Reference Title},\n  journal = {Journal},\n  year = {2026}\n}\n`
      : `% ${cleanName}\n\\section{New Section}\nAdd your LaTeX content here.\n`;

    const updated = [
      ...files,
      {
        name: cleanName,
        path: cleanName,
        is_main: false,
        content: starterContent,
      },
    ];
    setFiles(updated);
    setActiveFileIdx(updated.length - 1);
    setNewFileName('');
  };

  const handleRemoveFile = (idx: number) => {
    if (files.length <= 1) {
      setError('A LaTeX template must contain at least one source file.');
      return;
    }
    const wasMain = files[idx].is_main;
    const updated = files.filter((_, i) => i !== idx);
    if (wasMain && updated.length > 0) {
      updated[0].is_main = true;
    }
    setFiles(updated);
    setActiveFileIdx(Math.max(0, Math.min(activeFileIdx, updated.length - 1)));
  };

  const handleSetMainFile = (idx: number) => {
    const updated = files.map((f, i) => ({
      ...f,
      is_main: i === idx,
    }));
    setFiles(updated);
  };

  const handleUpdateFileContent = (idx: number, content: string) => {
    const updated = [...files];
    updated[idx] = { ...updated[idx], content };
    setFiles(updated);
  };

  const handleUpdateFileName = (idx: number, name: string) => {
    const updated = [...files];
    updated[idx] = {
      ...updated[idx],
      name,
      path: name,
    };
    setFiles(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('LaTeX template title is required.');
      return;
    }
    if (files.length === 0) {
      setError('A LaTeX template must contain at least one file.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const cleanTags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const finalVisibility: TemplateVisibility = scope === 'public' ? 'public' : 'private';
      const finalOrgId: string | null =
        scope === 'organization'
          ? selectedOrgId || organizations[0]?.id || null
          : null;

      const mainEntry = files.find((f) => f.is_main) || files[0];

      await onSave({
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || 'Academic',
        compiler,
        main_file: mainEntry.name.trim() || 'main.tex',
        icon,
        visibility: finalVisibility,
        organization_id: finalOrgId,
        team_id: finalOrgId,
        tags: cleanTags,
        template_files: files.map((f) => ({
          name: f.name.trim() || 'main.tex',
          path: (f.path || f.name).trim() || 'main.tex',
          is_main: f === mainEntry,
          content: f.content || '',
        })),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save LaTeX template.');
    } finally {
      setSaving(false);
    }
  };

  const currentFile = files[activeFileIdx] || files[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 mb-8">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileCode className="w-6 h-6 text-indigo-600" />
              {initialTemplate ? 'Edit LaTeX Template Blueprint' : 'Configure New LaTeX Template'}
            </h1>
            <p className="text-sm text-slate-500">
              Configure multi-file LaTeX starter files (.tex, .bib, .sty), compiler engine, and template visibility scope (Public, Personal, or Organization).
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {initialTemplate && (initialTemplate.organization_id || initialTemplate.team_id) && onCopyTemplate && (
            <button
              type="button"
              onClick={() => onCopyTemplate(initialTemplate)}
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shadow-xs transition-colors"
            >
              <Copy className="w-4 h-4 mr-1.5 text-indigo-600" />
              Copy to Another Org
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving...' : 'Save LaTeX Template'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center space-x-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Metadata & Multi-File Source Editor */}
        <div className="lg:col-span-8 space-y-8">
          {/* Metadata Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              LaTeX Template Information & Visibility Scope
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  LaTeX Template Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ACM Research Paper (LaTeX) or Internal Engineering Spec"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                >
                  <option value="Conference">Conference</option>
                  <option value="Technical Report">Technical Report</option>
                  <option value="Presentation">Presentation (Beamer)</option>
                  <option value="Academic">Academic</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Thesis">Thesis</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  TeX Compiler Engine
                </label>
                <select
                  value={compiler}
                  onChange={(e) => setCompiler(e.target.value as CompilerType)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                >
                  <option value="pdflatex">pdfLaTeX (Standard)</option>
                  <option value="xelatex">XeLaTeX (Unicode & Custom Fonts)</option>
                  <option value="lualatex">LuaLaTeX</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Icon
                </label>
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                >
                  <option value="file-code-2">LaTeX Code (file-code-2)</option>
                  <option value="book-open">Report / Thesis (book-open)</option>
                  <option value="presentation">Slides / Beamer (presentation)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. latex, ieee, beamer, report"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain the document structure, packages included, and intended use of this LaTeX template..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Scope Selection: Personal vs Organization vs Public */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  LaTeX Template Ownership & Visibility Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Personal (Private) */}
                  <div
                    onClick={() => setScope('personal')}
                    className={`cursor-pointer p-3 border transition-all ${
                      scope === 'personal'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600 shadow-sm'
                        : 'border-slate-300 hover:border-slate-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">👤 Personal Template</span>
                      {scope === 'personal' && (
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Private to your personal account (visible only after signing in).
                    </p>
                  </div>

                  {/* Organization (Private) */}
                  <div
                    onClick={() => setScope('organization')}
                    className={`cursor-pointer p-3 border transition-all ${
                      scope === 'organization'
                        ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600 shadow-sm'
                        : 'border-slate-300 hover:border-slate-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">🏢 Organization Template</span>
                      {scope === 'organization' && (
                        <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Private to members of a specific organization (visible only after signing in).
                    </p>
                  </div>

                  {/* Public */}
                  <div
                    onClick={() => setScope('public')}
                    className={`cursor-pointer p-3 border transition-all ${
                      scope === 'public'
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 shadow-sm'
                        : 'border-slate-300 hover:border-slate-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">🌐 Public Pool</span>
                      {scope === 'public' && (
                        <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Visible on the unauthenticated landing page, home page, and public template pool.
                    </p>
                  </div>
                </div>
              </div>

              {/* Organization Selector when scope === 'organization' */}
              {scope === 'organization' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Owning Organization *
                  </label>
                  {organizations.length > 0 ? (
                    <select
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                      {organizations.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.user_role ? `(${t.user_role})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      You are not currently in any organization. Create an organization first to publish organization templates, or select Personal Template.
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Members of this organization will be able to create LaTeX documents from this private template.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Multi-File Source Bundle Configurator */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Bundled Source Files ({files.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Define the starter <code>.tex</code>, <code>.bib</code>, and <code>.sty</code> files included when a user creates a document from this template.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="e.g. chapter1.tex or refs.bib"
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-indigo-600"
                />
                <button
                  type="button"
                  onClick={handleAddFile}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add File
                </button>
              </div>
            </div>

            {/* File Tabs */}
            <div className="flex items-center gap-2 flex-wrap border-b border-slate-200 pb-3">
              {files.map((f, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveFileIdx(idx)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono border rounded cursor-pointer transition-all ${
                    activeFileIdx === idx
                      ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>{f.name}</span>
                  {f.is_main && (
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-sans font-bold ${
                        activeFileIdx === idx
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      Root
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Active File Editor */}
            {currentFile && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <label className="text-xs font-semibold text-slate-600">File Name:</label>
                    <input
                      type="text"
                      value={currentFile.name}
                      onChange={(e) => handleUpdateFileName(activeFileIdx, e.target.value)}
                      className="px-2.5 py-1 text-xs font-mono border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetMainFile(activeFileIdx)}
                      disabled={currentFile.is_main}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer ${
                        currentFile.is_main
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {currentFile.is_main ? 'Root Entry File' : 'Set as Root (.tex)'}
                    </button>
                    {files.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(activeFileIdx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove File
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    LaTeX / BibTeX Source Content ({currentFile.name})
                  </label>
                  <textarea
                    rows={16}
                    value={currentFile.content || ''}
                    onChange={(e) => handleUpdateFileContent(activeFileIdx, e.target.value)}
                    placeholder="Enter LaTeX or BibTeX source code..."
                    className="w-full p-3.5 font-mono text-xs border border-slate-300 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Summary & Preview */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-24 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              {icon === 'presentation' ? (
                <Presentation className="w-5 h-5 text-indigo-600" />
              ) : icon === 'book-open' ? (
                <BookOpen className="w-5 h-5 text-indigo-600" />
              ) : (
                <FileCode className="w-5 h-5 text-indigo-600" />
              )}
              <h3 className="text-sm font-bold text-slate-900">LaTeX Bundle Summary</h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Visibility Scope:</span>
                <span className="font-bold text-slate-800 capitalize">
                  {scope === 'public'
                    ? '🌐 Public Pool'
                    : scope === 'organization'
                    ? '🏢 Private (Organization)'
                    : '🔒 Private (Personal)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Compiler Engine:</span>
                <span className="font-mono font-bold uppercase text-indigo-700">{compiler}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Root Entry File:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {(files.find((f) => f.is_main) || files[0])?.name || 'main.tex'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Total Bundled Files:</span>
                <span className="font-bold text-slate-800">{files.length} files</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                File Hierarchy
              </h4>
              <div className="space-y-1.5">
                {files.map((f, i) => (
                  <div
                    key={i}
                    onClick={() => setActiveFileIdx(i)}
                    className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded border font-mono cursor-pointer ${
                      activeFileIdx === i
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="truncate">{f.path || f.name}</span>
                    {f.is_main && (
                      <span className="text-[9px] px-1.5 py-0.2 bg-indigo-100 text-indigo-700 font-sans font-bold uppercase rounded">
                        Root
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-[11px] text-indigo-900 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>Visibility Rule:</strong> Public LaTeX templates appear on the unauthenticated landing page and home page. Private Personal and Organization LaTeX templates are strictly protected and visible only after signing in.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
