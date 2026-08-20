'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Activity, 
  Flag, 
  Users as UsersIcon, 
  FileText, 
  ShieldAlert, 
  Trash2, 
  CheckCircle, 
  Ban, 
  UserCheck, 
  ChevronDown, 
  Search, 
  RefreshCw, 
  LogOut, 
  ArrowLeft,
  Sparkles,
  MessageSquare,
  Flame,
  Clock,
  User as UserIcon,
  ShieldCheck,
  AlertTriangle,
  Send,
  Download,
  FileSpreadsheet,
  Zap,
  Megaphone,
  Award,
  X
} from 'lucide-react';
import { useAuth } from '../../components/layout-wrapper';
import { apiFetch } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Report, AdminAction } from '@campusconnect/shared';

interface PreRegistrationItem {
  id: string;
  name: string;
  email: string;
  handle?: string | null;
  google_id?: string | null;
  college_verified: boolean;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string;
  photos: string[];
  position: number;
  founder_badge?: string | null;
  ref_code?: string;
  referred_by?: string;
  referral_count?: number;
}

interface FeedItem {
  id: string;
  type: 'post' | 'room_message';
  author_id: string;
  author_name: string;
  author_handle?: string;
  author_photo?: string | null;
  title?: string | null;
  content: string;
  room_id?: string | null;
  room_name?: string | null;
  media_url?: string | null;
  created_at: string;
  isNew?: boolean;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  handle?: string;
  year?: string | null;
  branch?: string | null;
  photos: string[];
  college_verified: boolean;
  is_admin: boolean;
  is_banned: boolean;
  ban_reason?: string | null;
  created_at: string;
}

interface Appeal {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface RoomItem {
  id: string;
  name: string;
  type: string;
  created_by?: string | null;
  creator_name?: string;
  creator_handle?: string;
  member_count: number;
  message_count: number;
  expires_at?: string | null;
  created_at: string;
}

interface PosterEvent {
  id: number;
  email: string;
  name?: string | null;
  handle?: string | null;
  action: 'download' | 'share';
  poster_theme: string;
  created_at: string;
}

export default function AdminDashboardPage() {
  const { user: currentUser, logout } = useAuth();

  if (!currentUser || currentUser.email !== 'amitkumarshukla296@gmail.com') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#0E0F14] text-white p-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-6xl font-bold font-mono text-coral">404</h1>
          <h2 className="text-xl font-bold">Page Not Found</h2>
          <p className="text-sm text-[#8F96A6]">The page you are looking for does not exist or has been moved.</p>
          <Link href="/" className="inline-block px-5 py-2.5 bg-coral text-white font-bold text-xs rounded-xl hover:bg-coral-hover transition-all">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const user = currentUser;
  const [activeTab, setActiveTab] = useState<'feed' | 'reports' | 'appeals' | 'users' | 'rooms' | 'actions' | 'pre_registrations' | 'referrals' | 'poster_events'>('pre_registrations');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Broadcast Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastUrgency, setBroadcastUrgency] = useState<'normal' | 'high' | 'critical'>('normal');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Pre-Registrations & Referral state
  const [preRegList, setPreRegList] = useState<PreRegistrationItem[]>([]);
  const [preRegLoading, setPreRegLoading] = useState(true);
  const [preRegSearch, setPreRegSearch] = useState('');
  const [referralSearch, setReferralSearch] = useState('');
  const [referralFilter, setReferralFilter] = useState<'all' | 'referrers' | 'referred'>('all');
  const [referralSort, setReferralSort] = useState<'referrals' | 'position'>('referrals');

