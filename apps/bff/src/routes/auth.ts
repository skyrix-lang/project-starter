import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { safeReturnTo } from "@booking/core";
import { clientIp } from "../client-ip";
import { env } from "../env";
import { callbackUrl, client, oidcConfig } from "../oidc";
import { hit, type RateLimit } from "../rate-limit";
import { createSession, endSession, setSessionCookie } from "../session";
import { upsertUser } from "../users";

// Sign-in pages live in the SPA; these are the redirects around the provider.
// Failures go back to /sign-in?error=<code>, which shows a message.

const FLOW_COOKIE = "oidc-flow";
const FLOW_MINUTES = 10;

// Each sign-in starts a request to the provider, so one client can't flood it.
const SIGN_INS_PER_CLIENT: RateLimit = { limit: 30, windowSeconds: 15 * 60 };

interface Flow {
  verifier: string;
  state: string;
  nonce: string;
  returnTo: string;
}

const failed = (code: string) => `/sign-in?error=${code}`;

export const authRoutes = new Hono()
  .get("/login", async (c) => {
    const returnTo = safeReturnTo(c.req.query("returnTo"));
    const ip = clientIp(c.req.raw.headers);
    if (ip && !(await hit(`sign-in:client:${ip}`, SIGN_INS_PER_CLIENT))) {
      return c.redirect(failed("RateLimited"));
    }

    let config: client.Configuration;
    try {
      config = await oidcConfig();
    } catch (error) {
      console.error("Sign-in: the identity provider is unreachable:", error);
      return c.redirect(failed("Unavailable"));
    }

    const flow: Flow = {
      verifier: client.randomPKCECodeVerifier(),
      state: client.randomState(),
      nonce: client.randomNonce(),
      returnTo,
    };
    // Lax, not Strict: the provider sends the browser back with a top-level
    // navigation from its own site, which must carry this cookie.
    await setSignedCookie(
      c,
      FLOW_COOKIE,
      JSON.stringify(flow),
      env().SESSION_SECRET,
      {
        httpOnly: true,
        secure: env().PUBLIC_URL.startsWith("https://"),
        sameSite: "Lax",
        path: "/auth",
        maxAge: FLOW_MINUTES * 60,
      },
    );

    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl(),
      scope: "openid email profile",
      code_challenge: await client.calculatePKCECodeChallenge(flow.verifier),
      code_challenge_method: "S256",
      state: flow.state,
      nonce: flow.nonce,
    });
    return c.redirect(url.href);
  })

  .get("/callback", async (c) => {
    const raw = await getSignedCookie(c, env().SESSION_SECRET, FLOW_COOKIE);
    deleteCookie(c, FLOW_COOKIE, { path: "/auth" });
    if (!raw) return c.redirect(failed("Expired"));
    const flow = JSON.parse(raw) as Flow;

    if (c.req.query("error")) return c.redirect(failed("AccessDenied"));

    try {
      const config = await oidcConfig();
      // The URL the provider redirected to, as the browser saw it: behind a
      // proxy, the request's own host isn't the public one.
      const current = new URL(callbackUrl());
      current.search = new URL(c.req.url).search;
      const tokens = await client.authorizationCodeGrant(config, current, {
        pkceCodeVerifier: flow.verifier,
        expectedState: flow.state,
        expectedNonce: flow.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims) throw new Error("No ID token claims");

      const userId = await upsertUser({
        issuer: claims.iss,
        subject: claims.sub,
        email: typeof claims.email === "string" ? claims.email : null,
        emailVerified: claims.email_verified === true,
        name: typeof claims.name === "string" ? claims.name : null,
      });
      const session = await createSession(userId, tokens.id_token);
      setSessionCookie(c, session.token, session.expiresAt);
      return c.redirect(flow.returnTo);
    } catch (error) {
      console.error("Sign-in callback failed:", error);
      return c.redirect(failed("Callback"));
    }
  })

  // A form POST, so a cross-site page can't sign someone out with a link: the
  // CSRF check in src/app.ts refuses forms from other origins.
  .post("/logout", async (c) => {
    const idToken = await endSession(c);
    const home = `${env().PUBLIC_URL}/`;
    if (idToken) {
      try {
        const config = await oidcConfig();
        if (config.serverMetadata().end_session_endpoint) {
          const url = client.buildEndSessionUrl(config, {
            id_token_hint: idToken,
            post_logout_redirect_uri: home,
          });
          return c.redirect(url.href, 303);
        }
      } catch (error) {
        console.error("Sign-out: the identity provider is unreachable:", error);
      }
    }
    return c.redirect("/", 303);
  });
