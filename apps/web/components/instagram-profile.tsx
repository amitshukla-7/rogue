'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  MessageCircle, 
  Sparkles, 
  ShieldCheck, 
  X,
  Edit2,
  Share2,
  Check,
  Link as LinkIcon,
  Settings,
  LogOut,
  Flame,
  Ban
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { getAvatarUrl } from '../lib/avatar';
import { Post, FoundingBadge as FoundingBadgeType } from '@campusconnect/shared';
import FoundingBadge from './founding-badge';
import BlockedUsersModal from './blocked-users-modal';

interface ProfileUser {
  id: string;
  name: string;
  handle: string;
  email?: string;
  bio?: string | null;
  branch?: string | null;
  year?: string | null;
  photos: string[];
  college_verified?: boolean;
  founding_badge?: FoundingBadgeType | null;
  interests?: any[];
  prompts?: any[];
  posts_count: number;
}

interface InstagramProfileProps {
  userId: string;
  isSelf?: boolean;
  currentUserId?: string;
  onEditProfile?: () => void;
  onLogout?: () => void;
}

export const DEFAULT_INSTA_AVATAR = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' fill='%23262626'><circle cx='64' cy='64' r='64'/><path fill='%238E8E8E' d='M64 28a24 24 0 1 0 0 48 24 24 0 0 0 0-48zM32 108a32 32 0 0 1 64 0H32z'/></svg>`;

