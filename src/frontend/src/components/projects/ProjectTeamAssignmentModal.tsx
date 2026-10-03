import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  User,
  Shield,
  Plus,
  Trash2,
  BookmarkCheck,
  Sparkles,
  Link as LinkIcon,
  Unlink,
  Crown,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FolderKanban,
  UserPlus,
} from 'lucide-react';
import { api } from '../../api/client';
import {
  Project,
  ProjectTeamAssignment,
  ProjectIndividualMember,
  ProjectAssociationType,
  OrganizationTeam,
  TeamAssignmentSet,
  OrganizationMember,
  User as UserType,
} from '../../types';

interface ProjectTeamAssignmentModalProps {
  isOpen?: boolean;
  project: Project | null;
  currentUser?: UserType | null;
  isOrgCreator?: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  onProjectUpdated?: (updatedProject: Project) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ProjectTeamAssignmentModal: React.FC<ProjectTeamAssignmentModalProps> = ({
  isOpen = true,
  project,
  currentUser,
  isOrgCreator,
  onClose,
  onUpdated,
  onProjectUpdated,
  showToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [associationType, setAssociationType] = useState<ProjectAssociationType>('team');
  const [orgDetails, setOrgDetails] = useState<any>(null);

  // Team association data
  const [assignedTeams, setAssignedTeams] = useState<ProjectTeamAssignment[]>([]);
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [currentSetName, setCurrentSetName] = useState<string | null>(null);
  const [orgTeams, setOrgTeams] = useState<OrganizationTeam[]>([]);
  const [orgSets, setOrgSets] = useState<TeamAssignmentSet[]>([]);

  // Individual association data
  const [individualMembers, setIndividualMembers] = useState<ProjectIndividualMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([]);

  // Form states: Team
  const [selectedTeamIdToAssign, setSelectedTeamIdToAssign] = useState('');
  const [assignedRoleInput, setAssignedRoleInput] = useState('');
  const [assigningTeam, setAssigningTeam] = useState(false);
  const [selectedSetIdToAssociate, setSelectedSetIdToAssociate] = useState('');
  const [associatingSet, setAssociatingSet] = useState(false);

  // Form states: Reusable set
  const [isSaveSetOpen, setIsSaveSetOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDesc, setNewSetDesc] = useState('');
  const [savingSet, setSavingSet] = useState(false);

  // Form states: Individual member
  const [selectedUserIdToAssign, setSelectedUserIdToAssign] = useState('');
  const [selectedMemberRole, setSelectedMemberRole] = useState<'lead' | 'member'>('member');
  const [assigningMember, setAssigningMember] = useState(false);

  // Mode switch confirmation dialog state
  const [pendingModeSwitch, setPendingModeSwitch] = useState<ProjectAssociationType | null>(null);
  const [switchingMode, setSwitchingMode] = useState(false);

  const orgId = project?.organization_id || project?.team_id;

  const loadData = async () => {
    if (!project || !orgId) return;
    try {
      setLoading(true);
      const [teamsData, indivData, orgTeamsData, orgSetsData, orgRes] = await Promise.all([
        api.getProjectTeams(project.id),
        api.getProjectIndividualMembers(project.id),
        api.listOrganizationTeams(orgId),
        api.listTeamAssignmentSets(orgId),
        api.getOrganization(orgId),
      ]);

      const activeMode: ProjectAssociationType = indivData.association_type || teamsData.association_type || 'team';
      setAssociationType(activeMode);
      setAssignedTeams(teamsData.assigned_teams || []);
      setCurrentSetId(teamsData.team_assignment_set_id || null);
      setCurrentSetName(teamsData.team_assignment_set_name || null);
      setIndividualMembers(indivData.individual_members || []);
      setOrgTeams(orgTeamsData);
      setOrgSets(orgSetsData);
      const orgObj = orgRes.organization || orgRes.team || null;
      setOrgDetails(orgObj);
      setOrgMembers(orgObj?.members || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load project staffing data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isCreator =
    isOrgCreator !== undefined
      ? isOrgCreator
      : Boolean(
          orgDetails?.is_creator ??
            (orgDetails?.created_by === currentUser?.id)
        );

  useEffect(() => {
    if (isOpen && project) {
      setAssociationType(project.association_type || 'team');
      loadData();
      setIsSaveSetOpen(false);
      setPendingModeSwitch(null);
      setNewSetName(`${project.name} Team Formation`);
      setNewSetDesc(`Reusable team formation derived from project "${project.name}"`);
    }
  }, [isOpen, project]);

  if (!isOpen || !project) return null;

  // Unassigned organization teams
  const unassignedTeams = orgTeams.filter(
    (t) => !assignedTeams.some((at) => at.team_id === t.id)
  );

  // Unassigned organization members
  const unassignedOrgMembers = orgMembers.filter(
    (m) => !individualMembers.some((im) => im.user_id === m.user_id)
  );

  // ============================================================================
  // Mode Switching Logic (Strict Mutual Exclusion)
  // ============================================================================
  const initiateModeSwitch = (targetMode: ProjectAssociationType) => {
    if (!isCreator) return;
    if (targetMode === associationType) return;

    if (targetMode === 'individual' && (assignedTeams.length > 0 || currentSetId)) {
      setPendingModeSwitch('individual');
      return;
    }

    if (targetMode === 'team' && individualMembers.length > 0) {
      setPendingModeSwitch('team');
      return;
    }

    // No existing items to purge, perform switch immediately
    executeModeSwitch(targetMode);
  };

  const executeModeSwitch = async (targetMode: ProjectAssociationType) => {
    try {
      setSwitchingMode(true);
      const updated = await api.updateProjectAssignmentMode(project.id, {
        association_type: targetMode,
      });
      setAssociationType(targetMode);
      setPendingModeSwitch(null);
      showToast(
        targetMode === 'individual'
          ? 'Switched to Individual Association. Teams and formation cleared.'
          : 'Switched to Team Association. Individual members cleared.'
      );
      await loadData();
      if (onProjectUpdated) onProjectUpdated(updated);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to switch association mode', 'error');
    } finally {
      setSwitchingMode(false);
    }
  };

  // ============================================================================
  // Team Association Handlers
  // ============================================================================
  const handleAssignTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamIdToAssign) return;
    try {
      setAssigningTeam(true);
      const res = await api.assignProjectTeam(project.id, {
        team_id: selectedTeamIdToAssign,
        assigned_role: assignedRoleInput.trim() || undefined,
      });
      setAssignedTeams(res.assigned_teams);
      showToast('Team assigned to project successfully!');
      setSelectedTeamIdToAssign('');
      setAssignedRoleInput('');
      await loadData();
      if (onProjectUpdated) {
        const updated = await api.getProject(project.id);
        onProjectUpdated(updated);
      }
      if (onUpdated) onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to assign team', 'error');
    } finally {
      setAssigningTeam(false);
    }
  };

  const handleRemoveTeam = async (teamId: string) => {
    try {
      await api.removeProjectTeam(project.id, teamId);
      setAssignedTeams((prev) => prev.filter((t) => t.team_id !== teamId));
      showToast('Team unassigned from project');
      await loadData();
      if (onProjectUpdated) {
        const updated = await api.getProject(project.id);
        onProjectUpdated(updated);
      }
      if (onUpdated) onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to unassign team', 'error');
    }
  };

  const handleAssociateSet = async (setId: string | null) => {
    try {
      setAssociatingSet(true);
      const updated = await api.associateProjectTeamAssignmentSet(project.id, {
        team_assignment_set_id: setId,
        apply_teams: true,
      });
      showToast(
        setId
          ? 'Project associated with team formation and teams updated!'
          : 'Project disassociated from team formation.'
      );
      await loadData();
      if (onProjectUpdated) onProjectUpdated(updated);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to associate team formation', 'error');
    } finally {
      setAssociatingSet(false);
    }
  };

  const handleCloneSetForProject = async () => {
    if (!project) return;
    try {
      setLoading(true);
      const updated = await api.cloneProjectTeamAssignmentSet(project.id);
      showToast(`Cloned dedicated staffing formation for "${project.name}"!`);
      await loadData();
      if (onProjectUpdated) onProjectUpdated(updated);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to clone formation for project', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetName.trim()) return;
    try {
      setSavingSet(true);
      const res = await api.saveProjectAsTeamAssignmentSet(project.id, {
        name: newSetName.trim(),
        description: newSetDesc.trim(),
      });
      showToast(res.message);
      setIsSaveSetOpen(false);
      await loadData();
      if (onProjectUpdated) {
        const updated = await api.getProject(project.id);
        onProjectUpdated(updated);
      }
      if (onUpdated) onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to save reusable formation', 'error');
    } finally {
      setSavingSet(false);
    }
  };

  // ============================================================================
  // Individual Association Handlers
  // ============================================================================
  const handleAssignIndividualMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserIdToAssign) return;
    try {
      setAssigningMember(true);
      const res = await api.addProjectIndividualMember(project.id, {
        user_id: selectedUserIdToAssign,
        role: selectedMemberRole,
      });
      setIndividualMembers(res.individual_members);
      showToast('Member assigned to project successfully!');
      setSelectedUserIdToAssign('');
      setSelectedMemberRole('member');
      await loadData();
      if (onProjectUpdated) {
        const updated = await api.getProject(project.id);
        onProjectUpdated(updated);
      }
      if (onUpdated) onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to assign individual member', 'error');
    } finally {
      setAssigningMember(false);
    }
  };

  const handleToggleMemberRole = async (member: ProjectIndividualMember) => {
    const nextRole = member.role === 'lead' ? 'member' : 'lead';
    try {
      const res = await api.updateProjectIndividualMemberRole(project.id, member.user_id, nextRole);
      setIndividualMembers(res.individual_members);
      showToast(`Member role updated to ${nextRole}`);
      await loadData();
      if (onProjectUpdated) {
        const updated = await api.getProject(project.id);
        onProjectUpdated(updated);
      }
      if (onUpdated) onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to update member role', 'error');
    }
  };

  const handleRemoveIndividualMember = async (memberUserId: string) => {
    try {
      const res = await api.removeProjectIndividualMember(project.id, memberUserId);
      setIndividualMembers(res.individual_members);
      showToast('Member removed from project');
      await loadData();
      if (onProjectUpdated) {
        const updated = await api.getProject(project.id);
        onProjectUpdated(updated);
      }
      if (onUpdated) onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove member', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-fadeIn">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Project Association & Staffing
              </h3>
              <p className="text-xs text-slate-500">
                Project: <strong className="text-slate-700">{project.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {!isCreator && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                View-Only Mode: You are viewing staffing for this project. Only the Organization Creator can modify association modes, team assignments, or member roles.
              </span>
            </div>
          )}

          {/* Top Segmented Association Type Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Association Mode (Strictly Mutually Exclusive)
              </label>
              <span className="text-[11px] text-slate-500">
                {associationType === 'team' ? '👥 Team Assigned' : '👤 Individually Assigned'}
              </span>
            </div>

            <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                disabled={!isCreator}
                onClick={() => initiateModeSwitch('team')}
                title={isCreator ? undefined : 'Only the Organization Creator can change association mode'}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  !isCreator ? 'cursor-default' : 'cursor-pointer'
                } ${
                  associationType === 'team'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Team Association (Squads / Formation)</span>
              </button>

              <button
                type="button"
                disabled={!isCreator}
                onClick={() => initiateModeSwitch('individual')}
                title={isCreator ? undefined : 'Only the Organization Creator can change association mode'}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  !isCreator ? 'cursor-default' : 'cursor-pointer'
                } ${
                  associationType === 'individual'
                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Individual Association (Members)</span>
              </button>
            </div>
          </div>

          {/* Mode Switch Warning Banner */}
          {pendingModeSwitch && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Confirm Mode Switch to {pendingModeSwitch === 'individual' ? 'Individual' : 'Team'} Association</span>
              </div>
              <p className="text-xs text-amber-800">
                {pendingModeSwitch === 'individual'
                  ? `Switching to Individual Association will permanently remove all ${assignedTeams.length} assigned team(s) and unlink the team formation. No hybrid association is permitted.`
                  : `Switching to Team Association will permanently remove all ${individualMembers.length} individually assigned member(s). No hybrid association is permitted.`}
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingModeSwitch(null)}
                  className="px-3 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={switchingMode}
                  onClick={() => executeModeSwitch(pendingModeSwitch)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {switchingMode ? 'Switching...' : 'Yes, Switch Mode'}
                </button>
              </div>
            </div>
          )}

          {/* ================================================================== */}
          {/* TAB 1: TEAM ASSOCIATION MODE */}
          {/* ================================================================== */}
          {associationType === 'team' && (
            <div className="space-y-6">
              {/* Section 1: Associated Team Formation */}
              <div className="bg-gradient-to-br from-indigo-50/80 to-blue-50/50 rounded-2xl border border-indigo-100 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <BookmarkCheck className="w-4 h-4 text-indigo-600" />
                      Reusable Team Formation Association
                    </span>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Associate with an organization team formation to quickly apply pre-defined squads.
                    </p>
                  </div>

                  {currentSetId && isCreator ? (
                    <button
                      type="button"
                      onClick={() => handleAssociateSet(null)}
                      disabled={associatingSet}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Disassociate</span>
                    </button>
                  ) : null}
                </div>

                {currentSetId ? (
                  <div className="p-3 bg-white rounded-xl border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-slate-500 block">Associated Team Formation:</span>
                      <span className="text-sm font-bold text-indigo-950 flex items-center gap-1.5 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        {currentSetName || currentSetId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCreator && (
                        <button
                          type="button"
                          onClick={handleCloneSetForProject}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                          title="Clone this formation to customize teams specifically for this project"
                        >
                          <span>Clone Formation for Project</span>
                        </button>
                      )}
                      <span className="text-[11px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                        Linked Formation
                      </span>
                    </div>
                  </div>
                ) : isCreator ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedSetIdToAssociate}
                        onChange={(e) => setSelectedSetIdToAssociate(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Select Reusable Formation to Associate --</option>
                        {orgSets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.teams_count || 0} teams)
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selectedSetIdToAssociate || associatingSet}
                        onClick={() => handleAssociateSet(selectedSetIdToAssociate)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Associate & Apply</span>
                      </button>
                    </div>
                    {orgSets.length === 0 && (
                      <p className="text-[11px] text-slate-500 italic">
                        No team formations created in this organization yet. You can assign teams below and save them as a reusable formation!
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    No team formation linked to this project. Formations are managed by the Organization Creator.
                  </p>
                )}
              </div>

              {/* Section 2: Assigned Teams on this Project */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-600" />
                    Assigned Teams on this Project ({assignedTeams.length})
                  </h4>
                  {assignedTeams.length > 0 && isCreator && (
                    <button
                      type="button"
                      onClick={() => setIsSaveSetOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{isSaveSetOpen ? 'Hide Save Formation Form' : 'Allow Formation to be Reused'}</span>
                    </button>
                  )}
                </div>

                {/* Reusable Formation Creation Box */}
                {isSaveSetOpen && isCreator && (
                  <form
                    onSubmit={handleSaveAsSet}
                    className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 animate-fadeIn"
                  >
                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                      <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                      Save Project Team Assignments as Reusable Team Formation
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Allow other projects in this organization to reuse this exact team formation.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Formation Name</label>
                        <input
                          type="text"
                          required
                          value={newSetName}
                          onChange={(e) => setNewSetName(e.target.value)}
                          placeholder="e.g. Full-Stack Web Squad"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description (Optional)</label>
                        <input
                          type="text"
                          value={newSetDesc}
                          onChange={(e) => setNewSetDesc(e.target.value)}
                          placeholder="Description for other project leads..."
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsSaveSetOpen(false)}
                        className="px-3 py-1 text-xs text-slate-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingSet || !newSetName.trim()}
                        className="px-3.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {savingSet ? 'Saving...' : 'Save Reusable Formation'}
                      </button>
                    </div>
                  </form>
                )}

                {/* List of Assigned Teams */}
                {assignedTeams.length === 0 ? (
                  <div className="text-center py-6 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-slate-700">No teams assigned to this project yet</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isCreator
                        ? 'Select a team below to assign it, or associate with a reusable team formation above.'
                        : 'The organization creator has not assigned any teams to this project yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignedTeams.map((at) => (
                      <div
                        key={at.team_id}
                        className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{at.team_name}</span>
                            {at.assigned_role && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                                Role: {at.assigned_role}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{at.team_description || 'No description'}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-600">
                            <span className="font-semibold">{at.members_count || at.members?.length || 0} members:</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {at.members?.map((m) => (
                                <span
                                  key={m.user_id}
                                  className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5 ${
                                    m.role === 'lead'
                                      ? 'bg-purple-100 text-purple-800 font-semibold'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {m.role === 'lead' && <Crown className="w-2.5 h-2.5 text-purple-600" />}
                                  {m.name || m.username}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {isCreator && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTeam(at.team_id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors ml-3 cursor-pointer"
                            title="Unassign team from project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Add Individual Team to Project */}
              {isCreator && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-slate-600" />
                    Assign Additional Team to Project
                  </h4>
                  <form onSubmit={handleAssignTeam} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Select Organization Team
                        </label>
                        <select
                          value={selectedTeamIdToAssign}
                          onChange={(e) => setSelectedTeamIdToAssign(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Choose Team to Assign --</option>
                          {unassignedTeams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.members_count || 0} members)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Assigned Project Role (Optional)
                        </label>
                        <input
                          type="text"
                          value={assignedRoleInput}
                          onChange={(e) => setAssignedRoleInput(e.target.value)}
                          placeholder="e.g. Core Dev, QA, Reviewers"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={!selectedTeamIdToAssign || assigningTeam}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{assigningTeam ? 'Assigning...' : 'Assign Team'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ================================================================== */}
          {/* TAB 2: INDIVIDUAL ASSOCIATION MODE */}
          {/* ================================================================== */}
          {associationType === 'individual' && (
            <div className="space-y-6">
              {/* Notice Banner */}
              <div className="bg-emerald-50/80 rounded-2xl border border-emerald-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Individually Associated Project
                  </span>
                </div>
                <p className="text-xs text-emerald-800">
                  This project is staffed directly by individual organization members. Team formations and squad structures are excluded from this project.
                </p>
              </div>

              {/* Roster of Assigned Individual Members */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600" />
                    Assigned Project Members ({individualMembers.length})
                  </h4>
                </div>

                {individualMembers.length === 0 ? (
                  <div className="text-center py-6 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <User className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-slate-700">No members assigned directly yet</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Select an organization user below to add them to this project.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {individualMembers.map((im) => (
                      <div
                        key={im.user_id}
                        className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                            {(im.user_name || im.user_id).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">{im.user_name || im.user_id}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                  im.role === 'lead'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {im.role === 'lead' && <Crown className="w-3 h-3 text-purple-600" />}
                                {im.role === 'lead' ? 'Project Lead' : 'Contributor'}
                              </span>
                            </div>
                            {im.user_email && <p className="text-[11px] text-slate-500">{im.user_email}</p>}
                          </div>
                        </div>

                        {isCreator && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleMemberRole(im)}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                              title="Toggle between Project Lead and Contributor"
                            >
                              {im.role === 'lead' ? 'Set as Contributor' : 'Make Lead'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveIndividualMember(im.user_id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                              title="Remove member from project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign Individual Member Form */}
              {isCreator && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    Assign User to Project
                  </h4>

                  <form onSubmit={handleAssignIndividualMember} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Select Organization Member
                        </label>
                        <select
                          value={selectedUserIdToAssign}
                          onChange={(e) => setSelectedUserIdToAssign(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">-- Choose Member to Assign --</option>
                          {unassignedOrgMembers.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.name || m.username || m.user_id} ({m.email || m.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Role in Project
                        </label>
                        <select
                          value={selectedMemberRole}
                          onChange={(e) => setSelectedMemberRole(e.target.value as 'lead' | 'member')}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="member">Contributor (Standard)</option>
                          <option value="lead">Project Lead</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={!selectedUserIdToAssign || assigningMember}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{assigningMember ? 'Assigning...' : 'Assign Member'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
