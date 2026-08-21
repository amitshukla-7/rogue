'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  MessageSquare, 
  Compass, 
  Heart, 
  MessageCircle, 
  User as UserIcon, 
  Settings as SettingsIcon,
  Bell,
  Search,
  ShieldCheck,
  Zap,
  Users,
  LogIn,
  Flame,
  ShieldAlert,
  Ban,
  Send,
  AlertTriangle,
  X,
  Lightbulb,
  Lock
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { getAvatarUrl } from '../lib/avatar';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { User } from '@campusconnect/shared';
import FeedbackWidget from './feedback-widget';


interface UserContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  demoLogin: (userId?: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export function useAuth() {
  return useUser();
}

function SuspendedAccountView({ user, logout }: { user: User; logout: () => Promise<void> }) {
  const [appealText, setAppealText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealText.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      await apiFetch('/api/auth/appeal', {
        method: 'POST',
        body: JSON.stringify({ reason: appealText })
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit appeal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#0D0E15] p-6 font-sans">
      <div className="max-w-lg w-full bg-[#151722] border border-red-500/30 rounded-3xl p-8 shadow-2xl flex flex-col gap-6 text-white relative overflow-hidden">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mx-auto shadow-lg shadow-red-500/10">
          <Ban className="w-8 h-8" />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            Account Suspended
          </h2>
          <p className="text-xs text-text-muted mt-1">Your account privileges on CampusConnect have been suspended by administration.</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#1D202D] border border-[#2B2F42] text-xs">
          <span className="text-[10px] text-red-400 font-bold uppercase block mb-1">Reason for Suspension</span>
          <p className="text-white font-medium">{user.ban_reason || 'Violation of CampusConnect Community Guidelines & Safety Policies'}</p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmitAppeal} className="flex flex-col gap-3">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-coral" /> Apply for Review / Appeal
            </label>
            <textarea
              placeholder="Explain why your account should be reviewed or reinstated..."
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
              className="bg-[#1D202D] border border-[#2B2F42] focus:border-coral rounded-xl p-3 text-xs text-white placeholder-text-muted outline-none h-28 resize-none transition-all"
              required
            />
            {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !appealText.trim()}
              className="py-3 rounded-xl bg-coral hover:bg-coral-hover text-white text-xs font-bold transition-all shadow-lg shadow-coral/20 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Submitting Appeal...' : 'Submit Appeal to Admin'}
            </button>
          </form>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold text-center">
            ✓ Your appeal has been submitted to the Admin team for review. You will be notified once reviewed.
          </div>
        )}

        <div className="pt-4 border-t border-[#232635] flex items-center justify-between">
          <span className="text-[11px] text-text-muted">Signed in as <strong className="text-white">{user.email}</strong></span>
          <button
            onClick={() => logout()}
            className="px-4 py-2 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] text-xs font-bold text-coral transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoAccounts, setDemoAccounts] = useState<Array<{ id: string; name: string; branch: string; year: string; photos: string[] }>>([]);
  const [showDemoDropdown, setShowDemoDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [globalShowAuthModal, setGlobalShowAuthModal] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  const handleSearch = async (queryText: string) => {
    setSearchQuery(queryText);
    if (!queryText.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await apiFetch(`/api/users/search?q=${encodeURIComponent(queryText)}`);
      if (data && data.users) {
        setSearchResults(data.users);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  };


  const refreshUser = async () => {
    try {
      const data = await apiFetch('/api/users/me');
      if (data && data.user) {
        setUser(data.user);
        connectSocket();
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (targetUserId?: string) => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ userId: targetUserId })
      });
      if (data && data.user) {
        setUser(data.user);
        connectSocket();
        router.push('/');
      }
    } catch (err) {
      alert('Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      if (typeof window !== 'undefined') localStorage.removeItem('token');
      setUser(null);
      disconnectSocket();
      router.push('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const [warnings, setWarnings] = useState<any[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);

  // Notifications State (DMs, System Notifications)
  const [unreadMessages, setUnreadMessages] = useState<Array<{
    id: string;
    matchId: string;
    senderName: string;
    senderPhoto?: string;
    content: string;
    sentAt: string;
    read: boolean;
  }>>([]);
  // Comment Notifications State
  const [commentNotifs, setCommentNotifs] = useState<Array<{
    id: string;
    postId: string;
    postTitle: string;
    commenterName: string;
    commenterHandle: string;
    commenterPhoto?: string;
    content: string;
    sentAt: string;
    read: boolean;
  }>>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement | null>(null);
  const notifContainerRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setShowSearchResults(false);
        setSearchQuery('');
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(target)) {
        setShowNotificationsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    
    const handleRequireAuth = () => {
      setGlobalShowAuthModal(true);
    };
    window.addEventListener('require-auth', handleRequireAuth);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('require-auth', handleRequireAuth);
    };
  }, []);

  const [activeToast, setActiveToast] = useState<{
    matchId: string;
    senderName: string;
    senderPhoto?: string;
    content: string;
  } | null>(null);

  const fetchWarnings = async () => {
    try {
      const data = await apiFetch('/api/users/warnings');
      if (data && Array.isArray(data.warnings)) {
        setWarnings(data.warnings);
        const unread = data.warnings.filter((w: any) => !w.read);
        if (unread.length > 0) {
          setShowWarningModal(true);
        }
      }
    } catch (err) {}
  };

  const handleAcknowledgeWarning = async () => {
    try {
      await apiFetch('/api/users/warnings/mark-read', { method: 'POST' });
      setWarnings((prev) => prev.map((w) => ({ ...w, read: true })));
      setShowWarningModal(false);
    } catch (err) {
      setShowWarningModal(false);
    }
  };

  useEffect(() => {
    // Capture token from URL if present (from Google OAuth callback) to fix cross-domain cookie stripping
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        localStorage.setItem('token', urlToken);
        // Clean URL after capturing token
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    
    refreshUser();
    // Fetch demo accounts list for profile switcher
    apiFetch('/api/auth/demo-accounts')
      .then((data) => {
        if (data && Array.isArray(data)) setDemoAccounts(data);
      })
      .catch(() => {});

    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchWarnings();
    const socket = connectSocket();

    const handleUserWarning = (warning: any) => {
      setWarnings((prev) => [warning, ...prev]);
      setShowWarningModal(true);
    };

    const handleBroadcastAnnouncement = (announcement: any) => {
      const newWarn = {
        id: announcement.id || `bc-${Date.now()}`,
        item_title: announcement.title || '📢 Campus Broadcast',
        warning_message: announcement.message,
        reason: 'Official Campus Broadcast',
        created_at: announcement.created_at || new Date().toISOString(),
        read: false
      };
      setWarnings((prev) => [newWarn, ...prev]);
      setShowWarningModal(true);
    };

    const handleNotificationMessage = (data: any) => {
      const isCurrentChat = pathname.includes(`/chat/${data.matchId}`);
      const newNotif = {
        id: data.messageId || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        matchId: data.matchId,
        senderName: data.senderName || 'Campus Peer',
        senderPhoto: data.senderPhoto,
        content: data.content || 'Sent a message',
        sentAt: data.sentAt || new Date().toISOString(),
        read: isCurrentChat,
      };

      setUnreadMessages((prev) => [newNotif, ...prev]);

      if (!isCurrentChat) {
        setActiveToast({
          matchId: data.matchId,
          senderName: data.senderName || 'Campus Peer',
          senderPhoto: data.senderPhoto,
          content: data.content || 'Sent a message',
        });
        setTimeout(() => {
          setActiveToast(null);
        }, 5000);
      }
    };

    const handleNotificationComment = (data: any) => {
      setCommentNotifs((prev) => [{
        id: `cnotif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        postId: data.postId,
        postTitle: data.postTitle || 'your post',
        commenterName: data.commenterName || 'Someone',
        commenterHandle: data.commenterHandle || 'student',
        commenterPhoto: data.commenterPhoto,
        content: data.content || 'commented',
        sentAt: data.sentAt || new Date().toISOString(),
        read: false
      }, ...prev]);
    };

    if (socket) {
      socket.on('user:warning', handleUserWarning);
      socket.on('broadcast:announcement', handleBroadcastAnnouncement);
      socket.on('notification:message', handleNotificationMessage);
      socket.on('notification:comment', handleNotificationComment);
    }

    return () => {
      if (socket) {
        socket.off('user:warning', handleUserWarning);
        socket.off('broadcast:announcement', handleBroadcastAnnouncement);
        socket.off('notification:message', handleNotificationMessage);
        socket.off('notification:comment', handleNotificationComment);
      }
    };
  }, [user?.id, pathname]);

  useEffect(() => {
    if (pathname.startsWith('/chat')) {
      setUnreadMessages((prev) => prev.map((m) => ({ ...m, read: true })));
    }
  }, [pathname]);

  useEffect(() => {
    if (loading) return;

    const isPublicAuthPage = pathname === '/login' || pathname === '/signup';
    const isAdminRoute = pathname.startsWith('/admin');

    if (!user) {
      if (isAdminRoute && !isPublicAuthPage) {
        router.push('/login');
      }
      return;
    }

    const isAdminUser = user.email === 'amitkumarshukla296@gmail.com' || user.is_admin;
    if (isAdminRoute && !isAdminUser) {
      router.push('/');
      return;
    }

    // First-time users without a handle set should complete onboarding (edit profile)
    const isFirstTime = !user.handle;
    if (isFirstTime && !isAdminUser && pathname !== '/onboarding' && !isPublicAuthPage) {
      router.push('/onboarding');
      return;
    }
  }, [user, loading, pathname]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#0D0E15]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-coral border-t-transparent"></div>
          <p className="font-sans text-xs text-text-muted animate-pulse">Loading Rogue...</p>
        </div>
      </div>
    );
  }

  const isPublicAuthPage = pathname === '/login' || pathname === '/signup';
  const isAdminRoute = pathname.startsWith('/admin');
  
  if (isAdminRoute || isPublicAuthPage) {
    return <UserContext.Provider value={{ user, loading, refreshUser, logout, demoLogin }}>{children}</UserContext.Provider>;
  }

  if (user?.is_banned) {
    return (
      <UserContext.Provider value={{ user, loading, refreshUser, logout, demoLogin }}>
        <SuspendedAccountView user={user} logout={logout} />
      </UserContext.Provider>
    );
  }

  const firstSegment = pathname.split('/')[1];
  const activeTab = firstSegment === '' ? 'home' : firstSegment;

  const navItems = [
    { id: 'home', name: 'Feed', icon: Flame, href: '/' },
    { id: 'rooms', name: 'Rooms', icon: MessageSquare, href: '/rooms' },
    { id: 'discover', name: 'Discover', icon: Compass, href: '/discover' },
    { id: 'chat', name: 'Chats', icon: MessageCircle, href: '/chat' },
    { id: 'profile', name: 'Profile', icon: UserIcon, href: '/profile' },
  ];


  return (
    <UserContext.Provider value={{ user, loading, refreshUser, logout, demoLogin }}>
      <div className="flex flex-col h-[100dvh] w-full bg-[#0D0E15] text-white overflow-hidden font-sans select-none">
        
        <div className="flex flex-1 overflow-hidden">
          {/* DESKTOP SIDEBAR */}
          <aside className="hidden lg:flex flex-col w-64 bg-[#0D0E15] border-r border-[#232635] p-5 flex-shrink-0 justify-between">
            <div className="flex flex-col gap-6">
              {/* Logo Header */}
              <Link href="/" className="flex items-center gap-2.5 px-2 group cursor-pointer">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 shadow-lg shadow-coral/30 group-hover:scale-105 transition-transform flex-shrink-0">
                  <img src="/logo.png" alt="Rogue" className="w-full h-full object-cover" />
                </div>
                <span className="text-lg font-bold tracking-tight text-white font-sans group-hover:text-coral transition-colors">
                  Rogue
                </span>
              </Link>

              {/* Navigation Links */}
              <nav className="flex flex-col gap-1.5">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id || (item.id === 'chat' && pathname.startsWith('/chat'));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all duration-150 ${
                        isActive 
                          ? 'bg-coral text-white font-semibold shadow-lg shadow-coral/25' 
                          : 'text-text-muted hover:text-white hover:bg-[#151722]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-text-muted'}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.id === 'chat' && unreadMessages.some((m) => !m.read) && (
                        <span className="w-2.5 h-2.5 rounded-full bg-coral animate-pulse border-2 border-[#0D0E15]" title="New messages"></span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex flex-col gap-2 relative">
              {/* Super Admin Only Link */}
              {user && (user.email === 'amitkumarshukla296@gmail.com' || user.is_admin) && (
                <Link
                  href="/admin"
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-coral bg-coral/10 hover:bg-coral hover:text-white border border-coral/30 transition-all cursor-pointer w-full"
                >
                  <ShieldCheck className="w-4 h-4 text-coral group-hover:text-white" />
                  <span>Admin Panel</span>
                </Link>
              )}

              {/* Subtle Feedback & Suggestion link */}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-feedback-widget'))}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-white hover:bg-[#151722] transition-all cursor-pointer w-full text-left"
              >
                <Lightbulb className="w-4 h-4 text-coral" />
                <span>Feedback & Ideas</span>
              </button>

              {/* User Profile Panel Footer or Sign In Button */}
              {user ? (
                <Link
                  href="/profile"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-[#151722] border border-[#232635] hover:bg-[#1C1E2C] transition-all group"
                >
                  <div className="w-9 h-9 rounded-full bg-[#232635] overflow-hidden flex-shrink-0 flex items-center justify-center relative border border-white/10">
                    {user.photos && user.photos.length > 0 ? (
                      <img src={user.photos[0]} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-white truncate group-hover:text-coral transition-colors">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-text-muted">{user.email}</span>
                  </div>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="w-full py-3 rounded-2xl bg-coral hover:bg-coral-hover text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-coral/20"
                >
                  <LogIn className="w-4 h-4" /> Sign In / Register
                </Link>
              )}
            </div>
          </aside>
          {/* MAIN VIEWPORT CONTAINER */}
          <div className="flex flex-col flex-1 overflow-hidden relative">
            
            {(() => {
              const isIndividualRoom = pathname.startsWith('/rooms/') && pathname !== '/rooms';
              if (isIndividualRoom) return null;

              return (
                <>
                  {/* DESKTOP TOP HEADER */}
                  <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-[#232635] bg-[#0D0E15] z-20">
                    {/* Interactive Search Bar */}
                    <div ref={searchContainerRef} className="relative max-w-md w-full">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-text-muted">
                        <Search className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        placeholder="Search students by name, handle or branch..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        onFocus={() => setShowSearchResults(true)}
                        className="w-full bg-[#151722] border border-[#232635] focus:border-coral rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-text-muted outline-none transition-all"
                      />

                      {/* Dropdown Search Results */}
                      {showSearchResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#151722] border border-[#232635] rounded-2xl p-2 shadow-2xl z-50 divide-y divide-[#232635]">
                          <div className="px-2 py-1 text-[10px] text-text-muted font-mono uppercase font-bold">
                            Student Search Results ({searchResults.length})
                          </div>
                          {searchResults.map((sUser) => (
                            <Link
                              key={sUser.id}
                              href={`/profile/${sUser.id}`}
                              onClick={() => {
                                setShowSearchResults(false);
                                setSearchQuery('');
                              }}
                              className="flex items-center gap-3 p-2 hover:bg-[#232635] rounded-xl transition-colors"
                            >
                              <img
                                src={getAvatarUrl(sUser.photos)}
                                alt={sUser.name}
                                className="w-7 h-7 rounded-full object-cover border border-coral"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">{sUser.name}</p>
                                <p className="text-[10px] text-coral font-mono">@{sUser.handle} • {sUser.branch}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right Action Bar */}
                    <div className="flex items-center gap-3">
                      {/* Notifications Bell Dropdown */}
                      <div ref={notifContainerRef} className="relative">
                        <button 
                          onClick={() => {
                            if (!user) {
                              setGlobalShowAuthModal(true);
                              return;
                            }
                            if (warnings.some(w => !w.read)) {
                              setShowWarningModal(true);
                            } else {
                              setShowNotificationsDropdown(!showNotificationsDropdown);
                            }
                          }}
                          className="w-9 h-9 rounded-xl bg-[#151722] border border-[#232635] flex items-center justify-center text-text-muted hover:text-white transition-colors relative cursor-pointer"
                          title="Notifications & Moderation Warnings"
                        >
                          <Bell className="w-4 h-4" />
                          {warnings.some(w => !w.read) ? (
                            <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-black text-[9px] font-extrabold flex items-center justify-center animate-pulse shadow-md shadow-amber-500/30">
                              {warnings.filter(w => !w.read).length}
                            </span>
                          ) : (unreadMessages.some(m => !m.read) || commentNotifs.some(c => !c.read)) ? (
                            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-coral animate-pulse border-2 border-[#151722]"></span>
                          ) : null}
                        </button>

                        {showNotificationsDropdown && (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 mt-2 w-80 bg-[#141622] border border-[#232635] rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150"
                          >
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#232635]">
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                <Bell className="w-3.5 h-3.5 text-coral" /> Notifications
                              </h4>
                              <button
                                onClick={() => {
                                  setUnreadMessages(prev => prev.map(m => ({ ...m, read: true })));
                                  setCommentNotifs(prev => prev.map(c => ({ ...c, read: true })));
                                  handleAcknowledgeWarning();
                                  setShowNotificationsDropdown(false);
                                }}
                                className="text-[10px] text-coral font-semibold hover:underline cursor-pointer"
                              >
                                Mark all read
                              </button>
                            </div>

                            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                              {unreadMessages.length === 0 && commentNotifs.length === 0 && warnings.length === 0 ? (
                                <p className="text-xs text-[#8F96A6] text-center py-4">No new notifications</p>
                              ) : (
                                <>
                                  {/* Broadcasts & Official System Warnings */}
                                  {warnings.map((warn) => (
                                    <div
                                      key={warn.id || Math.random().toString()}
                                      onClick={() => {
                                        setShowWarningModal(true);
                                        setShowNotificationsDropdown(false);
                                      }}
                                      className={`p-2.5 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${
                                        !warn.read ? 'bg-amber-500/10 border-amber-500/40' : 'bg-[#151722] border-[#232635]'
                                      }`}
                                    >
                                      <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex-shrink-0 flex items-center justify-center font-bold text-xs border border-amber-500/30">
                                        📢
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                          <p className="text-xs font-bold text-amber-300 truncate">
                                            {warn.item_title || '📢 Official Broadcast'}
                                          </p>
                                          <span className="text-[9px] text-[#8F96A6] font-mono shrink-0 ml-1">
                                            {new Date(warn.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-white truncate font-medium">{warn.warning_message || warn.reason}</p>
                                      </div>
                                    </div>
                                  ))}

                                  {/* Comment Notifications */}
                                  {commentNotifs.map((notif) => (
                                    <div
                                      key={notif.id}
                                      onClick={() => {
                                        setCommentNotifs(prev => prev.map(c => c.id === notif.id ? { ...c, read: true } : c));
                                        setShowNotificationsDropdown(false);
                                        router.push('/');
                                      }}
                                      className={`p-2.5 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${
                                        !notif.read ? 'bg-[#1D202E] border-coral/30' : 'bg-[#151722] border-[#232635]'
                                      }`}
                                    >
                                      <div className="w-8 h-8 rounded-full bg-[#262936] overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                                        {notif.commenterPhoto ? (
                                          <img src={notif.commenterPhoto} alt={notif.commenterName} className="w-full h-full object-cover" />
                                        ) : (
                                          notif.commenterName.charAt(0)
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                          <p className="text-xs font-bold text-white truncate">
                                            <span className="text-coral">@{notif.commenterHandle}</span> commented
                                          </p>
                                          <span className="text-[9px] text-[#8F96A6] font-mono shrink-0 ml-1">
                                            {new Date(notif.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-[#8F96A6] truncate italic">"{notif.content}"</p>
                                        <p className="text-[10px] text-[#5B6070] truncate">on: {notif.postTitle}</p>
                                      </div>
                                    </div>
                                  ))}

                                  {/* DM Notifications */}
                                  {unreadMessages.map((notif) => (
                                    <div
                                      key={notif.id}
                                      onClick={() => {
                                        router.push(`/chat/${notif.matchId}`);
                                        setShowNotificationsDropdown(false);
                                      }}
                                      className={`p-2.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-3 ${
                                        !notif.read ? 'bg-[#1D202E] border-coral/30' : 'bg-[#151722] border-[#232635]'
                                      }`}
                                    >
                                      <div className="w-8 h-8 rounded-full bg-[#262936] overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                                        {notif.senderPhoto ? (
                                          <img src={notif.senderPhoto} alt={notif.senderName} className="w-full h-full object-cover" />
                                        ) : (
                                          notif.senderName.charAt(0)
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                          <p className="text-xs font-bold text-white truncate">{notif.senderName}</p>
                                          <span className="text-[9px] text-[#8F96A6] font-mono">
                                            {new Date(notif.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-[#8F96A6] truncate">{notif.content}</p>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Super Admin Quick Link */}
                      {user && (user.email === 'amitkumarshukla296@gmail.com' || user.is_admin) && (
                        <Link
                          href="/admin"
                          className="px-3 py-1.5 rounded-xl bg-coral/10 hover:bg-coral text-coral hover:text-white border border-coral/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Open Admin Portal"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Admin Panel</span>
                        </Link>
                      )}

                      {user ? (
                        <Link href="/profile" className="w-9 h-9 rounded-full bg-[#232635] overflow-hidden border border-white/10 flex items-center justify-center">
                          <img src={getAvatarUrl(user.photos)} alt={user.name} className="w-full h-full object-cover" />
                        </Link>
                      ) : (
                        <Link
                          href="/login"
                          className="px-3.5 py-1.5 rounded-xl bg-coral text-white text-xs font-bold cursor-pointer"
                        >
                          Sign In
                        </Link>
                      )}
                    </div>
                  </header>

                  {/* MOBILE TOP HEADER */}
                  <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0D0E15] border-b border-[#232635] z-20">
                    <div className="flex items-center gap-2">
                      <Link href="/" className="w-8 h-8 rounded-full overflow-hidden border border-white/10 flex items-center justify-center shadow-md shadow-coral/20 flex-shrink-0">
                        <img src="/logo.png" alt="Rogue" className="w-full h-full object-cover" />
                      </Link>
                      <span className="text-sm font-bold tracking-tight text-white font-sans">
                        Rogue
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Mobile Lightbulb / Feedback button */}
                      <button
                        onClick={() => {
                          if (!user) {
                            setGlobalShowAuthModal(true);
                            return;
                          }
                          window.dispatchEvent(new CustomEvent('open-feedback-widget'));
                        }}
                        className="w-8 h-8 rounded-xl bg-[#151722] border border-[#232635] flex items-center justify-center text-coral hover:text-white transition-colors cursor-pointer"
                        title="Send Feedback to Admin"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                      </button>

                      {/* Mobile Notification Bell */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            if (!user) {
                              setGlobalShowAuthModal(true);
                              return;
                            }
                            if (warnings.some(w => !w.read)) {
                              setShowWarningModal(true);
                            } else {
                              setShowNotificationsDropdown(!showNotificationsDropdown);
                            }
                          }}
                          className="w-8 h-8 rounded-xl bg-[#151722] border border-[#232635] flex items-center justify-center text-text-muted hover:text-white transition-colors relative cursor-pointer"
                          title="Notifications"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          {warnings.some(w => !w.read) ? (
                            <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-amber-500 text-black text-[8px] font-extrabold flex items-center justify-center animate-pulse">
                              {warnings.filter(w => !w.read).length}
                            </span>
                          ) : (unreadMessages.some(m => !m.read) || commentNotifs.some(c => !c.read)) ? (
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-coral animate-pulse border-2 border-[#151722]"></span>
                          ) : null}
                        </button>

                        {showNotificationsDropdown && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowNotificationsDropdown(false)} />
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 mt-2 w-72 bg-[#141622] border border-[#232635] rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150"
                            >
                              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#232635]">
                                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                  <Bell className="w-3.5 h-3.5 text-coral" /> Notifications
                                </h4>
                                <button
                                  onClick={() => {
                                    setUnreadMessages(prev => prev.map(m => ({ ...m, read: true })));
                                    setCommentNotifs(prev => prev.map(c => ({ ...c, read: true })));
                                    setShowNotificationsDropdown(false);
                                  }}
                                  className="text-[10px] text-coral font-semibold hover:underline cursor-pointer"
                                >
                                  Mark all read
                                </button>
                              </div>

                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {unreadMessages.length === 0 && commentNotifs.length === 0 ? (
                                  <p className="text-xs text-[#8F96A6] text-center py-4">No new notifications</p>
                                ) : (
                                  <>
                                    {commentNotifs.map((notif) => (
                                      <div
                                        key={notif.id}
                                        onClick={() => {
                                          setCommentNotifs(prev => prev.map(c => c.id === notif.id ? { ...c, read: true } : c));
                                          setShowNotificationsDropdown(false);
                                          router.push('/');
                                        }}
                                        className={`p-2.5 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${!notif.read ? 'bg-[#1D202E] border-coral/30' : 'bg-[#151722] border-[#232635]'}`}
                                      >
                                        <div className="w-7 h-7 rounded-full bg-[#262936] overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                                          {notif.commenterPhoto ? <img src={notif.commenterPhoto} alt={notif.commenterName} className="w-full h-full object-cover" /> : notif.commenterName.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold text-white truncate"><span className="text-coral">@{notif.commenterHandle}</span> commented</p>
                                          <p className="text-[11px] text-[#8F96A6] truncate italic">"{notif.content}"</p>
                                        </div>
                                      </div>
                                    ))}
                                    {unreadMessages.map((notif) => (
                                      <div
                                        key={notif.id}
                                        onClick={() => { router.push(`/chat/${notif.matchId}`); setShowNotificationsDropdown(false); }}
                                        className={`p-2.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-3 ${!notif.read ? 'bg-[#1D202E] border-coral/30' : 'bg-[#151722] border-[#232635]'}`}
                                      >
                                        <div className="w-7 h-7 rounded-full bg-[#262936] overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                                          {notif.senderPhoto ? <img src={notif.senderPhoto} alt={notif.senderName} className="w-full h-full object-cover" /> : notif.senderName.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold text-white truncate">{notif.senderName}</p>
                                          <p className="text-[11px] text-[#8F96A6] truncate">{notif.content}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Mobile User Profile Avatar or Sign In */}
                      {user ? (
                        <Link href="/profile" className="w-8 h-8 rounded-full bg-[#232635] overflow-hidden border border-white/10 flex items-center justify-center">
                          {user?.photos && user.photos.length > 0 ? (
                            <img src={user.photos[0]} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="w-3.5 h-3.5 text-text-muted" />
                          )}
                        </Link>
                      ) : (
                        <Link
                          href="/login"
                          className="px-2.5 py-1 rounded-xl bg-coral text-white text-[10px] font-bold cursor-pointer"
                        >
                          Sign In
                        </Link>
                      )}
                    </div>
                  </header>
                </>
              );
            })()}



            {/* PAGE CONTENT */}
            {(() => {
              const isIndividualRoom = pathname.startsWith('/rooms/') && pathname !== '/rooms';
              const isPublicRoute = pathname === '/' || pathname === '/rooms';
              const showLockScreen = !user && !isPublicRoute;
              return (
                <>
                  <main className={`flex-1 overflow-y-auto ${isIndividualRoom ? 'pb-0' : 'pb-20 lg:pb-0'} relative bg-[#0D0E15]`}>
                    {showLockScreen ? (
                      <div className="flex h-full w-full items-center justify-center p-6 bg-[#0D0E15]">
                        <div className="flex flex-col items-center justify-center text-center max-w-[340px] w-full animate-in fade-in duration-500">
                          <div className="w-12 h-12 rounded-full bg-coral/10 border border-coral/20 flex items-center justify-center mb-4 shadow-sm">
                            <Lock className="w-5 h-5 text-coral" />
                          </div>
                          <h2 className="text-base font-bold text-white tracking-wide mb-1.5">Restricted Area</h2>
                          <p className="text-[13px] text-[#8F96A6] mb-6 leading-relaxed">
                            This section is reserved for verified students. Create an account to unlock your campus network.
                          </p>
                          <Link href="/login" className="w-full py-2.5 bg-coral hover:bg-coral-hover text-white rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm">
                            <LogIn className="w-3.5 h-3.5" /> Sign In to Access
                          </Link>
                          <Link href="/" className="mt-4 text-xs font-semibold text-[#5A5F73] hover:text-white transition-colors cursor-pointer">
                            Return to Campus Feed
                          </Link>
                        </div>
                      </div>
                    ) : (
                      children
                    )}
                  </main>

                  {/* MOBILE BOTTOM NAVIGATION BAR */}
                  {!isIndividualRoom && (
                    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#151722]/95 backdrop-blur-md border-t border-[#232635] flex items-center justify-around px-2 z-30 shadow-2xl">
                      {[
                        { id: 'home', name: 'Feed', icon: Flame, href: '/' },
                        { id: 'rooms', name: 'Rooms', icon: MessageSquare, href: '/rooms' },
                        { id: 'discover', name: 'Discover', icon: Compass, href: '/discover' },
                        { id: 'chat', name: 'Chats', icon: MessageCircle, href: '/chat' },
                        { id: 'profile', name: 'Profile', icon: UserIcon, href: '/profile' },
                      ].map((item) => {
                        const isActive = activeTab === item.id || (item.id === 'chat' && pathname.startsWith('/chat'));
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            className={`flex flex-col items-center gap-1 py-1 px-3 transition-all relative ${
                              isActive ? 'text-coral font-bold scale-105' : 'text-text-muted hover:text-white'
                            }`}
                          >
                            <div className="relative">
                              <Icon className="w-5 h-5" />
                              {item.id === 'chat' && unreadMessages.some((m) => !m.read) && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-coral animate-pulse border-2 border-[#151722]"></span>
                              )}
                            </div>
                            <span className="text-[10px] tracking-wide">{item.name}</span>
                          </Link>
                        );
                      })}
                    </nav>
                  )}
                </>
              );
            })()}
          </div>



        {/* INSTAGRAM-STYLE FLOATING MESSAGE NOTIFICATION TOAST */}
        {activeToast && (
          <div
            onClick={() => {
              router.push(`/chat/${activeToast.matchId}`);
              setActiveToast(null);
            }}
            className="fixed top-4 right-4 z-50 max-w-sm w-full bg-[#161822] border border-coral/50 text-white p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer animate-in slide-in-from-top-5 duration-200 hover:scale-[1.02] transition-transform"
          >
            <div className="w-9 h-9 rounded-full bg-coral/20 border border-coral/40 flex items-center justify-center flex-shrink-0 font-bold text-xs text-coral overflow-hidden">
              {activeToast.senderPhoto ? (
                <img src={activeToast.senderPhoto} alt={activeToast.senderName} className="w-full h-full object-cover" />
              ) : (
                activeToast.senderName.charAt(0)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">
                💬 {activeToast.senderName} sent a message
              </p>
              <p className="text-[11px] text-[#8F96A6] truncate font-normal">
                {activeToast.content}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveToast(null);
              }}
              className="text-[#8F96A6] hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* OFFICIAL MODERATION WARNING POPUP MODAL */}
        {showWarningModal && warnings.filter(w => !w.read).length > 0 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="max-w-md w-full bg-[#151722] border-2 border-amber-500/80 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-white relative overflow-hidden">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto shadow-lg shadow-amber-500/10">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div className="text-center">
                <h3 className="text-xl font-bold text-amber-400 flex items-center justify-center gap-2">
                  Official Moderation Warning
                </h3>
                <p className="text-xs text-text-muted mt-1">An administrator has reviewed your content and issued an official warning.</p>
              </div>

              <div className="flex flex-col gap-3 max-h-60 overflow-y-auto">
                {warnings.filter(w => !w.read).map((warn) => (
                  <div key={warn.id} className="p-4 rounded-2xl bg-[#1D202D] border border-amber-500/30 flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded uppercase">
                        {warn.content_type?.replace('_', ' ')} Removed
                      </span>
                      <span className="text-[9px] text-text-muted">{new Date(warn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-white font-medium leading-relaxed">{warn.warning_message}</p>
                    <p className="text-[10px] text-red-400 font-mono mt-1">⚠️ Warning: Repeat violations will lead to an immediate account ban & suspension.</p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAcknowledgeWarning}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                I Understand & Acknowledge Warning
              </button>
            </div>
          </div>
        )}

        {/* Global Feedback & Suggestion Floating Widget */}
        {user && <FeedbackWidget />}

        {/* Global Flashy Auth Modal for interacting on public pages without login */}
        {globalShowAuthModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setGlobalShowAuthModal(false)}></div>
            <div className="bg-[#111218]/95 backdrop-blur-xl border border-[#202330] rounded-2xl p-6 shadow-2xl max-w-[340px] w-full relative z-10 flex flex-col text-left animate-in slide-in-from-bottom-8 fade-in duration-300">
              <button onClick={() => setGlobalShowAuthModal(false)} className="absolute top-4 right-4 text-[#8F96A6] hover:text-white transition-colors cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-3.5 mb-3.5">
                <div className="w-10 h-10 rounded-full bg-coral/10 border border-coral/20 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-coral" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">Sign in to interact</h2>
                  <p className="text-[11px] text-[#8F96A6] mt-0.5">
                    Join the campus network
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#A0A6B8] mb-5 leading-relaxed">
                You're in view-only mode. Create an account to post, vote, and chat with peers.
              </p>
              
              <div className="flex items-center gap-3">
                <button onClick={() => setGlobalShowAuthModal(false)} className="flex-1 py-2.5 rounded-xl bg-[#1A1C28] hover:bg-[#232738] text-white text-xs font-semibold transition-colors cursor-pointer">
                  Not Now
                </button>
                <Link href="/login" onClick={() => setGlobalShowAuthModal(false)} className="flex-1 py-2.5 rounded-xl bg-coral hover:bg-coral-hover text-white text-xs font-bold transition-colors text-center cursor-pointer">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  </UserContext.Provider>
);
}