export default function InstagramProfile({ userId, isSelf = false, currentUserId, onEditProfile, onLogout }: InstagramProfileProps) {
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'grid' | 'feed' | 'about'>('grid');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);

  // Fetch profile
  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/users/${userId}/profile`);
      if (data && data.user) {
        setProfileUser(data.user);
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyProfileLink = async () => {
    const profileUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/profile/${profileUser?.id || userId}`
      : '';

    // Check for native mobile share sheet (iOS / Android / Instagram / WhatsApp)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${profileUser?.name || 'Rogue User'} on Rogue`,
          text: `Check out @${handle} on Rogue campus network!`,
          url: profileUrl || window.location.href,
        });
        return;
      } catch (e) {
        // User cancelled share sheet or share failed; proceed to fallback copy
      }
    }

    // Clipboard copy fallback (handles http / restricted contexts)
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(profileUrl || window.location.href);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = profileUrl || window.location.href;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Failed to copy profile link:', err);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleVotePost = async (postId: string, voteType: 'up' | 'down') => {
    try {
      const res = await apiFetch(`/api/posts/${postId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote: voteType })
      });
      if (res && res.post) {
        setPosts(prev => prev.map(p => p.id === postId ? res.post : p));
        if (selectedPost && selectedPost.id === postId) {
          setSelectedPost(res.post);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Vote failed');
    }
  };

  const handlePollVotePost = async (postId: string, optionId: string) => {
    try {
      const res = await apiFetch(`/api/posts/${postId}/poll/vote`, {
        method: 'POST',
        body: JSON.stringify({ option_id: optionId })
      });
      if (res && res.post) {
        setPosts(prev => prev.map(p => p.id === postId ? res.post : p));
        if (selectedPost && selectedPost.id === postId) {
          setSelectedPost(res.post);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Poll vote failed');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !newCommentText.trim()) return;
    setSubmittingComment(true);

    try {
      const res = await apiFetch(`/api/posts/${selectedPost.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: newCommentText })
      });

      if (res && res.comment) {
        const updatedComments = [...(selectedPost.comments || []), res.comment];
        const updatedPost = {
          ...selectedPost,
          comment_count: updatedComments.length,
          comments: updatedComments
        };
        setSelectedPost(updatedPost);
        setPosts(prev => prev.map(p => p.id === selectedPost.id ? updatedPost : p));
        setNewCommentText('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-[#8F96A6]">
        <div className="w-8 h-8 rounded-full border-2 border-coral border-t-transparent animate-spin"></div>
        <p className="text-xs font-mono">Loading profile...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="p-12 text-center text-[#8F96A6]">
        <p className="text-sm">User profile not found.</p>
      </div>
    );
  }

  const handle = profileUser.handle || 'user';

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 md:py-8 pb-24 text-white">

      {/* ── TOP INSTAGRAM HEADER BAR (Single Settings Wheel at Top Right) ── */}
      <div className="flex items-center justify-between pb-3 mb-6 border-b border-[#202330]">
        <div className="flex items-center gap-2 font-bold text-base md:text-lg tracking-tight">
          <span>@{handle}</span>
          {profileUser.college_verified && (
            <ShieldCheck className="w-4.5 h-4.5 text-teal" />
          )}
        </div>

        {isSelf && (
          <button 
            onClick={() => setShowSettingsModal(true)} 
            className="text-[#8F96A6] hover:text-white p-2 rounded-xl hover:bg-[#1D202D] transition-colors cursor-pointer" 
            title="Settings & Options"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── MAIN INSTAGRAM PROFILE HEADER BLOCK ── */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-12 mb-8">
        
        {/* Clean Avatar Without Gradient Story Ring */}
        <div className="relative shrink-0">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-2 border-[#202330] overflow-hidden bg-[#151722] shadow-xl">
            <img
              src={getAvatarUrl(profileUser.photos)}
              alt={profileUser.name}
              className="w-full h-full object-cover"
            />
          </div>
          {profileUser.college_verified && (
            <span className="absolute bottom-1 right-1 bg-teal text-ink p-1 rounded-full border-2 border-[#0D0E15]" title="Verified College Student">
              <ShieldCheck className="w-4 h-4" />
            </span>
          )}
        </div>

        {/* User Info & Stats */}
        <div className="flex-1 min-w-0 w-full space-y-4 text-center md:text-left">
          
          {/* Row 1: Username & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">{profileUser.name}</h1>
              <FoundingBadge badge={profileUser.founding_badge} size="md" />
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              {isSelf ? (
                <>
                  <button
                    onClick={onEditProfile}
                    className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-[#1D202D] hover:bg-[#282C3F] border border-[#2D3247] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit profile
                  </button>
                  <button
                    onClick={handleCopyProfileLink}
                    className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-[#1D202D] hover:bg-[#282C3F] border border-[#2D3247] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Share Profile"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-teal" />
                        <span className="text-teal font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-white" />
                        <span>Share profile</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <Link
                  href="/chat"
                  className="px-5 py-2 rounded-xl bg-coral hover:bg-coral-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-coral/20 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-white" /> Message
                </Link>
              )}
            </div>
          </div>

          {/* Row 3: Bio & Metadata */}
          <div className="space-y-1 text-xs text-left">
            <p className="font-mono text-coral font-semibold">
              @{handle}
              {(profileUser.branch && profileUser.branch !== 'CSE Student' && profileUser.branch !== 'Student') ? ` • ${profileUser.branch}` : ''}
              {profileUser.year ? ` (${profileUser.year})` : ''}
            </p>
            {profileUser.bio && profileUser.bio.trim() !== '' && (
              <p className="text-[#E2E8F0] whitespace-pre-line leading-relaxed font-normal">
                {profileUser.bio}
              </p>
            )}
          </div>

        </div>
      </div>

      {/* ── ABOUT & INTERESTS CARD ── */}
      {((profileUser.interests && profileUser.interests.length > 0) || isSelf) && (
        <div className="bg-[#14151D] border border-[#202330] rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-coral font-bold">Interests & Tags</h3>
              {isSelf && (
                <button
                  onClick={onEditProfile}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#1F2230] hover:bg-[#282C3F] border border-[#202330] text-coral hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit About
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {profileUser.interests && profileUser.interests.length > 0 ? (
                profileUser.interests.map((interest: any) => (
                  <span
                    key={interest.id || interest.name}
                    className="px-3.5 py-1.5 rounded-xl bg-[#1F2230] border border-[#202330] text-xs font-medium text-white flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3 h-3 text-coral" /> {interest.name}
                  </span>
                ))
              ) : isSelf ? (
                <p className="text-xs text-[#8F96A6]">No specific interests added yet. Click edit to add your interests!</p>
              ) : null}
            </div>
          </div>

          {profileUser.prompts && profileUser.prompts.length > 0 && (
            <div className="border-t border-[#202330] pt-6">
              <h3 className="text-xs font-mono uppercase tracking-wider text-teal font-bold mb-3">About You</h3>
              <div className="space-y-3">
                {profileUser.prompts.map((prompt: any, i: number) => (
                  <div key={i} className="p-4 rounded-xl bg-[#0E0F14] border border-[#202330]">
                    <p className="text-xs text-[#E2E8F0] leading-relaxed font-medium">
                      {prompt.answer || prompt.question}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── INSTAGRAM SETTINGS & OPTIONS MODAL ── */}
      {showSettingsModal && (
        <div 
          onClick={() => setShowSettingsModal(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#14151D] border border-[#202330] w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl cursor-default"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#202330]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-coral" /> Options
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-[#8F96A6] hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  onEditProfile?.();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#1D202D] text-xs font-semibold text-white transition-colors text-left cursor-pointer"
              >
                <Edit2 className="w-4 h-4 text-coral" />
                <span>Edit Profile</span>
              </button>

              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowBlockedModal(true);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#1D202D] text-xs font-semibold text-white transition-colors text-left cursor-pointer"
              >
                <Ban className="w-4 h-4 text-rose-400" />
                <span>Blocked Accounts</span>
              </button>

              <div className="border-t border-[#202330] my-2 pt-2">
                {onLogout && (
                  <button
                    onClick={() => {
                      setShowSettingsModal(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-rose-500/10 text-xs font-bold text-rose-400 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Accounts Modal */}
      <BlockedUsersModal
        isOpen={showBlockedModal}
        onClose={() => setShowBlockedModal(false)}
      />

      {/* Copied Link Toast Banner */}
      {copiedLink && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#151722] border border-teal/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-bounce">
          <Check className="w-4 h-4 text-teal" />
          <span>Profile link copied to clipboard! 📋</span>
        </div>
      )}

    </div>
  );
}
