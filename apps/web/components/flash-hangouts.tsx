'use client';

import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useRouter } from 'next/navigation';
import { 
  Zap, 
  Plus, 
  MapPin, 
  Clock, 
  Users, 
  X, 
  MessageSquare,
  Check,
  Share2,
  Copy,
  Download,
  Flame,
  ExternalLink,
  MessageCircle,
  Instagram
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { getAvatarUrl } from '../lib/avatar';
import { useUser } from './layout-wrapper';
import PostActionMenu from './post-action-menu';

export interface FlashHangout {
  id: string;
  room_id: string;
  creator_id: string;
  creator_name: string;
  creator_handle?: string;
  creator_photo?: string;
  creator_tag?: string;
  title: string;
  location: string;
  max_participants: number;
  joined_user_ids: string[];
  joined_members?: Array<{ id: string; name: string; photo?: string; handle?: string }>;
  expires_at: string;
  created_at: string;
  category_label?: string;
  durationMinutes?: number;
}

export default function FlashHangoutsSection() {
  const { user, demoLogin } = useUser();
  const router = useRouter();

  const [hangouts, setHangouts] = useState<FlashHangout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinLoadingId, setJoinLoadingId] = useState<string | null>(null);

  // Live Ticking Timestamp (updates every 1s)
  const [now, setNow] = useState<number>(Date.now());

  // Share Modal State
  const [activeShareHangout, setActiveShareHangout] = useState<FlashHangout | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedIgLink, setCopiedIgLink] = useState(false);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('blocked_users') || '[]');
      setBlockedUserIds(saved);
    } catch (e) {}
  }, []);

  const handleUserBlocked = (userId: string) => {
    setBlockedUserIds(prev => [...prev, userId]);
  };

  // Form State
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [maxParticipants, setMaxParticipants] = useState<number>(4);
  const [durationMinutes, setDurationMinutes] = useState<number>(120);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchHangouts = async () => {
    try {
      const data = await apiFetch('/api/rooms/hangouts');
      if (data && Array.isArray(data)) {
        setHangouts(data);
      }
    } catch (err: any) {
      console.error('Failed to load flash hangouts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHangouts();
    // Refresh API every 20s
    const apiInterval = setInterval(fetchHangouts, 20000);
    // Ticking clock every 1s for real-time countdown
    const timerInterval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(apiInterval);
      clearInterval(timerInterval);
    };
  }, []);

  const POSTERS = [
    '/posters/poster-1.jpg',
    '/posters/poster-2.jpg',
    '/posters/poster-3.jpg'
  ];

  const getPosterForHangout = (hangoutId: string) => {
    let sum = 0;
    for (let i = 0; i < hangoutId.length; i++) {
      sum += hangoutId.charCodeAt(i);
    }
    return POSTERS[sum % POSTERS.length];
  };

  const handleShareClick = (hangout: FlashHangout, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveShareHangout(hangout);
    setCopiedLink(false);
    setCopiedIgLink(false);
  };

  const getShareUrl = (roomId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    return `${origin}/rooms/${roomId}`;
  };

  const handleCopyLink = (hangout: FlashHangout) => {
    const url = getShareUrl(hangout.room_id);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyIgLink = (hangout: FlashHangout) => {
    const url = getShareUrl(hangout.room_id);
    navigator.clipboard.writeText(url);
    setCopiedIgLink(true);
    setTimeout(() => setCopiedIgLink(false), 2500);
  };

  const handleWhatsAppShare = (hangout: FlashHangout) => {
    const url = getShareUrl(hangout.room_id);
    const text = encodeURIComponent(
      `⚡ FLASH MEETUP ON ROGUE CAMPUS:\n\n` +
      `"${hangout.title}"\n` +
      `📍 Location: ${hangout.location}\n` +
      `⏱️ Expiring soon! Join our group chat here:\n${url}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const cardPreviewRef = useRef<HTMLDivElement>(null);

  // High-Res Image Download via html2canvas to guarantee 100% exact UI match
  const handleDownloadIgStoryCard = async (hangout: FlashHangout) => {
    if (!cardPreviewRef.current) return;
    setIsGeneratingCard(true);
    try {
      const canvas = await html2canvas(cardPreviewRef.current, {
        scale: 4, // 1120px+ Ultra HD quality export
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0E0F14',
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `rogue-invite-${hangout.id.substring(0, 6)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate IG Story image:', err);
    } finally {
      setIsGeneratingCard(false);
    }
  };

  const handleJoinHangout = async (hangout: FlashHangout) => {
    const currentUserId = user?.id || 'student-demo-1';
    const isJoined = hangout.joined_user_ids?.includes(currentUserId) || hangout.creator_id === currentUserId;
    const isFull = (hangout.joined_user_ids?.length || 0) >= hangout.max_participants;

    if (isFull && !isJoined) {
      alert(`This Flash Meetup is full (limit of ${hangout.max_participants} members reached).`);
      return;
    }

    setJoinLoadingId(hangout.id);
    try {
      if (!user) {
        window.dispatchEvent(new CustomEvent('require-auth'));
        setJoinLoadingId(null);
        return;
      }
      await apiFetch(`/api/rooms/hangouts/${hangout.id}/join`, { method: 'POST' });
      router.push(`/rooms/${hangout.room_id}`);
    } catch (err: any) {
      alert(err.message || 'Unable to join room. Limit reached.');
    } finally {
      setJoinLoadingId(null);
    }
  };

  const handleCreateHangout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !location.trim()) return;

    if (!user) {
      window.dispatchEvent(new CustomEvent('require-auth'));
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        title: title.trim(),
        location: location.trim(),
        maxParticipants,
        durationMinutes
      };

      const newHangout = await apiFetch('/api/rooms/hangouts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (newHangout && newHangout.room_id) {
        setShowCreateModal(false);
        setTitle('');
        setLocation('');
        await fetchHangouts();
        router.push(`/rooms/${newHangout.room_id}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to post Flash Request');
    } finally {
      setCreateLoading(false);
    }
  };

  // Real-time Live Ticking Countdown string
  const getRemainingTimeData = (expiresAt: string) => {
    const diffMs = new Date(expiresAt).getTime() - now;
    if (diffMs <= 0) {
      return { text: 'Expired', isUrgent: false, isExpired: true };
    }
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const isUrgent = totalSecs < 15 * 60; // under 15 minutes left

    if (hrs > 0) {
      return {
        text: `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`,
        isUrgent,
        isExpired: false
      };
    }
    return {
      text: `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`,
      isUrgent,
      isExpired: false
    };
  };

  // Active (non-expired and non-blocked) hangouts
  const activeHangouts = hangouts.filter(h => {
    const timeData = getRemainingTimeData(h.expires_at);
    return !timeData.isExpired && !blockedUserIds.includes(h.creator_id);
  });

  return (
    <div className="space-y-4">
      {/* SECTION HEADER & DROP REQUEST TRIGGER */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-[#202330]">
        <div>
          <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
            Flash Meetups
          </h2>
          <p className="text-xs text-[#8F96A6]">
            Short-lived campus meetups with instant group chats.
          </p>
        </div>

        <button
          onClick={() => {
            if (!user) {
              window.dispatchEvent(new CustomEvent('require-auth'));
              return;
            }
            setShowCreateModal(true);
          }}
          className="px-3.5 py-2 bg-coral hover:bg-coral-hover text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create Room</span>
        </button>
      </div>

      {/* FLASH HANGOUTS GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-[#161822] animate-pulse border border-[#202330]"></div>
          ))}
        </div>
      ) : activeHangouts.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#161822] border border-[#202330] text-center space-y-2">
          <Zap className="w-8 h-8 text-coral mx-auto opacity-80" />
          <h4 className="font-bold text-sm text-white">No active meetups right now</h4>
          <p className="text-xs text-[#8F96A6] max-w-sm mx-auto">
            Be the first student to create a meetup room! Connect with peers on campus right now.
          </p>
          <button
            onClick={() => {
              if (!user) {
                window.dispatchEvent(new CustomEvent('require-auth'));
                return;
              }
              setShowCreateModal(true);
            }}
            className="mt-2 px-4 py-2 bg-[#1F2230] hover:bg-coral/20 text-coral border border-coral/40 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Create Room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeHangouts.map((hangout) => {
            const currentUserId = user?.id || 'student-demo-1';
            const isJoined = hangout.joined_user_ids?.includes(currentUserId) || hangout.creator_id === currentUserId;
            const isFull = (hangout.joined_user_ids?.length || 0) >= hangout.max_participants;
            const isHost = hangout.creator_id === currentUserId;
            const timeData = getRemainingTimeData(hangout.expires_at);

            return (
              <div
                key={hangout.id}
                className="bg-[#161822] border border-[#202330] hover:border-coral/50 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all shadow-md group"
              >
                {/* Top Badge Row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-coral/10 border border-coral/20 text-coral text-[10px] font-bold uppercase font-mono">
                    {hangout.category_label || 'Flash Meetup'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleShareClick(hangout, e)}
                      className="p-1.5 rounded-lg bg-[#202330] hover:bg-coral/20 text-[#8F96A6] hover:text-coral transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                      title="Share Request to WhatsApp or IG Story"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Share</span>
                    </button>

                    {/* LIVE TICKING REAL-TIME TIMER BADGE */}
                    <span className={`text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all ${
                      timeData.isUrgent
                        ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 animate-pulse'
                        : 'bg-[#1C1F2D] border border-[#2B2F42] text-[#8F96A6]'
                    }`}>
                      {timeData.isUrgent ? <Flame className="w-3 h-3 text-rose-400 shrink-0" /> : <Clock className="w-3 h-3 text-[#8F96A6] shrink-0" />}
                      <span>{timeData.text}</span>
                    </span>

                    {/* 3-DOT MORE ACTIONS MENU (DELETE, MESSAGE, REPORT, BLOCK) */}
                    <PostActionMenu
                      creatorId={hangout.creator_id}
                      creatorName={hangout.creator_name}
                      creatorHandle={hangout.creator_tag}
                      contentId={hangout.id}
                      contentType="flash_hangout"
                      onUserBlocked={handleUserBlocked}
                      onPostDeleted={(id) => setHangouts(prev => prev.filter(h => h.id !== id))}
                    />
                  </div>
                </div>

                {/* Title & Location */}
                <div className="space-y-2">
                  <h3 className="font-bold text-sm text-[#F2F3F5] leading-snug group-hover:text-white transition-colors">
                    {hangout.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-teal font-medium">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-teal" />
                    <span className="truncate">{hangout.location}</span>
                  </div>
                </div>

                {/* Host & Attendees Footer */}
                <div className="pt-3 border-t border-[#202330] flex items-center justify-between gap-3 mt-auto">
                  
                  {/* Host Info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={getAvatarUrl(hangout.creator_photo)}
                      alt={hangout.creator_name}
                      className="w-7 h-7 rounded-full object-cover border border-[#2D3143] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {hangout.creator_name}
                      </div>
                      <div className="text-[10px] text-[#8F96A6] truncate font-mono">
                        {hangout.creator_tag || 'Campus Student'}
                      </div>
                    </div>
                  </div>

                  {/* Join Action Button */}
                  <button
                    onClick={() => handleJoinHangout(hangout)}
                    disabled={joinLoadingId === hangout.id}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm ${
                      isHost
                        ? 'bg-coral/20 border border-coral/40 text-coral hover:bg-coral hover:text-white'
                        : isJoined
                        ? 'bg-teal/20 border border-teal/40 text-teal hover:bg-teal hover:text-ink'
                        : isFull
                        ? 'bg-[#1F2230] text-[#8F96A6] border border-[#2D3143]'
                        : 'bg-coral hover:bg-coral-hover text-white hover:scale-[1.02]'
                    }`}
                  >
                    {joinLoadingId === hangout.id ? (
                      <span>Joining...</span>
                    ) : isHost ? (
                      <>
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Your Room</span>
                      </>
                    ) : isJoined ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Joined • Chat</span>
                      </>
                    ) : isFull ? (
                      <>
                        <Users className="w-3.5 h-3.5" />
                        <span>Full ({hangout.joined_user_ids?.length || 1}/{hangout.max_participants})</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-white text-white" />
                        <span>Join & Chat ({hangout.joined_user_ids?.length || 1}/{hangout.max_participants})</span>
                      </>
                    )}
                  </button>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CREATE A MEETUP ROOM */}
      {showCreateModal && (
        <div 
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#161822] border border-[#202330] rounded-2xl p-6 relative shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto scrollbar-thin"
          >
            
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-2 text-[#8F96A6] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Create a Meetup Room</h3>
              <p className="text-xs text-[#8F96A6]">
                Post a time-bound campus meetup. Clicking join automatically opens your group chat room!
              </p>
            </div>

            {/* FORM */}
            <form onSubmit={handleCreateHangout} className="space-y-4">
              
              {/* Title Input */}
              <div>
                <label className="block text-xs font-semibold text-[#8F96A6] mb-1.5 uppercase">
                  Meetup Title / Topic
                </label>
                <input
                  type="text"
                  placeholder="e.g. At Library 2nd floor, need a study partner for Math quiz..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0E0F14] border border-[#202330] focus:border-coral rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                  required
                />
              </div>

              {/* Location Input */}
              <div>
                <label className="block text-xs font-semibold text-[#8F96A6] mb-1.5 uppercase">
                  Campus Spot / Location
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-teal absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="e.g. Central Library 2nd Fl, Main Canteen, Sports Complex..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-[#0E0F14] border border-[#202330] focus:border-teal rounded-xl py-2.5 pl-9 pr-3 text-xs text-white outline-none"
                    required
                  />
                </div>
              </div>

              {/* Group Size & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#8F96A6] mb-1.5 uppercase">Target Group Size</label>
                  <select
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-full bg-[#0E0F14] border border-[#202330] focus:border-coral rounded-xl py-2.5 px-3 text-xs text-white outline-none"
                  >
                    <option value={2}>2 People (1-on-1)</option>
                    <option value={5}>5 People (Group)</option>
                    <option value={10}>10 People (Large Group)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8F96A6] mb-1.5 uppercase">Auto-Expire Duration</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full bg-[#0E0F14] border border-[#202330] focus:border-coral rounded-xl py-2.5 px-3 text-xs text-white outline-none"
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={60}>1 Hour</option>
                    <option value={120}>2 Hours (Default)</option>
                    <option value={240}>4 Hours</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#13151F] border border-[#202330] text-[11px] text-[#8F96A6] flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-coral shrink-0" />
                <span>Expires in {durationMinutes} mins • Room & messages auto-cleanup on expiration</span>
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="w-full py-3 bg-coral hover:bg-coral-hover text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {createLoading ? (
                  <span>Creating Room...</span>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Create Room</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSTANT WHATSAPP & IG STORY SHARING CARDS */}
      {activeShareHangout && (
        <div 
          onClick={() => setActiveShareHangout(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[340px] sm:max-w-md md:max-w-2xl bg-[#161822] border border-[#202330] rounded-2xl p-4 md:p-6 relative shadow-2xl max-h-[85vh] overflow-y-auto scrollbar-thin space-y-3 md:space-y-0"
          >
            <button
              onClick={() => setActiveShareHangout(null)}
              className="absolute top-3.5 right-3.5 p-1.5 text-[#8F96A6] hover:text-white cursor-pointer z-20 bg-[#202330]/50 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            {/* 2-COLUMN GRID ON LAPTOP / DESKTOP SCREEN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 items-center">
              
              {/* LEFT COLUMN: LIVE STYLED PREVIEW CARD WITH CRISP POSTER */}
              <div 
                ref={cardPreviewRef}
                className="relative w-full max-w-[250px] md:max-w-none mx-auto aspect-[9/13] bg-[#0E0F14] border border-coral/40 rounded-2xl p-3.5 md:p-5 flex flex-col justify-between shadow-2xl overflow-hidden group"
              >
                {/* Vibrant Bold Poster Background */}
                <img
                  src={getPosterForHangout(activeShareHangout.id)}
                  alt="Poster Background"
                  className="absolute inset-0 w-full h-full object-cover opacity-90 scale-105 pointer-events-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30 pointer-events-none"></div>

                {/* Card Header */}
                <div className="relative z-10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-coral tracking-wider font-mono flex items-center gap-1.5 drop-shadow-md">
                      <img src="/rogue-logo.png" alt="Rogue Logo" className="w-5 h-5 object-contain" />
                      <span>ROGUE</span>
                    </span>
                    <span className="text-[9px] font-mono text-white/90 uppercase bg-black/60 px-2 py-0.5 rounded border border-white/20">
                      Flash Meetup
                    </span>
                  </div>
                  <div className="h-0.5 w-full bg-coral/40"></div>
                </div>

                {/* Card Main Details */}
                <div className="relative z-10 space-y-2.5 my-auto bg-black/60 backdrop-blur-md p-3.5 md:p-4 rounded-xl border border-white/10 shadow-lg">
                  <h4 className="text-base md:text-lg font-black text-white leading-tight drop-shadow-md">
                    "{activeShareHangout.title}"
                  </h4>

                  <div className="flex items-center gap-1.5 text-xs text-teal font-bold">
                    <MapPin className="w-3.5 h-3.5 text-teal" />
                    <span>{activeShareHangout.location}</span>
                  </div>
                </div>

                {/* Card Footer Sticker Callout */}
                <div className="relative z-10 pt-2 space-y-1.5">
                  <div className="text-[10px] text-white/90 font-mono font-bold drop-shadow">
                    Hosted by @{activeShareHangout.creator_handle || activeShareHangout.creator_name.toLowerCase().replace(/\s+/g, '')}
                  </div>
                  <div className="w-full py-1.5 px-2 bg-coral hover:bg-coral-hover text-white text-[9px] sm:text-[10px] font-black rounded-lg text-center shadow-md uppercase tracking-wider flex items-center justify-center gap-1 border border-white/20">
                    <ExternalLink className="w-2.5 h-2.5" /> Tap Link Sticker to Join Chat
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: HEADER & ACTION BUTTONS */}
              <div className="space-y-4 flex flex-col justify-center">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Share Invite Card</h3>
                  <p className="text-xs text-[#8F96A6]">
                    Export Instagram Story card or share to WhatsApp groups.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {/* 1. PRIMARY ACTIONS: WHATSAPP & IG STORY CARD */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleWhatsAppShare(activeShareHangout)}
                      className="py-2.5 px-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={() => handleDownloadIgStoryCard(activeShareHangout)}
                      disabled={isGeneratingCard}
                      className="py-2.5 px-3 bg-gradient-to-r from-purple-500/15 via-pink-500/15 to-coral/15 hover:from-purple-500/25 hover:to-coral/25 border border-pink-500/30 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Instagram className="w-4 h-4 text-pink-400 shrink-0" />
                      <span className="truncate">{isGeneratingCard ? 'Exporting...' : 'IG Story Card'}</span>
                    </button>
                  </div>

                  {/* 2. SECONDARY LINK COPY BUTTONS */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      onClick={() => handleCopyIgLink(activeShareHangout)}
                      className="py-2 px-2.5 bg-[#1A1C28] hover:bg-[#232738] border border-[#2A2E40] text-[#A0A6B8] hover:text-white text-[11px] font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      {copiedIgLink ? (
                        <span className="text-teal font-mono text-[10px] font-bold">Sticker Copied!</span>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#A0A6B8]" />
                          <span className="truncate">IG Link Sticker</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleCopyLink(activeShareHangout)}
                      className="py-2 px-2.5 bg-[#1A1C28] hover:bg-[#232738] border border-[#2A2E40] text-[#A0A6B8] hover:text-white text-[11px] font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      {copiedLink ? (
                        <span className="text-teal font-mono text-[10px] font-bold">Link Copied!</span>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#A0A6B8]" />
                          <span className="truncate">Direct Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
