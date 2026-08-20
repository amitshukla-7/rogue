'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MoreVertical, 
  MessageCircle, 
  Flag, 
  Ban, 
  X, 
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useUser } from './layout-wrapper';
import { blockUser, isUserBlocked } from '../lib/block';

interface PostActionMenuProps {
  creatorId: string;
  creatorName: string;
  creatorHandle?: string;
  contentId?: string;
  contentType?: 'post' | 'flash_hangout' | 'room' | 'comment';
  onUserBlocked?: (userId: string) => void;
  onPostDeleted?: (contentId: string) => void;
}

export default function PostActionMenu({
  creatorId,
  creatorName,
  creatorHandle,
  contentId,
  contentType = 'post',
  onUserBlocked,
  onPostDeleted
}: PostActionMenuProps) {
  const router = useRouter();
  const { user } = useUser();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = !!(
    user?.id && (
      user.id === creatorId ||
      user.id.toString() === creatorId?.toString() ||
      (user as any).is_admin ||
      user.email === 'admin@campusconnect.com'
    )
  );
  
  // Report form state
  const [reportReason, setReportReason] = useState('Inappropriate / Offensive Content');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Block state
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(() => isUserBlocked(creatorId));

  const handleMessageUser = () => {
    setShowDropdown(false);
    if (!creatorId || creatorId === 'anonymous') {
      alert('Cannot message an anonymous user.');
      return;
    }
    router.push(`/chat?user=${creatorId}&name=${encodeURIComponent(creatorName || 'Student')}&handle=${encodeURIComponent(creatorHandle || '')}`);
  };

  const handleOpenReport = () => {
    setShowDropdown(false);
    setShowReportModal(true);
    setReportSuccess(false);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReport(true);

    const reportPayload = {
      reported_user_id: creatorId,
      content_id: contentId || 'direct-user',
      content_type: contentType,
      reason: reportReason,
      details: reportDetails,
      created_at: new Date().toISOString()
    };

    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify(reportPayload)
      });
    } catch (err) {
      // Fallback local storage for admin panel
      try {
        const existing = JSON.parse(localStorage.getItem('admin_reports') || '[]');
        existing.unshift(reportPayload);
        localStorage.setItem('admin_reports', JSON.stringify(existing));
      } catch (e) {}
    } finally {
      setSubmittingReport(false);
      setReportSuccess(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
        setReportDetails('');
      }, 2000);
    }
  };

  const handleBlockUser = async () => {
    setShowDropdown(false);
    if (!creatorId || creatorId === 'anonymous') return;

    if (!confirm(`Are you sure you want to block @${creatorHandle || creatorName}? You won't see their posts or meetups.`)) {
      return;
    }

    setBlocking(true);
    try {
      await apiFetch('/api/users/block', {
        method: 'POST',
        body: JSON.stringify({ block_user_id: creatorId })
      });
    } catch (err) {
    } finally {
      blockUser({ id: creatorId, name: creatorName, handle: creatorHandle });
      setBlocking(false);
      setBlocked(true);
      if (onUserBlocked) {
        onUserBlocked(creatorId);
      }
    }
  };

  const handleDeletePost = async () => {
    setShowDropdown(false);
    if (!contentId) return;

    const isHangout = contentType === 'flash_hangout' || contentType === 'room';
    const label = isHangout ? 'Meetup' : 'Post';

    if (!confirm(`Are you sure you want to delete this ${label}? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const endpoint = isHangout ? `/api/rooms/hangouts/${contentId}` : `/api/posts/${contentId}`;
      await apiFetch(endpoint, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error(`Delete ${label} error:`, err);
    } finally {
      setDeleting(false);
      if (onPostDeleted) {
        onPostDeleted(contentId);
      }
    }
  };

  if (blocked) {
    return (
      <span className="text-[10px] text-text-muted font-mono bg-[#1A1C28] px-2 py-0.5 rounded">
        User Blocked
      </span>
    );
  }

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowDropdown(!showDropdown);
        }}
        className="p-1.5 rounded-lg bg-[#202330]/60 hover:bg-[#202330] text-[#8F96A6] hover:text-white transition-colors cursor-pointer"
        title="More options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* DROPDOWN MENU */}
      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)} 
          />
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 mt-1 w-44 bg-[#161822] border border-[#2B2F42] rounded-xl shadow-2xl z-50 py-1 divide-y divide-[#202330] animate-in fade-in duration-150"
          >
            {/* Delete Option ONLY for Author or Admin (Instagram-style) */}
            {isOwner ? (
              <div className="py-1">
                <button
                  onClick={handleDeletePost}
                  disabled={deleting}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>{deleting ? 'Deleting...' : (contentType === 'flash_hangout' || contentType === 'room' ? 'Delete Meetup' : 'Delete Post')}</span>
                </button>
              </div>
            ) : (
              <>
                <div className="py-1">
                  <button
                    onClick={handleMessageUser}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-white hover:bg-[#202330] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-teal" />
                    <span>Message</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={handleOpenReport}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-amber-400 hover:bg-[#202330] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5 text-amber-400" />
                    <span>Report</span>
                  </button>

                  <button
                    onClick={handleBlockUser}
                    disabled={blocking}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-400 hover:bg-[#202330] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5 text-rose-400" />
                    <span>{blocking ? 'Blocking...' : 'Block'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* REPORT MODAL */}
      {showReportModal && (
        <div 
          onClick={() => setShowReportModal(false)}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#161822] border border-[#2B2F42] rounded-2xl p-5 shadow-2xl relative space-y-4"
          >
            <button
              onClick={() => setShowReportModal(false)}
              className="absolute top-3.5 right-3.5 p-1 text-[#8F96A6] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Report Content</h3>
                <p className="text-[11px] text-[#8F96A6]">Flag safety or guideline violations</p>
              </div>
            </div>

            {reportSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                <h4 className="text-xs font-bold text-white">Report Submitted</h4>
                <p className="text-[11px] text-[#8F96A6]">
                  Thank you for keeping campus safe. We will review your report.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#8F96A6] mb-1 uppercase">Reason for report</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-[#0E0F14] border border-[#202330] focus:border-amber-400 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  >
                    <option value="Inappropriate / Offensive Content">Inappropriate / Offensive Content</option>
                    <option value="Spam or Misleading Post">Spam or Misleading Post</option>
                    <option value="Harassment or Bullying">Harassment or Bullying</option>
                    <option value="Fake Profile or Impersonation">Fake Profile or Impersonation</option>
                    <option value="Other Safety Violation">Other Safety Violation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#8F96A6] mb-1 uppercase">Additional Notes (Optional)</label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide details..."
                    rows={3}
                    className="w-full bg-[#0E0F14] border border-[#202330] focus:border-amber-400 rounded-xl p-2.5 text-xs text-white outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingReport}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {submittingReport ? 'Submitting Report...' : 'Submit Report'}
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