  // Rooms state
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomSearch, setRoomSearch] = useState('');

  // Delete Room Modal state
  const [deleteRoomItem, setDeleteRoomItem] = useState<RoomItem | null>(null);
  const [deleteRoomReason, setDeleteRoomReason] = useState('');
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);

  // Feed state
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedSearch, setFeedSearch] = useState('');
  const [newReportAlert, setNewReportAlert] = useState(false);

  // Removal Modal state
  const [removeItem, setRemoveItem] = useState<FeedItem | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);

  // Reports state
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  // Appeals state
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(true);

  // Users state
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Ban Modal state
  const [banTargetUser, setBanTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [banReasonInput, setBanReasonInput] = useState('');
  const [isBanning, setIsBanning] = useState(false);

  // Action Log state
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(true);

  // Poster Events state
  const [posterEvents, setPosterEvents] = useState<PosterEvent[]>([]);
  const [posterEventsLoading, setPosterEventsLoading] = useState(true);
  const [posterEventsSearch, setPosterEventsSearch] = useState('');

  // Data Fetching Functions
  const fetchFeed = async () => {
    setFeedLoading(true);
    try {
      const data = await apiFetch('/api/admin/feed');
      if (Array.isArray(data)) setFeedItems(data);
    } catch (err: any) {
      if (!err?.message?.includes('Unauthorized')) console.error('Error fetching admin feed:', err);
    } finally {
      setFeedLoading(false);
    }
  };

  const fetchAppeals = async () => {
    setAppealsLoading(true);
    try {
      const data = await apiFetch('/api/admin/appeals');
      if (Array.isArray(data)) setAppeals(data);
    } catch (err: any) {
      if (!err?.message?.includes('Unauthorized')) console.error('Error fetching admin appeals:', err);
    } finally {
      setAppealsLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const data = await apiFetch('/api/admin/reports');
      if (Array.isArray(data)) setReports(data);
    } catch (err: any) {
      if (!err?.message?.includes('Unauthorized')) console.error('Error fetching admin reports:', err);
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchUsers = async (queryStr = '') => {
    setUsersLoading(true);
    try {
      const path = queryStr ? `/api/admin/users?q=${encodeURIComponent(queryStr)}` : '/api/admin/users';
      const data = await apiFetch(path);
      if (Array.isArray(data)) setUsersList(data);
    } catch (err: any) {
      if (!err?.message?.includes('Unauthorized')) console.error('Error fetching admin users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchActions = async () => {
    setActionsLoading(true);
    try {
      const data = await apiFetch('/api/admin/actions');
      if (Array.isArray(data)) setActions(data);
    } catch (err: any) {
      if (!err?.message?.includes('Unauthorized')) console.error('Error fetching admin action logs:', err);
    } finally {
      setActionsLoading(false);
    }
  };

  const fetchRooms = async () => {
    setRoomsLoading(true);
    try {
      const data = await apiFetch('/api/admin/rooms');
      if (Array.isArray(data)) setRooms(data);
    } catch (err: any) {
      if (!err?.message?.includes('Unauthorized')) console.error('Error fetching admin rooms:', err);
    } finally {
      setRoomsLoading(false);
    }
  };

  const fetchPreRegistrations = async () => {
    setPreRegLoading(true);
    try {
      const data = await apiFetch('/api/admin/pre-registrations');
      if (Array.isArray(data)) setPreRegList(data);
    } catch (err: any) {
      if (!err?.message?.includes('Unauthorized')) console.error('Error fetching pre-registrations:', err);
    } finally {
      setPreRegLoading(false);
    }
  };

  const fetchPosterEvents = async () => {
    setPosterEventsLoading(true);
    try {
      const data = await apiFetch('/api/admin/poster-events');
      if (Array.isArray(data)) setPosterEvents(data);
    } catch (err: any) {
      if (!err?.message?.includes('Unauthorized')) console.error('Error fetching poster events:', err);
    } finally {
      setPosterEventsLoading(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setIsBroadcasting(true);
    try {
      const res = await apiFetch('/api/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          urgency: broadcastUrgency
        })
      });
      alert(res.message || 'Broadcast sent successfully!');
      setShowBroadcastModal(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      fetchActions();
    } catch (err: any) {
      alert(err.message || 'Failed to send broadcast');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleExportCSV = () => {
    if (!preRegList || preRegList.length === 0) {
      alert('No pre-registration data available to export.');
      return;
    }

    const headers = [
      'Rank Position',
      'Student Name',
      'Reserved @Handle',
      'Email Address',
      'College Domain Verification',
      'Founding Member Badge',
      'Google SSO Connected',
      'Account Role',
      'Ban Status',
      'Registration Date & Time'
    ];

    const rows = preRegList.map((u) => [
      `"#${String(u.position).padStart(3, '0')}"`,
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${u.handle ? `@${u.handle}` : 'Not claimed yet'}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      `"${u.college_verified ? 'Verified Domain' : 'Unverified'}"`,
      `"${u.founder_badge || 'Standard Member'}"`,
      `"${u.google_id ? 'Yes (Google SSO)' : 'No'}"`,
      `"${u.is_admin ? 'Admin' : 'Student'}"`,
      `"${u.is_banned ? 'Banned' : 'Active'}"`,
      `"${new Date(u.created_at).toLocaleString()}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rogue_PreRegistrations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmDeleteRoom = async () => {
    if (!deleteRoomItem) return;
    setIsDeletingRoom(true);
    try {
      await apiFetch(`/api/admin/rooms/${deleteRoomItem.id}/delete`, {
        method: 'POST',
        body: JSON.stringify({ reason: deleteRoomReason || 'Inappropriate or harmful room creation' })
      });
      setRooms((prev) => prev.filter((r) => r.id !== deleteRoomItem.id));
      setDeleteRoomItem(null);
      setDeleteRoomReason('');
      fetchActions();
    } catch (err: any) {
      alert(err.message || 'Failed to delete room');
    } finally {
      setIsDeletingRoom(false);
    }
  };

  useEffect(() => {
    if (!currentUser || (currentUser.email !== 'amitkumarshukla296@gmail.com' && !currentUser.is_admin)) return;
    fetchFeed();
    fetchReports();
    fetchAppeals();
    fetchUsers();
    fetchRooms();
    fetchActions();
    fetchPreRegistrations();
    fetchPosterEvents();
  }, [currentUser]);

  const handleReviewAppeal = async (appealId: string, status: 'approved' | 'rejected', unban: boolean) => {
    try {
      await apiFetch(`/api/admin/appeals/${appealId}`, {
        method: 'PUT',
        body: JSON.stringify({ status, unban })
      });
      setAppeals((prev) => prev.map((a) => (a.id === appealId ? { ...a, status } : a)));
      if (unban) {
        fetchUsers();
      }
      fetchActions();
    } catch (err: any) {
      alert(err.message || 'Failed to update appeal status');
    }
  };

  // Socket.IO Integration
  useEffect(() => {
    if (!currentUser || (currentUser.email !== 'amitkumarshukla296@gmail.com' && !currentUser.is_admin)) return;
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('admin:join');

    const handleNewContent = (newItem: FeedItem) => {
      setFeedItems((prev) => [{ ...newItem, isNew: true }, ...prev]);
    };

    const handleNewReport = (newRep: Report) => {
      setReports((prev) => [newRep, ...prev]);
      setNewReportAlert(true);
    };

    const handleContentRemoved = ({ id }: { id: string }) => {
      setFeedItems((prev) => prev.filter((item) => item.id !== id));
    };

    socket.on('admin:new_content', handleNewContent);
    socket.on('admin:new_report', handleNewReport);
    socket.on('content:removed', handleContentRemoved);

    return () => {
      socket.off('admin:new_content', handleNewContent);
      socket.off('admin:new_report', handleNewReport);
      socket.off('content:removed', handleContentRemoved);
    };
  }, [currentUser]);

  const handleConfirmRemoveContent = async () => {
    if (!removeItem) return;
    setIsRemoving(true);
    try {
      const endpoint = removeItem.type === 'post' 
        ? `/api/admin/posts/${removeItem.id}/remove`
        : `/api/admin/room-messages/${removeItem.id}/remove`;

      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ reason: removeReason })
      });

      setFeedItems((prev) => prev.filter((item) => item.id !== removeItem.id));
      setRemoveItem(null);
      setRemoveReason('');
      fetchActions();
    } catch (err: any) {
      alert(err.message || 'Failed to remove content');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: 'reviewed' | 'actioned' | 'resolved') => {
    try {
      await apiFetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );
      fetchActions();
    } catch (err: any) {
      alert(err.message || 'Failed to update report status');
    }
  };

  const handleConfirmBanUser = async () => {
    if (!banTargetUser) return;
    setIsBanning(true);
    try {
      await apiFetch(`/api/admin/users/${banTargetUser.id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason: banReasonInput })
      });

      setUsersList((prev) =>
        prev.map((u) => (u.id === banTargetUser.id ? { ...u, is_banned: true, ban_reason: banReasonInput } : u))
      );
      setReports((prev) =>
        prev.map((r) => (r.reported_user_id === banTargetUser.id ? { ...r, reported_user_banned: true } : r))
      );

      setBanTargetUser(null);
      setBanReasonInput('');
      fetchActions();
    } catch (err: any) {
      alert(err.message || 'Failed to ban user');
    } finally {
      setIsBanning(false);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST'
      });
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_banned: false, ban_reason: null } : u))
      );
      setReports((prev) =>
        prev.map((r) => (r.reported_user_id === userId ? { ...r, reported_user_banned: false } : r))
      );
      fetchActions();
    } catch (err: any) {
      alert(err.message || 'Failed to unban user');
    }
  };

  const handleExportUsersCSV = () => {
    if (!usersList || usersList.length === 0) {
      alert('No user records available to export.');
      return;
    }

    const headers = ['ID', 'Name', 'Email', 'Handle', 'Branch', 'Year', 'College Verified', 'Is Admin', 'Is Banned', 'Ban Reason', 'Joined Date'];
    const rows = usersList.map(u => [
      `"${u.id || ''}"`,
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      `"${(u.handle || '').replace(/"/g, '""')}"`,
      `"${(u.branch || '').replace(/"/g, '""')}"`,
      `"${(u.year || '').replace(/"/g, '""')}"`,
      u.college_verified ? 'Yes' : 'No',
      u.is_admin ? 'Yes' : 'No',
      u.is_banned ? 'Yes' : 'No',
      `"${(u.ban_reason || '').replace(/"/g, '""')}"`,
      `"${u.created_at ? new Date(u.created_at).toISOString() : ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rogue_registered_users_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredFeed = feedItems.filter((item) => {
    if (!feedSearch.trim()) return true;
    const q = feedSearch.toLowerCase();
    return (
      item.author_name.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q) ||
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.room_name && item.room_name.toLowerCase().includes(q))
    );
  });

  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="flex flex-col min-h-screen bg-[#0D0E15] text-white font-sans">
      
      {/* ADMIN HEADER BAR */}
      <header className="sticky top-0 z-40 bg-[#12141F]/90 backdrop-blur-md border-b border-[#232635] px-6 py-3.5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <Link 
            href="/" 
            className="p-2 rounded-xl bg-[#1D202D] hover:bg-[#2A2E40] text-text-muted hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Return to Student Portal"
          >
            <ArrowLeft className="w-4 h-4" /> Exit Admin
          </Link>

          <div className="h-5 w-[1px] bg-[#232635]" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 flex items-center justify-center shadow-md shadow-coral/20 flex-shrink-0">
              <img src="/logo.png" alt="Rogue" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-2">
                Rogue Admin
                <span className="text-[10px] bg-coral/20 text-coral border border-coral/30 px-2 py-0.5 rounded-full font-bold uppercase">
                  Super Admin
                </span>
              </h1>
              <p className="text-[10px] text-text-muted">Moderation, Pre-Registration Cohort & User Authority</p>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] border border-[#232635] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            title="Exit Admin Panel and Return to Main Website"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-coral" />
            <span>Exit Admin</span>
          </Link>

          <button
            onClick={() => setShowBroadcastModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-coral to-orange-500 hover:from-coral-light hover:to-orange-400 text-white text-xs font-bold transition-all shadow-lg shadow-coral/20 flex items-center gap-2 cursor-pointer"
            title="Broadcast an announcement to all campus users"
          >
            <Megaphone className="w-4 h-4 animate-bounce" />
            <span className="hidden sm:inline">Broadcast</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#1B1E2B] border border-[#2B2F42] hover:border-coral/40 transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-coral flex items-center justify-center text-white font-bold text-xs">
                {user.photos && user.photos[0] ? (
                  <img src={user.photos[0]} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  user.name.charAt(0)
                )}
              </div>
              <span className="text-xs font-bold text-white max-w-[120px] truncate">{user.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#151722] border border-[#232635] rounded-2xl p-1.5 shadow-2xl z-50 divide-y divide-[#232635]">
                <div className="px-3 py-2 text-[10px] text-text-muted">
                  Signed in as <strong className="text-white block truncate">{user.email}</strong>
                </div>
                <div className="py-1">
                  <Link
                    href="/"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-text-muted hover:text-white hover:bg-[#232635] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to App
                  </Link>
                  <button
                    onClick={() => logout()}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-coral hover:bg-coral/10 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* TWO-PANE LAYOUT */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-[1600px] w-full mx-auto p-4 md:p-6 gap-6">
        
        {/* SIDEBAR TABS */}
        <aside className="w-full md:w-64 flex flex-row md:flex-col gap-2 flex-shrink-0 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          <button
            onClick={() => {
              setActiveTab('pre_registrations');
              fetchPreRegistrations();
            }}
            className={`flex-1 md:flex-none flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer ${
              activeTab === 'pre_registrations'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-bold'
                : 'bg-[#151722] text-text-muted hover:text-white hover:bg-[#1D202D] border border-[#232635]'
            }`}
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span className="flex-1 text-left">Pre-Registrations</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400/10 text-amber-300 font-mono font-bold border border-amber-400/20">
              {preRegList.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('referrals');
              fetchPreRegistrations();
            }}
            className={`flex-1 md:flex-none flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer ${
              activeTab === 'referrals'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-bold'
                : 'bg-[#151722] text-text-muted hover:text-white hover:bg-[#1D202D] border border-[#232635]'
            }`}
          >
            <Flame className={`w-4 h-4 ${activeTab === 'referrals' ? 'text-slate-950 fill-slate-950' : 'text-emerald-400 fill-emerald-400'}`} />
            <span className="flex-1 text-left">Referrals & Growth</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'referrals'
                  ? 'bg-slate-950/20 text-slate-950 border border-slate-950/30'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {preRegList.filter((u) => u.referred_by && u.referred_by !== 'Direct / Organic').length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('feed');
              fetchFeed();
            }}
            className={`flex-1 md:flex-none flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-coral text-white shadow-lg shadow-coral/20 font-bold'
                : 'bg-[#151722] text-text-muted hover:text-white hover:bg-[#1D202D] border border-[#232635]'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span className="flex-1 text-left">Live Feed</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          </button>

          <button
            onClick={() => {
              setActiveTab('reports');
              setNewReportAlert(false);
              fetchReports();
            }}
            className={`flex-1 md:flex-none flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer relative ${
              activeTab === 'reports'
                ? 'bg-coral text-white shadow-lg shadow-coral/20 font-bold'
                : 'bg-[#151722] text-text-muted hover:text-white hover:bg-[#1D202D] border border-[#232635]'
            }`}
          >
            <Flag className="w-4 h-4" />
            <span className="flex-1 text-left">Reports</span>
            {pendingReportsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500 text-white font-bold animate-pulse">
                {pendingReportsCount}
              </span>
            )}
            {newReportAlert && activeTab !== 'reports' && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3 rounded-full bg-coral animate-bounce" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('appeals');
              fetchAppeals();
            }}
            className={`flex-1 md:flex-none flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer ${
              activeTab === 'appeals'
                ? 'bg-coral text-white shadow-lg shadow-coral/20 font-bold'
                : 'bg-[#151722] text-text-muted hover:text-white hover:bg-[#1D202D] border border-[#232635]'
            }`}
          >
            <Send className="w-4 h-4" />
            <span className="flex-1 text-left">Ban Appeals</span>
            {appeals.filter((a) => a.status === 'pending').length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
                {appeals.filter((a) => a.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('users');
              fetchUsers();
            }}
            className={`flex-1 md:flex-none flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-coral text-white shadow-lg shadow-coral/20 font-bold'
                : 'bg-[#151722] text-text-muted hover:text-white hover:bg-[#1D202D] border border-[#232635]'
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            <span className="flex-1 text-left">Users</span>
            <span className="text-[10px] text-text-muted font-mono">{usersList.length}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('rooms');
              fetchRooms();
            }}
            className={`flex-1 md:flex-none flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer ${
              activeTab === 'rooms'
                ? 'bg-coral text-white shadow-lg shadow-coral/20 font-bold'
                : 'bg-[#151722] text-text-muted hover:text-white hover:bg-[#1D202D] border border-[#232635]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="flex-1 text-left">Rooms & Channels</span>
            <span className="text-[10px] text-text-muted font-mono">{rooms.length}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('actions');
              fetchActions();
            }}
            className={`flex-1 md:flex-none flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer ${
              activeTab === 'actions'
                ? 'bg-coral text-white shadow-lg shadow-coral/20 font-bold'
                : 'bg-[#151722] text-text-muted hover:text-white hover:bg-[#1D202D] border border-[#232635]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="flex-1 text-left">Action Log</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('poster_events');
              fetchPosterEvents();
            }}
            className={`flex-1 md:flex-none flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer ${
              activeTab === 'poster_events'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20 font-bold'
                : 'bg-[#151722] text-text-muted hover:text-white hover:bg-[#1D202D] border border-[#232635]'
            }`}
          >
            <Download className={`w-4 h-4 ${activeTab === 'poster_events' ? 'text-white' : 'text-purple-400'}`} />
            <span className="flex-1 text-left">Poster Events</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'poster_events'
                ? 'bg-white/20 text-white border border-white/30'
                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
            }`}>
              {posterEvents.length}
            </span>
          </button>

          {/* Quick Stats Widget */}
          <div className="hidden md:flex flex-col gap-3 mt-auto p-4 rounded-2xl bg-[#151722] border border-[#232635] text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Launch Overview
            </div>
            <div className="flex items-center justify-between text-text-muted">
              <span>Total Pre-Registered</span>
              <strong className="text-white">{preRegList.length}</strong>
            </div>
            <div className="flex items-center justify-between text-text-muted">
              <span>Founding Badges</span>
              <strong className="text-amber-300 font-bold">{preRegList.filter(u => u.position <= 100).length} / 100</strong>
            </div>
            <div className="flex items-center justify-between text-text-muted">
              <span>Verified Domains</span>
              <strong className="text-emerald-400 font-bold">{preRegList.filter(u => u.college_verified).length}</strong>
            </div>
          </div>
        </aside>

        {/* MAIN PANEL CONTENT */}
        <main className="flex-1 bg-[#151722] border border-[#232635] rounded-3xl p-5 md:p-6 overflow-y-auto flex flex-col shadow-2xl">
          
          {/* TAB: PRE-REGISTRATIONS & WAITLIST */}
          {activeTab === 'pre_registrations' && (
            <div className="flex flex-col gap-5 flex-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#232635]">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-4.5 h-4.5 text-amber-400" /> Pre-Registrations & Launch Waitlist
                  </h2>
                  <p className="text-xs text-text-muted">Live student registrations & authenticated platform user records sorted by rank order</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search student, email, domain..."
                      value={preRegSearch}
                      onChange={(e) => setPreRegSearch(e.target.value)}
                      className="w-full bg-[#1D202D] border border-[#232635] rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-text-muted outline-none focus:border-amber-400 transition-all"
                    />
                  </div>
                  <button
                    onClick={fetchPreRegistrations}
                    className="p-2.5 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] border border-[#232635] text-text-muted hover:text-white transition-colors cursor-pointer"
                    title="Refresh List"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${preRegLoading ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    title="Export Pre-Registrations to CSV / Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* KPI Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-[#1D202D] border border-[#2B2F42] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-text-muted font-medium">Total Pre-Registered</span>
                    <h3 className="text-xl font-black text-white">{preRegList.length}</h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 font-bold text-xs">
                    #
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#1D202D] border border-[#2B2F42] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-text-muted font-medium">College Domain Verified</span>
                    <h3 className="text-xl font-black text-emerald-400">
                      {preRegList.filter((u) => u.college_verified).length}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#1D202D] border border-[#2B2F42] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-text-muted font-medium">Founding Member Badges</span>
                    <h3 className="text-xl font-black text-amber-300">
                      {preRegList.filter((u) => u.position <= 100).length} / 100
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Data Table */}
              {preRegLoading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                </div>
              ) : preRegList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-text-muted">
                  <UsersIcon className="w-12 h-12 text-[#232635] mb-3" />
                  <p className="text-sm font-semibold">No pre-registrations recorded yet</p>
                  <p className="text-xs text-text-muted mt-1">Students who sign in via Google SSO or register will appear here immediately.</p>
                </div>
              ) : (
                <div className="bg-[#1D202D] border border-[#2B2F42] rounded-2xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-text-muted">
                      <thead className="bg-[#151722] text-[11px] uppercase tracking-wider text-text-muted border-b border-[#2B2F42]">
                        <tr>
                          <th className="px-4 py-3 font-semibold"># Rank</th>
                          <th className="px-4 py-3 font-semibold">Student</th>
                          <th className="px-4 py-3 font-semibold">Reserved @Handle</th>
                          <th className="px-4 py-3 font-semibold">Email & Domain</th>
                          <th className="px-4 py-3 font-semibold">Founding Status</th>
                          <th className="px-4 py-3 font-semibold">Verification</th>
                          <th className="px-4 py-3 font-semibold">Pre-Registered At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2B2F42]">
                        {preRegList
                          .filter((u) => {
                            if (!preRegSearch.trim()) return true;
                            const q = preRegSearch.toLowerCase();
                            return (
                              u.name.toLowerCase().includes(q) ||
                              u.email.toLowerCase().includes(q) ||
                              (u.handle && u.handle.toLowerCase().includes(q)) ||
                              (u.founder_badge && u.founder_badge.toLowerCase().includes(q))
                            );
                          })
                          .map((u) => (
                            <tr key={u.id} className="hover:bg-[#232635]/60 transition-colors">
                              <td className="px-4 py-3.5 font-mono text-white font-bold">
                                #{String(u.position).padStart(3, '0')}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#2B2F42] overflow-hidden border border-white/10 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                    {u.photos && u.photos[0] ? (
                                      <img src={u.photos[0]} alt={u.name} className="w-full h-full object-cover" />
                                    ) : (
                                      u.name.charAt(0)
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white flex items-center gap-1.5">
                                      {u.name}
                                      {u.is_admin && (
                                        <span className="text-[9px] bg-coral/20 text-coral border border-coral/30 px-1.5 py-0.2 rounded font-bold uppercase">
                                          Admin
                                        </span>
                                      )}
                                    </div>
                                    {u.google_id && (
                                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                        ● Google SSO Connected
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                {u.handle ? (
                                  <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-xs">
                                    @{u.handle}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-text-muted italic">Not claimed yet</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 font-mono text-xs text-text-muted">
                                {u.email}
                              </td>
                              <td className="px-4 py-3.5">
                                {u.founder_badge ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] bg-amber-400/10 text-amber-300 font-bold border border-amber-400/30">
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                    {u.founder_badge}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-text-muted">Standard Member</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5">
                                {u.college_verified ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                                    <ShieldCheck className="w-3 h-3" /> College Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] bg-amber-500/10 text-amber-400 font-bold border border-amber-500/30">
                                    <AlertTriangle className="w-3 h-3" /> Unverified Email
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 font-mono text-[11px] text-text-muted">
                                {new Date(u.created_at).toLocaleDateString()} {new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: REFERRALS & GROWTH ATTRIBUTION */}
          {activeTab === 'referrals' && (
            <div className="flex flex-col gap-5 flex-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#232635]">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Flame className="w-4.5 h-4.5 text-emerald-400 fill-emerald-400" /> Referral Growth Engine & Viral Attribution
                  </h2>
                  <p className="text-xs text-text-muted">Track who brought whom into Rogue and identify top campus leaders</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search name, code or referrer..."
                      value={referralSearch}
                      onChange={(e) => setReferralSearch(e.target.value)}
                      className="w-full bg-[#1D202D] border border-[#232635] rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-text-muted outline-none focus:border-emerald-400 transition-all"
                    />
                  </div>
                  <button
                    onClick={fetchPreRegistrations}
                    className="p-2.5 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] border border-[#232635] text-text-muted hover:text-white transition-colors cursor-pointer"
                    title="Refresh List"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${preRegLoading ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    title="Export Pre-Registrations & Referrals to CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* KPI Metrics Cards */}
              {(() => {
                const totalCount = preRegList.length;
                const referredCount = preRegList.filter((u) => u.referred_by && u.referred_by !== 'Direct / Organic').length;
                const activeSharersCount = preRegList.filter((u) => (u.referral_count || 0) > 0).length;
                const topReferrer = preRegList.reduce((top, current) => {
                  return (current.referral_count || 0) > (top.referral_count || 0) ? current : top;
                }, preRegList[0]);

                const filtered = preRegList
                  .filter((u) => {
                    const matchSearch =
                      (u.name || '').toLowerCase().includes(referralSearch.toLowerCase()) ||
                      (u.email || '').toLowerCase().includes(referralSearch.toLowerCase()) ||
                      (u.ref_code || '').toLowerCase().includes(referralSearch.toLowerCase()) ||
                      (u.referred_by || '').toLowerCase().includes(referralSearch.toLowerCase());

                    if (!matchSearch) return false;
                    if (referralFilter === 'referrers') return (u.referral_count || 0) > 0;
                    if (referralFilter === 'referred') return u.referred_by && u.referred_by !== 'Direct / Organic';
                    return true;
                  })
                  .sort((a, b) => {
                    if (referralSort === 'referrals') {
                      return (b.referral_count || 0) - (a.referral_count || 0) || a.position - b.position;
                    }
                    return a.position - b.position;
                  });

                return (
                  <div className="space-y-4">
                    {/* Top KPI Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-4 rounded-2xl bg-[#1D202D] border border-[#2B2F42] space-y-1">
                        <span className="text-[11px] text-text-muted font-medium">Total Pre-Registered</span>
                        <h3 className="text-xl font-black text-white">{totalCount}</h3>
                        <span className="text-[10px] text-text-muted">Verified Student Accounts</span>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#1D202D] border border-emerald-500/30 space-y-1 bg-gradient-to-br from-emerald-500/5 to-transparent">
                        <span className="text-[11px] text-emerald-400 font-bold flex items-center justify-between">
                          <span>Joined via Referral</span>
                          <Zap className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                        </span>
                        <h3 className="text-xl font-black text-emerald-400">{referredCount}</h3>
                        <span className="text-[10px] text-text-muted">
                          {totalCount > 0 ? Math.round((referredCount / totalCount) * 100) : 0}% Viral Conversion
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#1D202D] border border-amber-400/30 space-y-1">
                        <span className="text-[11px] text-amber-300 font-bold flex items-center justify-between">
                          <span>Active Sharers</span>
                          <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        </span>
                        <h3 className="text-xl font-black text-amber-300">{activeSharersCount}</h3>
                        <span className="text-[10px] text-text-muted">Students sharing invite links</span>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#1D202D] border border-purple-500/30 space-y-1 bg-gradient-to-br from-purple-500/10 to-transparent">
                        <span className="text-[11px] text-purple-300 font-bold flex items-center justify-between">
                          <span>Top Referral Legend</span>
                          <Award className="w-3.5 h-3.5 text-purple-300" />
                        </span>
                        <h3 className="text-sm font-black text-white truncate">
                          {topReferrer && (topReferrer.referral_count || 0) > 0 ? topReferrer.name : 'No referrers yet'}
                        </h3>
                        <span className="text-[10px] text-purple-300 block font-mono">
                          {topReferrer && (topReferrer.referral_count || 0) > 0
                            ? `🔥 ${topReferrer.referral_count} Friends Invited`
                            : 'Rank #1 by inviting friends'}
                        </span>
                      </div>
                    </div>

                    {/* Filter & Sort Strip */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 rounded-xl bg-[#1D202D] border border-[#2B2F42] text-xs">
                      <div className="flex bg-[#151722] p-1 rounded-lg border border-[#2B2F42] w-full sm:w-auto font-mono">
                        <button
                          onClick={() => setReferralFilter('all')}
                          className={`px-3 py-1 rounded-md transition-all ${
                            referralFilter === 'all' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-text-muted hover:text-white'
                          }`}
                        >
                          All ({preRegList.length})
                        </button>
                        <button
                          onClick={() => setReferralFilter('referrers')}
                          className={`px-3 py-1 rounded-md transition-all ${
                            referralFilter === 'referrers' ? 'bg-amber-400/20 text-amber-300 font-bold' : 'text-text-muted hover:text-white'
                          }`}
                        >
                          Active Sharers ({activeSharersCount})
                        </button>
                        <button
                          onClick={() => setReferralFilter('referred')}
                          className={`px-3 py-1 rounded-md transition-all ${
                            referralFilter === 'referred' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-text-muted hover:text-white'
                          }`}
                        >
                          Referred Users ({referredCount})
                        </button>
                      </div>

                      <button
                        onClick={() => setReferralSort(referralSort === 'referrals' ? 'position' : 'referrals')}
                        className="px-3 py-1.5 rounded-lg bg-[#151722] border border-[#2B2F42] text-xs font-mono text-text-muted hover:text-white transition-all flex items-center gap-1 shrink-0"
                      >
                        <span>{referralSort === 'referrals' ? 'Sort: Top Referrals' : 'Sort: Position'}</span>
                      </button>
                    </div>

                    {/* Table View */}
                    {preRegLoading ? (
                      <div className="flex-1 flex items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-text-muted">
                        <UsersIcon className="w-10 h-10 text-[#232635] mb-2" />
                        <p className="text-xs font-semibold">No referral records match your search filter</p>
                      </div>
                    ) : (
                      <div className="bg-[#1D202D] border border-[#2B2F42] rounded-2xl overflow-hidden shadow-lg">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-text-muted">
                            <thead className="bg-[#151722] text-[11px] uppercase tracking-wider text-text-muted border-b border-[#2B2F42]">
                              <tr>
                                <th className="px-4 py-3 font-semibold text-center">Rank</th>
                                <th className="px-4 py-3 font-semibold">Student</th>
                                <th className="px-4 py-3 font-semibold">Personal Invite Code</th>
                                <th className="px-4 py-3 font-semibold">Who Referred Them?</th>
                                <th className="px-4 py-3 font-semibold text-center">Referrals Made</th>
                                <th className="px-4 py-3 font-semibold text-center">Growth Tier</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2B2F42]">
                              {filtered.map((u) => {
                                const count = u.referral_count || 0;
                                const isReferred = u.referred_by && u.referred_by !== 'Direct / Organic';

                                return (
                                  <tr key={u.id} className="hover:bg-[#252838] transition-colors">
                                    <td className="px-4 py-3.5 text-center font-mono font-bold">
                                      <span className="px-2 py-0.5 rounded bg-[#151722] border border-[#2B2F42] text-white">
                                        #{u.position}
                                      </span>
                                    </td>

                                    <td className="px-4 py-3.5">
                                      <div className="font-bold text-white flex items-center gap-1.5">
                                        <span>{u.name}</span>
                                        {u.position <= 100 && (
                                          <span className="text-[9px] font-mono bg-amber-400/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/20">
                                            Founder
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[11px] text-text-muted font-mono block">{u.email}</span>
                                    </td>

                                    <td className="px-4 py-3.5 font-mono">
                                      <span className="text-amber-300 font-bold bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">
                                        {u.ref_code || `ROGUE-${u.email.split('@')[0].toUpperCase()}`}
                                      </span>
                                    </td>

                                    <td className="px-4 py-3.5 font-mono">
                                      {isReferred ? (
                                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 flex items-center gap-1 w-fit">
                                          <Zap className="w-3 h-3 fill-emerald-400" /> {u.referred_by}
                                        </span>
                                      ) : (
                                        <span className="text-text-muted text-[11px]">Direct / Organic</span>
                                      )}
                                    </td>

                                    <td className="px-4 py-3.5 text-center font-mono font-bold">
                                      {count > 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-coral/10 text-coral border border-coral/30">
                                          <Flame className="w-3.5 h-3.5 fill-coral" />
                                          <span>{count} Friends</span>
                                        </span>
                                      ) : (
                                        <span className="text-text-muted/60">0</span>
                                      )}
                                    </td>

                                    <td className="px-4 py-3.5 text-center">
                                      {count >= 5 ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10.5px] font-mono font-extrabold shadow-sm">
                                          👑 Campus Leader
                                        </span>
                                      ) : count >= 1 ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10.5px] font-mono font-bold">
                                          🔥 Active Sharer
                                        </span>
                                      ) : isReferred ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10.5px] font-mono">
                                          ⚡ Referred User
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#151722] text-text-muted border border-[#2B2F42] text-[10.5px] font-mono">
                                          Organic Member
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 1: LIVE FEED */}
          {activeTab === 'feed' && (
            <div className="flex flex-col gap-5 flex-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#232635]">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" /> Platform-Wide Live Content Stream
                  </h2>
                  <p className="text-xs text-text-muted">Real-time socket stream of every post and room message created on Rogue</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Filter feed by user, text..."
                      value={feedSearch}
                      onChange={(e) => setFeedSearch(e.target.value)}
                      className="w-full bg-[#1D202D] border border-[#232635] rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-text-muted outline-none focus:border-coral transition-all"
                    />
                  </div>
                  <button
                    onClick={fetchFeed}
                    className="p-2.5 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] border border-[#232635] text-text-muted hover:text-white transition-colors cursor-pointer"
                    title="Refresh Feed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${feedLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Feed Stream List */}
              {feedLoading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent" />
                </div>
              ) : filteredFeed.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-text-muted">
                  <MessageSquare className="w-12 h-12 text-[#232635] mb-3" />
                  <p className="text-sm font-semibold">No live content matching criteria</p>
                  <p className="text-xs text-text-muted mt-1">Posts and room messages will stream in here live as students post them.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredFeed.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl bg-[#1D202D] border border-[#2B2F42] hover:border-coral/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        item.isNew ? 'animate-pulse border-coral/60 bg-coral/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-[#2B2F42] flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10 mt-0.5">
                          {item.author_photo ? (
                            <img src={item.author_photo} alt={item.author_name} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="w-4 h-4 text-text-muted" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white">{item.author_name}</span>
                            {item.author_handle && (
                              <span className="text-[10px] text-coral font-mono">@{item.author_handle}</span>
                            )}

                            {item.type === 'post' ? (
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <Flame className="w-3 h-3" /> Feed Post
                              </span>
                            ) : (
                              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> {item.room_name || 'Room Chat'}
                              </span>
                            )}

                            <span className="text-[10px] text-text-muted flex items-center gap-1 ml-auto sm:ml-0">
                              <Clock className="w-3 h-3" /> {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {item.title && (
                            <h4 className="text-xs font-bold text-white mt-1.5">{item.title}</h4>
                          )}
                          <p className="text-xs text-text-muted mt-1 line-clamp-2">{item.content}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setRemoveItem(item);
                          setRemoveReason('');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REPORTS */}
          {activeTab === 'reports' && (
            <div className="flex flex-col gap-5 flex-1">
              <div className="flex items-center justify-between pb-4 border-b border-[#232635]">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Flag className="w-4 h-4 text-coral" /> User Reports Queue
                  </h2>
                  <p className="text-xs text-text-muted">Review reported students, change status, or issue instant bans</p>
                </div>
                <button
                  onClick={fetchReports}
                  className="p-2.5 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] border border-[#232635] text-text-muted hover:text-white transition-colors cursor-pointer"
                  title="Refresh Reports"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {reportsLoading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent" />
                </div>
              ) : reports.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-text-muted">
                  <CheckCircle className="w-12 h-12 text-emerald-500/30 mb-3" />
                  <p className="text-sm font-semibold">No pending user reports</p>
                  <p className="text-xs text-text-muted mt-1">The platform community is quiet and healthy.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-5 rounded-2xl bg-[#1D202D] border border-[#2B2F42] flex flex-col gap-3.5 shadow-lg"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2B2F42] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            Reported User: <strong className="text-coral">{rep.reported_user_name || rep.reported_user_id}</strong>
                          </span>
                          {rep.reported_user_banned && (
                            <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold">
                              BANNED
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-text-muted">Reporter: {rep.reporter_name || rep.reporter_id}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                              rep.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : rep.status === 'actioned'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {rep.status}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-white">Reason: <span className="text-amber-300">{rep.reason}</span></p>
                        {rep.context && (
                          <p className="text-xs text-text-muted mt-1 bg-[#151722] p-3 rounded-xl border border-[#2B2F42] font-mono">
                            "{rep.context}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateReportStatus(rep.id, 'reviewed')}
                            className="px-3 py-1.5 rounded-xl bg-[#2B2F42] hover:bg-[#383E56] text-white text-xs font-semibold transition-all cursor-pointer"
                          >
                            Mark Reviewed
                          </button>
                          <button
                            onClick={() => handleUpdateReportStatus(rep.id, 'actioned')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer"
                          >
                            Mark Actioned
                          </button>
                        </div>

                        {!rep.reported_user_banned && (
                          <button
                            onClick={() =>
                              setBanTargetUser({
                                id: rep.reported_user_id,
                                name: rep.reported_user_name || 'Reported User'
                              })
                            }
                            className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-md shadow-red-500/20 flex items-center gap-1.5 cursor-pointer ml-auto"
                          >
                            <Ban className="w-3.5 h-3.5" /> Ban User Immediately
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: BAN APPEALS */}
          {activeTab === 'appeals' && (
            <div className="flex flex-col gap-5 flex-1">
              <div className="flex items-center justify-between pb-4 border-b border-[#232635]">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-coral" /> Suspended User Appeals Queue
                  </h2>
                  <p className="text-xs text-text-muted">Review reinstate requests submitted by banned accounts</p>
                </div>
                <button
                  onClick={fetchAppeals}
                  className="p-2.5 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] border border-[#232635] text-text-muted hover:text-white transition-colors cursor-pointer"
                  title="Refresh Appeals"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${appealsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {appealsLoading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent" />
                </div>
              ) : appeals.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-text-muted">
                  <CheckCircle className="w-12 h-12 text-emerald-500/30 mb-3" />
                  <p className="text-sm font-semibold">No pending ban appeals</p>
                  <p className="text-xs text-text-muted mt-1">There are currently no review requests from suspended users.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {appeals.map((app) => (
                    <div
                      key={app.id}
                      className="p-5 rounded-2xl bg-[#1D202D] border border-[#2B2F42] flex flex-col gap-3.5 shadow-lg"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2B2F42] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            Student: <strong className="text-coral">{app.user_name}</strong>
                          </span>
                          <span className="text-[10px] text-text-muted font-mono">({app.user_email})</span>
                        </div>

                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                            app.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : app.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/10 text-red-400 border-red-500/30'
                          }`}
                        >
                          {app.status}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-coral font-bold uppercase block mb-1">Appeal Statement</span>
                        <p className="text-xs text-white bg-[#151722] p-3.5 rounded-xl border border-[#2B2F42] leading-relaxed">
                          "{app.reason}"
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <span className="text-[10px] text-text-muted">
                          Submitted: {new Date(app.created_at).toLocaleString()}
                        </span>

                        {app.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReviewAppeal(app.id, 'rejected', false)}
                              className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
                            >
                              Reject Appeal
                            </button>
                            <button
                              onClick={() => handleReviewAppeal(app.id, 'approved', true)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Approve & Unban User
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: USERS */}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-5 flex-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#232635]">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <UsersIcon className="w-4 h-4 text-coral" /> Registered Platform Users Directory
                  </h2>
                  <p className="text-xs text-text-muted">Search, inspect verification status, or manage ban privileges</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search name, email, handle..."
                      value={userSearchQuery}
                      onChange={(e) => {
                        setUserSearchQuery(e.target.value);
                        fetchUsers(e.target.value);
                      }}
                      className="w-full bg-[#1D202D] border border-[#232635] rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-text-muted outline-none focus:border-coral transition-all"
                    />
                  </div>
                  <button
                    onClick={() => fetchUsers(userSearchQuery)}
                    className="p-2.5 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] border border-[#232635] text-text-muted hover:text-white transition-colors cursor-pointer"
                    title="Refresh List"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={handleExportUsersCSV}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    title="Export Registered Users Directory to CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {usersLoading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent" />
                </div>
              ) : usersList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-text-muted">
                  <UsersIcon className="w-12 h-12 text-[#232635] mb-3" />
                  <p className="text-sm font-semibold">No users matching search query</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-text-muted divide-y divide-[#2B2F42]">
                    <thead>
                      <tr className="text-[11px] font-bold text-white uppercase tracking-wider bg-[#1D202D]">
                        <th className="p-3.5 rounded-l-xl">User</th>
                        <th className="p-3.5">Email</th>
                        <th className="p-3.5">Branch / Year</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right rounded-r-xl">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232635]">
                      {usersList.map((u) => (
                        <tr key={u.id} className="hover:bg-[#1D202D]/60 transition-colors">
                          <td className="p-3.5 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#2B2F42] overflow-hidden flex-shrink-0 flex items-center justify-center border border-white/10">
                              {u.photos && u.photos[0] ? (
                                <img src={u.photos[0]} alt={u.name} className="w-full h-full object-cover" />
                              ) : (
                                u.name.charAt(0)
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                {u.name}
                                {u.is_admin && (
                                  <span className="text-[9px] bg-coral/20 text-coral border border-coral/30 px-1.5 py-0.2 rounded font-bold">
                                    ADMIN
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-coral font-mono">@{u.handle || 'user'}</span>
                            </div>
                          </td>

                          <td className="p-3.5 text-white font-mono text-[11px]">{u.email}</td>

                          <td className="p-3.5">
                            {u.branch ? `${u.branch} • ${u.year || ''}` : 'Student'}
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {u.college_verified ? (
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" /> Verified
                                </span>
                              ) : (
                                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-semibold">
                                  Unverified
                                </span>
                              )}

                              {u.is_banned ? (
                                <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                  <Ban className="w-3 h-3" /> Banned
                                </span>
                              ) : (
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                  <UserCheck className="w-3 h-3" /> Active
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-3.5 text-right">
                            {u.is_banned ? (
                              <button
                                onClick={() => handleUnbanUser(u.id)}
                                className="px-3 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                              >
                                Unban User
                              </button>
                            ) : (
                              !u.is_admin && (
                                <button
                                  onClick={() => setBanTargetUser({ id: u.id, name: u.name })}
                                  className="px-3 py-1 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
                                >
                                  Ban User
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ROOMS MODERATION */}
          {activeTab === 'rooms' && (
            <div className="flex flex-col gap-5 flex-1">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-coral" /> Room & Channel Moderation
                  </h2>
                  <p className="text-xs text-text-muted">
                    Monitor all active platform rooms. Terminate & ban any toxic or policy-violating rooms instantly.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Filter rooms..."
                      value={roomSearch}
                      onChange={(e) => setRoomSearch(e.target.value)}
                      className="w-full bg-[#151722] border border-[#232635] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-text-muted outline-none focus:border-coral transition-all"
                    />
                  </div>

                  <button
                    onClick={fetchRooms}
                    className="p-2 rounded-xl bg-[#151722] border border-[#232635] hover:border-coral/50 text-text-muted hover:text-white transition-all cursor-pointer"
                    title="Refresh Rooms"
                  >
                    <RefreshCw className={`w-4 h-4 ${roomsLoading ? 'animate-spin text-coral' : ''}`} />
                  </button>
                </div>
              </div>

              {roomsLoading ? (
                <div className="flex flex-col items-center justify-center p-12 bg-[#151722] rounded-3xl border border-[#232635]">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-coral border-t-transparent mb-2"></div>
                  <p className="text-xs text-text-muted">Loading platform rooms...</p>
                </div>
              ) : rooms.length === 0 ? (
                <div className="p-12 text-center bg-[#151722] rounded-3xl border border-[#232635]">
                  <MessageSquare className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-white">No Active Rooms Found</p>
                </div>
              ) : (
                <div className="bg-[#151722] border border-[#232635] rounded-3xl overflow-hidden shadow-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#232635] bg-[#12141F] text-[10px] text-text-muted uppercase tracking-wider font-bold">
                        <th className="p-3.5">Room Details</th>
                        <th className="p-3.5">Created By</th>
                        <th className="p-3.5">Stats</th>
                        <th className="p-3.5">Created At</th>
                        <th className="p-3.5 text-right">Moderation Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232635] text-xs">
                      {rooms
                        .filter((r) => !roomSearch.trim() || r.name.toLowerCase().includes(roomSearch.toLowerCase()))
                        .map((room) => (
                          <tr key={room.id} className="hover:bg-[#1D202D] transition-colors">
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-coral/10 border border-coral/30 flex items-center justify-center text-coral font-bold text-xs">
                                  #
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-white text-xs flex items-center gap-1.5">
                                    {room.name}
                                    <span className="text-[9px] bg-[#232635] text-text-muted px-1.5 py-0.5 rounded font-mono uppercase">
                                      {room.type}
                                    </span>
                                  </p>
                                  <p className="text-[10px] text-text-muted font-mono">ID: {room.id}</p>
                                </div>
                              </div>
                            </td>

                            <td className="p-3.5">
                              <div>
                                <p className="font-semibold text-white">{room.creator_name || 'System / Admin'}</p>
                                <p className="text-[10px] text-coral font-mono">@{room.creator_handle || 'system'}</p>
                              </div>
                            </td>

                            <td className="p-3.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-[#1D202D] border border-[#232635] text-text-muted px-2 py-0.5 rounded-full font-mono">
                                  👥 {room.member_count} Members
                                </span>
                                <span className="text-[10px] bg-[#1D202D] border border-[#232635] text-text-muted px-2 py-0.5 rounded-full font-mono">
                                  💬 {room.message_count} Messages
                                </span>
                              </div>
                            </td>

                            <td className="p-3.5 text-text-muted font-mono text-[10px]">
                              {new Date(room.created_at).toLocaleDateString()}
                            </td>

                            <td className="p-3.5 text-right">
                              <button
                                onClick={() => setDeleteRoomItem(room)}
                                className="px-3 py-1 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 text-xs font-bold transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Ban & Delete Room
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ACTION LOG */}
          {activeTab === 'actions' && (
            <div className="flex flex-col gap-5 flex-1">
              <div className="flex items-center justify-between pb-4 border-b border-[#232635]">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-coral" /> Admin Action Audit Log Trail
                  </h2>
                  <p className="text-xs text-text-muted">Read-only immutable log of every moderator action taken platform-wide</p>
                </div>
                <button
                  onClick={fetchActions}
                  className="p-2.5 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] border border-[#232635] text-text-muted hover:text-white transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {actionsLoading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent" />
                </div>
              ) : actions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-text-muted">
                  <FileText className="w-12 h-12 text-[#232635] mb-3" />
                  <p className="text-sm font-semibold">No admin actions recorded yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {actions.map((act) => (
                    <div
                      key={act.id}
                      className="p-4 rounded-2xl bg-[#1D202D] border border-[#2B2F42] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{act.admin_name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                              act.action_type === 'ban_user'
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : act.action_type === 'remove_post' || act.action_type === 'remove_room_message'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            {act.action_type.replace(/_/g, ' ')}
                          </span>
                          {act.target_label && (
                            <span className="text-[11px] text-white font-mono bg-[#151722] px-2 py-0.5 rounded border border-[#2B2F42] max-w-[250px] truncate">
                              Target: {act.target_label}
                            </span>
                          )}
                        </div>
                        {act.reason && (
                          <p className="text-text-muted text-[11px] mt-0.5">Reason: "{act.reason}"</p>
                        )}
                      </div>

                      <span className="text-[10px] text-text-muted flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" /> {new Date(act.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: POSTER EVENTS — Who downloaded / shared a story poster on Rogue Teaser */}
          {activeTab === 'poster_events' && (
            <div className="flex flex-col gap-5 flex-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#232635]">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-purple-400" /> Poster Events — Rogue Teaser
                  </h2>
                  <p className="text-xs text-text-muted">Track who downloaded or shared a story poster after logging in</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search email, name, theme..."
                      value={posterEventsSearch}
                      onChange={(e) => setPosterEventsSearch(e.target.value)}
                      className="w-full bg-[#1D202D] border border-[#232635] rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-text-muted outline-none focus:border-purple-400 transition-all"
                    />
                  </div>
                  <button
                    onClick={fetchPosterEvents}
                    className="p-2.5 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] border border-[#232635] text-text-muted hover:text-white transition-colors cursor-pointer"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${posterEventsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-[#1D202D] border border-[#2B2F42] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-text-muted font-medium">Total Events</span>
                    <h3 className="text-xl font-black text-white">{posterEvents.length}</h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[#1D202D] border border-[#2B2F42] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-text-muted font-medium">Downloads</span>
                    <h3 className="text-xl font-black text-emerald-400">{posterEvents.filter(e => e.action === 'download').length}</h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Download className="w-4 h-4" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[#1D202D] border border-[#2B2F42] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-text-muted font-medium">Shares</span>
                    <h3 className="text-xl font-black text-teal-400">{posterEvents.filter(e => e.action === 'share').length}</h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <Send className="w-4 h-4" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[#1D202D] border border-[#2B2F42] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-text-muted font-medium">Unique Users</span>
                    <h3 className="text-xl font-black text-amber-300">
                      {new Set(posterEvents.map(e => e.email)).size}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300">
                    <UsersIcon className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Table */}
              {posterEventsLoading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                </div>
              ) : posterEvents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-text-muted">
                  <Download className="w-12 h-12 text-[#232635] mb-3" />
                  <p className="text-sm font-semibold">No poster events yet</p>
                  <p className="text-xs text-text-muted mt-1">Events are recorded when logged-in users download or share a Gone Rogue story poster.</p>
                </div>
              ) : (
                <div className="bg-[#1D202D] border border-[#2B2F42] rounded-2xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-text-muted">
                      <thead className="bg-[#151722] text-[11px] uppercase tracking-wider text-text-muted border-b border-[#2B2F42]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">#</th>
                          <th className="px-4 py-3 font-semibold">Student</th>
                          <th className="px-4 py-3 font-semibold">Action</th>
                          <th className="px-4 py-3 font-semibold">Poster Theme</th>
                          <th className="px-4 py-3 font-semibold">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2B2F42]">
                        {posterEvents
                          .filter(e => {
                            if (!posterEventsSearch.trim()) return true;
                            const q = posterEventsSearch.toLowerCase();
                            return (
                              e.email.toLowerCase().includes(q) ||
                              (e.name && e.name.toLowerCase().includes(q)) ||
                              (e.handle && e.handle.toLowerCase().includes(q)) ||
                              e.poster_theme.toLowerCase().includes(q) ||
                              e.action.toLowerCase().includes(q)
                            );
                          })
                          .map((event, idx) => (
                            <tr key={event.id} className="hover:bg-[#232635]/60 transition-colors">
                              <td className="px-4 py-3.5 font-mono text-text-muted text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3.5">
                                <div>
                                  <div className="font-bold text-white text-[12px]">
                                    {event.name || event.email.split('@')[0]}
                                    {event.handle && (
                                      <span className="ml-1.5 text-[10px] font-mono text-purple-400">@{event.handle}</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-text-muted font-mono">{event.email}</div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase font-mono ${
                                  event.action === 'download'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                                }`}>
                                  {event.action === 'download' ? <Download className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                                  {event.action}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                  {event.poster_theme.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 font-mono text-[10px] text-text-muted whitespace-nowrap">
                                {new Date(event.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* BROADCAST ANNOUNCEMENT MODAL */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151722] border border-[#232635] rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#232635] pb-3">
              <div className="flex items-center gap-2 text-coral font-bold text-sm">
                <Megaphone className="w-5 h-5" /> Broadcast Announcement to All Users
              </div>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="p-1 rounded-lg hover:bg-[#232635] text-text-muted hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-text-muted">
              This message will be instantly pushed in real-time over Socket.IO to every online user on campus, and added as an unread administrative alert in their notification section.
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-white block mb-1">Announcement Title (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. 📢 Platform Update / Campus Event"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-[#1D202D] border border-[#232635] rounded-xl p-3 text-xs text-white placeholder-text-muted outline-none focus:border-coral transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white block mb-1">Broadcast Message Body:</label>
                <textarea
                  rows={4}
                  placeholder="Type your official announcement here..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full bg-[#1D202D] border border-[#232635] rounded-xl p-3 text-xs text-white placeholder-text-muted outline-none focus:border-coral transition-all resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white block mb-1">Urgency Level:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'high', 'critical'] as const).map((urgency) => (
                    <button
                      key={urgency}
                      type="button"
                      onClick={() => setBroadcastUrgency(urgency)}
                      className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                        broadcastUrgency === urgency
                          ? urgency === 'critical'
                            ? 'bg-red-500/20 text-red-400 border-red-500'
                            : urgency === 'high'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                            : 'bg-coral/20 text-coral border-coral'
                          : 'bg-[#1D202D] text-text-muted border-[#232635] hover:text-white'
                      }`}
                    >
                      {urgency}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="px-4 py-2 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] text-text-muted hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendBroadcast}
                disabled={isBroadcasting || !broadcastMessage.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-coral to-orange-500 hover:from-coral-light hover:to-orange-400 text-white text-xs font-bold transition-all shadow-lg shadow-coral/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Megaphone className="w-3.5 h-3.5" />
                {isBroadcasting ? 'Broadcasting...' : 'Send Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE CONTENT REASON MODAL */}
      {removeItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151722] border border-[#232635] rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-coral font-bold text-sm">
              <AlertTriangle className="w-5 h-5" /> Remove Content & Warn Author
            </div>

            <p className="text-xs text-text-muted">
              Removing this item will delete it permanently, broadcast over sockets so it vanishes immediately, and send an official <strong className="text-amber-400">Moderation Warning</strong> to the author.
            </p>

            <div className="bg-[#1D202D] p-3 rounded-2xl border border-[#2B2F42] text-xs">
              <span className="text-[10px] text-text-muted uppercase font-bold block mb-1">Content Preview</span>
              <p className="text-white font-medium italic">"{removeItem.content}"</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white">Removal Reason:</label>
              <input
                type="text"
                placeholder="e.g., Harassment, Unsolicited promo, Spam"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                className="bg-[#1D202D] border border-[#232635] rounded-xl p-3 text-xs text-white placeholder-text-muted outline-none focus:border-coral transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRemoveItem(null)}
                className="px-4 py-2 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] text-text-muted hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemoveContent}
                disabled={isRemoving}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-lg shadow-red-500/20 cursor-pointer disabled:opacity-50"
              >
                {isRemoving ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BAN USER REASON MODAL */}
      {banTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151722] border border-[#232635] rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <Ban className="w-5 h-5" /> Ban User: {banTargetUser.name}
            </div>

            <p className="text-xs text-text-muted">
              Banning takes effect immediately across all endpoints in the app.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white">Reason for Ban:</label>
              <input
                type="text"
                placeholder="e.g., Severe community rules violation, Spam"
                value={banReasonInput}
                onChange={(e) => setBanReasonInput(e.target.value)}
                className="bg-[#1D202D] border border-[#232635] rounded-xl p-3 text-xs text-white placeholder-text-muted outline-none focus:border-coral transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setBanTargetUser(null)}
                className="px-4 py-2 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] text-text-muted hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBanUser}
                disabled={isBanning}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-lg shadow-red-500/20 cursor-pointer disabled:opacity-50"
              >
                {isBanning ? 'Banning...' : 'Confirm Ban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BAN & DELETE ROOM REASON MODAL */}
      {deleteRoomItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151722] border border-[#232635] rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" /> Ban & Delete Room: {deleteRoomItem.name}
            </div>

            <p className="text-xs text-text-muted">
              Terminating this room will permanently remove it, delete all messages, boot active room members in real-time over sockets, and send an official <strong className="text-amber-400">Moderation Warning</strong> to creator <strong className="text-white">{deleteRoomItem.creator_name || 'System / Admin'} (@{deleteRoomItem.creator_handle || 'system'})</strong>.
            </p>

            <div className="bg-[#1D202D] p-3.5 rounded-2xl border border-[#2B2F42] flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-coral font-bold uppercase block mb-0.5">Room Creator</span>
                <p className="text-white font-bold text-xs">{deleteRoomItem.creator_name || 'System / Admin'}</p>
                <p className="text-[10px] text-coral font-mono">@{deleteRoomItem.creator_handle || 'system'}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-text-muted font-bold uppercase block mb-0.5">Room Stats</span>
                <p className="text-white font-mono text-[11px]">{deleteRoomItem.member_count} Members • {deleteRoomItem.message_count} Messages</p>
                <p className="text-[10px] text-text-muted font-mono uppercase">Type: {deleteRoomItem.type}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white">Reason for Room Termination:</label>
              <input
                type="text"
                placeholder="e.g., Inappropriate content, Toxic speech, Unauthorized room creation"
                value={deleteRoomReason}
                onChange={(e) => setDeleteRoomReason(e.target.value)}
                className="bg-[#1D202D] border border-[#232635] rounded-xl p-3 text-xs text-white placeholder-text-muted outline-none focus:border-coral transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteRoomItem(null)}
                className="px-4 py-2 rounded-xl bg-[#1D202D] hover:bg-[#2B2F42] text-text-muted hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteRoom}
                disabled={isDeletingRoom}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-lg shadow-red-500/20 cursor-pointer disabled:opacity-50"
              >
                {isDeletingRoom ? 'Deleting...' : 'Ban & Delete Room'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
