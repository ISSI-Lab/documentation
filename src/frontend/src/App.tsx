import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { PersonalHomepage } from './components/home/PersonalHomepage';
import { TemplateList } from './components/templates/TemplateList';
import { TemplateBuilder } from './components/templates/TemplateBuilder';
import { DocumentList } from './components/documents/DocumentList';
import { DocumentEditor } from './components/documents/DocumentEditor';
import { DocumentViewer } from './components/documents/DocumentViewer';
import { CreateDocumentModal } from './components/documents/CreateDocumentModal';
import { AuthModal } from './components/auth/AuthModal';
import { AccountModal } from './components/auth/AccountModal';
import { TeamManagement } from './components/teams/TeamManagement';
import { api, getStoredToken } from './api/client';
import {
  Document,
  DocumentCreatePayload,
  Project,
  Team,
  Template,
  TemplateCreatePayload,
  User,
} from './types';

type ViewMode =
  | 'home'
  | 'documents'
  | 'templates'
  | 'teams'
  | 'create_template'
  | 'edit_template'
  | 'edit_document'
  | 'view_document';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('templates');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalInitialTemplateId, setModalInitialTemplateId] = useState<string | null>(null);
  const [modalInitialProjectId, setModalInitialProjectId] = useState<string | null>(null);

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
      setTeams(data.teams || []);
      if (data.teams && data.teams.length > 0 && !activeTeamId) {
        setActiveTeamId(data.teams[0].id);
      }
      setCurrentView('home');
      await loadAllProjects();
    } catch {
      api.logout();
      setCurrentUser(null);
      setCurrentView('templates');
    }
  };

  const loadTeams = async () => {
    if (!currentUser) return;
    try {
      const list = await api.listTeams();
      setTeams(list);
      if (list.length > 0 && (!activeTeamId || !list.some((t) => t.id === activeTeamId))) {
        setActiveTeamId(list[0].id);
      }
      await loadAllProjects();
    } catch (err: any) {
      // ignore
    }
  };

  const loadAllProjects = async () => {
    try {
      const list = await api.listProjects();
      setAllProjects(list);
    } catch {
      setAllProjects([]);
    }
  };

  const loadProjects = async (teamId: string | null) => {
    if (!teamId) {
      setProjects([]);
      setActiveProjectId(null);
      return;
    }
    try {
      const list = await api.listProjects(teamId);
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
      const list = await api.listTemplates({ team_id: activeTeamId || undefined });
      setTemplates(list);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch templates', 'error');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoadingDocs(true);
      const list = await api.listDocuments({
        team_id: activeTeamId || undefined,
        project_id: activeProjectId || undefined,
      });
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
    if (activeTeamId) {
      loadProjects(activeTeamId);
    } else {
      setProjects([]);
      setActiveProjectId(null);
    }
    if (currentUser) {
      loadAllProjects();
    }
    loadTemplates();
    loadDocuments();
  }, [activeTeamId, activeProjectId, currentUser]);

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    showToast(`Welcome back, ${user.name || user.username}!`);
    setCurrentView('home');
    await checkSession();
    await loadAllProjects();
    await loadTemplates();
    await loadDocuments();
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setTeams([]);
    setActiveTeamId(null);
    setProjects([]);
    setAllProjects([]);
    setActiveProjectId(null);
    setCurrentView('templates');
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

  const handleResetSeeds = async () => {
    if (!window.confirm('Reset templates to default ADR, PRD, and Postmortem templates?')) return;
    try {
      await api.resetSeedTemplates();
      showToast('Default templates restored');
      await loadTemplates();
    } catch (err: any) {
      showToast(err.message || 'Failed to reset seeds', 'error');
    }
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

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.deleteDocument(docId);
      showToast('Document deleted');
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (activeDocId === docId) {
        setCurrentView('documents');
        setActiveDocId(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete document', 'error');
    }
  };

  const handleExportMarkdown = (docId: string) => {
    const url = api.getMarkdownExportUrl(docId);
    window.open(url, '_blank');
  };

  const activeTeam = teams.find((t) => t.id === activeTeamId) || null;
  const activeDoc = documents.find((d) => d.id === activeDocId) || null;
  const activeTemplate =
    templates.find((t) => t.id === (activeDoc?.template_id || activeTemplateId)) || null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Toast Banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold text-white ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Top Navigation */}
      {currentView !== 'edit_document' && currentView !== 'view_document' && (
        <Navigation
          currentView={currentView}
          currentUser={currentUser}
          teams={teams}
          activeTeamId={activeTeamId}
          projects={projects}
          activeProjectId={activeProjectId}
          onNavigate={(view) => setCurrentView(view as ViewMode)}
          onSelectTeam={(teamId) => {
            setActiveTeamId(teamId);
            setActiveProjectId(null);
          }}
          onSelectProject={(projId) => setActiveProjectId(projId)}
          onOpenNewDocModal={() => {
            setModalInitialTemplateId(null);
            setModalInitialProjectId(activeProjectId);
            setIsCreateModalOpen(true);
          }}
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
            teams={teams}
            allProjects={allProjects}
            documents={documents}
            templates={templates}
            onNavigateToTeams={() => setCurrentView('teams')}
            onNavigateToDocuments={(tId, pId) => {
              if (tId) setActiveTeamId(tId);
              if (pId) setActiveProjectId(pId);
              setCurrentView('documents');
            }}
            onNavigateToTemplates={() => setCurrentView('templates')}
            onOpenCreateTeam={() => setCurrentView('teams')}
            onOpenJoinTeam={() => setCurrentView('teams')}
            onOpenCreateProject={(tId) => {
              setActiveTeamId(tId);
              setCurrentView('teams');
            }}
            onOpenNewDocModal={(tId, pId, tplId) => {
              if (tId) setActiveTeamId(tId);
              setModalInitialProjectId(pId || activeProjectId);
              setModalInitialTemplateId(tplId || null);
              setIsCreateModalOpen(true);
            }}
            onViewDocument={(id) => {
              setActiveDocId(id);
              setCurrentView('view_document');
            }}
            onEditDocument={(id) => {
              setActiveDocId(id);
              setCurrentView('edit_document');
            }}
            onSelectTeam={(tId) => {
              setActiveTeamId(tId);
              setActiveProjectId(null);
            }}
          />
        )}

        {currentView === 'documents' && (
          <DocumentList
            documents={documents}
            templates={templates}
            teams={teams}
            projects={projects}
            activeTeamId={activeTeamId}
            activeProjectId={activeProjectId}
            loading={loadingDocs}
            onOpenCreateModal={() => {
              setModalInitialTemplateId(null);
              setModalInitialProjectId(activeProjectId);
              setIsCreateModalOpen(true);
            }}
            onEditDocument={(id) => {
              setActiveDocId(id);
              setCurrentView('edit_document');
            }}
            onViewDocument={(id) => {
              setActiveDocId(id);
              setCurrentView('view_document');
            }}
            onDeleteDocument={handleDeleteDocument}
            onExportMarkdown={handleExportMarkdown}
          />
        )}

        {(currentView === 'templates' || (currentView === 'home' && !currentUser)) && (
          <TemplateList
            templates={templates}
            currentUser={currentUser}
            activeTeam={activeTeam}
            loading={loadingTemplates}
            onCreateNewTemplate={() => {
              setActiveTemplateId(null);
              setCurrentView('create_template');
            }}
            onEditTemplate={(id) => {
              setActiveTemplateId(id);
              setCurrentView('edit_template');
            }}
            onDeleteTemplate={handleDeleteTemplate}
            onResetSeeds={handleResetSeeds}
            onOpenAccountModal={() => setIsAccountModalOpen(true)}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onSelectTemplateToCreate={(tpl) => {
              if (!currentUser) {
                setIsAuthModalOpen(true);
              } else {
                setModalInitialTemplateId(tpl.id);
                setModalInitialProjectId(activeProjectId);
                setIsCreateModalOpen(true);
              }
            }}
          />
        )}

        {currentView === 'teams' && (
          <TeamManagement
            currentUser={currentUser}
            teams={teams}
            activeTeamId={activeTeamId}
            onSelectTeam={(tId) => {
              setActiveTeamId(tId);
              setActiveProjectId(null);
            }}
            onRefreshTeams={loadTeams}
            onOpenAccountModal={() => setIsAccountModalOpen(true)}
            onOpenNewDocModal={(projId) => {
              setModalInitialTemplateId(null);
              setModalInitialProjectId(projId || null);
              setIsCreateModalOpen(true);
            }}
            onViewProjectDocs={(teamId, projId) => {
              setActiveTeamId(teamId);
              setActiveProjectId(projId);
              setCurrentView('documents');
            }}
            showToast={showToast}
          />
        )}

        {(currentView === 'create_template' || currentView === 'edit_template') && (
          <TemplateBuilder
            initialTemplate={currentView === 'edit_template' ? activeTemplate : null}
            activeTeamId={activeTeamId}
            onSave={handleSaveTemplate}
            onCancel={() => {
              setActiveTemplateId(null);
              setCurrentView('templates');
            }}
          />
        )}

        {currentView === 'edit_document' && activeDoc && (
          <DocumentEditor
            document={activeDoc}
            template={activeTemplate}
            onSave={handleSaveDocument}
            onBack={() => {
              setCurrentView('documents');
              loadDocuments();
            }}
            onSwitchToView={() => setCurrentView('view_document')}
            onExportMarkdown={handleExportMarkdown}
          />
        )}

        {currentView === 'view_document' && activeDoc && (
          <DocumentViewer
            document={activeDoc}
            template={activeTemplate}
            onSwitchToEdit={() => setCurrentView('edit_document')}
            onBack={() => {
              setCurrentView('documents');
              loadDocuments();
            }}
            onExportMarkdown={handleExportMarkdown}
          />
        )}
      </div>

      {/* Modal: Create Document */}
      <CreateDocumentModal
        isOpen={isCreateModalOpen}
        templates={templates}
        projects={projects}
        currentUser={currentUser}
        initialSelectedTemplateId={modalInitialTemplateId}
        initialSelectedProjectId={modalInitialProjectId}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateDocument}
      />

      {/* Modal: Auth (Login/Register/Demo login) */}
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
