import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Play,
  Download,
  FileCode,
  Folder,
  FolderPlus,
  FilePlus,
  Upload,
  Trash2,
  Edit2,
  Star,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Terminal,
  Columns,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  BookOpen,
  Image as ImageIcon,
  Archive,
  Code2,
  Check,
  X,
  Sigma,
  Settings,
  RotateCcw,
  Tag,
  Clock,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import {
  CompilerType,
  Document,
  LatexCompilation,
  LatexCompilationError,
  LatexDoc,
  LatexFile,
  LatexFolder,
  LatexProject,
  LatexWorkspaceData,
  LatexVersionRecord,
} from '../../../types';
import { api } from '../../../api/client';

// Dedicated Move to Folder Icon
const FolderInputIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1" />
    <path d="M2 13h10" />
    <path d="m9 10 3 3-3 3" />
  </svg>
);

interface LatexDocumentEditorProps {
  document: Document;
  initialVersionId?: string | null;
  currentUser?: any;
  onBack: () => void;
  onOpenVersions?: (docId: string) => void;
  showToast?: (message: string, type?: 'success' | 'error') => void;
}

export const LatexDocumentEditor: React.FC<LatexDocumentEditorProps> = ({
  document: initialDoc,
  initialVersionId,
  currentUser,
  onBack,
  onOpenVersions,
  showToast,
}) => {
  const documentId = initialDoc.id;

  // Workspace state
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<LatexProject | null>(null);
  const [folders, setFolders] = useState<LatexFolder[]>([]);
  const [docs, setDocs] = useState<LatexDoc[]>([]);
  const [files, setFiles] = useState<LatexFile[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeDocContent, setActiveDocContent] = useState<string>('');
  const [openDocIds, setOpenDocIds] = useState<string[]>([]);
  const [dirtyDocs, setDirtyDocs] = useState<Record<string, boolean>>({});

  // Versioning state
  const [selectedVersionId, setSelectedVersionId] = useState<string>(initialVersionId || 'working');
  const [isReadOnly, setIsReadOnly] = useState<boolean>(Boolean(initialVersionId && initialVersionId !== 'working'));
  const [viewingVersion, setViewingVersion] = useState<LatexVersionRecord | null>(null);
  const [availableVersions, setAvailableVersions] = useState<LatexVersionRecord[]>([]);
  const [workingVersionTag, setWorkingVersionTag] = useState<string>(initialDoc.version_tag || '0');
  const [restoringVersion, setRestoringVersion] = useState<boolean>(false);

  // Commit Modal from Editor
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [commitVersionInput, setCommitVersionInput] = useState('');
  const [commitCommentInput, setCommitCommentInput] = useState('');
  const [committing, setCommitting] = useState(false);

  // Compilation state
  const [compiling, setCompiling] = useState(false);
  const [latestCompilation, setLatestCompilation] = useState<LatexCompilation | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'logs'>('preview');
  const [pdfTimestamp, setPdfTimestamp] = useState<number>(Date.now());
  const [compiler, setCompiler] = useState<CompilerType>('pdflatex');
  const [autoCompile, setAutoCompile] = useState(false);

  // Layout state
  const [showFileTree, setShowFileTree] = useState(true);
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');

  // Modals
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileFolderId, setNewFileFolderId] = useState<string | null>(null);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; type: 'doc' | 'file' | 'folder'; name: string } | null>(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ id: string; type: 'doc' | 'file'; name: string; currentFolderId: string | null } | null>(null);
  const [destinationFolderId, setDestinationFolderId] = useState<string>('root');
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const folderFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isGreekModalOpen, setIsGreekModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  // Saving indicator
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Editor textarea ref
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Greek letters palette
  const greekLetters = [
    { label: 'alpha', symbol: '\\alpha', greek: 'α' },
    { label: 'beta', symbol: '\\beta', greek: 'β' },
    { label: 'gamma', symbol: '\\gamma', greek: 'γ' },
    { label: 'delta', symbol: '\\delta', greek: 'δ' },
    { label: 'epsilon', symbol: '\\epsilon', greek: 'ε' },
    { label: 'theta', symbol: '\\theta', greek: 'θ' },
    { label: 'lambda', symbol: '\\lambda', greek: 'λ' },
    { label: 'mu', symbol: '\\mu', greek: 'μ' },
    { label: 'pi', symbol: '\\pi', greek: 'π' },
    { label: 'sigma', symbol: '\\sigma', greek: 'σ' },
    { label: 'omega', symbol: '\\omega', greek: 'ω' },
    { label: 'Delta', symbol: '\\Delta', greek: 'Δ' },
    { label: 'Gamma', symbol: '\\Gamma', greek: 'Γ' },
    { label: 'Lambda', symbol: '\\Lambda', greek: 'Λ' },
    { label: 'Sigma', symbol: '\\Sigma', greek: 'Σ' },
    { label: 'Omega', symbol: '\\Omega', greek: 'Ω' },
  ];

  // Load workspace (current working or specific version snapshot)
  const loadWorkspace = async (targetVersionId = selectedVersionId, preserveActiveDoc = true) => {
    try {
      setLoading(true);
      const data: LatexWorkspaceData = await api.getLatexWorkspace(documentId, targetVersionId);
      setProject(data.project);
      setFolders(data.folders || []);
      setDocs(data.docs || []);
      setFiles(data.files || []);
      setCompiler(data.project.compiler || 'pdflatex');
      const readonlyMode = Boolean(data.is_readonly || (targetVersionId && targetVersionId !== 'working'));
      setIsReadOnly(readonlyMode);
      setViewingVersion(data.project.viewing_version || null);
      if (data.working_version_tag) {
        setWorkingVersionTag(data.working_version_tag);
      }

      if (data.latest_compilation) {
        setLatestCompilation(data.latest_compilation);
      } else {
        setLatestCompilation(null);
      }

      // Set active document
      const currentActiveId = activeDocId;
      if (!preserveActiveDoc || !currentActiveId || !data.docs.some((d) => d.id === currentActiveId)) {
        const rootDoc = data.main_doc || data.docs.find((d) => d.is_main) || data.docs[0];
        if (rootDoc) {
          setActiveDocId(rootDoc.id);
          setActiveDocContent(rootDoc.content || '');
          setOpenDocIds([rootDoc.id]);
        }
      } else {
        const activeDoc = data.docs.find((d) => d.id === currentActiveId);
        if (activeDoc && !dirtyDocs[currentActiveId]) {
          setActiveDocContent(activeDoc.content || '');
        }
      }
    } catch (err: any) {
      showToast?.(err.message || 'Failed to load LaTeX workspace', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadVersionsList = async () => {
    try {
      const vData = await api.listLatexVersions(documentId);
      setAvailableVersions(vData.versions || []);
      if (vData.version_tag) {
        setWorkingVersionTag(vData.version_tag);
      }
    } catch (err: any) {
      console.warn('Could not load version history list:', err.message);
    }
  };

  useEffect(() => {
    const targetVer = initialVersionId || 'working';
    setSelectedVersionId(targetVer);
    loadWorkspace(targetVer, false);
    loadVersionsList();
  }, [documentId, initialVersionId]);

  // Switch versions
  const handleSwitchVersion = async (newVersionId: string) => {
    if (newVersionId === selectedVersionId) return;
    if (selectedVersionId === 'working' && activeDocId && dirtyDocs[activeDocId]) {
      await handleSaveDoc(activeDocId, activeDocContent);
    }
    setSelectedVersionId(newVersionId);
    await loadWorkspace(newVersionId, false);
  };

  // Make an older version the current working version
  const handleMakeCurrentWorking = async (versionIdToRestore = selectedVersionId) => {
    if (!versionIdToRestore || versionIdToRestore === 'working') return;
    try {
      setRestoringVersion(true);
      const res = await api.restoreLatexVersion(documentId, versionIdToRestore);
      showToast?.(res.message || `Version "${res.version_tag}" is now the current working version.`, 'success');
      setWorkingVersionTag(res.version_tag);
      setSelectedVersionId('working');
      await loadWorkspace('working', false);
      await loadVersionsList();
    } catch (err: any) {
      showToast?.(err.message || 'Failed to make this version current', 'error');
    } finally {
      setRestoringVersion(false);
    }
  };

  // Commit new version
  const handleCommitVersion = async () => {
    if (!commitVersionInput.trim()) {
      showToast?.('Please enter a version tag (e.g. 1, v1.0, 2.0)', 'error');
      return;
    }
    try {
      setCommitting(true);
      if (activeDocId && dirtyDocs[activeDocId]) {
        await api.updateLatexDoc(documentId, activeDocId, { content: activeDocContent });
        setDirtyDocs((prev) => ({ ...prev, [activeDocId]: false }));
      }
      const res = await api.commitLatexVersion(documentId, {
        version_tag: commitVersionInput.trim(),
        comment: commitCommentInput.trim() || undefined,
      });
      showToast?.(`Version "${res.version_tag}" committed successfully! It is now the current working version.`, 'success');
      setIsCommitModalOpen(false);
      setCommitVersionInput('');
      setCommitCommentInput('');
      setWorkingVersionTag(res.version_tag);
      setSelectedVersionId('working');
      await loadWorkspace('working', true);
      await loadVersionsList();
    } catch (err: any) {
      showToast?.(err.message || 'Failed to commit new version', 'error');
    } finally {
      setCommitting(false);
    }
  };

  // Switch active document
  const handleSelectDoc = (docId: string) => {
    if (docId === activeDocId) return;

    // Save current active document before switching if dirty and editable
    if (!isReadOnly && activeDocId && dirtyDocs[activeDocId]) {
      handleSaveDoc(activeDocId, activeDocContent);
    }

    const targetDoc = docs.find((d) => d.id === docId);
    if (targetDoc) {
      setActiveDocId(docId);
      setActiveDocContent(targetDoc.content || '');
      if (!openDocIds.includes(docId)) {
        setOpenDocIds((prev) => [...prev, docId]);
      }
    }
  };

  // Close tab
  const handleCloseTab = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openDocIds.filter((id) => id !== docId);
    setOpenDocIds(newTabs);

    if (activeDocId === docId) {
      if (newTabs.length > 0) {
        const nextId = newTabs[newTabs.length - 1];
        const nextDoc = docs.find((d) => d.id === nextId);
        setActiveDocId(nextId);
        setActiveDocContent(nextDoc?.content || '');
      } else {
        setActiveDocId(null);
        setActiveDocContent('');
      }
    }
  };

  // Content change
  const handleContentChange = (val: string) => {
    if (isReadOnly) return;
    setActiveDocContent(val);
    if (activeDocId) {
      setDirtyDocs((prev) => ({ ...prev, [activeDocId]: true }));
      // Update memory docs list
      setDocs((prev) => prev.map((d) => (d.id === activeDocId ? { ...d, content: val } : d)));
    }
  };

  // Save document
  const handleSaveDoc = async (docIdToSave = activeDocId, contentToSave = activeDocContent) => {
    if (isReadOnly || !docIdToSave) return;
    try {
      setSaving(true);
      await api.updateLatexDoc(documentId, docIdToSave, { content: contentToSave });
      setDirtyDocs((prev) => ({ ...prev, [docIdToSave]: false }));
      setLastSaved(new Date().toLocaleTimeString());
      if (autoCompile) {
        handleCompile();
      }
    } catch (err: any) {
      showToast?.(err.message || 'Failed to save file', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Compilation
  const handleCompile = async () => {
    if (compiling) return;
    try {
      setCompiling(true);
      // Auto-save active document first IF editable
      if (!isReadOnly && activeDocId && dirtyDocs[activeDocId]) {
        await api.updateLatexDoc(documentId, activeDocId, { content: activeDocContent });
        setDirtyDocs((prev) => ({ ...prev, [activeDocId]: false }));
      }

      const res = await api.compileLatexProject(documentId, {
        compiler,
        version_id: selectedVersionId,
      });
      setLatestCompilation({
        id: res.compilation_id,
        project_id: project?.id || '',
        status: res.status as any,
        compiler,
        logs: res.logs,
        errors: res.errors,
        pdf_size: res.pdf_size,
        pdf_url: res.pdf_url,
        created_at: new Date().toISOString(),
      });

      if (res.success) {
        setPdfTimestamp(Date.now());
        setActiveRightTab('preview');
        showToast?.('Compilation succeeded!', 'success');
      } else {
        setActiveRightTab('logs');
        showToast?.('Compilation failed. Check error logs.', 'error');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Compilation error occurred', 'error');
      setActiveRightTab('logs');
    } finally {
      setCompiling(false);
    }
  };

  // Compiler selection
  const handleCompilerChange = async (newCompiler: CompilerType) => {
    setCompiler(newCompiler);
    try {
      await api.updateLatexCompiler(documentId, newCompiler);
      showToast?.(`Compiler set to ${newCompiler}`, 'success');
    } catch {
      // ignore
    }
  };

  // Set Root Document
  const handleSetRootDoc = async (docId: string) => {
    try {
      await api.setLatexRootDoc(documentId, docId);
      setDocs((prev) => prev.map((d) => ({ ...d, is_main: d.id === docId })));
      if (project) {
        setProject({ ...project, root_doc_id: docId });
      }
      showToast?.('Main document set successfully', 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to set main document', 'error');
    }
  };

  // Create new file
  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    try {
      const created = await api.createLatexDoc(documentId, {
        name: newFileName.trim(),
        folder_id: newFileFolderId || null,
      });
      setDocs((prev) => [...prev, created]);
      setActiveDocId(created.id);
      setActiveDocContent(created.content || '');
      setOpenDocIds((prev) => [...prev, created.id]);
      setIsNewFileModalOpen(false);
      setNewFileName('');
      setNewFileFolderId(null);
      showToast?.(`File '${created.name}' created`, 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to create file', 'error');
    }
  };

  // Create new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const created = await api.createLatexFolder(documentId, { name: newFolderName.trim() });
      setFolders((prev) => [...prev, created]);
      setIsNewFolderModalOpen(false);
      setNewFolderName('');
      showToast?.(`Folder '${created.name}' created`, 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to create folder', 'error');
    }
  };

  // Delete folder
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Are you sure you want to delete folder '${folderName}' and all its files?`)) return;
    try {
      await api.deleteLatexFolder(documentId, folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setDocs((prev) => prev.filter((d) => d.folder_id !== folderId));
      setFiles((prev) => prev.filter((fl) => fl.folder_id !== folderId));

      // If active doc was inside this folder, switch to first remaining doc
      const activeDoc = docs.find((d) => d.id === activeDocId);
      if (activeDoc && activeDoc.folder_id === folderId) {
        const remainingDocs = docs.filter((d) => d.folder_id !== folderId);
        if (remainingDocs.length > 0) {
          setActiveDocId(remainingDocs[0].id);
          setActiveDocContent(remainingDocs[0].content || '');
        } else {
          setActiveDocId(null);
          setActiveDocContent('');
        }
      }
      showToast?.(`Folder '${folderName}' deleted`, 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to delete folder', 'error');
    }
  };

  // Move document or file entity
  const handleMoveEntity = async (entityId: string, entityType: 'doc' | 'file', targetFolderId: string | null) => {
    try {
      const res = await api.moveLatexEntity(documentId, {
        entity_id: entityId,
        entity_type: entityType,
        target_folder_id: targetFolderId,
      });
      if (entityType === 'doc') {
        setDocs((prev) =>
          prev.map((d) => (d.id === entityId ? { ...d, folder_id: res.folder_id, path: res.path } : d))
        );
      } else {
        setFiles((prev) =>
          prev.map((fl) => (fl.id === entityId ? { ...fl, folder_id: res.folder_id, path: res.path } : fl))
        );
      }
      const targetName = targetFolderId
        ? folders.find((f) => f.id === targetFolderId)?.name || 'folder'
        : 'Project Root';
      showToast?.(`Moved to ${targetName}`, 'success');
      setIsMoveModalOpen(false);
      setMoveTarget(null);
    } catch (err: any) {
      showToast?.(err.message || 'Failed to move file', 'error');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string, type: 'doc' | 'file', name: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ id, type, name }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnTarget = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && data.id && data.type) {
        handleMoveEntity(data.id, data.type, targetFolderId);
      }
    } catch {
      // ignore
    }
  };

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Upload file asset
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetFolder = uploadTargetFolderId;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const uploaded = await api.uploadLatexFile(documentId, {
          name: file.name,
          folder_id: targetFolder || null,
          data_base64: base64,
          mime_type: file.type,
        });
        setFiles((prev) => [...prev, uploaded]);
        setUploadTargetFolderId(null);
        showToast?.(`Asset '${file.name}' uploaded`, 'success');
      } catch (err: any) {
        showToast?.(err.message || 'Failed to upload asset', 'error');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Rename entity
  const handleRename = async () => {
    if (!renameTarget || !renameNewName.trim()) return;
    try {
      await api.renameLatexEntity(documentId, {
        entity_id: renameTarget.id,
        entity_type: renameTarget.type,
        new_name: renameNewName.trim(),
      });
      if (renameTarget.type === 'doc') {
        setDocs((prev) => prev.map((d) => (d.id === renameTarget.id ? { ...d, name: renameNewName.trim() } : d)));
      } else if (renameTarget.type === 'file') {
        setFiles((prev) => prev.map((f) => (f.id === renameTarget.id ? { ...f, name: renameNewName.trim() } : f)));
      } else if (renameTarget.type === 'folder') {
        setFolders((prev) => prev.map((f) => (f.id === renameTarget.id ? { ...f, name: renameNewName.trim() } : f)));
      }
      setIsRenameModalOpen(false);
      setRenameTarget(null);
      setRenameNewName('');
      showToast?.('Renamed successfully', 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to rename', 'error');
    }
  };

  // Delete entity
  const handleDeleteDoc = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.deleteLatexDoc(documentId, docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      setOpenDocIds((prev) => prev.filter((id) => id !== docId));
      if (activeDocId === docId) {
        const remaining = docs.filter((d) => d.id !== docId);
        if (remaining.length > 0) {
          setActiveDocId(remaining[0].id);
          setActiveDocContent(remaining[0].content || '');
        } else {
          setActiveDocId(null);
          setActiveDocContent('');
        }
      }
      showToast?.('Document deleted', 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to delete document', 'error');
    }
  };

  const handleDeleteFile = async (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this asset?')) return;
    try {
      await api.deleteLatexFile(documentId, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      showToast?.('Asset deleted', 'success');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to delete asset', 'error');
    }
  };

  // Insert helper text into editor textarea at cursor
  const insertTextAtCursor = (prefix: string, suffix = '') => {
    if (isReadOnly) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const selected = current.substring(start, end);
    const replacement = `${prefix}${selected}${suffix}`;

    const newContent = current.substring(0, start) + replacement + current.substring(end);
    handleContentChange(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 10);
  };

  // Jump to error line in editor
  const handleJumpToLine = (err: LatexCompilationError) => {
    const targetDoc = docs.find((d) => d.name === err.file || d.path.endsWith(err.file));
    if (targetDoc && targetDoc.id !== activeDocId) {
      handleSelectDoc(targetDoc.id);
    }

    setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const lines = textarea.value.split('\n');
      const lineNum = Math.min(Math.max(err.line, 1), lines.length);

      let charPos = 0;
      for (let i = 0; i < lineNum - 1; i++) {
        charPos += lines[i].length + 1;
      }

      textarea.focus();
      textarea.setSelectionRange(charPos, charPos + lines[lineNum - 1].length);

      // Scroll into view
      const lineHeight = 20;
      textarea.scrollTop = Math.max(0, (lineNum - 5) * lineHeight);
    }, 50);
  };

  // Keyboard shortcuts (Ctrl+S, Ctrl+Enter, Ctrl+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveDoc();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleCompile();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setShowFileTree((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDocId, activeDocContent, compiler, dirtyDocs]);

  // Statistics
  const wordCount = activeDocContent ? activeDocContent.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = activeDocContent.length;
  const lineCount = activeDocContent ? activeDocContent.split('\n').length : 1;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="font-medium text-slate-700">Loading LaTeX Project Workspace...</p>
      </div>
    );
  }

  const activeDoc = docs.find((d) => d.id === activeDocId);
  const pdfUrl = `${api.getLatexPdfUrl(documentId, {
    versionId: selectedVersionId,
    compilationId: latestCompilation?.id,
  })}&t=${pdfTimestamp}`;
  const zipDownloadUrl = api.getLatexZipDownloadUrl(documentId, selectedVersionId);
  const errorCount = latestCompilation?.errors?.filter((e) => e.type === 'error').length || 0;
  const warningCount = latestCompilation?.errors?.filter((e) => e.type === 'warning').length || 0;

  // Render text doc item in tree (draggable & with move button)
  const renderDocItem = (d: LatexDoc, currentFolderId: string | null) => {
    const isActive = d.id === activeDocId;
    const isMain = d.is_main || d.id === project?.root_doc_id;
    const isBib = d.name.endsWith('.bib');
    const isDirty = Boolean(dirtyDocs[d.id]);

    return (
      <div
        key={d.id}
        draggable={!isReadOnly}
        onDragStart={(e) => handleDragStart(e, d.id, 'doc', d.name)}
        onClick={() => handleSelectDoc(d.id)}
        className={`flex items-center justify-between text-xs px-2 py-1.5 cursor-pointer rounded transition-colors group ${
          isActive
            ? 'bg-indigo-600 text-white font-medium'
            : 'text-slate-700 hover:bg-slate-200/70'
        }`}
        title={isReadOnly ? d.name : `${d.name} (drag to move to a folder)`}
      >
        <div className="flex items-center space-x-1.5 truncate">
          {isBib ? (
            <BookOpen className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-200' : 'text-amber-600'}`} />
          ) : (
            <FileCode className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-200' : 'text-indigo-600'}`} />
          )}
          <span className="truncate">{d.name}</span>
          {isDirty && <span className={`text-[10px] ${isActive ? 'text-amber-300' : 'text-amber-600'}`}>*</span>}
          {isMain && (
            <span
              className={`text-[9px] uppercase px-1 py-0.2 font-bold rounded ${
                isActive ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'
              }`}
              title="Main document compiled by engine"
            >
              main
            </span>
          )}
        </div>

        {!isReadOnly && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition-opacity">
            {/* Move Button */}
            <button
              type="button"
              data-testid={`move-doc-btn-${d.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setMoveTarget({ id: d.id, type: 'doc', name: d.name, currentFolderId });
                setDestinationFolderId(folders.find((f) => f.id !== currentFolderId)?.id || 'root');
                setIsMoveModalOpen(true);
              }}
              className={`p-0.5 hover:text-indigo-400 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}
              title="Move file to folder"
            >
              <FolderInputIcon className="w-3 h-3" />
            </button>
            {!isMain && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetRootDoc(d.id);
                }}
                className={`p-0.5 hover:text-amber-400 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}
                title="Set as Main Document"
              >
                <Star className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRenameTarget({ id: d.id, type: 'doc', name: d.name });
                setRenameNewName(d.name);
                setIsRenameModalOpen(true);
              }}
              className={`p-0.5 hover:text-slate-900 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}
              title="Rename"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            {docs.length > 1 && (
              <button
                type="button"
                onClick={(e) => handleDeleteDoc(d.id, e)}
                className={`p-0.5 hover:text-rose-400 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render binary file asset in tree (draggable & with move button)
  const renderFileItem = (fl: LatexFile, currentFolderId: string | null) => {
    return (
      <div
        key={fl.id}
        draggable={!isReadOnly}
        onDragStart={(e) => handleDragStart(e, fl.id, 'file', fl.name)}
        className="flex items-center justify-between text-xs px-2 py-1.5 text-slate-600 hover:bg-slate-200/60 rounded group transition-colors"
        title={isReadOnly ? fl.name : `${fl.name} (drag to move to a folder)`}
      >
        <div className="flex items-center space-x-1.5 truncate">
          <ImageIcon className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <span className="truncate">{fl.name}</span>
          <span className="text-[10px] text-slate-400">({Math.round(fl.size / 1024)} KB)</span>
        </div>
        {!isReadOnly && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition-opacity">
            {/* Move Button */}
            <button
              type="button"
              data-testid={`move-file-btn-${fl.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setMoveTarget({ id: fl.id, type: 'file', name: fl.name, currentFolderId });
                setDestinationFolderId(folders.find((f) => f.id !== currentFolderId)?.id || 'root');
                setIsMoveModalOpen(true);
              }}
              className="p-0.5 text-slate-400 hover:text-indigo-600"
              title="Move file to folder"
            >
              <FolderInputIcon className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => handleDeleteFile(fl.id, e)}
              className="p-0.5 text-slate-400 hover:text-rose-600"
              title="Delete asset"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] mui-paper overflow-hidden bg-slate-50 border border-slate-300">
      {/* 1. Header Toolbar */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shadow-sm z-20 flex-wrap gap-2">
        <div className="flex items-center space-x-3 flex-wrap gap-y-1">
          <button
            onClick={onBack}
            className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 cursor-pointer"
            title="Back to Documents"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Documents
          </button>

          {/* File Panel Toggle */}
          <button
            type="button"
            data-testid="toggle-file-panel-btn"
            onClick={() => setShowFileTree((prev) => !prev)}
            className={`flex items-center text-xs font-semibold px-2.5 py-1 border transition-colors cursor-pointer ${
              showFileTree
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
            title={showFileTree ? 'Hide File Panel (Ctrl+B)' : 'Expand File Panel (Ctrl+B)'}
            aria-label={showFileTree ? 'Hide File Panel' : 'Expand File Panel'}
          >
            <Folder className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            <span className="hidden sm:inline">{showFileTree ? 'Hide Files' : 'Files'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200">
              LaTeX
            </span>
            <h1 className="text-base font-bold text-slate-900 max-w-xs truncate" title={initialDoc.title}>
              {initialDoc.title}
            </h1>
          </div>

          {/* Version Selector & Status */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 flex-wrap">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              Version:
            </span>
            <select
              data-testid="editor-version-select"
              value={selectedVersionId}
              onChange={(e) => handleSwitchVersion(e.target.value)}
              className={`text-xs font-semibold px-2.5 py-1 border rounded cursor-pointer transition-colors max-w-[220px] truncate ${
                isReadOnly
                  ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                  : 'bg-white text-slate-800 border-slate-300 hover:border-slate-400'
              }`}
            >
              <option value="working">
                Current Working (v{workingVersionTag || '0'})
              </option>
              {availableVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_tag} ({v.id === (project?.current_version_id) ? 'Current Working' : 'Read-Only'})
                  {v.comment ? ` - ${v.comment}` : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              data-testid="editor-header-commit-btn"
              onClick={() => {
                setCommitVersionInput('');
                setCommitCommentInput('');
                setIsCommitModalOpen(true);
              }}
              title="Commit current working files into a new version milestone"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded cursor-pointer transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Commit</span>
            </button>

            {onOpenVersions && (
              <button
                type="button"
                data-testid="editor-header-versions-btn"
                onClick={() => onOpenVersions(documentId)}
                title="Open Version History & Comparison Page"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-300 rounded cursor-pointer transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-violet-600" />
                <span>History</span>
              </button>
            )}
          </div>
        </div>

        {/* Center / Right Action Controls */}
        <div className="flex items-center space-x-3">
          {/* Save Button */}
          <button
            onClick={() => handleSaveDoc()}
            disabled={saving || isReadOnly}
            className={`flex items-center text-xs font-semibold px-3 py-1.5 transition-colors border cursor-pointer ${
              isReadOnly
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-80'
                : activeDocId && dirtyDocs[activeDocId]
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
            title={
              isReadOnly
                ? 'Cannot save: older versions are read-only. Switch to Current Working Version or click "Make Current Working Version" to edit.'
                : 'Save file (Ctrl+S)'
            }
          >
            {isReadOnly ? (
              <>
                <Lock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                Read-Only
              </>
            ) : (
              <>
                <Save className={`w-3.5 h-3.5 mr-1.5 ${saving ? 'animate-spin' : ''}`} />
                {saving ? 'Saving...' : activeDocId && dirtyDocs[activeDocId] ? 'Save *' : 'Saved'}
              </>
            )}
          </button>

          {/* Recompile Button */}
          <button
            onClick={handleCompile}
            disabled={compiling}
            className="flex items-center text-xs font-bold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 shadow-sm transition-colors cursor-pointer"
            title="Compile project (Ctrl+Enter)"
          >
            <Play className={`w-3.5 h-3.5 mr-1.5 fill-current ${compiling ? 'animate-spin' : ''}`} />
            {compiling ? 'Compiling...' : 'Recompile'}
          </button>

          {/* Download PDF Button */}
          <a
            href={pdfUrl}
            download={`${(project?.name || 'document').replace(/\s+/g, '_')}.pdf`}
            className="flex items-center text-xs font-semibold px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">PDF</span>
          </a>

          {/* Download ZIP */}
          <a
            href={zipDownloadUrl}
            className="flex items-center text-xs font-semibold px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors"
            title="Download Source ZIP"
          >
            <Archive className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">ZIP</span>
          </a>

          {/* View Mode Toggle */}
          <div className="flex border border-slate-300 bg-white">
            <button
              onClick={() => setViewMode('editor')}
              className={`p-1.5 text-xs ${viewMode === 'editor' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
              title="Editor only"
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`p-1.5 text-xs border-l border-r border-slate-200 ${viewMode === 'split' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
              title="Split View"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`p-1.5 text-xs ${viewMode === 'preview' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
              title="Preview only"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Settings Icon Button & Popover Panel */}
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              data-testid="latex-settings-btn"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              className={`p-1.5 border transition-colors cursor-pointer ${
                isSettingsOpen
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-300'
              }`}
              title="LaTeX Compiler & Build Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {isSettingsOpen && (
              <div
                data-testid="latex-settings-panel"
                className="absolute right-0 mt-2 w-72 bg-white border border-slate-300 shadow-xl z-50 p-4 space-y-4 mui-paper"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center space-x-1.5">
                    <Settings className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Project Settings
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="text-slate-400 hover:text-slate-700 p-0.5"
                    title="Close Settings"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* TeX Compiler Engine Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    LaTeX Compile Engine
                  </label>
                  <div className="space-y-1.5">
                    {(
                      [
                        {
                          id: 'pdflatex',
                          label: 'pdfLaTeX',
                          desc: 'Fastest standard engine for articles & papers',
                        },
                        {
                          id: 'xelatex',
                          label: 'XeLaTeX',
                          desc: 'Custom TTF/OTF fonts & Unicode / CJK scripts',
                        },
                        {
                          id: 'lualatex',
                          label: 'LuaLaTeX',
                          desc: 'Lua scripting, custom fonts & large documents',
                        },
                      ] as { id: CompilerType; label: string; desc: string }[]
                    ).map((item) => {
                      const isSelected = compiler === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={`compiler-option-${item.id}`}
                          onClick={() => handleCompilerChange(item.id)}
                          className={`w-full text-left px-3 py-2 border transition-colors flex items-start justify-between cursor-pointer ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold flex items-center gap-1.5">
                              <span>{item.label}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                              {item.desc}
                            </p>
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Auto-compile Toggle */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer select-none">
                    <div>
                      <span className="font-semibold block">Auto-compile on Save</span>
                      <span className="text-[11px] text-slate-500">
                        Automatically build PDF when saving changes
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoCompile}
                      onChange={(e) => setAutoCompile(e.target.checked)}
                      className="rounded-none border-slate-300 text-indigo-600 focus:ring-0 w-4 h-4"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Read-Only Version Notification Banner */}
      {isReadOnly && (
        <div
          data-testid="editor-readonly-banner"
          className="bg-amber-50 border-b border-amber-300 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 z-10"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 bg-amber-200 text-amber-900 rounded uppercase text-[10px] tracking-wider border border-amber-300">
              <Lock className="w-3 h-3" />
              Read-Only
            </span>
            <span>
              Viewing older snapshot <strong>Version {viewingVersion?.version_tag || project?.version_tag}</strong>
              {viewingVersion?.comment ? ` ("${viewingVersion.comment}")` : ''}
              {viewingVersion?.user_name ? ` by ${viewingVersion.user_name}` : ''}.
              Older versions cannot be edited directly.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="editor-make-current-btn"
              disabled={restoringVersion}
              onClick={() => handleMakeCurrentWorking()}
              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded cursor-pointer shadow-xs transition-colors disabled:opacity-50"
              title="Make this older version the current working version so you can edit it"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{restoringVersion ? 'Restoring...' : 'Make Current Working Version'}</span>
            </button>

            <button
              type="button"
              data-testid="editor-return-working-btn"
              onClick={() => handleSwitchVersion('working')}
              className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-100 text-slate-800 font-semibold border border-slate-300 rounded cursor-pointer transition-colors"
            >
              Return to Current Working (v{workingVersionTag || '0'})
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Project File Tree */}
        {showFileTree && (
          <aside
            data-testid="latex-file-panel"
            className="w-64 bg-slate-100/70 border-r border-slate-200 flex flex-col flex-shrink-0 z-10"
          >
            {/* File Tree Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-200/50">
              <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">Project Files</span>
              <div className="flex items-center space-x-1">
                {isReadOnly ? (
                  <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200 mr-0.5">
                    <Lock className="w-3 h-3" />
                    Locked
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => setIsNewFileModalOpen(true)}
                      className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
                      title="New File"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsNewFolderModalOpen(true)}
                      className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
                      title="New Folder"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                    <label className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer" title="Upload Asset">
                      <Upload className="w-3.5 h-3.5" />
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <input type="file" ref={folderFileInputRef} className="hidden" onChange={handleFileUpload} />
                    <div className="h-3.5 w-px bg-slate-300 mx-0.5" />
                  </>
                )}
                <button
                  type="button"
                  data-testid="hide-file-panel-btn"
                  onClick={() => setShowFileTree(false)}
                  className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                  title="Hide File Panel (Ctrl+B)"
                  aria-label="Hide File Panel"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tree File List */}
            <div
              className={`flex-1 overflow-y-auto p-2 space-y-1 transition-colors ${
                dragOverFolderId === 'root' ? 'bg-indigo-50/70 ring-2 ring-indigo-400 ring-inset' : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => handleDropOnTarget(e, null)}
            >
              {/* Folders */}
              {folders.map((f) => {
                const isCollapsed = Boolean(collapsedFolders[f.id]);
                const folderDocs = docs.filter((d) => d.folder_id === f.id);
                const folderFiles = files.filter((fl) => fl.folder_id === f.id);
                const totalItems = folderDocs.length + folderFiles.length;
                const isDragOver = dragOverFolderId === f.id;

                return (
                  <div key={f.id} className="space-y-0.5">
                    {/* Folder Row */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverFolderId !== f.id) setDragOverFolderId(f.id);
                      }}
                      onDragLeave={(e) => {
                        e.stopPropagation();
                        if (dragOverFolderId === f.id) setDragOverFolderId(null);
                      }}
                      onDrop={(e) => handleDropOnTarget(e, f.id)}
                      className={`flex items-center justify-between text-xs px-2 py-1.5 rounded transition-all group ${
                        isDragOver
                          ? 'bg-indigo-100/90 ring-2 ring-indigo-500 font-medium text-indigo-900'
                          : 'text-slate-700 hover:bg-slate-200/60'
                      }`}
                    >
                      <div
                        onClick={() => toggleFolderCollapse(f.id)}
                        className="flex items-center space-x-1.5 truncate cursor-pointer flex-1 select-none"
                      >
                        <span className="text-slate-400 hover:text-slate-600 p-0.5">
                          <ChevronRight
                            className={`w-3 h-3 transition-transform duration-150 ${
                              !isCollapsed ? 'rotate-90' : ''
                            }`}
                          />
                        </span>
                        <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20 shrink-0" />
                        <span className="font-semibold truncate">{f.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({totalItems})</span>
                      </div>

                      {!isReadOnly && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition-opacity">
                          <button
                            type="button"
                            data-testid={`add-file-to-folder-btn-${f.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewFileFolderId(f.id);
                              setIsNewFileModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-300/50 rounded transition-colors cursor-pointer"
                            title={`Add file under '${f.name}'`}
                          >
                            <FilePlus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            data-testid={`upload-to-folder-btn-${f.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadTargetFolderId(f.id);
                              folderFileInputRef.current?.click();
                            }}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-300/50 rounded transition-colors cursor-pointer"
                            title={`Upload asset to '${f.name}'`}
                          >
                            <Upload className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            data-testid={`rename-folder-btn-${f.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameTarget({ id: f.id, type: 'folder', name: f.name });
                              setRenameNewName(f.name);
                              setIsRenameModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-300/50 rounded transition-colors cursor-pointer"
                            title="Rename folder"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            data-testid={`delete-folder-btn-${f.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFolder(f.id, f.name);
                            }}
                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-300/50 rounded transition-colors cursor-pointer"
                            title="Delete folder"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Folder Child Items */}
                    {!isCollapsed && (
                      <div className="pl-4 ml-2.5 border-l border-slate-200/90 space-y-0.5">
                        {folderDocs.map((d) => renderDocItem(d, f.id))}
                        {folderFiles.map((fl) => renderFileItem(fl, f.id))}
                        {totalItems === 0 && (
                          <div className="text-[11px] text-slate-400 italic py-1 pl-2">
                            No files yet (drag files here or click +)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Root Files Section Header if folders exist */}
              {folders.length > 0 && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverFolderId !== 'root') setDragOverFolderId('root');
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation();
                    if (dragOverFolderId === 'root') setDragOverFolderId(null);
                  }}
                  onDrop={(e) => handleDropOnTarget(e, null)}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 pt-2 pb-0.5 rounded transition-colors ${
                    dragOverFolderId === 'root'
                      ? 'text-indigo-600 bg-indigo-50 ring-1 ring-indigo-400'
                      : 'text-slate-400'
                  }`}
                >
                  Root Files
                </div>
              )}

              {/* Root Text Documents */}
              {docs.filter((d) => !d.folder_id).map((d) => renderDocItem(d, null))}

              {/* Root Binary Assets */}
              {files.filter((fl) => !fl.folder_id).map((fl) => renderFileItem(fl, null))}
            </div>

            {/* Bottom Project Info */}
            <div className="p-2.5 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex justify-between items-center">
              <span>{docs.length} docs, {files.length} assets</span>
              {lastSaved && <span>Saved {lastSaved}</span>}
            </div>
          </aside>
        )}

        {/* Collapsed File Panel Strip (when hidden) */}
        {!showFileTree && (
          <aside
            data-testid="collapsed-file-panel-strip"
            className="w-10 bg-slate-100/80 border-r border-slate-200 flex flex-col items-center py-2 flex-shrink-0 z-10 select-none group"
          >
            <button
              type="button"
              data-testid="expand-file-panel-btn"
              onClick={() => setShowFileTree(true)}
              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-200 rounded transition-colors flex flex-col items-center gap-1 cursor-pointer"
              title="Expand File Panel (Ctrl+B)"
              aria-label="Expand File Panel"
            >
              <Folder className="w-4 h-4 text-amber-500" />
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
            </button>
            <button
              type="button"
              data-testid="expand-file-panel-label-btn"
              onClick={() => setShowFileTree(true)}
              className="mt-4 text-[11px] font-semibold tracking-wider uppercase text-slate-500 hover:text-indigo-600 cursor-pointer [writing-mode:vertical-rl] rotate-180 py-2 select-none"
              title="Expand File Panel"
            >
              Files ({docs.length + files.length})
            </button>
          </aside>
        )}

        {/* Center Pane: LaTeX Code Editor */}
        {(viewMode === 'split' || viewMode === 'editor') && (
          <main className="flex-1 flex flex-col min-w-0 bg-white border-r border-slate-200">
            {/* Tabs Bar */}
            <div className="flex items-center justify-between bg-slate-100 border-b border-slate-200 px-2 overflow-x-auto">
              <div className="flex items-center space-x-1 overflow-x-auto py-1">
                {openDocIds.map((id) => {
                  const d = docs.find((x) => x.id === id);
                  if (!d) return null;
                  const isActive = id === activeDocId;
                  const isDirty = Boolean(dirtyDocs[id]);

                  return (
                    <div
                      key={id}
                      onClick={() => handleSelectDoc(id)}
                      className={`flex items-center space-x-1.5 px-3 py-1 text-xs cursor-pointer border select-none transition-colors ${
                        isActive
                          ? 'bg-white border-slate-300 border-b-transparent text-slate-900 font-semibold shadow-xs'
                          : 'bg-slate-200/60 border-transparent text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="truncate max-w-[140px]">{d.name}</span>
                      {isDirty && <span className="text-amber-500 font-bold">*</span>}
                      {openDocIds.length > 1 && (
                        <button
                          onClick={(e) => handleCloseTab(id, e)}
                          className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sidebar toggle */}
              <button
                type="button"
                data-testid="tab-toggle-file-panel-btn"
                onClick={() => setShowFileTree(!showFileTree)}
                className="text-slate-500 hover:text-slate-800 p-1 text-xs rounded hover:bg-slate-200 transition-colors cursor-pointer"
                title={showFileTree ? 'Hide File Panel (Ctrl+B)' : 'Expand File Panel (Ctrl+B)'}
                aria-label={showFileTree ? 'Hide File Panel' : 'Expand File Panel'}
              >
                {showFileTree ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* LaTeX Quick Insertion Toolbar */}
            <div className="flex items-center space-x-1 px-3 py-1.5 bg-slate-50 border-b border-slate-200 overflow-x-auto text-xs text-slate-700">
              {/* Text formatting */}
              <button
                onClick={() => insertTextAtCursor('\\textbf{', '}')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 font-bold bg-white"
                title="Bold (\textbf{})"
              >
                B
              </button>
              <button
                onClick={() => insertTextAtCursor('\\textit{', '}')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 italic bg-white"
                title="Italic (\textit{})"
              >
                I
              </button>
              <button
                onClick={() => insertTextAtCursor('\\texttt{', '}')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 font-mono bg-white"
                title="Monospace (\texttt{})"
              >
                Code
              </button>
              <button
                onClick={() => insertTextAtCursor('\\underline{', '}')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 underline bg-white"
                title="Underline (\underline{})"
              >
                U
              </button>

              <div className="h-4 w-px bg-slate-300 mx-1" />

              {/* Sections */}
              <button
                onClick={() => insertTextAtCursor('\\section{', '}')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 bg-white"
                title="Section"
              >
                Section
              </button>
              <button
                onClick={() => insertTextAtCursor('\\subsection{', '}')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 bg-white"
                title="Subsection"
              >
                SubSec
              </button>

              <div className="h-4 w-px bg-slate-300 mx-1" />

              {/* Math symbols & environments */}
              <button
                onClick={() => insertTextAtCursor('$ ', ' $')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 font-mono bg-white"
                title="Inline Math ($ ... $)"
              >
                $x$
              </button>
              <button
                onClick={() => insertTextAtCursor('\\[\n  ', '\n\\]')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 font-mono bg-white"
                title="Display Math (\[ ... \])"
              >
                $$
              </button>
              <button
                onClick={() => insertTextAtCursor('\\begin{equation}\n  ', '\n\\end{equation}')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 bg-white"
                title="Equation environment"
              >
                Eq
              </button>
              <button
                onClick={() => insertTextAtCursor('\\frac{', '}{}')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 bg-white font-serif"
                title="Fraction (\frac{}{})"
              >
                a/b
              </button>
              <button
                onClick={() => setIsGreekModalOpen(true)}
                className="flex items-center space-x-1 px-2 py-0.5 hover:bg-slate-200 border border-slate-300 bg-white"
                title="Greek Symbols Palette"
              >
                <Sigma className="w-3.5 h-3.5 text-indigo-600" />
                <span>Greek</span>
              </button>

              <div className="h-4 w-px bg-slate-300 mx-1" />

              {/* Lists and Tables */}
              <button
                onClick={() => insertTextAtCursor('\\begin{itemize}\n  \\item ', '\n\\end{itemize}')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 bg-white"
                title="Bullet List"
              >
                Itemize
              </button>
              <button
                onClick={() => insertTextAtCursor('\\begin{enumerate}\n  \\item ', '\n\\end{enumerate}')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 bg-white"
                title="Numbered List"
              >
                Enum
              </button>
              <button
                onClick={() =>
                  insertTextAtCursor(
                    '\\begin{table}[htbp]\n\\centering\n\\begin{tabular}{|c|c|}\n\\hline\nCol 1 & Col 2 \\\\\n\\hline\nData 1 & Data 2 \\\\\n\\hline\n\\end{tabular}\n\\caption{Table Caption}\n\\label{tab:sample}\n\\end{table}\n'
                  )
                }
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 bg-white"
                title="Table Template"
              >
                Table
              </button>
              <button
                onClick={() =>
                  insertTextAtCursor(
                    '\\begin{figure}[htbp]\n\\centering\n% \\includegraphics[width=0.8\\linewidth]{filename}\n\\caption{Figure Caption}\n\\label{fig:sample}\n\\end{figure}\n'
                  )
                }
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 bg-white"
                title="Figure Template"
              >
                Figure
              </button>
              <button
                onClick={() => insertTextAtCursor('\\cite{', '}')}
                className="px-2 py-0.5 hover:bg-slate-200 border border-slate-300 bg-white"
                title="Citation (\cite{})"
              >
                Cite
              </button>
            </div>

            {/* Code Textarea with line numbers */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Line Numbers Bar */}
              <div className="w-12 py-3 bg-slate-50 border-r border-slate-200 select-none text-right pr-2 text-xs font-mono text-slate-400 overflow-hidden">
                {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => (
                  <div key={i} className="leading-6">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={activeDocContent}
                readOnly={isReadOnly}
                onChange={(e) => !isReadOnly && handleContentChange(e.target.value)}
                placeholder={isReadOnly ? 'Viewing older version snapshot (read-only)...' : 'Write your LaTeX code here...'}
                spellCheck={false}
                className={`flex-1 p-3 font-mono text-sm leading-6 outline-none resize-none overflow-y-auto whitespace-pre tab-4 ${
                  isReadOnly ? 'bg-slate-50 text-slate-800 cursor-default' : 'bg-white text-slate-900'
                }`}
              />
            </div>

            {/* Editor Status Bar */}
            <footer className="flex items-center justify-between px-3 py-1 bg-slate-100 border-t border-slate-200 text-xs text-slate-500">
              <div className="flex items-center space-x-3">
                <span>File: <strong>{activeDoc?.name || 'none'}</strong></span>
                <span>Lines: {lineCount}</span>
                <span>Words: {wordCount}</span>
                <span>Chars: {charCount}</span>
                {isReadOnly && (
                  <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200 uppercase text-[10px]">
                    Read-Only (v{project?.version_tag})
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span>Compiler: <strong className="uppercase">{compiler}</strong></span>
                <span className="text-slate-300">|</span>
                <span>UTF-8</span>
              </div>
            </footer>
          </main>
        )}

        {/* Right Pane: PDF Preview & Compilation Logs */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <aside className="flex-1 flex flex-col min-w-0 bg-slate-100 border-l border-slate-200">
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-200/70 border-b border-slate-300">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setActiveRightTab('preview')}
                  className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-bold border transition-colors ${
                    activeRightTab === 'preview'
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  <span>PDF Preview</span>
                </button>
                <button
                  onClick={() => setActiveRightTab('logs')}
                  className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-bold border transition-colors ${
                    activeRightTab === 'logs'
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-slate-600" />
                  <span>Logs & Errors</span>
                  {errorCount > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] bg-rose-600 text-white font-extrabold rounded-full">
                      {errorCount}
                    </span>
                  )}
                  {warningCount > 0 && errorCount === 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] bg-amber-500 text-white font-bold rounded-full">
                      {warningCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Preview Tab Content */}
            {activeRightTab === 'preview' && (
              <div className="flex-1 relative bg-slate-700/10 overflow-hidden flex items-center justify-center">
                {compiling ? (
                  <div className="flex flex-col items-center justify-center text-slate-600 bg-white/90 p-6 border border-slate-200 shadow-md">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                    <p className="text-sm font-semibold">Compiling LaTeX to PDF...</p>
                    <p className="text-xs text-slate-400 mt-1">Executing {compiler} engine</p>
                  </div>
                ) : latestCompilation?.status === 'success' ? (
                  <iframe
                    key={pdfTimestamp}
                    src={pdfUrl}
                    className="w-full h-full border-none"
                    title="Compiled PDF Preview"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                    {latestCompilation?.status === 'error' ? (
                      <div className="bg-white p-6 border border-rose-200 shadow-sm text-center">
                        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                        <h3 className="text-sm font-bold text-slate-900 mb-1">Compilation Errors Encountered</h3>
                        <p className="text-xs text-slate-600 mb-4">
                          LaTeX compiler stopped with errors. Check the log inspector to resolve syntax issues.
                        </p>
                        <button
                          onClick={() => setActiveRightTab('logs')}
                          className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                        >
                          View {errorCount} Errors in Log
                        </button>
                      </div>
                    ) : (
                      <div className="text-slate-500">
                        <FileCode className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <h3 className="text-sm font-semibold text-slate-700 mb-1">No PDF Compiled Yet</h3>
                        <p className="text-xs text-slate-500 mb-4">Click "Recompile" above to build your LaTeX document into PDF.</p>
                        <button
                          onClick={handleCompile}
                          className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                        >
                          Compile Now
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Logs Tab Content */}
            {activeRightTab === 'logs' && (
              <div className="flex-1 flex flex-col bg-slate-900 text-slate-200 overflow-hidden font-mono text-xs">
                {/* Structured Error List */}
                {latestCompilation?.errors && latestCompilation.errors.length > 0 ? (
                  <div className="p-3 bg-slate-950/80 border-b border-slate-800 max-h-56 overflow-y-auto space-y-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Detected Issues ({latestCompilation.errors.length})
                    </div>
                    {latestCompilation.errors.map((err, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleJumpToLine(err)}
                        className={`p-2 border cursor-pointer transition-colors ${
                          err.type === 'error'
                            ? 'bg-rose-950/40 border-rose-800 hover:bg-rose-900/50'
                            : 'bg-amber-950/40 border-amber-800 hover:bg-amber-900/50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className={`font-bold ${err.type === 'error' ? 'text-rose-400' : 'text-amber-400'}`}>
                            {err.type === 'error' ? 'ERROR' : 'WARNING'}
                          </span>
                          <span className="text-slate-400 underline">
                            {err.file}:{err.line}
                          </span>
                        </div>
                        <p className="text-slate-200 text-xs">{err.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950/50 border-b border-slate-800 text-emerald-400 flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>No compilation errors detected!</span>
                  </div>
                )}

                {/* Raw Compile Output Logs */}
                <div className="flex-1 p-3 overflow-y-auto whitespace-pre leading-5 text-slate-300 font-mono text-xs select-text">
                  {latestCompilation?.logs || 'No compilation logs available.'}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* New File Modal */}
      {isNewFileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-white p-5 max-w-sm w-full border border-slate-300 shadow-xl mui-paper">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center">
              <FilePlus className="w-4 h-4 text-indigo-600 mr-2" />
              New LaTeX File
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Enter file name with extension (e.g. <code>chapter1.tex</code> or <code>references.bib</code>):
            </p>
            <input
              type="text"
              autoFocus
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
              placeholder="e.g. methods.tex"
              className="w-full text-xs font-mono border border-slate-300 px-3 py-2 mb-3 outline-none focus:border-indigo-600"
            />

            {folders.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Folder Location</label>
                <select
                  data-testid="new-file-folder-select"
                  value={newFileFolderId || ''}
                  onChange={(e) => setNewFileFolderId(e.target.value || null)}
                  className="w-full text-xs border border-slate-300 px-2.5 py-1.5 rounded bg-white text-slate-800 outline-none focus:border-indigo-600"
                >
                  <option value="">Project Root (/)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setIsNewFileModalOpen(false);
                  setNewFileName('');
                  setNewFileFolderId(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 border border-slate-300 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateFile}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded cursor-pointer transition-colors"
              >
                Create File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-white p-5 max-w-sm w-full border border-slate-300 shadow-xl mui-paper">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center">
              <FolderPlus className="w-4 h-4 text-amber-500 mr-2" />
              New Folder
            </h3>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              placeholder="e.g. figures or sections"
              className="w-full text-xs border border-slate-300 px-3 py-2 mb-4 outline-none focus:border-indigo-600"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsNewFolderModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 border border-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-white p-5 max-w-sm w-full border border-slate-300 shadow-xl mui-paper">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Rename {renameTarget?.name}</h3>
            <input
              type="text"
              autoFocus
              value={renameNewName}
              onChange={(e) => setRenameNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="w-full text-xs font-mono border border-slate-300 px-3 py-2 mb-4 outline-none focus:border-indigo-600"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 border border-slate-300 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRename}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded cursor-pointer transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move File Modal */}
      {isMoveModalOpen && moveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-white p-5 max-w-sm w-full border border-slate-300 shadow-xl mui-paper" data-testid="latex-move-modal">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center">
              <FolderInputIcon className="w-4 h-4 text-indigo-600 mr-2" />
              Move {moveTarget.type === 'doc' ? 'Document' : 'File'}
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              Select destination folder for <span className="font-semibold text-slate-800 font-mono">{moveTarget.name}</span>:
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Folder</label>
              <select
                data-testid="move-destination-select"
                value={destinationFolderId}
                onChange={(e) => setDestinationFolderId(e.target.value)}
                className="w-full text-xs border border-slate-300 px-3 py-2 rounded bg-white text-slate-800 outline-none focus:border-indigo-600"
              >
                <option value="root">Project Root (/)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name} {f.id === moveTarget.currentFolderId ? '(current location)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setIsMoveModalOpen(false);
                  setMoveTarget(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 border border-slate-300 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-move-btn"
                onClick={() =>
                  handleMoveEntity(
                    moveTarget.id,
                    moveTarget.type,
                    destinationFolderId === 'root' ? null : destinationFolderId
                  )
                }
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded cursor-pointer transition-colors shadow-xs"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Greek Palette Modal */}
      {isGreekModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-white p-5 max-w-md w-full border border-slate-300 shadow-xl mui-paper">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <Sigma className="w-4 h-4 text-indigo-600 mr-2" />
                Greek Mathematical Symbols
              </h3>
              <button onClick={() => setIsGreekModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4 max-h-60 overflow-y-auto">
              {greekLetters.map((g) => (
                <button
                  key={g.symbol}
                  onClick={() => {
                    insertTextAtCursor(`${g.symbol} `);
                    setIsGreekModalOpen(false);
                  }}
                  className="flex items-center justify-between p-2 text-xs border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/60 transition-colors"
                >
                  <span className="text-base font-serif font-bold text-slate-900">{g.greek}</span>
                  <span className="text-[10px] font-mono text-slate-500">{g.symbol}</span>
                </button>
              ))}
            </div>
            <div className="text-right">
              <button
                onClick={() => setIsGreekModalOpen(false)}
                className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Commit New Version from Editor */}
      {isCommitModalOpen && (
        <div
          data-testid="editor-commit-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white max-w-md w-full border border-slate-300 shadow-2xl p-6 mui-paper">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Commit LaTeX Version</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCommitModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Snapshot current working files as a milestone version. Once committed, the new version becomes the current working version.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCommitVersion();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Version Tag / Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  data-testid="editor-commit-version-input"
                  value={commitVersionInput}
                  onChange={(e) => setCommitVersionInput(e.target.value)}
                  placeholder="e.g. 1, v1.0, 2.0"
                  className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-600 font-medium"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Version Note / Description (Optional)
                </label>
                <textarea
                  rows={3}
                  data-testid="editor-commit-comment-input"
                  value={commitCommentInput}
                  onChange={(e) => setCommitCommentInput(e.target.value)}
                  placeholder="Briefly describe what changed in this version..."
                  className="w-full px-3 py-2 border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-600 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCommitModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={committing || !commitVersionInput.trim()}
                  data-testid="editor-commit-submit-btn"
                  className="px-4 py-2 border border-emerald-700 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {committing ? 'Committing...' : 'Commit Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
