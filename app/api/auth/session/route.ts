import { NextResponse } from "next/server";

import {
  isEligibleMemberAddress,
  logServerError,
} from "../../shared/memberAuth";
import {
  clearSessionCookie,
  createSessionToken,
  readSessionAddress,
  setSessionCookie,
} from "../../shared/session";

export async function GET() {
  const address = await readSessionAddress();

  if (!address) {
    const response = NextResponse.json(
      { authenticated: false },
      { headers: { "Cache-Control": "no-store" } },
    );
    clearSessionCookie(response);
    return response;
  }

  try {
    if (!(await isEligibleMemberAddress(address))) {
      const response = NextResponse.json(
        { authenticated: false },
        { headers: { "Cache-Control": "no-store" } },
      );
      clearSessionCookie(response);
      return response;
    }

    const refreshedToken = await createSessionToken(address);
    const response = NextResponse.json(
      { authenticated: true, address },
      { headers: { "Cache-Control": "no-store" } },
    );
    setSessionCookie(response, refreshedToken);
    return response;
  } catch (error: unknown) {
    logServerError("Error restoring wallet session", error);
    return NextResponse.json(
      { error: "Unable to restore your session right now." },
      { status: 500 },
    );
  }
}
