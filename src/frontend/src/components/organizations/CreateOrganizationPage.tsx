import React, { useState } from 'react';
import {
  Building2,
  Crown,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Shield,
  Users,
  FolderKanban,
  Layers,
} from 'lucide-react';
import { api } from '../../api/client';
import { Organization } from '../../types';

interface CreateOrganizationPageProps {
  onSuccess: (createdOrg: Organization) => void;
  onCancel: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const CreateOrganizationPage: React.FC<CreateOrganizationPageProps> = ({
  onSuccess,
  onCancel,
  showToast,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter an organization name.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const newOrg = await api.createOrganization({
        name: name.trim(),
        description: description.trim(),
      });
      showToast(`Organization "${newOrg.name}" created successfully!`, 'success');
      onSuccess(newOrg);
    } catch (err: any) {
      showToast(err.message || 'Failed to create organization', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Back button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Organizations</span>
        </button>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Hero */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
            <Building2 className="w-72 h-72 text-white" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-xs border border-white/20 rounded-full text-xs font-semibold text-indigo-200 mb-4">
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>Organization Creator Authority</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Create a New Organization
            </h1>
            <p className="mt-2 text-sm text-indigo-200/90 leading-relaxed">
              Establish a collaborative organization workspace. As the Organization Creator, you will have exclusive authority to form team squads, establish projects, and invite members.
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-8 sm:p-10 space-y-8">
          <div className="space-y-6">
            <div>
              <label
                htmlFor="org-name"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                id="org-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp, Research Lab, or Core Engineering"
                required
                autoFocus
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                A clear, recognizable name for your team or department workspace.
              </p>
            </div>

            <div>
              <label
                htmlFor="org-desc"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Organization Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <textarea
                id="org-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the mission, domain, or purpose of this organization..."
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-normal resize-y"
              />
            </div>
          </div>

          {/* Privilege highlights */}
          <div className="p-5 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              What You Can Do Once Created
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
              <div className="bg-white p-3 rounded-xl border border-indigo-100/80 shadow-2xs">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Form Teams & Squads</span>
                </div>
                <span>Create reusable team formation sets and organize colleagues into squads.</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-100/80 shadow-2xs">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
                  <FolderKanban className="w-3.5 h-3.5 text-amber-600" />
                  <span>Establish Projects</span>
                </div>
                <span>Create projects, attach team formations or individual members, and author docs.</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-100/80 shadow-2xs">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Share Join Token</span>
                </div>
                <span>Invite teammates instantly with a unique join token and manage their roles.</span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>{submitting ? 'Creating Organization...' : 'Create Organization'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
