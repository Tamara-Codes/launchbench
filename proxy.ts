import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refresh Supabase's cookie session for SSR and guard the tenant surface. */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const isPublic = pathname === "/" || pathname === "/login" || pathname.startsWith("/auth/") || pathname === "/api/internal/job-recovery" || pathname === "/api/composio/gmail/callback";
  const isTenantSurface = pathname === "/app" || pathname.startsWith("/app/") || pathname === "/onboarding";
  if (!user && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  if (user && pathname === "/login") return NextResponse.redirect(new URL("/app", request.url));
  if (user && !isPublic && !isTenantSurface) return NextResponse.redirect(new URL("/app", request.url));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
