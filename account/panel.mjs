import { JulianverseSync } from "./sync.mjs";
import { beginLogin, finishLogin } from "./oidc-client.mjs";
import { browserSession, readStored, fingerprint } from "./session.mjs";

const messages = {
  de: {
    intro:
      "Lokal nutzbar. Verbinde dein Konto nur, wenn du Daten mit ownCloud abgleichen möchtest.",
    login: "Mit Julianverse anmelden",
    logout: "App abmelden",
    permissions: "Freigaben im Account verwalten",
    connected: "Angemeldet als",
    local: "Nur lokal",
    off: "Sync aus",
    on: "Sync aktiv",
    busy: "Abgleich läuft …",
    upload: "Lokale Daten hochladen",
    download: "Cloud-Daten übernehmen",
    now: "Jetzt abgleichen",
    stop: "Sync ausschalten",
    hint: "Wähle pro Datenart die erste Übertragung. Anmeldung und Sync-Auswahl bleiben auf diesem Gerät erhalten. Änderungen werden bei geöffneter App automatisch abgeglichen.",
    permissionHint:
      "Gib die gewünschten Datenarten zuerst unter „Freigaben im Account verwalten“ frei.",
    uploadConfirm:
      "Lokale Daten hochladen und Sync aktivieren? Eine vorhandene Cloud-Version wird ersetzt.",
    downloadConfirm:
      "Cloud-Daten übernehmen und Sync aktivieren? Die lokale Version wird vorher gesichert.",
    popup: "Bitte erlaube das Anmeldefenster für diese Seite.",
    cancelled: "Anmeldung abgebrochen. Deine Daten bleiben lokal.",
    loginFailed: "Anmeldung fehlgeschlagen. Bitte erneut versuchen.",
    expired:
      "Bitte erneut anmelden. Deine Änderungen bleiben lokal gespeichert.",
    error: "Abgleich fehlgeschlagen. Deine Daten bleiben lokal gespeichert.",
    offline:
      "Offline – Änderungen bleiben auf diesem Gerät und werden später abgeglichen.",
    denied:
      "Sync nicht freigegeben. Prüfe die Freigaben und die ownCloud-Verbindung im Account.",
    empty: "Keine Cloud-Datei vorhanden. Lade zuerst lokale Daten hoch.",
    changed:
      "Lokale Daten wurden während der Übertragung geändert. Bitte erneut abgleichen.",
    conflict:
      "Beide Versionen wurden geändert. Wähle, welche Version übernommen werden soll.",
    keepLocal: "Lokale Version verwenden",
    keepCloud: "Cloud-Version verwenden",
    previewLocal: "Lokale Version herunterladen",
    previewCloud: "Cloud-Version herunterladen",
    backup: "Lokale Sicherung herunterladen",
    noBackup: "Für diese Daten gibt es noch keine Sicherung.",
    success: "Abgeglichen",
    stopped: "Sync ausgeschaltet. Lokale Daten bleiben erhalten.",
  },
  en: {
    intro:
      "Works locally. Connect your account only if you want to sync data with ownCloud.",
    login: "Sign in with Julianverse",
    logout: "Sign out of app",
    permissions: "Manage permissions in Account",
    connected: "Signed in as",
    local: "Local only",
    off: "Sync off",
    on: "Sync on",
    busy: "Syncing …",
    upload: "Upload local data",
    download: "Use cloud data",
    now: "Sync now",
    stop: "Turn sync off",
    hint: "Choose the first transfer for each category. Sign-in and sync choices are remembered on this device. Changes sync automatically while the app is open.",
    permissionHint:
      "First enable the categories you want under “Manage permissions in Account”.",
    uploadConfirm:
      "Upload local data and enable sync? This replaces an existing cloud version.",
    downloadConfirm:
      "Use cloud data and enable sync? Your local version will be backed up first.",
    popup: "Please allow the sign-in window for this page.",
    cancelled: "Sign-in cancelled. Your data stays local.",
    loginFailed: "Sign-in failed. Please try again.",
    expired: "Please sign in again. Your changes remain saved locally.",
    error: "Sync failed. Your data remains saved locally.",
    offline: "Offline – changes stay on this device and will sync later.",
    denied:
      "Sync permission missing. Check permissions and your ownCloud connection in Account.",
    empty: "No cloud file yet. Upload local data first.",
    changed: "Local data changed during the transfer. Please sync again.",
    conflict: "Both versions changed. Choose which version to use.",
    keepLocal: "Use local version",
    keepCloud: "Use cloud version",
    previewLocal: "Download local version",
    previewCloud: "Download cloud version",
    backup: "Download local backup",
    noBackup: "There is no backup for this category yet.",
    success: "Synced",
    stopped: "Sync is off. Local data is preserved.",
  },
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const doc = (data) => ({ schemaVersion: 1, data, deleted: false });
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function download(name, data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = element("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class AccountPanel {
  constructor({ root, config, adapter, onApply = () => {} }) {
    this.root = root;
    this.config = config;
    this.adapter = adapter;
    this.onApply = onApply;
    this.states = Object.fromEntries(
      adapter.resources.map((resource) => [
        resource,
        {
          active: false,
          busy: false,
          message: "",
          pending: null,
          conflict: null,
        },
      ]),
    );
    this.session = 0;
    this.ownerKey = `julianverse:${config.app}:sync-owner`;
    this.rememberKey = `julianverse:${config.app}:${config.issuer}:session`;
    this.storageKey = `julianverse-pending-login:${config.app}`;
    this.sync = new JulianverseSync({
      ...config,
      fetcher: (...args) => this.fetch(...args),
    });
    this.render();
    window.addEventListener("message", (event) => this.receiveLogin(event));
    window.addEventListener("julianverse:change", (event) =>
      this.changed(event.detail?.key),
    );
    window.addEventListener("storage", (event) => {
      if (event.storageArea === localStorage) {
        if (
          event.key === this.rememberKey &&
          !readStored(this.rememberKey)?.user
        ) {
          this.expire();
          return;
        }
        if (
          event.key === this.ownerKey &&
          this.tokens &&
          localStorage.getItem(this.ownerKey) !== this.user?.sub
        )
          this.expire();
        else {
          for (const resource of this.adapter.resources) {
            if (
              event.key === this.choiceKey(resource) &&
              !readStored(event.key)
            )
              this.stop(resource);
          }
          this.changed(event.key);
        }
      }
    });
    window.addEventListener("online", () => this.tick());
    window.addEventListener("offline", () => {
      this.message = this.t("offline");
      this.render();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.tick();
    });
    this.interval = setInterval(() => {
      if (!document.hidden) this.tick();
    }, 30000);
    void this.restore();
  }
  choiceKey(resource) {
    return `julianverse:${this.config.app}:${this.config.issuer}:${this.user?.sub}:sync:${resource}`;
  }
  async rememberChoice(resource, baseline) {
    const session = this.session;
    const value = { baseline: await fingerprint(baseline) };
    if (session === this.session && this.states[resource].active)
      localStorage.setItem(this.choiceKey(resource), JSON.stringify(value));
  }
  async attach(result) {
    this.user = result.user;
    this.tokens = { access_token: result.access_token };
    this.expires = Date.now() + result.expires_in * 1000;
    const user = await this.sync.attach(result.access_token);
    if (user.sub !== result.user.sub) throw new Error(this.t("expired"));
  }
  async restore() {
    if (this.restoring || this.tokens || this.popup) return;
    const remembered = readStored(this.rememberKey);
    if (!remembered) return; // Local-only use makes no Account request.
    if (remembered.logout) {
      try {
        await browserSession(this.config, "logout");
        if (readStored(this.rememberKey)?.logout)
          localStorage.removeItem(this.rememberKey);
      } catch {
        /* Retry explicit offline logout on the next connection. */
      }
      return;
    }
    if (
      !remembered.user ||
      localStorage.getItem(this.ownerKey) !== remembered.user.sub
    )
      return;
    this.user = remembered.user;
    if (!navigator.onLine) {
      this.message = this.t("offline");
      this.render();
      return;
    }
    this.restoring = true;
    const session = this.session;
    try {
      const result = await browserSession(this.config, "token");
      if (session !== this.session) return;
      if (
        result.user.sub !== remembered.user.sub ||
        localStorage.getItem(this.ownerKey) !== remembered.user.sub
      ) {
        localStorage.removeItem(this.rememberKey);
        throw new Error(this.t("expired"));
      }
      await this.attach(result);
      if (session !== this.session) return;
      this.message = "";
      await this.resumeChoices();
    } catch (error) {
      if (session === this.session) {
        this.expire();
        if (error.status === 401 || error.status === 403)
          localStorage.removeItem(this.rememberKey);
        else
          this.message = navigator.onLine ? this.t("error") : this.t("offline");
      }
    } finally {
      this.restoring = false;
      this.render();
    }
  }
  async resumeChoices() {
    for (const resource of this.adapter.resources) {
      const choice = readStored(this.choiceKey(resource));
      if (!choice || this.states[resource].active) continue;
      await this.guard(resource, async (state) => {
        await this.sync.enable(resource, { source: "resume" });
        if (!readStored(this.choiceKey(resource))) {
          this.sync.stop(resource);
          return;
        }
        state.active = true;
        const baseline = this.adapter.snapshot(resource);
        if ((await fingerprint(baseline)) !== choice.baseline)
          state.pending = baseline;
      });
      await this.cycle(resource);
    }
  }
  get language() {
    return document.documentElement.lang.toLowerCase().startsWith("de")
      ? "de"
      : "en";
  }
  t(key) {
    return messages[this.language][key];
  }
  button(label, action, disabled = false) {
    const button = element("button", this.t(label), "jv-button");
    button.type = "button";
    button.disabled = disabled;
    button.addEventListener("click", () => {
      void Promise.resolve()
        .then(action)
        .catch((error) => {
          this.message = error.message || this.t("error");
          this.render();
        });
    });
    return button;
  }
  render() {
    const active = Boolean(this.tokens);
    const remembered = Boolean(readStored(this.rememberKey)?.user);
    const heading = element(
      "p",
      active || (remembered && this.user)
        ? `${this.t("connected")} ${this.user.preferred_username || this.user.name || this.user.sub}`
        : this.t("intro"),
    );
    const actions = element("div", "", "jv-actions");
    // window.open must run directly in the trusted click handler, before any awaits.
    const login = element("button", this.t("login"), "jv-button");
    login.type = "button";
    login.addEventListener("click", () => this.login());
    if (!active) actions.append(login);
    if (active || remembered)
      actions.append(this.button("logout", () => this.logout()));
    const link = element("a", this.t("permissions"));
    link.href = `${this.config.issuer}/sync`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    actions.append(link);
    const notice = element(
      "p",
      this.message || (active ? this.t("permissionHint") : this.t("local")),
      "jv-status",
    );
    notice.setAttribute("role", "status");
    const children = [heading, actions, notice];
    if (active) {
      children.push(element("p", this.t("hint"), "jv-help"));
      const grid = element("div", "", "jv-resources");
      for (const [resource, state] of Object.entries(this.states)) {
        const section = element("section", "", "jv-resource");
        section.dataset.resource = resource;
        section.append(
          element("h3", this.adapter.labels[this.language][resource]),
        );
        section.append(
          element(
            "p",
            state.busy
              ? this.t("busy")
              : state.message || this.t(state.active ? "on" : "off"),
            "jv-status",
          ),
        );
        const controls = element("div", "", "jv-actions");
        if (!state.active) {
          controls.append(
            this.button(
              "upload",
              () => this.transfer(resource, "local"),
              state.busy,
            ),
            this.button(
              "download",
              () => this.transfer(resource, "cloud"),
              state.busy,
            ),
          );
        } else {
          controls.append(
            this.button("now", () => this.cycle(resource), state.busy),
            this.button("stop", () => this.stop(resource)),
          );
        }
        controls.append(
          this.button("backup", () => {
            const backup = localStorage.getItem(
              this.adapter.backupKey(resource),
            );
            if (backup === null) throw new Error(this.t("noBackup"));
            download(
              `${this.config.app}-${resource}-backup.json`,
              doc(JSON.parse(backup)),
            );
          }),
        );
        section.append(controls);
        if (state.conflict) {
          const conflict = element("div", "", "jv-conflict");
          const choices = element("div", "", "jv-actions");
          choices.append(
            this.button("previewLocal", () =>
              download(
                `${resource}-local.json`,
                doc(this.adapter.snapshot(resource)),
              ),
            ),
            this.button("previewCloud", () =>
              download(`${resource}-cloud.json`, state.conflict.document),
            ),
            this.button(
              "keepLocal",
              () => this.resolve(resource, "local"),
              state.busy,
            ),
            this.button(
              "keepCloud",
              () => this.resolve(resource, "cloud"),
              state.busy,
            ),
          );
          conflict.append(choices);
          section.append(conflict);
        }
        grid.append(section);
      }
      children.push(grid);
    }
    this.root.replaceChildren(...children);
  }
  login() {
    if (this.popup && !this.popup.closed) {
      this.popup.focus();
      return;
    }
    this.popup = window.open(
      "about:blank",
      "_blank",
      "popup,width=520,height=760",
    );
    if (!this.popup) {
      this.message = this.t("popup");
      this.render();
      return;
    }
    const popup = this.popup;
    const session = ++this.session;
    this.message = "";
    beginLogin({
      ...this.config,
      storageKey: this.storageKey,
      navigate: (url) => {
        if (session === this.session && !popup.closed)
          popup.location.replace(url);
      },
    }).catch(() => {
      popup.close();
      this.message = this.t("loginFailed");
      this.render();
    });
    clearInterval(this.popupTimer);
    this.popupTimer = setInterval(() => {
      if (!popup.closed) return;
      clearInterval(this.popupTimer);
      if (this.popup === popup) {
        this.popup = null;
        this.session++;
        sessionStorage.removeItem(this.storageKey);
        this.message = this.t("cancelled");
        this.render();
      }
    }, 500);
  }
  async receiveLogin(event) {
    if (
      !this.popup ||
      event.origin !== location.origin ||
      event.source !== this.popup ||
      event.data?.type !== "julianverse:callback"
    )
      return;
    const session = this.session;
    const popup = this.popup;
    this.popup = null;
    clearInterval(this.popupTimer);
    try {
      const result = await finishLogin({
        callbackUrl: event.data.url,
        storageKey: this.storageKey,
      });
      if (session !== this.session) return;
      const remembered = await browserSession(
        this.config,
        "remember",
        result.tokens.access_token,
      );
      if (session !== this.session) return;
      this.user = remembered.user;
      if (localStorage.getItem(this.ownerKey) !== this.user.sub) {
        for (const resource of this.adapter.resources)
          localStorage.removeItem(this.choiceKey(resource));
      }
      localStorage.setItem(this.ownerKey, this.user.sub);
      localStorage.setItem(
        this.rememberKey,
        JSON.stringify({ user: this.user }),
      );
      await this.attach(remembered);
      if (session !== this.session) return;
      this.message = this.t("permissionHint");
      await this.resumeChoices();
    } catch {
      if (session === this.session) {
        this.tokens = null;
        this.sync.disconnect();
        this.message = this.t("loginFailed");
      }
    } finally {
      popup?.close();
      if (session === this.session) this.render();
    }
  }
  async fetch(url, options = {}) {
    const session = this.session;
    if (!this.tokens || localStorage.getItem(this.ownerKey) !== this.user?.sub)
      throw new Error(this.t("expired"));
    if (Date.now() > this.expires - 30000) {
      if (!this.refreshing) {
        this.refreshing = browserSession(this.config, "token")
          .then((tokens) => {
            if (session !== this.session) throw new Error(this.t("expired"));
            if (tokens.user.sub !== this.user.sub) {
              localStorage.removeItem(this.rememberKey);
              this.expire();
              throw new Error(this.t("expired"));
            }
            this.tokens = tokens;
            this.sync.token = tokens.access_token;
            this.expires = Date.now() + tokens.expires_in * 1000;
          })
          .finally(() => {
            this.refreshing = null;
          });
      }
      try {
        await this.refreshing;
      } catch (error) {
        if (session === this.session && [401, 403].includes(error.status)) {
          localStorage.removeItem(this.rememberKey);
          this.expire();
        }
        throw error;
      }
    }
    if (session !== this.session || !this.tokens)
      throw new Error(this.t("expired"));
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.tokens.access_token}`,
      },
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 401 && session === this.session) this.expire();
    return response;
  }
  expire() {
    this.session++;
    this.tokens = null;
    this.sync.disconnect();
    for (const state of Object.values(this.states))
      Object.assign(state, {
        active: false,
        busy: false,
        pending: null,
        conflict: null,
        message: "",
      });
    this.message = this.t("expired");
    this.render();
  }
  async logout() {
    for (const resource of this.adapter.resources)
      localStorage.removeItem(this.choiceKey(resource));
    localStorage.setItem(this.rememberKey, JSON.stringify({ logout: true }));
    this.expire();
    this.message = this.t("local");
    this.render();
    await this.restore();
  }
  stop(resource) {
    localStorage.removeItem(this.choiceKey(resource));
    this.sync.stop(resource);
    Object.assign(this.states[resource], {
      active: false,
      pending: null,
      conflict: null,
      message: this.t("stopped"),
    });
    this.render();
  }
  changed(key) {
    for (const [resource, state] of Object.entries(this.states)) {
      if (
        !state.active ||
        (key !== null && !this.adapter.keys[resource].includes(key))
      )
        continue;
      try {
        state.pending = this.adapter.snapshot(resource);
      } catch {
        state.message = this.t("error");
        this.render();
        continue;
      }
      // The app's own local write has already completed before this event.
      clearTimeout(state.timer);
      state.timer = setTimeout(() => this.cycle(resource), 700);
    }
  }
  async guard(resource, action) {
    const state = this.states[resource];
    if (state.busy || !this.tokens) return;
    const session = this.session;
    state.busy = true;
    this.render();
    try {
      await action(state);
    } catch (error) {
      if (session === this.session)
        state.message =
          error.status === 403
            ? this.t("denied")
            : !navigator.onLine
              ? this.t("offline")
              : error.message || this.t("error");
    } finally {
      state.busy = false;
      if (session === this.session) this.render();
    }
  }
  async transfer(resource, source) {
    if (
      !confirm(this.t(source === "local" ? "uploadConfirm" : "downloadConfirm"))
    )
      return;
    await this.guard(resource, async (state) => {
      const baseline = this.adapter.snapshot(resource);
      this.adapter.backup(resource);
      const record = await this.sync.enable(resource, {
        source,
        localData: baseline,
      });
      if (!record.document) {
        this.sync.stop(resource);
        throw new Error(this.t("empty"));
      }
      if (source === "cloud") {
        try {
          await this.apply(resource, record.document, baseline);
        } catch (error) {
          this.sync.stop(resource);
          throw error;
        }
      }
      state.active = true;
      await this.rememberChoice(resource, this.adapter.snapshot(resource));
      state.message = this.t("on");
      if (source === "local") state.pending = this.adapter.snapshot(resource);
    });
    if (this.states[resource].active) await this.cycle(resource);
  }
  async apply(resource, document, baseline) {
    if (!this.tokens || localStorage.getItem(this.ownerKey) !== this.user?.sub)
      throw new Error(this.t("expired"));
    this.adapter.validate(resource, document);
    if (!same(this.adapter.snapshot(resource), baseline))
      throw new Error(this.t("changed"));
    if (same(document.data, baseline) && !document.deleted) return;
    this.adapter.apply(resource, document);
    await this.onApply(resource);
  }
  async cycle(resource) {
    const state = this.states[resource];
    if (!state.active) return;
    await this.guard(resource, async () => {
      if (state.pending !== null) {
        const pending = state.pending;
        await this.sync.save(resource, pending);
        if (state.pending === pending) state.pending = null;
      }
      const baseline = this.adapter.snapshot(resource);
      const record = await this.sync.sync(resource, {
        localData: baseline,
        readLocal: () => this.adapter.snapshot(resource),
      });
      if (!state.active) return;
      state.conflict = record.conflict;
      if (record.conflict) {
        state.message = this.t("conflict");
        return;
      }
      if (
        state.pending !== null ||
        !same(this.adapter.snapshot(resource), baseline)
      ) {
        state.pending = this.adapter.snapshot(resource);
        state.message = this.t("changed");
        return;
      }
      if (record.document)
        await this.apply(resource, record.document, baseline);
      await this.rememberChoice(resource, this.adapter.snapshot(resource));
      state.message =
        this.t("success") +
        " · " +
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
    });
    if (state.active && state.pending !== null && !state.conflict) {
      clearTimeout(state.timer);
      state.timer = setTimeout(() => this.cycle(resource), 1000);
    }
  }
  async resolve(resource, choice) {
    if (
      !confirm(this.t(choice === "cloud" ? "downloadConfirm" : "uploadConfirm"))
    )
      return;
    await this.guard(resource, async (state) => {
      const baseline = this.adapter.snapshot(resource);
      this.adapter.backup(resource);
      // Save any edits made while the conflict was displayed before choosing a version.
      await this.sync.save(resource, baseline);
      const record = await this.sync.resolve(resource, choice);
      state.conflict = null;
      if (choice === "cloud") {
        const document = record.document || {
          schemaVersion: 1,
          data: {},
          deleted: true,
        };
        await this.apply(resource, document, baseline);
        state.pending = null;
      } else state.pending = this.adapter.snapshot(resource);
      await this.rememberChoice(resource, this.adapter.snapshot(resource));
    });
    if (this.states[resource].active) await this.cycle(resource);
  }
  tick() {
    if (!this.tokens) {
      void this.restore();
      return;
    }
    void this.resumeChoices();
    this.message = navigator.onLine ? "" : this.t("offline");
    for (const resource of this.adapter.resources) void this.cycle(resource);
    this.render();
  }
}
