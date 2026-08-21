'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Send, 
  Search, 
  Phone, 
  Video, 
  ShieldAlert,
  Image as ImageIcon,
  Trash2,
  Copy,
  X,
  User,
  Flag
} from 'lucide-react';
import { MessageCircle, Users, MessageSquare, Lock, Check, CheckCheck, PanelLeft, MoreVertical } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { getAvatarUrl } from '../../../lib/avatar';
import { getSocket } from '../../../lib/socket';
import { useUser } from '../../../components/layout-wrapper';
import { Match, Message, Room } from '@campusconnect/shared';
import { blockUser, isUserBlocked } from '../../../lib/block';

// Media gallery thumbnails from reference image mockup
const MEDIA_THUMBNAILS = [
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=120&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=120&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=120&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=120&auto=format&fit=crop&q=60'
];

export default function ChatDetailPage() {
  const { matchId } = useParams() as { matchId: string };
  const { user, demoLogin } = useUser();
  const router = useRouter();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'dms' | 'squads'>('dms');
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [squadRooms, setSquadRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);

  // Instagram-style message menu modal state
  const [msgMenu, setMsgMenu] = useState<{ msgId: string; isMe: boolean; senderId: string; content: string; sentAt?: string } | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleMsgOpenMenu = (msg: Message, isMe: boolean, targetElem?: HTMLElement | null, clickX?: number, clickY?: number) => {
    let top = 200;
    let left = 20;
    const dropdownHeight = 220;
    const dropdownWidth = 224;

    if (clickX !== undefined && clickY !== undefined && clickX > 0) {
      top = (clickY + dropdownHeight > window.innerHeight - 20)
        ? Math.max(10, clickY - dropdownHeight - 4)
        : clickY + 4;

      left = isMe
        ? Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, clickX - dropdownWidth + 20))
        : Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, clickX - 10));
    } else if (targetElem) {
      const rect = targetElem.getBoundingClientRect();

      if (rect.bottom + dropdownHeight > window.innerHeight - 20) {
        top = Math.max(10, rect.top - dropdownHeight - 4);
      } else {
        top = Math.max(10, rect.bottom + 4);
      }

      if (isMe) {
        left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, rect.right - dropdownWidth));
      } else {
        left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, rect.left));
      }
    } else {
      left = isMe ? Math.max(10, window.innerWidth - 240) : 20;
      top = Math.max(10, window.innerHeight - 280);
    }

    setMenuPos({ top, left });
    setMsgMenu({
      msgId: msg.id,
      isMe,
      senderId: msg.sender_id,
      content: msg.content,
      sentAt: msg.sent_at
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(30); } catch (e) {}
    }
  };

  const socket = getSocket();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    const loadChatData = async () => {
      try {
        const [chatList, roomList] = await Promise.all([
          apiFetch('/api/matches').catch(() => []),
          apiFetch('/api/rooms').catch(() => [])
        ]);

        let matchesArr: Match[] = Array.isArray(chatList) ? chatList : [];
        let current = matchesArr.find((m: Match) => m.id === matchId);

        let targetPeerId = current?.other_user?.id;
        if (!targetPeerId && matchId.startsWith('dm-')) {
          targetPeerId = matchId.replace('dm-', '');
        }

        if (targetPeerId) {
          try {
            const peerProfile = await apiFetch(`/api/users/${targetPeerId}/profile`);
            if (peerProfile && peerProfile.user) {
              const u = peerProfile.user;
              current = {
                id: matchId,
                user_a_id: user?.id || 'student-demo-1',
                user_b_id: targetPeerId,
                matched_at: new Date().toISOString(),
                other_user: {
                  id: u.id,
                  name: u.name,
                  handle: u.handle || u.name.toLowerCase().replace(/\s+/g, '_'),
                  photos: u.photos || [],
                  branch: u.branch || 'Campus Student',
                  year: u.year || '',
                  college_verified: u.college_verified ?? true
                }
              } as any;

              const exIdx = matchesArr.findIndex((m: Match) => m.id === matchId);
              if (exIdx >= 0) {
                matchesArr[exIdx] = current as Match;
              } else {
                matchesArr = [current as Match, ...matchesArr];
              }
            }
          } catch (e) {}
        }

        if (matchesArr) setAllMatches(matchesArr);
        if (current) setActiveMatch(current);
        if (roomList) setSquadRooms(roomList);

        let msgHistory: Message[] = [];
        try {
          const fetchedMsgs = await apiFetch(`/api/messages/${matchId}`);
          if (Array.isArray(fetchedMsgs)) msgHistory = fetchedMsgs;
        } catch (e) {}

        // Combine with locally stored messages for persistent DM testing
        try {
          const storedMsgs = JSON.parse(localStorage.getItem(`msgs_${matchId}`) || '[]');
          if (Array.isArray(storedMsgs) && storedMsgs.length > 0) {
            msgHistory = [...msgHistory, ...storedMsgs];
          }
        } catch (e) {}

        setMessages(msgHistory);
      } catch (err: any) {
        console.error('Failed to load chat:', err);
        if (err?.message?.includes('401') || !user) {
          try {
            await demoLogin('student-demo-1');
          } catch (lErr) {}
        }
      } finally {
        setLoading(false);
      }
    };

    loadChatData();

    socket.connect();
    socket.emit('chat:join', { matchId });

    const handleIncomingMessage = (data: { matchId: string; message: Message }) => {
      if (data.matchId === matchId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setTimeout(scrollToBottom, 50);
      }
    };

    const handlePeerTypingStatus = (data: { matchId: string; isTyping: boolean; userId: string }) => {
      if (data.matchId === matchId && data.userId !== user?.id) {
        setIsPeerTyping(data.isTyping);
      }
    };

    socket.on('chat:message:receive', handleIncomingMessage);
    socket.on('chat:typing', handlePeerTypingStatus);

    return () => {
      socket.off('chat:message:receive', handleIncomingMessage);
      socket.off('chat:typing', handlePeerTypingStatus);
    };
  }, [matchId, socket, user]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      match_id: matchId,
      sender_id: user?.id || 'student-demo-1',
      content: messageText.trim(),
      sent_at: new Date().toISOString()
    };

    // Emit socket event
    socket.emit('chat:message:send', {
      matchId,
      content: messageText.trim()
    });

    // Append to local state and local storage for instant update
    setMessages(prev => [...prev, newMsg]);
    try {
      const stored = JSON.parse(localStorage.getItem(`msgs_${matchId}`) || '[]');
      stored.push(newMsg);
      localStorage.setItem(`msgs_${matchId}`, JSON.stringify(stored));
    } catch (e) {}

    socket.emit('chat:typing', { matchId, isTyping: false });
    setMessageText('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    socket.emit('chat:typing', { matchId, isTyping: true });
  };

  const handleBlockUser = async () => {
    if (!activeMatch?.other_user) return;
    const peerName = activeMatch.other_user.name;
    if (confirm(`Block ${peerName}? You will not see their messages or posts.`)) {
      try {
        await apiFetch('/api/blocks', {
          method: 'POST',
          body: JSON.stringify({ blockedUserId: activeMatch.other_user.id })
        });
      } catch (err) {}
      blockUser({ id: activeMatch.other_user.id, name: peerName });
      router.push('/chat');
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setMsgMenu(null);
    setDeletingMsgId(msgId);
    try {
      await apiFetch(`/api/messages/${msgId}`, { method: 'DELETE' });
    } catch (e) {}
    // Remove from local state and localStorage regardless
    setMessages(prev => prev.filter(m => m.id !== msgId));
    try {
      const stored = JSON.parse(localStorage.getItem(`msgs_${matchId}`) || '[]');
      localStorage.setItem(`msgs_${matchId}`, JSON.stringify(stored.filter((m: any) => m.id !== msgId)));
    } catch (e) {}
    setDeletingMsgId(null);
  };


  const peer = activeMatch?.other_user;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0F1015]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral border-t-transparent"></div>
          <p className="font-sans text-xs text-text-muted animate-pulse">Loading Chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#0F1015] overflow-hidden relative">
      
      {/* Touch/click outside backdrop overlay to close sidebar */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-10 md:hidden transition-opacity cursor-pointer"
        />
      )}

      {/* 1. LEFT SIDEBAR (Collapsible) */}
      {isSidebarOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="fixed md:relative inset-y-0 left-0 w-80 lg:w-96 border-r border-[#1E202B] flex flex-col flex-shrink-0 bg-[#0F1015] transition-all z-20 shadow-2xl md:shadow-none"
        >
          
          {/* Header & Tabs */}
          <div className="p-4 border-b border-[#1E202B] space-y-3 bg-[#12141D]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-coral" /> Chat
              </h2>
            </div>

            {/* DM / Squad Tab Switcher */}
            <div className="flex p-1 bg-[#1A1D27] rounded-xl border border-[#232635]">
              <button
                onClick={() => setActiveTab('dms')}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'dms'
                    ? 'bg-coral text-white shadow-md'
                    : 'text-[#8F96A6] hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> DMs ({allMatches.length})
              </button>
              <button
                onClick={() => setActiveTab('squads')}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
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

          {/* List Content */}
          <div className="flex-grow overflow-y-auto divide-y divide-[#1E202B]">
            {activeTab === 'dms' ? (
              allMatches
                .filter(m => !m.other_user || m.other_user.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((m) => {
                  const mPeer = m.other_user;
                  if (!mPeer) return null;
                  const isCurrent = m.id === matchId;
                  return (
                    <div
                      key={m.id}
                      onClick={() => router.push(`/chat/${m.id}`)}
                      className={`p-3.5 flex items-center gap-3.5 transition-colors cursor-pointer ${
                        isCurrent ? 'bg-[#171922] border-l-2 border-coral' : 'hover:bg-[#171922]'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#262936] overflow-hidden relative flex-shrink-0 border border-white/10">
                        <img src={getAvatarUrl(mPeer.photos)} alt={mPeer.name} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-teal rounded-full border-2 border-[#171922]"></span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className={`font-semibold text-xs truncate ${isCurrent ? 'text-coral' : 'text-white'}`}>
                            {mPeer.name}
                          </h4>
                          <span className="text-[9px] text-text-muted">
                            {new Date(m.matched_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-text-muted truncate">
                          {mPeer.branch} • {mPeer.year}
                        </p>
                      </div>
                    </div>
                  );
                })
            ) : (
              squadRooms
                .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((room) => (
                  <div
                    key={room.id}
                    onClick={() => router.push(`/rooms/${room.id}`)}
                    className="p-3.5 hover:bg-[#171922] transition-colors flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-2xl bg-[#1F2230] border border-[#262936] flex items-center justify-center flex-shrink-0 group-hover:border-coral transition-colors">
                        {room.is_private ? (
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Users className="w-3.5 h-3.5 text-teal" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-white group-hover:text-coral transition-colors truncate">
                          {(room.name || 'Squad').replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F004}\u{1F0CF}⚡☕💻🎮🌙🍿🚗📚🍔🏸✨💬]/gu, '').trim()}
                        </h4>
                        <p className="text-[10px] text-text-muted truncate mt-0.5">
                          {room.topic || 'Campus Squad Room'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* 2. MIDDLE CHAT WINDOW */}
      <div 
        onClick={() => { if (isSidebarOpen) setIsSidebarOpen(false); }}
        className="flex-1 flex flex-col h-full bg-[#0F1015] relative"
      >
        {/* Chat Header */}
        <header className="px-6 py-3.5 bg-[#0F1015] border-b border-[#1E202B] flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/chat')}
              className="md:hidden p-2 rounded-xl text-text-muted hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Sidebar Toggle Button for Desktop */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex p-2 rounded-xl text-text-muted hover:text-white hover:bg-[#171922] transition-all cursor-pointer"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              <PanelLeft className={`w-4 h-4 transition-colors ${!isSidebarOpen ? 'text-coral' : ''}`} />
            </button>
            
            {/* Peer Info (Clickable to navigate to user profile) */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (peer?.id) router.push(`/profile/${peer.id}`);
              }}
              className="flex items-center gap-3 cursor-pointer group hover:opacity-90 transition-opacity"
              title="View Profile"
            >
              <div className="w-9 h-9 rounded-full bg-[#262936] overflow-hidden flex-shrink-0 relative border border-white/10 group-hover:border-coral transition-colors">
                <img src={getAvatarUrl(peer?.photos)} alt={peer?.name} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-teal rounded-full border-2 border-[#0F1015]"></span>
              </div>

              <div>
                <h3 className="font-bold text-sm text-white group-hover:text-coral transition-colors flex items-center gap-1.5">
                  {peer?.name}
                </h3>
                <p className="text-[10px] text-teal flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal"></span> Online
                </p>
              </div>
            </div>
          </div>

          {/* Three-Dots Menu Options */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowOptionsMenu(!showOptionsMenu);
              }}
              className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-[#171922] transition-colors cursor-pointer"
              title="More Options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showOptionsMenu && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-2 w-52 bg-[#171922] border border-[#262936] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  onClick={() => {
                    if (peer?.id) router.push(`/profile/${peer.id}`);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs text-white hover:bg-[#202330] transition-colors flex items-center justify-between cursor-pointer font-medium"
                >
                  <span>View Profile</span>
                  <span className="text-[10px] text-text-muted">→</span>
                </button>

                <button
                  onClick={() => {
                    setNotificationsMuted(!notificationsMuted);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs text-white hover:bg-[#202330] transition-colors flex items-center justify-between cursor-pointer font-medium"
                >
                  <span>Mute Notifications</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${notificationsMuted ? 'bg-coral/20 text-coral' : 'bg-white/10 text-text-muted'}`}>
                    {notificationsMuted ? 'Muted' : 'Off'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setMessages([]);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs text-white/80 hover:bg-[#202330] hover:text-white transition-colors cursor-pointer font-medium"
                >
                  Clear Chat
                </button>

                <div className="my-1 border-t border-[#262936]"></div>

                <button
                  onClick={() => {
                    handleBlockUser();
                    setShowOptionsMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-coral hover:bg-coral/10 transition-colors cursor-pointer"
                >
                  Block User
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#0F1015]">
          {/* Date Badge */}
          <div className="flex justify-center my-2">
            <span className="px-3 py-1 rounded-full bg-[#171922] border border-[#262936] text-[10px] text-text-muted font-medium">
              Today
            </span>
          </div>

          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id;
            const isLastMessage = idx === messages.length - 1;
            const isSeen = !isLastMessage || (msg as any).read || (idx % 2 === 0);
            const isDeleting = deletingMsgId === msg.id;

            return (
              <div
                key={msg.id || idx}
                className={`flex items-end gap-2 group relative ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar for peer messages — clickable to profile */}
                {!isMe && (
                  <button
                    onClick={() => peer?.id && router.push(`/profile/${peer.id}`)}
                    className="w-7 h-7 rounded-full bg-[#262936] overflow-hidden flex-shrink-0 border border-white/10 mb-5 hover:border-coral transition-colors cursor-pointer"
                    title={`View ${peer?.name || 'Peer'}'s profile`}
                  >
                    <img src={getAvatarUrl(peer?.photos)} alt={peer?.name || 'Student'} className="w-full h-full object-cover" />
                  </button>
                )}

                <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'} relative`}>
                  <div
                    onContextMenu={(e) => { e.preventDefault(); handleMsgOpenMenu(msg, isMe, e.currentTarget as HTMLElement, e.clientX, e.clientY); }}
                    onTouchStart={(e) => {
                      const elem = e.currentTarget as HTMLElement;
                      longPressTimer.current = setTimeout(() => handleMsgOpenMenu(msg, isMe, elem), 400);
                    }}
                    onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                    onTouchMove={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                    className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed select-none cursor-pointer active:scale-95 transition-transform relative ${
                      isMe
                        ? 'bg-coral text-white font-medium rounded-tr-none'
                        : 'bg-[#171922] border border-[#262936] text-white rounded-tl-none'
                    } ${isDeleting ? 'opacity-40' : ''}`}
                  >
                    <p className="whitespace-pre-wrap">{isDeleting ? 'Deleting...' : msg.content}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] text-text-muted/60 mt-1 px-1">
                    <span>{new Date(msg.sent_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && (
                      <span className={`flex items-center gap-0.5 font-mono text-[9px] ${isSeen ? 'text-teal font-semibold' : 'text-text-muted/70'}`}>
                        <CheckCheck className={`w-3 h-3 ${isSeen ? 'text-teal' : 'text-text-muted/50'}`} />
                        {isSeen ? 'Seen' : 'Delivered'}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            );
          })}

          {isPeerTyping && peer && (
            <div className="flex flex-col items-start">
              <div className="px-4 py-2.5 rounded-2xl bg-[#171922] border border-[#262936] text-xs text-text-muted italic rounded-tl-none">
                {peer.name} is typing...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar (Matching Screen 3) */}
        <footer className="p-4 bg-[#0F1015] border-t border-[#1E202B] z-10">
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <div className="flex-1 bg-[#171922] border border-[#262636] focus-within:border-coral rounded-2xl py-2.5 px-4 flex items-center gap-3">
              <input
                type="text"
                placeholder="Type a message..."
                value={messageText}
                onChange={handleInputChange}
                className="w-full bg-transparent text-xs text-white placeholder-text-muted outline-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-coral text-white hover:bg-coral-hover shadow-lg shadow-coral/20 flex items-center justify-center cursor-pointer flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </footer>
      </div>

      {/* Instagram-style Small Dropdown Box (Anchored directly below selected message) */}
      {msgMenu && (
        <div
          onClick={() => { setMsgMenu(null); setMenuPos(null); }}
          className="fixed inset-0 bg-black/25 z-[9999] animate-in fade-in duration-100 select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={menuPos ? {
              position: 'fixed',
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`
            } : {}}
            className="w-56 bg-[#161822] border border-[#2B2F42] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 divide-y divide-[#202330]"
          >
            {/* Quick Emoji Reaction Row */}
            <div className="p-2 flex items-center justify-around bg-[#10111A]">
              {['👍', '🔥', '❤️', '😂', '🚀', '💡'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setMsgMenu(null)}
                  className="text-lg hover:scale-125 active:scale-95 transition-transform p-0.5 cursor-pointer"
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Menu Options */}
            <div className="py-1 divide-y divide-[#202330]">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(msgMenu.content);
                  setMsgMenu(null);
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-white hover:bg-[#202330] flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-teal shrink-0" />
                <span>Copy Text</span>
              </button>

              {!msgMenu.isMe && peer?.id && (
                <button
                  onClick={() => {
                    setMsgMenu(null);
                    router.push(`/profile/${peer.id}`);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-white hover:bg-[#202330] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-coral shrink-0" />
                  <span className="truncate">View Profile</span>
                </button>
              )}

              {!msgMenu.isMe && (
                <button
                  onClick={() => {
                    setMsgMenu(null);
                    try {
                      const existing = JSON.parse(localStorage.getItem('admin_reports') || '[]');
                      existing.unshift({
                        reported_user_id: peer?.id,
                        content_id: msgMenu.msgId,
                        content_type: 'chat_message',
                        reason: 'Reported in chat',
                        created_at: new Date().toISOString()
                      });
                      localStorage.setItem('admin_reports', JSON.stringify(existing));
                    } catch (e) {}
                    alert('Message reported to admin.');
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-amber-400 hover:bg-[#202330] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Report Message</span>
                </button>
              )}

              {msgMenu.isMe && (
                <button
                  onClick={() => {
                    const idToDelete = msgMenu.msgId;
                    setMsgMenu(null);
                    handleDeleteMessage(idToDelete);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Delete for Everyone</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setMsgMenu(null)}
              className="w-full py-2 text-center text-[11px] font-bold text-[#8F96A6] hover:text-white bg-[#12131C] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
