import { environment } from "@/configs/environment";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = environment;

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Skip auth check for public routes
  if (request.nextUrl.pathname.startsWith("/public")) {
    return supabaseResponse;
  }

  if (!user && request.nextUrl.pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Role-based protection for "user" role
  if (user) {
    // Fetch profile to get role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    const path = request.nextUrl.pathname;

    if (role === "user") {
      // List of restricted parent paths for "user" role
      const restrictedPaths = ["/master", "/atk", "/assets"];

      // Specifically for tickets: /tickets/reports and /tickets (all tickets) are restricted
      // but we might want to keep the tool accessible if it's under /tools
      const isRestrictedBase = restrictedPaths.some(p => path.startsWith(p));
      const isRestrictedTicket = path === "/tickets" || path.startsWith("/tickets/");

      // Note: /tools/qr-generator is allowed
      if (isRestrictedBase || isRestrictedTicket) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
