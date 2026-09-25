import React, { useState, useEffect } from 'react';
import {
  Users,
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
  Sparkles,
  Info,
  FolderPlus,
  FileText,
  Search,
  Crown,
} from 'lucide-react';
import { api } from '../../api/client';
import { Project, Team, TeamMember, User } from '../../types';

interface TeamManagementProps {
  currentUser: User | null;
  teams: Team[];
  activeTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  onRefreshTeams: () => Promise<void>;
  onOpenAccountModal: () => void;
  onOpenNewDocModal: (projectId?: string) => void;
  onViewProjectDocs: (teamId: string, projectId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({
  currentUser,
  teams,
  activeTeamId,
  onSelectTeam,
  onRefreshTeams,
  onOpenAccountModal,
  onOpenNewDocModal,
  onViewProjectDocs,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'members'>('projects');
  const [currentTeamDetails, setCurrentTeamDetails] = useState<Team | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Modals state
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [isJoinTeamOpen, setIsJoinTeamOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joiningTeam, setJoiningTeam] = useState(false);

  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [foundUsers, setFoundUsers] = useState<User[]>([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<User | null>(null);
  const [memberRoleToAdd, setMemberRoleToAdd] = useState<'manager' | 'member'>('member');
  const [addingMember, setAddingMember] = useState(false);

  const [copiedToken, setCopiedToken] = useState(false);

  const loadTeamDetails = async (teamId: string) => {
    try {
      setLoadingTeam(true);
      const res = await api.getTeam(teamId);
      setCurrentTeamDetails(res.team);
    } catch (err: any) {
      showToast(err.message || 'Failed to load team details', 'error');
    } finally {
      setLoadingTeam(false);
    }
  };

  useEffect(() => {
    if (activeTeamId) {
      loadTeamDetails(activeTeamId);
    } else if (teams.length > 0) {
      onSelectTeam(teams[0].id);
    } else {
      setCurrentTeamDetails(null);
    }
  }, [activeTeamId, teams]);

  const handleCopyJoinToken = () => {
    if (currentTeamDetails?.join_code) {
      navigator.clipboard.writeText(currentTeamDetails.join_code);
      setCopiedToken(true);
      showToast('Join token copied to clipboard!');
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleRegenerateToken = async () => {
    if (!currentTeamDetails) return;
    if (!window.confirm('Regenerate join token? Existing links with the old token will become invalid.')) return;
    try {
      const res = await api.regenerateTeamJoinToken(currentTeamDetails.id);
      setCurrentTeamDetails((prev) => (prev ? { ...prev, join_code: res.join_code } : null));
      showToast('New join token generated!');
      await onRefreshTeams();
    } catch (err: any) {
      showToast(err.message || 'Failed to regenerate token', 'error');
    }
  };

  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      setCreatingTeam(true);
      const newTeam = await api.createTeam({ name: newTeamName, description: newTeamDesc });
      showToast(`Team "${newTeam.name}" created! You are now the Team Owner.`);
      setNewTeamName('');
      setNewTeamDesc('');
      setIsCreateTeamOpen(false);
      await onRefreshTeams();
      onSelectTeam(newTeam.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to create team', 'error');
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleJoinTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setJoiningTeam(true);
      const res = await api.joinTeam({ join_code: joinCodeInput });
      showToast(res.message);
      setJoinCodeInput('');
      setIsJoinTeamOpen(false);
      await onRefreshTeams();
      onSelectTeam(res.team.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to join team', 'error');
    } finally {
      setJoiningTeam(false);
    }
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTeamDetails) return;
    try {
      setCreatingProject(true);
      const newProj = await api.createProject({
        team_id: currentTeamDetails.id,
        name: newProjectName,
        description: newProjectDesc,
      });
      showToast(`Project "${newProj.name}" created!`);
      setNewProjectName('');
      setNewProjectDesc('');
      setIsCreateProjectOpen(false);
      await loadTeamDetails(currentTeamDetails.id);
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
        // filter out users already in team
        const existingMemberIds = new Set((currentTeamDetails?.members || []).map((m) => m.user_id));
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
    if (!currentTeamDetails || !selectedUserToAdd) return;
    try {
      setAddingMember(true);
      await api.addTeamMember(currentTeamDetails.id, {
        userId: selectedUserToAdd.id,
        role: memberRoleToAdd,
      });
      showToast(`Added ${selectedUserToAdd.name || selectedUserToAdd.username} to team!`);
      setSelectedUserToAdd(null);
      setMemberSearchQuery('');
      setFoundUsers([]);
      setIsAddMemberOpen(false);
      await loadTeamDetails(currentTeamDetails.id);
      await onRefreshTeams();
    } catch (err: any) {
      showToast(err.message || 'Failed to add member', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleToggleMemberRole = async (targetMember: TeamMember) => {
    if (!currentTeamDetails) return;
    const newRole = targetMember.role === 'manager' ? 'member' : 'manager';
    try {
      await api.updateMemberRole(currentTeamDetails.id, targetMember.user_id, newRole);
      showToast(`Updated ${targetMember.name || targetMember.username}'s role to ${newRole}`);
      await loadTeamDetails(currentTeamDetails.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to update member role', 'error');
    }
  };

  const handleRemoveMember = async (targetMember: TeamMember) => {
    if (!currentTeamDetails) return;
    if (!window.confirm(`Remove ${targetMember.name || targetMember.username} from this team?`)) return;
    try {
      await api.removeTeamMember(currentTeamDetails.id, targetMember.user_id);
      showToast('Member removed from team');
      await loadTeamDetails(currentTeamDetails.id);
      await onRefreshTeams();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove member', 'error');
    }
  };

  const isUserTeamOwner =
    currentTeamDetails?.user_role === 'owner' || currentTeamDetails?.created_by === currentUser?.id;
  const isUserTeamManager =
    isUserTeamOwner ||
    currentTeamDetails?.user_role === 'manager' ||
    currentUser?.user_type === 'organizer';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-600" />
            Teams & Workspace Collaboration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Collaborate in teams, organize shared documentation into projects, and manage template access. All users can create teams.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsJoinTeamOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-indigo-500" />
            <span>Join with Token</span>
          </button>

          <button
            onClick={() => setIsCreateTeamOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Team</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Teams List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Your Teams ({teams.length})</h2>
              <button
                onClick={onRefreshTeams}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
              >
                Refresh
              </button>
            </div>

            {teams.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No teams joined yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Create your own team or join an existing team using a join token.
                </p>
                <button
                  onClick={() => setIsCreateTeamOpen(true)}
                  className="mt-3 px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Create Team
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {teams.map((t) => {
                  const isSelected = t.id === activeTeamId;
                  const isOwner = t.user_role === 'owner' || t.created_by === currentUser?.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => onSelectTeam(t.id)}
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

        {/* Right Column: Selected Team Details */}
        <div className="lg:col-span-8">
          {loadingTeam ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Loading team workspace...</p>
            </div>
          ) : currentTeamDetails ? (
            <div className="space-y-6">
              {/* Team Header Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">{currentTeamDetails.name}</h2>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                          isUserTeamOwner
                            ? 'bg-purple-100 text-purple-800'
                            : currentTeamDetails.user_role === 'manager'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isUserTeamOwner && <Crown className="w-3.5 h-3.5 text-purple-600" />}
                        {isUserTeamOwner
                          ? 'You are Team Owner (Full control)'
                          : currentTeamDetails.user_role === 'manager'
                          ? 'You are Team Manager'
                          : 'You are Team Member'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {currentTeamDetails.description || 'No team description.'}
                    </p>
                  </div>

                  {/* Join Token Card */}
                  <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-3.5 rounded-xl flex flex-col gap-1.5 shadow-sm min-w-[220px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5" /> Join Token
                      </span>
                      {isUserTeamManager && (
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
                        {currentTeamDetails.join_code}
                      </span>
                      <button
                        onClick={handleCopyJoinToken}
                        className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                        title="Copy token to share"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">Share with colleagues to let them join this team</p>
                  </div>
                </div>

                {/* Sub-navigation tabs */}
                <div className="flex items-center space-x-4 border-b border-slate-200 mt-6">
                  <button
                    onClick={() => setActiveTab('projects')}
                    className={`pb-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                      activeTab === 'projects'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FolderKanban className="w-4 h-4" />
                    <span>Projects ({(currentTeamDetails.projects || []).length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('members')}
                    className={`pb-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                      activeTab === 'members'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Members ({(currentTeamDetails.members || []).length})</span>
                  </button>
                </div>
              </div>

              {/* Projects Tab */}
              {activeTab === 'projects' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Team Projects</h3>
                    <button
                      onClick={() => setIsCreateProjectOpen(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>New Project</span>
                    </button>
                  </div>

                  {(currentTeamDetails.projects || []).length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                      <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-700">No projects created in this team yet</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Create a project to organize and co-author documents with your team.
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
                      {currentTeamDetails.projects?.map((proj) => (
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
                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                              {proj.description || 'No description provided.'}
                            </p>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                            <button
                              onClick={() => onViewProjectDocs(currentTeamDetails.id, proj.id)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              View Documents &rarr;
                            </button>
                            <button
                              onClick={() => onOpenNewDocModal(proj.id)}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Add Doc
                            </button>
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
                    <h3 className="text-sm font-bold text-slate-800">Team Collaborators</h3>
                    {isUserTeamManager && (
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
                      {currentTeamDetails.members?.map((member) => {
                        const isSelf = member.user_id === currentUser?.id;
                        const isMemberOwner = member.role === 'owner' || member.user_id === currentTeamDetails.created_by;
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
                                      ? 'Team Owner'
                                      : member.role === 'manager'
                                      ? 'Team Manager'
                                      : 'Team Member'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500">
                                  @{member.username} &bull; {member.email} &bull; Global role: <span className="capitalize font-medium">{member.user_type}</span>
                                </p>
                              </div>
                            </div>

                            {isUserTeamManager && !isSelf && !isMemberOwner && (
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
                                  title="Remove member from team"
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
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Select or Create a Team</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Join a team using a join token or create a new team to collaborate on projects and document templates.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Team */}
      {isCreateTeamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <form onSubmit={handleCreateTeamSubmit} className="space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Team</h3>
                  <p className="text-xs text-slate-500">You will be designated as the Team Owner.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Mobile Engineering Team"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  placeholder="Purpose and scope of this team..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-900">
                <p className="font-semibold flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-purple-600" /> Team Owner Privileges
                </p>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  As the creator and owner, you can manage projects, invite colleagues, and assign other members as Team Managers or Members.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateTeamOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTeam}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {creatingTeam ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Team via Token */}
      {isJoinTeamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <form onSubmit={handleJoinTeamSubmit} className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Join Team with Token</h3>
                  <p className="text-xs text-slate-500">Enter the join code shared by your team manager</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Join Token / Code</label>
                <input
                  type="text"
                  required
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="e.g. TEAM-CORE-2026"
                  className="w-full font-mono uppercase px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-wider"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinTeamOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joiningTeam}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl"
                >
                  {joiningTeam ? 'Joining...' : 'Join Team'}
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
                Create a project folder within <strong>{currentTeamDetails?.name}</strong> to house collaborative documents.
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
              <h3 className="text-base font-bold text-slate-900">Add Team Member</h3>
              <p className="text-xs text-slate-500">
                Search for an existing user by username, email, or name to add them to <strong>{currentTeamDetails?.name}</strong>.
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Team Role</label>
                    <select
                      value={memberRoleToAdd}
                      onChange={(e) => setMemberRoleToAdd(e.target.value as 'manager' | 'member')}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    >
                      <option value="member">Regular Member (Can co-author documents)</option>
                      <option value="manager">Team Manager (Can create & edit templates)</option>
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
    </div>
  );
};
