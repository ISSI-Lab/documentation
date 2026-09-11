import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Eye,
  Columns,
  FileEdit,
  CheckCircle2,
  Circle,
  HelpCircle,
  Download,
  Layers,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  ListPlus,
} from 'lucide-react';
import { marked } from 'marked';
import {
  Document,
  DocumentElementConfig,
  DocumentStatus,
  RepeatableSubItem,
  Template,
} from '../../types';
import { MarkdownToolbar } from './MarkdownToolbar';

interface DocumentEditorProps {
  document: Document;
  template: Template | null;
  onSave: (docId: string, patch: Partial<Document>) => Promise<void>;
  onBack: () => void;
  onSwitchToView: () => void;
  onExportMarkdown: (docId: string) => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  document,
  template,
  onSave,
  onBack,
  onSwitchToView,
  onExportMarkdown,
}) => {
  const [title, setTitle] = useState(document.title);
  const [status, setStatus] = useState<DocumentStatus>(document.status);
  const [author, setAuthor] = useState(document.author);
  const [tagsInput, setTagsInput] = useState((document.tags || []).join(', '));
  const [elementsData, setElementsData] = useState<Record<string, any>>(document.elements_data || {});

  const [viewMode, setViewMode] = useState<'edit' | 'split'>('edit');
  const [previewTabPerElement, setPreviewTabPerElement] = useState<Record<string, 'write' | 'preview'>>({});
  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Active section tracking
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Ensure default values are populated if missing
  useEffect(() => {
    if (template?.document_elements) {
      const merged = { ...document.elements_data };
      for (const elem of template.document_elements) {
        if (merged[elem.id] === undefined) {
          merged[elem.id] = elem.default_value !== undefined ? elem.default_value : '';
        }
      }
      setElementsData(merged);
    }
  }, [template, document]);

  // Handle Ctrl+S / Cmd+S save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      await onSave(document.id, {
        title: title.trim(),
        status,
        author: author.trim(),
        tags,
        elements_data: elementsData,
      });

      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save document.');
    } finally {
      setSaving(false);
    }
  };

  const updateElementValue = (elemId: string, value: any) => {
    setElementsData((prev) => ({
      ...prev,
      [elemId]: value,
    }));
  };

  // Repeatable List Handlers (the special item '+' button)
  const handleAddRepeatableSubItem = (elemId: string) => {
    const currentList: RepeatableSubItem[] = Array.isArray(elementsData[elemId])
      ? [...elementsData[elemId]]
      : [];
    const nextIdx = currentList.length + 1;
    const newItem: RepeatableSubItem = {
      id: `sub_${Date.now()}_${nextIdx}`,
      title: `Item ${nextIdx}`,
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
    const updated = currentList.map((item) =>
      item.id === subItemId ? { ...item, ...patch } : item
    );
    updateElementValue(elemId, updated);
  };

  const handleRemoveRepeatableSubItem = (elemId: string, subItemId: string) => {
    const currentList: RepeatableSubItem[] = Array.isArray(elementsData[elemId])
      ? [...elementsData[elemId]]
      : [];
    const updated = currentList.filter((item) => item.id !== subItemId);
    updateElementValue(elemId, updated);
  };

  const handleInsertMarkdown = (elemId: string, prefix: string, suffix = '', defaultText = '') => {
    const textarea = textareaRefs.current[elemId];
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = elementsData[elemId] || '';
    const selectedText = currentVal.substring(start, end) || defaultText;

    const replacement = `${prefix}${selectedText}${suffix}`;
    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);

    updateElementValue(elemId, newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  const scrollToSection = (elemId: string) => {
    setActiveSectionId(elemId);
    const target = elementRefs.current[elemId];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const elementsList = template?.document_elements
    ? [...template.document_elements].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];

  const getHeadingDepth = (level: number) => {
    const safe = Math.max(1, Math.min(level || 1, 5));
    return '#'.repeat(safe + 1);
  };

  // Compiled live markdown for Split View
  const getCompiledMarkdownLive = () => {
    const lines: string[] = [];
    lines.push(`# ${title || 'Untitled Document'}`);
    lines.push('');
    lines.push(
      `**Template:** ${template?.title || 'Document'} | **Status:** \`${status.toUpperCase()}\` | **Author:** ${author || 'Anonymous'}`
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const elem of elementsList) {
      const headingPrefix = getHeadingDepth(elem.level || 1);
      lines.push(`${headingPrefix} ${elem.label}`);
      lines.push('');

      const val = elementsData[elem.id];
      if (elem.field_type === 'repeatable_list') {
        const subHeadingPrefix = getHeadingDepth((elem.level || 1) + 1);
        if (Array.isArray(val) && val.length > 0) {
          for (const item of val as RepeatableSubItem[]) {
            lines.push(`${subHeadingPrefix} ${item.title || 'Item'}`);
            lines.push('');
            lines.push(item.content ? item.content : '_No details provided._');
            lines.push('');
          }
        } else {
          lines.push('_No items added._');
          lines.push('');
        }
      } else if (elem.field_type === 'callout') {
        lines.push(`> [!NOTE]\n> ${val || '_No note provided._'}`);
        lines.push('');
      } else if (elem.field_type === 'code') {
        lines.push(`\`\`\`\n${val || ''}\n\`\`\``);
        lines.push('');
      } else if (elem.field_type === 'select') {
        lines.push(`**Selection:** \`${val || 'None'}\``);
        lines.push('');
      } else {
        lines.push(val ? String(val) : '_No content provided._');
        lines.push('');
      }
    }
    return lines.join('\n');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Back & Title */}
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={onBack}
              title="Return to Documents"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Document Title..."
                  className="text-lg font-bold text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white px-2 py-0.5 rounded border border-transparent focus:border-slate-300 outline-none w-full max-w-xl transition-all"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 px-2 mt-0.5">
                <span className="flex items-center gap-1 font-medium text-slate-600">
                  <Layers className="w-3 h-3 text-blue-500" />
                  {template?.title || 'Template Document'}
                </span>
                <span>•</span>
                {lastSavedTime ? (
                  <span className="text-emerald-600 font-medium">Saved at {lastSavedTime}</span>
                ) : (
                  <span>Unsaved changes</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Controls & Actions */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Status dropdown */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DocumentStatus)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="draft">Status: Draft</option>
              <option value="in_review">Status: In Review</option>
              <option value="approved">Status: Approved</option>
              <option value="published">Status: Published</option>
            </select>

            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                title="Form Edit Mode"
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'edit'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                title="Split Edit & Live Preview"
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'split'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
            </div>

            {/* Switch to full View/Preview */}
            <button
              type="button"
              onClick={onSwitchToView}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              title="Switch to full Preview Reader Mode"
            >
              <Eye className="w-3.5 h-3.5 mr-1 text-slate-600" />
              Preview Mode
            </button>

            {/* Save button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      {saveError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full mt-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{saveError}</span>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Hierarchical Table of Contents */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs sticky top-20">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Outline & Hierarchy
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  {Object.values(elementsData).filter(Boolean).length} / {elementsList.length}
                </span>
              </div>

              {/* Elements hierarchical outline */}
              <nav className="space-y-1">
                {elementsList.map((elem) => {
                  const hasContent = Boolean(elementsData[elem.id]);
                  const isActive = activeSectionId === elem.id;
                  const level = elem.level || 1;
                  const indentClass = level === 1 ? 'pl-2' : level === 2 ? 'pl-5' : 'pl-8';

                  return (
                    <button
                      key={elem.id}
                      type="button"
                      onClick={() => scrollToSection(elem.id)}
                      className={`w-full text-left flex items-center space-x-2 py-1.5 pr-2 rounded-lg text-xs font-medium transition-colors ${indentClass} ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {hasContent ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      )}
                      <span className="truncate flex-1">
                        {level > 1 && <span className="text-slate-400 font-mono mr-1">↳</span>}
                        {elem.label}
                      </span>
                      {elem.required && <span className="text-red-500 text-[10px]">*</span>}
                    </button>
                  );
                })}
              </nav>

              {/* Document Meta fields */}
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Author
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Author name..."
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="architecture, api, v1"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Center Column: Dynamic Form generated from Template Elements */}
          <div className={`${viewMode === 'split' ? 'lg:col-span-5' : 'lg:col-span-9'} space-y-6`}>
            {elementsList.map((elem) => {
              const currentVal = elementsData[elem.id];
              const tab = previewTabPerElement[elem.id] || 'write';
              const level = elem.level || 1;

              // Border accent based on level
              const borderLevel =
                level === 1
                  ? 'border-slate-200 shadow-xs'
                  : level === 2
                  ? 'border-indigo-200 border-l-4 shadow-xs'
                  : 'border-purple-200 border-l-4 shadow-xs';

              return (
                <div
                  key={elem.id}
                  ref={(el) => (elementRefs.current[elem.id] = el)}
                  className={`bg-white rounded-xl p-5 space-y-3 focus-within:border-blue-300 transition-colors ${borderLevel}`}
                >
                  {/* Section Title, Level & Description */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            level === 1
                              ? 'bg-blue-50 text-blue-700'
                              : level === 2
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          Level {level}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1">
                          {elem.label}
                          {elem.required && <span className="text-red-500 text-xs">*</span>}
                        </h3>
                      </div>

                      {elem.description && (
                        <p className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                          <HelpCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span>{elem.description}</span>
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {elem.field_type}
                    </span>
                  </div>

                  {/* SPECIAL DOCUMENT ITEM: Repeatable Dynamic List with '+' button */}
                  {elem.field_type === 'repeatable_list' && (
                    <div className="space-y-3 pt-1">
                      {Array.isArray(currentVal) && currentVal.length > 0 ? (
                        currentVal.map((subItem: RepeatableSubItem, subIdx: number) => (
                          <div
                            key={subItem.id || subIdx}
                            className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <input
                                type="text"
                                value={subItem.title}
                                onChange={(e) =>
                                  handleUpdateRepeatableSubItem(elem.id, subItem.id, {
                                    title: e.target.value,
                                  })
                                }
                                placeholder={`Item ${subIdx + 1} Title...`}
                                className="font-semibold text-xs text-slate-900 bg-white px-2.5 py-1 border border-slate-300 rounded-lg w-full max-w-sm focus:ring-1 focus:ring-blue-500 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveRepeatableSubItem(elem.id, subItem.id)}
                                title="Delete Item"
                                className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors ml-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:ring-1 focus-within:ring-blue-500">
                              <textarea
                                rows={3}
                                value={subItem.content}
                                onChange={(e) =>
                                  handleUpdateRepeatableSubItem(elem.id, subItem.id, {
                                    content: e.target.value,
                                  })
                                }
                                placeholder="Enter details or markdown content for this item..."
                                className="w-full p-2.5 font-mono text-xs text-slate-800 outline-none resize-y"
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                          No items added yet. Click the button below to add your first item.
                        </div>
                      )}

                      {/* THE SPECIAL '+' BUTTON */}
                      <button
                        type="button"
                        onClick={() => handleAddRepeatableSubItem(elem.id)}
                        className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-emerald-600" />
                        <span>Add New Item to "{elem.label}"</span>
                      </button>
                    </div>
                  )}

                  {/* Standard Markdown Editor Field */}
                  {elem.field_type === 'markdown' && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                      {/* Markdown Toolbar & Write/Preview Tab */}
                      <div className="flex items-center justify-between bg-slate-100/80 border-b border-slate-200 pr-2">
                        <MarkdownToolbar
                          onInsert={(prefix, suffix, defaultText) =>
                            handleInsertMarkdown(elem.id, prefix, suffix, defaultText)
                          }
                        />
                        <div className="flex items-center space-x-1 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewTabPerElement((prev) => ({ ...prev, [elem.id]: 'write' }))
                            }
                            className={`px-2 py-1 rounded font-medium ${
                              tab === 'write' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                            }`}
                          >
                            Write
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewTabPerElement((prev) => ({ ...prev, [elem.id]: 'preview' }))
                            }
                            className={`px-2 py-1 rounded font-medium ${
                              tab === 'preview' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                            }`}
                          >
                            Preview
                          </button>
                        </div>
                      </div>

                      {tab === 'write' ? (
                        <textarea
                          ref={(el) => (textareaRefs.current[elem.id] = el)}
                          rows={6}
                          value={currentVal || ''}
                          onChange={(e) => updateElementValue(elem.id, e.target.value)}
                          placeholder={elem.placeholder || 'Write markdown content here...'}
                          className="w-full p-3 font-mono text-xs text-slate-800 bg-white outline-none resize-y leading-relaxed"
                        />
                      ) : (
                        <div
                          className="p-4 prose-custom min-h-[140px] bg-slate-50/50 text-xs text-slate-800"
                          dangerouslySetInnerHTML={{
                            __html: marked.parse(currentVal || '_No content provided._') as string,
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* Short Text Field */}
                  {elem.field_type === 'short_text' && (
                    <input
                      type="text"
                      value={currentVal || ''}
                      onChange={(e) => updateElementValue(elem.id, e.target.value)}
                      placeholder={elem.placeholder || 'Enter short note...'}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  )}

                  {/* Select Dropdown */}
                  {elem.field_type === 'select' && (
                    <select
                      value={currentVal || ''}
                      onChange={(e) => updateElementValue(elem.id, e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                  )}

                  {/* Callout Field */}
                  {elem.field_type === 'callout' && (
                    <div className="border-l-4 border-blue-500 bg-blue-50/40 p-3 rounded-r-lg space-y-2">
                      <textarea
                        rows={3}
                        value={currentVal || ''}
                        onChange={(e) => updateElementValue(elem.id, e.target.value)}
                        placeholder={elem.placeholder || 'Important callout notes...'}
                        className="w-full p-2 border border-blue-200 rounded text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  )}

                  {/* Code Field */}
                  {elem.field_type === 'code' && (
                    <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                      <div className="bg-slate-900 px-3 py-1 text-[11px] text-slate-400 font-mono border-b border-slate-800">
                        Code Snippet Block
                      </div>
                      <textarea
                        rows={5}
                        value={currentVal || ''}
                        onChange={(e) => updateElementValue(elem.id, e.target.value)}
                        placeholder="// Enter code snippet..."
                        className="w-full p-3 font-mono text-xs text-emerald-400 bg-transparent outline-none resize-y"
                      />
                    </div>
                  )}

                  {/* Checklist Field */}
                  {elem.field_type === 'checklist' && (
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        value={currentVal || ''}
                        onChange={(e) => updateElementValue(elem.id, e.target.value)}
                        placeholder="- [ ] Task 1&#10;- [ ] Task 2"
                        className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <p className="text-[11px] text-slate-400">
                        Format as <code>- [ ] Task</code> or <code>- [x] Completed task</code>.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: Split Live Preview (Only shown when viewMode === 'split') */}
          {viewMode === 'split' && (
            <div className="lg:col-span-4 sticky top-20">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Live Compiled Preview
                  </span>
                  <button
                    type="button"
                    onClick={() => onExportMarkdown(document.id)}
                    title="Export Markdown"
                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className="prose-custom text-xs text-slate-800"
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(getCompiledMarkdownLive()) as string,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
