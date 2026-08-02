import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { gnosis } from "viem/chains";

import {
  authRateLimitResponse,
  checkAuthRateLimit,
} from "../../shared/authRateLimit";
import {
  createChallengeToken,
  getMessageDigest,
  getSameOrigin,
  setChallengeCookie,
} from "../../shared/session";

type MessageRequestBody = {
  address: string;
  chainId: number;
};

function isMessageRequestBody(value: unknown): value is MessageRequestBody {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<MessageRequestBody>;
  return (
    typeof candidate.address === "string" &&
    isAddress(candidate.address) &&
    candidate.chainId === gnosis.id
  );
}

export async function POST(request: Request) {
  const origin = getSameOrigin(request);
  if (!origin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  let body: MessageRequestBody;

  try {
    const parsed = (await request.json()) as unknown;
    if (!isMessageRequestBody(parsed)) {
      return NextResponse.json(
        { error: "Connect a wallet on Gnosis Chain to continue." },
        { status: 400 },
      );
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const address = getAddress(body.address);
  const rateLimit = checkAuthRateLimit("message", address, 30);
  if (!rateLimit.allowed) {
    return authRateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const nonce = generateSiweNonce();
  const now = new Date();
  const message = createSiweMessage({
    address,
    chainId: gnosis.id,
    domain: new URL(origin).host,
    expirationTime: new Date(now.getTime() + 5 * 60 * 1000),
    issuedAt: now,
    nonce,
    scheme: new URL(origin).protocol.slice(0, -1),
    statement: "Sign in to the RaidGuild Guild Archive.",
    uri: origin,
    version: "1",
  });
  const challengeToken = await createChallengeToken({
    address,
    messageDigest: getMessageDigest(message),
    nonce,
  });
  const response = NextResponse.json(
    { message },
    { headers: { "Cache-Control": "no-store" } },
  );

  setChallengeCookie(response, challengeToken);
  return response;
}
