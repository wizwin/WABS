import React from 'react';

export function AppIcon({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" rx="28" fill="url(#grad)" />
      {/* Stacked Disks / Database */}
      <ellipse cx="60" cy="46" rx="32" ry="12" fill="white" />
      <path d="M28 46V62C28 68.6274 42.3269 74 60 74C77.6731 74 92 68.6274 92 62V46" fill="white" fillOpacity="0.8" />
      <path d="M28 62V78C28 84.6274 42.3269 90 60 90C77.6731 90 92 84.6274 92 78V62" fill="white" fillOpacity="0.5" />
      {/* Magnifying Glass */}
      <circle cx="76" cy="76" r="16" stroke="white" strokeWidth="6" />
      <path d="M88 88L102 102" stroke="white" strokeWidth="8" strokeLinecap="round" />
      {/* Star / Sparkle for WiZarD */}
      <path d="M40 26L42 36L52 38L42 40L40 50L38 40L28 38L38 36L40 26Z" fill="#fcd34d" />
      <path d="M78 30L79 35L84 36L79 37L78 42L77 37L72 36L77 35L78 30Z" fill="#fcd34d" />
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}
