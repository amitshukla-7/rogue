'use client';

import React, { useState } from 'react';
import { Lightbulb, Send, X, CheckCircle2, MessageSquare, Sparkles, Bug, HelpCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useUser } from './layout-wrapper';

export default function FeedbackWidget() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [category, setCategory] = useState<'suggestion' | 'bug' | 'feature' | 'general'>('suggestion');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Check persistent dismissal state on mount & listen to global open event
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('rogue_feedback_dismissed');
      if (dismissed === 'true') setIsDismissed(true);
    }

    const handleOpen = () => {
      setIsOpen(true);
      setIsDismissed(false);
    };
    window.addEventListener('open-feedback-widget', handleOpen);
    return () => window.removeEventListener('open-feedback-widget', handleOpen);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rogue_feedback_dismissed', 'true');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please enter your feedback or suggestion');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          name: name || user?.name || 'Anonymous Visitor',
          email: email || user?.email || 'visitor@campus.edu',
          category,
          message: message.trim()
        })
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setIsOpen(false);
        setMessage('');
      }, 2200);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Subtle & Minimal Floating Trigger Capsule (Positioned cleanly above mobile bottom nav) */}
      {!isDismissed && (
        <div className="fixed bottom-20 right-4 lg:bottom-5 lg:right-5 z-40 flex items-center bg-[#12141F]/90 backdrop-blur-md border border-[#232635] hover:border-coral/40 rounded-full shadow-lg p-1 transition-all group">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-text-muted hover:text-white cursor-pointer"
            title="Feedback & Suggestions"
          >
            <Lightbulb className="w-3.5 h-3.5 text-coral group-hover:rotate-12 transition-transform" />
            <span className="text-[11px] font-medium tracking-tight">Feedback</span>
          </button>

          {/* Dismiss X button — clearly visible on phone touch screens & desktop */}
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full text-text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Dismiss feedback button"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Feedback Modal */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in cursor-pointer"
        >
          <div 
            className="w-full max-w-md bg-[#12131A] border border-[#232635] rounded-3xl p-6 shadow-2xl space-y-5 relative cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#1C1E2B] text-[#8F96A6] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 bg-teal/10 border border-teal/30 text-teal rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 animate-bounce" />
                </div>
                <h3 className="text-lg font-bold text-white">Feedback Submitted!</h3>
                <p className="text-xs text-text-muted max-w-xs mx-auto">
                  Thank you! Your feedback & suggestion have been sent directly to Platform Administration.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-coral" />
                    <h2 className="text-lg font-bold text-white">Admin Feedback Box</h2>
                  </div>
                  <p className="text-xs text-[#8F96A6] leading-relaxed">
                    Please help us make Rogue better! Report any bugs, issues, or share any suggestions you face while using the app.
                  </p>
                </div>

                {/* Name & Email inputs for guest users */}
                {!user && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-[#8F96A6]">Your Name</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-[#161822] border border-[#232635] focus:border-coral rounded-xl p-2.5 text-xs text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-[#8F96A6]">Email Address</label>
                      <input
                        type="email"
                        placeholder="john@campus.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-[#161822] border border-[#232635] focus:border-coral rounded-xl p-2.5 text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Feedback Textarea */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#8F96A6] font-mono">
                    Your Message
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Describe any bugs, issues, or suggestions to improve Rogue..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-[#161822] border border-[#232635] focus:border-coral rounded-2xl p-3 text-xs text-white placeholder-[#585E73] outline-none resize-none transition-all"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-400 font-medium">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-coral hover:bg-coral-hover text-white font-bold text-xs rounded-2xl shadow-lg shadow-coral/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Sending to Admin...' : 'Submit to Admin'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
