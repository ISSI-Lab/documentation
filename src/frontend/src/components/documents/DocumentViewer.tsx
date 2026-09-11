import React, { useState } from 'react';
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
  ListOrdered,
} from 'lucide-react';
import { marked } from 'marked';
import { Document, Template } from '../../types';

interface DocumentViewerProps {
  document: Document;
  template: Template | null;
  onSwitchToEdit: () => void;
  onBack: () => void;
  onExportMarkdown: (docId: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  template,
  onSwitchToEdit,
  onBack,
  onExportMarkdown,
}) => {
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sticky Action Bar */}
      <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onBack}
              title="Back to Documents"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-slate-700 truncate max-w-xs sm:max-w-md">
              {document.title}
            </span>
          </div>

          <div className="flex items-center space-x-2">
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

            <button
              type="button"
              onClick={onSwitchToEdit}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" />
              Edit Document
            </button>
          </div>
        </div>
      </header>

      {/* Document Sheet Content */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
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
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
              {document.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {document.author || 'Anonymous'}
              </span>
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
      </main>
    </div>
  );
};
