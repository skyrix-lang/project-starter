import { useCallback, useMemo, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function parse<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Returns initialValue in the server HTML and during hydration, then the stored
// value. Pass a stable initialValue (a constant, not an inline object or array).
export function useLocalStorage<T>(key: string, initialValue: T) {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key),
    () => null,
  );
  const storedValue = useMemo(
    () => parse(raw, initialValue),
    [raw, initialValue],
  );

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      const previous = parse(window.localStorage.getItem(key), initialValue);
      const next = value instanceof Function ? value(previous) : value;
      window.localStorage.setItem(key, JSON.stringify(next));
      // Browsers only fire "storage" in other tabs, so notify this one too.
      window.dispatchEvent(new StorageEvent("storage", { key }));
    },
    [key, initialValue],
  );

  const removeValue = useCallback(() => {
    window.localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent("storage", { key }));
  }, [key]);

  return [storedValue, setValue, removeValue] as const;
}
