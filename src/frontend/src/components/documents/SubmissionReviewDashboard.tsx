import React, { useState, useEffect } from 'react';
import {
  Users,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Send,
  Eye,
  Check,
  RotateCcw,
  RefreshCw,
  Layers,
  ChevronRight,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import { marked } from 'marked';
import { Document, DocumentSubmission, SubmissionComment, User as UserModel } from '../../types';
import { api } from '../../api/client';

interface SubmissionReviewDashboardProps {
  document: Document;
  currentUser: UserModel | null;
  onRefreshDocument?: () => Promise<void>;
}

export const SubmissionReviewDashboard: React.FC<SubmissionReviewDashboardProps> = ({
  document,
  currentUser,
  onRefreshDocument,
}) => {
  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<DocumentSubmission | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Comments for selected submission
  const [comments, setComments] = useState<SubmissionComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const isPersonal = document.document_type === 'personal';
  const isPlaceholderId = (id?: string | null) => Boolean(id && (id.startsWith('placeholder-') || id.startsWith('unsubm-')));

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listDocumentSubmissions(document.id);
      setSubmissions(data);

      if (selectedSubmissionId) {
        const found = data.find((s) => s.id === selectedSubmissionId);
        if (found) {
          setSelectedSubmission(found);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [document.id]);

  const handleSelectSubmission = async (subm: DocumentSubmission) => {
    setSelectedSubmissionId(subm.id);
    setSelectedSubmission(subm);
    if (!isPlaceholderId(subm.id)) {
      try {
        setLoadingDetail(true);
        const detailed = await api.getSubmission(document.id, subm.id);
        setSelectedSubmission(detailed);
        setComments(detailed.comments || []);
      } catch (err: any) {
        console.error('Failed to load submission details:', err);
      } finally {
        setLoadingDetail(false);
      }
    } else {
      setComments([]);
    }
  };

  const handleUpdateStatus = async (newStatus: 'draft' | 'submitted' | 'reviewed') => {
    if (!selectedSubmission || isPlaceholderId(selectedSubmission.id)) return;
    try {
      setUpdatingStatus(true);
      const updated = await api.updateSubmissionStatus(document.id, selectedSubmission.id, newStatus);
      setSelectedSubmission(updated);
      setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      if (onRefreshDocument) {
        await onRefreshDocument();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update submission status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !selectedSubmission || isPlaceholderId(selectedSubmission.id)) {
      return;
    }
    try {
      setPostingComment(true);
      const created = await api.addSubmissionComment(document.id, selectedSubmission.id, {
        content: commentInput.trim(),
      });
      setComments((prev) => [...prev, created]);
      setCommentInput('');
      // Update comment count in list
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === selectedSubmission.id
            ? { ...s, comments_count: (s.comments_count || 0) + 1 }
            : s
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to add comment');
    } finally {
      setPostingComment(false);
    }
  };

  // Status stats
  const submittedCount = submissions.filter((s) => s.status === 'submitted').length;
  const reviewedCount = submissions.filter((s) => s.status === 'reviewed').length;
  const draftCount = submissions.filter((s) => s.status === 'draft').length;
  const notStartedCount = submissions.filter((s) => s.status === 'not_started').length;

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
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <RotateCcw className="w-3.5 h-3.5" /> Draft
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Not Started
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-600">Loading submissions roster...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isPersonal ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  <User className="w-3.5 h-3.5" /> Personal Document Submissions
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  <Users className="w-3.5 h-3.5" /> Team Shared Document Submissions
                </span>
              )}
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500">
                {isPersonal
                  ? 'Each individual member submits their own document for creator review.'
                  : 'Submissions are compiled and submitted according to team (shared editing).'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Deliverable Submissions & Creator Review
            </h2>
          </div>

          <button
            type="button"
            onClick={loadSubmissions}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Roster
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Expected
            </span>
            <span className="text-2xl font-black text-slate-900">{submissions.length}</span>
          </div>

          <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100">
            <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
              Awaiting Review
            </span>
            <span className="text-2xl font-black text-blue-900">{submittedCount}</span>
          </div>

          <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
              Reviewed
            </span>
            <span className="text-2xl font-black text-emerald-900">{reviewedCount}</span>
          </div>

          <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-100">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
              In Draft / Pending
            </span>
            <span className="text-2xl font-black text-amber-900">
              {draftCount + notStartedCount}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area: Roster List & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Submissions Roster */}
        <div className={`${selectedSubmission ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-3`}>
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isPersonal ? 'Individual Participants' : 'Assigned Project Teams'} ({submissions.length})
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
                Expand Roster View
              </button>
            )}
          </div>

          {submissions.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              No participants or assigned teams found for this project deliverable.
            </div>
          ) : (
            <div className="space-y-2">
              {submissions.map((subm) => {
                const isSelected = selectedSubmissionId === subm.id;
                const isPlaceholder = isPlaceholderId(subm.id);

                return (
                  <div
                    key={subm.id}
                    onClick={() => handleSelectSubmission(subm)}
                    className={`bg-white rounded-xl border transition-all p-4 cursor-pointer hover:shadow-xs ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {isPersonal ? (
                            <User className="w-4 h-4 text-purple-600 flex-shrink-0" />
                          ) : (
                            <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          )}
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {isPersonal
                              ? subm.user_name || subm.user_email || 'Unnamed Member'
                              : subm.team_name || 'Project Squad'}
                          </span>
                        </div>

                        {isPersonal && subm.user_email && (
                          <p className="text-xs text-slate-500 truncate mb-1.5">{subm.user_email}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                          {renderStatusBadge(subm.status)}

                          {subm.submitted_at && (
                            <span className="text-[11px] text-slate-400">
                              Submitted {new Date(subm.submitted_at).toLocaleDateString()}
                            </span>
                          )}

                          {(subm.comments_count || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
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

        {/* Right: Submission Detail & Creator Review Thread */}
        {selectedSubmission && (
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
              {/* Top Detail Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubmission(null);
                        setSelectedSubmissionId(null);
                      }}
                      className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 sm:hidden font-medium mb-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to list
                    </button>
                    <span>Submission Review</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">
                      {isPersonal ? 'Individual Submission' : 'Team Deliverable'}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    {isPersonal ? (
                      <>
                        <User className="w-5 h-5 text-purple-600" />
                        {selectedSubmission.user_name || selectedSubmission.user_email || 'Member'}
                      </>
                    ) : (
                      <>
                        <Users className="w-5 h-5 text-blue-600" />
                        {selectedSubmission.team_name || 'Team Deliverable'}
                      </>
                    )}
                  </h3>

                  {selectedSubmission.submitted_at && (
                    <p className="text-xs text-slate-400 mt-1">
                      Submitted at {new Date(selectedSubmission.submitted_at).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Status Badges & Quick Action Controls */}
                <div className="flex flex-col items-start sm:items-end gap-2">
                  <div>{renderStatusBadge(selectedSubmission.status)}</div>

                  {!isPlaceholderId(selectedSubmission.id) && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus('reviewed')}
                        disabled={updatingStatus || selectedSubmission.status === 'reviewed'}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition-colors ${
                          selectedSubmission.status === 'reviewed'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                        title="Mark deliverable as fully reviewed"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Mark Reviewed
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus('draft')}
                        disabled={updatingStatus || selectedSubmission.status === 'draft'}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                        title="Request revisions (move back to draft)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Request Revisions
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Submission Content Body */}
              {isPlaceholderId(selectedSubmission.id) ? (
                <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-slate-800">No Submission Started Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    {isPersonal
                      ? 'This member has not yet opened or initialized their submission draft.'
                      : 'This team has not yet opened or initialized their submission draft.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Markdown Renderer */}
                  <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        Compiled Deliverable Content
                      </span>
                    </div>

                    <div
                      className="prose-custom text-xs text-slate-800 max-h-96 overflow-y-auto pr-2"
                      dangerouslySetInnerHTML={{
                        __html: marked.parse(selectedSubmission.compiled_markdown || '_Empty submission content._') as string,
                      }}
                    />
                  </div>

                  {/* Comments & Creator Review Feedback Thread */}
                  <div className="border-t border-slate-200 pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        Creator Feedback & Review Comments ({comments.length})
                      </h4>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {comments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          No feedback or comments posted yet. Leave your review notes below.
                        </p>
                      ) : (
                        comments.map((c) => {
                          const isReviewerComment = c.user_id === currentUser?.id;
                          return (
                            <div
                              key={c.id}
                              className={`p-3 rounded-xl border text-xs ${
                                isReviewerComment
                                  ? 'bg-blue-50/60 border-blue-200 ml-4'
                                  : 'bg-slate-50 border-slate-200 mr-4'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5 text-[11px]">
                                <span className="font-bold text-slate-900 flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-500" />
                                  {c.user_name || 'User'}
                                  {isReviewerComment && (
                                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-semibold ml-1">
                                      Creator / Reviewer
                                    </span>
                                  )}
                                </span>
                                <span className="text-slate-400">
                                  {new Date(c.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                                {c.content}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Add Comment Form */}
                    <form onSubmit={handlePostComment} className="mt-3 space-y-2">
                      <textarea
                        rows={3}
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Write feedback, praise, or revision requests for this submission..."
                        className="w-full p-3 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={postingComment || !commentInput.trim()}
                          className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {postingComment ? 'Posting...' : 'Post Review Feedback'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
