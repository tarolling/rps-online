type IconProps = {
  className?: string;
};

const shared = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function RankedIcon({ className }: IconProps) {
  return (
    <svg className={className} {...shared}>
      <path d="M12 3l2.4 4.86 5.36.78-3.88 3.78.92 5.33L12 15.27l-4.8 2.48.92-5.33-3.88-3.78 5.36-.78z" />
    </svg>
  );
}

export function ClubsIcon({ className }: IconProps) {
  return (
    <svg className={className} {...shared}>
      <circle cx="8.5" cy="8" r="2.75" />
      <circle cx="16" cy="9.5" r="2.25" />
      <path d="M3.5 19c.6-3 2.5-4.75 5-4.75s4.4 1.75 5 4.75" />
      <path d="M14 19c.45-2.2 1.75-3.6 3.5-3.75 1.75.15 3 1.55 3 3.75" />
    </svg>
  );
}

export function PracticeIcon({ className }: IconProps) {
  return (
    <svg className={className} {...shared}>
      <rect x="5" y="9" width="14" height="10" rx="2.5" />
      <path d="M12 9V5.5" />
      <circle cx="12" cy="4" r="1.25" />
      <circle cx="9" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <path d="M3 12.5v3M21 12.5v3" />
    </svg>
  );
}

export function AnalyticsIcon({ className }: IconProps) {
  return (
    <svg className={className} {...shared}>
      <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
    </svg>
  );
}
