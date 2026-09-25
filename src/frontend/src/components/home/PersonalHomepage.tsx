import React from 'react';
import {
  Users,
  FolderKanban,
  FileText,
  PlusCircle,
  Plus,
  KeyRound,
  Crown,
  ShieldCheck,
  ArrowRight,
  Globe,
  Layers,
} from 'lucide-react';
import { Document, Project, Team, Template, User } from '../../types';

interface PersonalHomepageProps {
  currentUser: User;
  teams: Team[];
  allProjects: Project[];
  documents: Document[];
  templates: Template[];
  onNavigateToTeams: () => void;
  onNavigateToDocuments: (teamId?: string | null, projectId?: string | null) => void;
  onNavigateToTemplates: () => void;
  onOpenCreateTeam: () => void;
  onOpenJoinTeam: () => void;
  onOpenCreateProject: (teamId: string) => void;
  onOpenNewDocModal: (teamId?: string | null, projectId?: string | null, templateId?: string | null) => void;
  onViewDocument: (docId: string) => void;
  onEditDocument: (docId: string) => void;
  onSelectTeam: (teamId: string) => void;
}

export const PersonalHomepage: React.FC<PersonalHomepageProps> = ({
  currentUser,
  teams,
  allProjects,
  documents,
  templates,
  onNavigateToTeams,
  onNavigateToDocuments,
  onNavigateToTemplates,
  onOpenCreateTeam,
  onOpenJoinTeam,
  onOpenCreateProject,
  onOpenNewDocModal,
  onViewDocument,
  onSelectTeam,
}) => {
  const publicTemplates = templates.filter((t) => t.visibility === 'public');
  const recentDocuments = documents.slice(0, 5);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
            <Crown className="w-3 h-3 text-purple-600" />
            Team Owner
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
            <ShieldCheck className="w-3 h-3 text-indigo-600" />
            Team Manager
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <Users className="w-3 h-3 text-slate-500" />
            Team Member
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      {/* Welcome & Overview Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <Layers className="w-80 h-80 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm">
                Personal Workspace
              </span>
              <span className="text-xs text-blue-200 uppercase tracking-wider font-semibold">
                Role: {currentUser.user_type}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {currentUser.name || currentUser.username}!
            </h1>
            <p className="text-blue-100 text-sm mt-1.5 max-w-2xl">
              Manage your teams, view active projects, and create structured documentation using standard blueprints from the template pool.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenCreateTeam}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-900 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Create Team</span>
            </button>
            <button
              onClick={onOpenJoinTeam}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl border border-white/20 backdrop-blur-sm transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-blue-200" />
              <span>Join Team</span>
            </button>
            <button
              onClick={() => onOpenNewDocModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Document</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-white/15">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-200 font-medium">Your Teams</span>
              <Users className="w-4 h-4 text-blue-300" />
            </div>
            <p className="text-2xl font-bold mt-1">{teams.length}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-200 font-medium">Your Projects</span>
              <FolderKanban className="w-4 h-4 text-blue-300" />
            </div>
            <p className="text-2xl font-bold mt-1">{allProjects.length}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-200 font-medium">Documents</span>
              <FileText className="w-4 h-4 text-blue-300" />
            </div>
            <p className="text-2xl font-bold mt-1">{documents.length}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-200 font-medium">Public Templates</span>
              <Globe className="w-4 h-4 text-blue-300" />
            </div>
            <p className="text-2xl font-bold mt-1">{publicTemplates.length}</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Teams & Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Section: Your Teams (8 Cols on large) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Teams Section */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Your Teams</h2>
                  <p className="text-xs text-slate-500">
                    Teams you have created or joined as an owner, manager, or member.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenCreateTeam}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Team</span>
                </button>
                <button
                  onClick={onNavigateToTeams}
                  className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1 ml-2 cursor-pointer"
                >
                  <span>Manage All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {teams.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-700">No teams yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Create a team to become the Team Owner and assign managers/members, or join an existing team with a join token.
                </p>
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    onClick={onOpenCreateTeam}
                    className="px-4 py-2 bg-indigo-600 text-white font-semibold text-xs rounded-xl hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
                  >
                    Create Your First Team
                  </button>
                  <button
                    onClick={onOpenJoinTeam}
                    className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Join with Token
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((team) => {
                  const teamProjects = allProjects.filter((p) => p.team_id === team.id);
                  const isOwner = team.user_role === 'owner' || team.created_by === currentUser.id;

                  return (
                    <div
                      key={team.id}
                      className="bg-slate-50 hover:bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-base font-bold text-slate-900 line-clamp-1">{team.name}</h3>
                          {getRoleBadge(isOwner ? 'owner' : team.user_role)}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                          {team.description || 'No team description provided.'}
                        </p>

                        <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-indigo-500" />
                            {team.members_count || 1} members
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <FolderKanban className="w-3.5 h-3.5 text-blue-500" />
                            {teamProjects.length} projects
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200/80 pt-3 mt-4">
                        <button
                          onClick={() => {
                            onSelectTeam(team.id);
                            onNavigateToTeams();
                          }}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open Workspace</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onOpenCreateProject(team.id)}
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-slate-400" />
                          <span>Add Project</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Projects Section */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Your Projects</h2>
                  <p className="text-xs text-slate-500">
                    Active project workspaces across your teams for organizing documents.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateToDocuments()}
                className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
              >
                <span>View All Documents</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {allProjects.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <FolderKanban className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No projects yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Create a project inside any of your teams to begin authoring documents.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allProjects.map((project) => {
                  const parentTeam = teams.find((t) => t.id === project.team_id);
                  return (
                    <div
                      key={project.id}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all flex flex-col justify-between bg-slate-50/50 hover:bg-white"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {parentTeam?.name || 'Team Project'}
                          </span>
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <FileText className="w-3 h-3 text-blue-500" />
                            {project.documents_count || 0} docs
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">{project.name}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {project.description || 'No description.'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                        <button
                          onClick={() => onNavigateToDocuments(project.team_id, project.id)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          View Documents &rarr;
                        </button>
                        <button
                          onClick={() => onOpenNewDocModal(project.team_id, project.id)}
                          className="text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-slate-500" />
                          <span>New Doc</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Recent Documents & Template Pool Spotlight */}
        <div className="lg:col-span-4 space-y-8">
          {/* Recent Documents Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Recent Documents</h3>
              </div>
              <button
                onClick={() => onNavigateToDocuments()}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
              >
                All &rarr;
              </button>
            </div>

            {recentDocuments.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                No documents created yet.
                <button
                  onClick={() => onOpenNewDocModal()}
                  className="block mx-auto mt-2 text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Create your first document
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => onViewDocument(doc.id)}
                    className="cursor-pointer p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/80 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-800 line-clamp-1 hover:text-blue-600">
                        {doc.title}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getStatusBadge(
                          doc.status
                        )}`}
                      >
                        {doc.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>{doc.template_title}</span>
                      <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Public Template Pool Spotlight */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Public Template Pool</h3>
                  <p className="text-[11px] text-slate-400">Standard reusable blueprints</p>
                </div>
              </div>
              <button
                onClick={onNavigateToTemplates}
                className="text-xs text-indigo-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Browse</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5">
              {publicTemplates.slice(0, 3).map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-white/10 hover:bg-white/15 p-3 rounded-xl border border-white/10 transition-colors flex items-center justify-between gap-2"
                >
                  <div>
                    <h4 className="text-xs font-bold text-white line-clamp-1">{tpl.title}</h4>
                    <p className="text-[10px] text-slate-300 line-clamp-1 mt-0.5">
                      {tpl.category} &bull; {(tpl.document_elements || []).length} sections
                    </p>
                  </div>
                  <button
                    onClick={() => onOpenNewDocModal(undefined, undefined, tpl.id)}
                    className="shrink-0 px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={onNavigateToTemplates}
              className="w-full py-2 bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white text-xs font-semibold rounded-xl text-center transition-colors block cursor-pointer"
            >
              Explore All {templates.length} Templates &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
