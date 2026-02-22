import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { uid } = await req.json();
    return NextResponse.json({ isAdmin: uid === process.env.ADMIN_UID });
}