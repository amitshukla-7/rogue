'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, CheckCircle2, GraduationCap, ArrowRight } from 'lucide-react';
import { apiFetch } from '../../../lib/api';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Clear any existing session cookie whenever visiting /login and parse error query param
  useEffect(() => {
    apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlErr = params.get('error');
      if (urlErr) {
        setError(urlErr);
      }
    }
  }, []);


  const handleGoogleLogin = () => {
    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    window.location.href = `${apiUrl}/api/auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink p-6 relative">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-coral/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-paper/5 border border-lavender/15 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden shadow-2xl">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 shadow-xl shadow-coral/30 mb-3">
            <img src="/logo.png" alt="Rogue" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white font-fraunces">Rogue Login</h2>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-coral/10 border border-coral/30 text-coral text-xs font-mono text-center">
            {error}
          </div>
        )}

        {/* Institute Access Explanation */}
        <div className="mb-6 bg-[#1D202D] p-4 rounded-2xl border border-[#2B2F42] flex items-start gap-3 text-xs">
          <GraduationCap className="w-5 h-5 text-coral shrink-0 mt-0.5" />
          <div className="text-lavender leading-relaxed">
            <span className="text-white font-bold block mb-0.5">Verified College Email Policy</span>
            • <strong>College Email Required (<code className="text-teal">mits.ac.in</code> <code className="text-teal"></code>)</strong> Login & access are strictly gated to verified institutional accounts.<br />
            • <strong>Personal Accounts (Gmail / Yahoo):</strong> Personal emails are not allowed for login.
          </div>
        </div>

        {/* Primary Google Login Button */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            type="button"
            className="w-full py-4 rounded-2xl bg-white hover:bg-gray-100 text-gray-900 font-bold text-sm transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.1 0-5.74-2.09-6.68-4.91H1.36v3.15C3.33 21.32 7.39 24 12 24z" />
              <path fill="#FBBC05" d="M5.32 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.56H1.36C.49 8.29 0 10.23 0 12.27s.49 3.98 1.36 5.71l3.96-3.69z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.23 0 12 0 7.39 0 3.33 2.68 1.36 6.56l3.96 3.69c.94-2.82 3.58-4.91 6.68-4.91z" />
            </svg>
            <span>{loading ? 'Authenticating...' : 'Sign in with Google Account'}</span>
          </button>

          <div className="flex items-center gap-2 text-[11px] text-lavender/60 justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal" /> Verified Google OAuth 2.0 Single Sign-On
          </div>
        </div>



        <p className="text-center text-xs text-lavender/60 mt-6">
          First time here?{' '}
          <Link href="/signup" className="text-coral hover:underline font-bold">
            Create Account with Google
          </Link>
        </p>
      </div>
    </div>
  );
}
