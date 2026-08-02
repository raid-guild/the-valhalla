import { createHash } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";

import { CONFIG } from "../../config";

const AUTH_ISSUER = "the-valhalla";
const CHALLENGE_AUDIENCE = "the-valhalla-siwe-challenge";
const SESSION_AUDIENCE = "the-valhalla-session";
const CHALLENGE_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const CHALLENGE_COOKIE_NAME = IS_PRODUCTION
  ? "__Host-valhalla_challenge"
  : "valhalla_challenge";
export const SESSION_COOKIE_NAME = IS_PRODUCTION
  ? "__Host-valhalla_session"
  : "valhalla_session";

type ChallengePayload = {
  address: string;
  messageDigest: string;
  nonce: string;
};

function getSessionKey() {
  const secret = CONFIG.JWT_SECRET?.trim();

  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes");
  }

  return new TextEncoder().encode(secret);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/" as const,
    sameSite: "lax" as const,
    secure: IS_PRODUCTION,
  };
}

async function signToken(
  payload: Record<string, string>,
  audience: string,
  expiresIn: number,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(AUTH_ISSUER)
    .setAudience(audience)
    .setExpirationTime(`${expiresIn}s`)
    .sign(getSessionKey());
}

async function verifyToken(token: string | undefined, audience: string) {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionKey(), {
      algorithms: ["HS256"],
      audience,
      issuer: AUTH_ISSUER,
    });

    return payload;
  } catch {
    return null;
  }
}

export function getMessageDigest(message: string) {
  return createHash("sha256").update(message).digest("base64url");
}

export async function createChallengeToken(payload: ChallengePayload) {
  return signToken(payload, CHALLENGE_AUDIENCE, CHALLENGE_TTL_SECONDS);
}

export async function readChallenge(): Promise<ChallengePayload | null> {
  const cookieStore = await cookies();
  const payload = await verifyToken(
    cookieStore.get(CHALLENGE_COOKIE_NAME)?.value,
    CHALLENGE_AUDIENCE,
  );

  if (
    !payload ||
    typeof payload.address !== "string" ||
    !isAddress(payload.address) ||
    typeof payload.messageDigest !== "string" ||
    typeof payload.nonce !== "string"
  ) {
    return null;
  }

  return {
    address: getAddress(payload.address),
    messageDigest: payload.messageDigest,
    nonce: payload.nonce,
  };
}

export async function createSessionToken(address: string) {
  return signToken(
    { address: getAddress(address) },
    SESSION_AUDIENCE,
    SESSION_TTL_SECONDS,
  );
}

export async function readSessionAddress() {
  const cookieStore = await cookies();
  const payload = await verifyToken(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    SESSION_AUDIENCE,
  );

  if (
    !payload ||
    typeof payload.address !== "string" ||
    !isAddress(payload.address)
  ) {
    return null;
  }

  return getAddress(payload.address);
}

export function setChallengeCookie(response: NextResponse, token: string) {
  response.cookies.set(
    CHALLENGE_COOKIE_NAME,
    token,
    cookieOptions(CHALLENGE_TTL_SECONDS),
  );
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(
    SESSION_COOKIE_NAME,
    token,
    cookieOptions(SESSION_TTL_SECONDS),
  );
}

export function clearChallengeCookie(response: NextResponse) {
  response.cookies.set(CHALLENGE_COOKIE_NAME, "", cookieOptions(0));
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", cookieOptions(0));
}

export function clearAuthCookies(response: NextResponse) {
  clearChallengeCookie(response);
  clearSessionCookie(response);
}

export function getSameOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const requestHost = request.headers.get("host") ?? requestUrl.host;

  if (!origin) {
    return null;
  }

  try {
    const originUrl = new URL(origin);
    if (
      originUrl.host !== requestHost ||
      originUrl.protocol !== requestUrl.protocol
    ) {
      return null;
    }

    return originUrl.origin;
  } catch {
    return null;
  }
}
