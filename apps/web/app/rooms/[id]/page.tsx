'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Send, 
  LogOut, 
  Users, 
  MessageSquare, 
  Hash, 
  Trash2, 
  Smile, 
  Lock, 
  Plus, 
  Radio, 
  Crown, 
  Check, 
  CheckCheck,
  Copy, 
  Paperclip,
  Info,
  Reply,
  Pin,
  X,
  Search,
  CornerDownRight,
  ChevronDown,
  ShieldAlert,
  Compass,
  PanelLeft,
  Volume2,
  BarChart2,
  Zap,
  MoreVertical,
  Clock,
  User,
  Flag
} from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { getAvatarUrl } from '../../../lib/avatar';
import { getSocket } from '../../../lib/socket';
import { useUser } from '../../../components/layout-wrapper';
import { RoomMessage, Room } from '@campusconnect/shared';

interface RoomMember {
  id: string;
  name: string;
  handle: string;
  photos?: string[];
  branch?: string;
  year?: string;
  college_verified?: boolean;
}

const REACTION_EMOJIS = ['👍', '🔥', '❤️', '😂', '🚀', '💡'];

export default function RoomDetailPage() {
  const { id } = useParams() as { id: string };
  const { user, demoLogin } = useUser();
  const router = useRouter();

  const requireAuth = () => {
    window.dispatchEvent(new CustomEvent('require-auth'));
  };

  // State
  const [room, setRoom] = useState<any>(null);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [realtimeOnlineCount, setRealtimeOnlineCount] = useState<number | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [countdownText, setCountdownText] = useState<string>('');

  useEffect(() => {
    const isPermanent = room?.is_official || room?.id?.startsWith('lounge-') || ['lounge-general', 'lounge-tech', 'lounge-gaming', 'lounge-latenight', 'lounge-anime'].includes(room?.id);
    if (isPermanent || !room?.expires_at) {
      setCountdownText('');
      return;
    }

    const updateCountdown = () => {
      const targetTime = new Date(room.expires_at).getTime();
      const diffMs = targetTime - Date.now();
      if (diffMs <= 0) {
        setCountdownText('Expired');
        return;
      }
      const totalSecs = Math.floor(diffMs / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      setCountdownText(`${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [room, id]);

  // Advanced Chat Features State
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string; content: string } | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; name: string; content: string } | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<string, string[]>>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [customReactionMsgId, setCustomReactionMsgId] = useState<string | null>(null);
  
  // Sidebars toggle
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [closing, setClosing] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // Mobile Touch Swipe & Long-Press Reaction State
  const [mobileActionMsg, setMobileActionMsg] = useState<{ id: string; name: string; content: string; sender_id?: string; isMe?: boolean } | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [swipingMsgId, setSwipingMsgId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

  const openMsgMenu = (targetElem: HTMLElement | null, msg: RoomMessage, clickX?: number, clickY?: number) => {
    const isMe = msg.sender_id === user?.id || msg.sender_id?.toString() === user?.id?.toString();
    
    let top = 200;
    let left = 20;
    const dropdownHeight = 250;
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
    setMobileActionMsg({ id: msg.id, name: msg.sender_name, content: msg.content, sender_id: msg.sender_id, isMe });
  };

  // Poll Creation & Voting State
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState<'8h' | '24h' | 'always'>('24h');
  const [pollVotes, setPollVotes] = useState<Record<string, Record<number, string[]>>>({});

  const handleDeleteRoomMessage = async (msgId: string) => {
    if (!user) {
      requireAuth();
      return;
    }
    if (!confirm('Delete this message from the group chat?')) return;
    try {
      await apiFetch(`/api/rooms/${id}/messages/${msgId}`, { method: 'DELETE' });
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete message');
    }
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 6) setPollOptions((prev) => [...prev, '']);
  };

  const handleUpdatePollOption = (index: number, val: string) => {
    setPollOptions((prev) => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleCreatePollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      requireAuth();
      return;
    }
    const cleanQuestion = pollQuestion.trim();
    const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);

    if (!cleanQuestion || cleanOptions.length < 2) {
      alert('Please enter a poll question and at least 2 options.');
      return;
    }

    const pollPayload = {
      is_poll: true,
      question: cleanQuestion,
      options: cleanOptions,
      duration: pollDuration,
      created_at: new Date().toISOString()
    };

    const formattedContent = `POLL:${JSON.stringify(pollPayload)}`;

    if (socket.connected) {
      socket.emit('room:message:send', {
        roomId: id,
        content: formattedContent,
        tempId: 'temp-poll-' + Date.now()
      });
    } else {
      await apiFetch(`/api/rooms/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: formattedContent })
      });
    }

    setPollQuestion('');
    setPollOptions(['', '']);
    setPollDuration('24h');
    setShowPollModal(false);
  };

  const handleVotePoll = (msgId: string, optionIndex: number) => {
    if (!user) {
      requireAuth();
      return;
    }
    setPollVotes((prev) => {
      const msgVotes = prev[msgId] || {};
      const currentVotersForOpt = msgVotes[optionIndex] || [];
      const alreadyVoted = currentVotersForOpt.includes(user.id);

      let updatedVoters: string[];
      if (alreadyVoted) {
        updatedVoters = currentVotersForOpt.filter((uid) => uid !== user.id);
      } else {
        updatedVoters = [...currentVotersForOpt, user.id];
      }

      return {
        ...prev,
        [msgId]: {
          ...msgVotes,
          [optionIndex]: updatedVoters
        }
      };
    });
  };
  
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchBarRef = useRef<HTMLDivElement | null>(null);
  const searchToggleBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!showSearch) return;

    const handleSearchClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        searchBarRef.current && 
        !searchBarRef.current.contains(target) &&
        searchToggleBtnRef.current &&
        !searchToggleBtnRef.current.contains(target)
      ) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleSearchClickOutside);
    document.addEventListener('touchstart', handleSearchClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleSearchClickOutside);
      document.removeEventListener('touchstart', handleSearchClickOutside);
    };
  }, [showSearch]);

  const handleMsgTouchStart = (e: React.TouchEvent, msg: RoomMessage) => {
    const targetElem = e.currentTarget as HTMLElement;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      openMsgMenu(targetElem, msg);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    }, 400);
  };

  const handleMsgTouchMove = (e: React.TouchEvent, msg: RoomMessage) => {
    if (!touchStartRef.current) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartRef.current.y);

    if (deltaY > 10 && holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (deltaX > 15 && deltaY < 20) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setSwipingMsgId(msg.id);
      setSwipeOffset(Math.min(deltaX, 80));
    }
  };

  const handleMsgTouchEnd = (msg: RoomMessage) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (swipingMsgId === msg.id && swipeOffset > 45) {
      setReplyingTo({ id: msg.id, name: msg.sender_name, content: msg.content });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }
    }

    setSwipingMsgId(null);
    setSwipeOffset(0);
    touchStartRef.current = null;
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socket = getSocket();

  // Auto-scroll helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Mobile Soft-Keyboard VisualViewport Auto-Resize Listener
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        setTimeout(scrollToBottom, 100);
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportResize);
    window.visualViewport.addEventListener('scroll', handleViewportResize);
    handleViewportResize();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
        window.visualViewport.removeEventListener('scroll', handleViewportResize);
      }
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Load Room Data
  useEffect(() => {
    const loadRoomData = async () => {
      setLoading(true);
      setRealtimeOnlineCount(null);
      try {
        // Fire background join non-blockingly with capacity check
        apiFetch(`/api/rooms/${id}/join`, { method: 'POST' }).catch((jErr: any) => {
          if (jErr?.message?.includes('full') || jErr?.status === 403) {
            alert('This Flash Meetup room is already full (participant limit reached).');
            router.push('/rooms');
          }
        });

        // Fetch preview, rooms list, members, and chat history in parallel (<100ms)
        const [info, roomsList, membersData, history] = await Promise.all([
          apiFetch(`/api/rooms/${id}/preview`).catch(() => null),
          apiFetch('/api/rooms').catch(() => null),
          apiFetch(`/api/rooms/${id}/members`).catch(() => null),
          apiFetch(`/api/rooms/${id}/messages`).catch(() => null)
        ]);

        if (roomsList) setAllRooms(roomsList);
        const foundFromList = roomsList?.find((r: any) => r.id === id);
        const mergedRoom = { ...(foundFromList || {}), ...(info || {}) };
        if (mergedRoom.id || mergedRoom.name) setRoom(mergedRoom);
        if (membersData) setMembers(membersData);
        if (history) {
          setMessages(history);
          const loadedReactions: Record<string, Record<string, string[]>> = {};
          history.forEach((m: any) => {
            if (m.reactions && Object.keys(m.reactions).length > 0) {
              loadedReactions[m.id] = m.reactions;
            }
          });
          setMessageReactions((prev) => ({ ...loadedReactions, ...prev }));
        }
      } catch (err: any) {
        console.error('Failed to load room details:', err);
        if (err?.message?.includes('401') || !user) {
          try {
            await demoLogin('student-demo-1');
          } catch (lErr) {}
        }
      } finally {
        setLoading(false);
      }
    };

    loadRoomData();

    // Socket Setup
    socket.connect();
    socket.emit('room:join', { roomId: id });

    // Socket listeners
    const handlePresenceUpdate = (data: { roomId: string; onlineCount: number }) => {
      if (data.roomId === id) {
        setRealtimeOnlineCount(data.onlineCount);
      }
    };

    const handleNewMessage = (data: { roomId: string; message: RoomMessage & { client_temp_id?: string } }) => {
      if (data.roomId === id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          if (data.message.client_temp_id && prev.some((m) => m.id === data.message.client_temp_id)) {
            return prev.map((m) => (m.id === data.message.client_temp_id ? data.message : m));
          }
          return [...prev, data.message];
        });
        setTimeout(scrollToBottom, 50);
      }
    };

    const handleRoomClosed = (data: { roomId: string; message: string }) => {
      if (data.roomId === id) {
        alert(data.message || 'This room has been closed and chat history purged.');
        router.push('/rooms');
      }
    };

    const handleTypingEvent = (data: { roomId: string; userId: string; userName: string; isTyping: boolean }) => {
      if (data.roomId === id && data.userId !== user?.id) {
        if (data.isTyping) {
          setTypingUser(data.userName);
        } else {
          setTypingUser(null);
        }
      }
    };

    const handleReactionUpdate = (data: { roomId: string; messageId: string; emoji: string; userId?: string; isAdding?: boolean }) => {
      if (data.roomId === id) {
        setMessageReactions((prev) => {
          const rUserId = data.userId || 'remote-user';
          const currentMsgReactions = prev[data.messageId] || {};
          const currentEmojiUsers = currentMsgReactions[data.emoji] || [];

          const exists = currentEmojiUsers.includes(rUserId);

          let updatedUsers: string[];
          if (data.isAdding !== undefined) {
            if (data.isAdding && !exists) {
              updatedUsers = [...currentEmojiUsers, rUserId];
            } else if (!data.isAdding && exists) {
              updatedUsers = currentEmojiUsers.filter((u) => u !== rUserId);
            } else {
              updatedUsers = currentEmojiUsers;
            }
          } else {
            if (exists) {
              updatedUsers = currentEmojiUsers.filter((u) => u !== rUserId);
            } else {
              updatedUsers = [...currentEmojiUsers, rUserId];
            }
          }

          const updatedMsgReactions = { ...currentMsgReactions };
          if (updatedUsers.length > 0) {
            updatedMsgReactions[data.emoji] = updatedUsers;
          } else {
            delete updatedMsgReactions[data.emoji];
          }

          return {
            ...prev,
            [data.messageId]: updatedMsgReactions
          };
        });
      }
    };

    const handleMessageDeleted = (data: { roomId: string; messageId: string }) => {
      if (data.roomId === id) {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }
    };

    socket.on('room:presence:update', handlePresenceUpdate);
    socket.on('room:message:receive', handleNewMessage);
    socket.on('room:closed', handleRoomClosed);
    socket.on('room:typing', handleTypingEvent);
    socket.on('room:reaction:update', handleReactionUpdate);
    socket.on('room:message:deleted', handleMessageDeleted);

    return () => {
      socket.off('room:presence:update', handlePresenceUpdate);
      socket.off('room:message:receive', handleNewMessage);
      socket.off('room:closed', handleRoomClosed);
      socket.off('room:typing', handleTypingEvent);
      socket.off('room:reaction:update', handleReactionUpdate);
      socket.off('room:message:deleted', handleMessageDeleted);
    };
  }, [id, socket, router, user]);

  // Handle Input typing status
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    
    if (!user) return; // Unauthenticated users don't trigger typing events
    
    socket.emit('room:typing', { roomId: id, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('room:typing', { roomId: id, isTyping: false });
    }, 2000);
  };

  // Send message with Reply context
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      requireAuth();
      return;
    }
    const content = messageText.trim();
    if (!content) return;

    // 1. Construct optimistic local message
    const tempId = 'temp-' + Date.now() + '-' + Math.random();
    const optimisticMessage: RoomMessage = {
      id: tempId,
      room_id: id,
      sender_id: user?.id || 'me',
      sender_name: user?.name || 'Student',
      sender_handle: user?.handle || 'student',
      sender_photo: user?.photos && user.photos[0] ? user.photos[0] : null,
      content: content,
      sent_at: new Date().toISOString(),
      reply_to_id: replyingTo ? replyingTo.id : null,
      reply_to_name: replyingTo ? replyingTo.name : null,
      reply_to_content: replyingTo ? replyingTo.content : null
    };

    // 2. Optimistically append message immediately to state
    setMessages((prev) => [...prev, optimisticMessage]);

    // Clear input & reply bar right away
    setMessageText('');
    setReplyingTo(null);

    // 3. Send message via Socket if connected, otherwise fallback to REST
    if (socket.connected) {
      socket.emit('room:message:send', {
        roomId: id,
        content,
        tempId,
        replyToId: replyingTo ? replyingTo.id : null,
        replyToName: replyingTo ? replyingTo.name : null,
        replyToContent: replyingTo ? replyingTo.content : null
      });
      socket.emit('room:typing', { roomId: id, isTyping: false });
    } else {
      try {
        const savedMsg = await apiFetch(`/api/rooms/${id}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            content,
            replyToId: replyingTo ? replyingTo.id : null,
            replyToName: replyingTo ? replyingTo.name : null,
            replyToContent: replyingTo ? replyingTo.content : null
          })
        });

        if (savedMsg && savedMsg.id) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...savedMsg } : m))
          );
        }
      } catch (err) {
        console.error('Failed to post message over REST:', err);
      }
    }
  };

  // Handle Emoji Reaction tap (Toggle per user)
  const handleToggleReaction = (msgId: string, emoji: string) => {
    if (!user) {
      requireAuth();
      return;
    }
    const currentUserId = user.id;
    const currentMsgReactions = messageReactions[msgId] || {};
    const currentEmojiUsers = currentMsgReactions[emoji] || [];
    const isCurrentlyReacted = currentEmojiUsers.includes(currentUserId);
    const isAdding = !isCurrentlyReacted;

    // Optimistically update local reaction state per user
    setMessageReactions((prev) => {
      const msgReactions = prev[msgId] || {};
      const users = msgReactions[emoji] || [];
      const updatedUsers = isAdding
        ? [...users.filter((u) => u !== currentUserId), currentUserId]
        : users.filter((u) => u !== currentUserId);

      const nextMsgReactions = { ...msgReactions };
      if (updatedUsers.length > 0) {
        nextMsgReactions[emoji] = updatedUsers;
      } else {
        delete nextMsgReactions[emoji];
      }

      return {
        ...prev,
        [msgId]: nextMsgReactions
      };
    });

    socket.emit('room:reaction:add', { roomId: id, messageId: msgId, emoji, isAdding });
  };

  // Copy message text helper
  const handleCopyText = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  // Pin message helper
  const handlePinMessage = (msg: RoomMessage) => {
    setPinnedMessage({
      id: msg.id,
      name: msg.sender_name,
      content: msg.content
    });
  };

  // Close & Purge Room
  const handleCloseAndPurgeRoom = async () => {
    if (!confirm('⚠️ Are you sure you want to CLOSE this room?\n\nThis will permanently DELETE all chat messages and room data.')) {
      return;
    }

    setClosing(true);
    try {
      await apiFetch(`/api/rooms/${id}/close`, { method: 'POST' });
      socket.emit('room:close', { roomId: id });
      router.push('/rooms');
    } catch (err: any) {
      alert(err.message || 'Failed to close room');
    } finally {
      setClosing(false);
    }
  };

  // Leave Room
  const handleLeaveRoom = async () => {
    try {
      await apiFetch(`/api/rooms/${id}/leave`, { method: 'POST' });
      router.push('/rooms');
    } catch (err) {
      router.push('/rooms');
    }
  };

  const copySquadCode = () => {
    if (room?.invite_code) {
      navigator.clipboard.writeText(room.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const isHost = room && user && (room.created_by === user.id || user.is_admin || user.email === 'admin@campusconnect.com');

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const DEFAULT_PUBLIC_CHANNELS = [
    { id: 'lounge-general', name: 'Campus Lounge', is_official: true, type: 'interest' },
    { id: 'lounge-tech', name: 'Tech & Coding', is_official: true, type: 'interest' },
    { id: 'lounge-gaming', name: 'Gaming & Esports', is_official: true, type: 'interest' },
    { id: 'lounge-latenight', name: 'Late Night Vibe', is_official: true, type: 'interest' },
    { id: 'lounge-anime', name: 'Anime & Binge', is_official: true, type: 'interest' }
  ];

  const PERMANENT_LOUNGES = ['lounge-general', 'lounge-tech', 'lounge-gaming', 'lounge-latenight', 'lounge-anime'];
  const isPermanentRoom = !!(
    room?.id?.startsWith('lounge-') || 
    PERMANENT_LOUNGES.includes(room?.id) ||
    (!room?.is_flash && room?.type !== 'flash' && !room?.expires_at)
  );
  const isFlashMeetup = !!(
    (room?.is_flash || room?.type === 'flash' || room?.expires_at) &&
    !PERMANENT_LOUNGES.includes(room?.id) &&
    !room?.id?.startsWith('lounge-')
  );

  // 1. Public Channels Section: ONLY the 5 official public channels
  const publicLounges = React.useMemo(() => {
    const map = new Map<string, any>();
    DEFAULT_PUBLIC_CHANNELS.forEach(c => map.set(c.id, c));
    allRooms.forEach(r => {
      if (PERMANENT_LOUNGES.includes(r.id) || r.id?.startsWith('lounge-')) {
        map.set(r.id, { ...(map.get(r.id) || {}), ...r });
      }
    });
    return Array.from(map.values());
  }, [allRooms]);

  // 2. Flash Meetups Section: ONLY joined/created flash meetups
  const joinedRooms = React.useMemo(() => {
    const nonPublicRooms = allRooms.filter(r => !PERMANENT_LOUNGES.includes(r.id) && !r.id?.startsWith('lounge-'));
    if (room && room.id && !PERMANENT_LOUNGES.includes(room.id) && !room.id.startsWith('lounge-')) {
      const exists = nonPublicRooms.some(r => r.id === room.id);
      if (!exists) {
        return [room, ...nonPublicRooms];
      }
    }
    return nonPublicRooms;
  }, [allRooms, room]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0E0F14]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent"></div>
          <p className="font-mono text-xs text-[#8F96A6] animate-pulse">Loading Chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full bg-[#0E0F14] text-[#E2E8F0] overflow-hidden relative"
    >
      
      {/* Dark Overlay to close Sidebars when clicking outside */}
      {(showSidebar || showMembersDrawer) && (
        <div
          onClick={() => {
            setShowSidebar(false);
            setShowMembersDrawer(false);
          }}
          className="fixed inset-0 bg-black/40 z-30 transition-opacity cursor-pointer select-none"
        />
      )}

      {/* 1. CHANNELS SIDEBAR (Collapsible) */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`${
        showSidebar ? 'flex' : 'hidden'
      } fixed md:relative inset-y-0 left-0 z-40 w-64 bg-[#14151D] border-r border-[#202330] flex-col shrink-0 transition-all duration-200 shadow-2xl md:shadow-none`}>
        
        {/* Workspace Header */}
        <div className="p-4 border-b border-[#202330] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-coral/15 border border-coral/25 flex items-center justify-center text-coral font-bold text-xs">
              R
            </div>
            <div>
              <h3 className="font-bold text-xs text-[#F2F3F5] tracking-tight">Rogue Campus</h3>
              <p className="text-[10px] text-[#8F96A6] font-mono">Community Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => router.push('/rooms')} className="text-[#8F96A6] hover:text-white p-1 cursor-pointer" title="All Channels Directory">
              <Compass className="w-4 h-4" />
            </button>
            <button onClick={() => setShowSidebar(false)} className="text-[#8F96A6] hover:text-white p-1 cursor-pointer" title="Close Sidebar">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          
          {/* Group 1: 5 Official Public Channels */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-bold text-[#8F96A6] uppercase tracking-wider mb-1">
              Public Channels
            </div>
            {publicLounges.map((r) => {
              const isActive = r.id === id;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    router.push(`/rooms/${r.id}`);
                    if (window.innerWidth < 768) setShowSidebar(false);
                  }}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#202330] text-white font-bold'
                      : 'text-[#8F96A6] hover:bg-[#1A1C28] hover:text-[#F2F3F5]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Hash className={`w-4 h-4 shrink-0 ${isActive ? 'text-coral' : 'text-coral/80'}`} />
                    <span className="truncate">{r.name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}⚡☕💻🎮🌙🍿🚗]/gu, '').trim()}</span>
                  </div>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-coral"></span>}
                </button>
              );
            })}
          </div>

          {/* Group 2: Joined Flash Meetups */}
          <div className="space-y-1">
            <div className="px-2 flex items-center justify-between text-[10px] font-bold text-[#8F96A6] uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-coral fill-coral" /> Flash Meetups
              </span>
              <button onClick={() => router.push('/rooms')} className="hover:text-coral transition-colors cursor-pointer" title="Browse / Drop Flash Meetup">
                <Plus className="w-3.5 h-3.5 text-coral" />
              </button>
            </div>

            {joinedRooms.length === 0 ? (
              <div className="px-2 py-2.5 text-[11px] text-[#8F96A6] italic leading-snug">
                No active joined meetups. Join or drop one from the Meetups tab!
              </div>
            ) : (
              joinedRooms.map((r) => {
                const isActive = r.id === id;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      router.push(`/rooms/${r.id}`);
                      if (window.innerWidth < 768) setShowSidebar(false);
                    }}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-coral/15 border border-coral/30 text-white font-bold'
                        : 'text-[#8F96A6] hover:bg-[#1A1C28] hover:text-[#F2F3F5]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Zap className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-coral fill-coral' : 'text-coral/70'}`} />
                      <span className="truncate">{r.name}</span>
                    </div>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-coral"></span>}
                  </button>
                );
              })
            )}
          </div>

        </div>

        {/* User Footer Bar */}
        <div className="p-3 border-t border-[#202330] bg-[#101118] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-[#202330] overflow-hidden border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                {user?.name ? user.name.charAt(0) : 'U'}
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-teal ring-2 ring-[#101118]"></span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.name || 'Student'}</p>
              <p className="text-[9px] text-[#8F96A6] font-mono truncate">Online</p>
            </div>
          </div>
        </div>

      </div>

      {/* 2. CHAT CANVAS COLUMN */}
      <div 
        onClick={() => { 
          if (showSidebar) setShowSidebar(false); 
          if (showMembersDrawer) setShowMembersDrawer(false); 
        }}
        className="flex-1 flex flex-col h-full bg-[#0E0F14] relative min-w-0"
      >
        
        {/* Top Channel Header Bar (WhatsApp / Insta style) */}
        <header className="px-4 py-3 bg-[#14151D] border-b border-[#202330] flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            
            {/* Back Button (Returns to Rooms directory) */}
            <button
              onClick={() => router.push('/rooms')}
              className="p-1.5 rounded-lg text-coral hover:text-white hover:bg-[#202330] transition-colors cursor-pointer flex items-center gap-1 font-semibold text-xs shrink-0"
              title="Back to Rooms"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Sidebar Toggle */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 rounded-lg text-[#8F96A6] hover:text-white hover:bg-[#202330] transition-colors cursor-pointer shrink-0"
              title="Toggle Channels Sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                {isPermanentRoom ? (
                  <Hash className="w-4 h-4 text-coral shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-teal shrink-0" />
                )}
                <h2 className="font-bold text-sm text-[#F2F3F5] truncate">{room ? room.name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}⚡☕💻🎮🌙🍿🚗]/gu, '').trim() : 'Room Chat'}</h2>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#8F96A6]">
                <span className="flex items-center gap-1 text-teal font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse"></span>
                  {(() => {
                    const count = realtimeOnlineCount !== null 
                      ? realtimeOnlineCount 
                      : (members.length > 0 ? members.length : 1);
                    return `${count} ${count === 1 ? 'member' : 'members'} online`;
                  })()}
                </span>
                {room?.topic && <span className="truncate hidden sm:inline">• {room.topic}</span>}
              </div>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2 shrink-0">

            <button
              ref={searchToggleBtnRef}
              onClick={() => {
                if (showSearch) setSearchQuery('');
                setShowSearch(!showSearch);
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                showSearch ? 'bg-coral text-white' : 'text-[#8F96A6] hover:text-white hover:bg-[#202330]'
              }`}
              title="Search Channel Messages"
            >
              <Search className="w-4 h-4" />
            </button>

            {room && room.invite_code && (
              <button
                onClick={copySquadCode}
                className="px-2.5 py-1 rounded-lg bg-coral/10 hover:bg-coral/20 text-coral border border-coral/20 text-xs font-mono font-semibold transition-all flex items-center gap-1 cursor-pointer"
                title="Copy Squad Join Code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : `Code: ${room.invite_code}`}</span>
              </button>
            )}

            {isHost && isFlashMeetup ? (
              <button
                onClick={handleCloseAndPurgeRoom}
                disabled={closing}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{closing ? 'Closing...' : 'Purge Room'}</span>
              </button>
            ) : isFlashMeetup && (
              <button
                onClick={handleLeaveRoom}
                className="px-2.5 py-1 bg-[#202330] hover:bg-rose-500/20 hover:text-rose-400 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer text-[#8F96A6]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave</span>
              </button>
            )}

            <button
              onClick={() => setShowMembersDrawer(!showMembersDrawer)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                showMembersDrawer ? 'bg-coral text-white' : 'text-[#8F96A6] hover:text-white hover:bg-[#202330]'
              }`}
              title="Channel Members"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* EPHEMERAL COUNTDOWN BANNER (Sleek & Minimalist Design) */}
        {isFlashMeetup && (
          <div className="bg-[#12141D]/90 border-b border-[#1E2130] px-4 py-1.5 flex items-center justify-between z-10 shrink-0 text-xs">
            <div className="flex items-center gap-2 text-[11px] text-[#8F96A6] min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-coral animate-pulse shrink-0"></span>
              <span className="font-semibold text-white/90 truncate">Flash Meetup</span>
              <span className="text-[#3D4255] hidden sm:inline">•</span>
              <span className="text-[#8F96A6] text-[10px] truncate hidden sm:inline">Temporary Room</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] text-coral bg-coral/10 border border-coral/20 px-2.5 py-0.5 rounded-full">
              <Clock className="w-3 h-3 text-coral" />
              <span className="font-semibold tracking-tight">{countdownText || '02h 00m 00s'}</span>
            </div>
          </div>
        )}

        {/* Live Search Bar Dropdown */}
        {showSearch && (
          <div ref={searchBarRef} className="bg-[#14151D] border-b border-[#202330] p-3 flex items-center gap-3 animate-in slide-in-from-top-1 duration-150 shrink-0">
            <Search className="w-4 h-4 text-[#8F96A6]" />
            <input
              type="text"
              placeholder="Search messages in this channel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-[#0E0F14] border border-[#202330] rounded-lg py-1.5 px-3 text-xs text-white outline-none focus:border-coral"
              autoFocus
            />
            <button onClick={() => { setSearchQuery(''); setShowSearch(false); }} className="text-[#8F96A6] hover:text-white text-xs">
              Cancel
            </button>
          </div>
        )}

        {/* Pinned Announcement Bar */}
        {pinnedMessage && (
          <div className="bg-[#181A24] border-b border-[#202330] px-4 py-2 flex items-center justify-between text-xs text-[#F2F3F5] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Pin className="w-3.5 h-3.5 text-coral shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-coral">Pinned by {pinnedMessage.name}: </span>
                <span className="text-[#8F96A6] truncate">{pinnedMessage.content}</span>
              </div>
            </div>
            <button onClick={() => setPinnedMessage(null)} className="text-[#8F96A6] hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Message History Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[#0E0F14]">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 max-w-sm mx-auto text-[#8F96A6]">
              <Hash className="w-10 h-10 text-coral opacity-80" />
              <h4 className="font-bold text-sm text-[#F2F3F5]">Start the conversation</h4>
              <p className="text-xs leading-relaxed text-[#8F96A6]">
                Send a message to start chatting.
              </p>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              const msgReactions = messageReactions[msg.id] || {};
              const isSwipingThis = swipingMsgId === msg.id;

              return (
                <div
                  key={msg.id}
                  onTouchStart={(e) => handleMsgTouchStart(e, msg)}
                  onTouchMove={(e) => handleMsgTouchMove(e, msg)}
                  onTouchEnd={() => handleMsgTouchEnd(msg)}
                  className={`group relative flex items-start gap-2.5 p-2 rounded-2xl transition-transform duration-100 select-none ${
                    isMe ? 'flex-row-reverse justify-start' : 'flex-row justify-start'
                  }`}
                  style={{
                    transform: isSwipingThis ? `translateX(${swipeOffset}px)` : 'none'
                  }}
                >
                  {/* Swipe to reply icon indicator */}
                  {isSwipingThis && (
                    <div className="absolute left-[-2rem] top-1/2 -translate-y-1/2 text-coral">
                      <Reply className="w-4 h-4 animate-pulse" />
                    </div>
                  )}

                  {/* Sender Avatar - Clickable to Profile */}
                  <button
                    type="button"
                    onClick={() => !isMe && msg.sender_id && router.push(`/profile/${msg.sender_id}`)}
                    className={`w-8 h-8 rounded-full bg-[#202330] overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-white border border-white/10 mt-0.5 shadow-sm transition-all ${
                      !isMe ? 'hover:border-coral cursor-pointer' : 'cursor-default'
                    }`}
                    title={!isMe ? `View ${msg.sender_name || 'Student'}'s profile` : 'You'}
                  >
                    {msg.sender_photo ? (
                      <img src={msg.sender_photo} alt={msg.sender_name} className="w-full h-full object-cover" />
                    ) : (
                      (msg.sender_name || 'U').charAt(0).toUpperCase()
                    )}
                  </button>

                  {/* Message Column / Bubble */}
                  <div className={`flex flex-col min-w-0 max-w-[85%] sm:max-w-[70%] ${isMe ? 'items-end text-right' : 'items-start text-left'}`}>
                    
                    {/* Author Meta Line */}
                    <div className={`flex items-baseline gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <button
                        type="button"
                        onClick={() => !isMe && msg.sender_id && router.push(`/profile/${msg.sender_id}`)}
                        className={`text-xs font-bold transition-colors ${
                          isMe ? 'text-coral' : 'text-[#F2F3F5] hover:text-coral cursor-pointer'
                        }`}
                      >
                        {isMe ? 'You' : (msg.sender_name || 'Student')}
                      </button>
                      <span className="text-[10px] text-[#8F96A6] font-mono flex items-center gap-1">
                        {new Date(msg.sent_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && (
                          <span className="text-teal text-[9px] font-semibold flex items-center gap-0.5 ml-0.5">
                            <CheckCheck className="w-3 h-3 text-teal" /> Seen
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Quoted Reply Block */}
                    {(msg as any).reply_to_content && (
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs mb-1 border-l-2 max-w-full overflow-hidden ${
                        isMe 
                          ? 'border-coral bg-coral/10 text-coral-light' 
                          : 'border-coral/50 bg-[#1A1C28] text-[#8F96A6]'
                      }`}>
                        <CornerDownRight className="w-3 h-3 shrink-0" />
                        <div className="min-w-0 flex-1 overflow-hidden text-[11px] truncate">
                          <span className="font-bold mr-1 shrink-0 text-coral">@{(msg as any).reply_to_name}:</span>
                          <span className="italic truncate text-ellipsis">{(msg as any).reply_to_content}</span>
                        </div>
                      </div>
                    )}

                    {/* Bubble Box */}
                    {msg.content?.startsWith('POLL:') ? (
                      (() => {
                        try {
                          const pollData = JSON.parse((msg.content ?? '').replace('POLL:', ''));
                          const votes = pollVotes[msg.id] || {};
                          let totalVotes = 0;
                          Object.values(votes).forEach((uids) => { totalVotes += uids.length; });

                          const durationLabel = 
                            pollData.duration === '8h' ? '⏱️ 8 Hours' :
                            pollData.duration === '24h' ? '⏱️ 24 Hours' :
                            '♾️ Always';

                          return (
                            <div className="bg-[#161824] border border-[#262A3C] rounded-2xl p-4 space-y-3 w-full max-w-xs sm:max-w-sm text-left shadow-lg">
                              <div className="flex items-center justify-between border-b border-[#202332] pb-2">
                                <span className="text-[10px] font-bold text-coral uppercase tracking-wider flex items-center gap-1">
                                  <BarChart2 className="w-3.5 h-3.5 text-coral" /> Squad Poll
                                </span>
                                <span className="text-[10px] font-mono text-[#8F96A6]">{durationLabel}</span>
                              </div>

                              <h4 className="font-bold text-xs md:text-sm text-white leading-snug">{pollData.question}</h4>

                              <div className="space-y-2">
                                {pollData.options.map((opt: string, optIdx: number) => {
                                  const optVoters = votes[optIdx] || [];
                                  const hasVoted = user?.id ? optVoters.includes(user.id) : false;
                                  const pct = totalVotes > 0 ? Math.round((optVoters.length / totalVotes) * 100) : 0;

                                  return (
                                    <button
                                      key={optIdx}
                                      onClick={() => handleVotePoll(msg.id, optIdx)}
                                      className={`w-full relative overflow-hidden rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                                        hasVoted 
                                          ? 'border-coral bg-coral/10' 
                                          : 'border-[#262A3C] bg-[#0E0F16] hover:border-coral/40'
                                      }`}
                                    >
                                      <div
                                        className="absolute inset-y-0 left-0 bg-coral/20 transition-all duration-300 pointer-events-none"
                                        style={{ width: `${pct}%` }}
                                      />
                                      <div className="relative z-10 flex items-center justify-between text-xs">
                                        <span className="font-semibold text-white truncate max-w-[70%]">{opt}</span>
                                        <span className="font-mono text-[11px] text-coral font-bold">{pct}% ({optVoters.length})</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="text-[10px] font-mono text-[#8F96A6] pt-1 flex items-center justify-between">
                                <span>{totalVotes} votes</span>
                                <span>Tap option to vote</span>
                              </div>
                            </div>
                          );
                        } catch (e) {
                          return <div className="text-xs text-white">{msg.content}</div>;
                        }
                      })()
                    ) : (
                      <div 
                        onContextMenu={(e) => {
                          e.preventDefault();
                          openMsgMenu(e.currentTarget as HTMLElement, msg, e.clientX, e.clientY);
                        }}
                        className={`px-4 py-2.5 rounded-2xl text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm cursor-pointer ${
                          isMe 
                            ? 'bg-coral text-white rounded-tr-xs font-medium' 
                            : 'bg-[#181A26] border border-[#26293B] text-[#E2E8F0] rounded-tl-xs'
                        }`}
                      >
                        {msg.content}
                      </div>
                    )}

                    {/* Reaction Pills */}
                    {Object.keys(msgReactions).length > 0 && (
                      <div className={`flex items-center gap-1 mt-1.5 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(msgReactions).map(([emoji, userIds]) => {
                          const userList = Array.isArray(userIds) ? userIds : [];
                          const count = userList.length;
                          if (count === 0) return null;
                          const currentUid = user?.id || 'me';
                          const hasReacted = userList.includes(currentUid) || userList.includes('me');
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleToggleReaction(msg.id, emoji)}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer border ${
                                hasReacted 
                                  ? 'bg-coral/20 border-coral text-coral font-bold shadow-sm scale-105' 
                                  : 'bg-[#1B1D28] border-[#2A2E40] text-[#8F96A6] hover:border-coral/50'
                              }`}
                              title={hasReacted ? 'Remove reaction' : `React with ${emoji}`}
                            >
                              <span>{emoji}</span>
                              <span>{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                  </div>

                  {/* Clean Hover Action Bar (Desktop) */}
                  <div className={`hidden md:flex absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1A1C28] border border-[#2A2E40] rounded-lg p-1 shadow-lg items-center gap-1 z-10 ${
                    isMe ? 'left-3' : 'right-3'
                  }`}>
                    {REACTION_EMOJIS.slice(0, 4).map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(msg.id, emoji)}
                        className="p-1 hover:bg-[#202330] rounded text-xs cursor-pointer"
                        title={`React ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      onClick={() => setCustomReactionMsgId(msg.id)}
                      className="p-1 text-[#8F96A6] hover:text-white hover:bg-[#202330] rounded text-xs cursor-pointer flex items-center justify-center"
                      title="Choose emoji from keyboard"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#8F96A6]" />
                    </button>
                    <div className="w-[1px] h-3 bg-[#2A2E40] my-auto"></div>
                    <button
                      onClick={() => setReplyingTo({ id: msg.id, name: msg.sender_name, content: msg.content })}
                      className="p-1 text-[#8F96A6] hover:text-white rounded cursor-pointer"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handlePinMessage(msg)}
                      className="p-1 text-[#8F96A6] hover:text-white rounded cursor-pointer"
                      title="Pin"
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleCopyText(msg.content)}
                      className="p-1 text-[#8F96A6] hover:text-white rounded cursor-pointer"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {(isMe || (room && room.created_by === user?.id)) && (
                      <button
                        onClick={() => handleDeleteRoomMessage(msg.id)}
                        className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded cursor-pointer"
                        title="Delete Message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {typingUser && (
            <div className="flex items-center gap-2 text-xs font-mono text-teal animate-pulse px-2 pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
              <span>{typingUser} is typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <footer className="p-4 bg-[#14151D] border-t border-[#202330] z-20 shrink-0 space-y-2">
          
          {/* Reply Banner (Prevent overflow of long messages) */}
          {replyingTo && (
            <div className="flex items-center justify-between bg-[#1A1C28] border border-coral/30 px-3 py-1.5 rounded-xl text-xs overflow-hidden max-w-full">
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden pr-2">
                <Reply className="w-3.5 h-3.5 text-coral shrink-0" />
                <div className="min-w-0 flex-1 text-[11px] truncate">
                  <span className="font-bold text-coral shrink-0 mr-1">Replying to @{replyingTo.name}:</span>
                  <span className="text-[#8F96A6] italic truncate">{replyingTo.content}</span>
                </div>
              </div>
              <button onClick={() => setReplyingTo(null)} className="text-[#8F96A6] hover:text-white p-0.5 shrink-0 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <div className="flex-1 bg-[#0E0F14] border border-[#202330] focus-within:border-coral rounded-xl py-2.5 px-3.5 flex items-center gap-2 min-w-0">
              <input
                type="text"
                placeholder={replyingTo ? `Replying to @${replyingTo.name}...` : 'Say hey...'}
                value={messageText}
                onChange={handleInputChange}
                className="w-full bg-transparent text-xs md:text-sm text-white placeholder-[#8F96A6] outline-none min-w-0"
                required
              />
            </div>

            {/* Poll Button in Chat Bar */}
            <button
              type="button"
              onClick={() => setShowPollModal(true)}
              className="p-2.5 rounded-xl bg-[#1B1D28] hover:bg-coral/20 text-coral border border-coral/30 transition-all cursor-pointer flex items-center justify-center shrink-0"
              title="Create Squad Poll"
            >
              <BarChart2 className="w-4 h-4 text-coral" />
            </button>

            <button
              type="submit"
              className="px-4 py-2.5 bg-coral hover:bg-coral-hover text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </footer>

      </div>

      {/* 3. RIGHT MEMBERS DRAWER (Collapsible & Outside-Click Backdrop) */}
      {showMembersDrawer && (
        <>
          <div 
            onClick={() => setShowMembersDrawer(false)}
            className="fixed inset-0 bg-black/40 z-30 animate-in fade-in cursor-pointer select-none"
          />
          <div className="fixed md:relative inset-y-0 right-0 z-40 w-64 bg-[#14151D] border-l border-[#202330] flex flex-col p-4 overflow-y-auto shrink-0 shadow-2xl md:shadow-none transition-all duration-200">
          <div className="flex items-center justify-between border-b border-[#202330] pb-3 mb-3">
            <div className="text-[10px] font-bold text-[#8F96A6] uppercase tracking-wider">
              Channel Members — {members.length}
            </div>
            <button
              onClick={() => setShowMembersDrawer(false)}
              className="text-[#8F96A6] hover:text-white p-1 cursor-pointer"
              title="Close Members List"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {members.map((m) => {
              const isRoomCreator = room && room.created_by === m.id;
              const cleanName = (m.name || 'Campus Student').replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F004}\u{1F0CF}]/gu, '').trim();
              return (
                <div key={m.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-[#1A1C28]/60 border border-[#202330]">
                  <div className="relative">
                    <img
                      src={getAvatarUrl(m.photos)}
                      alt={cleanName}
                      className="w-7 h-7 rounded-full object-cover border border-[#202330]"
                    />
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-teal ring-2 ring-[#14151D]"></span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-bold text-white truncate">{cleanName}</p>
                      {isRoomCreator && (
                        <span title="Host">
                          <Crown className="w-3 h-3 text-coral shrink-0" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#8F96A6] font-mono truncate">@{m.handle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}

      {/* Instagram-style Small Dropdown Box (Anchored directly below selected message) */}
      {mobileActionMsg && (() => {
        const isMsgAuthor = mobileActionMsg.sender_id === user?.id || mobileActionMsg.sender_id?.toString() === user?.id?.toString();
        const canDelete = isMsgAuthor || (room && room.created_by === user?.id);

        const posStyle = menuPos ? {
          position: 'fixed' as const,
          top: `${menuPos.top}px`,
          left: `${menuPos.left}px`
        } : {};

        return (
          <div 
            onClick={() => { setMobileActionMsg(null); setMenuPos(null); }}
            className="fixed inset-0 bg-black/25 z-[9999] animate-in fade-in duration-100 select-none"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={posStyle}
              className="w-56 bg-[#161822] border border-[#2B2F42] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 divide-y divide-[#202330]"
            >
              {/* Quick Emoji Reaction Row */}
              <div className="p-2 flex items-center justify-around bg-[#10111A]">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      handleToggleReaction(mobileActionMsg.id, emoji);
                      setMobileActionMsg(null);
                    }}
                    className="text-lg hover:scale-125 active:scale-95 transition-transform p-0.5 cursor-pointer"
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const targetId = mobileActionMsg.id;
                    setMobileActionMsg(null);
                    setCustomReactionMsgId(targetId);
                  }}
                  className="text-xs text-[#8F96A6] hover:text-white bg-[#1A1C28] border border-[#2B2F42] rounded-full w-6 h-6 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                  title="Choose emoji from keyboard"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Menu Options */}
              <div className="py-1 divide-y divide-[#202330]">
                <button
                  onClick={() => {
                    setReplyingTo({ id: mobileActionMsg.id, name: mobileActionMsg.name, content: mobileActionMsg.content });
                    setMobileActionMsg(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-white hover:bg-[#202330] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Reply className="w-3.5 h-3.5 text-teal shrink-0" />
                  <span>Reply</span>
                </button>

                <button
                  onClick={() => {
                    handleCopyText(mobileActionMsg.content);
                    setMobileActionMsg(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-white hover:bg-[#202330] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-[#8F96A6] shrink-0" />
                  <span>Copy Text</span>
                </button>

                <button
                  onClick={() => {
                    handlePinMessage({ id: mobileActionMsg.id, sender_name: mobileActionMsg.name, content: mobileActionMsg.content } as any);
                    setMobileActionMsg(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-white hover:bg-[#202330] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Pin className="w-3.5 h-3.5 text-coral shrink-0" />
                  <span>Pin Message</span>
                </button>

                {!isMsgAuthor && mobileActionMsg.sender_id && (
                  <button
                    onClick={() => {
                      const sId = mobileActionMsg.sender_id;
                      setMobileActionMsg(null);
                      router.push(`/profile/${sId}`);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-white hover:bg-[#202330] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-coral shrink-0" />
                    <span>View Profile</span>
                  </button>
                )}

                {!isMsgAuthor && (
                  <button
                    onClick={() => {
                      setMobileActionMsg(null);
                      try {
                        const existing = JSON.parse(localStorage.getItem('admin_reports') || '[]');
                        existing.unshift({
                          reported_user_id: mobileActionMsg.sender_id,
                          content_id: mobileActionMsg.id,
                          content_type: 'room_message',
                          reason: 'Reported in room chat',
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

                {canDelete && (
                  <button
                    onClick={() => {
                      const msgId = mobileActionMsg.id;
                      setMobileActionMsg(null);
                      handleDeleteRoomMessage(msgId);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Delete Message</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setMobileActionMsg(null)}
                className="w-full py-2 text-center text-[11px] font-bold text-[#8F96A6] hover:text-white bg-[#12131C] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {/* MODAL: CREATE SQUAD POLL */}
      {showPollModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#161822] border border-[#202330] rounded-2xl p-6 relative shadow-2xl space-y-4">
            <button
              onClick={() => setShowPollModal(false)}
              className="absolute top-4 right-4 p-2 text-[#8F96A6] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-coral/10 border border-coral/20 flex items-center justify-center text-coral">
                <BarChart2 className="w-4 h-4 text-coral" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create Squad Poll</h3>
                <p className="text-xs text-[#8F96A6]">Ask a question and set dynamic options</p>
              </div>
            </div>

            <form onSubmit={handleCreatePollSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8F96A6] mb-1.5 uppercase">Poll Question</label>
                <input
                  type="text"
                  placeholder="e.g. Which team will win today? or Where are we hanging out?"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  className="w-full bg-[#0E0F14] border border-[#202330] focus:border-coral rounded-xl py-2.5 px-3.5 text-xs text-white outline-none"
                  required
                />
              </div>

              {/* Options */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#8F96A6] uppercase">Options</label>
                  {pollOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={handleAddPollOption}
                      className="text-[11px] text-coral font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Option
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => handleUpdatePollOption(idx, e.target.value)}
                        className="flex-1 bg-[#0E0F14] border border-[#202330] focus:border-coral rounded-xl py-2 px-3 text-xs text-white outline-none"
                        required
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePollOption(idx)}
                          className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Poll Timing Selector (8 hours, 24 hours, always) */}
              <div>
                <label className="block text-xs font-semibold text-[#8F96A6] mb-1.5 uppercase">Poll Timing / Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '8h', label: '8 Hours', durationText: 'Active for 8h' },
                    { id: '24h', label: '24 Hours', durationText: 'Active for 24h' },
                    { id: 'always', label: 'Always', durationText: 'Always Active' }
                  ].map((time) => {
                    const isSelected = pollDuration === time.id;
                    return (
                      <button
                        key={time.id}
                        type="button"
                        onClick={() => setPollDuration(time.id as any)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          isSelected 
                            ? 'bg-coral/15 border-coral text-coral shadow-sm'
                            : 'bg-[#0E0F14] border-[#202330] text-[#8F96A6] hover:text-white'
                        }`}
                      >
                        <span>{time.label}</span>
                        <span className="text-[9px] font-mono font-normal opacity-80">{time.durationText}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-coral hover:bg-coral-hover text-white font-bold text-xs rounded-xl transition-all cursor-pointer mt-2"
              >
                Post Squad Poll 📊
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Instagram-style Custom Emoji Reaction Modal (Type from keyboard or tap from grid) */}
      {customReactionMsgId && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setCustomReactionMsgId(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#141622] border border-[#2B2F42] w-full max-w-sm rounded-3xl p-4 shadow-2xl space-y-3 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-[#202330] pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Smile className="w-4 h-4 text-coral" /> React with Keyboard Emoji
              </span>
              <button 
                onClick={() => setCustomReactionMsgId(null)}
                className="text-[#8F96A6] hover:text-white p-1 rounded-full hover:bg-[#202330] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Direct Input from Device Keyboard */}
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="Type or paste any emoji from your keyboard..."
                className="w-full bg-[#0D0E16] border border-[#262A3C] focus:border-coral rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#5A6075] outline-none text-center font-mono"
                onChange={(e) => {
                  const val = e.target.value;
                  const emojiMatch = val.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
                  if (emojiMatch && emojiMatch[0]) {
                    handleToggleReaction(customReactionMsgId, emojiMatch[0]);
                    setCustomReactionMsgId(null);
                  }
                }}
              />
              <p className="text-[10px] text-[#8F96A6] text-center mt-1">
                Open your device emoji keyboard or pick from below
              </p>
            </div>

            {/* Category Emojis Grid (IG / WhatsApp style extended list) */}
            <div className="max-h-48 overflow-y-auto pr-1 grid grid-cols-7 gap-2 pt-1 text-xl text-center scrollbar-thin">
              {['👍', '❤️', '🔥', '😂', '🚀', '💡', '💯', '🙌', '😍', '🎉', '⚡', '😭', '🤯', '😎', '👀', '✨', '👏', '🥳', '💩', '🤝', '🙈', '💀', '🤡', '⭐', '🍕', '☕', '🎮', '⚽', '🎸', '🎧', '⚡', '🔥', '🎁', '🏆', '📌'].map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    handleToggleReaction(customReactionMsgId, emoji);
                    setCustomReactionMsgId(null);
                  }}
                  className="p-1.5 hover:bg-[#202330] rounded-xl hover:scale-125 transition-transform cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
