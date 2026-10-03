import React, { useState, useEffect, useRef } from 'react';
import {
  FolderKanban,
  Building2,
  Plus,
  RefreshCw,
  Layers,
  Users,
  User as UserIcon,
  Crown,
  Shield,
  Trash2,
  Edit2,
  FileText,
  Copy,
  ChevronDown,
  Check,
  CheckCircle2,
  Lock,
  ArrowRight,
  Info,
} from 'lucide-react';
import { api } from '../../api/client';
import {
  Organization,
  Project,
  TeamAssignmentSet,
  User,
} from '../../types';
import { ProjectTeamAssignmentModal } from './ProjectTeamAssignmentModal';

export interface ProjectManagementProps {
  currentUser: User | null;
  organizations?: Organization[];
  teams?: Organization[]; // alias for backwards compatibility
  activeOrganizationId?: string | null;
  activeTeamId?: string | null; // alias
  onSelectOrganization?: (orgId: string) => void;
  onSelectTeam?: (teamId: string) => void; // alias
  onRefreshOrganizations?: () => Promise<void>;
  onRefreshTeams?: () => Promise<void>;
  onOpenAccountModal?: () => void;
  onOpenNewDocModal?: (projectId?: string) => void;
  onViewProjectDocs?: (orgId: string, projectId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ProjectManagement: React.FC<ProjectManagementProps> = ({
  currentUser,
  organizations: propOrganizations,
  teams: propTeams,
  activeOrganizationId: propActiveOrgId,
  activeTeamId: propActiveTeamId,
  onSelectOrganization,
  onSelectTeam,
  onRefreshOrganizations,
  onRefreshTeams,
  onOpenNewDocModal,
  onViewProjectDocs,
  showToast,
}) => {
  const organizations = propOrganizations || propTeams || [];
  const activeOrgId = propActiveOrgId || propActiveTeamId || (organizations[0]?.id ?? null);

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(activeOrgId);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [setsList, setSetsList] = useState<TeamAssignmentSet[]>([]);
  const [orgDetails, setOrgDetails] = useState<Organization | null>(null);

  // Search filter
  const [searchFilter, setSearchFilter] = useState('');

  // Org switcher dropdown state
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const orgDropdownRef = useRef<HTMLDivElement>(null);

  // Selected project for staffing modal
  const [selectedProjectForAssignment, setSelectedProjectForAssignment] = useState<Project | null>(null);

  // Create Project Modal state
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectPermission, setNewProjectPermission] = useState<'creator_only' | 'all_members'>('all_members');
  const [newProjectAssocType, setNewProjectAssocType] = useState<'team' | 'individual'>('team');
  const [selectedInitialSetId, setSelectedInitialSetId] = useState<string>('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Edit Project Modal state
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [targetProjectForEdit, setTargetProjectForEdit] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [editProjectPermission, setEditProjectPermission] = useState<'creator_only' | 'all_members'>('all_members');
  const [updatingProject, setUpdatingProject] = useState(false);

  // Close org dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync selectedOrgId when prop changes
  useEffect(() => {
    if (activeOrgId && activeOrgId !== selectedOrgId) {
      setSelectedOrgId(activeOrgId);
    }
  }, [activeOrgId]);

  const loadData = async (orgId: string) => {
    try {
      setLoading(true);
      const [projData, setsData, orgData] = await Promise.all([
        api.listProjects(orgId),
        api.listTeamAssignmentSets(orgId),
        api.getOrganization(orgId),
      ]);
      setProjects(projData);
      setSetsList(setsData);
      setOrgDetails(orgData.organization);
    } catch (err: any) {
      showToast(err.message || 'Failed to load organization projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOrgId) {
      loadData(selectedOrgId);
    }
  }, [selectedOrgId]);

  const handleOrgChange = (newOrgId: string) => {
    setSelectedOrgId(newOrgId);
    setIsOrgDropdownOpen(false);
    if (onSelectOrganization) onSelectOrganization(newOrgId);
    if (onSelectTeam) onSelectTeam(newOrgId);
  };

  const activeOrg = organizations.find((o) => o.id === selectedOrgId) || null;

  const isUserOrgCreator = Boolean(
    orgDetails?.is_creator ||
    (orgDetails?.created_by && currentUser?.id && orgDetails.created_by === currentUser.id) ||
    activeOrg?.is_creator ||
    (activeOrg?.created_by && currentUser?.id && activeOrg.created_by === currentUser.id)
  );

  const creatorDisplayName =
    orgDetails?.creator_name ||
    orgDetails?.creator_username ||
    activeOrg?.creator_name ||
    activeOrg?.creator_username ||
    'the Organization Creator';

  // Create Project Submit
  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !newProjectName.trim()) return;
    if (!isUserOrgCreator) {
      showToast('Only the Organization Creator can create projects in this organization.', 'error');
      return;
    }

    try {
      setCreatingProject(true);
      const createdProj = await api.createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim(),
        organization_id: selectedOrgId,
        document_creation_permission: newProjectPermission,
        association_type: newProjectAssocType,
      });
      if (newProjectAssocType === 'team' && selectedInitialSetId && createdProj?.id) {
        await api.associateProjectTeamAssignmentSet(createdProj.id, {
          team_assignment_set_id: selectedInitialSetId,
          apply_teams: true,
        });
      }
      showToast(`Project "${newProjectName.trim()}" created successfully!`);
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectPermission('all_members');
      setNewProjectAssocType('team');
      setSelectedInitialSetId('');
      setIsCreateProjectOpen(false);
      await loadData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to create project', 'error');
    } finally {
      setCreatingProject(false);
    }
  };

  // Edit Project Submit
  const handleEditProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !targetProjectForEdit || !editProjectName.trim()) return;
    if (!isUserOrgCreator) {
      showToast('Only the Organization Creator can edit projects in this organization.', 'error');
      return;
    }

    try {
      setUpdatingProject(true);
      await api.updateProject(targetProjectForEdit.id, {
        name: editProjectName.trim(),
        description: editProjectDesc.trim(),
        document_creation_permission: editProjectPermission,
      });
      showToast('Project updated successfully');
      setIsEditProjectOpen(false);
      setTargetProjectForEdit(null);
      await loadData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to update project', 'error');
    } finally {
      setUpdatingProject(false);
    }
  };

  // Delete Project
  const handleDeleteProject = async (projectId: string) => {
    if (!selectedOrgId) return;
    if (!isUserOrgCreator) {
      showToast('Only the Organization Creator can delete projects.', 'error');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this project? All associated documentation scopes will be removed.')) return;

    try {
      await api.deleteProject(projectId);
      showToast('Project deleted successfully');
      await loadData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete project', 'error');
    }
  };

  // Clone Set for Project
  const handleCloneSetForProject = async (projectId: string) => {
    if (!isUserOrgCreator) {
      showToast('Only the Organization Creator can clone formations for projects.', 'error');
      return;
    }
    try {
      setLoading(true);
      const updated = await api.cloneProjectTeamAssignmentSet(projectId);
      showToast(`Cloned dedicated staffing formation for project "${updated.name}"!`);
      if (selectedOrgId) await loadData(selectedOrgId);
    } catch (err: any) {
      showToast(err.message || 'Failed to clone formation for project', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.team_assignment_set_name && p.team_assignment_set_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Header & Organization Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Building2 className="w-4 h-4 text-indigo-500" />
            <span>Organization Workspace</span>
            <span>&bull;</span>
            <span className="font-semibold text-slate-800">
              {activeOrg?.name || 'Select Organization'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <FolderKanban className="w-7 h-7 text-indigo-600" />
            Projects & Team Assignments
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Manage projects, associate reusable <strong>Team Formations</strong> or assign individual members, and author scoped documentation.
          </p>
        </div>

        {/* Action Controls & Organization Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Interactive Organization Switcher */}
          <div className="relative" ref={orgDropdownRef}>
            <button
              type="button"
              onClick={() => setIsOrgDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 hover:border-indigo-400 rounded-xl text-xs font-semibold text-slate-800 shadow-xs transition-colors cursor-pointer"
              title="Switch Organization"
            >
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span className="font-bold truncate max-w-[150px]">
                {activeOrg?.name || 'Select Organization'}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                  isUserOrgCreator
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {isUserOrgCreator ? <Crown className="w-2.5 h-2.5 text-purple-600" /> : <Users className="w-2.5 h-2.5 text-slate-500" />}
                {isUserOrgCreator ? 'Creator' : 'Member'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOrgDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOrgDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2">
                <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Switch Organization ({organizations.length})
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {organizations.map((org) => {
                    const isSelected = org.id === selectedOrgId;
                    const isCreator = Boolean(
                      org.is_creator ||
                      (org.created_by && currentUser?.id && org.created_by === currentUser.id) ||
                      (org.user_role === 'owner')
                    );
                    return (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => handleOrgChange(org.id)}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/80 text-indigo-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                          <div className="truncate">
                            <div className="truncate font-medium">{org.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {isCreator ? 'You created this organization' : `Created by ${org.creator_name || org.creator_username || 'another user'}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 ${
                              isCreator
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isCreator ? <Crown className="w-2.5 h-2.5 text-purple-600" /> : <Users className="w-2.5 h-2.5 text-slate-500" />}
                            {isCreator ? 'Creator' : 'Member'}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => selectedOrgId && loadData(selectedOrgId)}
            disabled={loading}
            className="p-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
            title="Refresh Projects"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isUserOrgCreator && (
            <button
              onClick={() => setIsCreateProjectOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Role Banner */}
      {!isUserOrgCreator ? (
        <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <span className="font-semibold block text-sm">Organization Member (Read-only)</span>
            You are viewing this organization as a member. In <strong>{activeOrg?.name}</strong>, projects and team staffing are created and managed exclusively by the Organization Creator ({creatorDisplayName}). You have view-only access to staffing and can author documents based on project settings.
          </div>
        </div>
      ) : (
        <div className="mt-4 p-3 rounded-2xl bg-purple-50 border border-purple-200/80 flex items-center gap-2 text-xs text-purple-900">
          <Crown className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <span>
            <strong>Organization Creator:</strong> You have full control over project creation, team assignment mode (Team vs. Individual), and staffing within <strong>{activeOrg?.name}</strong>.
          </span>
        </div>
      )}

      {/* Projects Grid Section */}
      <div className="mt-6 space-y-6">
        {/* Search Bar & Stats */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search projects by name or formation..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-indigo-500" />
            <span>
              Projects in <strong>{activeOrg?.name}</strong>: <strong>{projects.length}</strong>
            </span>
          </div>
        </div>

        {/* Project Cards */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
            <FolderKanban className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-lg font-bold text-slate-800">
              {searchFilter ? 'No matching projects found' : 'No Projects in this Organization Yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {searchFilter
                ? 'Try searching with another keyword.'
                : isUserOrgCreator
                ? 'Create your first project to begin assigning team formations or individual members, and authoring documents.'
                : `The Organization Creator (${creatorDisplayName}) has not created any projects in this organization yet.`}
            </p>
            {!searchFilter && isUserOrgCreator && (
              <button
                onClick={() => setIsCreateProjectOpen(true)}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((proj) => {
              const assignedTeams = proj.assigned_teams || [];
              const individualMembers = proj.individual_members || [];

              return (
                <div
                  key={proj.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        Project
                      </span>
                      <div className="flex items-center gap-1.5">
                        {proj.association_type === 'individual' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 truncate max-w-[170px]">
                            <UserIcon className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">Individual Assigned</span>
                          </span>
                        ) : proj.team_assignment_set_name ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1 truncate max-w-[170px]">
                            <Layers className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">Formation: {proj.team_assignment_set_name}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            No Formation
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Project Title and Doc Creation Permission */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-lg line-clamp-1">{proj.name}</h3>
                      {isUserOrgCreator && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              setTargetProjectForEdit(proj);
                              setEditProjectName(proj.name);
                              setEditProjectDesc(proj.description || '');
                              setEditProjectPermission(proj.document_creation_permission || 'all_members');
                              setIsEditProjectOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                            title="Edit Project"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(proj.id)}
                            className="p-1 text-red-400 hover:text-red-600 rounded cursor-pointer"
                            title="Delete Project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Permission Tag & Doc count */}
                    <div className="flex items-center gap-2 mt-1">
                      {proj.document_creation_permission === 'creator_only' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                          <Lock className="w-2.5 h-2.5" />
                          Creator Only Docs
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded">
                          <Users className="w-2.5 h-2.5" />
                          All Members Can Author
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <FileText className="w-3 h-3 text-slate-400" />
                        {proj.documents_count || 0} docs
                      </span>
                    </div>

                    {proj.description && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                        {proj.description}
                      </p>
                    )}

                    {/* Staffing Overview: Individual vs Team Formation */}
                    {proj.association_type === 'individual' ? (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                            Assigned Members ({individualMembers.length})
                          </span>
                        </div>
                        {individualMembers.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No members assigned directly</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {individualMembers.map((im) => (
                              <span
                                key={im.user_id}
                                className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 border ${
                                  im.role === 'lead'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200 font-bold'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                              >
                                {im.user_name || im.user_id} ({im.role})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            Assigned Squads ({assignedTeams.length})
                          </span>
                        </div>
                        {assignedTeams.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No teams assigned</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {assignedTeams.map((at) => (
                              <span
                                key={at.team_id}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center gap-1"
                              >
                                {at.team_name || at.team_id}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedProjectForAssignment(proj)}
                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        {isUserOrgCreator ? 'Staffing & Teams' : 'View Staffing'}
                      </button>

                      {isUserOrgCreator && proj.team_assignment_set_id && (
                        <button
                          onClick={() => handleCloneSetForProject(proj.id)}
                          title="Clone formation to create a dedicated staffing formation for this project"
                          className="p-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {onViewProjectDocs && (
                        <button
                          onClick={() => onViewProjectDocs(proj.organization_id || selectedOrgId || '', proj.id)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Documents</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {onOpenNewDocModal && (
                        <button
                          onClick={() => onOpenNewDocModal(proj.id)}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Doc</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Create Project */}
      {isCreateProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create New Project</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a project in <strong>{activeOrg?.name}</strong> and choose its staffing model.
            </p>

            <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Core Banking Platform"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={2}
                  placeholder="Purpose and goals of this project"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Association Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Staffing Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewProjectAssocType('team')}
                    className={`p-2.5 text-left border rounded-xl transition-all cursor-pointer ${
                      newProjectAssocType === 'team'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Team Formation</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Staffed by functional squads
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewProjectAssocType('individual')}
                    className={`p-2.5 text-left border rounded-xl transition-all cursor-pointer ${
                      newProjectAssocType === 'individual'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Individual Members</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Staffed directly by members
                    </div>
                  </button>
                </div>
              </div>

              {/* Initial Formation Selector (if Team mode) */}
              {newProjectAssocType === 'team' && setsList.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Team Formation (Optional)
                  </label>
                  <select
                    value={selectedInitialSetId}
                    onChange={(e) => setSelectedInitialSetId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None (Assign later in Staffing Modal)</option>
                    {setsList.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.name} ({set.teams?.length || 0} teams)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Document Creation Permission */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Creation Permission
                </label>
                <select
                  value={newProjectPermission}
                  onChange={(e) => setNewProjectPermission(e.target.value as 'creator_only' | 'all_members')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all_members">All Organization Members Can Author Docs</option>
                  <option value="creator_only">Owner / Creator Only Can Author Docs</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateProjectOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProject || !newProjectName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {creatingProject ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Project */}
      {isEditProjectOpen && targetProjectForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Edit Project</h3>
            <p className="text-xs text-slate-500 mb-4">
              Update project details and authoring permissions.
            </p>

            <form onSubmit={handleEditProjectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editProjectDesc}
                  onChange={(e) => setEditProjectDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Creation Permission
                </label>
                <select
                  value={editProjectPermission}
                  onChange={(e) => setEditProjectPermission(e.target.value as 'creator_only' | 'all_members')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all_members">All Organization Members Can Author Docs</option>
                  <option value="creator_only">Owner / Creator Only Can Author Docs</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditProjectOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingProject || !editProjectName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {updatingProject ? 'Saving...' : 'Save Changes'}
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
          isOrgCreator={isUserOrgCreator}
          currentUser={currentUser}
          onClose={() => setSelectedProjectForAssignment(null)}
          onUpdated={async () => {
            if (selectedOrgId) await loadData(selectedOrgId);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};
