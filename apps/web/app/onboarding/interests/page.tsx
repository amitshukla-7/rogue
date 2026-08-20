'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles, MessageCircle } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useUser } from '../../../components/layout-wrapper';
import { Interest } from '@campusconnect/shared';

const PROMPT_QUESTIONS = [
  "I could talk for hours about...",
  "The best way to start my day is...",
  "A random fact about me is...",
  "My ultimate hackathon idea would be...",
  "What are you building this weekend?"
];

export default function InterestsOnboardingPage() {
  const { refreshUser } = useUser();
  const router = useRouter();

  const [interests, setInterests] = useState<Interest[]>([]);
  const [selectedInterestIds, setSelectedInterestIds] = useState<number[]>([]);
  const [promptQuestion, setPromptQuestion] = useState(PROMPT_QUESTIONS[0]);
  const [promptAnswer, setPromptAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [interestsLoading, setInterestsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInterests = async () => {
      try {
        const data = await apiFetch('/api/users/interests');
        if (data) {
          setInterests(data);
        }
      } catch (err: any) {
        console.error('Failed to load interests:', err);
        setError('Could not load interests tags. Using defaults.');
        // Fallback seed values
        setInterests([
          { id: 1, name: 'Coding', category: 'Tech' },
          { id: 2, name: 'Music', category: 'Arts' },
          { id: 3, name: 'Photography', category: 'Arts' },
          { id: 4, name: 'Football', category: 'Sports' },
          { id: 5, name: 'Anime', category: 'Entertainment' },
          { id: 6, name: 'Hackathons', category: 'Tech' },
          { id: 7, name: 'Gaming', category: 'Tech' }
        ]);
      } finally {
        setInterestsLoading(false);
      }
    };
    fetchInterests();
  }, []);

  const toggleInterest = (id: number) => {
    setSelectedInterestIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedInterestIds.length === 0) {
      setError('Please select at least one interest');
      return;
    }
    if (!promptAnswer.trim()) {
      setError('Please answer the prompt question');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Save interests
      await apiFetch('/api/users/me/interests', {
        method: 'PUT',
        body: JSON.stringify({ interestIds: selectedInterestIds }),
      });

      // Save prompt response
      await apiFetch('/api/users/me/prompts', {
        method: 'POST',
        body: JSON.stringify({ question: promptQuestion, answer: promptAnswer }),
      });

      await refreshUser();
      router.push('/rooms');
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink p-6 relative">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-coral/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-star/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-2xl bg-paper/5 border border-lavender/10 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center mb-8 border-b border-lavender/10 pb-4">
          <div>
            <h2 className="text-2xl font-bold font-fraunces">Choose Your Vibes</h2>
            <p className="text-xs text-lavender mt-1">Select interests and write a prompt to match with others</p>
          </div>
          <div className="text-xs font-mono font-bold px-3 py-1 bg-coral/10 text-coral border border-coral/20 rounded-full">
            Step 2 of 2
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-coral/10 border border-coral/30 text-coral text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Interests selection */}
          <div>
            <label className="block text-xs font-mono tracking-wider text-lavender uppercase mb-4 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-coral" /> Select Interests (min 1)
            </label>
            {interestsLoading ? (
              <div className="flex items-center gap-2 py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-coral border-t-transparent"></div>
                <span className="text-xs text-lavender font-mono">Loading tags...</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {interests.map((interest) => {
                  const isSelected = selectedInterestIds.includes(interest.id);
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      onClick={() => toggleInterest(interest.id)}
                      className={`px-4 py-2 rounded-full border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-coral border-coral text-ink font-bold shadow-md shadow-coral/10 scale-105'
                          : 'bg-paper/5 border-lavender/15 text-lavender hover:border-lavender/35 hover:bg-paper/10'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-ink stroke-[3]" />}
                      {interest.name}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        isSelected ? 'bg-ink/10 text-ink/75' : 'bg-paper/10 text-lavender/65'
                      }`}>
                        {interest.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prompt card */}
          <div className="p-6 rounded-2xl bg-paper/5 border border-lavender/10 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-coral/5 rounded-full blur-2xl pointer-events-none"></div>
            <label className="block text-xs font-mono tracking-wider text-lavender uppercase flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-coral" /> Answer a Prompt Question
            </label>

            <div className="flex flex-col gap-3">
              <select
                value={promptQuestion}
                onChange={(e) => setPromptQuestion(e.target.value)}
                className="w-full bg-ink border border-lavender/15 focus:border-coral rounded-xl py-3 px-4 text-sm text-paper outline-none transition-all"
              >
                {PROMPT_QUESTIONS.map((q, idx) => (
                  <option key={idx} value={q}>
                    {q}
                  </option>
                ))}
              </select>

              <textarea
                placeholder="Write your answer here..."
                value={promptAnswer}
                onChange={(e) => setPromptAnswer(e.target.value)}
                rows={3}
                className="w-full bg-paper/5 border border-lavender/15 focus:border-coral rounded-xl py-3 px-4 text-sm text-paper placeholder-lavender/40 outline-none transition-all resize-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || interestsLoading}
            className="w-full py-3.5 rounded-xl bg-coral hover:bg-opacity-95 text-ink font-bold text-sm shadow-lg shadow-coral/10 hover:shadow-coral/20 transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer"
          >
            {loading ? 'Completing Profile...' : 'Finish & Enter CampusConnect'}
          </button>
        </form>
      </div>
    </div>
  );
}
