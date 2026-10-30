import './polyfills.js';
import { initAddItem, startImport } from './add-item.js';
import { initCloset, reloadCloset } from './closet.js';
import { ANALYSIS_RUNNING, SMART_DETECTION, getPref, setPref } from './prefs.js';
import { initSettings } from './settings.js';
import { closeSheet, openSheet, setupSheet } from './ui.js';

/** Must match <meta name="app-version"> in index.html and APP_VERSION in sw.js. */
const APP_VERSION = '5';

const $ = (id) => document.getElementById(id);

// ---------- Offline support + update safety ----------

const serviceWorkerReady =
  'serviceWorker' in navigator && window.isSecureContext
    ? navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch((error) => {
        console.warn('Service worker registration failed', error);
        return null;
      })
    : Promise.resolve(null);

/**
 * The page (index.html) and this script come from different releases, so a
 * cached copy is stale. Fetch everything fresh once, then reload. Returns false
 * (carry on as is) if that was already tried this session, so it never loops.
 */
async function reloadWithFreshFiles() {
  const key = 'closet.reloadedForVersion';
  try {
    if (sessionStorage.getItem(key) === APP_VERSION) return false;
    sessionStorage.setItem(key, APP_VERSION);
  } catch {
    return false;
  }
  try {
    const registration = await serviceWorkerReady;
    await registration?.update();
    await Promise.all([fetch('./', { cache: 'reload' }), fetch('./index.html', { cache: 'reload' })]);
  } catch {
    // Offline: reload anyway and use whatever is available.
  }
  location.reload();
  return true;
}

// ---------- Messages: errors are always visible, never silent ----------

let toastTimer;

function showToast(text, { notice = false, duration = 10000 } = {}) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.toggle('toast--notice', notice);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), duration);
}

function showError(message) {
  showToast(`Something went wrong: ${message}`);
}

// ---------- App ----------

function start() {
  $('toast').addEventListener('click', () => ($('toast').hidden = true));
  window.addEventListener('error', (event) => showError(event.message));
  window.addEventListener('unhandledrejection', (event) => showError(event.reason?.message ?? String(event.reason)));

  // The previous launch was closed in the middle of analyzing a photo: iOS ends
  // pages that use too much memory. Fall back to background removal only, so it
  // can't happen again in a loop; it can be turned back on in Settings.
  if (getPref(ANALYSIS_RUNNING, false)) {
    setPref(ANALYSIS_RUNNING, undefined);
    if (getPref(SMART_DETECTION, true)) {
      setPref(SMART_DETECTION, false);
      showToast(
        'The app closed while analyzing a photo, likely out of memory. Outfit detection is now off so adding photos works; you can turn it back on in Settings.',
        { notice: true, duration: 20000 },
      );
    }
  }

  // Adding photos: "One photo" returns as soon as a photo is tapped; "Several
  // photos" uses the multi-select picker, which needs its "Add" button.
  const choiceSheet = $('add-choice-sheet');
  const requestPhotos = () => openSheet(choiceSheet);
  const pickWith = (input) => {
    input.click(); // must happen inside the tap, before anything async
    closeSheet(choiceSheet);
  };
  setupSheet(choiceSheet, () => closeSheet(choiceSheet));
  $('add-choice-cancel').addEventListener('click', () => closeSheet(choiceSheet));
  $('choose-one').addEventListener('click', () => pickWith($('photo-input')));
  $('choose-many').addEventListener('click', () => pickWith($('photos-input')));
  $('add-item').addEventListener('click', requestPhotos);

  for (const input of [$('photo-input'), $('photos-input')]) {
    input.addEventListener('change', () => {
      const files = [...(input.files ?? [])];
      input.value = ''; // so picking the same photos again still fires `change`
      if (!files.length) return;
      try {
        startImport(files);
      } catch (error) {
        showError(error.message);
      }
    });
  }

  // Tabs
  const tabs = [...document.querySelectorAll('.tab')];
  const views = { closet: $('view-closet'), canvas: $('view-canvas') };
  const showTab = (name) => {
    if (!views[name]) name = 'closet';
    for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
    for (const tab of tabs) {
      if (tab.dataset.tab === name) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    history.replaceState(null, '', `#${name}`);
    window.scrollTo(0, 0);
  };
  for (const tab of tabs) tab.addEventListener('click', () => showTab(tab.dataset.tab));
  showTab(location.hash.slice(1));

  document.addEventListener('closet:changed', ({ detail: { count } }) => {
    $('canvas-message').textContent =
      count === 0
        ? 'Add a few pieces to your closet, then come back here to mix and match.'
        : `The drag-and-drop builder is coming next. ${count} ${count === 1 ? 'piece' : 'pieces'} ready to style.`;
  });

  for (const init of [initSettings, () => initAddItem({ onSaved: reloadCloset })]) {
    try {
      init();
    } catch (error) {
      console.error(error);
      showError(error.message);
    }
  }
  initCloset({ onAddRequested: requestPhotos }).catch((error) => {
    console.error(error);
    showError("Couldn't open your closet storage. If you're in Private Browsing, switch to a normal tab.");
  });
}

const pageVersion = document.querySelector('meta[name="app-version"]')?.content;
if (pageVersion === APP_VERSION || !(await reloadWithFreshFiles())) {
  try {
    start();
  } catch (error) {
    console.error(error);
    showError(error.message);
  }
}
