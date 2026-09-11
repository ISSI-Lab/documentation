import React from 'react';
import {
  FileText,
  Layers,
  ShieldAlert,
  PlusCircle,
  RotateCcw,
  Edit3,
  Trash2,
  ListTree,
  FolderKanban,
} from 'lucide-react';
import { Template } from '../../types';

interface TemplateListProps {
  templates: Template[];
  loading: boolean;
  onSelectTemplateToCreate: (template: Template) => void;
  onEditTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onCreateNewTemplate: () => void;
  onResetSeeds: () => void;
}

export const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  loading,
  onSelectTemplateToCreate,
  onEditTemplate,
  onDeleteTemplate,
  onCreateNewTemplate,
  onResetSeeds,
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'layers':
        return <Layers className="w-5 h-5 text-indigo-600" />;
      case 'shield-alert':
        return <ShieldAlert className="w-5 h-5 text-amber-600" />;
      default:
        return <FileText className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header section */}
      <div className="sm:flex sm:items-center sm:justify-between pb-6 border-b border-slate-200 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ListTree className="w-7 h-7 text-blue-600" />
            Document Templates & Structures
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Define reusable document blueprints containing configured markdown input fields and document elements.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <button
            type="button"
            onClick={onResetSeeds}
            title="Restore default ADR, PRD, and Postmortem templates"
            className="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-1.5 text-slate-500" />
            Restore Standard Templates
          </button>
          <button
            type="button"
            onClick={onCreateNewTemplate}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Create New Template
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-slate-100 rounded w-full mb-2"></div>
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-6"></div>
              <div className="h-8 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-12">
          <FolderKanban className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-3 text-lg font-medium text-slate-900">No templates found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Get started by creating a custom template or restoring the standard industry templates (ADR, PRD, Postmortem).
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={onResetSeeds}
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Restore Standards
            </button>
            <button
              onClick={onCreateNewTemplate}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Create Template
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => {
            const elements = template.document_elements || [];
            return (
              <div
                key={template.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6">
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200">
                        {getIcon(template.icon)}
                      </div>
                      <div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {template.category || 'General'}
                        </span>
                        <h3 className="text-base font-semibold text-slate-900 mt-1">
                          {template.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-sm text-slate-600 line-clamp-2">
                    {template.description || 'No description provided.'}
                  </p>

                  {/* Configured Document Elements summary */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      <span>Configured Elements</span>
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                        {elements.length} items
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {elements.slice(0, 5).map((elem, idx) => (
                        <div
                          key={elem.id || idx}
                          className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100"
                        >
                          <span className="truncate font-medium text-slate-700 max-w-[180px]">
                            {elem.label}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600 font-mono">
                            {elem.field_type}
                          </span>
                        </div>
                      ))}
                      {elements.length > 5 && (
                        <p className="text-[11px] text-slate-400 italic text-center pt-1">
                          +{elements.length - 5} more sections...
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => onEditTemplate(template.id)}
                      title="Edit template configuration"
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTemplate(template.id)}
                      title="Delete template"
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-200 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectTemplateToCreate(template)}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1" />
                    Use Template
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
