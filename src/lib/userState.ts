const USER_ID_KEY = "bc_user_id";
const RECENT_KEY = "bc_recent";
const FAVORITES_KEY = "bc_favorites";
export const MAX_RECENT_TOOLS = 20;

const listeners = new Set<() => void>();

function notifyUserState(): void {
  for (const cb of listeners) cb();
}

/**
 * Subscribe to user-state changes (recents, favorites). Used with
 * `useSyncExternalStore` so React components re-render after same-tab
 * localStorage mutations — plain `storage` events only fire cross-tab.
 */
export function subscribeUserState(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function canUseStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const test = "__bc_test__";
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function getOrCreateUserId(): string {
  if (!canUseStorage()) return "";
  let id = window.localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function getRecentTools(): string[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(RECENT_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    // Ignore corrupt state.
  }
  return [];
}

export function addRecentTool(slug: string): void {
  if (!canUseStorage() || !slug) return;
  getOrCreateUserId();
  const current = getRecentTools().filter((s) => s !== slug);
  const next = [slug, ...current].slice(0, MAX_RECENT_TOOLS);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    notifyUserState();
  } catch {
    // Storage full or blocked — best effort.
  }
}

export function clearRecentTools(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(RECENT_KEY);
  notifyUserState();
}

export function getFavorites(): string[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    // Ignore corrupt state.
  }
  return [];
}

export function toggleFavorite(slug: string): string[] {
  if (!canUseStorage() || !slug) return getFavorites();
  const current = getFavorites();
  const next = current.includes(slug)
    ? current.filter((s) => s !== slug)
    : [slug, ...current];
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    notifyUserState();
  } catch {
    // Storage full or blocked — best effort.
  }
  return next;
}