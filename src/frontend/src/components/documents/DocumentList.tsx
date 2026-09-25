import React, { useState } from 'react';
import {
  FileText,
  Search,
  PlusCircle,
  Eye,
  Edit3,
  Download,
  Trash2,
  Filter,
  Clock,
  User as UserIcon,
  Layers,
  FolderKanban,
  Users,
  Lock,
  Globe,
} from 'lucide-react';
import { Document, DocumentStatus, Project, Team, Template, User } from '../../types';

interface DocumentListProps {
  documents: Document[];
  templates: Template[];
  teams: Team[];
  projects: Project[];
  currentUser?: User | null;
  activeTeamId: string | null;
  activeProjectId: string | null;
  loading: boolean;
  onOpenCreateModal: () => void;
  onEditDocument: (docId: string) => void;
  onViewDocument: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
  onExportMarkdown: (docId: string) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  templates,
  teams,
  projects,
  currentUser,
  activeTeamId,
  activeProjectId,
  loading,
  onOpenCreateModal,
  onEditDocument,
  onViewDocument,
  onDeleteDocument,
  onExportMarkdown,
}) => {
  // Category Scope: 'recent' | 'personal' | 'teams'
  const [selectedCategory, setSelectedCategory] = useState<'recent' | 'personal' | 'teams'>('recent');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(activeTeamId || 'all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || 'all');
  const [search, setSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const personalCount = documents.filter((d) => !d.team_id).length;
  const teamCount = documents.filter((d) => Boolean(d.team_id)).length;

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return null;
    const t = teams.find((item) => item.id === teamId);
    return t ? t.name : 'Team Document';
  };

  const getProjectName = (projId: string | null) => {
    if (!projId) return null;
    const p = projects.find((item) => item.id === projId);
    return p ? p.name : null;
  };

  // Projects available based on current scope & team
  const filteredProjectOptions = projects.filter((p) => {
    if (selectedCategory === 'personal') return p.team_id === null;
    if (selectedCategory === 'teams') {
      if (selectedTeamId !== 'all') return p.team_id === selectedTeamId;
      return p.team_id !== null;
    }
    if (selectedCategory === 'recent') {
      if (selectedTeamId !== 'all') return p.team_id === selectedTeamId;
    }
    return true;
  });

  // Filter documents
  const filtered = documents
    .filter((doc) => {
      // 1. Scope category filter
      if (selectedCategory === 'personal') {
        if (doc.team_id !== null) return false;
      } else if (selectedCategory === 'teams') {
        if (!doc.team_id) return false;
        if (selectedTeamId !== 'all' && doc.team_id !== selectedTeamId) return false;
      } else if (selectedCategory === 'recent') {
        if (selectedTeamId !== 'all' && doc.team_id !== selectedTeamId) return false;
      }

      // 2. Project filter
      if (selectedProjectId !== 'all' && doc.project_id !== selectedProjectId) {
        return false;
      }

      // 3. Template filter
      if (selectedTemplateId !== 'all' && doc.template_id !== selectedTemplateId) {
        return false;
      }

      // 4. Status filter
      if (selectedStatus !== 'all' && doc.status !== selectedStatus) {
        return false;
      }

      // 5. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchAuthor = (doc.author || '').toLowerCase().includes(q);
        const matchTpl = (doc.template_title || '').toLowerCase().includes(q);
        const matchTag = (doc.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchAuthor && !matchTag && !matchTpl) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'published':
        return 'bg-purple-50 text-purple-700 border-purple-300';
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'in_review':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between pb-6 border-b border-slate-300 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-7 h-7 text-blue-600" />
              Documents
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Collaborative template-driven documentation across your personal and team workspaces.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center px-4 py-2 border border-blue-700 text-xs font-semibold shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            New Document
          </button>
        </div>
      </div>

      {/* Scope Category Bar: Recent vs Personal vs Team */}
      <div className="space-y-4 mb-6 w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          {/* Category Tabs with Equal Width */}
          <div className="grid grid-cols-3 border border-slate-300 bg-slate-100 p-1 w-full sm:w-auto gap-1">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('recent');
                setSelectedTeamId('all');
                setSelectedProjectId('all');
              }}
              className={`px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center sm:min-w-[170px] ${
                selectedCategory === 'recent'
                  ? 'bg-white text-blue-900 shadow-sm border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Recent ({documents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCategory('personal');
                setSelectedTeamId('all');
                setSelectedProjectId('all');
              }}
              className={`px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center sm:min-w-[170px] ${
                selectedCategory === 'personal'
                  ? 'bg-white text-emerald-900 shadow-sm border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Personal Documents ({personalCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCategory('teams');
                setSelectedProjectId('all');
              }}
              className={`px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center sm:min-w-[170px] ${
                selectedCategory === 'teams'
                  ? 'bg-white text-indigo-900 shadow-sm border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Team Documents ({teamCount})</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, author, template, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
        </div>
      </div>

      {/* Filter Options Bar */}
      <div className="w-full bg-white p-3.5 border border-slate-300 shadow-sm mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mr-1">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>Filters:</span>
        </div>

        {/* Team Dropdown Filter (Shown in Team Documents tab) */}
        {selectedCategory === 'teams' && teams.length > 0 && (
          <div className="flex items-center space-x-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={selectedTeamId}
              onChange={(e) => {
                setSelectedTeamId(e.target.value);
                setSelectedProjectId('all');
              }}
              className="px-2.5 py-1.5 border border-slate-300 text-xs text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
            >
              <option value="all">All My Teams ({teamCount})</option>
              {teams.map((t) => {
                const teamDocs = documents.filter((d) => d.team_id === t.id).length;
                return (
                  <option key={t.id} value={t.id}>
                    {t.name} ({teamDocs})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Project Filter */}
        {filteredProjectOptions.length > 0 && (
          <div className="flex items-center space-x-1.5">
            <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 text-xs text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Projects</option>
              {filteredProjectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Template Filter */}
        <div className="flex items-center space-x-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 text-xs text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Templates</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-1.5">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 text-xs text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>
        </div>

        {/* Reset Filters */}
        {(selectedTemplateId !== 'all' ||
          selectedStatus !== 'all' ||
          selectedProjectId !== 'all' ||
          (selectedCategory === 'teams' && selectedTeamId !== 'all') ||
          search) && (
          <button
            onClick={() => {
              setSelectedTemplateId('all');
              setSelectedStatus('all');
              setSelectedProjectId('all');
              setSelectedTeamId('all');
              setSearch('');
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Document Grid / Cards */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white p-6 border border-slate-300 h-24 shadow-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 p-12">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-lg font-bold text-slate-900">No documents found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {search || selectedTemplateId !== 'all' || selectedStatus !== 'all' || selectedProjectId !== 'all'
              ? 'Try changing your search keywords or filter criteria.'
              : selectedCategory === 'personal'
              ? 'You have not created any personal documents yet.'
              : selectedCategory === 'teams' && teams.length === 0
              ? 'You are not part of any team yet. Create or join a team to collaborate.'
              : 'Create your first document to get started.'}
          </p>
          <div className="mt-6">
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm border border-blue-700 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Create Document
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((doc) => {
            const dateStr = new Date(doc.updated_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const projName = getProjectName(doc.project_id);
            const teamName = getTeamName(doc.team_id);
            const isPersonal = doc.team_id === null;

            return (
              <div
                key={doc.id}
                className="bg-white border border-slate-300 p-5 shadow-sm hover:shadow-md hover:border-slate-400 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status badge */}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${getStatusBadge(
                        doc.status
                      )}`}
                    >
                      {doc.status.replace('_', ' ')}
                    </span>

                    {/* Scope badge: Personal vs Team */}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border ${
                        isPersonal
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-indigo-50 text-indigo-800 border-indigo-300'
                      }`}
                    >
                      {isPersonal ? (
                        <>
                          <Lock className="w-2.5 h-2.5 text-emerald-600" /> Personal
                        </>
                      ) : (
                        <>
                          <Users className="w-2.5 h-2.5 text-indigo-600" /> {teamName || 'Team'}
                        </>
                      )}
                    </span>

                    {/* Template title */}
                    <span className="text-xs px-2.5 py-0.5 bg-slate-100 text-slate-700 font-medium flex items-center gap-1 border border-slate-200">
                      <Layers className="w-3 h-3 text-slate-500" />
                      {doc.template_title || 'Document'}
                    </span>

                    {/* Project name if applicable */}
                    {projName && (
                      <span className="text-xs px-2.5 py-0.5 bg-blue-50 text-blue-700 font-medium flex items-center gap-1 border border-blue-200">
                        <FolderKanban className="w-3 h-3 text-blue-500" />
                        {projName}
                      </span>
                    )}

                    {/* Tags */}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {doc.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 font-medium border border-slate-200"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <h3
                    onClick={() => onViewDocument(doc.id)}
                    className="text-base font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                  >
                    {doc.title}
                  </h3>

                  <div className="flex items-center space-x-4 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center space-x-1">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{doc.author || 'Anonymous'}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Updated {dateStr}</span>
                    </span>
                  </div>
                </div>

                {/* Right actions */}
                <div className="flex items-center space-x-2 self-end md:self-center border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 w-full md:w-auto justify-end">
                  <button
                    onClick={() => onExportMarkdown(doc.id)}
                    title="Export / Download Markdown"
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-300"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onViewDocument(doc.id)}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer border border-slate-300"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Preview
                  </button>
                  <button
                    onClick={() => onEditDocument(doc.id)}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors cursor-pointer border border-blue-700"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteDocument(doc.id)}
                    title="Delete document"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer border border-transparent hover:border-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
