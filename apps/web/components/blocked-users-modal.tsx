'use client';

import React, { useState, useEffect } from 'react';
import { Ban, X, ShieldCheck, UserCheck } from 'lucide-react';
import { getBlockedUsers, unblockUser, BlockedUser } from '../lib/block';

interface BlockedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BlockedUsersModal({ isOpen, onClose }: BlockedUsersModalProps) {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  const refreshList = () => {
    setBlockedUsers(getBlockedUsers());
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => refreshList();
    window.addEventListener('blocked-users-updated', handleUpdate);
    return () => window.removeEventListener('blocked-users-updated', handleUpdate);
  }, []);

  const handleUnblock = (userId: string, userName: string) => {
    if (confirm(`Unblock ${userName}? They will be able to see your posts and interact with you again.`)) {
      unblockUser(userId);
      refreshList();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#14151D] border border-[#232635] rounded-3xl p-5 shadow-2xl relative space-y-4 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232635] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Blocked Accounts</h3>
              <p className="text-[11px] text-[#8F96A6]">Users you have blocked on Rogue</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8F96A6] hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {blockedUsers.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <UserCheck className="w-10 h-10 mx-auto text-[#8F96A6]/40 stroke-1" />
              <p className="text-xs font-semibold text-white">No blocked users</p>
              <p className="text-[11px] text-[#8F96A6]">Accounts you block will appear here.</p>
            </div>
          ) : (
            blockedUsers.map((u) => (
              <div 
                key={u.id}
                className="flex items-center justify-between p-3 bg-[#1A1C28] border border-[#232635] rounded-2xl hover:border-[#2D3247] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#232635] overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center">
                    {u.photos && u.photos.length > 0 ? (
                      <img src={u.photos[0]} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-white">{u.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{u.name}</h4>
                    <p className="text-[10px] text-coral font-mono truncate">
                      @{u.handle || u.id}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleUnblock(u.id, u.name)}
                  className="px-3 py-1.5 rounded-xl bg-coral/10 hover:bg-coral hover:text-white border border-coral/30 text-coral text-xs font-bold transition-all cursor-pointer flex-shrink-0"
                >
                  Unblock
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-[#232635] text-center">
          <p className="text-[10px] text-[#8F96A6]">
            Blocked users cannot view your profile, posts, meetups, or send you messages.
          </p>
        </div>
      </div>
    </div>
  );
}
