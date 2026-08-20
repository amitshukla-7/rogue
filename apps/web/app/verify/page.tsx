'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useUser } from '../../components/layout-wrapper';

export default function VerifyPage() {
  const { refreshUser } = useUser();
  const router = useRouter();

  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');
  const [collegeEmail, setCollegeEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeEmail.trim()) {
      setError('Please enter your college email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiFetch('/api/auth/verify-college', {
        method: 'POST',
        body: JSON.stringify({ collegeEmail: collegeEmail.trim() }),
      });
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit OTP code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiFetch('/api/auth/verify-college/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: otp.trim() }),
      });
      await refreshUser();
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Verification code failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] lg:min-h-screen flex flex-col items-center justify-center bg-[#0F1015] p-6 relative">
      <div className="w-full max-w-md bg-[#171922] border border-[#262936] rounded-3xl p-8 shadow-2xl relative">
        
        {/* Back button */}
        <button
          onClick={() => router.push('/rooms')}
          className="absolute top-6 left-6 p-2 rounded-xl text-text-muted hover:text-white hover:bg-[#262936] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center mt-4 mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-1.5">
            Verify your college email <ShieldCheck className="w-5 h-5 text-teal inline" />
          </h2>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-coral/10 border border-coral/30 text-coral text-xs font-mono text-center">
            {error}
          </div>
        )}

        {/* STEP 1: Email Input */}
        {step === 'email' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase mb-2">
                Enter your college email ID
              </label>
              <input
                type="email"
                placeholder="amit.kumar@mitsgw.ac.in"
                value={collegeEmail}
                onChange={(e) => setCollegeEmail(e.target.value)}
                className="w-full bg-[#0F1015] border border-[#262936] focus:border-coral rounded-xl py-3 px-4 text-xs text-white placeholder-text-muted/50 outline-none transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-coral text-white font-bold text-xs rounded-xl hover:bg-coral-hover shadow-lg shadow-coral/20 transition-all cursor-pointer mt-4"
            >
              {loading ? 'Sending Code...' : 'Send OTP'}
            </button>
          </form>
        )}

        {/* STEP 2: OTP Entry */}
        {step === 'otp' && (
          <form onSubmit={handleConfirmOtp} className="space-y-5">
            <div className="text-center text-xs text-text-muted">
              Code sent to <span className="text-white font-semibold">{collegeEmail}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase mb-3 text-center">
                Enter the 6-digit code
              </label>
              
              {/* 6 Digit boxes representation */}
              <input
                type="text"
                maxLength={6}
                placeholder="1 2 3 4 5 6"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-[#0F1015] border border-[#262936] focus:border-coral rounded-xl py-3 px-4 text-sm font-mono text-center tracking-[0.5em] text-white outline-none"
                required
              />

              <p className="text-[10px] text-text-muted text-center mt-3 font-mono">
                Resend code in 00:45
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="flex-1 py-3 bg-[#0F1015] border border-[#262936] text-white text-xs font-semibold rounded-xl"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] py-3 bg-coral text-white font-bold text-xs rounded-xl hover:bg-coral-hover shadow-lg shadow-coral/20 transition-all cursor-pointer"
              >
                {loading ? 'Verifying...' : 'Confirm Code'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Success Badge */}
        {step === 'success' && (
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-teal/20 border border-teal/40 flex items-center justify-center text-teal">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Email Verified!</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-xs">
                You can now access matches and private chat.
              </p>
            </div>

            <button
              onClick={() => router.push('/discover')}
              className="w-full py-3.5 bg-coral text-white font-bold text-xs rounded-xl hover:bg-coral-hover shadow-lg shadow-coral/20 transition-all cursor-pointer mt-4"
            >
              Start Discovering
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
