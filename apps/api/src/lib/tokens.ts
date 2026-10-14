import { SignJWT, decodeJwt, errors, jwtVerify } from "jose";

export type TokenKind = "live" | "test" | "playground";

/** Claims Relay reads from a chat token (HS256 JWT signed with the app's signing secret). */
export type RelayClaims = {
  /** App slug. */
  app: string;
  /** The app's own user ID. */
  sub: string;
  plan: string;
  /** Trusted prompt variables; they override any the client sends. */
  vars?: Record<string, string>;
  /** Absent on tokens from the app's backend (= "live"). */
  kind?: TokenKind;
  /** Test tokens only: the test_tokens row ID, for revocation. */
  jti?: string;
};

// Longest a token of each kind may live (exp - iat). A long-lived token is a
// bearer password for the provider bill, so even app-minted ones are capped.
export const MAX_LIFETIME_SECONDS: Record<TokenKind, number> = {
  live: 24 * 3600,
  test: 7 * 24 * 3600,
  playground: 10 * 60,
};

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signToken(secret: string, claims: RelayClaims, expiresAt: Date): Promise<string> {
  const { sub, jti, ...rest } = claims;
  const jwt = new SignJWT(rest)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000));
  if (jti) jwt.setJti(jti);
  return jwt.sign(key(secret));
}

/**
 * The `app` claim, read *without* verifying, so we know whose secret to verify
 * with. Never trust anything else from an unverified token.
 */
export function peekApp(token: string): string | null {
  try {
    const { app } = decodeJwt(token);
    return typeof app === "string" ? app : null;
  } catch {
    return null;
  }
}

export class TokenError extends Error {}

/** Verify signature, expiry and lifetime; returns typed claims or throws TokenError. */
export async function verifyToken(token: string, secret: string): Promise<RelayClaims> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
      requiredClaims: ["exp", "iat", "sub", "plan", "app"],
      clockTolerance: 30,
    }));
  } catch (err) {
    if (err instanceof errors.JWTExpired) throw new TokenError("Token expired");
    throw new TokenError("Invalid token");
  }

  const kind = (payload.kind ?? "live") as TokenKind;
  if (!(kind in MAX_LIFETIME_SECONDS)) throw new TokenError("Invalid token kind");
  if (payload.exp! - payload.iat! > MAX_LIFETIME_SECONDS[kind]) {
    throw new TokenError(`Token lifetime exceeds the ${MAX_LIFETIME_SECONDS[kind] / 3600}h maximum for ${kind} tokens`);
  }

  const vars = payload.vars;
  const isStringRecord =
    vars === undefined ||
    (typeof vars === "object" && vars !== null && !Array.isArray(vars) && Object.values(vars).every((v) => typeof v === "string"));
  if (typeof payload.plan !== "string" || !isStringRecord) throw new TokenError("Invalid token claims");

  return {
    app: payload.app as string,
    sub: payload.sub!,
    plan: payload.plan,
    vars: vars as Record<string, string> | undefined,
    kind,
    jti: payload.jti,
  };
}
