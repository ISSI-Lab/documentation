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
  Tag,
  Clock,
  User,
  Layers,
} from 'lucide-react';
import { Document, DocumentStatus, Template } from '../../types';

interface DocumentListProps {
  documents: Document[];
  templates: Template[];
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
  loading,
  onOpenCreateModal,
  onEditDocument,
  onViewDocument,
  onDeleteDocument,
  onExportMarkdown,
}) => {
  const [search, setSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Filter documents
  const filtered = documents.filter((doc) => {
    if (selectedTemplateId !== 'all' && doc.template_id !== selectedTemplateId) {
      return false;
    }
    if (selectedStatus !== 'all' && doc.status !== selectedStatus) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchAuthor = (doc.author || '').toLowerCase().includes(q);
      const matchTag = (doc.tags || []).some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchAuthor && !matchTag) return false;
    }
    return true;
  });

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'published':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'in_review':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between pb-6 border-b border-slate-200 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Project Documents & Specifications
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create, author, review, and preview structured markdown documents powered by customizable templates.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            New Document
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by document title, author, or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Template Filter */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full md:w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Templates</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full md:w-36 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {/* Document Grid / Cards */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white p-6 rounded-xl border border-slate-200 h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-12">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-lg font-semibold text-slate-900">No documents found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            {search || selectedTemplateId !== 'all' || selectedStatus !== 'all'
              ? 'Try changing your search keywords or filter criteria.'
              : 'Create your first document based on a template to get started.'}
          </p>
          <div className="mt-6">
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
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

            return (
              <div
                key={doc.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getStatusBadge(doc.status)}`}>
                      {doc.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-500" />
                      {doc.template_title || 'Document'}
                    </span>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {doc.tags.map((tag, idx) => (
                          <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <h3
                    onClick={() => onEditDocument(doc.id)}
                    className="text-base font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                  >
                    {doc.title}
                  </h3>

                  <div className="flex items-center space-x-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {doc.author || 'Anonymous'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Updated {dateStr}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                  <button
                    type="button"
                    onClick={() => onEditDocument(doc.id)}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    title="Edit document fields"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => onViewDocument(doc.id)}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    title="Preview compiled markdown"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Preview
                  </button>

                  <button
                    type="button"
                    onClick={() => onExportMarkdown(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Download compiled Markdown (.md)"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteDocument(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="Delete document"
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
