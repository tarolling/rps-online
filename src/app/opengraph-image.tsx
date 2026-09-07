import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Ranked RPS Online, competitive rock paper scissors online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logoData = await readFile(join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={140} height={140} style={{ borderRadius: 28 }} alt="" />
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: "#f0f0f0",
            letterSpacing: -2,
          }}
        >
          Ranked RPS Online
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#3498db",
          }}
        >
          Competitive Rock Paper Scissors Online
        </div>
      </div>
    ),
    { ...size },
  );
}
