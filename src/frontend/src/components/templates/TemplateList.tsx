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
  Globe,
  Lock,
  Users,
} from 'lucide-react';
import { Team, Template, User } from '../../types';

interface TemplateListProps {
  templates: Template[];
  currentUser: User | null;
  teams?: Team[];
  activeTeam?: Team | null;
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
  teams = [],
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
  // Categories: 'all' | 'public' | 'personal' | 'teams'
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'public' | 'personal' | 'teams'>('all');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return null;
    const team = teams.find((t) => t.id === teamId);
    return team ? team.name : 'Team Template';
  };

  const publicCount = templates.filter((t) => t.visibility === 'public').length;
  const personalCount = templates.filter((t) => t.visibility === 'private' && !t.team_id).length;
  const teamCount = templates.filter((t) => t.visibility === 'private' && Boolean(t.team_id)).length;

  // Filter templates
  const filteredTemplates = templates.filter((tpl) => {
    // 1. Category Filter: Public vs Personal vs Team's
    if (selectedCategory === 'public' && tpl.visibility !== 'public') return false;
    if (selectedCategory === 'personal' && (tpl.visibility !== 'private' || tpl.team_id !== null)) return false;
    if (selectedCategory === 'teams') {
      if (tpl.visibility !== 'private' || !tpl.team_id) return false;
      if (selectedTeamId !== 'all' && tpl.team_id !== selectedTeamId) return false;
    }
    if (selectedCategory === 'all') {
      if (selectedTeamId !== 'all' && tpl.team_id !== selectedTeamId && tpl.visibility === 'private' && tpl.team_id !== null) {
        return false;
      }
    }

    // 2. Search Filter
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
        <div className="bg-slate-900 text-white p-6 sm:p-8 mb-8 border border-slate-700 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="px-2.5 py-0.5 bg-blue-900/60 text-blue-300 text-xs font-bold border border-blue-700/60 inline-flex items-center gap-1.5 mb-3">
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
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all whitespace-nowrap cursor-pointer border border-blue-500"
                >
                  Sign In / Register to Start
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header section with Create New Template Action */}
      <div className="sm:flex sm:items-center sm:justify-between pb-6 border-b border-slate-300 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ListTree className="w-7 h-7 text-indigo-600" />
            Template
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse public template blueprints, your personal templates, and team-specific schemas.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-2.5">
          {currentUser ? (
            <>
              <button
                type="button"
                onClick={onResetSeeds}
                title="Restore default ADR, PRD, and Postmortem templates"
                className="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Restore Seeds
              </button>
              <button
                type="button"
                onClick={onCreateNewTemplate}
                className="inline-flex items-center px-4 py-2 border border-indigo-700 text-xs font-semibold shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Create New Template
              </button>
            </>
          ) : (
            onOpenAuthModal && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="inline-flex items-center px-4 py-2 border border-blue-700 text-xs font-semibold shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Sign In to Create & Use Templates
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Categories: Public vs Personal vs Each Team's Templates */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center border border-slate-300 bg-slate-100 p-1 w-fit flex-wrap gap-1">
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedTeamId('all');
              }}
              className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({templates.length})
            </button>

            <button
              onClick={() => {
                setSelectedCategory('public');
                setSelectedTeamId('all');
              }}
              className={`px-3.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center sm:min-w-[180px] ${
                selectedCategory === 'public'
                  ? 'bg-white text-blue-900 shadow-sm border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Public Pool ({publicCount})</span>
            </button>

            {currentUser && (
              <button
                onClick={() => {
                  setSelectedCategory('personal');
                  setSelectedTeamId('all');
                }}
                className={`px-3.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center sm:min-w-[180px] ${
                  selectedCategory === 'personal'
                    ? 'bg-white text-emerald-900 shadow-sm border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Personal ({personalCount})</span>
              </button>
            )}

            {currentUser && (
              <button
                onClick={() => {
                  setSelectedCategory('teams');
                  if (teams.length > 0 && selectedTeamId === 'all') {
                    setSelectedTeamId('all');
                  }
                }}
                className={`px-3.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center sm:min-w-[180px] ${
                  selectedCategory === 'teams'
                    ? 'bg-white text-indigo-900 shadow-sm border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Team Templates ({teamCount})</span>
              </button>
            )}
          </div>

          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by title, tag, or description..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
        </div>

        {/* Sub-Tabs: Each Team Selector (When in Team category or All with multiple teams) */}
        {currentUser && (selectedCategory === 'teams' || selectedCategory === 'all') && teams.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Users className="w-3.5 h-3.5 text-indigo-600" /> Teams:
            </span>
            <button
              onClick={() => setSelectedTeamId('all')}
              className={`text-xs px-3 py-1 font-medium border transition-colors cursor-pointer ${
                selectedTeamId === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              All My Teams
            </button>
            {teams.map((t) => {
              const teamTpls = templates.filter((tpl) => tpl.team_id === t.id).length;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedCategory('teams');
                    setSelectedTeamId(t.id);
                  }}
                  className={`text-xs px-3 py-1 font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    selectedTeamId === t.id
                      ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{t.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 ${
                      selectedTeamId === t.id
                        ? 'bg-indigo-800 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {teamTpls}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white p-6 border border-slate-300 shadow-sm">
              <div className="h-6 bg-slate-200 w-3/4 mb-3"></div>
              <div className="h-4 bg-slate-100 w-full mb-2"></div>
              <div className="h-4 bg-slate-100 w-2/3 mb-6"></div>
              <div className="h-8 bg-slate-100"></div>
            </div>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-300 p-12">
          <FolderKanban className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-3 text-lg font-bold text-slate-900">No matching templates found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {selectedCategory === 'teams' && teams.length === 0
              ? 'You are not yet a member of any team. Join or create a team to access and create team templates.'
              : 'Try adjusting your search query or category tabs.'}
          </p>
          {currentUser && (
            <div className="mt-6">
              <button
                type="button"
                onClick={onCreateNewTemplate}
                className="inline-flex items-center px-4 py-2 border border-indigo-700 text-xs font-semibold shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Create New Template
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const elements = template.document_elements || [];
            const isPublic = template.visibility === 'public';
            const isPersonal = template.visibility === 'private' && !template.team_id;
            const teamName = !isPublic && !isPersonal ? getTeamName(template.team_id) : null;

            return (
              <div
                key={template.id}
                className="bg-white border border-slate-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-slate-100 border border-slate-300">
                        {getIcon(template.icon)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {template.category || 'General'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border ${
                              isPublic
                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                : isPersonal
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-300'
                            }`}
                          >
                            {isPublic ? (
                              <>
                                <Globe className="w-2.5 h-2.5" /> Public
                              </>
                            ) : isPersonal ? (
                              <>
                                <Lock className="w-2.5 h-2.5" /> Personal
                              </>
                            ) : (
                              <>
                                <Users className="w-2.5 h-2.5" /> {teamName || 'Team'}
                              </>
                            )}
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
                          className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 border border-slate-200"
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
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 font-bold text-[10px] border border-blue-200">
                        {elements.length} items
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {elements.slice(0, 4).map((elem, idx) => (
                        <div
                          key={elem.id || idx}
                          className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 border border-slate-200"
                        >
                          <span className="truncate font-medium text-slate-700 max-w-[170px]">
                            {elem.label}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 font-mono">
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
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    {currentUser ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditTemplate(template.id)}
                          title="Edit template blueprint"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 transition-colors cursor-pointer border border-transparent hover:border-slate-300"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTemplate(template.id)}
                          title="Delete template"
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer border border-transparent hover:border-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Read-only</span>
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
                    className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer border border-indigo-700"
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
