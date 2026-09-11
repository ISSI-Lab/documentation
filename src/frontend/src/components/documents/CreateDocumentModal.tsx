import React, { useState } from 'react';
import { X, FilePlus, Layers, FileText, ShieldAlert, Sparkles } from 'lucide-react';
import { DocumentCreatePayload, Template } from '../../types';

interface CreateDocumentModalProps {
  isOpen: boolean;
  templates: Template[];
  initialSelectedTemplateId?: string | null;
  onClose: () => void;
  onCreate: (payload: DocumentCreatePayload) => Promise<void>;
}

export const CreateDocumentModal: React.FC<CreateDocumentModalProps> = ({
  isOpen,
  templates,
  initialSelectedTemplateId,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState(
    initialSelectedTemplateId || (templates.length > 0 ? templates[0].id : '')
  );
  const [author, setAuthor] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initial template ID if changed
  React.useEffect(() => {
    if (initialSelectedTemplateId) {
      setTemplateId(initialSelectedTemplateId);
    } else if (templates.length > 0 && !templateId) {
      setTemplateId(templates[0].id);
    }
  }, [initialSelectedTemplateId, templates]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Document title is required.');
      return;
    }
    if (!templateId) {
      setError('Please select a template to base this document on.');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      await onCreate({
        title: title.trim(),
        template_id: templateId,
        author: author.trim() || 'Anonymous',
        tags,
      });

      // Reset form on success
      setTitle('');
      setTagsInput('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create document.');
    } finally {
      setCreating(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <FilePlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create New Document</h2>
            <p className="text-xs text-slate-500">
              Select a template to configure your document's sections and markdown fields.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Document Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Document Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. ADR-0004: Redis Cluster for Session Caching"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Template Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Base Template *
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title} ({tpl.category} - {tpl.document_elements?.length || 0} sections)
                </option>
              ))}
            </select>

            {/* Template Info Card */}
            {selectedTemplate && (
              <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <div className="flex items-center justify-between font-medium text-slate-800 mb-1">
                  <span>{selectedTemplate.description || 'Standard document template'}</span>
                  <span className="text-blue-600 font-semibold">
                    {selectedTemplate.document_elements?.length || 0} configured items
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {selectedTemplate.document_elements?.slice(0, 4).map((elem, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-600">
                      {elem.label}
                    </span>
                  ))}
                  {(selectedTemplate.document_elements?.length || 0) > 4 && (
                    <span className="text-[10px] text-slate-400 py-0.5">
                      +{(selectedTemplate.document_elements?.length || 0) - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Author & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Author
              </label>
              <input
                type="text"
                placeholder="e.g. Jane Doe, Tech Lead"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. cache, redis, v2"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {creating ? 'Creating Document...' : 'Create & Start Writing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
