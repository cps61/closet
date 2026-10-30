// Small persisted preferences (localStorage, JSON values). Never throws.

export const SMART_DETECTION = 'closet.smartDetection';
/** Set while a photo is being analyzed; still set on startup means the app crashed. */
export const ANALYSIS_RUNNING = 'closet.analysisRunning';

export function getPref(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function setPref(key, value) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (e.g. Private Browsing); preferences just won't persist.
  }
}
