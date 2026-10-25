import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Tag,
  Columns,
  Check,
  RotateCcw,
  FileCode,
  FileText,
  Folder,
  Image as ImageIcon,
  Clock,
  User as UserIcon,
  Plus,
  Edit3,
  Eye,
  Star,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  Document,
  LatexVersionListResponse,
  LatexVersionRecord,
  LatexVersionDoc,
  LatexVersionFile,
  User,
} from '../../../types';
import { api } from '../../../api/client';

interface LatexVersionPageProps {
  document: Document;
  currentUser?: User | null;
  onBack: () => void;
  onOpenEditor: (docId: string, versionId?: string) => void;
  onRefreshDocuments: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const LatexVersionPage: React.FC<LatexVersionPageProps> = ({
  document,
  onBack,
  onOpenEditor,
  onRefreshDocuments,
  showToast,
}) => {
  const [versionData, setVersionData] = useState<LatexVersionListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('working');
  const [selectedDocPath, setSelectedDocPath] = useState<string>('main.tex');
  const [viewMode, setViewMode] = useState<'source' | 'diff'>('source');
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

  // Commit Modal State
  const [isCommitModalOpen, setIsCommitModalOpen] = useState<boolean>(false);
  const [versionInput, setVersionInput] = useState<string>('');
  const [commentInput, setCommentInput] = useState<string>('');
  const [committing, setCommitting] = useState<boolean>(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const loadVersionData = async (preferredSelection?: string) => {
    try {
      setLoading(true);
      const data = await api.listLatexVersions(document.id);
      setVersionData(data);

      if (preferredSelection) {
        setSelectedVersionId(preferredSelection);
      } else if (data.versions.length > 0 && selectedVersionId === 'working') {
        setSelectedVersionId(data.current_version_id || data.versions[0].id);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load version history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersionData();
  }, [document.id]);

  const versions = versionData?.versions || [];
  const activeVersionTag = versionData?.version_tag || document.version_tag || null;
  const activeVersionId = versionData?.current_version_id || document.current_version_id || null;

  const selectedVersion: LatexVersionRecord | null = useMemo(() => {
    if (selectedVersionId === 'working') return null;
    return versions.find((v) => v.id === selectedVersionId) || versions[0] || null;
  }, [selectedVersionId, versions]);

  const activeDocsList: LatexVersionDoc[] = useMemo(() => {
    if (selectedVersionId === 'working' || !selectedVersion) {
      return (versionData?.current_workspace?.docs || []).map((d) => ({
        id: d.id,
        folder_id: d.folder_id,
        name: d.name,
        path: d.path || d.name,
        content: d.content || '',
        rev: d.rev,
        version: d.version,
        is_main: d.is_main,
      }));
    }
    return selectedVersion.snapshot.docs || [];
  }, [selectedVersionId, selectedVersion, versionData]);

  const activeFilesList: LatexVersionFile[] = useMemo(() => {
    if (selectedVersionId === 'working' || !selectedVersion) {
      return (versionData?.current_workspace?.files || []).map((f) => ({
        id: f.id,
        folder_id: f.folder_id,
        name: f.name,
        path: f.path || f.name,
        size: f.size,
        mime_type: f.mime_type,
      }));
    }
    return selectedVersion.snapshot.files || [];
  }, [selectedVersionId, selectedVersion, versionData]);

  useEffect(() => {
    if (activeDocsList.length > 0) {
      const hasCurrent = activeDocsList.some((d) => (d.path || d.name) === selectedDocPath);
      if (!hasCurrent) {
        const mainDoc = activeDocsList.find((d) => d.is_main || d.name === 'main.tex') || activeDocsList[0];
        if (mainDoc) {
          setSelectedDocPath(mainDoc.path || mainDoc.name);
        }
      }
    }
  }, [activeDocsList, selectedDocPath]);

  const currentSelectedDoc = useMemo(() => {
    return activeDocsList.find((d) => (d.path || d.name) === selectedDocPath) || activeDocsList[0] || null;
  }, [activeDocsList, selectedDocPath]);

  const workingCounterpartDoc = useMemo(() => {
    if (!currentSelectedDoc) return null;
    const targetPath = currentSelectedDoc.path || currentSelectedDoc.name;
    const workingDocs = versionData?.current_workspace?.docs || [];
    return (
      workingDocs.find((d) => (d.path || d.name) === targetPath) ||
      workingDocs.find((d) => d.name === currentSelectedDoc.name) ||
      null
    );
  }, [currentSelectedDoc, versionData]);

  // Compute simple line diff between selected version doc and current working doc
  const diffLines = useMemo(() => {
    const versionLines = (currentSelectedDoc?.content || '').split('\n');
    const workingLines = (workingCounterpartDoc?.content || '').split('\n');
    const maxLen = Math.max(versionLines.length, workingLines.length);
    const rows: Array<{
      lineNumber: number;
      versionLine: string | undefined;
      workingLine: string | undefined;
      status: 'same' | 'modified' | 'added_in_working' | 'removed_in_working';
    }> = [];

    for (let i = 0; i < maxLen; i++) {
      const vLine = versionLines[i];
      const wLine = workingLines[i];
      let status: 'same' | 'modified' | 'added_in_working' | 'removed_in_working' = 'same';
      if (vLine === undefined && wLine !== undefined) {
        status = 'added_in_working';
      } else if (vLine !== undefined && wLine === undefined) {
        status = 'removed_in_working';
      } else if (vLine !== wLine) {
        status = 'modified';
      }
      rows.push({
        lineNumber: i + 1,
        versionLine: vLine,
        workingLine: wLine,
        status,
      });
    }
    return rows;
  }, [currentSelectedDoc, workingCounterpartDoc]);

  const handleRestoreVersion = async (ver: LatexVersionRecord) => {
    try {
      setRestoringVersionId(ver.id);
      const res = await api.restoreLatexVersion(document.id, ver.id);
      showToast(res.message || `Version "${ver.version_tag}" is now the current working version!`);
      await onRefreshDocuments();
      await loadVersionData(ver.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to restore version', 'error');
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handleOpenCommitModal = () => {
    const nextSuggested =
      versions.length === 0 ? 'v1.0' : `v1.${versions.length}`;
    setVersionInput(nextSuggested);
    setCommentInput('');
    setCommitError(null);
    setIsCommitModalOpen(true);
  };

  const handleCommitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionInput.trim()) {
      setCommitError('Please enter a version tag (e.g., v1.0).');
      return;
    }

    try {
      setCommitting(true);
      setCommitError(null);
      const res = await api.commitLatexVersion(document.id, {
        version_tag: versionInput.trim(),
        comment: commentInput.trim() || undefined,
      });
      showToast(`Committed version "${res.version_tag}" successfully!`);
      setIsCommitModalOpen(false);
      await onRefreshDocuments();
      await loadVersionData(res.version.id);
    } catch (err: any) {
      setCommitError(err.message || 'Failed to commit version');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div
      data-testid="latex-version-page"
      className="min-h-screen bg-slate-50 flex flex-col font-sans"
    >
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-300 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="latex-version-back-btn"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Documents</span>
          </button>

          <div className="h-5 w-px bg-slate-300 hidden sm:block" />

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border rounded bg-indigo-50 text-indigo-700 border-indigo-300">
              <FileCode className="w-3 h-3 text-indigo-600" />
              LaTeX Version Control
            </span>

            <h1 className="text-base font-bold text-slate-900">
              {versionData?.document_title || document.title}
            </h1>

            {/* Active Version Tag Badge */}
            <span
              data-testid="latex-version-page-active-tag"
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 border rounded ${
                activeVersionTag
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}
            >
              <Tag className="w-3 h-3 text-emerald-600" />
              <span>{activeVersionTag ? `Current Version: ${activeVersionTag}` : 'Unversioned'}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="version-page-commit-btn"
            onClick={handleOpenCommitModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 shadow-xs transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Commit Current Working State</span>
          </button>

          <button
            type="button"
            data-testid="version-page-open-editor-btn"
            onClick={() => onOpenEditor(document.id, 'working')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 shadow-xs transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Open Current Working in Editor</span>
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar: Version History List */}
        <aside className="w-full lg:w-88 bg-white border-b lg:border-b-0 lg:border-r border-slate-300 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Version History ({versions.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => loadVersionData(selectedVersionId)}
              title="Refresh versions"
              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 max-h-[calc(100vh-120px)]">
            {/* Current Working Workspace Option */}
            <div
              data-testid="latex-version-working-item"
              onClick={() => setSelectedVersionId('working')}
              className={`p-4 cursor-pointer transition-colors ${
                selectedVersionId === 'working'
                  ? 'bg-indigo-50/80 border-l-4 border-l-indigo-600'
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-900">
                    <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                    Current Working Workspace
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Live Working Copy
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Active editable files in the LaTeX workspace
                {activeVersionTag ? ` (based on ${activeVersionTag})` : ''}.
              </p>
              <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                <span>
                  {(versionData?.current_workspace?.docs?.length || 0) +
                    (versionData?.current_workspace?.files?.length || 0)}{' '}
                  files
                </span>
                <span className="text-indigo-600 font-semibold">Click to inspect</span>
              </div>
            </div>

            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 animate-pulse border border-slate-200" />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="p-8 text-center">
                <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No versions committed yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Click &ldquo;Commit&rdquo; on the document list or above to create your first version checkpoint.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCommitModal}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Commit First Version
                </button>
              </div>
            ) : (
              versions.map((ver) => {
                const isSelected = selectedVersionId === ver.id;
                const isCurrentWorking = Boolean(
                  (activeVersionId && ver.id === activeVersionId) || ver.is_current
                );
                const totalFiles =
                  (ver.snapshot?.docs?.length || 0) + (ver.snapshot?.files?.length || 0);

                return (
                  <div
                    key={ver.id}
                    data-testid={`latex-version-item-${ver.id}`}
                    onClick={() => setSelectedVersionId(ver.id)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          data-testid={`version-item-tag-${ver.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white"
                        >
                          <Tag className="w-3 h-3 text-emerald-400" />
                          {ver.version_tag}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          #{ver.version_number}
                        </span>
                        {isCurrentWorking && (
                          <span
                            data-testid={`current-working-badge-${ver.id}`}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            Current Working
                          </span>
                        )}
                      </div>
                    </div>

                    {ver.comment && (
                      <p className="text-xs text-slate-700 mt-2 line-clamp-2 bg-slate-50 p-2 border border-slate-200">
                        {ver.comment}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5">
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3 text-slate-400" />
                        {ver.user_name || 'Author'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(ver.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500 font-medium">
                        {totalFiles} {totalFiles === 1 ? 'file' : 'files'} in snapshot
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          data-testid={`view-version-editor-btn-${ver.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEditor(document.id, ver.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                          title="View this version in the LaTeX Editor with full PDF preview (Read-Only)"
                        >
                          <Eye className="w-3 h-3 text-indigo-600" />
                          <span>View in Editor</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`restore-version-btn-${ver.id}`}
                          disabled={restoringVersionId === ver.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestoreVersion(ver);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border transition-colors cursor-pointer ${
                            isCurrentWorking
                              ? 'text-slate-700 bg-white hover:bg-slate-100 border-slate-300'
                              : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-300'
                          }`}
                          title="Make this version the current working version"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>
                            {restoringVersionId === ver.id
                              ? 'Restoring...'
                              : isCurrentWorking
                              ? 'Reset Working to This'
                              : 'Make Current Working'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Main Area: Version Inspector & Diff Viewer */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          {/* Selected Version Banner */}
          <div className="bg-white border-b border-slate-300 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {selectedVersionId === 'working' || !selectedVersion ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded">
                    Live Working Copy
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">
                    Inspecting Current Working State
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  These are the current working files in the LaTeX editor. Select any committed version on the left to inspect its files or make it the current working version.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      data-testid="selected-version-tag"
                      className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded bg-slate-900 text-white"
                    >
                      <Tag className="w-3.5 h-3.5 text-emerald-400" />
                      Version: {selectedVersion.version_tag}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      (Snapshot #{selectedVersion.version_number})
                    </span>
                    {((activeVersionId && selectedVersion.id === activeVersionId) ||
                      selectedVersion.is_current) && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Current Working Version
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                    <span>
                      Committed by <strong>{selectedVersion.user_name || 'Author'}</strong> on{' '}
                      {new Date(selectedVersion.created_at).toLocaleString()}
                    </span>
                    <span>&bull;</span>
                    <span>Compiler: <strong>{selectedVersion.snapshot.compiler}</strong></span>
                    {selectedVersion.comment && (
                      <>
                        <span>&bull;</span>
                        <span className="italic text-slate-700">&ldquo;{selectedVersion.comment}&rdquo;</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    data-testid="inspector-view-in-editor-btn"
                    onClick={() => onOpenEditor(document.id, selectedVersion.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-colors cursor-pointer"
                    title="Open this version in the LaTeX Editor with full PDF preview (Read-Only)"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    <span>View in Editor (Read-Only)</span>
                  </button>

                  <button
                    type="button"
                    data-testid="make-current-version-btn"
                    disabled={restoringVersionId === selectedVersion.id}
                    onClick={() => handleRestoreVersion(selectedVersion)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {restoringVersionId === selectedVersion.id
                        ? 'Making Current...'
                        : 'Make Current Working Version'}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* File Tree + Code/Diff Split Pane */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Version File List */}
            <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-300 flex flex-col shrink-0">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>Files in Version</span>
                <span>{activeDocsList.length + activeFilesList.length}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {activeDocsList.map((docItem) => {
                  const pathKey = docItem.path || docItem.name;
                  const isSelectedDoc = (currentSelectedDoc?.path || currentSelectedDoc?.name) === pathKey;
                  return (
                    <button
                      key={docItem.id || pathKey}
                      type="button"
                      data-testid={`version-file-item-${docItem.name}`}
                      onClick={() => setSelectedDocPath(pathKey)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded transition-colors cursor-pointer ${
                        isSelectedDoc
                          ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">{docItem.path || docItem.name}</span>
                      </span>
                      {docItem.is_main && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 rounded shrink-0">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                          MAIN
                        </span>
                      )}
                    </button>
                  );
                })}

                {activeFilesList.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-slate-200">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                      Binary Assets ({activeFilesList.length})
                    </div>
                    {activeFilesList.map((fl) => (
                      <div
                        key={fl.id || fl.path}
                        className="px-3 py-1.5 text-xs text-slate-600 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{fl.path || fl.name}</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {Math.round((fl.size || 0) / 1024)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {activeDocsList.length === 0 && activeFilesList.length === 0 && (
                  <div className="p-4 text-xs text-slate-400 text-center">
                    No files recorded in this snapshot.
                  </div>
                )}
              </div>
            </div>

            {/* File Content / Diff Viewer */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              {/* Viewer Toolbar */}
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-800">
                    {currentSelectedDoc?.path || currentSelectedDoc?.name || 'No file selected'}
                  </span>
                  {currentSelectedDoc && (
                    <span className="text-[11px] text-slate-500">
                      ({(currentSelectedDoc.content || '').split('\n').length} lines)
                    </span>
                  )}
                </div>

                {selectedVersionId !== 'working' && selectedVersion && (
                  <div className="inline-flex rounded border border-slate-300 bg-white overflow-hidden">
                    <button
                      type="button"
                      data-testid="version-view-source-btn"
                      onClick={() => setViewMode('source')}
                      className={`px-3 py-1 text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                        viewMode === 'source'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Version Source</span>
                    </button>
                    <button
                      type="button"
                      data-testid="version-view-diff-btn"
                      onClick={() => setViewMode('diff')}
                      className={`px-3 py-1 text-xs font-semibold flex items-center gap-1 cursor-pointer border-l border-slate-300 ${
                        viewMode === 'diff'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Columns className="w-3.5 h-3.5" />
                      <span>Compare with Current Working</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Code or Diff Body */}
              <div className="flex-1 overflow-auto font-mono text-xs bg-slate-950 text-slate-100 p-4">
                {!currentSelectedDoc ? (
                  <div className="text-slate-400 py-12 text-center font-sans">
                    Select a file on the left to inspect its contents.
                  </div>
                ) : viewMode === 'source' || selectedVersionId === 'working' ? (
                  <pre
                    data-testid="version-source-content"
                    className="leading-relaxed whitespace-pre-wrap break-words"
                  >
                    {(currentSelectedDoc.content || '').split('\n').map((line, idx) => (
                      <div key={idx} className="flex hover:bg-slate-900/80 px-1">
                        <span className="w-10 shrink-0 text-right pr-4 text-slate-500 select-none">
                          {idx + 1}
                        </span>
                        <span className="flex-1 text-slate-100">{line || ' '}</span>
                      </div>
                    ))}
                  </pre>
                ) : (
                  <div data-testid="version-diff-content" className="space-y-0.5">
                    <div className="grid grid-cols-2 gap-4 pb-2 mb-2 border-b border-slate-800 text-[11px] font-sans font-bold text-slate-400">
                      <div>
                        Selected Version ({selectedVersion?.version_tag})
                      </div>
                      <div>Current Working Copy</div>
                    </div>
                    {diffLines.map((row) => {
                      const bgClass =
                        row.status === 'same'
                          ? ''
                          : row.status === 'modified'
                          ? 'bg-amber-950/50'
                          : row.status === 'added_in_working'
                          ? 'bg-emerald-950/50'
                          : 'bg-rose-950/50';
                      return (
                        <div
                          key={row.lineNumber}
                          className={`grid grid-cols-2 gap-4 px-1 py-0.5 ${bgClass}`}
                        >
                          <div className="flex overflow-x-auto">
                            <span className="w-8 shrink-0 text-right pr-3 text-slate-500 select-none">
                              {row.versionLine !== undefined ? row.lineNumber : ''}
                            </span>
                            <span
                              className={`flex-1 whitespace-pre-wrap break-all ${
                                row.status === 'modified' || row.status === 'removed_in_working'
                                  ? 'text-amber-300'
                                  : 'text-slate-300'
                              }`}
                            >
                              {row.versionLine ?? ''}
                            </span>
                          </div>
                          <div className="flex overflow-x-auto border-l border-slate-800 pl-2">
                            <span className="w-8 shrink-0 text-right pr-3 text-slate-500 select-none">
                              {row.workingLine !== undefined ? row.lineNumber : ''}
                            </span>
                            <span
                              className={`flex-1 whitespace-pre-wrap break-all ${
                                row.status === 'modified' || row.status === 'added_in_working'
                                  ? 'text-emerald-300'
                                  : 'text-slate-300'
                              }`}
                            >
                              {row.workingLine ?? ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Commit Version Popup Modal */}
      {isCommitModalOpen && (
        <div
          data-testid="latex-doc-commit-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        >
          <form
            onSubmit={handleCommitSubmit}
            className="bg-white max-w-md w-full border border-slate-300 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Commit LaTeX Version</h2>
                  <p className="text-xs text-slate-500">
                    Save a version snapshot for {document.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCommitModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {commitError && (
                <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{commitError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="latex-commit-version-input"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Version *
                </label>
                <input
                  id="latex-commit-version-input"
                  data-testid="latex-commit-version-input"
                  type="text"
                  autoFocus
                  value={versionInput}
                  onChange={(e) => setVersionInput(e.target.value)}
                  placeholder="Enter version (e.g., v1.0, v1.1, final-submission)..."
                  className="w-full text-sm border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="latex-commit-comment-input"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Commit Note (Optional)
                </label>
                <textarea
                  id="latex-commit-comment-input"
                  data-testid="latex-commit-comment-input"
                  rows={3}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Describe what changed in this version..."
                  className="w-full text-xs border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsCommitModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="latex-commit-submit-btn"
                disabled={committing}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{committing ? 'Committing...' : 'Commit Version'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
