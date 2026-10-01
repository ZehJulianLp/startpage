const callbackUrl = location.href;
history.replaceState(null, "", location.pathname);
const status = document.getElementById("callback-status");
if (window.opener) {
  // Only the tab that opened this window, on this exact app origin, may receive the code.
  window.opener.postMessage(
    { type: "julianverse:callback", url: callbackUrl },
    location.origin,
  );
  status.textContent = "Anmeldung wird abgeschlossen … / Completing sign-in …";
} else {
  status.textContent =
    "Bitte starte die Anmeldung erneut in der App. / Please sign in again from the app.";
}
