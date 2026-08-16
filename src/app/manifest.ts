import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ranked RPS Online",
    short_name: "Ranked RPS",
    description: "Competitive Rock-Paper-Scissors matchmaking. Climb ranked ladders, form clubs, and battle players worldwide.",
    start_url: "/",
    display: "standalone",
    background_color: "#f0f0f0",
    theme_color: "#3498db",
    icons: [
      {
        src: "/logo.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
