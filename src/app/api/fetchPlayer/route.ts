import { NextRequest, NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/fetchPlayer";

export async function POST(req: NextRequest) {
  const { uid } = await req.json();

  if (!uid) {
    return NextResponse.json({ error: "UID is required." }, { status: 400 });
  }

  try {
    const profile = await getPlayerProfile(uid);
    if (!profile) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (err) {
    console.error("fetchPlayer error:", err);
    return NextResponse.json({ error: "Failed to fetch player." }, { status: 500 });
  }
}