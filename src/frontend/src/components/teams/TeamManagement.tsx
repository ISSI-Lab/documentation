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
  const [activeTab, setActiveTab] = useState<'teams' | 'sets' | 'projects'>('teams');

  const [loading, setLoading] = useState(false);
  const [teamsList, setTeamsList] = useState<OrganizationTeam[]>([]);
  const [setsList, setSetsList] = useState<TeamAssignmentSet[]>([]);
  const [orgProjects, setOrgProjects] = useState<Project[]>([]);
  const [orgDetails, setOrgDetails] = useState<Organization | null>(null);

  // Modal: Create Team
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Modal: Add Member to Team
  const [isAddTeamMemberOpen, setIsAddTeamMemberOpen] = useState(false);
  const [targetTeamForMember, setTargetTeamForMember] = useState<OrganizationTeam | null>(null);
  const [selectedMemberUserId, setSelectedMemberUserId] = useState('');
  const [newTeamMemberRole, setNewTeamMemberRole] = useState<'lead' | 'member'>('member');
  const [addingTeamMember, setAddingTeamMember] = useState(false);

  // Modal: Create Team Assignment Set
  const [isCreateSetOpen, setIsCreateSetOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDesc, setNewSetDesc] = useState('');
  const [selectedTeamIdsForSet, setSelectedTeamIdsForSet] = useState<Record<string, boolean>>({});
  const [rolesByTeamIdForSet, setRolesByTeamIdForSet] = useState<Record<string, string>>({});
  const [creatingSet, setCreatingSet] = useState(false);

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
      const [teamsData, setsData, projData, orgData] = await Promise.all([
        api.listOrganizationTeams(orgId),
        api.listTeamAssignmentSets(orgId),
        api.listProjects(orgId),
        api.getOrganization(orgId),
      ]);
      setTeamsList(teamsData);
      setSetsList(setsData);
      setOrgProjects(projData);
      setOrgDetails(orgData.organization);
    } catch (err: any) {
      showToast(err.message || 'Failed to load organization teams', 'error');
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

  // Team actions
  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !newTeamName.trim()) return;
    try {
      setCreatingTeam(true);
      await api.createOrganizationTeam(selectedOrgId, {
        name: newTeamName.trim(),
        description: newTeamDesc.trim(),
      });
      showToast(`Team "${newTeamName.trim()}" created successfully!`);
      setNewTeamName('');
      setNewTeamDesc('');
      setIsCreateTeamOpen(false);
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to create team', 'error');
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!selectedOrgId) return;
    if (!window.confirm('Delete this team? It will be removed from all projects and assignment sets.')) return;
    try {
      await api.deleteOrganizationTeam(selectedOrgId, teamId);
      showToast('Team deleted successfully');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete team', 'error');
    }
  };

  const handleAddMemberToTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !targetTeamForMember || !selectedMemberUserId) return;
    try {
      setAddingTeamMember(true);
      await api.addOrganizationTeamMember(selectedOrgId, targetTeamForMember.id, {
        userId: selectedMemberUserId,
        role: newTeamMemberRole,
      });
      showToast('Member added to team!');
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

  const handleRemoveMemberFromTeam = async (teamId: string, userId: string) => {
    if (!selectedOrgId) return;
    if (!window.confirm('Remove this member from the team?')) return;
    try {
      await api.removeOrganizationTeamMember(selectedOrgId, teamId, userId);
      showToast('Member removed from team');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to remove member', 'error');
    }
  };

  // Set actions
  const handleCreateSetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !newSetName.trim()) return;
    const selectedTeamIds = Object.keys(selectedTeamIdsForSet).filter((id) => selectedTeamIdsForSet[id]);
    if (selectedTeamIds.length === 0) {
      showToast('Please select at least one team for this assignment set', 'error');
      return;
    }

    try {
      setCreatingSet(true);
      const items = selectedTeamIds.map((tid) => ({
        team_id: tid,
        assigned_role: rolesByTeamIdForSet[tid] || undefined,
      }));

      await api.createTeamAssignmentSet(selectedOrgId, {
        name: newSetName.trim(),
        description: newSetDesc.trim(),
        items,
      });
      showToast(`Team assignment set "${newSetName.trim()}" created!`);
      setNewSetName('');
      setNewSetDesc('');
      setSelectedTeamIdsForSet({});
      setRolesByTeamIdForSet({});
      setIsCreateSetOpen(false);
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to create team assignment set', 'error');
    } finally {
      setCreatingSet(false);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!selectedOrgId) return;
    if (!window.confirm('Delete this team assignment set? Projects associated with it will remain intact.')) return;
    try {
      await api.deleteTeamAssignmentSet(selectedOrgId, setId);
      showToast('Team assignment set deleted');
      await loadOrgData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete set', 'error');
    }
  };

  const activeOrg = organizations.find((o) => o.id === selectedOrgId) || null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-600" />
            Teams & Reusable Assignment Sets
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create teams in your organization, bundle them into reusable assignment sets, and assign them to projects.
          </p>
        </div>

        {/* Organization Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {organizations.length > 1 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-xs">
              <Building2 className="w-4 h-4 text-slate-500" />
              <select
                value={selectedOrgId || ''}
                onChange={(e) => handleOrgChange(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setIsCreateSetOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <BookmarkCheck className="w-4 h-4 text-indigo-600" />
            <span>New Assignment Set</span>
          </button>

          <button
            onClick={() => setIsCreateTeamOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Team</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('teams')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'teams'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Teams ({teamsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sets')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'sets'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookmarkCheck className="w-4 h-4" />
          <span>Reusable Assignment Sets ({setsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'projects'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>Project Assignments ({orgProjects.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading teams & assignments...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: Organization Teams */}
          {activeTab === 'teams' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Teams in {activeOrg?.name || 'Organization'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure specialized squads and squads can be assigned to multiple projects.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateTeamOpen(true)}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Team
                </button>
              </div>

              {teamsList.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No teams created in this organization yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Create your first team (e.g. Frontend Squad, Core API Team) to begin structuring project assignments.
                  </p>
                  <button
                    onClick={() => setIsCreateTeamOpen(true)}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Create Team
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {teamsList.map((tm) => (
                    <div
                      key={tm.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-bold text-slate-900">{tm.name}</h4>
                          <button
                            onClick={() => handleDeleteTeam(tm.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Delete Team"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{tm.description || 'No description provided.'}</p>

                        {/* Members section */}
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                              Roster ({tm.members?.length || 0})
                            </span>
                            <button
                              onClick={() => {
                                setTargetTeamForMember(tm);
                                setIsAddTeamMemberOpen(true);
                              }}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <UserPlus className="w-3 h-3" /> Add Member
                            </button>
                          </div>

                          <div className="space-y-1.5 max-h-36 overflow-y-auto">
                            {tm.members?.map((m) => (
                              <div
                                key={m.user_id}
                                className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg text-xs"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-800">{m.name || m.username}</span>
                                  {m.role === 'lead' && (
                                    <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                      <Crown className="w-2.5 h-2.5 text-purple-600" /> Lead
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRemoveMemberFromTeam(tm.id, m.user_id)}
                                  className="text-slate-400 hover:text-red-600 p-0.5"
                                  title="Remove from team"
                                >
                                  <UserMinus className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Created {new Date(tm.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Reusable Team Assignment Sets */}
          {activeTab === 'sets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Reusable Team Assignment Sets in {activeOrg?.name || 'Organization'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bundles of teams that any project can associate with to assign all team members instantly.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateSetOpen(true)}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> New Set
                </button>
              </div>

              {setsList.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                  <BookmarkCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No team assignment sets created yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Create reusable assignment sets to help project leads assign the right teams with a single click.
                  </p>
                  <button
                    onClick={() => setIsCreateSetOpen(true)}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Create Assignment Set
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {setsList.map((st) => (
                    <div
                      key={st.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                              <BookmarkCheck className="w-4 h-4" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">{st.name}</h4>
                          </div>
                          <button
                            onClick={() => handleDeleteSet(st.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Delete Set"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{st.description || 'No description provided.'}</p>

                        {/* Included Teams */}
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                            Included Teams ({st.items?.length || 0}):
                          </span>
                          <div className="space-y-1.5">
                            {st.items?.map((item) => (
                              <div
                                key={item.team_id}
                                className="p-2 bg-slate-50 rounded-lg text-xs flex items-center justify-between"
                              >
                                <span className="font-semibold text-slate-800">{item.team_name}</span>
                                {item.assigned_role && (
                                  <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-medium">
                                    {item.assigned_role}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                          Used in {st.associated_projects_count || 0} projects
                        </span>
                        <span className="text-slate-400">{new Date(st.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Project Team Assignments Overview */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Project Team Assignments Overview
                </h3>
                <p className="text-xs text-slate-500">
                  Different projects can have different team assignments and associate with different assignment sets.
                </p>
              </div>

              {orgProjects.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                  <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No projects in this organization</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {orgProjects.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold text-slate-900">{p.name}</h4>
                          {p.team_assignment_set_name ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                              Set: {p.team_assignment_set_name}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                              Custom Teams
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mb-3">{p.description || 'No description'}</p>

                        <div className="border-t border-slate-100 pt-3">
                          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                            Assigned Teams ({(p.assigned_teams || []).length}):
                          </span>
                          {(p.assigned_teams || []).length === 0 ? (
                            <span className="text-xs text-slate-400 italic">No teams assigned yet</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {p.assigned_teams?.map((at) => (
                                <span
                                  key={at.team_id}
                                  className="text-xs bg-slate-100 text-slate-800 font-medium px-2 py-1 rounded-lg border border-slate-200"
                                >
                                  {at.team_name}
                                  {at.assigned_role && (
                                    <span className="text-[10px] text-indigo-600 ml-1">({at.assigned_role})</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                        <button
                          onClick={() => setSelectedProjectForAssignment(p)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <FolderKanban className="w-3.5 h-3.5" />
                          <span>Manage Team Assignments</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Create Team */}
      {isCreateTeamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <form onSubmit={handleCreateTeamSubmit} className="space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Team</h3>
                  <p className="text-xs text-slate-500">
                    Add a collaborative team to <strong>{activeOrg?.name}</strong>.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Frontend Squad, DevOps Pod"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  placeholder="Responsibilities and purpose of this squad..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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

      {/* Modal: Add Member to Team */}
      {isAddTeamMemberOpen && targetTeamForMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <form onSubmit={handleAddMemberToTeam} className="space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Member to Team</h3>
                  <p className="text-xs text-slate-500">
                    Team: <strong>{targetTeamForMember.name}</strong>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Member from Organization</label>
                <select
                  required
                  value={selectedMemberUserId}
                  onChange={(e) => setSelectedMemberUserId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Member --</option>
                  {orgDetails?.members?.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name || m.username} (@{m.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role in Team</label>
                <select
                  value={newTeamMemberRole}
                  onChange={(e) => setNewTeamMemberRole(e.target.value as 'lead' | 'member')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="member">Team Member</option>
                  <option value="lead">Team Lead</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTeamMemberOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTeamMember || !selectedMemberUserId}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {addingTeamMember ? 'Adding...' : 'Add to Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Reusable Team Assignment Set */}
      {isCreateSetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <form onSubmit={handleCreateSetSubmit} className="space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <BookmarkCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Team Assignment Set</h3>
                  <p className="text-xs text-slate-500">
                    Bundle teams into a reusable set that projects can associate with.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assignment Set Name</label>
                <input
                  type="text"
                  required
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="e.g. Standard Web Delivery Pod"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newSetDesc}
                  onChange={(e) => setNewSetDesc(e.target.value)}
                  placeholder="Explain when this team assignment set should be used..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select Teams to Include in this Set:
                </label>
                {teamsList.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    No teams available yet. Create teams first before defining a reusable set.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 p-2 rounded-xl">
                    {teamsList.map((t) => {
                      const isChecked = Boolean(selectedTeamIdsForSet[t.id]);
                      return (
                        <div
                          key={t.id}
                          className="p-2 bg-slate-50 rounded-lg flex flex-col gap-1.5"
                        >
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedTeamIdsForSet((prev) => ({ ...prev, [t.id]: checked }));
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{t.name}</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              ({t.members?.length || 0} members)
                            </span>
                          </label>

                          {isChecked && (
                            <input
                              type="text"
                              value={rolesByTeamIdForSet[t.id] || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setRolesByTeamIdForSet((prev) => ({ ...prev, [t.id]: v }));
                              }}
                              placeholder="Role in set (e.g. Lead Dev, Testing, Architecture)..."
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateSetOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSet}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {creatingSet ? 'Creating...' : 'Create Assignment Set'}
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
            if (selectedOrgId) await loadOrgData(selectedOrgId);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default TeamManagement;
