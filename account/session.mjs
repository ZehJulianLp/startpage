// Only short-lived access tokens enter JavaScript. The persistent secret is HttpOnly.
export function browserSession(config, action, accessToken) {
  // Coordinate logout/login and token renewal across tabs of the same app.
  const run = () => requestSession(config, action, accessToken);
  return navigator.locks
    ? navigator.locks.request(
        `julianverse-session:${config.issuer}:${config.app}`,
        run,
      )
    : run();
}

async function requestSession(config, action, accessToken) {
  const response = await fetch(`${config.issuer}/oauth/browser/${config.app}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Julianverse-Session": "1",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ action }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error = new Error("Die App-Anmeldung konnte nicht erneuert werden.");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function readStored(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export async function fingerprint(data) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
