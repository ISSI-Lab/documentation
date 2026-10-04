import React, { useState, useEffect } from 'react';
import {
  Building2,
  KeyRound,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Crown,
  Shield,
  ShieldCheck,
  Users,
  User as UserIcon,
  UserPlus,
  UserMinus,
  ArrowRight,
  FolderKanban,
  Layers,
  Search,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { api } from '../../api/client';
import { Organization, OrganizationMember, User } from '../../types';

export interface OrganizationManagementProps {
  currentUser: User | null;
  organizations?: Organization[];
  teams?: Organization[]; // compatibility alias
  activeOrganizationId?: string | null;
  activeTeamId?: string | null; // compatibility alias
  onSelectOrganization: (organizationId: string) => void;
  onSelectTeam?: (teamId: string) => void; // compatibility alias
  onNavigateToCreateOrg?: () => void;
  onNavigateToProjects?: () => void;
  onNavigateToTeams?: () => void;
  onRefreshOrganizations: () => Promise<void>;
  onRefreshTeams?: () => Promise<void>; // compatibility alias
  onOpenAccountModal?: () => void;
  onOpenNewDocModal?: (projectId?: string) => void; // compatibility
  onViewProjectDocs?: (organizationId: string, projectId: string) => void; // compatibility
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
  onNavigateToCreateOrg,
  onNavigateToProjects,
  onNavigateToTeams,
  onRefreshOrganizations,
  onRefreshTeams,
  showToast,
}) => {
  const organizations = propOrganizations || propTeams || [];
  const activeOrganizationId = propActiveOrgId || propActiveTeamId || null;

  const [selectedOrgForMembers, setSelectedOrgForMembers] = useState<Organization | null>(null);
  const [selectedOrgMembers, setSelectedOrgMembers] = useState<OrganizationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Search filter for organizations
  const [searchFilter, setSearchFilter] = useState('');

  // Join Organization with Token modal
  const [isJoinOrgOpen, setIsJoinOrgOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joiningOrg, setJoiningOrg] = useState(false);

  // Add Member Modal
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [foundUsers, setFoundUsers] = useState<User[]>([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<User | null>(null);
  const [memberRoleToAdd, setMemberRoleToAdd] = useState<'manager' | 'member'>('member');
  const [addingMember, setAddingMember] = useState(false);

  // Copied token state
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const handleSelectOrg = (id: string) => {
    onSelectOrganization(id);
    if (onSelectTeam) onSelectTeam(id);
  };

  const handleRefresh = async () => {
    if (onRefreshOrganizations) await onRefreshOrganizations();
    else if (onRefreshTeams) await onRefreshTeams();
  };

  const handleCopyJoinToken = (org: Organization) => {
    if (org.join_code) {
      navigator.clipboard.writeText(org.join_code);
      setCopiedTokenId(org.id);
      showToast(`Join token for "${org.name}" copied to clipboard!`, 'success');
      setTimeout(() => setCopiedTokenId(null), 2000);
    }
  };

  const handleRegenerateToken = async (org: Organization) => {
    if (!window.confirm(`Regenerate join token for "${org.name}"? Existing links with the old token will become invalid.`)) return;
    try {
      await api.regenerateOrganizationJoinToken(org.id);
      showToast(`New join token generated for "${org.name}"!`, 'success');
      await handleRefresh();
      if (selectedOrgForMembers && selectedOrgForMembers.id === org.id) {
        await loadOrgMembers(org.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to regenerate token', 'error');
    }
  };

  const handleJoinOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    try {
      setJoiningOrg(true);
      const res = await api.joinOrganization({ join_code: joinCodeInput.trim() });
      showToast(res.message, 'success');
      setJoinCodeInput('');
      setIsJoinOrgOpen(false);
      await handleRefresh();
      if (res.organization?.id) {
        handleSelectOrg(res.organization.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to join organization', 'error');
    } finally {
      setJoiningOrg(false);
    }
  };

  const loadOrgMembers = async (orgId: string) => {
    try {
      setLoadingMembers(true);
      const res = await api.getOrganization(orgId);
      setSelectedOrgForMembers(res.organization);
      setSelectedOrgMembers(res.organization.members || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load organization members', 'error');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleOpenMembersModal = async (org: Organization) => {
    await loadOrgMembers(org.id);
  };

  const handleSearchUsers = async (query: string) => {
    setMemberSearchQuery(query);
    if (query.trim().length >= 2) {
      try {
        const users = await api.searchUsers(query);
        const existingMemberIds = new Set(selectedOrgMembers.map((m) => m.user_id));
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
    if (!selectedOrgForMembers || !selectedUserToAdd) return;
    try {
      setAddingMember(true);
      await api.addOrganizationMember(selectedOrgForMembers.id, {
        userId: selectedUserToAdd.id,
        role: memberRoleToAdd,
      });
      showToast(`Added ${selectedUserToAdd.name || selectedUserToAdd.username} to ${selectedOrgForMembers.name}!`, 'success');
      setSelectedUserToAdd(null);
      setMemberSearchQuery('');
      setFoundUsers([]);
      setIsAddMemberOpen(false);
      await loadOrgMembers(selectedOrgForMembers.id);
      await handleRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to add member', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleToggleMemberRole = async (targetMember: OrganizationMember) => {
    if (!selectedOrgForMembers) return;
    const newRole = targetMember.role === 'manager' ? 'member' : 'manager';
    try {
      await api.updateOrganizationMemberRole(selectedOrgForMembers.id, targetMember.user_id, newRole);
      showToast(`Updated ${targetMember.name || targetMember.username}'s role to ${newRole}`, 'success');
      await loadOrgMembers(selectedOrgForMembers.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to update member role', 'error');
    }
  };

  const handleRemoveMember = async (targetMember: OrganizationMember) => {
    if (!selectedOrgForMembers) return;
    if (!window.confirm(`Remove ${targetMember.name || targetMember.username} from this organization?`)) return;
    try {
      await api.removeOrganizationMember(selectedOrgForMembers.id, targetMember.user_id);
      showToast('Member removed from organization', 'success');
      await loadOrgMembers(selectedOrgForMembers.id);
      await handleRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove member', 'error');
    }
  };

  const filteredOrgs = organizations.filter((org) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      (org.description && org.description.toLowerCase().includes(q)) ||
      (org.join_code && org.join_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-indigo-600" />
            <span>Organizations Workspace</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse and manage your organizations, share join tokens with team members, and configure workspace roles.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsJoinOrgOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
            <span>Join with Token</span>
          </button>

          {onNavigateToCreateOrg && (
            <button
              type="button"
              onClick={onNavigateToCreateOrg}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Organization</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search by organization name, description, or token..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition-all"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Total Organizations: <strong className="text-slate-800">{organizations.length}</strong></span>
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Organizations List */}
      {filteredOrgs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {searchFilter ? 'No matching organizations found' : 'No organizations joined yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchFilter
              ? 'Try modifying your search query to find your organization.'
              : 'Create your first organization to establish team formations and projects, or join an existing organization using a join token.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {onNavigateToCreateOrg && (
              <button
                type="button"
                onClick={onNavigateToCreateOrg}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Create New Organization
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsJoinOrgOpen(true)}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              Join with Token
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrgs.map((org) => {
            const isSelected = org.id === activeOrganizationId;
            const isPersonalWs = org.name === `${currentUser?.username}_workspace`;
            const isOwner = Boolean(
              org.is_creator ||
              (org.created_by && currentUser?.id && org.created_by === currentUser.id) ||
              org.user_role === 'owner'
            );
            const isManager = org.user_role === 'manager';

            return (
              <div
                key={org.id}
                className={`bg-white rounded-2xl border transition-all flex flex-col justify-between p-6 shadow-xs ${
                  isSelected
                    ? 'border-indigo-600 ring-2 ring-indigo-600/10 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div>
                  {/* Top card header */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-indigo-600 text-white' : isPersonalWs ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {isPersonalWs ? <Lock className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 line-clamp-1">{org.name}</h3>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{isPersonalWs ? 'Personal Workspace' : `${org.members_count || 1} members`}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        isPersonalWs
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : isOwner
                          ? 'bg-purple-100 text-purple-800'
                          : isManager
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isPersonalWs ? <Lock className="w-2.5 h-2.5 text-emerald-600" /> : isOwner ? <Crown className="w-2.5 h-2.5 text-purple-600" /> : isManager ? <Shield className="w-2.5 h-2.5 text-indigo-600" /> : <Users className="w-2.5 h-2.5 text-slate-500" />}
                      {isPersonalWs ? 'Personal' : isOwner ? 'Creator' : isManager ? 'Manager' : 'Member'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 min-h-[32px] mt-1 mb-4">
                    {org.description || 'No organization description provided.'}
                  </p>

                  {/* Join Token Box / Personal Workspace Banner */}
                  {isPersonalWs ? (
                    <div className="bg-slate-900 text-white rounded-xl p-3 mb-4 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-400" />
                          <span>Private Personal Org</span>
                        </span>
                        <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                          Confidential
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium mt-1">
                        Private workspace exclusively for your standalone personal documents and private projects.
                      </p>
                      <p className="text-[9px] text-slate-400 mt-1">
                        Closed to external members. No token sharing required.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-900 text-white rounded-xl p-3 mb-4 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">
                        <span className="flex items-center gap-1">
                          <KeyRound className="w-3 h-3" />
                          <span>Join Token</span>
                        </span>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleRegenerateToken(org)}
                            title="Regenerate join token"
                            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-300 tracking-wider">
                          {org.join_code || '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyJoinToken(org)}
                          className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Copy join token"
                        >
                          {copiedTokenId === org.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1">
                        Share with colleagues to invite them to this organization
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  {/* Select as active / current status */}
                  <div className="flex items-center justify-between">
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Active Organization</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectOrg(org.id)}
                        className="text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        Select Organization
                      </button>
                    )}

                    {isPersonalWs ? (
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Private</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenMembersModal(org)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Members ({org.members_count || 1})</span>
                      </button>
                    )}
                  </div>

                  {/* Quick links to Projects and Teams */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {onNavigateToProjects && (
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectOrg(org.id);
                          onNavigateToProjects();
                        }}
                        className="w-full flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-50 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                      >
                        <FolderKanban className="w-3 h-3 text-amber-600" />
                        <span>Projects</span>
                      </button>
                    )}

                    {onNavigateToTeams && (
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectOrg(org.id);
                          onNavigateToTeams();
                        }}
                        className="w-full flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-200 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                      >
                        <Layers className="w-3 h-3 text-indigo-600" />
                        <span>Formations</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Join Organization Modal */}
      {isJoinOrgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                <span>Join Organization</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsJoinOrgOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoinOrgSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Join Token
                </label>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="Enter 8-character token (e.g. 9b740523)"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Paste the join token provided by your Organization Creator.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsJoinOrgOpen(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joiningOrg || !joinCodeInput.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {joiningOrg ? 'Joining...' : 'Join Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Management Modal */}
      {selectedOrgForMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>Members &bull; {selectedOrgForMembers.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage roster and role permissions for this organization.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrgForMembers(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Member Action Bar */}
            <div className="flex items-center justify-between gap-3 flex-shrink-0">
              <span className="text-xs font-bold text-slate-700">
                {selectedOrgMembers.length} {selectedOrgMembers.length === 1 ? 'Member' : 'Members'}
              </span>

              {(selectedOrgForMembers.is_creator ||
                selectedOrgForMembers.created_by === currentUser?.id ||
                selectedOrgForMembers.user_role === 'owner' ||
                selectedOrgForMembers.user_role === 'manager') && (
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>
              )}
            </div>

            {/* Members Roster List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingMembers ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading members...</div>
              ) : selectedOrgMembers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">No members found.</div>
              ) : (
                selectedOrgMembers.map((member) => {
                  const isCurrentMemberOwner =
                    member.role === 'owner' || member.user_id === selectedOrgForMembers.created_by;
                  const canManage =
                    (selectedOrgForMembers.is_creator ||
                      selectedOrgForMembers.created_by === currentUser?.id ||
                      selectedOrgForMembers.user_role === 'owner' ||
                      selectedOrgForMembers.user_role === 'manager') &&
                    !isCurrentMemberOwner &&
                    member.user_id !== currentUser?.id;

                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white transition-all text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                          {(member.name || member.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{member.name || member.username || 'User'}</span>
                            {member.user_id === currentUser?.id && (
                              <span className="text-[10px] text-slate-400 font-normal">(You)</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{member.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCurrentMemberOwner
                              ? 'bg-purple-100 text-purple-800'
                              : member.role === 'manager'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isCurrentMemberOwner ? 'Owner' : member.role === 'manager' ? 'Manager' : 'Member'}
                        </span>

                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleMemberRole(member)}
                              className="px-2 py-1 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              title={`Change to ${member.role === 'manager' ? 'member' : 'manager'}`}
                            >
                              Toggle Role
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Remove member"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedOrgForMembers(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Search Modal */}
      {isAddMemberOpen && selectedOrgForMembers && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <span>Add Member to {selectedOrgForMembers.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddMemberOpen(false);
                  setSelectedUserToAdd(null);
                  setFoundUsers([]);
                  setMemberSearchQuery('');
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Search Registered User
                </label>
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  placeholder="Type username or email..."
                  autoFocus
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>

              {/* Found Users List */}
              {foundUsers.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {foundUsers.map((u) => {
                    const isSelected = selectedUserToAdd?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUserToAdd(u)}
                        className={`w-full flex items-center justify-between p-2.5 text-left text-xs transition-colors cursor-pointer ${
                          isSelected ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{u.name || u.username}</div>
                          <div className="text-[10px] text-slate-400">{u.email}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedUserToAdd && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Assign Role
                  </label>
                  <select
                    value={memberRoleToAdd}
                    onChange={(e) => setMemberRoleToAdd(e.target.value as 'manager' | 'member')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  >
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMemberOpen(false);
                    setSelectedUserToAdd(null);
                    setFoundUsers([]);
                    setMemberSearchQuery('');
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMember || !selectedUserToAdd}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {addingMember ? 'Adding...' : 'Add to Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
