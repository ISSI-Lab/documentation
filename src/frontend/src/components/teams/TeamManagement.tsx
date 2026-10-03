import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Plus,
  RefreshCw,
  FolderKanban,
  BookmarkCheck,
  Shield,
  Crown,
  Trash2,
  Edit2,
  UserPlus,
  UserMinus,
  Sparkles,
  Link as LinkIcon,
  Check,
  CheckCircle2,
  Search,
  Layers,
  Copy,
  FolderPlus,
  ArrowRight,
  Info,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../../api/client';
import {
  Organization,
  OrganizationTeam,
  OrganizationTeamMember,
  TeamAssignmentSet,
  Project,
  User,
} from '../../types';
import { ProjectTeamAssignmentModal } from '../projects/ProjectTeamAssignmentModal';

export interface TeamManagementProps {
  currentUser: User | null;
  organizations?: Organization[];
  teams?: Organization[]; // compatibility
  activeOrganizationId?: string | null;
  activeTeamId?: string | null; // compatibility
  onSelectOrganization?: (orgId: string) => void;
  onSelectTeam?: (teamId: string) => void;
  onRefreshOrganizations?: () => Promise<void>;
  onRefreshTeams?: () => Promise<void>;
  onOpenAccountModal?: () => void;
  onOpenNewDocModal?: (projectId?: string) => void;
  onViewProjectDocs?: (orgId: string, projectId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({
  currentUser,
  organizations: propOrganizations,
  teams: propTeams,
  activeOrganizationId: propActiveOrgId,
  activeTeamId: propActiveTeamId,
  onSelectOrganization,
  onSelectTeam,
  onRefreshOrganizations,
  onRefreshTeams,
  showToast,
}) => {
  const organizations = propOrganizations || propTeams || [];
  const activeOrgId = propActiveOrgId || propActiveTeamId || (organizations[0]?.id ?? null);

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(activeOrgId);
  const [activeTab, setActiveTab] = useState<'sets' | 'projects'>('sets');

  const [loading, setLoading] = useState(false);
  const [setsList, setSetsList] = useState<TeamAssignmentSet[]>([]);
  const [orgProjects, setOrgProjects] = useState<Project[]>([]);
  const [orgDetails, setOrgDetails] = useState<Organization | null>(null);

  // Search filter
  const [searchFilter, setSearchFilter] = useState('');

  // Modal: Create Team Assignment Set (First step)
  const [isCreateSetOpen, setIsCreateSetOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDesc, setNewSetDesc] = useState('');
  const [creatingSet, setCreatingSet] = useState(false);

  // Modal: Create Team WITHIN a Set (Second step)
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [targetSetForTeam, setTargetSetForTeam] = useState<TeamAssignmentSet | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Modal: Add Member to Team (Third step: Users within org)
  const [isAddTeamMemberOpen, setIsAddTeamMemberOpen] = useState(false);
  const [targetTeamForMember, setTargetTeamForMember] = useState<OrganizationTeam | null>(null);
  const [selectedMemberUserId, setSelectedMemberUserId] = useState('');
  const [newTeamMemberRole, setNewTeamMemberRole] = useState<'lead' | 'member'>('member');
  const [addingTeamMember, setAddingTeamMember] = useState(false);

  // Modal: Edit Team Assignment Set
  const [isEditSetOpen, setIsEditSetOpen] = useState(false);
  const [targetSetForEdit, setTargetSetForEdit] = useState<TeamAssignmentSet | null>(null);
  const [editSetName, setEditSetName] = useState('');
  const [editSetDesc, setEditSetDesc] = useState('');
  const [updatingSet, setUpdatingSet] = useState(false);

  // Modal: Edit Team
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [targetTeamForEdit, setTargetTeamForEdit] = useState<OrganizationTeam | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamDesc, setEditTeamDesc] = useState('');
  const [updatingTeam, setUpdatingTeam] = useState(false);

  // Modal: Project Team Assignments Modal
  const [selectedProjectForAssignment, setSelectedProjectForAssignment] = useState<Project | null>(null);

  useEffect(() => {
    if (activeOrgId && activeOrgId !== selectedOrgId) {
      setSelectedOrgId(activeOrgId);
    }
  }, [activeOrgId]);

  const loadOrgData = async (orgId: string) => {
    try {
      setLoading(true);
      const [setsData, projData, orgData] = await Promise.all([
        api.listTeamAssignmentSets(orgId),
        api.listProjects(orgId),
        api.getOrganization(orgId),
      ]);
      setSetsList(setsData);
      setOrgProjects(projData);
      setOrgDetails(orgData.organization);
    } catch (err: any) {
      showToast(err.message || 'Failed to load organization data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOrgId) {
      loadOrgData(selectedOrgId);
    }
  }, [selectedOrgId]);

  const handleOrgChange = (newId: string) => {
    setSelectedOrgId(newId);
    if (onSelectOrganization) onSelectOrganization(newId);
    if (onSelectTeam) onSelectTeam(newId);
  };

  // 1. Create Team Assignment Set (First Step in the Flow)
  const handleCreateSetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !newSetName.trim()) return;

