import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPlayerProfile } from "@/lib/fetchPlayer";
import { getAvatarUrlServer } from "@/lib/avatarServer";
import { getRankTier, getRankColorHex, getDivisionLabel } from "@/lib/ranks";
import { GAME_MODES, PLAY_MODES } from "@/lib/gameModes";
import { getTitle, RARITY_COLOR } from "@/lib/titles";

export const alt = "Player profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Ratings change continuously (unlike a completed match, which is immutable
// once recorded) — cache for 5 minutes rather than indefinitely.
export const revalidate = 300;

async function getLogoSrc(): Promise<string> {
  const logoData = await readFile(join(process.cwd(), "public/logo.png"));
  return `data:image/png;base64,${logoData.toString("base64")}`;
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
        <div style={{ fontSize: 48, fontWeight: 900, color: "#f0f0f0" }}>Player Not Found</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: "#3498db" }}>Ranked RPS Online</div>
      </div>
    ),
    { ...size },
  );
}

export default async function Image({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const logoSrc = await getLogoSrc();

  const [profile, avatar] = await Promise.all([
    getPlayerProfile(userId),
    getAvatarUrlServer(userId),
  ]);
  if (!profile) return FallbackImage(logoSrc);

  const equippedTitle = profile.equippedTitleId ? getTitle(profile.equippedTitleId) : null;

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
          gap: 32,
          background: "#1a1a1a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {avatar ? (
            <img src={avatar} width={120} height={120} style={{ borderRadius: 60, border: "4px solid #3a3a3a" }} alt="" />
          ) : (
            <div style={{ display: "flex", width: 120, height: 120, borderRadius: 60, background: "#3a3a3a" }} />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 48, fontWeight: 900, color: "#f0f0f0" }}>{profile.username}</div>
            {equippedTitle && (
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  fontWeight: 700,
                  color: RARITY_COLOR[equippedTitle.rarity],
                  background: "rgba(255,255,255,0.08)",
                  padding: "4px 14px",
                  borderRadius: 999,
                  alignSelf: "flex-start",
                }}
              >
                {equippedTitle.name}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          {PLAY_MODES.map((mode) => {
            const rating = profile.ratings[mode] ?? 0;
            const tier = getRankTier(rating);
            const color = getRankColorHex(tier);
            return (
              <div
                key={mode}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  width: 280,
                  padding: "24px 16px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.05)",
                  border: `2px solid ${color}`,
                }}
              >
                <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#8b9099" }}>{GAME_MODES[mode].label}</div>
                <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color }}>
                  {tier.rank} {getDivisionLabel(tier.division)}
                </div>
                <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: "#f0f0f0" }}>{rating}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: "#8b9099", position: "absolute", bottom: 32 }}>
          ranked-rps.com
        </div>
      </div>
    ),
    { ...size },
  );
}
