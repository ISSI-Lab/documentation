import React from 'react';
import {
  FileText,
  LayoutTemplate,
  PlusCircle,
  Sparkles,
  Users,
  FolderKanban,
  User as UserIcon,
  LogIn,
  LogOut,
  Shield,
} from 'lucide-react';
import { Project, Team, User } from '../types';

interface NavigationProps {
  currentView: string;
  currentUser: User | null;
  teams: Team[];
  activeTeamId: string | null;
  projects: Project[];
  activeProjectId: string | null;
  onNavigate: (view: string) => void;
  onSelectTeam: (teamId: string) => void;
  onSelectProject: (projectId: string | null) => void;
  onOpenNewDocModal: () => void;
  onOpenAuthModal: () => void;
  onOpenAccountModal: () => void;
  onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  currentUser,
  teams,
  activeTeamId,
  projects,
  activeProjectId,
  onNavigate,
  onSelectTeam,
  onSelectProject,
  onOpenNewDocModal,
  onOpenAuthModal,
  onOpenAccountModal,
  onLogout,
}) => {
  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const isManagerOrOrganizer =
    activeTeam?.user_role === 'manager' || currentUser?.user_type === 'organizer';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Context Selectors */}
          <div className="flex items-center space-x-4">
            <div
              className="flex items-center space-x-2.5 cursor-pointer"
              onClick={() => onNavigate('documents')}
            >
              <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2 rounded-xl shadow-xs flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                  DocForge
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold uppercase tracking-wider">
                    v2.0
                  </span>
                </span>
              </div>
            </div>

            {/* Active Team & Project Switchers */}
            {currentUser && teams.length > 0 && (
              <div className="hidden md:flex items-center space-x-2 border-l border-slate-200 pl-4">
                {/* Team Selector */}
                <div className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <select
                    value={activeTeamId || ''}
                    onChange={(e) => onSelectTeam(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Project Selector */}
                <div className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
                  <select
                    value={activeProjectId || ''}
                    onChange={(e) => onSelectProject(e.target.value ? e.target.value : null)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="">All Projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Nav Tabs */}
          <nav className="hidden sm:flex items-center space-x-1">
            <button
              onClick={() => onNavigate('documents')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                currentView === 'documents' || currentView === 'edit_document' || currentView === 'view_document'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Documents</span>
            </button>

            <button
              onClick={() => onNavigate('templates')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                currentView === 'templates' || currentView === 'create_template' || currentView === 'edit_template'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LayoutTemplate className="w-4 h-4" />
              <span>Templates</span>
            </button>

            <button
              onClick={() => onNavigate('teams')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                currentView === 'teams'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Teams & Projects</span>
            </button>
          </nav>

          {/* Right Action & User Controls */}
          <div className="flex items-center space-x-2.5">
            {isManagerOrOrganizer && (
              <button
                onClick={() => onNavigate('create_template')}
                className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="Create a new document template"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>New Template</span>
              </button>
            )}

            <button
              onClick={onOpenNewDocModal}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Document</span>
            </button>

            {/* User Account / Auth Profile Button */}
            {currentUser ? (
              <div className="flex items-center space-x-1.5 border-l border-slate-200 pl-2.5">
                <button
                  onClick={onOpenAccountModal}
                  className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
                  title="Click to view account and switch user type"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                    {(currentUser.name || currentUser.username).charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden xl:block">
                    <div className="text-xs font-bold text-slate-800 leading-none">
                      {currentUser.name || currentUser.username}
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider ${
                        currentUser.user_type === 'organizer' ? 'text-indigo-600' : 'text-emerald-600'
                      }`}
                    >
                      {currentUser.user_type}
                    </span>
                  </div>
                </button>

                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
