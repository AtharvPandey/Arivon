import { NextResponse } from "next/server";

/**
 * Per-school URL routing — Phase 1.
 *
 * Every school gets its own URL: /{slug}/login, /{slug}/dashboard,
 * /{slug}/principal/dashboard, and so on. Rather than physically moving
 * every existing page under a [schoolSlug] folder (which would touch
 * dozens of files and every router.push() call across the whole app),
 * this middleware REWRITES the incoming request: the browser's address
 * bar keeps showing /{slug}/dashboard, but Next.js internally serves
 * the exact same /dashboard page that already exists, completely
 * unchanged. Same trick browsers can't tell the difference on — it's
 * how Vercel's own rewrites and most multi-tenant Next.js apps handle
 * this without a full route-tree migration.
 *
 * Reserved top-level paths are never treated as a school slug — these
 * are the app's own real routes, not tenant identifiers.
 *
 * PHASE 2 (not yet done): every internal router.push() call currently
 * uses bare paths like "/dashboard/students". Those still work
 * correctly (this middleware serves them fine), but clicking one will
 * drop the /{slug} prefix from the address bar for that navigation,
 * since the code isn't asking for the slug-prefixed version. Making
 * the slug persist through every single in-app link is a larger,
 * separate pass — worth doing once this foundation is confirmed
 * working end-to-end.
 */

const RESERVED_TOP_LEVEL_PATHS = new Set([
  "dashboard",
  "principal",
  "teacher",
  "admissions",
  "platform",
  "api",
  "_next",
  "favicon.ico",
]);

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  // Root path, or nothing to rewrite — let it through untouched.
  if (segments.length === 0) {
    return NextResponse.next();
  }

  const firstSegment = segments[0];

  // A real app route (not a school slug) — pass through untouched.
  if (RESERVED_TOP_LEVEL_PATHS.has(firstSegment)) {
    return NextResponse.next();
  }

  // Anything else is treated as a school slug. Strip it and forward
  // the rest of the path to the existing route structure.
  //   /{slug}            -> /            (login page)
  //   /{slug}/login       -> /            (login page)
  //   /{slug}/dashboard/x -> /dashboard/x
  const rest = segments.slice(1);
  const isLoginAlias = rest.length === 0 || (rest.length === 1 && rest[0] === "login");
  const rewrittenPath = isLoginAlias ? "/" : `/${rest.join("/")}`;

  const url = request.nextUrl.clone();
  url.pathname = rewrittenPath;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip static assets and Next.js internals entirely — no point
  // running this logic on image/font/CSS requests.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
