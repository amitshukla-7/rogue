import React from 'react';

export interface FoundingBadgeInfo {
  signup_number?: number;
  type?: 'founder' | 'early_star' | 'founding_member';
  icon?: string;
  label?: string;
  tooltip?: string;
}

export interface FoundingBadgeProps {
  badge?: FoundingBadgeInfo | null;
  position?: number | null;
  size?: 'xs' | 'sm' | 'md' | string;
  className?: string;
}

/**
 * Super Crisp & Minimal Golden Crown Icon for Top 100 Founding Members.
 * Clean, flat vector crown icon without any outer glow or background shadow.
 * Hovering displays: "Very first members to join Rogue".
 */
export function FoundingBadge({ 
  badge, 
  position, 
  size = 'sm', 
  className = '' 
}: FoundingBadgeProps) {
  const num = badge?.signup_number || position;
  const isEligible = !!badge || (num !== undefined && num !== null && num > 0 && num <= 100);

  if (!isEligible) return null;

  const tooltipText = "Very first members to join Rogue";

  // Size mapping
  const iconSize = size === 'xs' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-4.5 h-4.5' : 'w-4 h-4';

  return (
    <span
      className={`inline-flex items-center justify-center select-none cursor-help ${className}`}
      title={tooltipText}
    >
      {/* Clean Flat Golden Crown Icon */}
      <svg 
        className={`${iconSize} text-amber-400 fill-amber-400 shrink-0`} 
        viewBox="0 0 24 24"
      >
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
      </svg>
    </span>
  );
}

export default FoundingBadge;
