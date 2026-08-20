'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, 
  MessageCircle, 
  Search, 
  Users, 
  MessageSquare, 
  Lock, 
  Flame, 
  Compass,
  Sparkles,
  ArrowRight,
  PanelLeft
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { getAvatarUrl } from '../../lib/avatar';
import { useUser } from '../../components/layout-wrapper';
import { Match, Room } from '@campusconnect/shared';
import { getBlockedUserIds } from '../../lib/block';

export default function ChatListPage() {
  const { user, demoLogin } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'dms' | 'squads'>('dms');
  const [matches, setMatches] = useState<Match[]>([]);
  const [squadRooms, setSquadRooms] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);

  const fetchChatData = async () => {
    try {
      const currentBlocked = getBlockedUserIds();
      setBlockedIds(currentBlocked);

      const [chatList, roomList] = await Promise.all([
        apiFetch('/api/matches').catch(() => []),
        apiFetch('/api/rooms').catch(() => [])
      ]);

      let finalMatches: Match[] = Array.isArray(chatList) ? chatList : [];

      // Check if URL query contains a targeted user message request e.g. ?user=user-123
      const targetUserId = searchParams.get('user');
      const targetUserName = searchParams.get('name') || '';
      const targetUserHandle = searchParams.get('handle') || '';

      if (targetUserId && targetUserId !== 'anonymous') {
        let existingMatch = finalMatches.find(m => m.other_user?.id === targetUserId);
        if (!existingMatch) {
          let realName = targetUserName ? decodeURIComponent(targetUserName) : '';
          let realHandle = targetUserHandle ? decodeURIComponent(targetUserHandle) : targetUserId;
          let realPhotos: string[] = [];

          try {
            const peerProfile = await apiFetch(`/api/users/${targetUserId}/profile`);
            if (peerProfile && peerProfile.user) {
              realName = peerProfile.user.name || realName;
              realHandle = peerProfile.user.handle || realHandle;
              realPhotos = peerProfile.user.photos || [];
            }
          } catch (e) {}

          const createdMatch: any = {
            id: `dm-${targetUserId}`,
            user_a_id: user?.id || 'student-demo-1',
            user_b_id: targetUserId,
            matched_at: new Date().toISOString(),
            other_user: {
              id: targetUserId,
              name: realName || 'Campus Peer',
              handle: realHandle,
              photos: realPhotos,
              college_verified: true
            }
          };
          finalMatches = [createdMatch as Match, ...finalMatches];
        }
      }

      setMatches(finalMatches);
      if (Array.isArray(roomList)) setSquadRooms(roomList);
    } catch (err: any) {
      console.error('Failed to load chats:', err);
      if (err?.message?.includes('401') || !user) {
        try {
          await demoLogin('student-demo-1');
        } catch (lErr) {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatData();
  }, [user]);

  const filteredMatches = matches.filter((m) => {
    if (!m.other_user || blockedIds.includes(m.other_user.id)) return false;
    const handleStr = (m.other_user as any).handle || '';
    return (
      m.other_user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      handleStr.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredSquads = squadRooms.filter((r) => {
    return (
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.topic && r.topic.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0F1015] min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral border-t-transparent"></div>
          <p className="font-sans text-xs text-text-muted animate-pulse">Loading Messages & Rooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-[calc(100vh-4.5rem)] bg-[#0F1015] overflow-hidden relative">
      
      {/* Touch outside backdrop overlay to close sidebar on mobile */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-10 md:hidden transition-opacity"
        />
      )}

      {/* ── CHAT SIDEBAR (DMs & Squad Rooms, Collapsible) ── */}
      {isSidebarOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="w-full md:w-80 lg:w-96 border-r border-[#1E202B] flex flex-col flex-shrink-0 bg-[#0F1015] transition-all z-20"
        >
          
          {/* Header & Tabs */}
          <div className="p-4 border-b border-[#1E202B] space-y-3 bg-[#12141D]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-coral" /> Chat
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="hidden md:flex p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-[#1C1F2B] transition-colors"
                  title="Close Sidebar"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* DM / Squad Tab Switcher */}
            <div className="flex p-1 bg-[#1A1D27] rounded-xl border border-[#232635]">
              <button
                onClick={() => setActiveTab('dms')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'dms'
                    ? 'bg-coral text-white shadow-md'
                    : 'text-[#8F96A6] hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> DMs ({matches.length})
              </button>
              <button
                onClick={() => setActiveTab('squads')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'squads'
                    ? 'bg-coral text-white shadow-md'
                    : 'text-[#8F96A6] hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Squads ({squadRooms.length})
              </button>
            </div>

            {/* Search Field */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder={activeTab === 'dms' ? 'Search direct messages...' : 'Search squad rooms...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#171922] border border-[#262936] focus:border-coral rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-text-muted outline-none transition-all"
              />
            </div>
          </div>

          {/* Scrollable Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#1E202B]/60">
            {activeTab === 'dms' ? (
              filteredMatches.length === 0 ? (
                <div className="text-center p-8 space-y-3">
                  <MessageCircle className="w-8 h-8 mx-auto text-[#8F96A6]/50 stroke-1" />
                  <p className="text-xs text-[#8F96A6]">No direct messages match your search.</p>
                </div>
              ) : (
                filteredMatches.map((match, idx) => {
                  const peer = match.other_user;
                  if (!peer) return null;
                  const hasUnread = idx === 0;
                  return (
                    <div
                      key={match.id}
                      onClick={() => router.push(`/chat/${match.id}`)}
                      className="p-3.5 hover:bg-[#171922] transition-colors flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#262936] overflow-hidden relative flex-shrink-0 border border-white/10">
                          <img src={getAvatarUrl(peer.photos)} alt={peer.name} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-teal rounded-full border-2 border-[#0F1015]"></span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-white group-hover:text-coral transition-colors truncate">
                            {peer.name}
                          </h4>
                          <p className={`text-[11px] truncate mt-0.5 ${hasUnread ? 'text-coral font-medium' : 'text-text-muted'}`}>
                            {hasUnread ? 'Hey! Are you around campus?' : 'See you later!'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                        <span className="text-[9px] font-mono text-text-muted">10:33 AM</span>
                        {hasUnread && (
                          <span className="w-4 h-4 rounded-full bg-coral text-white text-[9px] font-bold flex items-center justify-center">
                            1
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              filteredSquads.length === 0 ? (
                <div className="text-center p-8 space-y-3">
                  <Users className="w-8 h-8 mx-auto text-[#8F96A6]/50 stroke-1" />
                  <p className="text-xs text-[#8F96A6]">No squad rooms found.</p>
                </div>
              ) : (
                filteredSquads.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => router.push(`/rooms/${room.id}`)}
                    className="p-3.5 hover:bg-[#171922] transition-colors flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-[#1F2230] border border-[#262936] flex items-center justify-center flex-shrink-0 group-hover:border-coral transition-colors">
                        {room.is_private ? (
                          <Lock className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Users className="w-4 h-4 text-teal" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs text-white group-hover:text-coral transition-colors truncate">
                            {(room.name || 'Squad').replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F004}\u{1F0CF}⚡☕💻🎮🌙🍿🚗📚🍔🏸✨💬]/gu, '').trim()}
                          </h4>
                          {room.is_private && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-400/10 text-amber-400 text-[9px] font-mono">
                              Private
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted truncate mt-0.5">
                          {room.topic || 'Campus Squad Room'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                      <span className="text-[9px] font-mono text-teal bg-teal/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <Users className="w-2.5 h-2.5" /> {room.member_count || 1}
                      </span>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT (DESKTOP PLACEHOLDER WINDOW) ── */}
      <div 
        onClick={() => { if (isSidebarOpen) setIsSidebarOpen(false); }}
        className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-[#0B0C12] relative overflow-hidden text-center cursor-pointer"
      >
        {/* Toggle Sidebar Button when sidebar is closed */}
        {!isSidebarOpen && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }}
            className="absolute top-4 left-4 p-2.5 rounded-xl bg-[#141622] border border-[#262936] text-coral hover:text-white transition-all shadow-lg flex items-center gap-2 text-xs font-bold z-20 cursor-pointer"
          >
            <PanelLeft className="w-4 h-4" /> Open Sidebar
          </button>
        )}

        {/* Subtle decorative backdrop glow */}
        <div className="absolute w-96 h-96 bg-coral/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-md space-y-5 relative z-10" onClick={(e) => e.stopPropagation()}>
          <div className="w-16 h-16 rounded-3xl bg-[#141622] border border-[#232635] flex items-center justify-center mx-auto shadow-2xl">
            <MessageSquare className="w-8 h-8 text-coral animate-pulse" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Your Direct Messages & Squads</h3>
            <p className="text-xs text-[#8F96A6] leading-relaxed">
              Select a conversation from the sidebar to chat with classmates, share polls, or jump into squad rooms in real-time.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => router.push('/discover')}
              className="px-4 py-2.5 bg-coral hover:bg-coral-hover text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Compass className="w-4 h-4" /> Discover Peers
            </button>
            <button
              onClick={() => router.push('/rooms')}
              className="px-4 py-2.5 bg-[#171922] hover:bg-[#202330] border border-[#262936] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4 text-teal" /> Explore Rooms
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
