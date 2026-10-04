import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  Clock,
  RotateCcw,
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  FolderKanban,
  Building2,
  FileText,
  User,
  Users,
  ChevronRight,
  Eye,
  Check,
  ArrowLeft,
  Layers,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { marked } from 'marked';
import { Document, DocumentSubmission, Organization, Project, SubmissionComment, User as UserModel } from '../../types';
import { api } from '../../api/client';

interface CreatorSubmissionsPageProps {
  currentUser: UserModel | null;
  organizations: Organization[];
  projects: Project[];
  documents: Document[];
  initialDocumentId?: string | null;
  onNavigateToDocuments: () => void;
  onViewDocument: (docId: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const CreatorSubmissionsPage: React.FC<CreatorSubmissionsPageProps> = ({
  currentUser,
  organizations,
  projects,
  documents,
  initialDocumentId = null,
  onNavigateToDocuments,
  onViewDocument,
  showToast,
}) => {
  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [roleFilter, setRoleFilter] = useState<'creator' | 'participant' | 'all'>('creator');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedDocId, setSelectedDocId] = useState<string>(initialDocumentId || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'reviewed' | 'draft'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected submission detail inspector
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<DocumentSubmission | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [comments, setComments] = useState<SubmissionComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Submittable documents created by or relevant to user
  const submittableDocs = documents.filter((d) => d.is_submittable && (!d.copied_from_id || roleFilter === 'participant'));

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { role: roleFilter };
      if (selectedOrgId !== 'all') params.organization_id = selectedOrgId;
      if (selectedProjectId !== 'all') params.project_id = selectedProjectId;
      if (selectedDocId !== 'all') params.document_id = selectedDocId;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await api.listAllSubmissions(params);
      setSubmissions(data);

      if (selectedSubmissionId) {
        const found = data.find((s) => s.id === selectedSubmissionId);
        if (found) {
          setSelectedSubmission(found);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load submissions roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [roleFilter, selectedOrgId, selectedProjectId, selectedDocId, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadSubmissions();
  };

  const handleSelectSubmission = async (subm: DocumentSubmission) => {
    setSelectedSubmissionId(subm.id);
    setSelectedSubmission(subm);
    try {
      setLoadingDetail(true);
      const detailed = await api.getGlobalSubmission(subm.id);
      setSelectedSubmission(detailed);
      setComments(detailed.comments || []);
    } catch (err: any) {
      console.error('Failed to load submission details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'draft' | 'submitted' | 'reviewed') => {
    if (!selectedSubmission) return;
    try {
      setUpdatingStatus(true);
      const updated = await api.updateGlobalSubmissionStatus(selectedSubmission.id, newStatus);
      setSelectedSubmission(updated);
      setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      if (showToast) showToast(`Submission status updated to ${newStatus}`);
    } catch (err: any) {
      alert(err.message || 'Failed to update submission status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !selectedSubmission) return;
    try {
      setPostingComment(true);
      const newComment = await api.addGlobalSubmissionComment(selectedSubmission.id, {
        content: commentInput.trim(),
      });
      setComments((prev) => [...prev, newComment]);
      setCommentInput('');
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === selectedSubmission.id ? { ...s, comments_count: (s.comments_count || 0) + 1 } : s
        )
      );
      if (showToast) showToast('Review comment posted');
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  // Stats
  const totalCount = submissions.length;
  const submittedCount = submissions.filter((s) => s.status === 'submitted').length;
  const reviewedCount = submissions.filter((s) => s.status === 'reviewed').length;
  const draftCount = submissions.filter((s) => s.status === 'draft').length;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'reviewed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Reviewed
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5" /> Submitted
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <RotateCcw className="w-3.5 h-3.5" /> In Draft
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onNavigateToDocuments}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
            title="Back to Documents"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Creator Oversight
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">Deliverables Review Hub</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              Submissions Review Hub
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setRoleFilter('creator')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                roleFilter === 'creator'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Creator Review
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('participant')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                roleFilter === 'participant'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Submissions
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                roleFilter === 'all'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Deliverables
            </button>
          </div>
          <button
            type="button"
            onClick={loadSubmissions}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Roster
          </button>
        </div>
      </div>

      {/* Stats KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total Submissions
          </span>
          <span className="text-2xl font-black text-slate-900">{totalCount}</span>
        </div>

        <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200/80 shadow-2xs">
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> Awaiting Review
          </span>
          <span className="text-2xl font-black text-blue-900">{submittedCount}</span>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/80 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Reviewed
          </span>
          <span className="text-2xl font-black text-emerald-900">{reviewedCount}</span>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/80 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" /> In Draft / Working
          </span>
          <span className="text-2xl font-black text-amber-900">{draftCount}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by participant, team, or document..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </form>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('submitted')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                statusFilter === 'submitted'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Awaiting ({submittedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('reviewed')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                statusFilter === 'reviewed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reviewed ({reviewedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('draft')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                statusFilter === 'draft'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Draft ({draftCount})
            </button>
          </div>
        </div>

        {/* Dropdown Filters: Org, Project, Document */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Organization
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setSelectedProjectId('all');
                setSelectedDocId('all');
              }}
              className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            >
              <option value="all">All Organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedDocId('all');
              }}
              className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            >
              <option value="all">All Projects</option>
              {projects
                .filter((p) => selectedOrgId === 'all' || (p.organization_id || p.team_id) === selectedOrgId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Deliverable Document
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            >
              <option value="all">All Submittable Deliverables</option>
              {submittableDocs
                .filter((d) => selectedProjectId === 'all' || d.project_id === selectedProjectId)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content: Split Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Submissions Roster */}
        <div className={`${selectedSubmission ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-3`}>
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Submissions Roster ({submissions.length})
            </h3>
            {selectedSubmission && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSubmission(null);
                  setSelectedSubmissionId(null);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Expand Roster
              </button>
            )}
          </div>

          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading submissions...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
              No submissions match the selected criteria.
            </div>
          ) : (
            <div className="space-y-2.5">
              {submissions.map((subm) => {
                const isSelected = selectedSubmissionId === subm.id;
                const isPersonal = subm.submission_type === 'personal';

                return (
                  <div
                    key={subm.id}
                    onClick={() => handleSelectSubmission(subm)}
                    className={`bg-white rounded-xl border p-4 transition-all cursor-pointer hover:shadow-xs ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* Submitter Name & Type */}
                        <div className="flex items-center gap-2">
                          {isPersonal ? (
                            <User className="w-4 h-4 text-purple-600 flex-shrink-0" />
                          ) : (
                            <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          )}
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {isPersonal
                              ? subm.user_name || subm.user_email || 'Participant'
                              : subm.team_name || 'Project Squad'}
                          </span>
                        </div>

                        {/* Deliverable Document Title */}
                        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 truncate">
                          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{subm.document_title || 'Deliverable Document'}</span>
                        </div>

                        {/* Project Name if available */}
                        {subm.project_name && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                            <FolderKanban className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{subm.project_name}</span>
                          </div>
                        )}

                        {/* Badges & Meta */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          {renderStatusBadge(subm.status)}

                          {subm.submitted_at && (
                            <span className="text-[11px] text-slate-400">
                              Submitted {new Date(subm.submitted_at).toLocaleDateString()}
                            </span>
                          )}

                          {(subm.comments_count || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              <MessageSquare className="w-3 h-3" />
                              {subm.comments_count} comment{subm.comments_count === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight
                        className={`w-5 h-5 flex-shrink-0 transition-transform ${
                          isSelected ? 'text-blue-600 translate-x-0.5' : 'text-slate-300'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Detail Inspector & Review Pane */}
        {selectedSubmission && (
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
              {/* Submission Header */}
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {renderStatusBadge(selectedSubmission.status)}
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-semibold text-slate-600">
                      {selectedSubmission.submission_type === 'personal'
                        ? 'Individual Deliverable'
                        : 'Team Deliverable'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {selectedSubmission.submission_type === 'personal'
                      ? selectedSubmission.user_name || selectedSubmission.user_email || 'Participant'
                      : selectedSubmission.team_name || 'Project Squad'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Deliverable: <strong>{selectedSubmission.document_title}</strong>
                    {selectedSubmission.project_name ? ` (${selectedSubmission.project_name})` : ''}
                  </p>
                </div>

                {/* Status action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedSubmission.status !== 'reviewed' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus('reviewed')}
                      disabled={updatingStatus}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Mark as Reviewed
                    </button>
                  )}
                  {selectedSubmission.status !== 'draft' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus('draft')}
                      disabled={updatingStatus}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Request changes and revert to draft"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Revert to Draft
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onViewDocument(selectedSubmission.document_id)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="View Original Specification"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Submitted Content Preview */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Submitted Document Content
                </h3>

                {loadingDetail ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading content...
                  </div>
                ) : selectedSubmission.compiled_markdown ? (
                  <div
                    className="p-5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs leading-relaxed text-slate-800 prose prose-slate max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: marked.parse(selectedSubmission.compiled_markdown),
                    }}
                  />
                ) : (
                  <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-400 text-xs italic">
                    No compiled content available yet.
                  </div>
                )}
              </div>

              {/* Creator Feedback Thread */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  Review Feedback & Discussion ({comments.length})
                </h3>

                {/* Comment list */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      No review comments yet. Leave feedback below.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800">
                            {c.user_name || 'Reviewer'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment form */}
                <form onSubmit={handlePostComment} className="space-y-2 pt-2">
                  <textarea
                    rows={3}
                    placeholder="Write evaluation feedback or instructions for the author..."
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={postingComment || !commentInput.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {postingComment ? 'Posting...' : 'Post Feedback'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
