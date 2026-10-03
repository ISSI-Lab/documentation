import React, { useState, useEffect } from 'react';
import {
  Send,
  Save,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertCircle,
  FileText,
  MessageSquare,
  User,
  Users,
  Eye,
  Edit3,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { marked } from 'marked';
import { Document, DocumentSubmission, SubmissionComment, Template, User as UserModel } from '../../types';
import { api } from '../../api/client';

interface ParticipantSubmissionWorkspaceProps {
  document: Document;
  template: Template | null;
  currentUser: UserModel | null;
  onRefreshDocument?: () => Promise<void>;
}

export const ParticipantSubmissionWorkspace: React.FC<ParticipantSubmissionWorkspaceProps> = ({
  document,
  template,
  currentUser,
}) => {
  const [submission, setSubmission] = useState<DocumentSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form editing state
  const [elementsData, setElementsData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<'edit' | 'preview'>('edit');

  // Comments thread state
  const [comments, setComments] = useState<SubmissionComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const isPersonal = document.document_type === 'personal';

  const loadMySubmission = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMySubmission(document.id);
      setSubmission(data);
      setElementsData(data.elements_data || {});
      setComments(data.comments || []);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize or load your submission');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMySubmission();
  }, [document.id]);

  const updateElementValue = (elemId: string, val: any) => {
    setElementsData((prev) => ({
      ...prev,
      [elemId]: val,
    }));
  };

  const handleSaveDraft = async () => {
    if (!submission) return;
    try {
      setSaving(true);
      setError(null);
      const updated = await api.updateSubmission(document.id, submission.id, {
        elements_data: elementsData,
      });
      setSubmission(updated);
      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch (err: any) {
      setError(err.message || 'Failed to save submission draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!submission) return;
    const confirmMsg = isPersonal
      ? 'Are you ready to submit your personal document for creator review?'
      : 'Are you ready to submit this shared document on behalf of your team?';
    if (!window.confirm(confirmMsg)) return;

    try {
      setSubmitting(true);
      setError(null);
      // Save any pending edits first
      await api.updateSubmission(document.id, submission.id, {
        elements_data: elementsData,
      });
      const res = await api.submitDocument(document.id, submission.id);
      setSubmission(res.submission);
      setViewTab('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to submit document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnsubmit = async () => {
    if (!submission) return;
    if (!window.confirm('Revert submission to draft to make further edits?')) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await api.unsubmitDocument(document.id, submission.id);
      setSubmission(res.submission);
      setViewTab('edit');
    } catch (err: any) {
      setError(err.message || 'Failed to unsubmit document');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !submission) return;
    try {
      setPostingComment(true);
      const created = await api.addSubmissionComment(document.id, submission.id, {
        content: commentInput.trim(),
      });
      setComments((prev) => [...prev, created]);
      setCommentInput('');
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Sparkles className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-600">Initializing your submission workspace...</p>
      </div>
    );
  }

  if (error && !submission) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl max-w-2xl mx-auto flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm text-red-900 mb-1">Cannot Load Submission</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const elementsList = template?.document_elements || [];
  const isSubmitted = submission?.status === 'submitted' || submission?.status === 'reviewed';

  return (
    <div className="space-y-6">
      {/* Top Submission Header & Status Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isPersonal ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  <User className="w-3.5 h-3.5" /> Personal Deliverable Submission
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  <Users className="w-3.5 h-3.5" /> Team Shared Submission ({submission?.team_name || 'Team'})
                </span>
              )}
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500">
                {isPersonal
                  ? 'Your personal submission for this deliverable.'
                  : 'Shared editing workspace — all team members collaborate on this submission.'}
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900">
              {isPersonal
                ? `${currentUser?.name || currentUser?.username}'s Submission`
                : `${submission?.team_name || 'Team'} Deliverable Submission`}
            </h2>

            {lastSavedTime && (
              <p className="text-xs text-emerald-600 font-medium mt-1">
                Draft auto-saved at {lastSavedTime}
              </p>
            )}
          </div>

          {/* Submission Status & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {submission?.status === 'reviewed' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" /> Reviewed by Creator
              </span>
            )}

            {submission?.status === 'submitted' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                <Clock className="w-4 h-4" /> Submitted (Awaiting Review)
              </span>
            )}

            {submission?.status === 'draft' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                <RotateCcw className="w-4 h-4" /> In Progress (Draft)
              </span>
            )}

            {/* Actions for draft mode */}
            {!isSubmitted ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving || submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Submitting...' : 'Submit Document'}
                </button>
              </>
            ) : (
              submission?.status === 'submitted' && (
                <button
                  type="button"
                  onClick={handleUnsubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                  title="Revert back to draft to edit your submission"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Unsubmit to Edit
                </button>
              )
            )}
          </div>
        </div>

        {/* View Switcher: Edit vs Preview */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setViewTab('edit')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              viewTab === 'edit'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {isSubmitted ? 'View Form Answers' : 'Edit Submission Form'}
          </button>

          <button
            type="button"
            onClick={() => setViewTab('preview')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              viewTab === 'preview'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Compiled Document Preview
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form / Document Content */}
        <div className="lg:col-span-8 space-y-6">
          {viewTab === 'edit' ? (
            <div className="space-y-4">
              {elementsList.length > 0 ? (
                elementsList.map((elem) => {
                  const val = elementsData[elem.id];
                  const level = elem.level || 1;

                  return (
                    <div
                      key={elem.id}
                      className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              level === 1 ? 'bg-blue-600' : 'bg-slate-400'
                            }`}
                          />
                          {elem.label}
                          {elem.required && <span className="text-red-500 text-xs">*</span>}
                        </label>
                        <span className="text-[11px] font-mono text-slate-400">{elem.field_type}</span>
                      </div>

                      {elem.placeholder && (
                        <p className="text-[11px] text-slate-500 italic">{elem.placeholder}</p>
                      )}

                      {/* Text / Markdown Area */}
                      {elem.field_type === 'markdown' ? (
                        <textarea
                          rows={4}
                          disabled={isSubmitted}
                          value={val || ''}
                          onChange={(e) => updateElementValue(elem.id, e.target.value)}
                          placeholder={elem.placeholder || 'Enter your submission response here...'}
                          className="w-full p-3 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-600"
                        />
                      ) : elem.field_type === 'code' ? (
                        <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                          <textarea
                            rows={5}
                            disabled={isSubmitted}
                            value={val || ''}
                            onChange={(e) => updateElementValue(elem.id, e.target.value)}
                            placeholder="// Code block response..."
                            className="w-full p-3 font-mono text-xs text-emerald-400 bg-transparent outline-none resize-y disabled:opacity-75"
                          />
                        </div>
                      ) : elem.field_type === 'callout' ? (
                        <div className="border-l-4 border-blue-500 bg-blue-50/40 p-3 rounded-r-lg">
                          <textarea
                            rows={3}
                            disabled={isSubmitted}
                            value={val || ''}
                            onChange={(e) => updateElementValue(elem.id, e.target.value)}
                            placeholder="Important callout / note..."
                            className="w-full p-2 border border-blue-200 rounded text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                          />
                        </div>
                      ) : elem.field_type === 'select' ? (
                        <select
                          disabled={isSubmitted}
                          value={val || ''}
                          onChange={(e) => updateElementValue(elem.id, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                        >
                          {(elem.options && elem.options.length > 0
                            ? elem.options
                            : ['Option 1', 'Option 2']
                          ).map((opt, i) => (
                            <option key={i} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          disabled={isSubmitted}
                          value={val || ''}
                          onChange={(e) => updateElementValue(elem.id, e.target.value)}
                          placeholder={elem.placeholder || 'Enter value...'}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <label className="text-xs font-bold text-slate-800">Deliverable Notes & Answers</label>
                  <textarea
                    rows={8}
                    disabled={isSubmitted}
                    value={elementsData.notes || ''}
                    onChange={(e) => updateElementValue('notes', e.target.value)}
                    placeholder="Enter your submission answers, links, or report notes here..."
                    className="w-full p-3 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
              <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Compiled Submission Preview
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    {document.title}
                  </h3>
                </div>
                {submission?.status && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {submission.status.toUpperCase()}
                  </span>
                )}
              </div>

              <div
                className="prose-custom text-xs text-slate-800"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(submission?.compiled_markdown || '_No content compiled._') as string,
                }}
              />
            </div>
          )}
        </div>

        {/* Right Column: Reviewer Feedback & Comments Thread */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 sticky top-20">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                Review Comments & Feedback ({comments.length})
              </h3>
            </div>

            {/* Comments List */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  <p>No comments or review feedback yet.</p>
                  <p className="text-[11px] mt-1 text-slate-400">
                    Once submitted, the project creator can view and leave feedback here.
                  </p>
                </div>
              ) : (
                comments.map((c) => {
                  const isMine = c.user_id === currentUser?.id;
                  return (
                    <div
                      key={c.id}
                      className={`p-3 rounded-xl border text-xs ${
                        isMine
                          ? 'bg-blue-50/50 border-blue-200'
                          : 'bg-emerald-50/50 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 text-[11px]">
                        <span className="font-bold text-slate-900 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          {c.user_name || 'Member'}
                          {!isMine && (
                            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-semibold ml-1">
                              Creator / Reviewer
                            </span>
                          )}
                        </span>
                        <span className="text-slate-400">
                          {new Date(c.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Input Form */}
            <form onSubmit={handlePostComment} className="pt-2 border-t border-slate-100 space-y-2">
              <textarea
                rows={3}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Reply or add a note for the project creator..."
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={postingComment || !commentInput.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  {postingComment ? 'Posting...' : 'Post Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
