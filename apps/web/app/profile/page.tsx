'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Camera, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { getAvatarUrl } from '../../lib/avatar';
import { useUser } from '../../components/layout-wrapper';
import InstagramProfile, { DEFAULT_INSTA_AVATAR } from '../../components/instagram-profile';

const AVAILABLE_INTERESTS = [
  { id: '1', name: 'Coding' },
  { id: '2', name: 'Gaming' },
  { id: '3', name: 'Music' },
  { id: '4', name: 'AI & Tech' },
  { id: '5', name: 'Design' },
  { id: '6', name: 'Photography' },
  { id: '7', name: 'Sports' },
  { id: '8', name: 'Anime' },
  { id: '9', name: 'Foodie' },
  { id: '10', name: 'Fitness' },
];

const PROMPT_QUESTIONS = [
  "On weekends you'll find me...",
  "My secret campus spot...",
  "One thing I can't live without...",
  "Current hyperfixation...",
  "Best campus advice..."
];

export default function ProfilePage() {
  const { user, refreshUser, logout } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [handleInput, setHandleInput] = useState('');
  const [bio, setBio] = useState('');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [link, setLink] = useState('');
  const [avatar, setAvatar] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Coding', 'Music', 'AI & Tech']);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [promptQuestion, setPromptQuestion] = useState('About You');
  const [promptAnswer, setPromptAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setHandleInput(user.handle || '');
      setBio(user.bio || '');
      setBranch(user.branch || '');
      setYear(user.year || '');
      setAvatar((user.photos && user.photos[0]) || '');
      if ((user as any).interests?.length) {
        const loadedNames = (user as any).interests.map((i: any) => {
          if (typeof i === 'string') return i;
          const found = AVAILABLE_INTERESTS.find(a => a.id === i.id || a.name.toLowerCase() === (i.name || '').toLowerCase());
          return found ? found.name : (i.name || i.id);
        }).filter(Boolean);
        setSelectedInterests(loadedNames);

        const custom = loadedNames.filter((n: string) => !AVAILABLE_INTERESTS.some(a => a.name.toLowerCase() === n.toLowerCase()));
        setCustomTags(prev => Array.from(new Set([...prev, ...custom])));
      }
      if ((user as any).prompts?.length) {
        setPromptQuestion('About You');
        setPromptAnswer((user as any).prompts[0].answer || (user as any).prompts[0].question || '');
      }
    }
  }, [user]);

  const openEdit = () => {
    if (user) {
      setName(user.name || '');
      setHandleInput(user.handle || '');
      setBio(user.bio || '');
      setBranch(user.branch || '');
      setYear(user.year || '');
      setAvatar((user.photos && user.photos[0]) || '');
      if ((user as any).interests?.length) {
        const loadedNames = (user as any).interests.map((i: any) => {
          if (typeof i === 'string') return i;
          const found = AVAILABLE_INTERESTS.find(a => a.id === i.id || a.name.toLowerCase() === (i.name || '').toLowerCase());
          return found ? found.name : (i.name || i.id);
        }).filter(Boolean);
        setSelectedInterests(loadedNames);

        const custom = loadedNames.filter((n: string) => !AVAILABLE_INTERESTS.some(a => a.name.toLowerCase() === n.toLowerCase()));
        setCustomTags(prev => Array.from(new Set([...prev, ...custom])));
      }
      if ((user as any).prompts?.length) {
        setPromptQuestion('About You');
        setPromptAnswer((user as any).prompts[0].answer || (user as any).prompts[0].question || '');
      }
    }
    setIsEditing(true);
  };

  const toggleInterest = (tagName: string) => {
    setSelectedInterests(prev => {
      const isPresent = prev.some(t => t.toLowerCase() === tagName.toLowerCase());
      if (isPresent) {
        return prev.filter(t => t.toLowerCase() !== tagName.toLowerCase());
      } else {
        return [...prev, tagName];
      }
    });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payloadInterests = selectedInterests.map(item => {
        const found = AVAILABLE_INTERESTS.find(a => a.id === item || a.name.toLowerCase() === item.toLowerCase());
        return found ? found.name : item;
      });

      // Save profile info + interests simultaneously
      await apiFetch('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ 
          name, 
          bio, 
          branch, 
          year, 
          handle: handleInput.trim().toLowerCase(),
          interests: payloadInterests
        }),
      });
      
      try {
        await apiFetch('/api/users/me/interests', {
          method: 'PUT',
          body: JSON.stringify({ interestIds: payloadInterests }),
        });
      } catch (e) {}

      if (promptAnswer.trim()) {
        try {
          await apiFetch('/api/users/me/prompts', {
            method: 'POST',
            body: JSON.stringify({ question: promptQuestion, answer: promptAnswer }),
          });
        } catch (e) {}
      }

      await refreshUser();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsEditing(false);
      }, 500);
    } catch (err: any) {
      alert(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-[#8F96A6]">
        <p className="text-sm">Please sign in to view your profile.</p>
      </div>
    );
  }

  const handle = user.handle || user.email?.split('@')[0] || 'username';

  return (
    <div className="min-h-screen bg-[#0D0E15]">

      {/* ── INSTAGRAM-STYLE EDIT MODAL ── */}
      {isEditing && (
        <div 
          onClick={() => setIsEditing(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            className="bg-[#0D0E15] w-full max-w-md max-h-[88vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl cursor-default border border-[#232635]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal top bar */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-[#232635]">
              <button
                onClick={() => setIsEditing(false)}
                className="text-white hover:opacity-70 transition-opacity p-1"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="text-[16px] font-semibold text-white">Edit Profile & About</span>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`text-[15px] font-semibold transition-colors disabled:opacity-40 cursor-pointer ${
                  success ? 'text-emerald-400' : 'text-[#FF5252] hover:opacity-80'
                }`}
              >
                {saving ? 'Saving…' : success ? 'Saved ✓' : 'Done'}
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="overflow-y-auto flex-1">
              {/* Avatar + change photo */}
              <div className="flex flex-col items-center py-5 gap-2 bg-[#151722]">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group cursor-pointer"
                >
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-[#232635] border-2 border-[#232635] flex items-center justify-center">
                    <img src={getAvatarUrl(avatar)} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full bg-[#FF5252] border-2 border-[#151722] flex items-center justify-center">
                    <Camera className="w-2.5 h-2.5 text-white" />
                  </div>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

                <p className="text-[14px] font-semibold text-white">@{handle}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[13px] text-[#FF5252] font-medium cursor-pointer"
                >
                  Change photo
                </button>
              </div>

              {/* Form fields */}
              <form onSubmit={handleSave} className="flex flex-col divide-y divide-[#1C1E2C] bg-[#151722] border-t border-[#1C1E2C]">

                {/* Name */}
                <div className="flex items-center gap-4 px-4 h-[52px] transition-all focus-within:bg-[#1D202E]">
                  <span className="text-[13px] text-[#8F96A6] w-[90px] shrink-0">Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="flex-1 bg-transparent text-[14px] text-white placeholder-[#3a3d4a] outline-none caret-[#FF5252]"
                    required
                  />
                </div>

                {/* Username */}
                <div className="flex items-center gap-4 px-4 h-[52px] transition-all focus-within:bg-[#1D202E]">
                  <span className="text-[13px] text-[#8F96A6] w-[90px] shrink-0">Username</span>
                  <div className="flex-1 flex items-center gap-1 text-[14px]">
                    <span className="text-coral font-mono font-bold">@</span>
                    <input
                      type="text"
                      value={handleInput}
                      onChange={(e) => setHandleInput(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                      placeholder="username"
                      className="flex-1 bg-transparent text-white placeholder-[#3a3d4a] outline-none caret-[#FF5252] font-mono text-xs"
                      required
                    />
                  </div>
                </div>

                {/* Branch / Major */}
                <div className="flex items-center gap-4 px-4 h-[52px] transition-all focus-within:bg-[#1D202E]">
                  <span className="text-[13px] text-[#8F96A6] w-[90px] shrink-0">Branch</span>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="flex-1 bg-transparent text-[14px] text-white placeholder-[#3a3d4a] outline-none caret-[#FF5252]"
                  />
                </div>

                {/* Year */}
                <div className="flex items-center gap-4 px-4 h-[52px] transition-all focus-within:bg-[#1D202E]">
                  <span className="text-[13px] text-[#8F96A6] w-[90px] shrink-0">Year</span>
                  <input
                    type="text"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="e.g. 3rd Year"
                    className="flex-1 bg-transparent text-[14px] text-white placeholder-[#3a3d4a] outline-none caret-[#FF5252]"
                  />
                </div>

                {/* Bio */}
                <div className="flex items-start gap-4 px-4 py-3.5 transition-all focus-within:bg-[#1D202E]">
                  <span className="text-[13px] text-[#8F96A6] w-[90px] shrink-0 pt-[2px]">Bio</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Add a bio..."
                    rows={2}
                    maxLength={150}
                    className="flex-1 bg-transparent text-[14px] text-white placeholder-[#3a3d4a] outline-none resize-none caret-[#FF5252] leading-snug"
                  />
                </div>

                {/* ── EDIT ABOUT: INTERESTS & TAGS ── */}
                <div className="p-4 space-y-3 bg-[#0F1018]">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#FF5252] block">Edit Interests & Tags</span>
                  
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_INTERESTS.concat(customTags.map(t => ({ id: t, name: t }))).map(item => {
                      const isSelected = selectedInterests.some(s => s.toLowerCase() === item.name.toLowerCase());
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleInterest(item.name)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1 ${
                            isSelected 
                              ? 'bg-[#FF5252] border-[#FF5252] text-white shadow-md font-bold' 
                              : 'bg-[#151722] border-[#232635] text-[#8F96A6] hover:text-white'
                          }`}
                        >
                          <span>{isSelected ? '✓' : '+'}</span>
                          <span>{item.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Manual Custom Tag Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (customTagInput.trim()) {
                            const newTag = customTagInput.trim();
                            if (!customTags.includes(newTag)) {
                              setCustomTags(prev => [...prev, newTag]);
                            }
                            if (!selectedInterests.includes(newTag)) {
                              setSelectedInterests(prev => [...prev, newTag]);
                            }
                            setCustomTagInput('');
                          }
                        }
                      }}
                      placeholder="Add custom tag (e.g. Guitar)..."
                      className="flex-1 bg-[#151722] border border-[#232635] focus:border-[#FF5252] rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customTagInput.trim()) {
                          const newTag = customTagInput.trim();
                          if (!customTags.includes(newTag)) {
                            setCustomTags(prev => [...prev, newTag]);
                          }
                          if (!selectedInterests.includes(newTag)) {
                            setSelectedInterests(prev => [...prev, newTag]);
                          }
                          setCustomTagInput('');
                        }
                      }}
                      className="px-3.5 py-1.5 bg-[#1F2230] hover:bg-[#FF5252] border border-[#232635] text-xs font-bold text-white rounded-xl transition-all cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* ── EDIT ABOUT: ABOUT YOU ── */}
                <div className="p-4 space-y-2 bg-[#0F1018]">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-teal-400 block">About You</span>
                  <textarea
                    value={promptAnswer}
                    onChange={(e) => setPromptAnswer(e.target.value)}
                    placeholder="Tell campus something about yourself..."
                    rows={3}
                    className="w-full bg-[#151722] border border-[#232635] focus:border-teal-400 rounded-xl p-3 text-xs text-white outline-none leading-relaxed resize-none"
                  />
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

      {/* Profile View with InstagramProfile component */}
      <div className="pt-2">
        <InstagramProfile 
          userId={user.id} 
          isSelf={true} 
          currentUserId={user.id} 
          onEditProfile={openEdit}
          onLogout={logout}
        />
      </div>
    </div>
  );
}
