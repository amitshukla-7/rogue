export interface BlockedUser {
  id: string;
  name: string;
  handle?: string;
  photos?: string[];
  blockedAt?: string;
}

export function getBlockedUsers(): BlockedUser[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('blocked_users_details');
    if (raw) {
      return JSON.parse(raw);
    }
    // Fallback: migrate from legacy simple string array if present
    const simpleArray: string[] = JSON.parse(localStorage.getItem('blocked_users') || '[]');
    return simpleArray.map(id => ({
      id,
      name: `User (${id.slice(0, 6)})`,
      handle: id
    }));
  } catch (e) {
    return [];
  }
}

export function getBlockedUserIds(): string[] {
  const users = getBlockedUsers();
  return users.map(u => u.id);
}

export function isUserBlocked(userId: string): boolean {
  if (!userId) return false;
  const ids = getBlockedUserIds();
  return ids.includes(userId);
}

export function blockUser(user: { id: string; name?: string; handle?: string; photos?: string[] }) {
  if (!user || !user.id) return;
  const current = getBlockedUsers();
  if (current.some(u => u.id === user.id)) return;

  const updated: BlockedUser[] = [
    {
      id: user.id,
      name: user.name || 'Campus Student',
      handle: user.handle,
      photos: user.photos || [],
      blockedAt: new Date().toISOString()
    },
    ...current
  ];

  try {
    localStorage.setItem('blocked_users_details', JSON.stringify(updated));
    localStorage.setItem('blocked_users', JSON.stringify(updated.map(u => u.id)));
    // Dispatch custom event so components re-render immediately
    window.dispatchEvent(new CustomEvent('blocked-users-updated'));
  } catch (e) {}
}

export function unblockUser(userId: string) {
  if (!userId) return;
  const current = getBlockedUsers();
  const updated = current.filter(u => u.id !== userId);

  try {
    localStorage.setItem('blocked_users_details', JSON.stringify(updated));
    localStorage.setItem('blocked_users', JSON.stringify(updated.map(u => u.id)));
    // Dispatch custom event so components re-render immediately
    window.dispatchEvent(new CustomEvent('blocked-users-updated'));
  } catch (e) {}
}
