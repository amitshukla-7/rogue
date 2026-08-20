'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Hash, 
  Users, 
  MessageSquare,
  Radio, 
  ArrowRight,
  Zap,
  Sparkles,
  Compass
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useUser } from '../../components/layout-wrapper';
import { Room } from '@campusconnect/shared';
import FlashHangoutsSection from '../../components/flash-hangouts';

export default function RoomsPage() {
  const { user, demoLogin } = useUser();
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'flash' | 'lounges'>('all');
  const [activeHoldRoomId, setActiveHoldRoomId] = useState<string | null>(null);

  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (roomId: string) => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      setActiveHoldRoomId(roomId);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    }, 350);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    setTimeout(() => setActiveHoldRoomId(null), 2000);
  };

  const fetchRooms = async () => {
    try {
      const data = await apiFetch('/api/rooms');
      if (data) {
        setRooms(data);
      }
    } catch (err: any) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleJoinRoom = async (roomId: string) => {
    if (!user) {
      demoLogin('student-demo-1').catch(() => {});
    } else {
      apiFetch(`/api/rooms/${roomId}/join`, { method: 'POST' }).catch(() => {});
    }
    router.push(`/rooms/${roomId}`);
  };

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const PERMANENT_LOUNGES = ['lounge-general', 'lounge-tech', 'lounge-gaming', 'lounge-latenight', 'lounge-anime'];
  const officialLounges = filteredRooms.filter((r) => PERMANENT_LOUNGES.includes(r.id) || (r.is_official && r.id.startsWith('lounge-')));
  const flashJoinedRooms = filteredRooms.filter((r) => !PERMANENT_LOUNGES.includes(r.id) && !r.id.startsWith('lounge-'));

  return (
    <div className="min-h-screen bg-[#0E0F14] text-[#E2E8F0] p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6 pb-32">
      
      {/* UNIFIED FLASH MEETUPS HERO MODULE */}
      <FlashHangoutsSection />

      {/* SEARCH BAR & FILTER TABS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#8F96A6]">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161822] border border-[#202330] focus:border-coral rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-[#8F96A6] outline-none transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-[#161822] border border-[#202330] p-1 rounded-xl self-start sm:self-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'flash', label: 'Flash Meetups' },
            { id: 'lounges', label: 'Campus Rooms' }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-[#202330] text-white font-bold border border-[#2D3143]'
                    : 'text-[#8F96A6] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

      </div>

      {/* SECTION 2: PERMANENT CAMPUS ROOMS */}
      {(activeTab === 'all' || activeTab === 'lounges') && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between border-b border-[#202330] pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8F96A6] flex items-center gap-1.5 font-mono">
              <Hash className="w-3.5 h-3.5 text-coral" /> Campus Rooms
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-[#161822] animate-pulse border border-[#202330]"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {officialLounges.map((lounge) => {
                return (
                  <div
                    key={lounge.id}
                    onClick={() => handleJoinRoom(lounge.id)}
                    className="bg-[#161822] border border-[#202330] hover:border-coral/50 rounded-xl p-3.5 flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-coral/10 border border-coral/20 flex items-center justify-center text-coral shrink-0 transition-colors">
                        <Hash className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-xs md:text-sm text-[#F2F3F5] group-hover:text-coral transition-colors truncate">
                          {lounge.name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}⚡☕💻🎮🌙🍿🚗]/gu, '').trim()}
                        </h3>
                      </div>
                    </div>

                    <span className="text-xs font-semibold text-[#8F96A6] group-hover:text-coral transition-colors shrink-0 ml-2">
                      Enter →
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: FLASH MEETUPS */}
      {(activeTab === 'flash' || (activeTab === 'all' && flashJoinedRooms.length > 0)) && (
        <div className="space-y-3 pt-3">
          <div className="flex items-center justify-between border-b border-[#202330] pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8F96A6] flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5 text-coral fill-coral" /> Flash Meetups
            </h2>
          </div>

          {flashJoinedRooms.length === 0 ? (
            <div className="bg-[#161822] border border-[#202330] rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-coral/10 border border-coral/20 flex items-center justify-center text-coral mb-1">
                <Zap className="w-6 h-6 fill-coral" />
              </div>
              <h3 className="font-bold text-sm text-[#F2F3F5]">No meetings available right now</h3>
              <p className="text-xs text-[#8F96A6] max-w-sm">Create your own meeting using the Flash Meetup tool above to connect with campus peers!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {flashJoinedRooms.map((room) => {
                return (
                  <div
                    key={room.id}
                    onClick={() => handleJoinRoom(room.id)}
                    className="bg-[#161822] border border-[#202330] hover:border-coral/50 rounded-xl p-3.5 flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-coral/10 border border-coral/30 flex items-center justify-center text-coral shrink-0">
                        <Zap className="w-3.5 h-3.5 fill-coral" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-bold text-xs text-[#F2F3F5] group-hover:text-coral transition-colors truncate">
                          {room.name}
                        </h3>
                        <div className="text-[10px] font-mono text-[#8F96A6] mt-0.5">
                          <span>{room.member_count || 1} members</span>
                        </div>
                      </div>
                    </div>

                    <button className="px-3 py-1 bg-coral hover:bg-coral-hover text-white text-xs font-bold rounded-lg transition-all shrink-0 ml-2">
                      Chat →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
