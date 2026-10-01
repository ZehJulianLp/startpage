/** Minimal browser authorization-code client. Tokens live in memory in the host app. */
const encode = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));

export async function beginLogin({
  issuer,
  clientId,
  redirectUri,
  scope = "openid profile email sync",
  storageKey = "julianverse-pending-login",
  navigate = (url) => location.assign(url),
}) {
  const account = new URL(issuer);
  if (account.protocol !== "https:")
    throw new Error("Der Account-Server muss HTTPS verwenden.");
  const state = random();
  const verifier = random();
  const nonce = random();
  const challenge = encode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
  const pending = {
    issuer: account.origin,
    clientId,
    redirectUri,
    state,
    verifier,
    nonce,
    created: Date.now(),
  };
  sessionStorage.setItem(storageKey, JSON.stringify(pending));
  const url = new URL("/oauth/authorize", account.origin);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    nonce,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  navigate(url);
}

export async function finishLogin({
  callbackUrl = location.href,
  storageKey = "julianverse-pending-login",
} = {}) {
  const received = new URL(callbackUrl);
  const params = received.searchParams;
  const pending = JSON.parse(sessionStorage.getItem(storageKey) || "null");
  sessionStorage.removeItem(storageKey);
  // Remove short-lived credentials from the address bar and browser history.
  if (callbackUrl === location.href)
    history.replaceState(null, "", location.pathname);
  if (
    !pending ||
    params.get("state") !== pending.state ||
    Date.now() - pending.created > 10 * 60 * 1000
  )
    throw new Error(
      "Die Anmeldung ist abgelaufen oder gehört zu einer anderen Anfrage.",
    );
  const callback = new URL(pending.redirectUri);
  if (
    received.origin !== location.origin ||
    callback.origin !== received.origin ||
    callback.pathname !== received.pathname ||
    callback.search ||
    received.hash
  )
    throw new Error("Die Callback-Adresse stimmt nicht überein.");
  if (params.has("error") || !params.get("code"))
    throw new Error("Die Anmeldung wurde abgebrochen.");
  const response = await fetch(`${pending.issuer}/oauth/token`, {
    method: "POST",
    credentials: "omit",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: pending.clientId,
      redirect_uri: pending.redirectUri,
      code: params.get("code"),
      code_verifier: pending.verifier,
    }),
  });
  const tokens = await response.json();
  if (!response.ok)
    throw new Error("Die Anmeldung konnte nicht abgeschlossen werden.");
  // Identity is obtained through the authenticated userinfo endpoint; no unverified JWT decoding.
  const userResponse = await fetch(`${pending.issuer}/oauth/userinfo`, {
    credentials: "omit",
    signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userResponse.ok)
    throw new Error("Die Konto-ID konnte nicht geprüft werden.");
  return {
    tokens,
    user: await userResponse.json(),
    issuer: pending.issuer,
    clientId: pending.clientId,
  };
}

export async function refresh({ issuer, clientId, refreshToken }) {
  const response = await fetch(`${issuer}/oauth/token`, {
    method: "POST",
    credentials: "omit",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) throw new Error("Bitte erneut anmelden.");
  return response.json(); // Replace both tokens. Never retry a consumed refresh token.
}

export async function revoke({ issuer, clientId, token }) {
  const response = await fetch(`${issuer}/oauth/revoke`, {
    method: "POST",
    credentials: "omit",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, token }),
  });
  if (!response.ok)
    throw new Error("Der App-Zugang konnte nicht widerrufen werden.");
}
