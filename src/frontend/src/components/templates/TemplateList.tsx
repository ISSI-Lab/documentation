import React, { useState } from 'react';
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
  Search,
  Tag,
  Globe,
  Lock,
  Shield,
} from 'lucide-react';
import { Team, Template, User } from '../../types';

interface TemplateListProps {
  templates: Template[];
  currentUser: User | null;
  activeTeam: Team | null;
  loading: boolean;
  onSelectTemplateToCreate: (template: Template) => void;
  onEditTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onCreateNewTemplate: () => void;
  onResetSeeds: () => void;
  onOpenAccountModal: () => void;
  onOpenAuthModal?: () => void;
}

export const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  currentUser,
  activeTeam,
  loading,
  onSelectTemplateToCreate,
  onEditTemplate,
  onDeleteTemplate,
  onCreateNewTemplate,
  onResetSeeds,
  onOpenAccountModal,
  onOpenAuthModal,
}) => {
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'public'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

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

  // Collect all unique tags
  const allTags = Array.from(
    new Set(templates.flatMap((t) => t.tags || []).filter((t) => t && t.trim()))
  );

  const canCreateOrEditTemplates =
    currentUser &&
    (activeTeam?.user_role === 'owner' ||
      activeTeam?.user_role === 'manager' ||
      currentUser?.user_type === 'organizer');

  // Filter templates
  const filteredTemplates = templates.filter((tpl) => {
    if (visibilityFilter === 'private' && tpl.visibility !== 'private') return false;
    if (visibilityFilter === 'public' && tpl.visibility !== 'public') return false;

    if (selectedTag) {
      if (!tpl.tags || !tpl.tags.includes(selectedTag)) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchTitle = tpl.title.toLowerCase().includes(q);
      const matchDesc = (tpl.description || '').toLowerCase().includes(q);
      const matchCat = (tpl.category || '').toLowerCase().includes(q);
      const matchTag = (tpl.tags || []).some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchCat && !matchTag) return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Public Template Pool Hero Banner (Shown when not logged in) */}
      {!currentUser && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-6 sm:p-8 mb-8 shadow-xl border border-indigo-900/50 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/20 inline-flex items-center gap-1.5 mb-3">
                <Globe className="w-3.5 h-3.5 text-blue-400" /> Public Document Template Pool
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Public Document Templates & Architectural Blueprints
              </h2>
              <p className="text-slate-300 text-sm mt-2 max-w-2xl leading-relaxed">
                Explore our public pool of document templates. Inspect the section structures, field types, and markdown generators. Sign in to start authoring documents, creating your own teams, and building custom templates.
              </p>
            </div>
            {onOpenAuthModal && (
              <div className="flex items-center gap-3">
                <button
                  onClick={onOpenAuthModal}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all whitespace-nowrap cursor-pointer"
                >
                  Sign In / Register to Start
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="sm:flex sm:items-center sm:justify-between pb-6 border-b border-slate-200 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ListTree className="w-7 h-7 text-indigo-600" />
            {currentUser ? 'Document Templates' : 'Public Template Pool'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {currentUser
              ? 'Predefined structure blueprints for team documentation. Private templates are scoped to your team; public templates are platform-wide.'
              : 'Browse public templates available for creating Architecture Decision Records, PRDs, and Incident Postmortems.'}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-2.5">
          {currentUser ? (
            canCreateOrEditTemplates ? (
              <>
                <button
                  type="button"
                  onClick={onResetSeeds}
                  title="Restore default ADR, PRD, and Postmortem templates"
                  className="inline-flex items-center px-3 py-2 border border-slate-300 shadow-xs text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  Restore Standard Seeds
                </button>
                <button
                  type="button"
                  onClick={onCreateNewTemplate}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-semibold rounded-xl shadow-xs text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  Create New Template
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-xs text-amber-800">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Template creation is available to Team Owners, Managers, and Organizers.</span>
              </div>
            )
          ) : (
            onOpenAuthModal && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-semibold rounded-xl shadow-xs text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Sign In to Use Templates
              </button>
            )
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {/* Visibility Filter Tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setVisibilityFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              visibilityFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Templates ({templates.length})
          </button>
          <button
            onClick={() => setVisibilityFilter('private')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              visibilityFilter === 'private'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3 h-3 text-indigo-600" />
            Team Private
          </button>
          <button
            onClick={() => setVisibilityFilter('public')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              visibilityFilter === 'public'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3 h-3 text-blue-600" />
            Public Shared
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by title, tag, or keyword..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </div>

      {/* Tag pills bar */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-6 pb-2">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mr-1">
            <Tag className="w-3 h-3" /> Tags:
          </span>
          <button
            onClick={() => setSelectedTag(null)}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
              selectedTag === null
                ? 'bg-slate-900 text-white font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                selectedTag === tag
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-slate-100 rounded w-full mb-2"></div>
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-6"></div>
              <div className="h-8 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-12">
          <FolderKanban className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-3 text-lg font-bold text-slate-900">No matching templates found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Try adjusting your search query, filter tabs, or tags.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const elements = template.document_elements || [];
            const isPublic = template.visibility === 'public';
            return (
              <div
                key={template.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                        {getIcon(template.icon)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {template.category || 'General'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPublic
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {isPublic ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                            {isPublic ? 'Public' : 'Team Private'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1">
                          {template.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-xs text-slate-600 line-clamp-2">
                    {template.description || 'No description provided.'}
                  </p>

                  {/* Tags */}
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-3">
                      {template.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Configured Document Elements summary */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      <span>Configured Sections</span>
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                        {elements.length} items
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {elements.slice(0, 4).map((elem, idx) => (
                        <div
                          key={elem.id || idx}
                          className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100"
                        >
                          <span className="truncate font-medium text-slate-700 max-w-[170px]">
                            {elem.label}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600 font-mono">
                            {elem.field_type}
                          </span>
                        </div>
                      ))}
                      {elements.length > 4 && (
                        <p className="text-[10px] text-slate-400 italic text-center pt-0.5">
                          +{elements.length - 4} more sections...
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    {canCreateOrEditTemplates ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditTemplate(template.id)}
                          title="Edit template blueprint"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTemplate(template.id)}
                          title="Delete template"
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Read-only template</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser && onOpenAuthModal) {
                        onOpenAuthModal();
                      } else {
                        onSelectTemplateToCreate(template);
                      }
                    }}
                    className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1" />
                    {currentUser ? 'Use Template' : 'Use Template (Sign In)'}
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
