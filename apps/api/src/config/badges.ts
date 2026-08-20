export interface FoundingBadgeInfo {
  signup_number: number;
  type: 'founder' | 'early_star' | 'founding_member';
  icon: string;
  label: string;
  tooltip: string;
}

export function getFoundingBadge(signupNumber?: number | null): FoundingBadgeInfo | null {
  if (!signupNumber || signupNumber <= 0 || signupNumber > 100) {
    return null;
  }

  if (signupNumber === 1) {
    return {
      signup_number: 1,
      type: 'founder',
      icon: '👑',
      label: 'Founder #1',
      tooltip: 'Founder #1 — The very first student on Rogue'
    };
  }

  if (signupNumber >= 2 && signupNumber <= 10) {
    return {
      signup_number: signupNumber,
      type: 'early_star',
      icon: '🌟',
      label: `Early Star #${signupNumber}`,
      tooltip: `Early Star #${signupNumber} — Top 10 Founding Member`
    };
  }

  return {
    signup_number: signupNumber,
    type: 'founding_member',
    icon: '✦',
    label: `Founding Member #${signupNumber}`,
    tooltip: `Founding Member #${signupNumber} — Top 100 Founding Member`
  };
}
