'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import InstagramProfile from '../../../components/instagram-profile';
import { useUser } from '../../../components/layout-wrapper';

export default function UserProfilePage() {
  const params = useParams();
  const userId = params?.userId as string;
  const { user } = useUser();

  const isSelf = user ? user.id === userId : false;

  return (
    <div className="min-h-screen bg-[#0D0E15]">
      <InstagramProfile userId={userId} isSelf={isSelf} currentUserId={user?.id} />
    </div>
  );
}
