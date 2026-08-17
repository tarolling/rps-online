import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import { getAuthedUid } from "@/lib/auth";
import { adminFirestore } from "@/lib/firebaseAdmin";
import { MAX_SIZE_MB, isDataUrlImage } from "@/lib/avatar";

export async function POST(req: NextRequest) {
  const uid = await getAuthedUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { base64 } = await req.json();
  if (!base64 || typeof base64 !== "string") {
    return NextResponse.json({ error: "Image data is required." }, { status: 400 });
  }

  try {
    const player = await runQuery("MATCH (p:Player {uid: $uid}) RETURN p.isPremium AS isPremium", { uid });
    if (!(player.records[0]?.get("isPremium") ?? false)) {
      return NextResponse.json({ error: "Changing your profile picture requires Premium." }, { status: 403 });
    }

    if (!isDataUrlImage(base64)) {
      return NextResponse.json({ error: "File must be an image." }, { status: 400 });
    }
    // base64 payload is ~4/3 the size of the underlying bytes.
    const approxBytes = base64.length * 0.75;
    if (approxBytes > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Image must be under ${MAX_SIZE_MB}MB.` }, { status: 400 });
    }

    await adminFirestore.collection("avatars").doc(uid).set({ base64, updatedAt: Date.now() });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("updateAvatar error:", err);
    return NextResponse.json({ error: "Failed to update avatar." }, { status: 500 });
  }
}
