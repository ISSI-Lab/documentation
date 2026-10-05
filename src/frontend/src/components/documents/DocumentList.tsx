import React, { useState, useEffect } from 'react';
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
  Building2,
  Send,
  Copy,
  Check,
} from 'lucide-react';
import { Document, DocumentStatus, Organization, Project, Team, Template, User } from '../../types';

interface DocumentListProps {
  documents: Document[];
  templates: Template[];
  organizations?: Organization[];
  teams?: Team[]; // compatibility alias
  projects: Project[];
  currentUser?: User | null;
  activeOrganizationId?: string | null;
  activeTeamId?: string | null; // compatibility alias
  activeProjectId: string | null;
  loading: boolean;
  onOpenCreateModal: (projectId?: string | null) => void;
  onEditDocument: (docId: string) => void;
  onViewDocument: (docId: string) => void;
  onDeleteDocument: (doc: Document) => void;
  onExportMarkdown: (docId: string) => void;
  onOpenSubmissions?: (docId?: string) => void;
  onViewDocumentWithTab?: (docId: string, tab: 'overview' | 'submissions' | 'my_submission') => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  templates,
  organizations: propOrganizations,
  teams: propTeams,
  projects,
  currentUser,
  activeOrganizationId,
  activeTeamId,
  activeProjectId,
  loading,
  onOpenCreateModal,
  onEditDocument,
  onViewDocument,
  onDeleteDocument,
  onExportMarkdown,
  onOpenSubmissions,
  onViewDocumentWithTab,
}) => {
  const organizations = propOrganizations || propTeams || [];
  const initialOrgId = activeOrganizationId || activeTeamId || null;

  // Category Scope: 'recent' | 'personal' | 'organizations'
  const [selectedCategory, setSelectedCategory] = useState<'recent' | 'personal' | 'organizations'>('recent');
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId || 'all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || 'all');
  const [search, setSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    const currentPropOrgId = activeOrganizationId || activeTeamId;
    if (currentPropOrgId) {
      setSelectedOrgId(currentPropOrgId);
      setSelectedCategory('organizations');
      setSelectedProjectId('all');
    }
  }, [activeOrganizationId, activeTeamId]);

  useEffect(() => {
    if (activeProjectId) {
      setSelectedProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  const personalOrgId = organizations.find((o) => o.name === `${currentUser?.username}_workspace`)?.id || null;
  const isPersonalDoc = (doc: Document) => {
    const docOrg = doc.organization_id || doc.team_id || null;
    return (
      docOrg === null ||
      (personalOrgId !== null && docOrg === personalOrgId) ||
      (doc.document_type === 'personal' && doc.created_by === currentUser?.id)
    );
  };

  const personalCount = documents.filter(isPersonalDoc).length;
  const orgCount = documents.filter((d) => Boolean(d.organization_id || d.team_id)).length;

  const getOrganizationName = (orgId: string | null) => {
    if (!orgId) return null;
    const org = organizations.find((item) => item.id === orgId);
    return org ? org.name : 'Organization Document';
  };

  const getProjectName = (projId: string | null) => {
    if (!projId) return null;
    const p = projects.find((item) => item.id === projId);
    return p ? p.name : null;
  };

  // Projects available based on current scope & organization
  const filteredProjectOptions = projects.filter((p) => {
    const pOrgId = p.organization_id || p.team_id;
    if (selectedCategory === 'personal') {
      return !pOrgId || (personalOrgId && pOrgId === personalOrgId);
    }
    if (selectedCategory === 'organizations') {
      if (selectedOrgId !== 'all') return pOrgId === selectedOrgId;
      return Boolean(pOrgId);
    }
    if (selectedCategory === 'recent') {
      if (selectedOrgId !== 'all') return pOrgId === selectedOrgId;
    }
    return true;
  });

  // Selected project for current view context
  const currentSelectedProject = selectedProjectId !== 'all'
    ? projects.find((p) => p.id === selectedProjectId) || null
    : null;

  const isSelectedProjectCreatorOnly = currentSelectedProject?.document_creation_permission === 'creator_only';

  const isCurrentProjectCreator = Boolean(
    currentSelectedProject?.created_by &&
    currentUser?.id &&
    currentSelectedProject.created_by === currentUser.id
  );

  const currentProjectOrgId = currentSelectedProject?.organization_id || currentSelectedProject?.team_id || null;
  const currentProjectOrg = organizations.find((o) => o.id === currentProjectOrgId);

  const isCurrentProjectOrgCreator = Boolean(
    currentProjectOrg?.is_creator ||
    (currentProjectOrg?.created_by && currentUser?.id && currentProjectOrg.created_by === currentUser.id) ||
    currentProjectOrg?.user_role === 'owner'
  );

  const isCreatorInCurrentProject = isCurrentProjectCreator || isCurrentProjectOrgCreator;

  // Can the current user create a document in the currently selected project context?
  const canCreateInCurrentContext = !currentSelectedProject || !isSelectedProjectCreatorOnly || isCreatorInCurrentProject;

  const currentProjectCreatorDisplayName =
    currentSelectedProject?.creator_name ||
    currentSelectedProject?.creator_username ||
    currentProjectOrg?.creator_name ||
    currentProjectOrg?.creator_username ||
    'the Project Creator';

  const handleOpenCreateModal = () => {
    if (!canCreateInCurrentContext) {
      return;
    }
    onOpenCreateModal(currentSelectedProject?.id || null);
  };

  // Filter documents
  const filtered = documents
    .filter((doc) => {
      const docOrgId = doc.organization_id || doc.team_id || null;

      // 0. Once a submittable master document is copied, hide original from participant/team
      if (
        doc.is_submittable &&
        !doc.copied_from_id &&
        currentUser?.id &&
        doc.created_by !== currentUser.id
      ) {
        if (doc.document_type === 'personal') {
          const hasUserCopy = documents.some(
            (d) => d.copied_from_id === doc.id && d.created_by === currentUser.id
          );
          if (hasUserCopy) return false;
        } else {
          const hasTeamCopy = documents.some(
            (d) => d.copied_from_id === doc.id && Boolean(d.assigned_team_id)
          );
          if (hasTeamCopy) return false;
        }
      }

      // 1. Scope category filter
      if (selectedCategory === 'personal') {
        if (!isPersonalDoc(doc)) return false;
      } else if (selectedCategory === 'organizations') {
        if (selectedOrgId !== 'all') {
          if (docOrgId !== selectedOrgId) {
            if (personalOrgId && selectedOrgId === personalOrgId && docOrgId === null && doc.created_by === currentUser?.id) {
              // allowed
            } else {
              return false;
            }
          }
        } else if (!docOrgId) {
          return false;
        }
      } else if (selectedCategory === 'recent') {
        if (selectedOrgId !== 'all') {
          if (docOrgId !== selectedOrgId) {
            if (personalOrgId && selectedOrgId === personalOrgId && docOrgId === null && doc.created_by === currentUser?.id) {
              // allowed
            } else {
              return false;
            }
          }
        }
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
            Collaborative template-driven documentation across your personal and organization workspaces.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          {canCreateInCurrentContext ? (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center px-4 py-2 border border-blue-700 text-xs font-semibold shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" />
              New Document
            </button>
          ) : (
            <button
              type="button"
              disabled
              title={`This project is restricted to Creator Only documents. Only the project creator (${currentProjectCreatorDisplayName}) can create documents.`}
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-xs font-semibold text-slate-400 bg-slate-100 cursor-not-allowed opacity-80 shadow-none"
            >
              <Lock className="w-4 h-4 mr-1.5 text-slate-400" />
              Creator Only (Locked)
            </button>
          )}
        </div>
      </div>

      {/* Scope Category Bar: Recent vs Personal vs Organization */}
      <div className="space-y-4 mb-6 w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          {/* Category Tabs (Material UI ToggleButtonGroup style) */}
          <div className="inline-flex rounded-md border border-slate-300 bg-white divide-x divide-slate-200 shadow-sm overflow-hidden w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('recent');
                setSelectedOrgId('all');
                setSelectedProjectId('all');
              }}
              className={`px-4 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer text-center sm:min-w-[170px] ${
                selectedCategory === 'recent'
                  ? 'bg-blue-50 text-blue-900 font-bold shadow-inner'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Recent ({documents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCategory('personal');
                setSelectedOrgId('all');
                setSelectedProjectId('all');
              }}
              className={`px-4 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer text-center sm:min-w-[170px] ${
                selectedCategory === 'personal'
                  ? 'bg-emerald-50 text-emerald-900 font-bold shadow-inner'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Personal Documents ({personalCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCategory('organizations');
                setSelectedProjectId('all');
              }}
              className={`px-4 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer text-center sm:min-w-[170px] ${
                selectedCategory === 'organizations'
                  ? 'bg-indigo-50 text-indigo-900 font-bold shadow-inner'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Organization Documents ({orgCount})</span>
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

        {/* Organization Dropdown Filter (Shown in Organization Documents tab) */}
        {selectedCategory === 'organizations' && organizations.length > 0 && (
          <div className="flex items-center space-x-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setSelectedProjectId('all');
              }}
              className="px-2.5 py-1.5 border border-slate-300 text-xs text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
            >
              <option value="all">All My Organizations ({orgCount})</option>
              {organizations.map((t) => {
                const orgDocs = documents.filter((d) => (d.organization_id || d.team_id) === t.id).length;
                return (
                  <option key={t.id} value={t.id}>
                    {t.name} ({orgDocs})
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
          (selectedCategory === 'organizations' && selectedOrgId !== 'all') ||
          search) && (
          <button
            onClick={() => {
              setSelectedTemplateId('all');
              setSelectedStatus('all');
              setSelectedProjectId('all');
              setSelectedOrgId('all');
              setSearch('');
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Creator Only Warning Banner if non-creator is viewing creator_only project */}
      {currentSelectedProject && !canCreateInCurrentContext && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <span className="font-bold block text-sm mb-0.5">Creator Only Project</span>
            Document creation in <strong>{currentSelectedProject.name}</strong> is restricted to the project creator ({currentProjectCreatorDisplayName}). As a member, you have view-only access to this project's documents.
          </div>
        </div>
      )}

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
            {!canCreateInCurrentContext
              ? `This project is restricted to Creator Only document creation. Only the project creator (${currentProjectCreatorDisplayName}) can create documents in this project.`
              : search || selectedTemplateId !== 'all' || selectedStatus !== 'all' || selectedProjectId !== 'all'
              ? 'Try changing your search keywords or filter criteria.'
              : selectedCategory === 'personal'
              ? 'You have not created any personal documents yet.'
              : selectedCategory === 'organizations' && organizations.length === 0
              ? 'You are not part of any organization yet. Create or join an organization to collaborate.'
              : 'Create your first document to get started.'}
          </p>
          <div className="mt-6">
            {canCreateInCurrentContext ? (
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm border border-blue-700 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Create Document
              </button>
            ) : (
              <button
                type="button"
                disabled
                title={`This project is restricted to Creator Only documents. Only the project creator (${currentProjectCreatorDisplayName}) can create documents.`}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-300 cursor-not-allowed opacity-80"
              >
                <Lock className="w-4 h-4 mr-1.5 text-slate-400" />
                Creator Only (Creation Disabled)
              </button>
            )}
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
            const docOrgId = doc.organization_id || doc.team_id || null;
            const orgName = getOrganizationName(docOrgId);
            const isPersonal = docOrgId === null;

            const isPersonalSubmittableMaster = Boolean(
              doc.document_type === 'personal' &&
              doc.is_submittable &&
              !doc.copied_from_id &&
              doc.created_by &&
              currentUser?.id &&
              doc.created_by !== currentUser.id
            );
            const userCopyDoc = isPersonalSubmittableMaster
              ? documents.find((d) => d.copied_from_id === doc.id && d.created_by === currentUser?.id)
              : null;

            const isTeamSubmittableMaster = Boolean(
              doc.document_type === 'project_shared' &&
              doc.is_submittable &&
              !doc.copied_from_id &&
              doc.created_by &&
              currentUser?.id &&
              doc.created_by !== currentUser.id
            );
            const teamCopyDoc = isTeamSubmittableMaster
              ? documents.find((d) => d.copied_from_id === doc.id && Boolean(d.assigned_team_id))
              : null;

            const isSubmittableMaster = isPersonalSubmittableMaster || isTeamSubmittableMaster;
            const activeCopyDoc = userCopyDoc || teamCopyDoc;

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
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded ${getStatusBadge(
                        doc.status
                      )}`}
                    >
                      {doc.status.replace('_', ' ')}
                    </span>

                    {/* Scope badge: Personal vs Organization */}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border rounded ${
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
                          <Building2 className="w-2.5 h-2.5 text-indigo-600" /> {orgName || 'Organization'}
                        </>
                      )}
                    </span>

                    {/* Collaboration Type: Personal vs Shared Doc */}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border rounded ${
                        doc.document_type === 'personal'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}
                    >
                      {doc.document_type === 'personal' ? (
                        <>
                          <UserIcon className="w-2.5 h-2.5 text-purple-600" /> Personal Doc
                        </>
                      ) : (
                        <>
                          <Users className="w-2.5 h-2.5 text-blue-600" /> Shared Doc
                        </>
                      )}
                    </span>

                    {/* Copy badge */}
                    {doc.copied_from_id && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border rounded ${
                          doc.assigned_team_id
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : 'bg-violet-50 text-violet-800 border-violet-200'
                        }`}
                      >
                        {doc.assigned_team_id ? (
                          <>
                            <Users className="w-2.5 h-2.5 text-indigo-600" /> Team Copy{doc.assigned_team_name ? `: ${doc.assigned_team_name}` : ''}
                          </>
                        ) : (
                          <>
                            <Copy className="w-2.5 h-2.5 text-violet-600" /> Personal Copy
                          </>
                        )}
                      </span>
                    )}

                    {/* Active Copy badge for master deliverable */}
                    {isPersonalSubmittableMaster && userCopyDoc && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border rounded bg-emerald-50 text-emerald-800 border-emerald-300">
                        <Check className="w-2.5 h-2.5 text-emerald-600" /> Copy Active
                      </span>
                    )}
                    {isTeamSubmittableMaster && teamCopyDoc && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border rounded bg-emerald-50 text-emerald-800 border-emerald-300">
                        <Check className="w-2.5 h-2.5 text-emerald-600" /> Team Copy Active{teamCopyDoc.assigned_team_name ? ` (${teamCopyDoc.assigned_team_name})` : ''}
                      </span>
                    )}

                    {/* Submittable badge if active */}
                    {doc.is_submittable && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border rounded bg-emerald-50 text-emerald-800 border-emerald-300">
                        <Send className="w-2.5 h-2.5 text-emerald-600" /> Submittable
                        {doc.submissions_count !== undefined && doc.submissions_count > 0
                          ? ` (${doc.submissions_count})`
                          : ''}
                      </span>
                    )}

                    {/* Template title */}
                    <span className="text-xs px-2.5 py-0.5 bg-slate-100 text-slate-700 font-medium flex items-center gap-1 border border-slate-200 rounded">
                      <Layers className="w-3 h-3 text-slate-500" />
                      {doc.template_title || 'Document'}
                    </span>

                    {/* Project name if applicable */}
                    {projName && (
                      <span className="text-xs px-2.5 py-0.5 bg-blue-50 text-blue-700 font-medium flex items-center gap-1 border border-blue-200 rounded">
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
                            className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 font-medium border border-slate-200 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <h3
                    onClick={() => {
                      if (activeCopyDoc) {
                        onViewDocument(activeCopyDoc.id);
                      } else {
                        onViewDocument(doc.id);
                      }
                    }}
                    className="text-base font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                  >
                    {doc.title}
                  </h3>

                  <div className="flex items-center space-x-4 text-xs text-slate-500 flex-wrap gap-y-1">
                    <span className="flex items-center space-x-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      <UserIcon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Creator: <strong className="text-slate-800">{doc.creator_name || doc.creator_username || doc.author || 'Unknown'}</strong></span>
                    </span>
                    {doc.author && doc.author !== (doc.creator_name || doc.creator_username) && (
                      <span className="flex items-center space-x-1">
                        <span className="text-slate-400">Author label:</span>
                        <span className="text-slate-600">{doc.author}</span>
                      </span>
                    )}
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

                  {/* Participant Submission Button for writers and working copies */}
                  {Boolean(
                    doc.is_submittable &&
                    (
                      doc.copied_from_id ||
                      (doc.document_type === 'personal' && doc.created_by && currentUser?.id && doc.created_by === currentUser.id && doc.project_association_type === 'individual')
                    )
                  ) && (
                    <button
                      onClick={() => {
                        if (onViewDocumentWithTab) {
                          onViewDocumentWithTab(doc.id, 'my_submission');
                        } else {
                          onViewDocument(doc.id);
                        }
                      }}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                      title="View Submission & Reviewer Feedback"
                    >
                      <Send className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      {doc.assigned_team_id ? 'Team Submission' : 'Submission'}
                    </button>
                  )}

                  {/* Creator Review Submissions Button for master documents */}
                  {Boolean(
                    !doc.copied_from_id &&
                    doc.is_submittable &&
                    ((doc.created_by && currentUser?.id && doc.created_by === currentUser.id) || !doc.created_by)
                  ) && (
                    <button
                      onClick={() => {
                        if (onOpenSubmissions) {
                          onOpenSubmissions(doc.id);
                        } else if (onViewDocumentWithTab) {
                          onViewDocumentWithTab(doc.id, 'submissions');
                        } else {
                          onViewDocument(doc.id);
                        }
                      }}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                      title="Review Submissions Roster"
                    >
                      <Send className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                      Review Submissions
                      {doc.submissions_count !== undefined && doc.submissions_count > 0 ? (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-200 text-indigo-800">
                          {doc.submissions_count}
                        </span>
                      ) : null}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (activeCopyDoc) {
                        onEditDocument(activeCopyDoc.id);
                      } else {
                        onEditDocument(doc.id);
                      }
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors cursor-pointer border border-blue-700"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                    {isPersonalSubmittableMaster
                      ? (userCopyDoc ? 'Edit My Copy' : 'Copy & Edit')
                      : (isTeamSubmittableMaster
                        ? (teamCopyDoc ? 'Edit Team Copy' : 'Start Team Copy')
                        : 'Edit')}
                  </button>
                  {Boolean((doc.created_by && currentUser?.id && doc.created_by === currentUser.id) || (!doc.created_by && currentUser?.id)) && (
                    <button
                      onClick={() => onDeleteDocument(doc)}
                      title="Delete document"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer border border-transparent hover:border-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
