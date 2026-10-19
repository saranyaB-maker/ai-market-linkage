import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Sparkles, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { UserRole } from '../../types';

export const LoginPage: React.FC = () => {
  const { login, quickDemoLogin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const loggedUser: any = await login({ email, password });
      const searchParams = new URLSearchParams(window.location.search);
      const redirect = searchParams.get('redirect');
      if (redirect) {
        navigate(redirect);
      } else if (loggedUser?.role === 'seller') {
        navigate('/seller');
      } else if (loggedUser?.role === 'buyer') {
        navigate('/buyer');
      } else if (loggedUser?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (role: UserRole) => {
    setLoading(true);
    setError('');
    try {
      await quickDemoLogin(role);
      if (role === 'admin') navigate('/admin');
      else if (role === 'seller') navigate('/seller');
      else if (role === 'buyer') navigate('/buyer');
    } catch (err: any) {
      setError(`Demo login failed: ${err.message}. Make sure backend seed has been executed.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-forest-800 text-cream-100 flex items-center justify-center mx-auto shadow-md">
            <ShieldCheck className="w-7 h-7 text-gold-400" />
          </div>
          <h1 className="font-serif text-3xl font-extrabold text-forest-950">
            Sign In to Platform
          </h1>
          <p className="text-xs text-stone-600">
            Access your artisan workspace, buyer requirements, or administrative dashboard.
          </p>
        </div>

        {/* 1-Click Development Demo Accounts Box */}
        <div className="bg-[#FAF7F0] p-4 rounded-2xl border border-[#EAE3D2] space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-forest-900 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-terracotta-600" />
            <span>1-Click Development Demo Accounts</span>
          </div>
          <p className="text-[11px] text-stone-600">
            Click below to instantly sign in with pre-seeded role credentials:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemo('admin')}
              className="p-2.5 rounded-xl bg-purple-900 hover:bg-purple-950 text-white text-xs font-semibold text-center transition-all shadow-xs"
            >
              Admin
              <span className="block text-[9px] text-purple-200 mt-0.5">admin@...</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemo('seller')}
              className="p-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold text-center transition-all shadow-xs"
            >
              Artisan Seller
              <span className="block text-[9px] text-forest-200 mt-0.5">seller@...</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemo('buyer')}
              className="p-2.5 rounded-xl bg-terracotta-700 hover:bg-terracotta-800 text-white text-xs font-semibold text-center transition-all shadow-xs"
            >
              Wholesale Buyer
              <span className="block text-[9px] text-terracotta-200 mt-0.5">buyer@...</span>
            </button>
          </div>
        </div>

        {/* Manual Form */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-md">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-forest-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-stone-100 text-center">
            <span className="text-xs text-stone-500">
              Don&apos;t have an account yet?{' '}
              <Link to="/register" className="font-semibold text-forest-800 hover:underline">
                Register as Seller or Buyer
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
