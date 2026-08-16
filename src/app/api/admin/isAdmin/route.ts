import { getAuthedUid } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authedUid = await getAuthedUid(req);
  return NextResponse.json({ isAdmin: !!authedUid && authedUid === process.env.ADMIN_UID });
}