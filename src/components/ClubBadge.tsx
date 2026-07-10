import { useId } from 'react';

interface ClubBadgeProps {
  abbreviation: string;
  primary: string;
  secondary: string;
  accent: string;
  className?: string;
  label?: string;
}

export function ClubBadge({
  abbreviation,
  primary,
  secondary,
  accent,
  className = 'h-14 w-14',
  label
}: ClubBadgeProps) {
  const patternId = useId().replaceAll(':', '');
  return (
    <svg
      className={className}
      viewBox="0 0 96 108"
      role="img"
      aria-label={label ?? `${abbreviation} club badge`}
    >
      <defs>
        <clipPath id={patternId}>
          <path d="M48 3 90 17v33c0 27-15 45-42 56C21 95 6 77 6 50V17z" />
        </clipPath>
      </defs>
      <path
        d="M48 3 90 17v33c0 27-15 45-42 56C21 95 6 77 6 50V17z"
        fill={accent}
        stroke="rgba(255,255,255,.42)"
        strokeWidth="2"
      />
      <g clipPath={`url(#${patternId})`}>
        <path d="M12 20h72v72H12z" fill={primary} />
        <path d="M-2 73 92 22v27L5 96z" fill={secondary} opacity=".95" />
        <path d="M-4 89 92 37v11L1 101z" fill={accent} opacity=".92" />
      </g>
      <path
        d="M48 3 90 17v33c0 27-15 45-42 56C21 95 6 77 6 50V17z"
        fill="none"
        stroke="rgba(255,255,255,.42)"
        strokeWidth="2"
      />
      <circle cx="48" cy="51" r="24" fill={primary} stroke={accent} strokeWidth="3" />
      <text
        x="48"
        y="58"
        textAnchor="middle"
        fill="#f4efe3"
        fontFamily="Inter, sans-serif"
        fontSize="18"
        fontWeight="800"
        letterSpacing="1"
      >
        {abbreviation.slice(0, 3)}
      </text>
      <path d="m48 11 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill={accent} />
    </svg>
  );
}
