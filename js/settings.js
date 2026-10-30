import { SMART_DETECTION, getPref, setPref } from './prefs.js';
import { closeSheet, openSheet, setupSheet } from './ui.js';

const STORAGE_KEY = 'appearance';
const sheet = document.getElementById('settings-sheet');
const options = [...sheet.querySelectorAll('[data-appearance]')];
const smartDetection = document.getElementById('smart-detection');

function readAppearance() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? 'system';
  } catch {
    return 'system';
  }
}

function applyAppearance(value) {
  if (value === 'light' || value === 'dark') document.documentElement.dataset.theme = value;
  else delete document.documentElement.dataset.theme;
  for (const option of options) option.setAttribute('aria-pressed', String(option.dataset.appearance === value));
}

export function initSettings() {
  applyAppearance(readAppearance());

  setupSheet(sheet, () => closeSheet(sheet));
  document.getElementById('open-settings').addEventListener('click', () => {
    smartDetection.checked = getPref(SMART_DETECTION, true);
    openSheet(sheet);
  });
  document.getElementById('settings-done').addEventListener('click', () => closeSheet(sheet));

  smartDetection.addEventListener('change', () => setPref(SMART_DETECTION, smartDetection.checked));

  for (const option of options) {
    option.addEventListener('click', () => {
      const value = option.dataset.appearance;
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {}
      applyAppearance(value);
    });
  }
}
