/** Optional local-first sync. Import this module locally into the host app. */
export class SyncError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

export class IndexedDBStore {
  constructor(name = "julianverse-sync-v1") {
    this.name = name;
  }
  async database() {
    if (!this.opening)
      this.opening = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.name, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("documents");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    return this.opening;
  }
  async get(key) {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction("documents")
        .objectStore("documents")
        .get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }
  async set(key, value) {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite");
      tx.objectStore("documents").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}

export function sameJSON(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => sameJSON(value, b[index]))
    );
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameJSON(a[key], b[key]))
  );
}
const same = sameJSON;

function legacyGzipVersion(previous, current) {
  // Repair only the exact legacy ownCloud/Apache representation observed before
  // Account requested identity encoding. All other ETags remain opaque.
  return (
    /^"[0-9a-f]{32}"$/i.test(current || "") &&
    previous === current.slice(0, -1) + '-gzip"'
  );
}
const documentFor = (data, deleted = false) => ({
  schemaVersion: 1,
  data,
  deleted,
});

export class JulianverseSync {
  constructor({ issuer, app, store = new IndexedDBStore(), fetcher = fetch }) {
    const url = new URL(issuer);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new SyncError("Der Account-Server braucht eine HTTPS-Origin.");
    if (!/^[a-z0-9-]+$/.test(app)) throw new SyncError("Ungültige App-ID.");
    this.issuer = url.origin;
    this.app = app;
    this.store = store;
    this.fetcher = fetcher;
    this.active = new Set();
    this.epoch = 0;
    this.queues = new Map();
  }
  async attach(accessToken) {
    this.disconnect();
    const epoch = this.epoch;
    const response = await this.fetcher(`${this.issuer}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: "omit",
      cache: "no-store",
    });
    if (!response.ok)
      throw new SyncError("Die Anmeldung ist abgelaufen.", response.status);
    const user = await response.json();
    if (epoch !== this.epoch)
      throw new SyncError("Das Konto wurde während der Anmeldung gewechselt.");
    if (typeof user.sub !== "string" || !user.sub)
      throw new SyncError("Konto-ID fehlt.");
    this.user = user;
    this.token = accessToken; // Only in memory. Attaching never enables sync or uploads data.
    return user;
  }
  disconnect() {
    this.token = null;
    this.user = null;
    this.active.clear();
    this.epoch++;
  }
  stop(resource) {
    this.active.delete(resource);
    this.epoch++;
  }
  context(resource) {
    if (!this.user || !this.token)
      throw new SyncError("Bitte zuerst anmelden.", 401);
    if (!/^[a-z0-9-]+$/.test(resource))
      throw new SyncError("Ungültige Datenkategorie.");
    return {
      epoch: this.epoch,
      token: this.token,
      key: JSON.stringify([this.issuer, this.user.sub, this.app, resource]),
      resource,
    };
  }
  check(context) {
    if (context.epoch !== this.epoch || !this.token)
      throw new SyncError("Der Sync wurde gestoppt oder das Konto gewechselt.");
  }
  async lock(context, callback) {
    // Web Locks coordinate tabs sharing the same IndexedDB database.
    if (globalThis.navigator?.locks)
      return navigator.locks.request(context.key, callback);
    if (this.store instanceof IndexedDBStore)
      throw new SyncError(
        "Dieser Browser unterstützt keinen sicheren Abgleich zwischen Tabs. Lokale Nutzung bleibt verfügbar.",
      );
    const previous = this.queues.get(context.key) || Promise.resolve();
    const pending = previous.catch(() => {}).then(callback);
    this.queues.set(context.key, pending);
    return pending;
  }
  async request(context, suffix, options = {}) {
    this.check(context);
    const response = await this.fetcher(
      `${this.issuer}/api/sync/${this.app}${suffix}`,
      {
        ...options,
        credentials: "omit",
        cache: "no-store",
        headers: {
          ...options.headers,
          Authorization: `Bearer ${context.token}`,
        },
      },
    );
    this.check(context);
    return response;
  }
  async remote(context) {
    const response = await this.request(context, `/${context.resource}`);
    if (response.status === 404) return { document: null, etag: null };
    if (!response.ok)
      throw new SyncError(
        (await response.json()).message || "Cloud-Sync ist nicht erreichbar.",
        response.status,
      );
    const document = await response.json();
    const etag = response.headers.get("ETag");
    if (document.schemaVersion !== 1 || !("data" in document) || !etag)
      throw new SyncError("Ungültige Cloud-Datei oder fehlende Dateiversion.");
    return { document, etag };
  }
  async enable(resource, { source, localData } = {}) {
    // The host UI must explicitly ask which copy to use at the first activation.
    if (!["cloud", "local", "resume"].includes(source))
      throw new SyncError(
        "Wähle ausdrücklich Cloud-Daten, lokale Daten oder den bisherigen Arbeitsstand.",
      );
    const context = this.context(resource);
    return this.lock(context, async () => {
      const response = await this.request(context, "");
      if (!response.ok)
        throw new SyncError(
          "Prüfe deine ownCloud-Verbindung.",
          response.status,
        );
      const status = await response.json();
      if (!status.resources[resource])
        throw new SyncError(
          "Gib diese Daten zuerst in Julianverse Account für Sync frei.",
          403,
        );
      const previous = await this.store.get(context.key);
      if (source === "resume") {
        if (!previous)
          throw new SyncError(
            "Für dieses Konto gibt es noch keinen lokalen Sync-Arbeitsstand.",
          );
      } else {
        if (source === "local" && localData === undefined)
          throw new SyncError("Wähle die lokalen Daten ausdrücklich aus.");
        const remote = await this.remote(context);
        const record = {
          document:
            source === "local" ? documentFor(localData) : remote.document,
          etag: remote.etag,
          dirty: source === "local",
          conflict: null,
          previous: previous?.document ?? null,
        };
        this.check(context);
        await this.store.set(context.key, record);
      }
      this.check(context);
      this.active.add(resource);
      return this.store.get(context.key);
    });
  }
  async read(resource) {
    return this.store.get(this.context(resource).key);
  }
  async save(resource, data, { deleted = false } = {}) {
    const context = this.context(resource);
    if (!this.active.has(resource))
      throw new SyncError("Sync für diese Daten ist nicht eingeschaltet.");
    return this.lock(context, async () => {
      this.check(context);
      const record = await this.store.get(context.key);
      if (!record) throw new SyncError("Der Sync-Arbeitsstand fehlt.");
      record.document = documentFor(data, deleted);
      record.dirty = true;
      await this.store.set(context.key, record);
      return record; // Offline queue is durable before any network operation.
    });
  }
  async sync(resource, { localData, readLocal } = {}) {
    const context = this.context(resource);
    if (!this.active.has(resource))
      throw new SyncError("Sync ist ausgeschaltet.");
    return this.lock(context, async () => {
      this.check(context);
      const record = await this.store.get(context.key);
      const remote = await this.remote(context);
      // The host can still be edited while GET is in flight. Preserve the old
      // ETag so an overlapping cloud edit becomes a conflict, not an overwrite.
      if (readLocal) {
        const latest = readLocal();
        if (!same(latest, localData)) {
          record.document = documentFor(latest);
          record.dirty = true;
        }
      }
      if (legacyGzipVersion(record.etag, remote.etag))
        record.etag = remote.etag;
      if (record.conflict) {
        if (same(record.document, remote.document)) {
          record.conflict = null;
          record.dirty = false;
          record.etag = remote.etag;
        } else if (
          record.etag === remote.etag &&
          legacyGzipVersion(record.conflict.etag, remote.etag) &&
          same(record.conflict.document, remote.document)
        ) {
          record.previous = record.conflict.document;
          record.conflict = null;
        } else {
          this.check(context);
          await this.store.set(context.key, record);
          return record;
        }
      }
      if (record.dirty) {
        if (same(record.document, remote.document)) {
          record.dirty = false;
          record.etag = remote.etag;
        } else if (record.etag !== remote.etag) {
          record.conflict = remote;
        } else {
          const response = await this.request(context, `/${resource}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(record.etag
                ? { "If-Match": record.etag }
                : { "If-None-Match": "*" }),
            },
            body: JSON.stringify(record.document),
          });
          if (response.status === 412)
            record.conflict = await this.remote(context);
          else if (!response.ok)
            throw new SyncError(
              "Die lokale Änderung bleibt in der Warteschlange.",
              response.status,
            );
          else {
            const etag = response.headers.get("ETag");
            if (etag) {
              record.etag = etag;
              record.dirty = false;
            }
            // Missing PUT ETag: retain the queue. Next sync checks the saved document.
          }
        }
      } else if (!remote.document && record.etag) {
        record.conflict = remote; // Hard deletion in ownCloud requires an explicit decision.
      } else {
        record.document = remote.document;
        record.etag = remote.etag;
      }
      this.check(context);
      await this.store.set(context.key, record);
      return record;
    });
  }
  async resolve(resource, choice) {
    if (!["local", "cloud"].includes(choice))
      throw new SyncError("Wähle eine Version.");
    const context = this.context(resource);
    if (!this.active.has(resource))
      throw new SyncError("Sync ist ausgeschaltet.");
    return this.lock(context, async () => {
      this.check(context);
      const record = await this.store.get(context.key);
      if (!record?.conflict) throw new SyncError("Kein offener Konflikt.");
      record.previous =
        choice === "cloud" ? record.document : record.conflict.document;
      if (choice === "cloud") record.document = record.conflict.document;
      record.etag = record.conflict.etag;
      record.dirty = choice === "local";
      record.conflict = null;
      await this.store.set(context.key, record);
      return record; // A later conditional sync catches changes made during resolution.
    });
  }
}
