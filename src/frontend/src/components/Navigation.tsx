import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  LayoutTemplate,
  Users,
  LogIn,
  LogOut,
  Home,
  Menu,
  ChevronDown,
  Building2,
  FolderKanban,
  Layers,
  Crown,
  Check,
  Plus,
} from 'lucide-react';
import { Organization, User } from '../types';

interface NavigationProps {
  currentView: string;
  currentUser: User | null;
  organizations?: Organization[];
  activeOrganizationId?: string | null;
  onSelectOrganization?: (orgId: string) => void;
  onNavigate: (view: string) => void;
  onOpenAuthModal: () => void;
  onOpenAccountModal: () => void;
  onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  currentUser,
  organizations = [],
  activeOrganizationId,
  onSelectOrganization,
  onNavigate,
  onOpenAuthModal,
  onOpenAccountModal,
  onLogout,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const orgMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
        setIsOrgMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeOrg = organizations.find((o) => o.id === activeOrganizationId) || null;
  const isCreatorOfActiveOrg = Boolean(
    activeOrg?.is_creator ||
    (activeOrg?.created_by && currentUser?.id && activeOrg.created_by === currentUser.id) ||
    (activeOrg?.user_role === 'owner')
  );

  const getViewLabel = () => {
    switch (currentView) {
      case 'home':
        return 'Personal Home';
      case 'documents':
      case 'edit_document':
      case 'view_document':
        return 'Documents';
      case 'templates':
      case 'create_template':
      case 'edit_template':
        return 'Templates';
      case 'projects':
        return 'Projects';
      case 'organizations':
        return 'Organizations';
      case 'create_organization':
        return 'Create Organization';
      case 'teams':
        return 'Team Formations';
      default:
        return 'Menu';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-300 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Brand Logo, Org Switcher & Navigation Dropdown Menu */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div
              className="flex items-center space-x-2.5 cursor-pointer select-none"
              onClick={() => onNavigate(currentUser ? 'home' : 'templates')}
            >
              <div className="bg-gradient-to-tr from-blue-700 to-indigo-700 text-white p-2 shadow-sm flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                  DocForge
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 font-semibold uppercase tracking-wider border border-blue-200 rounded">
                    v2.0
                  </span>
                </span>
              </div>
            </div>

            {/* Top Bar Organization Switcher (Always visible when logged in) */}
            {currentUser && (
              <div className="relative" ref={orgMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsOrgMenuOpen((prev) => !prev)}
                  className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                    isOrgMenuOpen
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                  title="Switch Active Organization"
                >
                  <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span className="font-bold truncate max-w-[100px] sm:max-w-[160px]">
                    {activeOrg?.name || 'Select Organization'}
                  </span>
                  {activeOrg && (
                    <span
                      className={`hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isCreatorOfActiveOrg
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {isCreatorOfActiveOrg ? (
                        <Crown className="w-2.5 h-2.5 text-purple-600" />
                      ) : (
                        <Users className="w-2.5 h-2.5 text-slate-500" />
                      )}
                      {isCreatorOfActiveOrg ? 'Creator' : 'Member'}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${
                      isOrgMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOrgMenuOpen && (
                  <div className="absolute left-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2 text-slate-800">
                    <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Switch Organization ({organizations.length})
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {organizations.length === 0 ? (
                        <div className="px-3.5 py-3 text-xs text-slate-400 text-center italic">
                          No organizations joined yet
                        </div>
                      ) : (
                        organizations.map((org) => {
                          const isSelected = org.id === activeOrganizationId;
                          const isOrgCreator = Boolean(
                            org.is_creator ||
                            (org.created_by && currentUser?.id && org.created_by === currentUser.id) ||
                            (org.user_role === 'owner')
                          );
                          return (
                            <button
                              key={org.id}
                              type="button"
                              onClick={() => {
                                if (onSelectOrganization) onSelectOrganization(org.id);
                                setIsOrgMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50/80 text-indigo-900 font-bold border-l-4 border-indigo-600'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Building2
                                  className={`w-4 h-4 flex-shrink-0 ${
                                    isSelected ? 'text-indigo-600' : 'text-slate-400'
                                  }`}
                                />
                                <div className="truncate">
                                  <div className="truncate font-medium">{org.name}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {isOrgCreator
                                      ? 'Organization Creator'
                                      : `Member (${org.members_count || 1} members)`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 ${
                                    isOrgCreator
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {isOrgCreator ? (
                                    <Crown className="w-2.5 h-2.5 text-purple-600" />
                                  ) : (
                                    <Users className="w-2.5 h-2.5 text-slate-500" />
                                  )}
                                  {isOrgCreator ? 'Creator' : 'Member'}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div className="border-t border-slate-100 pt-1.5 mt-1 px-1 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('create_organization');
                          setIsOrgMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create New Organization</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('organizations');
                          setIsOrgMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>All Organizations & Tokens</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Dropdown Menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                  isMenuOpen
                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                }`}
                title="Open Navigation Menu"
              >
                <Menu className="w-4 h-4 text-slate-700" />
                <span className="hidden sm:inline font-bold">Menu: {getViewLabel()}</span>
                <span className="sm:hidden font-bold">Menu</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-600 transition-transform duration-150 ${
                    isMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isMenuOpen && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 shadow-lg z-50 py-1.5 text-slate-800">
                  {currentUser && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('home');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-medium text-left transition-colors cursor-pointer ${
                        currentView === 'home'
                          ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Home className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="font-semibold">Personal Home</div>
                        <div className="text-[10px] text-slate-400">Your organizations, projects, and dashboard</div>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('documents');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-medium text-left transition-colors cursor-pointer ${
                      currentView === 'documents' ||
                      currentView === 'edit_document' ||
                      currentView === 'view_document'
                        ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <div>
                      <div className="font-semibold">Documents</div>
                      <div className="text-[10px] text-slate-400">View and create organization documentation</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('templates');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-medium text-left transition-colors cursor-pointer ${
                      currentView === 'templates' ||
                      currentView === 'create_template' ||
                      currentView === 'edit_template'
                        ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <LayoutTemplate className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold">Templates</div>
                      <div className="text-[10px] text-slate-400">
                        {currentUser ? 'Public and organization template catalog' : 'Public document template pool'}
                      </div>
                    </div>
                  </button>

                  {currentUser && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('projects');
                          setIsMenuOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-medium text-left transition-colors cursor-pointer ${
                          currentView === 'projects'
                            ? 'bg-amber-50 text-amber-700 font-bold border-l-4 border-amber-600'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <FolderKanban className="w-4 h-4 text-amber-600" />
                        <div>
                          <div className="font-semibold">Projects</div>
                          <div className="text-[10px] text-slate-400">Project assignments, squads, & staffing</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('organizations');
                          setIsMenuOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-medium text-left transition-colors cursor-pointer ${
                          currentView === 'organizations'
                            ? 'bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-600'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Building2 className="w-4 h-4 text-purple-600" />
                        <div>
                          <div className="font-semibold">Organizations</div>
                          <div className="text-[10px] text-slate-400">Manage memberships, organization creation, & roles</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('teams');
                          setIsMenuOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-medium text-left transition-colors cursor-pointer ${
                          currentView === 'teams'
                            ? 'bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-600'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Users className="w-4 h-4 text-indigo-600" />
                        <div>
                          <div className="font-semibold">Team Formations</div>
                          <div className="text-[10px] text-slate-400">Manage squads & reusable team formations</div>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Action & User Controls */}
          <div className="flex items-center space-x-2.5">
            {/* User Account / Auth Profile Button */}
            {currentUser ? (
              <div className="flex items-center space-x-1.5 border-l border-slate-200 pl-2.5">
                <button
                  onClick={onOpenAccountModal}
                  className="flex items-center space-x-2 p-1.5 hover:bg-slate-100 transition-colors text-left cursor-pointer border border-transparent hover:border-slate-200"
                  title="Click to view account and switch user type"
                >
                  <div className="w-7 h-7 bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
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
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-700 bg-white hover:bg-indigo-50/70 border border-slate-300 hover:border-indigo-300 active:bg-indigo-100 rounded-md transition-all shadow-sm cursor-pointer select-none"
              >
                <LogIn className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sign In/Register</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
