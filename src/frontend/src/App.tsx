import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { PersonalHomepage } from './components/home/PersonalHomepage';
import { TemplateList } from './components/templates/TemplateList';
import { TemplateBuilder } from './components/templates/TemplateBuilder';
import { LatexTemplateBuilder } from './components/templates/LatexTemplateBuilder';
import { CopyTemplateModal } from './components/templates/CopyTemplateModal';
import { DocumentList } from './components/documents/DocumentList';
import { DocumentEditor } from './components/documents/DocumentEditor';
import { DocumentViewer } from './components/documents/DocumentViewer';
import { CreateDocumentModal } from './components/documents/CreateDocumentModal';
import { AuthModal } from './components/auth/AuthModal';
import { AccountModal } from './components/auth/AccountModal';
import { OrganizationManagement } from './components/organizations/OrganizationManagement';
import { CreateOrganizationPage } from './components/organizations/CreateOrganizationPage';
import { ProjectManagement } from './components/projects/ProjectManagement';
import { TeamManagement } from './components/teams/TeamManagement';
import { CreatorSubmissionsPage } from './components/submissions/CreatorSubmissionsPage';
import { AlertTriangle, Check } from 'lucide-react';
import { DeleteDocumentModal } from './components/documents/DeleteDocumentModal';
import { LatexDocumentEditor } from './components/documents/latex/LatexDocumentEditor';
import { CreateLatexDocumentModal } from './components/documents/latex/CreateLatexDocumentModal';
import { LatexVersionPage } from './components/documents/latex/LatexVersionPage';
import { api, getStoredToken } from './api/client';
import {
  Document,
  DocumentCreatePayload,
  LatexTemplate,
  LatexTemplateCreatePayload,
  Organization,
  Project,
  Team,
  Template,
  TemplateCreatePayload,
  User,
} from './types';

