"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { formatRelativeTime } from "@/lib/time";
import { getJSON } from "@/lib/api";
import { PlayerMatch } from "@/types/common";
import { GAME_MODES, isValidPlayMode, PLAY_MODES } from "@/lib/gameModes";
import type { PlayMode } from "@/types";
import styles from "./MatchHistoryPage.module.css";

type HistoryFilter = PlayMode | "all";
const HISTORY_FILTERS: HistoryFilter[] = ["all", ...PLAY_MODES];

interface MatchHistoryResponse {
  matches: PlayerMatch[];
  totalCount: number;
  page: number;
  pageSize: number;
}

function MatchHistoryPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const modeParam = searchParams.get("mode");
  const filter: HistoryFilter = isValidPlayMode(modeParam) ? modeParam : "all";
  const pageParam = Number(searchParams.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [data, setData] = useState<MatchHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getJSON<MatchHistoryResponse>("/api/fetchMatchHistory", {
        playerId: userId,
        mode: filter === "all" ? null : filter,
        page,
      });
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load match history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userId, filter, page]);

  const updateQuery = (next: { mode?: HistoryFilter; page?: number }) => {
    const params = new URLSearchParams();
    const nextMode = next.mode ?? filter;
    const nextPage = next.page ?? page;
    if (nextMode !== "all") params.set("mode", nextMode);
    if (nextPage !== 1) params.set("page", String(nextPage));
    const qs = params.toString();
    router.replace(`/profile/${userId}/matches${qs ? `?${qs}` : ""}`);
  };

  const handleFilterChange = (next: HistoryFilter) => {
    updateQuery({ mode: next, page: 1 });
  };

  const handlePageChange = (next: number) => {
    updateQuery({ page: next });
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1;

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={fetchHistory} />;

  return (
    <div className="app">
      <Header />
      <main className={styles.container}>
        <div className={styles.headerRow}>
          <h1>Match History</h1>
          <Link href={`/profile/${userId}`} className={styles.backLink}>← Back to Profile</Link>
        </div>

        <div className={styles.filterTabs} role="tablist" aria-label="Filter match history by game mode">
          {HISTORY_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ""}`}
              onClick={() => handleFilterChange(f)}
            >
              {f === "all" ? "All" : GAME_MODES[f].label}
            </button>
          ))}
        </div>

        {data && data.matches.length === 0 ? (
          <p className={styles.emptyState}>No matches found.</p>
        ) : (
          <div className={styles.matchList}>
            {data?.matches.map((match) => (
              <div
                key={match.id}
                className={`${styles.matchItem} ${styles[match.result.toLowerCase()]}`}
                onClick={() => router.push(`/match/${match.id}`)}
              >
                <Link href={`/profile/${match.opponentId}`} onClick={(e) => e.stopPropagation()} className={styles.matchOpponent}>
                  {match.opponentUsername}
                </Link>
                <span className={styles.matchResult}>{match.result}</span>
                <div className={styles.matchDetails}>
                  <span>{match.playerScore} - {match.opponentScore}</span>
                  <span className={styles.matchDate}>
                    {GAME_MODES[match.mode].label} · {formatRelativeTime(match.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {data && totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        )}
      </main>
      <Footer />
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  const pages = buildPageList(page, totalPages);

  return (
    <nav className={styles.pagination} aria-label="Match history pages">
      <button
        type="button"
        className={styles.pageButton}
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        Prev
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>…</span>
        ) : (
          <button
            type="button"
            key={p}
            className={`${styles.pageButton} ${p === page ? styles.pageButtonActive : ""}`}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={styles.pageButton}
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

/** Windowed pagination: always show first, last, current ± 1, collapsing gaps into "...". */
function buildPageList(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pageSet = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pageSet].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | "...")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("...");
    result.push(p);
  });
  return result;
}

const LoadingState = () => (
  <div className="app"><Header /><main className={styles.container}><p className={styles.emptyState} style={{ marginTop: "4rem" }}>Loading...</p></main><Footer /></div>
);

const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="app"><Header /><main className={styles.container}><div className={styles.errorCard}><p>Error: {error}</p><button onClick={onRetry}>Retry</button></div></main><Footer /></div>
);

export default MatchHistoryPage;