    try {
      setCreatingSet(true);
      const created = await api.createTeamAssignmentSet(selectedOrgId, {
        name: newSetName.trim(),
        description: newSetDesc.trim(),
      });
      showToast(`Team Formation "${newSetName.trim()}" created! You can now add teams inside.`);
      setNewSetName('');
      setNewSetDesc('');
      setIsCreateSetOpen(false);
      await loadOrgData(selectedOrgId);
      // Immediately open Create Team modal for this new set so flow is frictionless
      setTargetSetForTeam(created);
      setIsCreateTeamOpen(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to create team formation', 'error');
    } finally {
      setCreatingSet(false);
    }
  };

  // Edit Set
  const handleEditSetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !targetSetForEdit || !editSetName.trim()) return;
    try {
      setUpdatingSet(true);
      await api.updateTeamAssignmentSet(selectedOrgId, targetSetForEdit.id, {
        name: editSetName.trim(),
        description: editSetDesc.trim(),
      });
      showToast('Team formation updated successfully');
      setIsEditSetOpen(false);
      setTargetSetForEdit(null);
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to update formation', 'error');
    } finally {
      setUpdatingSet(false);
    }
  };

  // Clone Set
  const handleCloneSet = async (setId: string) => {
    if (!selectedOrgId) return;
    try {
      setLoading(true);
      const cloned = await api.cloneTeamAssignmentSet(selectedOrgId, setId);
      showToast(`Team formation cloned as "${cloned.name}"!`);
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to clone formation', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete Set
  const handleDeleteSet = async (setId: string) => {
    if (!selectedOrgId) return;
    if (!window.confirm('Delete this team formation? Teams defined within this formation will also be deleted, and associated projects will be unlinked.')) return;
    try {
      await api.deleteTeamAssignmentSet(selectedOrgId, setId);
      showToast('Team formation deleted');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete formation', 'error');
    }
  };

  // 2. Create Team WITHIN a Set (Second Step in the Flow)
  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !targetSetForTeam || !newTeamName.trim()) return;
    try {
      setCreatingTeam(true);
      await api.createTeamInSet(selectedOrgId, targetSetForTeam.id, {
        name: newTeamName.trim(),
        description: newTeamDesc.trim(),
      });
      showToast(`Team "${newTeamName.trim()}" added to "${targetSetForTeam.name}"!`);
      setNewTeamName('');
      setNewTeamDesc('');
      setIsCreateTeamOpen(false);
      setTargetSetForTeam(null);
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to create team in formation', 'error');
    } finally {
      setCreatingTeam(false);
    }
  };

  // Edit Team
  const handleEditTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !targetTeamForEdit || !editTeamName.trim()) return;
    try {
      setUpdatingTeam(true);
      await api.updateOrganizationTeam(selectedOrgId, targetTeamForEdit.id, {
        name: editTeamName.trim(),
        description: editTeamDesc.trim(),
      });
      showToast('Team updated successfully');
      setIsEditTeamOpen(false);
      setTargetTeamForEdit(null);
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to update team', 'error');
    } finally {
      setUpdatingTeam(false);
    }
  };

  // Delete Team
  const handleDeleteTeam = async (teamId: string) => {
    if (!selectedOrgId) return;
    if (!window.confirm('Delete this team from the formation?')) return;
    try {
      await api.deleteOrganizationTeam(selectedOrgId, teamId);
      showToast('Team removed from formation');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete team', 'error');
    }
  };

  // 3. Add Member to Team (Third Step: Users in Organization)
  const handleAddMemberToTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !targetTeamForMember || !selectedMemberUserId) return;
    try {
      setAddingTeamMember(true);
      await api.addOrganizationTeamMember(selectedOrgId, targetTeamForMember.id, {
        userId: selectedMemberUserId,
        role: newTeamMemberRole,
      });
      showToast('User added to team!');
      setIsAddTeamMemberOpen(false);
      setTargetTeamForMember(null);
      setSelectedMemberUserId('');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to add member to team', 'error');
    } finally {
      setAddingTeamMember(false);
    }
  };

  // Update Member Role
  const handleToggleMemberRole = async (teamId: string, userId: string, currentRole: string) => {
    if (!selectedOrgId) return;
    const newRole = currentRole === 'lead' ? 'member' : 'lead';
    try {
      await api.updateOrganizationTeamMemberRole(selectedOrgId, teamId, userId, newRole);
      showToast(`Member role updated to ${newRole}`);
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to update member role', 'error');
    }
  };

  // Remove Member
  const handleRemoveMemberFromTeam = async (teamId: string, userId: string) => {
    if (!selectedOrgId) return;
    if (!window.confirm('Remove this user from the team?')) return;
    try {
      await api.removeOrganizationTeamMember(selectedOrgId, teamId, userId);
      showToast('User removed from team');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to remove member', 'error');
    }
  };

  // Clone Set for Project
  const handleCloneSetForProject = async (projectId: string) => {
    try {
      setLoading(true);
      const updated = await api.cloneProjectTeamAssignmentSet(projectId);
      showToast(`Cloned dedicated staffing formation for project "${updated.name}"!`);
      if (selectedOrgId) await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to clone formation for project', 'error');
    } finally {
      setLoading(false);
    }
  };

  const activeOrg = organizations.find((o) => o.id === selectedOrgId) || null;
  const orgMembers = orgDetails?.members || [];

  const filteredSets = setsList.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Building2 className="w-4 h-4 text-indigo-500" />
            <span>Organization Staffing</span>
            <span>&bull;</span>
            <span className="font-medium text-gray-900 dark:text-gray-200">
              {activeOrg?.name || 'Select Organization'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Team Formations & Project Staffing
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-3xl">
            Create a <strong>Team Formation</strong> first, add functional <strong>Teams</strong> within the formation, and staff them with users from the organization. Reusable formations can then be associated with any project.
          </p>
        </div>

        {/* Organization Switcher & Refresh */}
        <div className="flex items-center gap-3">
          {organizations.length > 1 && (
            <select
              value={selectedOrgId || ''}
              onChange={(e) => handleOrgChange(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => selectedOrgId && loadOrgData(selectedOrgId)}
            disabled={loading}
            className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateSetOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Team Formation
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mt-6 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('sets')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'sets'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Team Formations</span>
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold">
            {setsList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'projects'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>Project Assignments</span>
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold">
            {orgProjects.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Team Formations & Teams Within Them */}
      {activeTab === 'sets' && (
        <div className="mt-6 space-y-6">
          {/* Search bar & summary */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 dark:bg-gray-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search team formations..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Info className="w-4 h-4 text-indigo-500" />
              <span>
                Flow: <strong>Create Formation &rarr; Create Teams within Formation &rarr; Add Organization Members &rarr; Associate with Projects</strong>
              </span>
            </div>
          </div>

          {/* List of Sets */}
          {filteredSets.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-850 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8">
              <Layers className="w-12 h-12 mx-auto text-indigo-400 mb-3 opacity-80" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {searchFilter ? 'No matching team formations' : 'No Team Formations Created Yet'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                {searchFilter
                  ? 'Try searching with another keyword.'
                  : 'Start by creating your first Team Formation. Then, within the formation, you can define functional teams (Frontend, Backend, etc.) and assign organization members.'}
              </p>
              {!searchFilter && (
                <button
                  onClick={() => setIsCreateSetOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create First Team Formation
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredSets.map((set) => {
                const teams = set.teams || [];
                return (
                  <div
                    key={set.id}
                    className="bg-white dark:bg-gray-850 rounded-2xl border border-gray-200 dark:border-gray-750 shadow-sm overflow-hidden transition-all"
                  >
                    {/* Set Header */}
                    <div className="p-6 bg-gradient-to-r from-gray-50/80 via-white to-gray-50/40 dark:from-gray-800/60 dark:via-gray-850 dark:to-gray-800/30 border-b border-gray-200 dark:border-gray-750 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                            Team Formation
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {teams.length} {teams.length === 1 ? 'Team' : 'Teams'}
                          </span>
                          {set.associated_projects_count !== undefined && set.associated_projects_count > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Used by {set.associated_projects_count} {set.associated_projects_count === 1 ? 'project' : 'projects'}
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1.5">
                          {set.name}
                        </h2>
                        {set.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {set.description}
                          </p>
                        )}
                      </div>

                      {/* Set Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setTargetSetForTeam(set);
                            setIsCreateTeamOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
                          title="Create a new functional team inside this formation"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Team to this Formation
                        </button>

                        <button
                          onClick={() => handleCloneSet(set.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium transition-colors"
                          title="Duplicate this formation with all its teams and members"
                        >
                          <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                          Clone Formation
                        </button>

                        <button
                          onClick={() => {
                            setTargetSetForEdit(set);
                            setEditSetName(set.name);
                            setEditSetDesc(set.description || '');
                            setIsEditSetOpen(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                          title="Edit Formation Name/Description"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteSet(set.id)}
                          className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          title="Delete Formation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Teams inside the Set */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                          <Users className="w-4 h-4 text-indigo-500" />
                          Teams within this formation ({teams.length})
                        </h3>

                        {teams.length > 0 && (
                          <button
                            onClick={() => {
                              setTargetSetForTeam(set);
                              setIsCreateTeamOpen(true);
                            }}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                          >
                            <Plus className="w-3 h-3" />
                            Add Another Team
                          </button>
                        )}
                      </div>

                      {teams.length === 0 ? (
                        <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center bg-gray-50/50 dark:bg-gray-800/30">
                          <Users className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            No teams in this formation yet
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Click below to create the first team (e.g., Frontend Squad, Backend Squad) inside this formation.
                          </p>
                          <button
                            onClick={() => {
                              setTargetSetForTeam(set);
                              setIsCreateTeamOpen(true);
                            }}
                            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Create Team in Formation
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {teams.map((team) => (
                            <div
                              key={team.id}
                              className="border border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-800/40 rounded-xl p-4 flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white text-base">
                                      {team.name}
                                    </h4>
                                    {team.description && (
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                        {team.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setTargetTeamForEdit(team);
                                        setEditTeamName(team.name);
                                        setEditTeamDesc(team.description || '');
                                        setIsEditTeamOpen(true);
                                      }}
                                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                                      title="Edit team"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTeam(team.id)}
                                      className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded"
                                      title="Delete team"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Members in this Team */}
                                <div className="mt-3 pt-3 border-t border-gray-200/80 dark:border-gray-700/80">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                      Members ({team.members?.length || 0})
                                    </span>
                                    <button
                                      onClick={() => {
                                        setTargetTeamForMember(team);
                                        setIsAddTeamMemberOpen(true);
                                      }}
                                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                    >
                                      <UserPlus className="w-3 h-3" />
                                      Add Member
                                    </button>
                                  </div>

                                  {!team.members || team.members.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic py-1">
                                      No members assigned to this squad yet.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {team.members.map((m) => (
                                        <div
                                          key={m.user_id}
                                          className="flex items-center justify-between py-1 px-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 text-xs"
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                                              {(m.name || m.username || 'U')[0].toUpperCase()}
                                            </div>
                                            <span className="font-medium text-gray-900 dark:text-white truncate">
                                              {m.name || m.username}
                                            </span>
                                            <span className="text-gray-400 text-[11px] truncate">
                                              @{m.username}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <button
                                              onClick={() => handleToggleMemberRole(team.id, m.user_id, m.role)}
                                              title={`Click to switch to ${m.role === 'lead' ? 'Member' : 'Lead'}`}
                                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 ${
                                                m.role === 'lead'
                                                  ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200'
                                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                              }`}
                                            >
                                              {m.role === 'lead' && <Crown className="w-2.5 h-2.5" />}
                                              {m.role.toUpperCase()}
                                            </button>

                                            <button
                                              onClick={() => handleRemoveMemberFromTeam(team.id, m.user_id)}
                                              className="text-gray-400 hover:text-red-500 p-0.5"
                                              title="Remove member"
                                            >
                                              <UserMinus className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Project Assignments Overview */}
      {activeTab === 'projects' && (
        <div className="mt-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-indigo-500" />
              Different projects can associate with different Team Formations in this organization, or reuse the same formation.
            </span>
          </div>

          {orgProjects.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-850 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8">
              <FolderKanban className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                No Projects in this Organization
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Create a project to start assigning teams and team formations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orgProjects.map((proj) => {
                const assignedTeams = proj.assigned_teams || [];
                return (
                  <div
                    key={proj.id}
                    className="bg-white dark:bg-gray-850 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Project</span>
                        {proj.association_type === 'individual' ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 truncate max-w-[180px]">
                            <UserIcon className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">Individual Assigned</span>
                          </span>
                        ) : proj.team_assignment_set_name ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center gap-1 truncate max-w-[180px]">
                            <Layers className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">Formation: {proj.team_assignment_set_name}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                            No Formation Associated
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-gray-900 dark:text-white text-lg mt-2 truncate">
                        {proj.name}
                      </h3>
                      {proj.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {proj.description}
                        </p>
                      )}

                      {/* Staffing tags: Team vs Individual */}
                      {proj.association_type === 'individual' ? (
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                            <UserIcon className="w-3 h-3 text-emerald-500" />
                            Assigned Members ({(proj.individual_members || []).length})
                          </div>
                          {(proj.individual_members || []).length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No members assigned</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {proj.individual_members?.map((im) => (
                                <span
                                  key={im.user_id}
                                  className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                                    im.role === 'lead'
                                      ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <UserIcon className="w-3 h-3 text-emerald-500" />
                                  {im.user_name || im.user_id} ({im.role})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                            <Users className="w-3 h-3 text-indigo-500" />
                            Assigned Teams ({assignedTeams.length})
                          </div>
                          {assignedTeams.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No teams assigned</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {assignedTeams.map((at) => (
                                <span
                                  key={at.team_id}
                                  className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center gap-1"
                                >
                                  <Users className="w-3 h-3 text-indigo-500" />
                                  {at.team_name || at.team_id}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-5 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedProjectForAssignment(proj)}
                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Staffing & Teams
                      </button>

                      {proj.team_assignment_set_id && (
                        <button
                          onClick={() => handleCloneSetForProject(proj.id)}
                          title="Clone formation to create a dedicated staffing formation for this project"
                          className="p-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Create Team Formation (First Step) */}
      {isCreateSetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-850 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-750">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                1
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Create Team Formation
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              A Team Formation defines how individual teams are formed and staffed for your projects. Once created, you will add functional squads (e.g. Frontend, Backend) inside it.
            </p>

            <form onSubmit={handleCreateSetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Formation Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Full-Stack Web Delivery Pod"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the purpose or staffing pattern of this formation..."
                  value={newSetDesc}
                  onChange={(e) => setNewSetDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                />
              </div>

              <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-lg text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-600" />
                <span>
                  After creating this formation, you can immediately start creating teams and assigning team members within it!
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateSetOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSet || !newSetName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {creatingSet ? 'Creating...' : 'Create & Add Teams'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Team WITHIN a Set (Second Step) */}
      {isCreateTeamOpen && targetSetForTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-850 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-750">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                2
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Add Team to &quot;{targetSetForTeam.name}&quot;
                </h3>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Define a functional squad within this team formation. You can assign users from your organization to this team next.
            </p>

            <form onSubmit={handleCreateTeamSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Frontend Squad, Backend API Squad"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Responsibilities, scope, or focus of this team..."
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateTeamOpen(false);
                    setTargetSetForTeam(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTeam || !newTeamName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {creatingTeam ? 'Creating...' : 'Add Team to Formation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Member to Team (Third Step: Users in Organization) */}
      {isAddTeamMemberOpen && targetTeamForMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-850 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-750">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                3
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Add Member to {targetTeamForMember.name}
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Select an organization member to join this squad.
            </p>

            <form onSubmit={handleAddMemberToTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Organization User *
                </label>
                <select
                  required
                  value={selectedMemberUserId}
                  onChange={(e) => setSelectedMemberUserId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                >
                  <option value="">-- Choose User from Organization --</option>
                  {orgMembers
                    .filter((m) => !targetTeamForMember.members?.some((tm) => tm.user_id === m.user_id))
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name || m.username} (@{m.username})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Team Role
                </label>
                <select
                  value={newTeamMemberRole}
                  onChange={(e) => setNewTeamMemberRole(e.target.value as 'lead' | 'member')}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                >
                  <option value="member">Member</option>
                  <option value="lead">Lead</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddTeamMemberOpen(false);
                    setTargetTeamForMember(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTeamMember || !selectedMemberUserId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {addingTeamMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Formation */}
      {isEditSetOpen && targetSetForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-850 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-750">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              Edit Team Formation
            </h3>
            <form onSubmit={handleEditSetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Formation Name *
                </label>
                <input
                  type="text"
                  required
                  value={editSetName}
                  onChange={(e) => setEditSetName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editSetDesc}
                  onChange={(e) => setEditSetDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditSetOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingSet || !editSetName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {updatingSet ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Edit Team */}
      {isEditTeamOpen && targetTeamForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-gray-850 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-750">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              Edit Team
            </h3>
            <form onSubmit={handleEditTeamSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editTeamDesc}
                  onChange={(e) => setEditTeamDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditTeamOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingTeam || !editTeamName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {updatingTeam ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Team Assignment Modal */}
      {selectedProjectForAssignment && (
        <ProjectTeamAssignmentModal
          project={selectedProjectForAssignment}
          onClose={() => setSelectedProjectForAssignment(null)}
          onUpdated={async () => {
            if (selectedOrgId) await loadOrgData(selectedOrgId);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};