type ViewMode =
  | 'home'
  | 'documents'
  | 'submissions'
  | 'templates'
  | 'projects'
  | 'organizations'
  | 'create_organization'
  | 'teams'
  | 'create_template'
  | 'edit_template'
  | 'create_latex_template'
  | 'edit_latex_template'
  | 'edit_document'
  | 'view_document'
  | 'latex_versions';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('templates');
  const [submissionsInitialDocId, setSubmissionsInitialDocId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Backward-compatibility aliases
  const teams = organizations;
  const activeTeamId = activeOrganizationId;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [latexTemplates, setLatexTemplates] = useState<LatexTemplate[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeLatexTemplateId, setActiveLatexTemplateId] = useState<string | null>(null);
  const [templateFormatTab, setTemplateFormatTab] = useState<'markdown' | 'latex'>('markdown');
  const [docViewerInitialTab, setDocViewerInitialTab] = useState<'overview' | 'submissions' | 'my_submission'>('overview');
  const [latexEditorInitialVersionId, setLatexEditorInitialVersionId] = useState<string | null>(null);

  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalInitialTemplateId, setModalInitialTemplateId] = useState<string | null>(null);
  const [modalInitialProjectId, setModalInitialProjectId] = useState<string | null>(null);
  const [isCreateLatexModalOpen, setIsCreateLatexModalOpen] = useState(false);
  const [modalInitialLatexTemplateId, setModalInitialLatexTemplateId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Check auth session
  const checkSession = async () => {
    const token = getStoredToken();
    if (!token) {
      setCurrentView('templates');
      return;
    }
    try {
      const data = await api.getMe();
      setCurrentUser(data.user);
      const userOrgs = data.organizations || data.teams || [];
      setOrganizations(userOrgs);
      if (userOrgs.length > 0 && !activeOrganizationId) {
        const personalOrg = userOrgs.find((o: Organization) => o.name === `${data.user.username}_workspace`);
        setActiveOrganizationId(personalOrg ? personalOrg.id : userOrgs[0].id);
      }
      setCurrentView('home');
      await loadAllProjects();
    } catch {
      api.logout();
      setCurrentUser(null);
      setCurrentView('templates');
    }
  };

  const loadOrganizations = async () => {
    if (!currentUser) return;
    try {
      const list = await api.listOrganizations();
      setOrganizations(list);
      if (list.length > 0 && (!activeOrganizationId || !list.some((o) => o.id === activeOrganizationId))) {
        const personalOrg = list.find((o) => o.name === `${currentUser.username}_workspace`);
        setActiveOrganizationId(personalOrg ? personalOrg.id : list[0].id);
      }
      await loadAllProjects();
    } catch (err: any) {
      // ignore
    }
  };

  const loadTeams = loadOrganizations;

  const loadAllProjects = async () => {
    try {
      const list = await api.listProjects();
      setAllProjects(list);
    } catch {
      setAllProjects([]);
    }
  };

  const loadProjects = async (orgId: string | null) => {
    if (!orgId) {
      setProjects([]);
      setActiveProjectId(null);
      return;
    }
    try {
      const list = await api.listProjects(orgId);
      setProjects(list);
      if (activeProjectId && !list.some((p) => p.id === activeProjectId)) {
        setActiveProjectId(null);
      }
    } catch (err: any) {
      setProjects([]);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const list = await api.listTemplates();
      setTemplates(list);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch templates', 'error');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadLatexTemplates = async () => {
    try {
      const list = await api.listLatexTemplates();
      setLatexTemplates(list);
    } catch (err: any) {
      console.warn('Could not load LaTeX templates:', err.message);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoadingDocs(true);
      const list = await api.listDocuments();
      setDocuments(list);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch documents', 'error');
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (activeOrganizationId) {
      loadProjects(activeOrganizationId);
    } else {
      setProjects([]);
      setActiveProjectId(null);
    }
    if (currentUser) {
      loadAllProjects();
    }
    loadTemplates();
    loadLatexTemplates();
    loadDocuments();
  }, [activeOrganizationId, activeProjectId, currentUser]);

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    showToast(`Welcome back, ${user.name || user.username}!`);
    setCurrentView('home');
    await checkSession();
    await loadAllProjects();
    await loadTemplates();
    await loadLatexTemplates();
    await loadDocuments();
  };

  const handleLogout = async () => {
    api.logout();
    setCurrentUser(null);
    setOrganizations([]);
    setActiveOrganizationId(null);
    setProjects([]);
    setAllProjects([]);
    setActiveProjectId(null);
    setDocuments([]);
    setCurrentView('templates');
    await loadTemplates();
    await loadLatexTemplates();
    showToast('Signed out successfully');
  };

  const handleUserUpdated = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    showToast(`Account updated! Role is now ${updatedUser.user_type}.`);
  };

  // Template Handlers
  const handleSaveTemplate = async (payload: TemplateCreatePayload) => {
    if (activeTemplateId) {
      await api.updateTemplate(activeTemplateId, payload);
      showToast('Template updated successfully!');
    } else {
      await api.createTemplate(payload);
      showToast('New template created successfully!');
    }
    await loadTemplates();
    setTemplateFormatTab('markdown');
    setCurrentView('templates');
    setActiveTemplateId(null);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.deleteTemplate(id);
      showToast('Template deleted');
      await loadTemplates();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete template', 'error');
    }
  };

  const handleSaveLatexTemplate = async (payload: LatexTemplateCreatePayload) => {
    if (activeLatexTemplateId) {
      await api.updateLatexTemplate(activeLatexTemplateId, payload);
      showToast('LaTeX template updated successfully!');
    } else {
      await api.createLatexTemplate(payload);
      showToast('New LaTeX template created successfully!');
    }
    await loadLatexTemplates();
    setTemplateFormatTab('latex');
    setCurrentView('templates');
    setActiveLatexTemplateId(null);
  };

  const handleDeleteLatexTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this LaTeX template?')) return;
    try {
      await api.deleteLatexTemplate(id);
      showToast('LaTeX template deleted');
      await loadLatexTemplates();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete LaTeX template', 'error');
    }
  };

  const handleResetSeeds = async () => {
    if (!window.confirm('Reset templates to default ADR, PRD, Postmortem, and LaTeX templates?')) return;
    try {
      await api.resetSeedTemplates();
      showToast('Default templates restored');
      await loadTemplates();
      await loadLatexTemplates();
    } catch (err: any) {
      showToast(err.message || 'Failed to reset seeds', 'error');
    }
  };

  // Template Copy state and handler
  const [templatePendingCopy, setTemplatePendingCopy] = useState<Template | LatexTemplate | null>(null);

  const handleSuccessCopyTemplate = async (copiedTemplate: Template | LatexTemplate, targetOrg: Organization) => {
    showToast(`Template "${copiedTemplate.title}" copied to "${targetOrg.name}" successfully!`);
    await loadTemplates();
    await loadLatexTemplates();
    if ('template_files' in copiedTemplate) {
      setTemplateFormatTab('latex');
    }
    setActiveOrganizationId(targetOrg.id);
    setTemplatePendingCopy(null);
  };

  // Document Handlers
  const handleCreateDocument = async (payload: DocumentCreatePayload) => {
    const newDoc = await api.createDocument(payload);
    showToast(`Document "${newDoc.title}" created!`);
    await loadDocuments();
    setActiveDocId(newDoc.id);
    setCurrentView('edit_document');
  };

  const handleSaveDocument = async (docId: string, patch: Partial<Document>) => {
    const updated = await api.updateDocument(docId, patch);
    setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
    showToast('Document saved successfully');
  };

  // Document Deletion confirmation modal state
  const [documentPendingDelete, setDocumentPendingDelete] = useState<Document | null>(null);

  const handleRequestDeleteDocument = (doc: Document) => {
    const isDocCreator = Boolean(
      (doc.created_by && currentUser?.id && doc.created_by === currentUser.id) ||
      (!doc.created_by && currentUser?.id)
    );
    if (!isDocCreator) {
      showToast('Only the document creator can delete this document.', 'error');
      return;
    }

    // Condition (1): If this is a submittable doc (enable submission)
    if (doc.is_submittable) {
      const copiesCount =
        doc.copies_count !== undefined
          ? doc.copies_count
          : documents.filter((d) => d.copied_from_id === doc.id).length;

      // If copies created, cannot delete -> show snackbar message
      if (copiesCount > 0) {
        showToast('This document cannot be deleted because copies have already been created.', 'error');
        return;
      }
    }

    // Condition (1) with 0 copies OR Condition (2) non-submittable doc:
    // Show warning popup to ask creator to confirm deletion!
    setDocumentPendingDelete(doc);
  };

  const handleConfirmDeleteDocument = async (doc: Document) => {
    try {
      await api.deleteDocument(doc.id);
      showToast('Document deleted successfully');
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      setDocumentPendingDelete(null);
      if (activeDocId === doc.id) {
        setCurrentView('documents');
        setActiveDocId(null);
      }
      await loadAllProjects();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete document', 'error');
      setDocumentPendingDelete(null);
    }
  };

  const handleDeleteProject = async (projectId: string, projectCreatedBy?: string | null) => {
    const isProjCreator = Boolean(projectCreatedBy && currentUser?.id && projectCreatedBy === currentUser.id);
    const targetProj = allProjects.find((p) => p.id === projectId);
    const targetOrg = targetProj ? organizations.find((o) => o.id === (targetProj.organization_id || targetProj.team_id)) : null;
    const isOrgCreator = Boolean(
      targetOrg?.is_creator ||
      (targetOrg?.created_by && currentUser?.id && targetOrg.created_by === currentUser.id) ||
      targetOrg?.user_role === 'owner'
    );

    if (!isProjCreator && !isOrgCreator) {
      showToast('Only the Project Creator or Organization Creator can delete this project.', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this project? All associated documentation scopes will be removed.')) return;

    try {
      await api.deleteProject(projectId);
      showToast('Project deleted successfully');
      await loadAllProjects();
      await loadDocuments();
      if (activeProjectId === projectId) {
        setActiveProjectId(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete project', 'error');
    }
  };

  const handleDeleteOrganization = async (org: Organization) => {
    const isPersonalWs = (currentUser?.username && org.name === `${currentUser.username}_workspace`) || org.name.endsWith('_workspace');
    if (isPersonalWs) {
      showToast('The personal private workspace cannot be deleted.', 'error');
      return;
    }

    const isCreator = Boolean(
      org.is_creator ||
      (org.created_by && currentUser?.id && org.created_by === currentUser.id) ||
      org.user_role === 'owner'
    );
    if (!isCreator) {
      showToast('Only the organization creator can delete this organization.', 'error');
      return;
    }

    const orgProjects = allProjects.filter((p) => (p.organization_id || p.team_id) === org.id);
    const orgDocs = documents.filter((d) => d.organization_id === org.id || orgProjects.some((p) => p.id === d.project_id));
    const projectsCount = org.projects_count !== undefined ? org.projects_count : orgProjects.length;
    const documentsCount = org.documents_count !== undefined ? org.documents_count : orgDocs.length;

    if (projectsCount > 0 && documentsCount > 0) {
      showToast('Cannot delete organization: please remove all projects and documents first.', 'error');
      return;
    }
    if (projectsCount > 0) {
      showToast('Cannot delete organization: please remove all projects first.', 'error');
      return;
    }
    if (documentsCount > 0) {
      showToast('Cannot delete organization: please remove all documents first.', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete organization "${org.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteOrganization(org.id);
      showToast(`Organization "${org.name}" deleted successfully`);
      const updatedList = organizations.filter((o) => o.id !== org.id);
      setOrganizations(updatedList);
      if (activeOrganizationId === org.id) {
        const personalOrg = updatedList.find((o) => o.name === `${currentUser?.username}_workspace`);
        setActiveOrganizationId(personalOrg ? personalOrg.id : (updatedList[0]?.id || null));
        setActiveProjectId(null);
      }
      await loadOrganizations();
      await loadAllProjects();
      await loadDocuments();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete organization', 'error');
    }
  };

  const handleExportMarkdown = (docId: string) => {
    const url = api.getMarkdownExportUrl(docId);
    window.open(url, '_blank');
  };

  const handleOpenEditDocument = async (id: string) => {
    setLatexEditorInitialVersionId('working');
    const targetDoc = documents.find((d) => d.id === id);
    if (
      targetDoc &&
      targetDoc.is_submittable &&
      !targetDoc.copied_from_id &&
      targetDoc.created_by &&
      currentUser &&
      targetDoc.created_by !== currentUser.id
    ) {
      try {
        const copiedDoc = await api.copyDocument(id);
        await loadDocuments();
        setActiveDocId(copiedDoc.id);
        setCurrentView('edit_document');
        return;
      } catch (err: any) {
        showToast(err.message || 'Failed to open document instance', 'error');
        return;
      }
    }
    setActiveDocId(id);
    setCurrentView('edit_document');
  };

  const activeOrganization = organizations.find((o) => o.id === activeOrganizationId) || null;
  const activeDoc = documents.find((d) => d.id === activeDocId) || null;
  const activeTemplate =
    templates.find((t) => t.id === (activeDoc?.template_id || activeTemplateId)) || null;
  const activeLatexTemplate =
    latexTemplates.find((t) => t.id === activeLatexTemplateId) || null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Toast / Snackbar Banner */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="snackbar-message"
          className="fixed bottom-5 right-5 z-50 animate-bounce"
        >
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold text-white ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      {currentView !== 'edit_document' && currentView !== 'view_document' && currentView !== 'latex_versions' && (
        <Navigation
          currentView={currentView}
          currentUser={currentUser}
          organizations={organizations}
          activeOrganizationId={activeOrganizationId}
          onSelectOrganization={(orgId) => {
            setActiveOrganizationId(orgId);
            setActiveProjectId(null);
          }}
          onNavigate={(view) => setCurrentView(view as ViewMode)}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onOpenAccountModal={() => setIsAccountModalOpen(true)}
          onLogout={handleLogout}
        />
      )}

      {/* Main View Router */}
      <div className="flex-1 flex flex-col">
        {currentView === 'home' && currentUser && (
          <PersonalHomepage
            currentUser={currentUser}
            organizations={organizations}
            teams={teams}
            allProjects={allProjects}
            documents={documents}
            templates={templates}
            latexTemplates={latexTemplates}
            onNavigateToOrganizations={() => setCurrentView('organizations')}
            onNavigateToTeams={() => setCurrentView('teams')}
            onNavigateToProjects={() => setCurrentView('projects')}
            onNavigateToDocuments={(orgId, pId) => {
              if (orgId) setActiveOrganizationId(orgId);
              if (pId) setActiveProjectId(pId);
              setCurrentView('documents');
            }}
            onNavigateToTemplates={() => setCurrentView('templates')}
            onOpenCreateOrganization={() => setCurrentView('create_organization')}
            onOpenCreateTeam={() => setCurrentView('create_organization')}
            onOpenJoinOrganization={() => setCurrentView('organizations')}
            onOpenJoinTeam={() => setCurrentView('organizations')}
            onOpenCreateProject={(orgId) => {
              setActiveOrganizationId(orgId);
              setCurrentView('projects');
            }}
            onOpenNewDocModal={(orgId, pId, tplId) => {
              if (orgId) setActiveOrganizationId(orgId);
              setModalInitialProjectId(pId || activeProjectId);
              setModalInitialTemplateId(tplId || null);
              setIsCreateModalOpen(true);
            }}
            onOpenNewLatexDocModal={(tplId) => {
              setModalInitialLatexTemplateId(tplId || 'blank');
              setIsCreateLatexModalOpen(true);
            }}
            onViewDocument={(id) => {
              setActiveDocId(id);
              const target = documents.find((d) => d.id === id);
              if (target?.format === 'latex') {
                setLatexEditorInitialVersionId(target.current_version_id || '0');
              } else {
                setLatexEditorInitialVersionId(null);
              }
              setCurrentView('view_document');
            }}
            onEditDocument={handleOpenEditDocument}
            onSelectOrganization={(orgId) => {
              setActiveOrganizationId(orgId);
              setActiveProjectId(null);
            }}
            onSelectTeam={(orgId) => {
              setActiveOrganizationId(orgId);
              setActiveProjectId(null);
            }}
            onDeleteProject={handleDeleteProject}
            onDeleteOrganization={handleDeleteOrganization}
          />
        )}

        {currentView === 'documents' && (
          <DocumentList
            documents={documents}
            templates={templates}
            organizations={organizations}
            teams={teams}
            projects={allProjects}
            currentUser={currentUser}
            activeOrganizationId={activeOrganizationId}
            activeTeamId={activeOrganizationId}
            activeProjectId={activeProjectId}
            loading={loadingDocs}
            onOpenCreateModal={(pId) => {
              const targetPId = pId !== undefined ? pId : activeProjectId;
              if (targetPId) {
                const targetProj = allProjects.find((p) => p.id === targetPId);
                if (targetProj?.document_creation_permission === 'creator_only') {
                  const targetOrg = organizations.find((o) => o.id === (targetProj.organization_id || targetProj.team_id));
                  const isProjCreator = Boolean(targetProj.created_by && currentUser?.id && targetProj.created_by === currentUser.id);
                  const isOrgCreator = Boolean(targetOrg?.is_creator || (targetOrg?.created_by && currentUser?.id && targetOrg.created_by === currentUser.id) || targetOrg?.user_role === 'owner');
                  if (!isProjCreator && !isOrgCreator) {
                    showToast('Only the project creator can create documents in this project.', 'error');
                    return;
                  }
                }
              }
              setModalInitialTemplateId(null);
              setModalInitialProjectId(targetPId);
              setIsCreateModalOpen(true);
            }}
            onEditDocument={handleOpenEditDocument}
            onViewDocument={(id) => {
              setActiveDocId(id);
              const target = documents.find((d) => d.id === id);
              if (target?.format === 'latex') {
                setLatexEditorInitialVersionId(target.current_version_id || '0');
              } else {
                setLatexEditorInitialVersionId(null);
              }
              setDocViewerInitialTab('overview');
              setCurrentView('view_document');
            }}
            onViewDocumentWithTab={(id, tab) => {
              setActiveDocId(id);
              setDocViewerInitialTab(tab);
              setCurrentView('view_document');
            }}
            onOpenSubmissions={(docId) => {
              setSubmissionsInitialDocId(docId || null);
              setCurrentView('submissions');
            }}
            onDeleteDocument={handleRequestDeleteDocument}
            onUpdateDocument={handleSaveDocument}
            onExportMarkdown={handleExportMarkdown}
            onOpenCreateLatexModal={() => {
              setModalInitialLatexTemplateId('blank');
              setIsCreateLatexModalOpen(true);
            }}
            onOpenLatexVersions={(docId) => {
              setActiveDocId(docId);
              setCurrentView('latex_versions');
            }}
            onRefreshDocuments={loadDocuments}
            showToast={showToast}
          />
        )}

        {currentView === 'submissions' && currentUser && (
          <CreatorSubmissionsPage
            currentUser={currentUser}
            organizations={organizations}
            projects={allProjects}
            documents={documents}
            initialDocumentId={submissionsInitialDocId}
            onNavigateToDocuments={() => setCurrentView('documents')}
            onViewDocument={(id) => {
              setActiveDocId(id);
              setDocViewerInitialTab('submissions');
              setCurrentView('view_document');
            }}
            showToast={showToast}
          />
        )}

        {(currentView === 'templates' || (currentView === 'home' && !currentUser)) && (
          <TemplateList
            templates={templates}
            latexTemplates={latexTemplates}
            currentUser={currentUser}
            organizations={organizations}
            teams={teams}
            activeOrganization={activeOrganization}
            activeTeam={activeOrganization}
            loading={loadingTemplates}
            initialFormatTab={templateFormatTab}
            onCreateNewTemplate={() => {
              setActiveTemplateId(null);
              setCurrentView('create_template');
            }}
            onEditTemplate={(id) => {
              setActiveTemplateId(id);
              setCurrentView('edit_template');
            }}
            onDeleteTemplate={handleDeleteTemplate}
            onCopyTemplate={(tpl) => setTemplatePendingCopy(tpl)}
            onCreateNewLatexTemplate={() => {
              setActiveLatexTemplateId(null);
              setCurrentView('create_latex_template');
            }}
            onEditLatexTemplate={(id) => {
              setActiveLatexTemplateId(id);
              setCurrentView('edit_latex_template');
            }}
            onDeleteLatexTemplate={handleDeleteLatexTemplate}
            onCopyLatexTemplate={(latexTpl) => setTemplatePendingCopy(latexTpl)}
            onResetSeeds={handleResetSeeds}
            onOpenAccountModal={() => setIsAccountModalOpen(true)}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onSelectTemplateToCreate={(tpl) => {
              setModalInitialTemplateId(tpl.id);
              setModalInitialProjectId(activeProjectId);
              if (!currentUser) {
                setIsAuthModalOpen(true);
              } else {
                setIsCreateModalOpen(true);
              }
            }}
            onSelectLatexTemplateToCreate={(latexTpl) => {
              setModalInitialLatexTemplateId(latexTpl.id);
              if (!currentUser) {
                setIsAuthModalOpen(true);
              } else {
                setIsCreateLatexModalOpen(true);
              }
            }}
            onCreateBlankLatexDocument={() => {
              if (!currentUser) {
                setIsAuthModalOpen(true);
              } else {
                setModalInitialLatexTemplateId('blank');
                setIsCreateLatexModalOpen(true);
              }
            }}
          />
        )}

        {currentView === 'organizations' && (
          <OrganizationManagement
            currentUser={currentUser}
            organizations={organizations}
            teams={teams}
            activeOrganizationId={activeOrganizationId}
            activeTeamId={activeOrganizationId}
            onSelectOrganization={(orgId) => {
              setActiveOrganizationId(orgId);
              setActiveProjectId(null);
            }}
            onSelectTeam={(orgId) => {
              setActiveOrganizationId(orgId);
              setActiveProjectId(null);
            }}
            onNavigateToCreateOrg={() => setCurrentView('create_organization')}
            onNavigateToProjects={() => setCurrentView('projects')}
            onNavigateToTeams={() => setCurrentView('teams')}
            onRefreshOrganizations={loadOrganizations}
            onRefreshTeams={loadOrganizations}
            onOpenAccountModal={() => setIsAccountModalOpen(true)}
            onOpenNewDocModal={(projId) => {
              setModalInitialTemplateId(null);
              setModalInitialProjectId(projId || null);
              setIsCreateModalOpen(true);
            }}
            onViewProjectDocs={(orgId, projId) => {
              setActiveOrganizationId(orgId);
              setActiveProjectId(projId);
              setCurrentView('documents');
            }}
            onDeleteOrganization={handleDeleteOrganization}
            showToast={showToast}
          />
        )}

        {currentView === 'create_organization' && (
          <CreateOrganizationPage
            onSuccess={async (newOrg) => {
              await loadOrganizations();
              setActiveOrganizationId(newOrg.id);
              setActiveProjectId(null);
              setCurrentView('organizations');
            }}
            onCancel={() => setCurrentView('organizations')}
            showToast={showToast}
          />
        )}

        {currentView === 'projects' && (
          <ProjectManagement
            currentUser={currentUser}
            organizations={organizations}
            teams={teams}
            activeOrganizationId={activeOrganizationId}
            activeTeamId={activeOrganizationId}
            onSelectOrganization={(orgId) => {
              setActiveOrganizationId(orgId);
              setActiveProjectId(null);
            }}
            onSelectTeam={(orgId) => {
              setActiveOrganizationId(orgId);
              setActiveProjectId(null);
            }}
            onRefreshOrganizations={loadOrganizations}
            onRefreshTeams={loadOrganizations}
            onOpenAccountModal={() => setIsAccountModalOpen(true)}
            onOpenNewDocModal={(projId) => {
              setModalInitialTemplateId(null);
              setModalInitialProjectId(projId || null);
              setIsCreateModalOpen(true);
            }}
            onViewProjectDocs={(orgId, projId) => {
              setActiveOrganizationId(orgId);
              setActiveProjectId(projId);
              setCurrentView('documents');
            }}
            showToast={showToast}
          />
        )}

        {currentView === 'teams' && (
          <TeamManagement
            currentUser={currentUser}
            organizations={organizations}
            teams={teams}
            activeOrganizationId={activeOrganizationId}
            activeTeamId={activeOrganizationId}
            onSelectOrganization={(orgId) => {
              setActiveOrganizationId(orgId);
              setActiveProjectId(null);
            }}
            onSelectTeam={(orgId) => {
              setActiveOrganizationId(orgId);
              setActiveProjectId(null);
            }}
            onRefreshOrganizations={loadOrganizations}
            onRefreshTeams={loadOrganizations}
            onOpenAccountModal={() => setIsAccountModalOpen(true)}
            onOpenNewDocModal={(projId) => {
              setModalInitialTemplateId(null);
              setModalInitialProjectId(projId || null);
              setIsCreateModalOpen(true);
            }}
            onViewProjectDocs={(orgId, projId) => {
              setActiveOrganizationId(orgId);
              setActiveProjectId(projId);
              setCurrentView('documents');
            }}
            showToast={showToast}
          />
        )}

        {(currentView === 'create_template' || currentView === 'edit_template') && (
          <TemplateBuilder
            initialTemplate={currentView === 'edit_template' ? activeTemplate : null}
            activeOrganizationId={activeOrganizationId}
            activeTeamId={activeOrganizationId}
            organizations={organizations}
            teams={teams}
            onSave={handleSaveTemplate}
            onCopyTemplate={(tpl) => setTemplatePendingCopy(tpl)}
            onCancel={() => {
              setActiveTemplateId(null);
              setTemplateFormatTab('markdown');
              setCurrentView('templates');
            }}
          />
        )}

        {(currentView === 'create_latex_template' || currentView === 'edit_latex_template') && (
          <LatexTemplateBuilder
            initialTemplate={currentView === 'edit_latex_template' ? activeLatexTemplate : null}
            activeOrganizationId={activeOrganizationId}
            activeTeamId={activeOrganizationId}
            organizations={organizations}
            teams={teams}
            onSave={handleSaveLatexTemplate}
            onCopyTemplate={(latexTpl) => setTemplatePendingCopy(latexTpl)}
            onCancel={() => {
              setActiveLatexTemplateId(null);
              setTemplateFormatTab('latex');
              setCurrentView('templates');
            }}
          />
        )}

        {currentView === 'edit_document' && activeDoc && (
          activeDoc.format === 'latex' ? (
            <LatexDocumentEditor
              document={activeDoc}
              initialVersionId={latexEditorInitialVersionId || 'working'}
              currentUser={currentUser}
              onBack={() => {
                setLatexEditorInitialVersionId(null);
                setCurrentView('documents');
                loadDocuments();
              }}
              onOpenVersions={(docId) => {
                setActiveDocId(docId);
                setCurrentView('latex_versions');
              }}
              showToast={showToast}
            />
          ) : (
            <DocumentEditor
              document={activeDoc}
              template={activeTemplate}
              currentUser={currentUser}
              onSave={handleSaveDocument}
              onBack={() => {
                setCurrentView('documents');
                loadDocuments();
              }}
              onSwitchToView={() => {
                setDocViewerInitialTab('overview');
                setCurrentView('view_document');
              }}
              onOpenSubmissions={() => {
                const isMaster = !activeDoc.copied_from_id;
                const isCreator = isMaster && (!activeDoc.created_by || (currentUser && currentUser.id === activeDoc.created_by));
                setDocViewerInitialTab(isCreator ? 'submissions' : 'my_submission');
                setCurrentView('view_document');
              }}
              onExportMarkdown={handleExportMarkdown}
            />
          )
        )}

        {currentView === 'view_document' && activeDoc && (
          activeDoc.format === 'latex' ? (
            <LatexDocumentEditor
              document={activeDoc}
              initialVersionId={latexEditorInitialVersionId || activeDoc.current_version_id || '0'}
              currentUser={currentUser}
              onBack={() => {
                setLatexEditorInitialVersionId(null);
                setCurrentView('documents');
                loadDocuments();
              }}
              onOpenVersions={(docId) => {
                setActiveDocId(docId);
                setCurrentView('latex_versions');
              }}
              showToast={showToast}
            />
          ) : (
            <DocumentViewer
              document={activeDoc}
              template={activeTemplate}
              currentUser={currentUser}
              initialTab={docViewerInitialTab}
              onSwitchToEdit={() => handleOpenEditDocument(activeDoc.id)}
              onBack={() => {
                setCurrentView('documents');
                loadDocuments();
              }}
              onExportMarkdown={handleExportMarkdown}
              onDeleteDocument={handleRequestDeleteDocument}
              onRefreshDocument={loadDocuments}
            />
          )
        )}

        {currentView === 'latex_versions' && activeDoc && (
          <LatexVersionPage
            document={activeDoc}
            currentUser={currentUser}
            onBack={() => {
              setCurrentView('documents');
              loadDocuments();
            }}
            onOpenEditor={(docId, versionId) => {
              setActiveDocId(docId);
              setLatexEditorInitialVersionId(versionId || 'working');
              setCurrentView('edit_document');
            }}
            onRefreshDocuments={loadDocuments}
            showToast={showToast}
          />
        )}
      </div>

      {/* Modal: Confirm Delete Document (Warning Popup) */}
      <DeleteDocumentModal
        isOpen={Boolean(documentPendingDelete)}
        document={documentPendingDelete}
        onClose={() => setDocumentPendingDelete(null)}
        onConfirm={handleConfirmDeleteDocument}
      />

      {/* Modal: Copy Template to Creator Organization */}
      <CopyTemplateModal
        isOpen={Boolean(templatePendingCopy)}
        template={templatePendingCopy}
        currentUser={currentUser}
        organizations={organizations}
        teams={teams}
        onClose={() => setTemplatePendingCopy(null)}
        onSuccess={handleSuccessCopyTemplate}
        onCreateOrganizationClick={() => {
          setTemplatePendingCopy(null);
          setCurrentView('create_organization');
        }}
      />

      {/* Modal: Create Document */}
      <CreateDocumentModal
        isOpen={isCreateModalOpen}
        templates={templates}
        organizations={organizations}
        teams={teams}
        projects={allProjects}
        currentUser={currentUser}
        initialSelectedTemplateId={modalInitialTemplateId}
        initialSelectedProjectId={modalInitialProjectId}
        initialSelectedOrganizationId={activeOrganizationId}
        initialSelectedTeamId={activeOrganizationId}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateDocument}
      />

      {/* Modal: Create LaTeX Document */}
      <CreateLatexDocumentModal
        isOpen={isCreateLatexModalOpen}
        templates={latexTemplates}
        projects={allProjects}
        organizations={organizations}
        currentUser={currentUser}
        initialTemplateId={modalInitialLatexTemplateId}
        initialProjectId={activeProjectId}
        onClose={() => setIsCreateLatexModalOpen(false)}
        onCreated={(newDocId) => {
          loadDocuments();
          setActiveDocId(newDocId);
          setCurrentView('edit_document');
        }}
        showToast={showToast}
      />

      {/* Modal: Auth (Login/Register) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Modal: Account Settings & Role Switcher */}
      <AccountModal
        isOpen={isAccountModalOpen}
        currentUser={currentUser}
        onClose={() => setIsAccountModalOpen(false)}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
};
