import { useId } from 'react';

interface ClubBadgeProps {
  abbreviation: string;
  primary: string;
  secondary: string;
  accent: string;
  badgeShape?: 'shield' | 'round' | 'pennant';
  badgePattern?: 'sash' | 'stripes' | 'split';
  badgeSymbol?: 'star' | 'ball' | 'crown';
  className?: string;
  label?: string;
}

export function ClubBadge({
  abbreviation,
  primary,
  secondary,
  accent,
  badgeShape = 'shield',
  badgePattern = 'sash',
  badgeSymbol = 'star',
  className = 'h-14 w-14',
  label
}: ClubBadgeProps) {
  const patternId = useId().replaceAll(':', '');
  const badgePath =
    badgeShape === 'round'
      ? 'M48 4a44 44 0 1 0 0 88 44 44 0 0 0 0-88z'
      : badgeShape === 'pennant'
        ? 'M8 10h80L48 103z'
        : 'M48 3 90 17v33c0 27-15 45-42 56C21 95 6 77 6 50V17z';
  const pattern =
    badgePattern === 'stripes' ? (
      <>
        <path d="M10 10h16v92H10zM42 4h16v102H42zM74 10h16v92H74z" fill={secondary} opacity=".95" />
        <path d="M26 4h8v100h-8zM62 4h8v100h-8z" fill={accent} opacity=".8" />
      </>
    ) : badgePattern === 'split' ? (
      <><path d="M48 0h48v108H48z" fill={secondary} opacity=".95" /><path d="M42 0h12v108H42z" fill={accent} opacity=".9" /></>
    ) : (
      <><path d="M-2 73 92 22v27L5 96z" fill={secondary} opacity=".95" /><path d="M-4 89 92 37v11L1 101z" fill={accent} opacity=".92" /></>
    );
  return (
    <svg
      className={className}
      viewBox="0 0 96 108"
      role="img"
      aria-label={label ?? `${abbreviation} club badge`}
    >
      <defs>
        <clipPath id={patternId}>
          <path d={badgePath} />
        </clipPath>
      </defs>
      <path
        d={badgePath}
        fill={accent}
        stroke="rgba(255,255,255,.42)"
        strokeWidth="2"
      />
      <g clipPath={`url(#${patternId})`}>
        <path d="M0 0h96v108H0z" fill={primary} />
        {pattern}
      </g>
      <path
        d={badgePath}
        fill="none"
        stroke="rgba(255,255,255,.42)"
        strokeWidth="2"
      />
      <circle cx="48" cy="51" r="24" fill={primary} stroke={accent} strokeWidth="3" />
      <text
        x="48"
        y="58"
        textAnchor="middle"
        fill="#f6f4ff"
        fontFamily="Inter, sans-serif"
        fontSize="18"
        fontWeight="800"
        letterSpacing="1"
      >
        {abbreviation.slice(0, 3)}
      </text>
      {badgeSymbol === 'star' ? <path d="m48 11 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill={accent} /> : null}
      {badgeSymbol === 'ball' ? <circle cx="48" cy="17" r="7" fill={accent} stroke={primary} strokeWidth="1.5" /> : null}
      {badgeSymbol === 'crown' ? <path d="m38 23 2-11 8 6 8-6 2 11z" fill={accent} /> : null}
    </svg>
  );
}
