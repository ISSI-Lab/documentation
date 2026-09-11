import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { TemplateList } from './components/templates/TemplateList';
import { TemplateBuilder } from './components/templates/TemplateBuilder';
import { DocumentList } from './components/documents/DocumentList';
import { DocumentEditor } from './components/documents/DocumentEditor';
import { DocumentViewer } from './components/documents/DocumentViewer';
import { CreateDocumentModal } from './components/documents/CreateDocumentModal';
import { api } from './api/client';
import { Document, DocumentCreatePayload, Template, TemplateCreatePayload } from './types';

type ViewMode =
  | 'documents'
  | 'templates'
  | 'create_template'
  | 'edit_template'
  | 'edit_document'
  | 'view_document';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('documents');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalInitialTemplateId, setModalInitialTemplateId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
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
    loadTemplates();
    loadDocuments();
  }, []);

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

  const activeDoc = documents.find((d) => d.id === activeDocId) || null;
  const activeTemplate = templates.find((t) => t.id === (activeDoc?.template_id || activeTemplateId)) || null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Toast Banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Show standard top navigation for list & builder views */}
      {currentView !== 'edit_document' && currentView !== 'view_document' && (
        <Navigation
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view as ViewMode)}
          onOpenNewDocModal={() => {
            setModalInitialTemplateId(null);
            setIsCreateModalOpen(true);
          }}
        />
      )}

      {/* Main View Router */}
      <div className="flex-1 flex flex-col">
        {currentView === 'documents' && (
          <DocumentList
            documents={documents}
            templates={templates}
            loading={loadingDocs}
            onOpenCreateModal={() => {
              setModalInitialTemplateId(null);
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

        {currentView === 'templates' && (
          <TemplateList
            templates={templates}
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
            onSelectTemplateToCreate={(tpl) => {
              setModalInitialTemplateId(tpl.id);
              setIsCreateModalOpen(true);
            }}
          />
        )}

        {(currentView === 'create_template' || currentView === 'edit_template') && (
          <TemplateBuilder
            initialTemplate={currentView === 'edit_template' ? activeTemplate : null}
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

      {/* Modal to Create Document from Template */}
      <CreateDocumentModal
        isOpen={isCreateModalOpen}
        templates={templates}
        initialSelectedTemplateId={modalInitialTemplateId}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateDocument}
      />
    </div>
  );
};
