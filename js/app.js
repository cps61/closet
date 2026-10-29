import { initAddItem, startAddFlow } from './add-item.js';
import { initCloset, reloadCloset } from './closet.js';
import { initSettings } from './settings.js';

const photoInput = document.getElementById('photo-input');
const tabs = [...document.querySelectorAll('.tab')];
const views = { closet: document.getElementById('view-closet'), canvas: document.getElementById('view-canvas') };

function requestPhoto() {
  photoInput.click();
}

photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  photoInput.value = ''; // so picking the same photo again still fires `change`
  if (file) startAddFlow(file);
});

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
  document.getElementById('canvas-message').textContent =
    count === 0
      ? 'Add a few pieces to your closet, then come back here to mix and match.'
      : `The drag-and-drop builder is coming next. ${count} ${count === 1 ? 'piece' : 'pieces'} ready to style.`;
});

document.getElementById('add-item').addEventListener('click', requestPhoto);

showTab(location.hash.slice(1));
initSettings();
initAddItem({ onSaved: reloadCloset });
initCloset({ onAddRequested: requestPhoto }).catch((error) => {
  console.error(error);
  alert("Couldn't open your closet storage. If you're in Private Browsing, switch to a normal tab.");
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker registration failed', error));
}
