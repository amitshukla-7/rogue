'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Lock, 
  Sparkles, 
  Users, 
  Flame, 
  ShieldCheck, 
  Share2, 
  Copy, 
  Check, 
  Layers, 
  Compass, 
  ArrowRight,
  Sparkle,
  X,
  MessageCircle,
  Send,
  ExternalLink
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useUser } from '../../components/layout-wrapper';

export default function DiscoverPage() {
  const { user } = useUser();
  const router = useRouter();

  const [currentUsersCount, setCurrentUsersCount] = useState<number>(124);
  const requiredUsers = 1000;
  const [copiedLink, setCopiedLink] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLockStatus = async () => {
      try {
        setLoading(true);
        const data = await apiFetch('/api/discover');
        if (data && typeof data.currentUsers === 'number') {
          setCurrentUsersCount(data.currentUsers);
        } else {
          const stats = await apiFetch('/api/stats/public');
          if (stats && stats.activeStudents) {
            setCurrentUsersCount(stats.activeStudents);
          }
        }
      } catch (err) {
        console.error('Failed to fetch unlock progress:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLockStatus();
  }, []);

  const progressPercent = Math.min(100, Math.round((currentUsersCount / requiredUsers) * 100));

  const inviteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://rogue.campus';
  const shareText = 'Hey! Join me on Rogue to unlock campus discovery, student squads, and real-time classmate chat rooms!';

  const handleInviteClick = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Join Rogue - Campus Peer Network',
          text: shareText,
          url: inviteUrl,
        });
        return;
      } catch (err) {
        // Fallback to share modal if user cancelled or system modal didn't launch
      }
    }
    setShowShareModal(true);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(`${shareText}\n${inviteUrl}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-[#0D0E15]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral border-t-transparent"></div>
          <p className="font-mono text-xs text-[#8F96A6] animate-pulse">Checking Rogue Milestone Progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0D0E15] text-[#E2E8F0] p-4 lg:p-8 pb-28 flex flex-col justify-center select-none">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* MAIN LOCKED HERO BANNER */}
        <div className="bg-[#141622] border border-[#232638] rounded-3xl p-5 sm:p-10 relative overflow-hidden shadow-xl space-y-5 text-center">
          
          {/* Subtle Ambient Glow Effect (Desktop Only) */}
          <div className="hidden sm:block absolute -top-24 -left-24 w-72 h-72 bg-coral/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* LOCK BADGE HEADER */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#181B28] border border-[#272A3C] text-coral text-xs font-semibold font-mono tracking-wide">
            <Lock className="w-3.5 h-3.5 text-coral" />
            FEATURE LOCKED 
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
               Discover  Unlocks at <span className="text-coral">1,000 Students</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#8F96A6] leading-relaxed">
              To ensure high-quality classmate matches without ghost profiles, Discover unlocks automatically when our university network hits <strong className="text-white">1,000 registered students</strong>.
            </p>
          </div>

          {/* PROGRESS BAR COUNTER CARD */}
          <div className="max-w-md mx-auto bg-[#0A0B10] border border-[#202334] p-5 rounded-2xl space-y-3 shadow-xl">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#8F96A6] flex items-center gap-1.5 font-bold">
                <Users className="w-4 h-4 text-teal" /> Registered Campus Members
              </span>
              <span className="text-white font-black text-sm">
                {currentUsersCount} <span className="text-[#8F96A6] font-normal">/ {requiredUsers}</span>
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full h-3 bg-[#181A28] rounded-full overflow-hidden p-0.5 border border-[#2B2E44]">
              <div
                style={{ width: `${Math.max(5, progressPercent)}%` }}
                className="h-full bg-gradient-to-r from-coral via-[#FF6B6B] to-teal rounded-full transition-all duration-1000 shadow-md"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-[#8F96A6]">
              <span>{progressPercent}% Milestone Reached</span>
              <span className="text-teal font-semibold">{(requiredUsers - currentUsersCount)} Registrations Needed</span>
            </div>
          </div>

          {/* SHARE / INVITE CTA */}
          <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-md mx-auto">
            <button
              onClick={handleInviteClick}
              className="w-full sm:w-auto px-5 py-3 bg-coral text-white font-bold text-xs rounded-xl hover:bg-coral-hover shadow-md shadow-coral/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" /> Invite Classmates to Unlock Faster
            </button>

            <button
              onClick={() => router.push('/rooms')}
              className="w-full sm:w-auto px-4 py-3 bg-[#0A0B10] border border-[#202334] text-[#CBD5E1] hover:text-white font-semibold text-xs rounded-xl hover:bg-[#181A28] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              Explore Chat Rooms <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* FEATURE SHOWCASE PREVIEW */}
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-coral" /> What You Can Do on Discover Once Unlocked
            </h2>
            <p className="text-xs text-[#8F96A6]">Preview the high-fidelity features being deployed at the 1,000 student milestone</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="bg-[#141622] border border-[#232638] p-5 rounded-2xl space-y-2.5 hover:border-coral/40 transition-colors shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-coral/15 border border-coral/30 flex items-center justify-center text-coral">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">AI Match Compatibility Engine</h3>
              <p className="text-xs text-[#8F96A6] leading-relaxed">
                Automatically calculates compatibility scores based on your branch, academic year, and shared campus interests.
              </p>
            </div>

            <div className="bg-[#141622] border border-[#232638] p-5 rounded-2xl space-y-2.5 hover:border-coral/40 transition-colors shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-teal/15 border border-teal/30 flex items-center justify-center text-teal">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">Swipe to Find People</h3>
              <p className="text-xs text-[#8F96A6] leading-relaxed">
                Swipe through portrait profiles with photos or browse profiles with instant branch filters.
              </p>
            </div>

            <div className="bg-[#141622] border border-[#232638] p-5 rounded-2xl space-y-2.5 hover:border-coral/40 transition-colors shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Sparkle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">Rogue Icebreakers</h3>
              <p className="text-xs text-[#8F96A6] leading-relaxed">
                Break the ice easily by replying directly to classmate prompts, favorite lofi tracks, and weekend project plans.
              </p>
            </div>

            <div className="bg-[#141622] border border-[#232638] p-5 rounded-2xl space-y-2.5 hover:border-coral/40 transition-colors shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">100% University Verified Peers</h3>
              <p className="text-xs text-[#8F96A6] leading-relaxed">
                Strict protection ensuring all profiles belong to authentic students registered with official college IDs.
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* SHARE OPTIONS MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141622] border border-[#232638] rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-[#8F96A6] hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-coral/15 border border-coral/30 flex items-center justify-center text-coral">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Invite Classmates</h3>
                <p className="text-xs text-[#8F96A6]">Help reach 1,000 students to unlock Discover</p>
              </div>
            </div>

            {/* SHARE PLATFORM BUTTONS */}
            <div className="grid grid-cols-1 gap-2.5">
              
              {/* WHATSAPP */}
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n${inviteUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-3.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/20 text-[#25D366] font-bold text-xs flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="w-4 h-4" /> Share on WhatsApp
                </div>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* TELEGRAM */}
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-3.5 rounded-xl bg-[#0088cc]/10 border border-[#0088cc]/30 hover:bg-[#0088cc]/20 text-[#0088cc] font-bold text-xs flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Send className="w-4 h-4" /> Share on Telegram
                </div>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* TWITTER / X */}
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(inviteUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-3.5 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-black text-sm">𝕏</span> Share on Twitter / X
                </div>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* DIRECT COPY LINK */}
              <button
                onClick={handleCopyLink}
                className="w-full p-3.5 rounded-xl bg-[#0A0B10] border border-[#202334] hover:bg-[#181A28] text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  {copiedLink ? <Check className="w-4 h-4 text-teal" /> : <Copy className="w-4 h-4 text-coral" />}
                  {copiedLink ? 'Link Copied to Clipboard!' : 'Copy Invitation Link'}
                </div>
                {copiedLink ? (
                  <span className="text-[10px] text-teal font-mono">Copied!</span>
                ) : (
                  <span className="text-[10px] text-[#8F96A6] font-mono">Click to Copy</span>
                )}
              </button>

            </div>

            <p className="text-[10px] text-center text-[#8F96A6]">
              Share in your official college WhatsApp group or class Discord server!
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
