import LiveMatches from "@/components/LiveMatches";
import { getLiveGames } from "@/lib/liveGames";

export default async function LiveMatchesSection() {
  const liveGames = await getLiveGames();
  return <LiveMatches initialLiveGames={liveGames} />;
}
