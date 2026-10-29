import { BackgroundRemovalError, removeBackground } from './background-removal.js';
import { newId, putItem, requestPersistentStorage } from './db.js';
import { imageSize, prepareImage, trimTransparent } from './images.js';
import { closeSheet, createCategoryChips, openSheet, setupSheet } from './ui.js';

const $ = (id) => document.getElementById(id);

const sheet = $('add-sheet');
const sourceImage = $('add-source');
const cutoutImage = $('add-cutout');
const status = $('add-status');
const statusText = $('add-status-text');
const failure = $('add-failure');
const failureText = $('add-failure-text');
const retryButton = $('add-retry');
const saveButton = $('add-save');
const nameInput = $('add-name');

const categoryChips = createCategoryChips($('add-category'), { initial: 'tops' });

/** The photo currently being processed; replaced on every new add. */
let session = null;

export function initAddItem({ onSaved }) {
  setupSheet(sheet, dismiss);
  $('add-cancel').addEventListener('click', dismiss);
  saveButton.addEventListener('click', () => save(onSaved));
  retryButton.addEventListener('click', () => runRemoval(session));
  $('add-use-original').addEventListener('click', () => {
    if (session?.prepared) showCutout(session, session.prepared);
  });
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') nameInput.blur();
  });
}

export async function startAddFlow(file) {
  const current = { prepared: null, cutout: null, urls: [] };
  session = current;

  nameInput.value = '';
  categoryChips.set('tops');
  sourceImage.removeAttribute('src');
  cutoutImage.removeAttribute('src');
  cutoutImage.hidden = true;
  failure.hidden = true;
  sourceImage.hidden = false;
  setStatus('Preparing photo…');
  updateSaveButton();
  openSheet(sheet);

  try {
    current.prepared = await prepareImage(file);
  } catch {
    if (current === session) showFailure("That file doesn't look like a photo.", { canRetry: false });
    return;
  }
  if (current !== session) return;
  sourceImage.src = track(current, URL.createObjectURL(current.prepared));
  await runRemoval(current);
}

async function runRemoval(current) {
  if (!current?.prepared || current !== session) return;
  failure.hidden = true;
  cutoutImage.hidden = true;
  sourceImage.hidden = false;
  setStatus('Lifting item…');

  try {
    const raw = await removeBackground(current.prepared, {
      onProgress: ({ phase, percent }) => {
        if (current !== session) return;
        setStatus(
          phase === 'download' && percent < 100 ? `Downloading model, first time only… ${percent}%` : 'Lifting item…',
        );
      },
    });
    const trimmed = await trimTransparent(raw);
    if (current === session) showCutout(current, trimmed);
  } catch (error) {
    if (current !== session) return;
    console.error(error);
    showFailure(
      error instanceof BackgroundRemovalError
        ? error.message
        : 'Background removal failed. The first time, it needs an internet connection to download the model.',
      { canRetry: true },
    );
  }
}

function setStatus(text) {
  statusText.textContent = text;
  status.hidden = false;
}

function showCutout(current, blob) {
  current.cutout = blob;
  cutoutImage.src = track(current, URL.createObjectURL(blob));
  cutoutImage.hidden = false;
  sourceImage.hidden = true;
  status.hidden = true;
  failure.hidden = true;
  updateSaveButton();
}

function showFailure(message, { canRetry }) {
  status.hidden = true;
  sourceImage.hidden = true;
  failureText.textContent = message;
  retryButton.hidden = !canRetry;
  $('add-use-original').hidden = !session?.prepared;
  failure.hidden = false;
}

function updateSaveButton() {
  saveButton.disabled = !session?.cutout;
}

async function save(onSaved) {
  const current = session;
  if (!current?.cutout) return;
  saveButton.disabled = true;
  try {
    const { width, height } = await imageSize(current.cutout);
    await putItem({
      id: newId(),
      name: nameInput.value.trim(),
      category: categoryChips.value,
      cutout: current.cutout,
      original: current.prepared,
      width,
      height,
      createdAt: Date.now(),
    });
    requestPersistentStorage();
    await dismiss();
    onSaved();
  } catch (error) {
    console.error(error);
    alert("Couldn't save this item. Please try again.");
    updateSaveButton();
  }
}

async function dismiss() {
  const current = session;
  session = null;
  await closeSheet(sheet);
  current?.urls.forEach((url) => URL.revokeObjectURL(url));
}

function track(current, url) {
  current.urls.push(url);
  return url;
}
