import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Save,
  FileCode,
  FileText,
  HelpCircle,
  Eye,
  AlertCircle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Indent,
  Outdent,
  Layers,
  Sparkles,
  ListPlus,
} from 'lucide-react';
import {
  DocumentElementConfig,
  DocumentElementType,
  Template,
  TemplateCreatePayload,
} from '../../types';

interface TemplateBuilderProps {
  initialTemplate?: Template | null;
  onSave: (payload: TemplateCreatePayload) => Promise<void>;
  onCancel: () => void;
}

export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  initialTemplate,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(initialTemplate?.title || '');
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [category, setCategory] = useState(initialTemplate?.category || 'Engineering');
  const [icon, setIcon] = useState(initialTemplate?.icon || 'file-text');

  const [elements, setElements] = useState<DocumentElementConfig[]>(
    initialTemplate?.document_elements && initialTemplate.document_elements.length > 0
      ? initialTemplate.document_elements.map((e, idx) => ({
          ...e,
          level: typeof e.level === 'number' ? e.level : 1,
          order: typeof e.order === 'number' ? e.order : idx,
        }))
      : [
          {
            id: 'summary',
            label: '1. Executive Summary',
            description: 'High-level summary of the document purpose and scope.',
            field_type: 'markdown',
            level: 1,
            placeholder: 'Summary details...',
            default_value: '### Overview\n- Key objective:\n- Scope:\n- Expected outcome:',
            required: true,
            order: 0,
            options: null,
          },
          {
            id: 'options',
            label: '2. Considered Options',
            description: 'Evaluated alternatives. Authors can click "+" while writing to add options.',
            field_type: 'repeatable_list',
            level: 1,
            placeholder: 'Click + to add an option',
            default_value: [
              {
                id: 'opt-1',
                title: 'Option A: Managed Cloud Service',
                content: '- Pros: Low maintenance\n- Cons: High cost',
              },
            ],
            required: true,
            order: 1,
            options: null,
          },
        ]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({ 0: true, 1: true });

  const toggleExpand = (idx: number) => {
    setExpandedIndices((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleAddElement = (fieldType: DocumentElementType = 'markdown', level = 1) => {
    const nextOrder = elements.length;
    const defaultLabels: Record<DocumentElementType, string> = {
      markdown: `Section ${nextOrder + 1}: Details`,
      repeatable_list: `Section ${nextOrder + 1}: Repeatable Items List`,
      short_text: `Field ${nextOrder + 1}: Note`,
      select: `Selection ${nextOrder + 1}`,
      callout: `Notice ${nextOrder + 1}`,
      code: `Code Snippet ${nextOrder + 1}`,
      checklist: `Task Checklist ${nextOrder + 1}`,
    };

    const defaultContent: Record<DocumentElementType, any> = {
      markdown: '### Section Heading\n- Item 1\n- Item 2',
      repeatable_list: [
        {
          id: 'item-1',
          title: 'Item 1',
          content: 'Details for item 1...',
        },
      ],
      short_text: '',
      select: 'Option 1',
      callout: 'Important note regarding this section.',
      code: '// Sample code\nconsole.log("Hello world");',
      checklist: '- [ ] Task 1\n- [ ] Task 2',
    };

    const newElem: DocumentElementConfig = {
      id: `elem_${Date.now().toString().slice(-4)}`,
      label: defaultLabels[fieldType],
      description:
        fieldType === 'repeatable_list'
          ? 'Special item: Authors can click "+" to add new items while writing.'
          : 'Guidance text for the author writing in this section.',
      field_type: fieldType,
      level: Math.max(1, Math.min(level, 3)),
      placeholder: 'Enter text here...',
      default_value: defaultContent[fieldType],
      required: false,
      order: nextOrder,
      options: fieldType === 'select' ? ['Option 1', 'Option 2', 'Option 3'] : null,
    };

    const updated = [...elements, newElem];
    setElements(updated);
    setExpandedIndices((prev) => ({ ...prev, [updated.length - 1]: true }));
  };

  const handleUpdateElement = (index: number, patch: Partial<DocumentElementConfig>) => {
    const updated = [...elements];
    updated[index] = { ...updated[index], ...patch };
    setElements(updated);
  };

  const handleIndent = (index: number, delta: number) => {
    const current = elements[index].level || 1;
    const newLevel = Math.max(1, Math.min(current + delta, 3));
    handleUpdateElement(index, { level: newLevel });
  };

  const handleRemoveElement = (index: number) => {
    const updated = elements.filter((_, i) => i !== index).map((e, idx) => ({ ...e, order: idx }));
    setElements(updated);
  };

  const handleMoveElement = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === elements.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...elements];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reordered = updated.map((e, idx) => ({ ...e, order: idx }));
    setElements(reordered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Template title is required.');
      return;
    }
    if (elements.length === 0) {
      setError('A template must contain at least one document element.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave({
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || 'General',
        icon,
        document_elements: elements.map((elem, idx) => ({
          ...elem,
          order: idx,
          level: typeof elem.level === 'number' ? elem.level : 1,
          id: elem.id.trim() || `elem_${idx + 1}`,
        })),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const getLevelBadge = (level: number) => {
    switch (level) {
      case 2:
        return { label: 'L2 Subsection', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 3:
        return { label: 'L3 Sub-item', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      default:
        return { label: 'L1 Section', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 mb-8">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {initialTemplate ? 'Edit Template Structure & Levels' : 'Configure New Document Template'}
            </h1>
            <p className="text-sm text-slate-500">
              Configure document items, hierarchy levels (Level 1, 2, 3), and special repeatable items with "+" buttons.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center space-x-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Template Config & Document Elements */}
        <div className="lg:col-span-8 space-y-8">
          {/* Metadata Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Template Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Template Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Architecture Decision Record (ADR)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="Architecture">Architecture</option>
                  <option value="Product">Product</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Operations">Operations</option>
                  <option value="Security">Security</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Icon
                </label>
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="file-text">Document (file-text)</option>
                  <option value="layers">Architecture (layers)</option>
                  <option value="shield-alert">Operations (shield-alert)</option>
                  <option value="terminal">Code / Tech (terminal)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain when and why developers should use this template..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Document Elements Configurator */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Document Elements & Hierarchy
                </h2>
                <p className="text-xs text-slate-500">
                  Configure document items with levels (Level 1 = Section, Level 2 = Subsection, Level 3 = Sub-item) and repeatable lists.
                </p>
              </div>
              <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                {elements.length} Items
              </span>
            </div>

            {/* Elements List with Visual Indentation */}
            <div className="space-y-3">
              {elements.map((elem, idx) => {
                const isExpanded = expandedIndices[idx] ?? true;
                const level = elem.level || 1;
                const levelBadge = getLevelBadge(level);

                // Indentation styling based on level
                const indentMargin = level === 1 ? 'ml-0' : level === 2 ? 'ml-6' : 'ml-12';
                const borderAccent =
                  level === 1
                    ? 'border-blue-300'
                    : level === 2
                    ? 'border-indigo-300 border-l-4'
                    : 'border-purple-300 border-l-4';

                return (
                  <div
                    key={elem.id || idx}
                    className={`transition-all duration-150 ${indentMargin}`}
                  >
                    <div className={`border rounded-xl overflow-hidden shadow-xs bg-white ${borderAccent}`}>
                      {/* Element Header */}
                      <div className="bg-slate-50/90 px-4 py-3 flex items-center justify-between border-b border-slate-200">
                        <div
                          className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0"
                          onClick={() => toggleExpand(idx)}
                        >
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-sm text-slate-900 truncate">
                            {elem.label || `Item ${idx + 1}`}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${levelBadge.color}`}
                          >
                            {levelBadge.label}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                            {elem.field_type}
                          </span>
                          {elem.field_type === 'repeatable_list' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold flex items-center gap-0.5">
                              <Plus className="w-3 h-3" /> Addable
                            </span>
                          )}
                          {elem.required && (
                            <span className="text-xs text-red-600 font-bold">*Required</span>
                          )}
                        </div>

                        {/* Hierarchy & Move Controls */}
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          {/* Indent / Outdent buttons */}
                          <button
                            type="button"
                            disabled={level <= 1}
                            onClick={() => handleIndent(idx, -1)}
                            title="Outdent Level (<)"
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded hover:bg-slate-200"
                          >
                            <Outdent className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={level >= 3}
                            onClick={() => handleIndent(idx, 1)}
                            title="Indent Level (>)"
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded hover:bg-slate-200"
                          >
                            <Indent className="w-3.5 h-3.5" />
                          </button>

                          <div className="h-3 w-px bg-slate-300 mx-0.5" />

                          {/* Reorder Up/Down */}
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveElement(idx, 'up')}
                            title="Move Up"
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === elements.length - 1}
                            onClick={() => handleMoveElement(idx, 'down')}
                            title="Move Down"
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExpand(idx)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveElement(idx)}
                            title="Delete Item"
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Element Detail Form */}
                      {isExpanded && (
                        <div className="p-5 bg-white space-y-4 text-sm">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                Item Label / Title *
                              </label>
                              <input
                                type="text"
                                value={elem.label}
                                onChange={(e) =>
                                  handleUpdateElement(idx, {
                                    label: e.target.value,
                                    id: elem.id || e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                                  })
                                }
                                placeholder="e.g. 1. Context & Problem Statement"
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                Hierarchy Level
                              </label>
                              <select
                                value={elem.level || 1}
                                onChange={(e) =>
                                  handleUpdateElement(idx, {
                                    level: parseInt(e.target.value, 10),
                                  })
                                }
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                              >
                                <option value="1">Level 1 (H2 Section)</option>
                                <option value="2">Level 2 (H3 Subsection)</option>
                                <option value="3">Level 3 (H4 Sub-item)</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                Item Type
                              </label>
                              <select
                                value={elem.field_type}
                                onChange={(e) =>
                                  handleUpdateElement(idx, {
                                    field_type: e.target.value as DocumentElementType,
                                  })
                                }
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                              >
                                <option value="markdown">Markdown Input Field (Rich Editor)</option>
                                <option value="repeatable_list">
                                  ⭐ Repeatable Dynamic List (+ Addable Items)
                                </option>
                                <option value="short_text">Short Text (Single line)</option>
                                <option value="select">Select Dropdown</option>
                                <option value="callout">Callout Alert Box</option>
                                <option value="code">Code Snippet Block</option>
                                <option value="checklist">Checklist / Task List</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                Element Slug ID
                              </label>
                              <input
                                type="text"
                                value={elem.id}
                                onChange={(e) => handleUpdateElement(idx, { id: e.target.value })}
                                placeholder="elem_id"
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>

                          {elem.field_type === 'select' && (
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                Dropdown Options (comma-separated)
                              </label>
                              <input
                                type="text"
                                value={(elem.options || []).join(', ')}
                                onChange={(e) =>
                                  handleUpdateElement(idx, {
                                    options: e.target.value
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                                placeholder="Option 1, Option 2, Option 3"
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                              Author Guidance / Help Text
                            </label>
                            <input
                              type="text"
                              value={elem.description}
                              onChange={(e) => handleUpdateElement(idx, { description: e.target.value })}
                              placeholder="Instructions for the user writing this section..."
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>

                          {elem.field_type !== 'repeatable_list' ? (
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                Default Starter Content / Boilerplate Markdown
                              </label>
                              <textarea
                                rows={3}
                                value={elem.default_value || ''}
                                onChange={(e) =>
                                  handleUpdateElement(idx, { default_value: e.target.value })
                                }
                                placeholder="Pre-populated markdown content..."
                                className="w-full font-mono text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50/60"
                              />
                            </div>
                          ) : (
                            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                              <span className="font-semibold flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                Special Repeatable Document Item
                              </span>
                              <p className="text-emerald-700">
                                When authors write on the document, this item presents a <strong>"+" button</strong> to add new entries on the fly (each entry has an item title and its own markdown content area).
                              </p>
                            </div>
                          )}

                          <div className="flex items-center space-x-6 pt-1">
                            <label className="inline-flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={elem.required}
                                onChange={(e) =>
                                  handleUpdateElement(idx, { required: e.target.checked })
                                }
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span>Make this field required</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Add Presets */}
            <div className="pt-3 border-t border-slate-100">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Add Document Item:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleAddElement('markdown', 1)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  + Markdown Section (L1)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddElement('markdown', 2)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  + Subsection (L2)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddElement('repeatable_list', 1)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-lg text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-colors shadow-xs"
                >
                  <ListPlus className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  + Repeatable Item List (+)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddElement('short_text', 1)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  + Short Text
                </button>
                <button
                  type="button"
                  onClick={() => handleAddElement('checklist', 1)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5 mr-1" />
                  + Checklist
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Structure & Hierarchy Preview */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm border-b border-slate-100 pb-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>Hierarchical Structure Preview</span>
            </div>

            <p className="text-xs text-slate-500">
              Live preview of document outline and elements with their configured heading levels:
            </p>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2.5 max-h-[500px] overflow-y-auto">
              <div className="border-b border-slate-200 pb-2">
                <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
                  {category || 'General'}
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                  {title || 'Untitled Document Template'}
                </h4>
              </div>

              {elements.map((elem, idx) => {
                const level = elem.level || 1;
                const indent = level === 1 ? 'ml-0' : level === 2 ? 'ml-4' : 'ml-8';

                return (
                  <div
                    key={idx}
                    className={`bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-1.5 ${indent}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {elem.label} {elem.required && <span className="text-red-500">*</span>}
                      </span>
                      <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                        L{level} • {elem.field_type}
                      </span>
                    </div>

                    {elem.description && (
                      <p className="text-[10px] text-slate-500 italic truncate">
                        {elem.description}
                      </p>
                    )}

                    {elem.field_type === 'repeatable_list' ? (
                      <div className="mt-1 pt-1 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] text-emerald-700 bg-emerald-50/50 p-1 rounded">
                        <span>Dynamic items container</span>
                        <span className="font-bold flex items-center gap-0.5 text-emerald-800">
                          <Plus className="w-3 h-3" /> Add Item
                        </span>
                      </div>
                    ) : (
                      <div className="h-5 bg-slate-100/60 rounded border border-slate-200/50 flex items-center px-2 text-[10px] text-slate-400">
                        {elem.field_type} input
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Template...' : 'Save Template'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
