import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Edit3,
  Copy,
  Check,
  Download,
  Printer,
  FileText,
  User,
  Clock,
  Layers,
  Users,
  Send,
  MessageSquare,
} from 'lucide-react';
import { marked } from 'marked';
import { Document, Template, User as UserModel } from '../../types';
import { SubmissionReviewDashboard } from './SubmissionReviewDashboard';
import { ParticipantSubmissionWorkspace } from './ParticipantSubmissionWorkspace';

interface DocumentViewerProps {
  document: Document;
  template: Template | null;
  currentUser?: UserModel | null;
  initialTab?: 'overview' | 'submissions' | 'my_submission';
  onSwitchToEdit: () => void;
  onBack: () => void;
  onExportMarkdown: (docId: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  template,
  currentUser = null,
  initialTab,
  onSwitchToEdit,
  onBack,
  onExportMarkdown,
}) => {
  const isDocCreator = Boolean(
    !document.created_by || (currentUser && currentUser.id === document.created_by)
  );

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions' | 'my_submission'>(
    initialTab === 'submissions' && !isDocCreator
      ? 'my_submission'
      : (initialTab || 'overview')
  );

  useEffect(() => {
    if (initialTab) {
      if (initialTab === 'submissions' && !isDocCreator) {
        setActiveTab('my_submission');
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [initialTab, isDocCreator]);

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(document.compiled_markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy markdown:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const dateStr = new Date(document.updated_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'in_review':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const isPersonal = document.document_type === 'personal';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sticky Action Bar */}
      <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onBack}
              title="Back to Documents"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-slate-800 truncate block max-w-xs sm:max-w-md">
                {document.title}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>{isPersonal ? 'Personal Doc' : 'Project Shared Doc'}</span>
                {document.is_submittable && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600 font-semibold">Submittable Deliverable</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end md:self-auto">
            {activeTab === 'overview' && (
              <>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onExportMarkdown(document.id)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                  title="Download compiled .md file"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Download .md
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                  title="Print / Save to PDF"
                >
                  <Printer className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Print / PDF
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onSwitchToEdit}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" />
              Edit Specification
            </button>
          </div>
        </div>

        {/* Tab Switcher for Submittable Documents */}
        {document.is_submittable && (
          <div className="max-w-6xl mx-auto mt-3 pt-3 border-t border-slate-100 flex items-center space-x-1 sm:space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Document Specification
            </button>

            {isDocCreator && (
              <button
                type="button"
                onClick={() => setActiveTab('submissions')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'submissions'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {isPersonal ? <User className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                <span>Creator Review & Submissions</span>
                {document.submissions_count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      activeTab === 'submissions'
                        ? 'bg-white text-blue-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {document.submissions_count}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('my_submission')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'my_submission'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              {isPersonal ? 'My Submission' : 'Our Team Submission'}
            </button>
          </div>
        )}
      </header>

      {/* Main View Area */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Tab: Submissions & Creator Review */}
        {document.is_submittable && activeTab === 'submissions' && (
          <SubmissionReviewDashboard document={document} currentUser={currentUser} />
        )}

        {/* Tab: Participant Submission Workspace */}
        {document.is_submittable && activeTab === 'my_submission' && (
          <ParticipantSubmissionWorkspace
            document={document}
            template={template}
            currentUser={currentUser}
          />
        )}

        {/* Tab: Master Document Specification Overview */}
        {(!document.is_submittable || activeTab === 'overview') && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Submittable Deliverable Announcement Callout */}
            {document.is_submittable && (
              <div className="p-4 rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                      Submittable Deliverable
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-blue-700 border border-blue-200">
                      {isPersonal ? 'Personal Document' : 'Team Shared Document'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {isPersonal
                      ? 'Each individual participant will submit their own response for creator review.'
                      : 'Each assigned team will submit a single shared deliverable for creator review.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isDocCreator && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('submissions')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
                    >
                      Review Submissions
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('my_submission')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-colors"
                  >
                    {isPersonal ? 'Open My Submission' : 'Open Team Submission'}
                  </button>
                </div>
              </div>
            )}

            {/* Document Sheet Content */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12">
              {/* Metadata Banner */}
              <div className="border-b border-slate-200 pb-6 mb-8">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getStatusColor(
                      document.status
                    )}`}
                  >
                    {document.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-500" />
                    {document.template_title}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium flex items-center gap-1">
                    {isPersonal ? (
                      <>
                        <User className="w-3 h-3 text-purple-600" />
                        Personal Doc
                      </>
                    ) : (
                      <>
                        <Users className="w-3 h-3 text-blue-600" />
                        Project Shared Doc
                      </>
                    )}
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
                  {document.title}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Creator: {document.creator_name || document.creator_username || document.author || 'Anonymous'}</span>
                  </span>
                  {document.author && document.author !== (document.creator_name || document.creator_username) && (
                    <>
                      <span>•</span>
                      <span>Author: {document.author}</span>
                    </>
                  )}
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Last updated {dateStr}
                  </span>
                  {document.tags && document.tags.length > 0 && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        {document.tags.map((tag, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[11px]">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Rendered Markdown Body */}
              <div
                className="prose-custom text-slate-800"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(document.compiled_markdown || '') as string,
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
