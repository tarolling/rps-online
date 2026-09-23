import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getMatchDetail } from "@/lib/matchDetail";
import { getAvatarUrlServer } from "@/lib/avatarServer";
import { getRankTier, getRankColorHex } from "@/lib/ranks";
import { GAME_MODES, toPlayMode } from "@/lib/gameModes";

export const alt = "Match result";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function getLogoSrc(): Promise<string> {
  const logoData = await readFile(join(process.cwd(), "public/logo.png"));
  return `data:image/png;base64,${logoData.toString("base64")}`;
}

function PlayerColumn({
  name,
  avatar,
  ratingBefore,
  ratingAfter,
  isWinner,
}: {
  name: string;
  avatar: string | null;
  ratingBefore: number;
  ratingAfter: number;
  isWinner: boolean;
}) {
  const color = getRankColorHex(getRankTier(ratingAfter));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 400 }}>
      {avatar ? (
        <img src={avatar} width={96} height={96} style={{ borderRadius: 48, border: `4px solid ${isWinner ? "#f1c40f" : "#3a3a3a"}` }} alt="" />
      ) : (
        <div style={{ display: "flex", width: 96, height: 96, borderRadius: 48, background: "#3a3a3a", border: `4px solid ${isWinner ? "#f1c40f" : "#3a3a3a"}` }} />
      )}
      <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: "#f0f0f0" }}>{name}</div>
      {isWinner && <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#f1c40f" }}>WINNER</div>}
      <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color, gap: 8 }}>
        <span>{ratingBefore}</span>
        <span>→</span>
        <span>{ratingAfter}</span>
      </div>
    </div>
  );
}

function FallbackImage(logoSrc: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "#1a1a1a",
        }}
      >
        <img src={logoSrc} width={100} height={100} style={{ borderRadius: 20 }} alt="" />
        <div style={{ fontSize: 48, fontWeight: 900, color: "#f0f0f0" }}>Match Not Found</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: "#3498db" }}>Ranked RPS Online</div>
      </div>
    ),
    { ...size },
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const logoSrc = await getLogoSrc();

  const match = await getMatchDetail(id);
  if (!match) return FallbackImage(logoSrc);

  const [avatar1, avatar2] = await Promise.all([
    getAvatarUrlServer(match.player1.uid),
    getAvatarUrlServer(match.player2.uid),
  ]);

  const p1Wins = match.match.winnerId === match.player1.uid;
  const modeLabel = GAME_MODES[toPlayMode(match.match.mode)].label;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          background: "#1a1a1a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "absolute", top: 40, left: 40 }}>
          <img src={logoSrc} width={48} height={48} style={{ borderRadius: 10 }} alt="" />
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              color: "#3498db",
              background: "rgba(52,152,219,0.15)",
              padding: "6px 16px",
              borderRadius: 999,
            }}
          >
            {modeLabel}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
          <PlayerColumn
            name={match.player1.username}
            avatar={avatar1}
            ratingBefore={match.player1.ratingBefore}
            ratingAfter={match.player1.ratingAfter}
            isWinner={p1Wins}
          />
          <div style={{ display: "flex", fontSize: 72, fontWeight: 900, color: "#f0f0f0" }}>
            {match.player1.score} — {match.player2.score}
          </div>
          <PlayerColumn
            name={match.player2.username}
            avatar={avatar2}
            ratingBefore={match.player2.ratingBefore}
            ratingAfter={match.player2.ratingAfter}
            isWinner={!p1Wins}
          />
        </div>

        <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: "#8b9099", position: "absolute", bottom: 32 }}>
          ranked-rps.com
        </div>
      </div>
    ),
    { ...size },
  );
}
