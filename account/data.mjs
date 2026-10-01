export const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const isText = (value, max = 1000) =>
  typeof value === "string" && value.length <= max;
export const isColor = (value) =>
  typeof value === "string" && /^(|#[0-9a-f]{3}|#[0-9a-f]{6})$/i.test(value);
export function assert(valid) {
  if (!valid) throw new Error("Ungültige Cloud-Daten / invalid cloud data.");
}
export function documentData(document) {
  assert(
    isObject(document) &&
      document.schemaVersion === 1 &&
      isObject(document.data),
  );
  assert(
    document.deleted === undefined || typeof document.deleted === "boolean",
  );
  return document.deleted ? {} : document.data;
}
export function readKeys(keys, storage) {
  return Object.fromEntries(
    keys
      .filter((key) => storage.getItem(key) !== null)
      .map((key) => [key, JSON.parse(storage.getItem(key))]),
  );
}
export function replaceKeys(keys, data, storage) {
  const previous = keys.map((key) => [key, storage.getItem(key)]);
  try {
    for (const key of keys) {
      if (Object.hasOwn(data, key))
        storage.setItem(key, JSON.stringify(data[key]));
      else storage.removeItem(key);
    }
  } catch (error) {
    for (const [key, value] of previous) {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    }
    throw error;
  }
}
