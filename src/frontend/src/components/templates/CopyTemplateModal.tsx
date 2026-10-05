import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Building2,
  FileText,
  AlertCircle,
  PlusCircle,
  CheckCircle2,
  Crown,
} from 'lucide-react';
import { Organization, Team, Template, User } from '../../types';
import { api } from '../../api/client';

interface CopyTemplateModalProps {
  isOpen: boolean;
  template: Template | null;
  currentUser: User | null;
  organizations?: Organization[];
  teams?: Team[]; // compatibility alias
  onClose: () => void;
  onSuccess: (copiedTemplate: Template, targetOrg: Organization) => void;
  onCreateOrganizationClick?: () => void;
}

export const CopyTemplateModal: React.FC<CopyTemplateModalProps> = ({
  isOpen,
  template,
  currentUser,
  organizations: propOrganizations,
  teams: propTeams,
  onClose,
  onSuccess,
  onCreateOrganizationClick,
}) => {
  const organizations = propOrganizations || propTeams || [];
  const sourceOrgId = template?.organization_id || template?.team_id || null;
  const sourceOrg = organizations.find((o) => o.id === sourceOrgId) || null;

  // The creator's other organizations (where the user is the creator / owner), excluding the source organization
  const creatorOtherOrgs = organizations.filter((o) => {
    const isCreator = Boolean(
      o.is_creator ||
      (o.created_by && currentUser?.id && o.created_by === currentUser.id) ||
      o.user_role === 'owner'
    );
    return isCreator && o.id !== sourceOrgId;
  });

  const [targetOrgId, setTargetOrgId] = useState<string>('');
  const [targetTitle, setTargetTitle] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setTargetTitle(template.title);
      setError(null);
      if (creatorOtherOrgs.length > 0) {
        setTargetOrgId(creatorOtherOrgs[0].id);
      } else {
        setTargetOrgId('');
      }
    }
  }, [template, isOpen, organizations.length]);

  if (!isOpen || !template) return null;

  const handleCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOrgId) {
      setError('Please select a destination organization.');
      return;
    }
    if (!targetTitle.trim()) {
      setError('Please specify a title for the copied template.');
      return;
    }

    const targetOrg = organizations.find((o) => o.id === targetOrgId);
    if (!targetOrg) {
      setError('Selected target organization could not be found.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const copied = await api.copyTemplate(template.id, {
        target_organization_id: targetOrgId,
        title: targetTitle.trim(),
      });
      onSuccess(copied, targetOrg);
    } catch (err: any) {
      setError(err.message || 'Failed to copy template to target organization.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Copy Template to Organization
              </h2>
              <p className="text-xs text-slate-500">
                Copy template from current organization to another organization you created.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {creatorOtherOrgs.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              No Other Creator Organization Available
            </h3>
            <p className="text-xs text-slate-600 mb-6 max-w-sm mx-auto leading-relaxed">
              To copy this template to another organization, you must have another organization where you are the creator.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded"
              >
                Cancel
              </button>
              {onCreateOrganizationClick && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateOrganizationClick();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded shadow-sm flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  Create New Organization
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCopy} className="p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Source Template Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                <span>Source Template Blueprint</span>
                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono border border-indigo-200">
                  {template.document_elements?.length || 0} sections
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-sm font-bold text-slate-900 truncate">
                  {template.title}
                </span>
              </div>
              {sourceOrg && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Origin:</span>
                  <span className="font-semibold text-slate-800">{sourceOrg.name}</span>
                </div>
              )}
            </div>

            {/* Destination Organization Selector */}
            <div>
              <label
                htmlFor="target-org-select"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Destination Organization (Creator's Organizations) *
              </label>
              <select
                id="target-org-select"
                value={targetOrgId}
                onChange={(e) => setTargetOrgId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                required
              >
                {creatorOtherOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} (👑 Creator)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                Only organizations you created are eligible to receive copies.
              </p>
            </div>

            {/* Template Title in Destination */}
            <div>
              <label
                htmlFor="target-title-input"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Template Title in Destination *
              </label>
              <input
                id="target-title-input"
                type="text"
                value={targetTitle}
                onChange={(e) => setTargetTitle(e.target.value)}
                placeholder="e.g. Architecture Decision Record (ADR)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                You can retain the original title or customize it for the new organization.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !targetTitle.trim() || !targetOrgId}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg cursor-pointer transition-colors shadow-sm"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                    Copying...
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy Template
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
