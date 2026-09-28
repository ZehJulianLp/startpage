import {
  assert,
  isObject,
  isText,
  isColor,
  documentData,
  readKeys,
  replaceKeys,
} from "./data.mjs";

export const keys = {
  notes: ["notes"],
  tasks: ["todos"],
  bookmarks: ["tiles"],
  settings: [
    "theme",
    "widgets",
    "widget.colors",
    "engines.enabled",
    "ui.locale",
    "ui.cardStyle",
    "ui.clock.color",
    "ui.search.color",
    "ui.accent.color",
    "ui.modal.color",
    "ui.button.color",
    "ui.input.color",
  ],
};
export const resources = Object.keys(keys);
export const labels = {
  de: {
    notes: "Notizen",
    tasks: "Aufgaben",
    bookmarks: "Lesezeichen",
    settings: "Einstellungen",
  },
  en: {
    notes: "Notes",
    tasks: "Tasks",
    bookmarks: "Bookmarks",
    settings: "Settings",
  },
};
const widgets = [
  "todo",
  "notes",
  "tiles",
  "weather",
  "transport",
  "quote",
  "recent",
  "system",
  "news",
];
const engines = ["google", "ddg", "bing", "searxng", "yt", "wikipedia", "maps"];
function allowed(resource) {
  if (!Object.hasOwn(keys, resource))
    throw new Error("Diese Startpage-Daten werden noch nicht unterstützt.");
  return keys[resource];
}
export function validate(resource, document) {
  const data = documentData(document);
  if (Object.keys(data).some((key) => !allowed(resource).includes(key)))
    throw new Error(
      "Die Datei enthält fremde oder nicht freigegebene Einstellungen.",
    );
  for (const [key, value] of Object.entries(data)) {
    if (key === "notes") assert(isText(value, 400000));
    else if (key === "todos") {
      assert(Array.isArray(value) && value.length <= 3000);
      for (const item of value) {
        assert(
          isObject(item) &&
            isText(item.text, 10000) &&
            typeof item.done === "boolean",
        );
        assert(
          Object.keys(item).every((k) => ["text", "done", "ts"].includes(k)),
        );
        if (item.ts !== undefined) assert(Number.isFinite(item.ts));
      }
    } else if (key === "tiles") {
      assert(Array.isArray(value) && value.length <= 1000);
      for (const item of value) {
        assert(
          isObject(item) && isText(item.title, 1000) && isText(item.url, 4096),
        );
        assert(Object.keys(item).every((k) => ["title", "url"].includes(k)));
        const url = new URL(item.url);
        assert(
          ["https:", "http:"].includes(url.protocol) &&
            !url.username &&
            !url.password,
        );
      }
    } else if (key === "theme")
      assert(["auto", "dark", "light"].includes(value));
    else if (key === "ui.locale")
      assert(isText(value, 40) && /^[a-z0-9+-]+$/i.test(value));
    else if (key === "ui.cardStyle")
      assert(["glass", "solid", "transparent", "minimal"].includes(value));
    else if (key === "engines.enabled")
      assert(
        Array.isArray(value) &&
          value.length <= engines.length &&
          value.every((v) => engines.includes(v)),
      );
    else if (key === "widgets" || key === "widget.colors") {
      assert(
        isObject(value) && Object.keys(value).every((k) => widgets.includes(k)),
      );
      assert(
        Object.values(value).every((v) =>
          key === "widgets" ? typeof v === "boolean" : isColor(v),
        ),
      );
    } else assert(isColor(value));
  }
  return data;
}
export function snapshot(resource, storage = localStorage) {
  const data = readKeys(allowed(resource), storage);
  validate(resource, { schemaVersion: 1, data });
  return data;
}
export const backupKey = (resource) => `julianverse.backup.${resource}`;
export function backup(resource, storage = localStorage) {
  const previous = snapshot(resource, storage);
  storage.setItem(backupKey(resource), JSON.stringify(previous));
  return previous;
}
export function apply(resource, document, storage = localStorage) {
  const data = validate(resource, document);
  const previous = backup(resource, storage);
  replaceKeys(allowed(resource), data, storage);
  return previous;
}
