import { adminAuth } from '@/lib/firebaseAdmin';
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/friends", "/clubs"];

export async function proxy(request: NextRequest) {
    const session = request.cookies.get("session")?.value;
    const isProtected = protectedRoutes.some(route =>
        request.nextUrl.pathname.startsWith(route)
    );

    if (!isProtected) return NextResponse.next();
    if (!session) return NextResponse.redirect(new URL("/login", request.url));

    try {
        await adminAuth.verifySessionCookie(session, true);
        return NextResponse.next();
    } catch {
        return NextResponse.redirect(new URL("/login", request.url));
    }
}