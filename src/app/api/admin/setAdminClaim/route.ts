import { adminAuth } from "@/lib/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { uid, secret } = await req.json();
    if (secret !== process.env.ADMIN_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await adminAuth.setCustomUserClaims(uid, { admin: true });
    return NextResponse.json({ success: true });
}