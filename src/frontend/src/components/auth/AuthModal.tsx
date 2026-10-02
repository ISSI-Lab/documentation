import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User as UserIcon, LogIn, UserPlus, KeyRound, RotateCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../../api/client';
import { User } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register' | 'verify';
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>(initialMode);
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  // Verification state
  const [pendingVerification, setPendingVerification] = useState<{
    userId?: string;
    email?: string;
    username?: string;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [resending, setResending] = useState<boolean>(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setResendNotice(null);
  }, [initialMode, isOpen]);

  // 30-second countdown timer for verification token
  useEffect(() => {
    if (mode !== 'verify' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, timeLeft]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendNotice(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login({ usernameOrEmail, password });
        onSuccess(res.user);
        onClose();
      } else if (mode === 'register') {
        const res = await api.register({
          username,
          email,
          password,
          name: name || username,
        });

        if (res.requires_verification) {
          setPendingVerification({
            userId: res.user_id,
            email: res.email,
            username: res.username,
          });
          setTimeLeft(res.expires_in_seconds || 30);
          setMode('verify');
          setVerificationCode('');
        } else if (res.user) {
          onSuccess(res.user);
          onClose();
        }
      } else if (mode === 'verify') {
        if (!verificationCode.trim()) {
          setError('Please enter the 6-digit verification token');
          setLoading(false);
          return;
        }

        const res = await api.verifyAccount({
          userId: pendingVerification?.userId,
          usernameOrEmail: pendingVerification?.email || usernameOrEmail,
          token: verificationCode.trim(),
        });

        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      if (err.requires_verification) {
        setPendingVerification({
          userId: err.user_id,
          email: err.email,
          username: err.data?.username,
        });
        setTimeLeft(err.expires_in_seconds || 30);
        setMode('verify');
        setVerificationCode('');
        setError(err.message || 'Please verify your email address to continue.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendToken = async () => {
    setError(null);
    setResendNotice(null);
    setResending(true);

    try {
      const res = await api.resendVerification({
        userId: pendingVerification?.userId,
        usernameOrEmail: pendingVerification?.email || usernameOrEmail || email,
      });

      setPendingVerification((prev) => ({
        ...prev,
        email: res.email || prev?.email,
      }));
      setTimeLeft(res.expires_in_seconds || 30);
      setResendNotice('A fresh verification token has been dispatched to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification token');
    } finally {
      setResending(false);
    }
  };

  const isExpired = timeLeft <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              {mode === 'login' ? (
                <LogIn className="w-5 h-5 text-blue-300" />
              ) : mode === 'register' ? (
                <UserPlus className="w-5 h-5 text-indigo-300" />
              ) : (
                <KeyRound className="w-5 h-5 text-emerald-300" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {mode === 'login'
                  ? 'Sign In to DocForge'
                  : mode === 'register'
                  ? 'Create DocForge Account'
                  : 'Verify Your Account'}
              </h2>
              <p className="text-xs text-slate-300">
                {mode === 'login'
                  ? 'Enter your credentials to access your workspace'
                  : mode === 'register'
                  ? 'Fill in your details to create an account'
                  : `Enter the code sent to ${pendingVerification?.email || 'your email'}`}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resendNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>{resendNotice}</span>
            </div>
          )}

          {mode === 'verify' ? (
            <div className="space-y-4">

              {/* Countdown Timer Widget */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  isExpired
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 text-xs font-semibold">
                  <div className="flex items-center space-x-1.5">
                    <Clock className={`w-3.5 h-3.5 ${isExpired ? 'text-amber-600' : 'text-blue-600'}`} />
                    <span>{isExpired ? 'Token Expired' : 'Token Validity'}</span>
                  </div>
                  <span className={`font-mono ${isExpired ? 'text-red-600 font-bold' : 'text-blue-700 font-bold'}`}>
                    {isExpired ? '0s (Expired)' : `${timeLeft}s remaining`}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      isExpired ? 'bg-red-500' : timeLeft < 10 ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${(timeLeft / 30) * 100}%` }}
                  />
                </div>
              </div>

              {/* Code Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  6-Digit Verification Token
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="e.g. 849201"
                    disabled={isExpired}
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono tracking-wider border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                {isExpired && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    This token has expired. Please click "Resend Token" below to get a new code.
                  </p>
                )}
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={loading || isExpired || !verificationCode}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Verifying...' : 'Verify & Sign In'}</span>
              </button>

              {/* Resend Token Button */}
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResendToken}
                  disabled={resending}
                  className="w-full py-2 px-3 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${resending ? 'animate-spin' : ''}`} />
                  <span>{resending ? 'Sending New Token...' : 'Resend Token (30s)'}</span>
                </button>
              </div>

              <div className="pt-2 text-center text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : mode === 'login' ? (
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
                    placeholder="alex@company.com or username"
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Sign In'}
              </button>

              {/* Toggle Login/Register */}
              <div className="pt-2 text-center text-xs text-slate-500">
                <span>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Create Account
                  </button>
                </span>
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Create Account'}
              </button>

              {/* Toggle Login/Register */}
              <div className="pt-2 text-center text-xs text-slate-500">
                <span>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Sign In
                  </button>
                </span>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
