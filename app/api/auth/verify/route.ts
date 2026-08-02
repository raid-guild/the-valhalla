import { NextResponse } from "next/server";
import {
  createPublicClient,
  getAddress,
  http,
  isAddressEqual,
  isHex,
  type Hex,
  verifyMessage,
} from "viem";
import {
  parseSiweMessage,
  validateSiweMessage,
  verifySiweMessage,
} from "viem/siwe";
import { gnosis } from "viem/chains";

import { CONFIG } from "../../../config";
import {
  authRateLimitResponse,
  checkAuthRateLimit,
  checkAuthRpcBudget,
} from "../../shared/authRateLimit";
import {
  isEligibleMemberAddress,
  logServerError,
  NOT_MEMBER_ERROR,
} from "../../shared/memberAuth";
import {
  clearChallengeCookie,
  createSessionToken,
  getMessageDigest,
  getSameOrigin,
  readChallenge,
  setSessionCookie,
} from "../../shared/session";

type VerifyRequestBody = {
  message: string;
  signature: Hex;
};

const gnosisClient = createPublicClient({
  chain: gnosis,
  transport: http(CONFIG.GNOSIS_RPC_URL?.trim() || undefined, {
    retryCount: 1,
    timeout: 5_000,
  }),
});

function isVerifyRequestBody(value: unknown): value is VerifyRequestBody {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<VerifyRequestBody>;
  return (
    typeof candidate.message === "string" &&
    candidate.message.length > 0 &&
    candidate.message.length <= 4096 &&
    typeof candidate.signature === "string" &&
    candidate.signature.length <= 4096 &&
    isHex(candidate.signature)
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

  let body: VerifyRequestBody;

  try {
    const parsed = (await request.json()) as unknown;
    if (!isVerifyRequestBody(parsed)) {
      return NextResponse.json(
        { error: "Invalid verification request" },
        { status: 400 },
      );
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const challenge = await readChallenge();
  if (
    !challenge ||
    challenge.messageDigest !== getMessageDigest(body.message)
  ) {
    return NextResponse.json(
      { error: "Your sign-in request expired. Please try again." },
      { status: 401 },
    );
  }

  const rateLimit = checkAuthRateLimit(
    "verify",
    getAddress(challenge.address),
    20,
  );
  if (!rateLimit.allowed) {
    return authRateLimitResponse(rateLimit.retryAfterSeconds);
  }

  let parsedMessage: ReturnType<typeof parseSiweMessage>;

  try {
    parsedMessage = parseSiweMessage(body.message);
  } catch {
    return NextResponse.json(
      { error: "Invalid sign-in message" },
      { status: 401 },
    );
  }
  const requestUrl = new URL(origin);
  const messageIsValid =
    parsedMessage.address !== undefined &&
    parsedMessage.chainId === gnosis.id &&
    parsedMessage.uri === origin &&
    parsedMessage.version === "1" &&
    isAddressEqual(parsedMessage.address, getAddress(challenge.address)) &&
    validateSiweMessage({
      address: getAddress(challenge.address),
      domain: requestUrl.host,
      message: parsedMessage,
      nonce: challenge.nonce,
      scheme: requestUrl.protocol.slice(0, -1),
    });

  if (!messageIsValid || !parsedMessage.address) {
    return NextResponse.json(
      { error: "Invalid sign-in message" },
      { status: 401 },
    );
  }

  try {
    let signatureIsValid = false;

    try {
      signatureIsValid = await verifyMessage({
        address: parsedMessage.address,
        message: body.message,
        signature: body.signature,
      });
    } catch {
      // Contract-account signatures can be longer than recoverable EOA
      // signatures, so local recovery failure must still reach ERC-1271/6492.
    }

    if (!signatureIsValid) {
      const rpcBudget = checkAuthRpcBudget(
        getAddress(parsedMessage.address),
      );
      if (!rpcBudget.allowed) {
        return authRateLimitResponse(rpcBudget.retryAfterSeconds);
      }

      signatureIsValid = await verifySiweMessage(gnosisClient, {
        address: parsedMessage.address,
        domain: requestUrl.host,
        message: body.message,
        nonce: challenge.nonce,
        scheme: requestUrl.protocol.slice(0, -1),
        signature: body.signature,
      });
    }

    if (!signatureIsValid) {
      return NextResponse.json(
        { error: "Invalid wallet signature" },
        { status: 401 },
      );
    }

    if (!(await isEligibleMemberAddress(parsedMessage.address))) {
      return NextResponse.json(
        { error: NOT_MEMBER_ERROR },
        { status: 403 },
      );
    }

    const sessionToken = await createSessionToken(parsedMessage.address);
    const response = NextResponse.json(
      { authenticated: true, address: getAddress(parsedMessage.address) },
      { headers: { "Cache-Control": "no-store" } },
    );

    clearChallengeCookie(response);
    setSessionCookie(response, sessionToken);
    return response;
  } catch (error: unknown) {
    logServerError("Error verifying wallet session", error);
    return NextResponse.json(
      { error: "Unable to verify membership right now." },
      { status: 500 },
    );
  }
}
