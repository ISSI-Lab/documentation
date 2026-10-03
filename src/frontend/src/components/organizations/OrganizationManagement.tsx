import React, { useState, useEffect } from 'react';
import {
  Users,
  User as UserIcon,
  FolderKanban,
  KeyRound,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  UserMinus,
  UserPlus,
  FolderPlus,
  FileText,
  Search,
  Crown,
  Building2,
  BookmarkCheck,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { api } from '../../api/client';
import {
  Project,
  Organization,
  OrganizationMember,
  User,
  OrganizationTeam,
  TeamAssignmentSet,
  ProjectAssociationType,
  ProjectDocumentCreationPermission,
} from '../../types';
import { ProjectTeamAssignmentModal } from '../projects/ProjectTeamAssignmentModal';

interface OrganizationManagementProps {
  currentUser: User | null;
  organizations?: Organization[];
  teams?: Organization[]; // compatibility alias
  activeOrganizationId?: string | null;
  activeTeamId?: string | null; // compatibility alias
  onSelectOrganization: (organizationId: string) => void;
  onSelectTeam?: (teamId: string) => void; // compatibility alias
  onRefreshOrganizations: () => Promise<void>;
  onRefreshTeams?: () => Promise<void>; // compatibility alias
  onOpenAccountModal: () => void;
  onOpenNewDocModal: (projectId?: string) => void;
  onViewProjectDocs: (organizationId: string, projectId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const OrganizationManagement: React.FC<OrganizationManagementProps> = ({
  currentUser,
  organizations: propOrganizations,
  teams: propTeams,
  activeOrganizationId: propActiveOrgId,
  activeTeamId: propActiveTeamId,
  onSelectOrganization,
  onSelectTeam,
  onRefreshOrganizations,
  onRefreshTeams,
  onOpenAccountModal,
  onOpenNewDocModal,
  onViewProjectDocs,
  showToast,
}) => {
  const organizations = propOrganizations || propTeams || [];
  const activeOrganizationId = propActiveOrgId || propActiveTeamId || null;

  const handleSelectOrg = (id: string) => {
    onSelectOrganization(id);
    if (onSelectTeam) onSelectTeam(id);
  };

  const handleRefresh = async () => {
    if (onRefreshOrganizations) await onRefreshOrganizations();
    else if (onRefreshTeams) await onRefreshTeams();
  };

  const [activeTab, setActiveTab] = useState<'projects' | 'teams' | 'sets' | 'members'>('projects');
  const [currentOrgDetails, setCurrentOrgDetails] = useState<Organization | null>(null);
  const [orgTeams, setOrgTeams] = useState<OrganizationTeam[]>([]);
  const [orgSets, setOrgSets] = useState<TeamAssignmentSet[]>([]);
  const [selectedProjectForAssignment, setSelectedProjectForAssignment] = useState<Project | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(false);

  // Modals state
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDesc, setNewOrgDesc] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [isJoinOrgOpen, setIsJoinOrgOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joiningOrg, setJoiningOrg] = useState(false);

  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectAssocType, setNewProjectAssocType] = useState<ProjectAssociationType>('team');
  const [newProjectDocCreationPerm, setNewProjectDocCreationPerm] = useState<ProjectDocumentCreationPermission>('all_members');
  const [creatingProject, setCreatingProject] = useState(false);

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [foundUsers, setFoundUsers] = useState<User[]>([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<User | null>(null);
  const [memberRoleToAdd, setMemberRoleToAdd] = useState<'manager' | 'member'>('member');
  const [addingMember, setAddingMember] = useState(false);

  const [copiedToken, setCopiedToken] = useState(false);

  const loadOrgDetails = async (orgId: string) => {
    try {
      setLoadingOrg(true);
      const [res, teamsData, setsData] = await Promise.all([
        api.getOrganization(orgId),
        api.listOrganizationTeams(orgId),
        api.listTeamAssignmentSets(orgId),
      ]);
      setCurrentOrgDetails(res.organization);
      setOrgTeams(teamsData);
      setOrgSets(setsData);
    } catch (err: any) {
      showToast(err.message || 'Failed to load organization details', 'error');
    } finally {
      setLoadingOrg(false);
    }
  };

  useEffect(() => {
    if (activeOrganizationId) {
      loadOrgDetails(activeOrganizationId);
    } else if (organizations.length > 0) {
      handleSelectOrg(organizations[0].id);
    } else {
      setCurrentOrgDetails(null);
    }
  }, [activeOrganizationId, organizations]);

  const handleCopyJoinToken = () => {
    if (currentOrgDetails?.join_code) {
      navigator.clipboard.writeText(currentOrgDetails.join_code);
      setCopiedToken(true);
      showToast('Join token copied to clipboard!');
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleRegenerateToken = async () => {
    if (!currentOrgDetails) return;
    if (!window.confirm('Regenerate join token? Existing links with the old token will become invalid.')) return;
    try {
      const res = await api.regenerateOrganizationJoinToken(currentOrgDetails.id);
      setCurrentOrgDetails((prev) => (prev ? { ...prev, join_code: res.join_code } : null));
      showToast('New join token generated!');
      await handleRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to regenerate token', 'error');
    }
  };

  const handleCreateOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      setCreatingOrg(true);
      const newOrg = await api.createOrganization({ name: newOrgName, description: newOrgDesc });
      showToast(`Organization "${newOrg.name}" created! You are now the Organization Owner.`);
      setNewOrgName('');
      setNewOrgDesc('');
      setIsCreateOrgOpen(false);
      await handleRefresh();
      handleSelectOrg(newOrg.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to create organization', 'error');
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleJoinOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setJoiningOrg(true);
      const res = await api.joinOrganization({ join_code: joinCodeInput });
      showToast(res.message);
      setJoinCodeInput('');
      setIsJoinOrgOpen(false);
      await handleRefresh();
      handleSelectOrg(res.organization.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to join organization', 'error');
    } finally {
      setJoiningOrg(false);
    }
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgDetails) return;
    try {
      setCreatingProject(true);
      const newProj = await api.createProject({
        organization_id: currentOrgDetails.id,
        name: newProjectName,
        description: newProjectDesc,
        association_type: newProjectAssocType,
        document_creation_permission: newProjectDocCreationPerm,
      });
      showToast(`Project "${newProj.name}" created!`);
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectAssocType('team');
      setNewProjectDocCreationPerm('all_members');
      setIsCreateProjectOpen(false);
      await loadOrgDetails(currentOrgDetails.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to create project', 'error');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleSearchUsers = async (query: string) => {
    setMemberSearchQuery(query);
    if (query.trim().length >= 2) {
      try {
        const users = await api.searchUsers(query);
        const existingMemberIds = new Set((currentOrgDetails?.members || []).map((m) => m.user_id));
        setFoundUsers(users.filter((u) => !existingMemberIds.has(u.id)));
      } catch {
        setFoundUsers([]);
      }
    } else {
      setFoundUsers([]);
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgDetails || !selectedUserToAdd) return;
    try {
      setAddingMember(true);
      await api.addOrganizationMember(currentOrgDetails.id, {
        userId: selectedUserToAdd.id,
        role: memberRoleToAdd,
      });
      showToast(`Added ${selectedUserToAdd.name || selectedUserToAdd.username} to organization!`);
      setSelectedUserToAdd(null);
      setMemberSearchQuery('');
      setFoundUsers([]);
      setIsAddMemberOpen(false);
      await loadOrgDetails(currentOrgDetails.id);
      await handleRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to add member', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleToggleMemberRole = async (targetMember: OrganizationMember) => {
    if (!currentOrgDetails) return;
    const newRole = targetMember.role === 'manager' ? 'member' : 'manager';
    try {
      await api.updateOrganizationMemberRole(currentOrgDetails.id, targetMember.user_id, newRole);
      showToast(`Updated ${targetMember.name || targetMember.username}'s role to ${newRole}`);
      await loadOrgDetails(currentOrgDetails.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to update member role', 'error');
    }
  };

  const handleRemoveMember = async (targetMember: OrganizationMember) => {
    if (!currentOrgDetails) return;
    if (!window.confirm(`Remove ${targetMember.name || targetMember.username} from this organization?`)) return;
    try {
      await api.removeOrganizationMember(currentOrgDetails.id, targetMember.user_id);
      showToast('Member removed from organization');
      await loadOrgDetails(currentOrgDetails.id);
      await handleRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove member', 'error');
    }
  };

  const isUserOrgOwner =
    currentOrgDetails?.user_role === 'owner' || currentOrgDetails?.created_by === currentUser?.id;
  const isUserOrgManager =
    isUserOrgOwner ||
    currentOrgDetails?.user_role === 'manager' ||
    currentUser?.user_type === 'organizer';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-indigo-600" />
            Organizations & Workspace Collaboration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Collaborate in organizations, organize shared documentation into projects, and manage template access.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsJoinOrgOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-indigo-500" />
            <span>Join with Token</span>
          </button>

          <button
            onClick={() => setIsCreateOrgOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Organization</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Organizations List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Your Organizations ({organizations.length})
              </h2>
              <button
                onClick={handleRefresh}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
              >
                Refresh
              </button>
            </div>

            {organizations.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No organizations joined yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Create your own organization or join an existing organization using a join token.
                </p>
                <button
                  onClick={() => setIsCreateOrgOpen(true)}
                  className="mt-3 px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Create Organization
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {organizations.map((t) => {
                  const isSelected = t.id === activeOrganizationId;
                  const isOwner = t.user_role === 'owner' || t.created_by === currentUser?.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectOrg(t.id)}
                      className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                          {t.name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isOwner
                              ? 'bg-purple-100 text-purple-800'
                              : t.user_role === 'manager'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isOwner ? <Crown className="w-2.5 h-2.5 text-purple-600" /> : null}
                          {isOwner ? 'Owner' : t.user_role === 'manager' ? 'Manager' : 'Member'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{t.description || 'No description provided'}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                        <span>{t.members_count || 1} members</span>
                        <span>&bull;</span>
                        <span className="font-mono text-slate-500">Token: {t.join_code}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Organization Details */}
        <div className="lg:col-span-8">
          {loadingOrg ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Loading organization workspace...</p>
            </div>
          ) : currentOrgDetails ? (
            <div className="space-y-6">
              {/* Organization Header Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{currentOrgDetails.name}</h2>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                          isUserOrgOwner
                            ? 'bg-purple-100 text-purple-800'
                            : currentOrgDetails.user_role === 'manager'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isUserOrgOwner && <Crown className="w-3.5 h-3.5 text-purple-600" />}
                        {isUserOrgOwner
                          ? 'You are Organization Owner (Full control)'
                          : currentOrgDetails.user_role === 'manager'
                          ? 'You are Organization Manager'
                          : 'You are Organization Member'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {currentOrgDetails.description || 'No organization description.'}
                    </p>
                  </div>

                  {/* Join Token Card */}
                  <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-3.5 rounded-xl flex flex-col gap-1.5 shadow-sm min-w-[220px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5" /> Join Token
                      </span>
                      {isUserOrgManager && (
                        <button
                          onClick={handleRegenerateToken}
                          title="Regenerate Join Code"
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold tracking-wider text-emerald-300">
                        {currentOrgDetails.join_code}
                      </span>
                      <button
                        onClick={handleCopyJoinToken}
                        className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                        title="Copy token to share"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">Share with colleagues to let them join this organization</p>
                  </div>
                </div>

                {/* Sub-navigation tabs */}
                <div className="flex items-center space-x-3 border-b border-slate-200 mt-6 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('projects')}
                    className={`pb-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'projects'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FolderKanban className="w-4 h-4" />
                    <span>Projects ({(currentOrgDetails.projects || []).length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('teams')}
                    className={`pb-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'teams'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Teams ({orgTeams.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('sets')}
                    className={`pb-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'sets'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>Assignment Sets ({orgSets.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('members')}
                    className={`pb-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'members'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Members ({(currentOrgDetails.members || []).length})</span>
                  </button>
                </div>
              </div>

              {/* Projects Tab */}
              {activeTab === 'projects' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Organization Projects</h3>
                    <button
                      onClick={() => setIsCreateProjectOpen(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>New Project</span>
                    </button>
                  </div>

                  {(currentOrgDetails.projects || []).length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                      <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-700">No projects created in this organization yet</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Create a project to organize and co-author documents with your organization.
                      </p>
                      <button
                        onClick={() => setIsCreateProjectOpen(true)}
                        className="mt-4 px-3.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs rounded-lg transition-colors"
                      >
                        Create First Project
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentOrgDetails.projects?.map((proj) => (
                        <div
                          key={proj.id}
                          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center space-x-2">
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                  <FolderKanban className="w-4 h-4" />
                                </div>
                                <h4 className="text-sm font-bold text-slate-900">{proj.name}</h4>
                              </div>
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <FileText className="w-3 h-3 text-slate-400" />
                                {proj.documents_count || 0} docs
                              </span>
                            </div>

                            {/* Badges: Association Mode & Document Creation Permission */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                              {proj.association_type === 'individual' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                                  <UserIcon className="w-3 h-3 text-emerald-600" />
                                  Individually Assigned
                                </span>
                              ) : proj.team_assignment_set_name ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                                  <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                                  Formation: {proj.team_assignment_set_name}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                                  <Users className="w-3 h-3 text-indigo-600" />
                                  Team Formation
                                </span>
                              )}

                              {proj.document_creation_permission === 'creator_only' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                                  <Lock className="w-3 h-3 text-amber-600" />
                                  Owner/Creator Docs Only
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded-md">
                                  <Users className="w-3 h-3 text-sky-600" />
                                  All Members Can Create
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {proj.description || 'No description provided.'}
                            </p>

                            {/* Assigned Staffing Badges */}
                            <div className="mt-3 pt-2 border-t border-slate-100">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                  {proj.association_type === 'individual' ? (
                                    <>
                                      <UserIcon className="w-3 h-3 text-emerald-600" />
                                      Assigned Members ({(proj.individual_members || []).length}):
                                    </>
                                  ) : (
                                    <>
                                      <Users className="w-3 h-3 text-indigo-600" />
                                      Assigned Teams ({(proj.assigned_teams || []).length}):
                                    </>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedProjectForAssignment(proj)}
                                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                                >
                                  {proj.association_type === 'individual' ? (
                                    <UserIcon className="w-3 h-3" />
                                  ) : (
                                    <Users className="w-3 h-3" />
                                  )}
                                  Manage Staffing
                                </button>
                              </div>

                              {proj.association_type === 'individual' ? (
                                (proj.individual_members || []).length === 0 ? (
                                  <span className="text-[11px] text-slate-400 italic">No members assigned directly</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {proj.individual_members?.map((im) => (
                                      <span
                                        key={im.user_id}
                                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                                          im.role === 'lead'
                                            ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold'
                                            : 'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}
                                        title={`Role: ${im.role}`}
                                      >
                                        {im.user_name || im.user_id} ({im.role})
                                      </span>
                                    ))}
                                  </div>
                                )
                              ) : (
                                (proj.assigned_teams || []).length === 0 ? (
                                  <span className="text-[11px] text-slate-400 italic">No teams assigned yet</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {proj.assigned_teams?.map((at) => (
                                      <span
                                        key={at.team_id}
                                        className="text-[10px] bg-slate-100 text-slate-700 font-medium px-1.5 py-0.5 rounded border border-slate-200"
                                        title={at.assigned_role ? `Role: ${at.assigned_role}` : undefined}
                                      >
                                        {at.team_name}
                                      </span>
                                    ))}
                                  </div>
                                )
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                            <button
                              onClick={() => onViewProjectDocs(currentOrgDetails.id, proj.id)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              View Documents &rarr;
                            </button>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSelectedProjectForAssignment(proj)}
                                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                                title="Manage project staffing & association"
                              >
                                {proj.association_type === 'individual' ? (
                                  <UserIcon className="w-3 h-3" />
                                ) : (
                                  <Users className="w-3 h-3" />
                                )}
                                Staffing
                              </button>
                              <button
                                onClick={() => onOpenNewDocModal(proj.id)}
                                className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add Doc
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Teams Tab in Org Workspace */}
              {activeTab === 'teams' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Teams in {currentOrgDetails.name}</h3>
                      <p className="text-xs text-slate-500">Teams can be assigned to different projects in this organization.</p>
                    </div>
                  </div>

                  {orgTeams.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                      <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-700">No teams created in this organization yet</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Use the "Teams & Assignments" page to create specialized teams.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {orgTeams.map((tm) => (
                        <div key={tm.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-bold text-slate-900">{tm.name}</h4>
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              {tm.members_count || tm.members?.length || 0} members
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mb-2">{tm.description || 'No description'}</p>
                          <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-slate-100">
                            {tm.members?.map((m) => (
                              <span
                                key={m.user_id}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  m.role === 'lead' ? 'bg-purple-100 text-purple-800 font-bold' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {m.role === 'lead' && '👑 '}
                                {m.name || m.username}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Assignment Sets Tab in Org Workspace */}
              {activeTab === 'sets' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Reusable Team Assignment Sets</h3>
                    <p className="text-xs text-slate-500">
                      Standard configurations of teams that can be associated with any project.
                    </p>
                  </div>

                  {orgSets.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                      <BookmarkCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-700">No team assignment sets created yet</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Use the "Teams & Assignments" page to create reusable sets, or save a project's team assignments as a set.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {orgSets.map((st) => (
                        <div key={st.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-bold text-slate-900">{st.name}</h4>
                            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                              Used in {st.associated_projects_count || 0} projects
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mb-2">{st.description || 'No description'}</p>
                          <div className="pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Included Teams ({st.teams?.length || st.items?.length || 0}):
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {st.teams && st.teams.length > 0
                                ? st.teams.map((tm) => (
                                    <span
                                      key={tm.id}
                                      className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200"
                                    >
                                      {tm.name} ({tm.members_count || tm.members?.length || 0} members)
                                    </span>
                                  ))
                                : st.items?.map((it) => (
                                    <span
                                      key={it.team_id}
                                      className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200"
                                    >
                                      {it.team_name} {it.assigned_role && `(${it.assigned_role})`}
                                    </span>
                                  ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Organization Collaborators</h3>
                    {isUserOrgManager && (
                      <button
                        onClick={() => setIsAddMemberOpen(true)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Member</span>
                      </button>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="divide-y divide-slate-100">
                      {currentOrgDetails.members?.map((member) => {
                        const isSelf = member.user_id === currentUser?.id;
                        const isMemberOwner = member.role === 'owner' || member.user_id === currentOrgDetails.created_by;
                        return (
                          <div key={member.user_id} className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200">
                                {(member.name || member.username || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900">
                                    {member.name || member.username}
                                  </span>
                                  {isSelf && (
                                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded">
                                      You
                                    </span>
                                  )}
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                      isMemberOwner
                                        ? 'bg-purple-100 text-purple-800'
                                        : member.role === 'manager'
                                        ? 'bg-indigo-100 text-indigo-800'
                                        : 'bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    {isMemberOwner ? (
                                      <Crown className="w-3 h-3 text-purple-600" />
                                    ) : member.role === 'manager' ? (
                                      <ShieldCheck className="w-3 h-3 text-indigo-600" />
                                    ) : (
                                      <Users className="w-3 h-3" />
                                    )}
                                    {isMemberOwner
                                      ? 'Organization Owner'
                                      : member.role === 'manager'
                                      ? 'Organization Manager'
                                      : 'Organization Member'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500">
                                  @{member.username} &bull; {member.email} &bull; Global role: <span className="capitalize font-medium">{member.user_type}</span>
                                </p>
                              </div>
                            </div>

                            {isUserOrgManager && !isSelf && !isMemberOwner && (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleToggleMemberRole(member)}
                                  className="text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                  title={member.role === 'manager' ? 'Demote to regular member' : 'Promote to manager (allows creating templates)'}
                                >
                                  {member.role === 'manager' ? 'Demote to Member' : 'Promote to Manager'}
                                </button>
                                <button
                                  onClick={() => handleRemoveMember(member)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                  title="Remove member from organization"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Select or Create an Organization</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Join an organization using a join token or create a new organization to collaborate on projects and document templates.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Organization */}
      {isCreateOrgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <form onSubmit={handleCreateOrgSubmit} className="space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Organization</h3>
                  <p className="text-xs text-slate-500">You will be designated as the Organization Owner.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newOrgDesc}
                  onChange={(e) => setNewOrgDesc(e.target.value)}
                  placeholder="Purpose and scope of this organization..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-900">
                <p className="font-semibold flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-purple-600" /> Organization Owner Privileges
                </p>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  As the creator and owner, you can manage projects, invite colleagues, and assign other members as Organization Managers or Members. Later on, teams can be established inside this organization.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOrgOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingOrg}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {creatingOrg ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Organization via Token */}
      {isJoinOrgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <form onSubmit={handleJoinOrgSubmit} className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Join Organization with Token</h3>
                  <p className="text-xs text-slate-500">Enter the join code shared by your organization manager</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Join Token / Code</label>
                <input
                  type="text"
                  required
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="e.g. ORG-CORE-2026"
                  className="w-full font-mono uppercase px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-wider"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinOrgOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joiningOrg}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl"
                >
                  {joiningOrg ? 'Joining...' : 'Join Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Project */}
      {isCreateProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
              <h3 className="text-base font-bold text-slate-900">Create New Project</h3>
              <p className="text-xs text-slate-500">
                Create a project folder within <strong>{currentOrgDetails?.name}</strong> to house collaborative documents.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Infrastructure v2.0"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Brief description of this project's scope..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Association Mode (Strictly Mutually Exclusive)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewProjectAssocType('team')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      newProjectAssocType === 'team'
                        ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-950">
                      <Users className="w-4 h-4 text-indigo-600" />
                      Team Assigned
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">
                      Staffed via organization squads or reusable team formations
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewProjectAssocType('individual')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      newProjectAssocType === 'individual'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-950">
                      <UserIcon className="w-4 h-4 text-emerald-600" />
                      Individual Assigned
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">
                      Staffed directly by individual organization members
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Creation Permission
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewProjectDocCreationPerm('all_members')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      newProjectDocCreationPerm === 'all_members'
                        ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-950">
                      <Users className="w-4 h-4 text-indigo-600" />
                      Each Member
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">
                      All organization members can author documents under this project
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewProjectDocCreationPerm('creator_only')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      newProjectDocCreationPerm === 'creator_only'
                        ? 'border-amber-600 bg-amber-50/50 ring-1 ring-amber-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950">
                      <Lock className="w-4 h-4 text-amber-600" />
                      Owner/Creator Only
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">
                      Only project creator and organization managers can create documents
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateProjectOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProject}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl"
                >
                  {creatingProject ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Member */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <form onSubmit={handleAddMemberSubmit} className="space-y-4">
              <h3 className="text-base font-bold text-slate-900">Add Organization Member</h3>
              <p className="text-xs text-slate-500">
                Search for an existing user by username, email, or name to add them to <strong>{currentOrgDetails?.name}</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Search User</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    placeholder="Type name, username or email..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {foundUsers.length > 0 && (
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {foundUsers.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => setSelectedUserToAdd(u)}
                      className={`p-2.5 text-xs flex items-center justify-between cursor-pointer ${
                        selectedUserToAdd?.id === u.id ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <span className="font-bold">{u.name || u.username}</span>
                        <span className="text-slate-500 ml-1.5">@{u.username}</span>
                      </div>
                      <span className="capitalize text-slate-400 text-[10px]">{u.user_type}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedUserToAdd && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs text-slate-500 block">Selected Member:</span>
                  <span className="text-sm font-bold text-slate-900">
                    {selectedUserToAdd.name || selectedUserToAdd.username} (@{selectedUserToAdd.username})
                  </span>

                  <div className="mt-2.5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Organization Role</label>
                    <select
                      value={memberRoleToAdd}
                      onChange={(e) => setMemberRoleToAdd(e.target.value as 'manager' | 'member')}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    >
                      <option value="member">Regular Member (Can co-author documents)</option>
                      <option value="manager">Organization Manager (Can create & edit templates)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedUserToAdd || addingMember}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                >
                  {addingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Team Assignment Modal */}
      {selectedProjectForAssignment && (
        <ProjectTeamAssignmentModal
          isOpen={Boolean(selectedProjectForAssignment)}
          project={selectedProjectForAssignment}
          currentUser={currentUser}
          onClose={() => setSelectedProjectForAssignment(null)}
          onProjectUpdated={async () => {
            if (activeOrganizationId) await loadOrgDetails(activeOrganizationId);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};

