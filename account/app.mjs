import { AccountPanel } from "./panel.mjs";
import * as adapter from "./adapter.mjs";
import { config } from "./config.mjs";

if (!window.julianverseReady) {
  await new Promise((resolve) =>
    window.addEventListener("julianverse:ready", resolve, { once: true }),
  );
}
new AccountPanel({
  root: document.getElementById("julianverse-account"),
  config: {
    ...config,
    redirectUri: new URL("../account-callback.html", import.meta.url).href,
  },
  adapter,
  onApply: (resource) => window.julianverseApply(resource),
});
