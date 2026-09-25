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
} from 'lucide-react';
import { User } from '../types';

interface NavigationProps {
  currentView: string;
  currentUser: User | null;
  onNavigate: (view: string) => void;
  onOpenAuthModal: () => void;
  onOpenAccountModal: () => void;
  onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  currentUser,
  onNavigate,
  onOpenAuthModal,
  onOpenAccountModal,
  onLogout,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      case 'teams':
        return 'Teams & Projects';
      default:
        return 'Menu';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-300 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Brand Logo & Navigation Dropdown Menu */}
          <div className="flex items-center space-x-4">
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
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 font-semibold uppercase tracking-wider border border-blue-200">
                    v2.0
                  </span>
                </span>
              </div>
            </div>

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
                        <div className="text-[10px] text-slate-400">Your teams, projects, and dashboard</div>
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
                      <div className="text-[10px] text-slate-400">View and create team documentation</div>
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
                        {currentUser ? 'Public and team template catalog' : 'Public document template pool'}
                      </div>
                    </div>
                  </button>

                  {currentUser && (
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
                      <Users className="w-4 h-4 text-purple-600" />
                      <div>
                        <div className="font-semibold">Teams & Projects</div>
                        <div className="text-[10px] text-slate-400">Manage memberships, projects, & roles</div>
                      </div>
                    </button>
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
                onClick={onOpenAuthModal}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors border border-indigo-200 cursor-pointer"
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
