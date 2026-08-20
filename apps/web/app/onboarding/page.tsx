'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Pencil } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useUser } from '../../components/layout-wrapper';

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

export default function OnboardingPage() {
  const { user, refreshUser } = useUser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [avatar, setAvatar] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Coding', 'Music', 'AI & Tech']);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasHandle, setHasHandle] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setAvatar((user.photos && user.photos[0]) || '');
      const emailPrefix = user.email?.split('@')[0] || '';
      if (user.handle && user.handle !== emailPrefix) {
        setUsername(user.handle);
        setHasHandle(true);
      } else {
        setUsername(emailPrefix);
        setHasHandle(false);
      }
      if ((user as any).interests?.length) {
        const loadedNames = (user as any).interests.map((i: any) => i.name || i.id);
        setSelectedInterests(loadedNames);
      }
    }
  }, [user]);

  const toggleInterest = (interestName: string) => {
    setSelectedInterests(prev =>
      prev.some(s => s.toLowerCase() === interestName.toLowerCase())
        ? prev.filter(s => s.toLowerCase() !== interestName.toLowerCase())
        : [...prev, interestName]
    );
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!hasHandle && username.trim()) {
      if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
        setError('Username can only use a–z, 0–9, _ or . (3–30 chars)');
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          bio,
          interests: selectedInterests,
          ...(!hasHandle && username.trim() ? { handle: username.trim() } : {}),
        }),
      });
      await refreshUser();
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handle = user?.handle || user?.email?.split('@')[0] || 'your_username';
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (username[0] || handle[0] || '?').toUpperCase();

  return (
    <div className="min-h-screen bg-[#0D0E15] flex flex-col items-center justify-start pt-8 pb-20 px-4">

      {/* Instagram-style top bar */}
      <div className="w-full max-w-sm flex items-center justify-between mb-8">
        <span className="text-[17px] font-semibold text-white tracking-tight">Edit profile</span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="text-[15px] font-semibold text-[#FF5252] hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {loading ? 'Saving…' : 'Done'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3">

        {/* Avatar + username card */}
        <div className="bg-[#151722] rounded-2xl flex flex-col items-center py-6 gap-2 mb-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group cursor-pointer"
          >
            <div className="w-[88px] h-[88px] rounded-full overflow-hidden bg-[#232635] border-2 border-[#232635] flex items-center justify-center">
              {avatar
                ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-[#FF5252]">{initials}</span>
              }
            </div>
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-[#FF5252] border-2 border-[#151722] flex items-center justify-center">
              <Camera className="w-3 h-3 text-white" />
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

          <p className="text-[15px] font-semibold text-white mt-0.5">@{handle}</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[13px] text-[#FF5252] font-medium"
          >
            Change photo
          </button>
        </div>

        {error && (
          <div className="px-4 py-2.5 rounded-xl bg-[#FF5252]/10 border border-[#FF5252]/25 text-[#FF5252] text-xs font-mono">
            {error}
          </div>
        )}

        {/* Fields card */}
        <div className="bg-[#151722] rounded-2xl overflow-hidden">
          {/* Name */}
          <div className="flex items-center gap-4 px-4 h-[52px] group border-b border-[#1C1E2C] focus-within:border-[#FF5252] transition-colors">
            <span className="text-[13px] text-[#8F96A6] w-[90px] shrink-0">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              className="flex-1 bg-transparent text-[15px] text-white placeholder-[#3a3d4a] outline-none caret-[#FF5252]"
              required
            />
            <Pencil className="w-3.5 h-3.5 text-[#3a3d4a] group-focus-within:text-[#FF5252] transition-colors shrink-0" />
          </div>

          {/* Username */}
          {hasHandle ? (
            <div className="flex items-center gap-4 px-4 h-[52px] border-b border-[#1C1E2C]">
              <span className="text-[13px] text-[#8F96A6] w-[90px] shrink-0">Username</span>
              <span className="flex-1 text-[15px] text-[#8F96A6]">@{username}</span>
            </div>
          ) : (
            <div className="flex items-center gap-4 px-4 h-[52px] group border-b border-[#1C1E2C] focus-within:border-[#FF5252] transition-colors">
              <span className="text-[13px] text-[#8F96A6] w-[90px] shrink-0">Username</span>
              <div className="flex-1 flex items-center gap-0.5">
                <span className="text-[15px] text-[#8F96A6]">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  placeholder="choose_username"
                  maxLength={30}
                  className="flex-1 bg-transparent text-[15px] text-white placeholder-[#3a3d4a] outline-none caret-[#FF5252]"
                />
              </div>
              <Pencil className="w-3.5 h-3.5 text-[#3a3d4a] group-focus-within:text-[#FF5252] transition-colors shrink-0" />
            </div>
          )}

          {/* Pronouns */}
          <div className="flex items-center gap-4 px-4 h-[52px] group border-b border-[#1C1E2C] focus-within:border-[#FF5252] transition-colors">
            <span className="text-[13px] text-[#8F96A6] w-[90px] shrink-0">Pronouns</span>
            <input
              type="text"
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              placeholder="Add pronouns"
              className="flex-1 bg-transparent text-[15px] text-white placeholder-[#3a3d4a] outline-none caret-[#FF5252]"
            />
            <Pencil className="w-3.5 h-3.5 text-[#3a3d4a] group-focus-within:text-[#FF5252] transition-colors shrink-0" />
          </div>

          {/* Bio */}
          <div className="flex items-start gap-4 px-4 py-3.5 group border-b border-[#1C1E2C] focus-within:border-[#FF5252] transition-colors">
            <span className="text-[13px] text-[#8F96A6] w-[90px] shrink-0 pt-[2px]">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Add a bio..."
              rows={3}
              maxLength={150}
              className="flex-1 bg-transparent text-[15px] text-white placeholder-[#3a3d4a] outline-none resize-none caret-[#FF5252] leading-snug"
            />
            <Pencil className="w-3.5 h-3.5 text-[#3a3d4a] group-focus-within:text-[#FF5252] transition-colors shrink-0 mt-[2px]" />
          </div>
        </div>

        {/* ── EDIT ABOUT: INTERESTS & TAGS CARD ── */}
        <div className="p-4 space-y-3 bg-[#151722] rounded-2xl border border-[#1C1E2C]">
          <span className="text-[12px] font-bold uppercase tracking-wider text-[#FF5252] block">Interests & Tags</span>
          
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
                      : 'bg-[#1C1E2C] border-[#232635] text-[#8F96A6] hover:text-white'
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
              className="flex-1 bg-[#1C1E2C] border border-[#232635] focus:border-[#FF5252] rounded-xl px-3 py-1.5 text-xs text-white outline-none"
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
              className="px-3 py-1.5 bg-[#FF5252] hover:bg-[#e54343] text-white text-xs font-bold rounded-xl transition-all"
            >
              Add
            </button>
          </div>
        </div>

        {bio.length > 0 && (
          <p className="text-right text-[11px] text-[#8F96A6] -mt-1 pr-1">{bio.length}/150</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full py-3.5 rounded-2xl bg-[#FF5252] hover:bg-[#e54343] active:scale-[0.98] text-white font-semibold text-[15px] shadow-lg shadow-[#FF5252]/20 transition-all disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save Profile'}
        </button>

      </form>
    </div>
  );
}
