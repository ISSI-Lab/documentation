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
  Plus,
  Trash2,
} from 'lucide-react';
import { marked } from 'marked';
import {
  ContainerChildElement,
  Document,
  DocumentSubmission,
  IterationFieldConfig,
  IterationGroupItem,
  RepeatableSubItem,
  SubmissionComment,
  Template,
  User as UserModel,
} from '../../types';
import { api } from '../../api/client';
import {
  DEFAULT_CONTAINER_CHILDREN,
  isIterativeElement,
  getContainerChildren,
  getElementIterationFields,
  createEmptyContainerIteration,
  createEmptyIteration,
  getNormalizedContainerIterations,
  getNormalizedIterations,
} from '../../utils/iterationUtils';

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
  onRefreshDocument,
}) => {
  const [submission, setSubmission] = useState<DocumentSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
  const targetDocId = document.copied_from_id || document.id;

  const loadMySubmission = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMySubmission(targetDocId);
      setSubmission(data);
      const rawElements: Record<string, any> = { ...(data.elements_data || {}) };
      if (template?.document_elements) {
        for (const elem of template.document_elements) {
          if (isIterativeElement(elem)) {
            const children = getContainerChildren(elem);
            if (rawElements[elem.id] === undefined || rawElements[elem.id] === null || rawElements[elem.id] === '') {
              rawElements[elem.id] = getNormalizedContainerIterations(elem.default_value, children);
            } else {
              rawElements[elem.id] = getNormalizedContainerIterations(rawElements[elem.id], children);
            }
          }
        }
      }
      setElementsData(rawElements);
      setComments(data.comments || []);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize or load your submission');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMySubmission();
  }, [targetDocId]);

  const updateElementValue = (elemId: string, val: any) => {
    setElementsData((prev) => ({
      ...prev,
      [elemId]: val,
    }));
  };

  const handleAddRepeatableSubItem = (elemId: string) => {
    const currentList: RepeatableSubItem[] = Array.isArray(elementsData[elemId])
      ? [...elementsData[elemId]]
      : [];
    const nextIdx = currentList.length + 1;
    const newItem: RepeatableSubItem = {
      id: `sub_${Date.now()}_${nextIdx}`,
      description: `Item ${nextIdx} Description`,
      value: '',
      title: `Item ${nextIdx} Description`,
      content: '',
    };
    updateElementValue(elemId, [...currentList, newItem]);
  };

  const handleUpdateRepeatableSubItem = (
    elemId: string,
    subItemId: string,
    patch: Partial<RepeatableSubItem>
  ) => {
    const currentList: RepeatableSubItem[] = Array.isArray(elementsData[elemId])
      ? [...elementsData[elemId]]
      : [];
    const updated = currentList.map((item) => {
      if (item.id !== subItemId) return item;
      const merged = { ...item, ...patch };
      if (patch.description !== undefined) {
        merged.title = patch.description;
      } else if (patch.title !== undefined) {
        merged.description = patch.title;
      }
      if (patch.value !== undefined) {
        merged.content = patch.value;
      } else if (patch.content !== undefined) {
        merged.value = patch.content;
      }
      return merged;
    });
    updateElementValue(elemId, updated);
  };

  const handleRemoveRepeatableSubItem = (elemId: string, subItemId: string) => {
    const currentList: RepeatableSubItem[] = Array.isArray(elementsData[elemId])
      ? [...elementsData[elemId]]
      : [];
    const updated = currentList.filter((item) => item.id !== subItemId);
    updateElementValue(elemId, updated);
  };

  // Iterative Container Handlers (Iteration #1, #2... with whole group of child elements)
  const handleAddIteration = (elemId: string, childrenToUse?: ContainerChildElement[] | null) => {
    const listToUse = childrenToUse && childrenToUse.length > 0
      ? childrenToUse
      : DEFAULT_CONTAINER_CHILDREN;
    const currentList: any[] = Array.isArray(elementsData[elemId])
      ? getNormalizedContainerIterations(elementsData[elemId], listToUse)
      : [];
    const nextNum = currentList.length + 1;
    const newIteration = createEmptyContainerIteration(nextNum, listToUse);
    updateElementValue(elemId, [...currentList, newIteration]);
  };

  const handleUpdateIterationValue = (
    elemId: string,
    iterId: string,
    keyOrId: string,
    value: string
  ) => {
    const currentList: any[] = Array.isArray(elementsData[elemId])
      ? [...elementsData[elemId]]
      : [];
    const updated = currentList.map((item) => {
      if (item.id !== iterId) return item;
      const currentValues = { ...(item.values || {}) };
      currentValues[keyOrId] = value;
      let updatedFields = item.fields;
      if (Array.isArray(item.fields)) {
        const found = item.fields.some((f: any) => f.key === keyOrId);
        if (found) {
          updatedFields = item.fields.map((f: any) => (f.key === keyOrId ? { ...f, value } : f));
        } else {
          updatedFields = [...item.fields, { key: keyOrId, value }];
        }
      }
      return {
        ...item,
        values: currentValues,
        fields: updatedFields,
      };
    });
    updateElementValue(elemId, updated);
  };

  const handleRemoveIteration = (elemId: string, iterId: string) => {
    const currentList: any[] = Array.isArray(elementsData[elemId])
      ? [...elementsData[elemId]]
      : [];
    const filtered = currentList.filter((item) => item.id !== iterId);
    const renumbered = filtered.map((item, idx) => ({
      ...item,
      iteration_number: idx + 1,
      title: `Iteration #${idx + 1}`,
    }));
    updateElementValue(elemId, renumbered);
  };

  const handleSaveDraft = async () => {
    if (!submission || saving || submitting) return;
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      const updated = await api.updateSubmission(targetDocId, submission.id, {
        elements_data: elementsData,
      });
      setSubmission(updated);
      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setSuccessMessage('Draft saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save submission draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!submission || saving || submitting) return;
    const confirmMsg = isPersonal
      ? 'Are you ready to submit your personal document for creator review?'
      : 'Are you ready to submit this shared document on behalf of your team?';
    if (!window.confirm(confirmMsg)) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);
      // Submit atomically with elements_data included
      const res = await api.submitDocument(targetDocId, submission.id, {
        elements_data: elementsData,
      });
      setSubmission(res.submission);
      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setSuccessMessage('Document successfully submitted for creator review!');
      setViewTab('preview');
      if (onRefreshDocument) {
        await onRefreshDocument();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnsubmit = async () => {
    if (!submission || saving || submitting) return;
    if (!window.confirm('Revert submission to draft to make further edits?')) return;
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);
      const res = await api.unsubmitDocument(targetDocId, submission.id);
      setSubmission(res.submission);
      setViewTab('edit');
      setSuccessMessage('Submission reverted to draft for editing.');
      if (onRefreshDocument) {
        await onRefreshDocument();
      }
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
      const created = await api.addSubmissionComment(targetDocId, submission.id, {
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
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-800 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2"
          >
            ✕
          </button>
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

                      {/* PURE MARKDOWN TEXT PART: Only for viewing */}
                      {elem.view_markdown && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <Eye className="w-3 h-3 text-blue-600" />
                            <span>Pure Markdown • Only for viewing</span>
                          </div>
                          <div
                            className="prose-custom text-xs text-slate-700 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: marked.parse(elem.view_markdown) as string,
                            }}
                          />
                        </div>
                      )}

                      {/* PURE MARKDOWN ELEMENT TYPE: Strictly for viewing, no input textarea */}
                      {elem.field_type === 'pure_markdown' ? (
                        <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-500 pb-1.5 border-b border-slate-200">
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                              Pure Markdown (Viewing Only)
                            </span>
                            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                              View Only
                            </span>
                          </div>
                          <div
                            className="prose-custom text-xs text-slate-800 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: marked.parse(
                                val || elem.view_markdown || elem.default_value || '_No content provided._'
                              ) as string,
                            }}
                          />
                        </div>
                      ) : elem.field_type === 'interactive_field' ? (
                        <div className="space-y-3 p-3.5 bg-slate-50/60 border border-slate-200 rounded-xl">
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                              Description (Key)
                            </span>
                            <p className="text-xs font-semibold text-slate-800">
                              {(typeof val === 'object' && val?.description) || elem.description || 'Description'}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                              Editable Value (Input)
                            </span>
                            <textarea
                              rows={4}
                              disabled={isSubmitted}
                              value={
                                typeof val === 'object' && val !== null
                                  ? (val.value !== undefined ? val.value : val.content || '')
                                  : val || ''
                              }
                              onChange={(e) =>
                                updateElementValue(
                                  elem.id,
                                  typeof val === 'object' && val !== null
                                    ? { ...val, value: e.target.value, content: e.target.value }
                                    : e.target.value
                                )
                              }
                              placeholder={elem.placeholder || 'Enter response value...'}
                              className="w-full p-2.5 font-mono text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y disabled:bg-slate-50 disabled:text-slate-600"
                            />
                          </div>
                        </div>
                      ) : isIterativeElement(elem) ? (
                        <div className="space-y-4 pt-1">
                          {(() => {
                            const containerChildren = getContainerChildren(elem);
                            const iterations: IterationGroupItem[] = Array.isArray(val) ? val : [];

                            return (
                              <>
                                <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start justify-between gap-3">
                                  <div>
                                    <span className="font-bold flex items-center gap-1.5 text-blue-950 mb-0.5">
                                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                      Iterative Container • {containerChildren.length} Elements per Iteration Cycle
                                    </span>
                                    <div className="text-[11px] text-blue-800 leading-relaxed mt-1 flex flex-wrap items-center gap-1.5">
                                      <span>Each iteration groups together:</span>
                                      {containerChildren.map((child) => {
                                        if (child.type === 'markdown_readonly') {
                                          return (
                                            <span
                                              key={child.id}
                                              className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded text-[10px] font-semibold text-slate-700 border border-slate-200"
                                              title="Template View-Only Markdown"
                                            >
                                              <Eye className="w-3 h-3 text-slate-500" />
                                              {child.label || 'Read-Only Markdown'}
                                            </span>
                                          );
                                        }
                                        if (child.type === 'markdown_text') {
                                          return (
                                            <span
                                              key={child.id}
                                              className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded text-[10px] font-semibold text-purple-700 border border-purple-200"
                                              title="Writer Editable Markdown Block"
                                            >
                                              <FileText className="w-3 h-3 text-purple-500" />
                                              {child.label || 'Markdown Text'}
                                            </span>
                                          );
                                        }
                                        return (
                                          <span
                                            key={child.id}
                                            className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded text-[10px] font-mono font-bold text-blue-900 border border-blue-200"
                                            title="Fixed Predefined Key"
                                          >
                                            <span className="text-blue-500 font-sans font-normal text-[9px] uppercase">Key:</span>
                                            {child.key || child.label}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <span className="text-[11px] font-bold bg-white text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 flex-shrink-0 shadow-2xs">
                                    {iterations.length} {iterations.length === 1 ? 'Iteration' : 'Iterations'}
                                  </span>
                                </div>

                                {iterations.length > 0 ? (
                                  iterations.map((iterItem: any, subIdx: number) => {
                                    const iterNum = iterItem.iteration_number || subIdx + 1;
                                    return (
                                      <div
                                        key={iterItem.id || subIdx}
                                        className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs"
                                      >
                                        <div className="bg-slate-50/90 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                                          <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                              Iteration #{iterNum}
                                            </span>
                                            <span className="text-xs font-semibold text-slate-700">
                                              Iterative Group of {containerChildren.length} Elements
                                            </span>
                                          </div>

                                          {!isSubmitted && (
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveIteration(elem.id, iterItem.id)}
                                              title={`Delete Iteration #${iterNum}`}
                                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>

                                        <div className="p-4 space-y-4 bg-white">
                                          {containerChildren.map((child) => {
                                            if (child.type === 'markdown_readonly') {
                                              return (
                                                <div
                                                  key={child.id}
                                                  className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2"
                                                >
                                                  <div className="flex items-center justify-between text-xs text-slate-600 border-b border-slate-200 pb-1.5">
                                                    <span className="font-semibold flex items-center gap-1.5 text-slate-800">
                                                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                                                      {child.label || 'Reference / Instructions'}
                                                    </span>
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                                      Template Read-Only
                                                    </span>
                                                  </div>
                                                  <div
                                                    className="prose-custom text-xs text-slate-700 leading-relaxed"
                                                    dangerouslySetInnerHTML={{
                                                      __html: marked.parse(child.content || '_No template instructions provided._') as string,
                                                    }}
                                                  />
                                                </div>
                                              );
                                            }

                                            if (child.type === 'markdown_text') {
                                              const textVal =
                                                iterItem.values?.[child.id] !== undefined
                                                  ? iterItem.values[child.id]
                                                  : (iterItem.values?.[child.label || ''] !== undefined
                                                    ? iterItem.values[child.label || '']
                                                    : (iterItem[child.id] ?? ''));

                                              return (
                                                <div key={child.id} className="space-y-1.5">
                                                  <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-1.5">
                                                      <FileText className="w-3.5 h-3.5 text-purple-600" />
                                                      <span className="text-xs font-bold text-slate-800">
                                                        {child.label || 'Markdown Text'}
                                                      </span>
                                                      {child.description && (
                                                        <span className="text-[11px] text-slate-500 italic">
                                                          • {child.description}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                                      Editable Markdown
                                                    </span>
                                                  </div>
                                                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:ring-1 focus-within:ring-blue-500">
                                                    <textarea
                                                      rows={4}
                                                      disabled={isSubmitted}
                                                      value={textVal}
                                                      onChange={(e) =>
                                                        handleUpdateIterationValue(
                                                          elem.id,
                                                          iterItem.id,
                                                          child.id,
                                                          e.target.value
                                                        )
                                                      }
                                                      placeholder={child.placeholder || `Enter ${child.label || 'markdown text'}...`}
                                                      className="w-full p-2.5 font-mono text-xs text-slate-800 outline-none resize-y disabled:bg-slate-50 disabled:text-slate-600"
                                                    />
                                                  </div>
                                                </div>
                                              );
                                            }

                                            // key_value element
                                            const keyName = child.key || child.label || child.id;
                                            const fieldVal =
                                              iterItem.values?.[keyName] !== undefined
                                                ? iterItem.values[keyName]
                                                : (iterItem.values?.[child.id] !== undefined
                                                  ? iterItem.values[child.id]
                                                  : (iterItem.fields?.find((x: any) => x.key === keyName)?.value ??
                                                     iterItem[keyName] ??
                                                     ''));

                                            return (
                                              <div key={child.id} className="space-y-1">
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 font-mono">
                                                      {keyName}:
                                                    </span>
                                                    {child.description && (
                                                      <span className="text-[11px] text-slate-500 italic">
                                                        {child.description}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                                    Predefined Key
                                                  </span>
                                                </div>

                                                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:ring-1 focus-within:ring-blue-500">
                                                  <textarea
                                                    rows={2}
                                                    disabled={isSubmitted}
                                                    value={fieldVal}
                                                    onChange={(e) =>
                                                      handleUpdateIterationValue(
                                                        elem.id,
                                                        iterItem.id,
                                                        keyName,
                                                        e.target.value
                                                      )
                                                    }
                                                    placeholder={child.placeholder || `Enter value for ${keyName}...`}
                                                    className="w-full p-2.5 font-mono text-xs text-slate-800 outline-none resize-y disabled:bg-slate-50 disabled:text-slate-600"
                                                  />
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                                    No iterations recorded yet. Click below to add Iteration #1 with the entire container group ({containerChildren.map((c) => c.key || c.label).join(', ')}).
                                  </div>
                                )}

                                {!isSubmitted && (
                                  <button
                                    type="button"
                                    onClick={() => handleAddIteration(elem.id, containerChildren)}
                                    className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-700 hover:text-blue-800 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
                                  >
                                    <Plus className="w-4 h-4 text-blue-600" />
                                    <span>+ Add Iteration #{iterations.length + 1} (Whole Group: {containerChildren.map((c) => c.key || c.label).join(', ')})</span>
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : elem.field_type === 'markdown' ? (
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
