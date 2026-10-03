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
  Building2,
  BookmarkCheck,
  CheckCircle2,
  User as UserIcon,
} from 'lucide-react';
import { Document, Organization, Project, Team, Template, User } from '../../types';

interface PersonalHomepageProps {
  currentUser: User;
  organizations?: Organization[];
  teams?: Team[]; // compatibility alias
  allProjects: Project[];
  documents: Document[];
  templates: Template[];
  onNavigateToOrganizations?: () => void;
  onNavigateToTeams?: () => void; // compatibility alias
  onNavigateToDocuments: (organizationId?: string | null, projectId?: string | null) => void;
  onNavigateToTemplates: () => void;
  onOpenCreateOrganization?: () => void;
  onOpenCreateTeam?: () => void; // compatibility alias
  onOpenJoinOrganization?: () => void;
  onOpenJoinTeam?: () => void; // compatibility alias
  onOpenCreateProject: (organizationId: string) => void;
  onOpenNewDocModal: (organizationId?: string | null, projectId?: string | null, templateId?: string | null) => void;
  onViewDocument: (docId: string) => void;
  onEditDocument?: (docId: string) => void;
  onSelectOrganization?: (organizationId: string) => void;
  onSelectTeam?: (teamId: string) => void; // compatibility alias
}

export const PersonalHomepage: React.FC<PersonalHomepageProps> = ({
  currentUser,
  organizations: propOrganizations,
  teams: propTeams,
  allProjects,
  documents,
  templates,
  onNavigateToOrganizations,
  onNavigateToTeams,
  onNavigateToDocuments,
  onNavigateToTemplates,
  onOpenCreateOrganization,
  onOpenCreateTeam,
  onOpenJoinOrganization,
  onOpenJoinTeam,
  onOpenCreateProject,
  onOpenNewDocModal,
  onViewDocument,
  onSelectOrganization,
  onSelectTeam,
}) => {
  const organizations = propOrganizations || propTeams || [];
  const handleNavOrgs = onNavigateToOrganizations || onNavigateToTeams || (() => {});
  const handleNavTeams = onNavigateToTeams || onNavigateToOrganizations || (() => {});
  const handleCreateOrg = onOpenCreateOrganization || onOpenCreateTeam || (() => {});
  const handleJoinOrg = onOpenJoinOrganization || onOpenJoinTeam || (() => {});
  const handleSelectOrg = (id: string) => {
    if (onSelectOrganization) onSelectOrganization(id);
    if (onSelectTeam) onSelectTeam(id);
  };
  const publicTemplates = templates.filter((t) => t.visibility === 'public');
  const recentDocuments = documents.slice(0, 5);

  const getRoleBadge = (role?: string, isCreator?: boolean) => {
    if (isCreator || role === 'owner') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
          <Crown className="w-3 h-3 text-purple-600" />
          Organization Creator
        </span>
      );
    }
    if (role === 'manager') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
          <ShieldCheck className="w-3 h-3 text-indigo-600" />
          Organization Manager
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
        <Users className="w-3 h-3 text-slate-500" />
        Organization Member
      </span>
    );
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
              Manage your organizations, view active projects, and create structured documentation using standard blueprints from the template pool.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCreateOrg}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-900 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Create Organization</span>
            </button>
            <button
              onClick={handleNavTeams}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl border border-white/20 backdrop-blur-sm transition-all cursor-pointer"
            >
              <Users className="w-4 h-4 text-indigo-200" />
              <span>Teams & Sets</span>
            </button>
            <button
              onClick={handleJoinOrg}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl border border-white/20 backdrop-blur-sm transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-blue-200" />
              <span>Join Organization</span>
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
              <span className="text-xs text-blue-200 font-medium">Your Organizations</span>
              <Building2 className="w-4 h-4 text-blue-300" />
            </div>
            <p className="text-2xl font-bold mt-1">{organizations.length}</p>
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

      {/* Main Grid: Organizations & Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Section: Your Organizations (8 Cols on large) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Organizations Section */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Your Organizations</h2>
                  <p className="text-xs text-slate-500">
                    Organizations you have created or joined as an owner, manager, or member.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateOrg}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Organization</span>
                </button>
                <button
                  onClick={handleNavOrgs}
                  className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1 ml-2 cursor-pointer"
                >
                  <span>Manage All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {organizations.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-700">No organizations yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Create an organization to become the Organization Owner and assign managers/members, or join an existing organization with a join token.
                </p>
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    onClick={handleCreateOrg}
                    className="px-4 py-2 bg-indigo-600 text-white font-semibold text-xs rounded-xl hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
                  >
                    Create Your First Organization
                  </button>
                  <button
                    onClick={handleJoinOrg}
                    className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Join with Token
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {organizations.map((org) => {
                  const orgProjects = allProjects.filter((p) => (p.organization_id || p.team_id) === org.id);
                  const isCreator = Boolean(
                    org.is_creator ||
                    (org.created_by && currentUser?.id && org.created_by === currentUser.id) ||
                    (org.user_role === 'owner')
                  );

                  return (
                    <div
                      key={org.id}
                      className="bg-slate-50 hover:bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-base font-bold text-slate-900 line-clamp-1">{org.name}</h3>
                          {getRoleBadge(org.user_role, isCreator)}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                          {org.description || 'No organization description provided.'}
                        </p>

                        <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-indigo-500" />
                            {org.members_count || 1} members
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <FolderKanban className="w-3.5 h-3.5 text-blue-500" />
                            {orgProjects.length} projects
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200/80 pt-3 mt-4">
                        <button
                          onClick={() => {
                            handleSelectOrg(org.id);
                            handleNavOrgs();
                          }}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open Workspace</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        {isCreator ? (
                          <button
                            onClick={() => onOpenCreateProject(org.id)}
                            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-slate-400" />
                            <span>Add Project</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>Member View</span>
                          </span>
                        )}
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
                    Active project workspaces across your organizations for organizing documents.
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
                  Create a project inside any of your organizations to begin authoring documents.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allProjects.map((project) => {
                  const orgId = project.organization_id || project.team_id;
                  const parentOrg = organizations.find((o) => o.id === orgId);
                  return (
                    <div
                      key={project.id}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all flex flex-col justify-between bg-slate-50/50 hover:bg-white"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {parentOrg?.name || 'Organization Project'}
                          </span>
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <FileText className="w-3 h-3 text-blue-500" />
                            {project.documents_count || 0} docs
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">{project.name}</h4>
                        {project.association_type === 'individual' ? (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                              <UserIcon className="w-3 h-3 text-emerald-600" />
                              Individual Assigned
                            </span>
                          </div>
                        ) : project.team_assignment_set_name ? (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                              <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                              Formation: {project.team_assignment_set_name}
                            </span>
                          </div>
                        ) : null}
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {project.description || 'No description.'}
                        </p>

                        {project.association_type === 'individual' ? (
                          (project.individual_members || []).length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                              {project.individual_members?.map((im) => (
                                <span
                                  key={im.user_id}
                                  className="text-[10px] bg-white text-slate-700 font-medium px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs"
                                >
                                  {im.user_name || im.user_id} ({im.role})
                                </span>
                              ))}
                            </div>
                          )
                        ) : (
                          (project.assigned_teams || []).length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                              {project.assigned_teams?.map((at) => (
                                <span
                                  key={at.team_id}
                                  className="text-[10px] bg-white text-slate-700 font-medium px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs"
                                >
                                  {at.team_name}
                                </span>
                              ))}
                            </div>
                          )
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                        <button
                          onClick={() => onNavigateToDocuments(orgId, project.id)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          View Documents &rarr;
                        </button>
                        <button
                          onClick={() => onOpenNewDocModal(orgId, project.id)}
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
