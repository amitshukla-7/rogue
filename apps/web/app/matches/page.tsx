'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MatchesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/chat');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0D0E15] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent"></div>
        <p className="font-mono text-xs text-[#8F96A6]">Redirecting to Chats...</p>
      </div>
    </div>
  );
}
