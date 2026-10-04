import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Document } from '../../types';

export interface DeleteDocumentModalProps {
  isOpen: boolean;
  document: Document | null;
  onClose: () => void;
  onConfirm: (doc: Document) => Promise<void>;
}

export const DeleteDocumentModal: React.FC<DeleteDocumentModalProps> = ({
  isOpen,
  document,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !document) return null;

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await onConfirm(document);
    } finally {
      setIsDeleting(false);
    }
  };

  const isSubmittable = Boolean(document.is_submittable);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn"
      data-testid="delete-document-modal"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden transform transition-all"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-full text-amber-600 flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 id="delete-dialog-title" className="text-base font-bold text-slate-900">
                  Confirm Document Deletion
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Are you sure you want to delete <strong className="text-slate-900 font-semibold">"{document.title}"</strong>?
              </p>
              {isSubmittable && (
                <div className="mt-2.5 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800">
                  This is a submittable deliverable template. No participant or team copies have been created yet, so it can be safely deleted.
                </div>
              )}
              <p className="text-xs text-red-600 font-medium mt-2">
                This action is permanent and cannot be undone.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Document'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
