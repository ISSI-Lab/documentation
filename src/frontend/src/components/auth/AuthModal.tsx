import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User as UserIcon, Shield, Users, Sparkles, LogIn, UserPlus } from 'lucide-react';
import { api } from '../../api/client';
import { DemoUser, User, UserType } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState<UserType>('organizer');

  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (isOpen) {
      api.getDemoUsers().then(setDemoUsers).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login({ usernameOrEmail, password });
        onSuccess(res.user);
        onClose();
      } else {
        const res = await api.register({
          username,
          email,
          password,
          name: name || username,
          user_type: userType,
        });
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demo: DemoUser) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({
        usernameOrEmail: demo.username,
        password: demo.password || 'Password123!',
      });
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to login with demo user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              {mode === 'login' ? <LogIn className="w-5 h-5 text-blue-300" /> : <UserPlus className="w-5 h-5 text-indigo-300" />}
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {mode === 'login' ? 'Sign In to DocForge' : 'Create DocForge Account'}
              </h2>
              <p className="text-xs text-slate-300">
                {mode === 'login' ? 'Enter your credentials or use quick demo login' : 'Choose your user role to get started'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Demo Login Bar */}
        {demoUsers.length > 0 && (
          <div className="bg-blue-50/80 border-b border-blue-100 px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-900 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Quick 1-Click Demo Logins:
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {demoUsers.map((demo) => (
                <button
                  key={demo.id}
                  type="button"
                  onClick={() => handleQuickDemoLogin(demo)}
                  disabled={loading}
                  className="flex flex-col items-start p-2 bg-white border border-blue-200 hover:border-blue-400 rounded-lg text-left shadow-xs transition-all hover:bg-blue-50/50"
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        demo.user_type === 'organizer' ? 'bg-indigo-600' : 'bg-emerald-500'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-800 truncate">{demo.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 capitalize">
                    {demo.user_type} &bull; @{demo.username}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Username or Email
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="organizer@docforge.local or demo_organizer"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="alexm"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* User Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select User Role / Type
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setUserType('regular')}
                    className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                      userType === 'regular'
                        ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <Users className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900">Regular Member</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Join teams via invite code & co-author project documents.
                    </p>
                  </div>

                  <div
                    onClick={() => setUserType('organizer')}
                    className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                      userType === 'organizer'
                        ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <Shield className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900">Organizer</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Can create new teams, manage workspaces, & publish templates.
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  * Note: You can also switch your user role at any time in Account Settings.
                </p>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          {/* Toggle Login/Register */}
          <div className="pt-2 text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Create Account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Sign In
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
