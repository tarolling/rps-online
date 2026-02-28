import { getRankTier, getDivisionLabel, RankTier } from "@/lib/ranks";
import styles from "./RankBadge.module.css";

interface Props {
    rating: number;
    /** "full" = icon + name + division (default), "compact" = icon + division only */
    variant?: "full" | "compact";
}

// Shield SVG — complexity increases slightly per rank tier index
function ShieldIcon({ tier }: { tier: RankTier }) {
  const isInfinity = tier.rank === "Infinity";
  const color = isInfinity ? "url(#rainbowGrad)" : tier.color;

  return (
    <svg
      width="36"
      height="42"
      viewBox="0 0 36 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.shieldSvg}
      aria-hidden
    >
      {isInfinity && (
        <defs>
          <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff4e50" />
            <stop offset="25%" stopColor="#f9d423" />
            <stop offset="50%" stopColor="#4caf75" />
            <stop offset="75%" stopColor="#3498db" />
            <stop offset="100%" stopColor="#9b59b6" />
          </linearGradient>
        </defs>
      )}
      {/* Shield body */}
      <path
        d="M18 2L3 8v12c0 9.5 6.5 17.4 15 19.8C26.5 37.4 33 29.5 33 20V8L18 2z"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Inner emblem — ✦ star */}
      <text
        x="18"
        y="25"
        textAnchor="middle"
        fontSize="14"
        fill={color}
        fontWeight="bold"
      >
                ✦
      </text>
    </svg>
  );
}

export default function RankBadge({ rating, variant = "full" }: Props) {
  const tier = getRankTier(rating);
  const divLabel = getDivisionLabel(tier.division);
  const isInfinity = tier.rank === "Infinity";

  const badgeStyle = {
    "--rank-color": isInfinity ? "#ffffff" : tier.color,
    "--rank-glow": tier.glow,
  } as React.CSSProperties;

  return (
    <div
      className={`${styles.badge} ${isInfinity ? styles.infinity : ""} ${styles[variant]}`}
      style={badgeStyle}
    >
      <ShieldIcon tier={tier} />
      {variant === "full" && (
        <div className={styles.labels}>
          <span className={`${styles.rankName} ${isInfinity ? styles.rainbowText : ""}`}>
            {tier.rank}
          </span>
          {divLabel && <span className={styles.division}>{divLabel}</span>}
        </div>
      )}
      {variant === "compact" && divLabel && (
        <span className={styles.division}>{divLabel}</span>
      )}
    </div>
  );
}