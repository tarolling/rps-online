import MatchCard from "@/components/MatchCard";
import styles from "@/app/page.module.css";
import { formatRelativeTime } from "@/lib/time";
import { getRecentGames, GlobalRecentMatch } from "@/lib/recentGames";

export default async function RecentMatchesGrid() {
  const data = await getRecentGames(null, null) as GlobalRecentMatch[];
  const recentMatches = data.map((record) => ({
    ...record,
    timestamp: formatRelativeTime(record.timestamp),
  }));

  return (
    <div className={styles.matchesGrid}>
      {recentMatches.map((match, index) => (
        <MatchCard key={index} match={match} index={index} />
      ))}
    </div>
  );
}
