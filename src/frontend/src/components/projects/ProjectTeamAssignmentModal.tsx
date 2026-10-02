import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
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
  FolderKanban,
} from 'lucide-react';
import { api } from '../../api/client';
import {
  Project,
  ProjectTeamAssignment,
  OrganizationTeam,
  TeamAssignmentSet,
  User,
} from '../../types';

interface ProjectTeamAssignmentModalProps {
  isOpen?: boolean;
  project: Project | null;
  currentUser?: User | null;
  onClose: () => void;
  onUpdated?: () => void;
  onProjectUpdated?: (updatedProject: Project) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ProjectTeamAssignmentModal: React.FC<ProjectTeamAssignmentModalProps> = ({
  isOpen = true,
  project,
  currentUser,
  onClose,
  onUpdated,
  onProjectUpdated,
  showToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [assignedTeams, setAssignedTeams] = useState<ProjectTeamAssignment[]>([]);
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [currentSetName, setCurrentSetName] = useState<string | null>(null);

  // Available options from organization
  const [orgTeams, setOrgTeams] = useState<OrganizationTeam[]>([]);
  const [orgSets, setOrgSets] = useState<TeamAssignmentSet[]>([]);

  // Assign Team form state
  const [selectedTeamIdToAssign, setSelectedTeamIdToAssign] = useState('');
  const [assignedRoleInput, setAssignedRoleInput] = useState('');
  const [assigningTeam, setAssigningTeam] = useState(false);

  // Associate Set form state
  const [selectedSetIdToAssociate, setSelectedSetIdToAssociate] = useState('');
  const [associatingSet, setAssociatingSet] = useState(false);

  // Save as Reusable Set form state
  const [isSaveSetOpen, setIsSaveSetOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDesc, setNewSetDesc] = useState('');
  const [savingSet, setSavingSet] = useState(false);

  const orgId = project?.organization_id || project?.team_id;

  const loadData = async () => {
    if (!project || !orgId) return;
    try {
      setLoading(true);
      const [teamsData, orgTeamsData, orgSetsData] = await Promise.all([
        api.getProjectTeams(project.id),
        api.listOrganizationTeams(orgId),
        api.listTeamAssignmentSets(orgId),
      ]);

      setAssignedTeams(teamsData.assigned_teams || []);
      setCurrentSetId(teamsData.team_assignment_set_id || null);
      setCurrentSetName(teamsData.team_assignment_set_name || null);
      setOrgTeams(orgTeamsData);
      setOrgSets(orgSetsData);
    } catch (err: any) {
      showToast(err.message || 'Failed to load project team assignments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && project) {
      loadData();
      setIsSaveSetOpen(false);
      setNewSetName(`${project.name} Team Set`);
      setNewSetDesc(`Reusable team assignments set derived from project "${project.name}"`);
    }
  }, [isOpen, project]);

  if (!isOpen || !project) return null;

  const unassignedTeams = orgTeams.filter(
    (t) => !assignedTeams.some((at) => at.team_id === t.id)
  );

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
          ? 'Project associated with team assignment set and teams updated!'
          : 'Project disassociated from team assignment set.'
      );
      await loadData();
      if (onProjectUpdated) onProjectUpdated(updated);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to associate team assignment set', 'error');
    } finally {
      setAssociatingSet(false);
    }
  };

  const handleCloneSetForProject = async () => {
    if (!project) return;
    try {
      setLoading(true);
      const updated = await api.cloneProjectTeamAssignmentSet(project.id);
      showToast(`Cloned dedicated staffing set for "${project.name}"!`);
      await loadData();
      if (onProjectUpdated) onProjectUpdated(updated);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to clone set for project', 'error');
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
      showToast(err.message || 'Failed to save reusable set', 'error');
    } finally {
      setSavingSet(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Project Team Assignments
              </h3>
              <p className="text-xs text-slate-500">
                Project: <strong className="text-slate-700">{project.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Associated Team Assignment Set */}
          <div className="bg-gradient-to-br from-indigo-50/80 to-blue-50/50 rounded-2xl border border-indigo-100 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BookmarkCheck className="w-4 h-4 text-indigo-600" />
                  Reusable Team Assignment Set Association
                </span>
                <p className="text-xs text-slate-600 mt-0.5">
                  Projects can associate with an organization team assignment set to quickly apply pre-defined teams.
                </p>
              </div>

              {currentSetId ? (
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
                  <span className="text-xs text-slate-500 block">Associated Assignment Set:</span>
                  <span className="text-sm font-bold text-indigo-950 flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {currentSetName || currentSetId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloneSetForProject}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                    title="Clone this set to customize teams specifically for this project"
                  >
                    <span>Clone for Project</span>
                  </button>
                  <span className="text-[11px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                    Linked Set
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSetIdToAssociate}
                    onChange={(e) => setSelectedSetIdToAssociate(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Reusable Set to Associate --</option>
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
                    No team assignment sets created in this organization yet. You can assign teams below and save them as a reusable set!
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Assigned Teams on this Project */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-600" />
                Assigned Teams on this Project ({assignedTeams.length})
              </h4>
              {assignedTeams.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsSaveSetOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isSaveSetOpen ? 'Hide Save Set Form' : 'Allow Set to be Reused'}</span>
                </button>
              )}
            </div>

            {/* Reusable Set Creation Box */}
            {isSaveSetOpen && (
              <form
                onSubmit={handleSaveAsSet}
                className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 animate-fadeIn"
              >
                <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                  <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                  Save Project Team Assignments as Reusable Organization Set
                </div>
                <p className="text-[11px] text-emerald-800">
                  Allow other projects in this organization to reuse these exact team assignments.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Set Name</label>
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
                    className="px-3 py-1 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSet || !newSetName.trim()}
                    className="px-3.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {savingSet ? 'Saving...' : 'Save Reusable Set'}
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
                  Select a team below to assign it, or associate with a reusable team assignment set above.
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
                              className={`px-1.5 py-0.2 rounded text-[10px] flex items-center gap-0.5 ${
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

                    <button
                      type="button"
                      onClick={() => handleRemoveTeam(at.team_id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors ml-3 cursor-pointer"
                      title="Unassign team from project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Add Individual Team to Project */}
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
                    placeholder="e.g. Lead Development, QA, Reviewers"
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
