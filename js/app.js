import { initAddItem, startImport } from './add-item.js';
import { initCloset, reloadCloset } from './closet.js';
import { initSettings } from './settings.js';
import { closeSheet, openSheet, setupSheet } from './ui.js';

const $ = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll('.tab')];
const views = { closet: $('view-closet'), canvas: $('view-canvas') };

// ---------- Errors: always visible, never silent ----------

const toast = $('toast');
let toastTimer;

function showError(message) {
  toast.textContent = `Something went wrong: ${message}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 10000);
}
toast.addEventListener('click', () => (toast.hidden = true));
window.addEventListener('error', (event) => showError(event.message));
window.addEventListener('unhandledrejection', (event) => showError(event.reason?.message ?? String(event.reason)));

// ---------- Adding photos ----------

const choiceSheet = $('add-choice-sheet');
setupSheet(choiceSheet, () => closeSheet(choiceSheet));
$('add-choice-cancel').addEventListener('click', () => closeSheet(choiceSheet));

function requestPhotos() {
  openSheet(choiceSheet);
}

function pickWith(input) {
  input.click(); // must happen inside the tap, before anything async
  closeSheet(choiceSheet);
}

$('choose-one').addEventListener('click', () => pickWith($('photo-input')));
$('choose-many').addEventListener('click', () => pickWith($('photos-input')));

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

$('add-item').addEventListener('click', requestPhotos);

// ---------- Tabs ----------

function showTab(name) {
  if (!views[name]) name = 'closet';
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
  for (const tab of tabs) {
    if (tab.dataset.tab === name) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  history.replaceState(null, '', `#${name}`);
  window.scrollTo(0, 0);
}

for (const tab of tabs) tab.addEventListener('click', () => showTab(tab.dataset.tab));

document.addEventListener('closet:changed', ({ detail: { count } }) => {
  $('canvas-message').textContent =
    count === 0
      ? 'Add a few pieces to your closet, then come back here to mix and match.'
      : `The drag-and-drop builder is coming next. ${count} ${count === 1 ? 'piece' : 'pieces'} ready to style.`;
});

// ---------- Start ----------

showTab(location.hash.slice(1));
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

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker registration failed', error));
}
