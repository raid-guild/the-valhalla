import { NextResponse } from "next/server";

import { clearAuthCookies, getSameOrigin } from "../../shared/session";

export async function POST(request: Request) {
  if (!getSameOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  const response = NextResponse.json(
    { authenticated: false },
    { headers: { "Cache-Control": "no-store" } },
  );
  clearAuthCookies(response);
  return response;
}
