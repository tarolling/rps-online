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

    // Verify the session cookie via the admin API
    try {
        const verifyUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/verify`, request.url);
        const res = await fetch(verifyUrl, {
            headers: { Cookie: `session=${session}` }
        });
        if (!res.ok) throw new Error('Invalid session');
        return NextResponse.next();
    } catch {
        return NextResponse.redirect(new URL("/login", request.url));
    }
}

export const config = {
    matcher: ['/dashboard/:path*', '/friends/:path*', '/clubs/:path*'],
};