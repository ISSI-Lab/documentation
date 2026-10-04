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
  ContainerChildElement,
  ContainerChildType,
  DocumentElementConfig,
  DocumentElementType,
  IterationFieldConfig,
  Organization,
  Team,
  Template,
  TemplateCreatePayload,
  TemplateVisibility,
} from '../../types';
import { getContainerChildren, DEFAULT_CONTAINER_CHILDREN } from '../../utils/iterationUtils';

interface TemplateBuilderProps {
  initialTemplate?: Template | null;
  activeOrganizationId?: string | null;
  activeTeamId?: string | null; // compatibility alias
  organizations?: Organization[];
  teams?: Team[]; // compatibility alias
  onSave: (payload: TemplateCreatePayload) => Promise<void>;
  onCancel: () => void;
}

export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  initialTemplate,
  activeOrganizationId,
  activeTeamId,
  organizations: propOrganizations,
  teams: propTeams,
  onSave,
  onCancel,
}) => {
  const organizations = propOrganizations || propTeams || [];
  const initialActiveOrgId = activeOrganizationId || activeTeamId || null;

  const [title, setTitle] = useState(initialTemplate?.title || '');
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [category, setCategory] = useState(initialTemplate?.category || 'Engineering');
  const [icon, setIcon] = useState(initialTemplate?.icon || 'file-text');

  const initialScope: 'personal' | 'organization' | 'public' = initialTemplate
    ? initialTemplate.visibility === 'public'
      ? 'public'
      : (initialTemplate.organization_id || initialTemplate.team_id)
      ? 'organization'
      : 'personal'
    : organizations.length > 0 && initialActiveOrgId
    ? 'organization'
    : 'personal';

  const [scope, setScope] = useState<'personal' | 'organization' | 'public'>(initialScope);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    initialTemplate?.organization_id ||
      initialTemplate?.team_id ||
      initialActiveOrgId ||
      (organizations.length > 0 ? organizations[0].id : '')
  );
  const [tagsInput, setTagsInput] = useState(
    initialTemplate?.tags && Array.isArray(initialTemplate.tags)
      ? initialTemplate.tags.join(', ')
      : ''
  );

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
      iteration_container: `Section ${nextOrder + 1}: Iterative Container (Grouped Elements)`,
      iteration_group: `Section ${nextOrder + 1}: Iterative Root Cause & Resolution (Grouped Iterations)`,
      pure_markdown: `Section ${nextOrder + 1}: Reference & Background (View Only)`,
      interactive_field: `Section ${nextOrder + 1}: Interactive Field`,
      interactive_list: `Section ${nextOrder + 1}: Iterative Editable List`,
      repeatable_list: `Section ${nextOrder + 1}: Repeatable Items List`,
      markdown: `Section ${nextOrder + 1}: Details`,
      short_text: `Field ${nextOrder + 1}: Note`,
      select: `Selection ${nextOrder + 1}`,
      callout: `Notice ${nextOrder + 1}`,
      code: `Code Snippet ${nextOrder + 1}`,
      checklist: `Task Checklist ${nextOrder + 1}`,
    };

    const defaultContent: Record<DocumentElementType, any> = {
      iteration_container: [
        {
          id: 'iter-1',
          iteration_number: 1,
          title: 'Iteration #1',
          values: {
            Reason: '',
            Todo: '',
            Response: '',
          },
        },
      ],
      iteration_group: [
        {
          id: 'iter-1',
          iteration_number: 1,
          title: 'Iteration #1',
          values: {
            Reason: '',
            Todo: '',
            Response: '',
          },
        },
      ],
      pure_markdown: '### Reference & Context\nThis content is rendered as pure markdown for viewing only.',
      interactive_field: '',
      interactive_list: [
        {
          id: 'iter-1',
          iteration_number: 1,
          title: 'Iteration #1',
          values: {
            Reason: '',
            Todo: '',
            Response: '',
          },
        },
      ],
      repeatable_list: [
        {
          id: 'iter-1',
          iteration_number: 1,
          title: 'Iteration #1',
          values: {
            Reason: '',
            Todo: '',
            Response: '',
          },
        },
      ],
      markdown: '### Section Heading\n- Item 1\n- Item 2',
      short_text: '',
      select: 'Option 1',
      callout: 'Important note regarding this section.',
      code: '// Sample code\nconsole.log("Hello world");',
      checklist: '- [ ] Task 1\n- [ ] Task 2',
    };

    const defaultDescriptions: Record<DocumentElementType, string> = {
      iteration_container: 'Iterative container: Contains child elements (key-value items, markdown text, markdown read-only) that are repeated together for each iteration.',
      iteration_group: 'Grouped iterations: Each iteration contains predefined key items (Reason, Todo, Response) for the document writer to fill.',
      pure_markdown: 'Pure markdown text element strictly for viewing. Authors view rendered markdown without editing.',
      interactive_field: 'Key / Description for this interactive editing field.',
      interactive_list: 'Grouped iterations: Each iteration contains predefined key items (Reason, Todo, Response) for the document writer to fill.',
      repeatable_list: 'Repeatable iteration cycles: Authors add whole list iterations while writing.',
      markdown: 'Guidance text for the author writing in this section.',
      short_text: 'Short note guidance.',
      select: 'Select an option.',
      callout: 'Notice guidance.',
      code: 'Code block guidance.',
      checklist: 'Checklist task items.',
    };

    const isIterative =
      fieldType === 'iteration_container' ||
      fieldType === 'iteration_group' ||
      fieldType === 'interactive_list' ||
      fieldType === 'repeatable_list';

    const newElem: DocumentElementConfig = {
      id: `elem_${Date.now().toString().slice(-4)}`,
      label: defaultLabels[fieldType],
      description: defaultDescriptions[fieldType] || 'Guidance text for the author.',
      field_type: fieldType,
      level: Math.max(1, Math.min(level, 3)),
      placeholder: fieldType === 'interactive_field' ? 'Enter editable value...' : 'Enter text here...',
      default_value: defaultContent[fieldType],
      required: false,
      order: nextOrder,
      options: fieldType === 'select' ? ['Option 1', 'Option 2', 'Option 3'] : null,
      view_markdown: fieldType === 'pure_markdown' ? defaultContent[fieldType] : null,
      container_children: isIterative ? [...DEFAULT_CONTAINER_CHILDREN] : null,
      iteration_fields: isIterative
        ? [
            { key: 'Reason', description: 'Explanation or root cause', placeholder: 'Enter reason...' },
            { key: 'Todo', description: 'Action items to be taken', placeholder: 'Enter action items...' },
            { key: 'Response', description: 'Observed outcome or system response', placeholder: 'Enter response...' },
          ]
        : null,
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

  // Iterative Container Child Handlers
  const handleAddContainerChild = (elementIndex: number, type: ContainerChildType) => {
    const elem = elements[elementIndex];
    const currentChildren: ContainerChildElement[] = getContainerChildren(elem);
    const nextIdx = currentChildren.length + 1;
    let newChild: ContainerChildElement;

    if (type === 'key_value') {
      newChild = {
        id: `kv_${Date.now()}_${nextIdx}`,
        type: 'key_value',
        key: `ItemKey${nextIdx}`,
        label: `ItemKey${nextIdx}`,
        description: '',
        placeholder: 'Enter value...',
        default_value: '',
      };
    } else if (type === 'markdown_text') {
      newChild = {
        id: `md_${Date.now()}_${nextIdx}`,
        type: 'markdown_text',
        label: `Notes & Details ${nextIdx}`,
        description: '',
        placeholder: 'Write markdown notes...',
        default_value: '',
      };
    } else {
      newChild = {
        id: `ro_${Date.now()}_${nextIdx}`,
        type: 'markdown_readonly',
        label: `Reference Guidelines ${nextIdx}`,
        content: `> **Guidelines**: Enter view-only instructions or reference markdown here.`,
      };
    }

    const updated = [...currentChildren, newChild];
    handleUpdateElement(elementIndex, {
      container_children: updated,
      iteration_fields: updated
        .filter((c) => c.type === 'key_value')
        .map((c) => ({
          id: c.id,
          key: c.key || c.id,
          label: c.label,
          description: c.description,
          placeholder: c.placeholder,
        })),
    });
  };

  const handleUpdateContainerChild = (
    elementIndex: number,
    childIndex: number,
    patch: Partial<ContainerChildElement>
  ) => {
    const elem = elements[elementIndex];
    const currentChildren: ContainerChildElement[] = getContainerChildren(elem);
    if (!currentChildren[childIndex]) return;
    const updated = [...currentChildren];
    updated[childIndex] = { ...updated[childIndex], ...patch };
    handleUpdateElement(elementIndex, {
      container_children: updated,
      iteration_fields: updated
        .filter((c) => c.type === 'key_value')
        .map((c) => ({
          id: c.id,
          key: c.key || c.id,
          label: c.label,
          description: c.description,
          placeholder: c.placeholder,
        })),
    });
  };

  const handleRemoveContainerChild = (elementIndex: number, childIndex: number) => {
    const elem = elements[elementIndex];
    const currentChildren: ContainerChildElement[] = getContainerChildren(elem);
    const updated = currentChildren.filter((_, i) => i !== childIndex);
    handleUpdateElement(elementIndex, {
      container_children: updated,
      iteration_fields: updated
        .filter((c) => c.type === 'key_value')
        .map((c) => ({
          id: c.id,
          key: c.key || c.id,
          label: c.label,
          description: c.description,
          placeholder: c.placeholder,
        })),
    });
  };

  const handleMoveContainerChild = (
    elementIndex: number,
    childIndex: number,
    direction: 'up' | 'down'
  ) => {
    const elem = elements[elementIndex];
    const currentChildren = [...getContainerChildren(elem)];
    if (
      (direction === 'up' && childIndex === 0) ||
      (direction === 'down' && childIndex === currentChildren.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? childIndex - 1 : childIndex + 1;
    const temp = currentChildren[childIndex];
    currentChildren[childIndex] = currentChildren[targetIndex];
    currentChildren[targetIndex] = temp;

    handleUpdateElement(elementIndex, {
      container_children: currentChildren,
      iteration_fields: currentChildren
        .filter((c) => c.type === 'key_value')
        .map((c) => ({
          id: c.id,
          key: c.key || c.id,
          label: c.label,
          description: c.description,
          placeholder: c.placeholder,
        })),
    });
  };

  const handleSetContainerPreset = (
    elementIndex: number,
    presetType: 'standard' | 'four_step' | 'guided'
  ) => {
    let presetChildren: ContainerChildElement[] = [];
    if (presetType === 'standard') {
      presetChildren = [
        { id: 'reason', type: 'key_value', key: 'Reason', label: 'Reason', description: 'Explanation or root cause', placeholder: 'Enter reason...' },
        { id: 'todo', type: 'key_value', key: 'Todo', label: 'Todo', description: 'Action items to be taken', placeholder: 'Enter action items...' },
        { id: 'response', type: 'key_value', key: 'Response', label: 'Response', description: 'Observed outcome or system response', placeholder: 'Enter response...' },
      ];
    } else if (presetType === 'four_step') {
      presetChildren = [
        { id: 'obs', type: 'key_value', key: 'Observation', label: 'Observation', description: 'What did we observe?', placeholder: 'Observed behavior...' },
        { id: 'hyp', type: 'key_value', key: 'Hypothesis', label: 'Hypothesis', description: 'Why did it occur?', placeholder: 'Hypothesis...' },
        { id: 'act', type: 'key_value', key: 'Action', label: 'Action', description: 'What did we do?', placeholder: 'Steps taken...' },
        { id: 'out', type: 'key_value', key: 'Outcome', label: 'Outcome', description: 'What was the result?', placeholder: 'Measured outcome...' },
      ];
    } else {
      presetChildren = [
        {
          id: 'guide',
          type: 'markdown_readonly',
          label: 'Cycle Guidelines',
          content: '> **Cycle Guidelines**: Identify root cause, formulate concrete action items, and measure outcome before moving to the next cycle.',
        },
        { id: 'reason', type: 'key_value', key: 'Reason', label: 'Reason', description: 'Root cause or problem description', placeholder: 'Enter reason...' },
        { id: 'todo', type: 'key_value', key: 'Todo', label: 'Todo', description: 'Specific remediation steps', placeholder: 'Enter action items...' },
        { id: 'response', type: 'key_value', key: 'Response', label: 'Response', description: 'Observed outcome or metrics', placeholder: 'Enter response...' },
        {
          id: 'notes',
          type: 'markdown_text',
          label: 'Iteration Notes & Next Steps',
          description: 'Freeform markdown documentation for this cycle',
          placeholder: 'Add detailed logs, links, or notes...',
          default_value: '',
        },
      ];
    }

    handleUpdateElement(elementIndex, {
      container_children: presetChildren,
      iteration_fields: presetChildren
        .filter((c) => c.type === 'key_value')
        .map((c) => ({
          id: c.id,
          key: c.key || c.id,
          label: c.label,
          description: c.description,
          placeholder: c.placeholder,
        })),
    });
  };

  const handleAddIterationField = (elementIndex: number) => {
    handleAddContainerChild(elementIndex, 'key_value');
  };

  const handleUpdateIterationField = (
    elementIndex: number,
    fieldIndex: number,
    patch: Partial<IterationFieldConfig>
  ) => {
    handleUpdateContainerChild(elementIndex, fieldIndex, patch as any);
  };

  const handleRemoveIterationField = (elementIndex: number, fieldIndex: number) => {
    handleRemoveContainerChild(elementIndex, fieldIndex);
  };

  const handleSetIterationPreset = (
    elementIndex: number,
    presetFields: IterationFieldConfig[]
  ) => {
    const children: ContainerChildElement[] = presetFields.map((f) => ({
      id: f.id || f.key.toLowerCase(),
      type: 'key_value',
      key: f.key,
      label: f.label || f.key,
      description: f.description,
      placeholder: f.placeholder,
    }));
    handleUpdateElement(elementIndex, {
      container_children: children,
      iteration_fields: presetFields,
    });
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
      const cleanTags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const finalVisibility: TemplateVisibility = scope === 'public' ? 'public' : 'private';
      const finalOrgId: string | null =
        scope === 'organization' || (scope as any) === 'team'
          ? selectedOrgId || organizations[0]?.id || null
          : null;

      await onSave({
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || 'General',
        icon,
        visibility: finalVisibility,
        organization_id: finalOrgId,
        team_id: finalOrgId,
        tags: cleanTags,
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

              {/* Tags Input */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. architecture, decision, backend, rfc"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Scope Selection: Personal vs Organization vs Public */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Template Ownership & Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Personal */}
                  <div
                    onClick={() => setScope('personal')}
                    className={`cursor-pointer p-3 border transition-all ${
                      scope === 'personal'
                        ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600 shadow-sm'
                        : 'border-slate-300 hover:border-slate-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">👤 Personal Template</span>
                      {scope === 'personal' && (
                        <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Private to your personal account (without an organization).
                    </p>
                  </div>

                  {/* Organization */}
                  <div
                    onClick={() => setScope('organization')}
                    className={`cursor-pointer p-3 border transition-all ${
                      scope === 'organization'
                        ? 'border-purple-600 bg-purple-50/70 ring-1 ring-purple-600 shadow-sm'
                        : 'border-slate-300 hover:border-slate-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">🏢 Organization Template</span>
                      {scope === 'organization' && (
                        <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.2 font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Shared and used exclusively by members of a specific organization.
                    </p>
                  </div>

                  {/* Public */}
                  <div
                    onClick={() => setScope('public')}
                    className={`cursor-pointer p-3 border transition-all ${
                      scope === 'public'
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 shadow-sm'
                        : 'border-slate-300 hover:border-slate-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">🌐 Public Pool</span>
                      {scope === 'public' && (
                        <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Available to all developers and users platform-wide.
                    </p>
                  </div>
                </div>
              </div>

              {/* Organization Selector when scope === 'organization' */}
              {scope === 'organization' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Owning Organization *
                  </label>
                  {organizations.length > 0 ? (
                    <select
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      {organizations.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.user_role ? `(${t.user_role})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      You are not currently in any organization. Create an organization first to publish organization templates, or select Personal Template.
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Members of this organization will be able to create documents from this template.
                  </p>
                </div>
              )}
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
                                onChange={(e) => {
                                  const newType = e.target.value as DocumentElementType;
                                  const patch: Partial<DocumentElementConfig> = { field_type: newType };
                                  if (
                                    (newType === 'iteration_container' ||
                                      newType === 'iteration_group' ||
                                      newType === 'interactive_list' ||
                                      newType === 'repeatable_list') &&
                                    (!elem.container_children || elem.container_children.length === 0)
                                  ) {
                                    patch.container_children = [...DEFAULT_CONTAINER_CHILDREN];
                                    patch.iteration_fields = DEFAULT_CONTAINER_CHILDREN.map((c) => ({
                                      id: c.id,
                                      key: c.key || c.id,
                                      label: c.label,
                                      description: c.description,
                                      placeholder: c.placeholder,
                                    }));
                                  }
                                  handleUpdateElement(idx, patch);
                                }}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                              >
                                <option value="iteration_container">📦 Iterative Container (Grouped Elements)</option>
                                <option value="pure_markdown">📖 Pure Markdown (View Only)</option>
                                <option value="interactive_field">✏️ Interactive Element (Description & Input)</option>
                                <option value="iteration_group">🔄 Grouped Iteration (Reason, Todo, Response)</option>
                                <option value="interactive_list">📋 Iterative List (Whole List per Iteration)</option>
                                <option value="repeatable_list">⭐ Repeatable Iteration List</option>
                                <option value="markdown">Markdown Input Field (Rich Editor)</option>
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

                          {/* PURE MARKDOWN TEXT PART: Only for viewing */}
                          <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                Pure Markdown Text Part (Only for viewing)
                              </label>
                              <span className="text-[10px] text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200 font-semibold">
                                Read-Only in Document
                              </span>
                            </div>
                            <p className="text-[11px] text-blue-700">
                              Rendered directly as pure markdown for viewing. Authors cannot edit this part during document writing.
                            </p>
                            <textarea
                              rows={3}
                              value={elem.view_markdown || ''}
                              onChange={(e) =>
                                handleUpdateElement(idx, { view_markdown: e.target.value })
                              }
                              placeholder="Enter pure markdown text for viewing (instructions, context, guidelines, reference)..."
                              className="w-full font-mono text-xs px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-800"
                            />
                          </div>

                          {elem.field_type === 'pure_markdown' ? (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
                              <span className="font-semibold flex items-center gap-1 text-slate-900">
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                Pure Markdown Text Element (Only for viewing)
                              </span>
                              <p className="text-slate-600">
                                This element contains pure markdown text strictly for viewing. Authors view rendered markdown without an editing input.
                              </p>
                            </div>
                          ) : elem.field_type === 'interactive_field' ? (
                            <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-lg text-xs text-purple-900 space-y-1">
                              <span className="font-semibold flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                Interactive Element (Description & Input Part)
                              </span>
                              <p className="text-purple-700">
                                Contains a description portion (the key) and an input (editing) part for the author's response.
                              </p>
                            </div>
                          ) : (elem.field_type === 'iteration_container' ||
                            elem.field_type === 'iteration_group' ||
                            elem.field_type === 'interactive_list' ||
                            elem.field_type === 'repeatable_list' ||
                            (elem.container_children && elem.container_children.length > 0) ||
                            (elem.iteration_fields && elem.iteration_fields.length > 0)) ? (
                            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3.5">
                              {/* Header & Presets */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 pb-2.5">
                                <div>
                                  <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-blue-600" />
                                    Iterative Container Elements ({getContainerChildren(elem).length} Child Elements per Iteration)
                                  </span>
                                  <p className="text-[11px] text-blue-800">
                                    Child elements inside this container are repeated together as a unit when document writers click '+'. You can add key-value items (key fixed by template editor, value filled by writer), editable markdown text areas, or view-only markdown text.
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleSetContainerPreset(idx, 'standard')}
                                    className="px-2 py-0.5 text-[10px] font-semibold bg-white text-blue-800 border border-blue-300 rounded hover:bg-blue-100 transition-colors"
                                  >
                                    Preset: Reason, Todo, Response
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetContainerPreset(idx, 'four_step')}
                                    className="px-2 py-0.5 text-[10px] font-semibold bg-white text-blue-800 border border-blue-300 rounded hover:bg-blue-100 transition-colors"
                                  >
                                    Preset: 4-Step Plan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetContainerPreset(idx, 'guided')}
                                    className="px-2 py-0.5 text-[10px] font-semibold bg-white text-blue-800 border border-blue-300 rounded hover:bg-blue-100 transition-colors"
                                  >
                                    Preset: Guided Cycle
                                  </button>
                                </div>
                              </div>

                              {/* Container Child Elements List */}
                              <div className="space-y-2.5">
                                {(() => {
                                  const children = getContainerChildren(elem);
                                  return children.length > 0 ? (
                                    children.map((child, cIdx) => (
                                      <div
                                        key={child.id || cIdx}
                                        className="p-3 bg-white border border-blue-200 rounded-lg shadow-2xs space-y-2.5"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                              #{cIdx + 1}
                                            </span>
                                            {child.type === 'key_value' && (
                                              <span className="text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
                                                Key-Value Item (Key fixed by editor, value by writer)
                                              </span>
                                            )}
                                            {child.type === 'markdown_text' && (
                                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded">
                                                Markdown Text (Editable by Writer)
                                              </span>
                                            )}
                                            {child.type === 'markdown_readonly' && (
                                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                                                <Eye className="w-3 h-3 text-emerald-600" />
                                                Markdown Read-Only (View Only)
                                              </span>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              disabled={cIdx === 0}
                                              onClick={() => handleMoveContainerChild(idx, cIdx, 'up')}
                                              title="Move Up"
                                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                                            >
                                              <ArrowUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={cIdx === children.length - 1}
                                              onClick={() => handleMoveContainerChild(idx, cIdx, 'down')}
                                              title="Move Down"
                                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                                            >
                                              <ArrowDown className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={children.length <= 1}
                                              onClick={() => handleRemoveContainerChild(idx, cIdx)}
                                              title="Delete Child Element"
                                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-30 transition-colors ml-1"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {child.type === 'key_value' && (
                                          <div className="space-y-2">
                                            <div>
                                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                                                Key Label (Fixed by template editor, seen by document writer) *
                                              </label>
                                              <input
                                                type="text"
                                                value={child.key || ''}
                                                onChange={(e) =>
                                                  handleUpdateContainerChild(idx, cIdx, { key: e.target.value, label: e.target.value })
                                                }
                                                placeholder="e.g. Reason, Todo, Response"
                                                className="w-full px-2.5 py-1 text-xs font-bold text-slate-900 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                                              />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              <div>
                                                <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                                                  Guidance / Description for Writer
                                                </label>
                                                <input
                                                  type="text"
                                                  value={child.description || ''}
                                                  onChange={(e) =>
                                                    handleUpdateContainerChild(idx, cIdx, { description: e.target.value })
                                                  }
                                                  placeholder="Instructions for document writer..."
                                                  className="w-full px-2.5 py-1 text-xs text-slate-700 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                                                  Placeholder Hint
                                                </label>
                                                <input
                                                  type="text"
                                                  value={child.placeholder || ''}
                                                  onChange={(e) =>
                                                    handleUpdateContainerChild(idx, cIdx, { placeholder: e.target.value })
                                                  }
                                                  placeholder="e.g. Enter value..."
                                                  className="w-full px-2.5 py-1 text-xs text-slate-700 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {child.type === 'markdown_text' && (
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                                                  Field Title / Heading *
                                                </label>
                                                <input
                                                  type="text"
                                                  value={child.label || ''}
                                                  onChange={(e) =>
                                                    handleUpdateContainerChild(idx, cIdx, { label: e.target.value })
                                                  }
                                                  placeholder="e.g. Iteration Notes & Logs"
                                                  className="w-full px-2.5 py-1 text-xs font-semibold text-slate-900 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                                                  Guidance / Description for Writer
                                                </label>
                                                <input
                                                  type="text"
                                                  value={child.description || ''}
                                                  onChange={(e) =>
                                                    handleUpdateContainerChild(idx, cIdx, { description: e.target.value })
                                                  }
                                                  placeholder="Instructions for markdown notes..."
                                                  className="w-full px-2.5 py-1 text-xs text-slate-700 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                              </div>
                                            </div>
                                            <div>
                                              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                                                Default Starter Markdown (Optional)
                                              </label>
                                              <textarea
                                                rows={2}
                                                value={child.default_value || ''}
                                                onChange={(e) =>
                                                  handleUpdateContainerChild(idx, cIdx, { default_value: e.target.value })
                                                }
                                                placeholder="Starter markdown content for this field..."
                                                className="w-full font-mono text-xs p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50/60"
                                              />
                                            </div>
                                          </div>
                                        )}

                                        {child.type === 'markdown_readonly' && (
                                          <div className="space-y-2">
                                            <div>
                                              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                                                Guidance Title / Label (Optional)
                                              </label>
                                              <input
                                                type="text"
                                                value={child.label || ''}
                                                onChange={(e) =>
                                                  handleUpdateContainerChild(idx, cIdx, { label: e.target.value })
                                                }
                                                placeholder="e.g. Iteration Instructions"
                                                className="w-full px-2.5 py-1 text-xs text-slate-800 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-0.5">
                                                Pure Markdown Content (Rendered as view-only in each iteration) *
                                              </label>
                                              <textarea
                                                rows={3}
                                                value={child.content || ''}
                                                onChange={(e) =>
                                                  handleUpdateContainerChild(idx, cIdx, { content: e.target.value })
                                                }
                                                placeholder="Enter pure markdown text for viewing (instructions, checklists, reference)..."
                                                className="w-full font-mono text-xs p-2 border border-emerald-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none bg-emerald-50/30 text-slate-800"
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-center py-3 bg-white rounded-lg border border-dashed border-blue-300 text-xs text-blue-700">
                                      No elements in container yet. Add key-value items, markdown text, or markdown read-only below.
                                    </div>
                                  );
                                })()}

                                {/* Add Child Buttons */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAddContainerChild(idx, 'key_value')}
                                    className="py-2 px-3 rounded-lg border border-dashed border-blue-300 bg-white hover:bg-blue-100/60 text-blue-700 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                                    <span>+ Add Key-Value Item</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddContainerChild(idx, 'markdown_text')}
                                    className="py-2 px-3 rounded-lg border border-dashed border-indigo-300 bg-white hover:bg-indigo-100/60 text-indigo-700 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>+ Add Markdown Text</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddContainerChild(idx, 'markdown_readonly')}
                                    className="py-2 px-3 rounded-lg border border-dashed border-emerald-300 bg-white hover:bg-emerald-100/60 text-emerald-700 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>+ Add Markdown Read-Only</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
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
                  onClick={() => handleAddElement('iteration_container', 1)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-lg text-blue-900 bg-blue-100 hover:bg-blue-200 border border-blue-400 transition-colors shadow-xs"
                >
                  <Layers className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  + Iterative Container (Grouped Elements)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddElement('pure_markdown', 1)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-blue-800 bg-blue-100 hover:bg-blue-200 border border-blue-300 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  + Pure Markdown (View Only)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddElement('interactive_field', 1)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-purple-800 bg-purple-100 hover:bg-purple-200 border border-purple-300 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600" />
                  + Interactive Field
                </button>
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

                    {elem.view_markdown && (
                      <div className="text-[10px] bg-blue-50/70 border border-blue-200 text-blue-800 p-1 rounded flex items-center gap-1">
                        <Eye className="w-2.5 h-2.5 text-blue-600" />
                        <span>Pure markdown (view only)</span>
                      </div>
                    )}

                    {elem.field_type === 'pure_markdown' ? (
                      <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-blue-700 bg-blue-50/60 p-1.5 rounded">
                        <span className="flex items-center gap-1 font-medium">
                          <Eye className="w-3 h-3 text-blue-600" /> View-only Markdown
                        </span>
                        <span className="text-[9px] bg-blue-100 text-blue-800 px-1 rounded font-bold">
                          View Only
                        </span>
                      </div>
                    ) : elem.field_type === 'interactive_field' ? (
                      <div className="mt-1 pt-1 border-t border-slate-100 space-y-1 text-[11px] bg-purple-50/50 p-1.5 rounded">
                        <div className="text-purple-800 font-semibold text-[10px]">
                          Description &bull; Input Part
                        </div>
                        <div className="h-4 bg-white rounded border border-purple-200" />
                      </div>
                    ) : elem.field_type === 'iteration_container' ||
                      elem.field_type === 'iteration_group' ||
                      elem.field_type === 'interactive_list' ||
                      elem.field_type === 'repeatable_list' ||
                      (elem.container_children && elem.container_children.length > 0) ||
                      (elem.iteration_fields && elem.iteration_fields.length > 0) ? (
                      <div className="mt-1 pt-1 border-t border-dashed border-slate-200 text-[11px] text-blue-700 bg-blue-50/50 p-1.5 rounded space-y-1">
                        <div className="flex items-center justify-between font-semibold text-blue-900 text-[10px]">
                          <span>📦 Iterative Container</span>
                          <span>{getContainerChildren(elem).length} Children</span>
                        </div>
                        <div className="text-[10px] text-blue-800 font-mono truncate">
                          {getContainerChildren(elem).map((c) => c.key || c.label || c.id).join(' • ') ||
                            'Reason • Todo • Response'}
                        </div>
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
