import { NextResponse } from "next/server";

/**
 * Per-school URL routing.
 *
 * Every school gets its own URL: /{slug}/login, /{slug}/admin,
 * /{slug}/principal/dashboard, and so on. Rather than physically moving
 * every existing page under a [schoolSlug] folder (which would touch
 * dozens of files and every router.push() call across the whole app),
 * this middleware does two things:
 *
 *   1. REWRITE: /{slug}/admin/x -> internally serves /admin/x,
 *      unchanged. The browser's address bar keeps showing the slug;
 *      Next.js just serves the existing page underneath it.
 *
 *   2. REDIRECT BACK: this is the piece that makes the slug persist
 *      through EVERY in-app click, not just the first page load.
 *      Every page throughout the app still calls router.push("/admin/x")
 *      with a bare path — there's no practical way around touching
 *      dozens of files for that. Instead, this middleware runs on
 *      every single navigation (even client-side ones — they still
 *      hit the server), and if it sees a bare reserved-path request
 *      arrive WITHOUT a slug, but the browser has a school_slug cookie
 *      (set once at login), it redirects to the slug-prefixed version.
 *      A redirect (unlike a rewrite) DOES update the visible address
 *      bar, so this one cookie-driven check keeps every route in the
 *      whole app correctly prefixed, without editing every page.
 *
 * Reserved top-level paths are never treated as a school slug — these
 * are the app's own real routes, not tenant identifiers. "platform" is
 * deliberately excluded from the redirect-back logic too, since
 * Platform Admin isn't tied to any single school.
 */

const RESERVED_TOP_LEVEL_PATHS = new Set([
  "admin",
  "principal",
  "teacher",
  "admissions",
  "finance",
  "platform",
  "change-password",
  "api",
  "_next",
  "favicon.ico",
]);

// Platform routes are Arivon-staff-only and never belong to a school —
// redirecting these back to a slug would be actively wrong.
const NEVER_SLUG_PREFIXED = new Set(["platform", "api", "_next", "favicon.ico"]);

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return NextResponse.next();
  }

  const firstSegment = segments[0];

  if (RESERVED_TOP_LEVEL_PATHS.has(firstSegment)) {
    // A bare reserved-path request. If there's an active school session
    // (cookie set at login) and this route is one that SHOULD be
    // slug-scoped, send the browser to the slug-prefixed version instead.
    if (!NEVER_SLUG_PREFIXED.has(firstSegment)) {
      const schoolSlug = request.cookies.get("school_slug")?.value;
      if (schoolSlug) {
        const url = request.nextUrl.clone();
        url.pathname = `/${schoolSlug}${pathname}`;
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // Anything else is treated as a school slug. Strip it and forward
  // the rest of the path to the existing route structure.
  //   /{slug}            -> /            (login page)
  //   /{slug}/login       -> /            (login page)
  //   /{slug}/admin/x -> /admin/x
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
