'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Lock, 
  ChevronRight,
  LogOut,
  Info,
  Lightbulb,
  Ban
} from 'lucide-react';
import { useUser } from '../../components/layout-wrapper';
import BlockedUsersModal from '../../components/blocked-users-modal';

export default function SettingsPage() {
  const { logout } = useUser();
  const router = useRouter();

  // Settings states
  const [discoverable, setDiscoverable] = useState(true);
  const [incognito, setIncognito] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-6 pb-24">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold font-fraunces tracking-wide">Settings</h3>
        <p className="text-[10px] font-mono text-lavender/60">Configure your privacy, safety, and feedback settings</p>
      </div>

      <div className="space-y-6">

        {/* Section: Privacy & Discovery */}
        <div className="bg-paper/5 border border-lavender/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <h4 className="font-bold text-xs font-fraunces uppercase tracking-wider text-paper/90 flex items-center gap-1.5 border-b border-lavender/10 pb-3 mb-2">
            <Lock className="w-4 h-4 text-coral" /> Privacy & Discovery
          </h4>

          {/* Discoverable Card toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-xs font-semibold text-paper">Show Card in Feed</h5>
              <p className="text-[9px] text-lavender/55 mt-0.5">Toggle discovery card visibility on student swipe screens</p>
            </div>
            <button
              onClick={() => setDiscoverable(!discoverable)}
              className={`w-10 h-5.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                discoverable ? 'bg-coral' : 'bg-paper/10'
              }`}
            >
              <div className={`h-4.5 w-4.5 rounded-full bg-ink transition-transform ${
                discoverable ? 'translate-x-4.5' : 'translate-x-0'
              }`}></div>
            </button>
          </div>

          {/* Incognito mode */}
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-xs font-semibold text-paper">Incognito Room Joining</h5>
              <p className="text-[9px] text-lavender/55 mt-0.5">Hide my name from room active lists until I send a message</p>
            </div>
            <button
              onClick={() => setIncognito(!incognito)}
              className={`w-10 h-5.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                incognito ? 'bg-coral' : 'bg-paper/10'
              }`}
            >
              <div className={`h-4.5 w-4.5 rounded-full bg-ink transition-transform ${
                incognito ? 'translate-x-4.5' : 'translate-x-0'
              }`}></div>
            </button>
          </div>
        </div>

        {/* Section: Safety & Moderation */}
        <div className="bg-paper/5 border border-lavender/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <h4 className="font-bold text-xs font-fraunces uppercase tracking-wider text-paper/90 flex items-center gap-1.5 border-b border-lavender/10 pb-3 mb-2">
            <Ban className="w-4 h-4 text-coral" /> Safety & Moderation
          </h4>

          <div 
            onClick={() => setShowBlockedModal(true)}
            className="flex items-center justify-between py-1 cursor-pointer group"
          >
            <div>
              <h5 className="text-xs font-semibold text-paper group-hover:text-coral transition-colors">Blocked Students</h5>
              <p className="text-[9px] text-lavender/55 mt-0.5">View and manage blocked classmate connections</p>
            </div>
            <ChevronRight className="w-4 h-4 text-lavender/40 group-hover:text-paper transition-colors" />
          </div>
        </div>

        {/* Section: Support & Admin Feedback */}
        <div className="bg-paper/5 border border-lavender/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <h4 className="font-bold text-xs font-fraunces uppercase tracking-wider text-paper/90 flex items-center gap-1.5 border-b border-lavender/10 pb-3 mb-2">
            <Lightbulb className="w-4 h-4 text-coral" /> Support & Admin Feedback
          </h4>

          <div 
            onClick={() => window.dispatchEvent(new CustomEvent('open-feedback-widget'))}
            className="flex items-center justify-between py-1 cursor-pointer group"
          >
            <div>
              <h5 className="text-xs font-semibold text-paper group-hover:text-coral transition-colors flex items-center gap-1.5">
                <span>Send Feedback or Report Bugs to Admin</span>
              </h5>
              <p className="text-[9px] text-lavender/55 mt-0.5">Connect directly with Platform Admin to share ideas or report issues</p>
            </div>
            <ChevronRight className="w-4 h-4 text-lavender/40 group-hover:text-paper transition-colors" />
          </div>
        </div>

        {/* Section: Support Info */}
        <div className="flex items-center justify-between p-4 bg-paper/5 border border-lavender/10 rounded-2xl">
          <div className="flex items-center gap-2.5">
            <Info className="w-4.5 h-4.5 text-lavender/40" />
            <span className="text-[10px] font-mono text-lavender/50">Rogue Beta • Made with ❤️ for college students</span>
          </div>
          <button
            onClick={logout}
            className="px-3.5 py-1.5 border border-lavender/20 text-lavender hover:text-coral hover:border-coral text-[10px] font-bold font-mono rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
        </div>

      </div>

      <BlockedUsersModal
        isOpen={showBlockedModal}
        onClose={() => setShowBlockedModal(false)}
      />
    </div>
  );
}
