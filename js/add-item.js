// Import flow: one or many photos → AI finds and names each piece → review → save.

import { BackgroundRemovalError } from './background-removal.js';
import { CATEGORIES, categoryLabel } from './categories.js';
import { newId, putItem, requestPersistentStorage } from './db.js';
import { imageSize, prepareImage } from './images.js';
import { analyzePhoto } from './pieces.js';
import { closeSheet, openSheet, setupSheet } from './ui.js';

const $ = (id) => document.getElementById(id);

const sheet = $('add-sheet');
const title = $('add-title');
const skipButton = $('add-skip');
const progressView = $('add-progress');
const sourceImage = $('add-source');
const status = $('add-status');
const statusText = $('add-status-text');
const failure = $('add-failure');
const failureText = $('add-failure-text');
const summary = $('add-summary');
const piecesList = $('add-pieces');
const footer = $('add-footer');
const saveButton = $('add-save');

let queue = [];
let position = 0;
/** State for the photo currently on screen; replaced for every photo. */
let session = null;
let onSavedCallback = () => {};

export function initAddItem({ onSaved }) {
  onSavedCallback = onSaved;
  setupSheet(sheet, dismiss);
  $('add-cancel').addEventListener('click', dismiss);
  skipButton.addEventListener('click', nextPhoto);
  saveButton.addEventListener('click', save);
  $('add-retry').addEventListener('click', () => analyze(session));
  $('add-use-whole').addEventListener('click', () => {
    if (!session?.prepared) return;
    showPieces(session, {
      worn: false,
      pieces: [{ cutout: session.prepared, labelId: null, color: null, category: 'tops', name: '' }],
    });
  });
}

/** Starts importing the given photos, one review screen per photo. */
export function startImport(files) {
  queue = [...files];
  position = 0;
  openSheet(sheet);
  loadPhoto();
}

async function loadPhoto() {
  const current = { file: queue[position], prepared: null, pieces: [], urls: [], download: new Map(), stage: '' };
  session = current;

  title.textContent = queue.length > 1 ? `Photo ${position + 1} of ${queue.length}` : 'New Item';
  skipButton.hidden = queue.length <= 1;
  progressView.hidden = false;
  sourceImage.removeAttribute('src');
  summary.hidden = true;
  piecesList.hidden = true;
  piecesList.replaceChildren();
  footer.hidden = true;
  setStage(current, 'Preparing photo…');

  try {
    current.prepared = await prepareImage(current.file);
  } catch {
    if (current === session) showFailure("That file doesn't look like a photo.", { canRetry: false });
    return;
  }
  if (current !== session) return;
  sourceImage.src = track(current, URL.createObjectURL(current.prepared));
  await analyze(current);
}

async function analyze(current) {
  if (!current?.prepared || current !== session) return;
  failure.hidden = true;
  sourceImage.hidden = false;
  setStage(current, 'Finding clothes…');

  try {
    const result = await analyzePhoto(current.prepared, {
      onStage: (text) => setStage(current, text),
      onDownload: ({ file, loaded, total }) => {
        current.download.set(file, { loaded, total });
        renderStatus(current);
      },
    });
    if (current === session) showPieces(current, result);
  } catch (error) {
    if (current !== session) return;
    console.error(error);
    showFailure(
      error instanceof BackgroundRemovalError
        ? error.message
        : 'Something went wrong. The first time, the app needs internet to download its AI models.',
      { canRetry: true },
    );
  }
}

function setStage(current, text) {
  current.stage = text;
  renderStatus(current);
}

function renderStatus(current) {
  if (current !== session) return;
  let loaded = 0, total = 0;
  for (const file of current.download.values()) {
    loaded += file.loaded;
    total += file.total;
  }
  const downloading = total > 0 && loaded < total;
  statusText.textContent = downloading
    ? `Downloading AI models, first time only… ${Math.floor((loaded / total) * 100)}%`
    : current.stage;
  status.hidden = false;
}

function showFailure(message, { canRetry }) {
  status.hidden = true;
  sourceImage.hidden = true;
  failureText.textContent = message;
  $('add-retry').hidden = !canRetry;
  $('add-use-whole').hidden = !session?.prepared;
  failure.hidden = false;
}

// ---------- Review ----------

function showPieces(current, { worn, pieces }) {
  current.pieces = pieces.map((piece) => ({ ...piece, include: true }));
  const single = current.pieces.length === 1;

  progressView.hidden = true;
  summary.hidden = single;
  summary.textContent = worn
    ? `Found ${pieces.length} pieces. Tap a photo to leave it out, and fix any names.`
    : '';
  piecesList.classList.toggle('pieces--single', single);
  piecesList.replaceChildren(...current.pieces.map((piece) => renderPiece(current, piece, single)));
  piecesList.hidden = false;
  footer.hidden = false;
  updateSaveButton(current);
}

function renderPiece(current, piece, single) {
  const card = document.createElement('article');
  card.className = 'piece';

  const imageButton = document.createElement('button');
  imageButton.type = 'button';
  imageButton.className = 'piece-image';
  imageButton.disabled = single;
  imageButton.setAttribute('aria-pressed', 'true');
  imageButton.setAttribute('aria-label', 'Include this piece');
  const image = document.createElement('img');
  image.src = track(current, URL.createObjectURL(piece.cutout));
  image.alt = '';
  imageButton.append(image);
  if (!single) {
    const check = document.createElement('span');
    check.className = 'piece-check';
    check.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9"/></svg>';
    imageButton.append(check);
  }
  imageButton.addEventListener('click', () => {
    piece.include = !piece.include;
    card.classList.toggle('piece--excluded', !piece.include);
    imageButton.setAttribute('aria-pressed', String(piece.include));
    updateSaveButton(current);
  });

  const name = document.createElement('input');
  name.type = 'text';
  name.className = 'text-input piece-name';
  name.value = piece.name;
  name.placeholder = 'Name';
  name.autocomplete = 'off';
  name.enterKeyHint = 'done';
  name.setAttribute('aria-label', 'Item name');
  name.addEventListener('input', () => {
    piece.name = name.value;
  });
  name.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') name.blur();
  });

  const category = document.createElement('select');
  category.className = 'select piece-category';
  category.setAttribute('aria-label', 'Category');
  for (const option of CATEGORIES) category.add(new Option(option.label, option.id, false, option.id === piece.category));
  category.addEventListener('change', () => {
    piece.category = category.value;
    name.placeholder = categoryLabel(piece.category);
  });
  name.placeholder = categoryLabel(piece.category);

  card.append(imageButton, name, category);
  return card;
}

function updateSaveButton(current) {
  const count = current.pieces.filter((piece) => piece.include).length;
  saveButton.disabled = count === 0;
  saveButton.textContent = count <= 1 ? 'Add to Closet' : `Add ${count} Items`;
}

async function save() {
  const current = session;
  const chosen = current?.pieces.filter((piece) => piece.include) ?? [];
  if (chosen.length === 0) return;
  saveButton.disabled = true;
  try {
    const now = Date.now();
    for (const [index, piece] of chosen.entries()) {
      const { width, height } = await imageSize(piece.cutout);
      await putItem({
        id: newId(),
        name: piece.name.trim(),
        category: piece.category,
        labelId: piece.labelId,
        color: piece.color,
        cutout: piece.cutout,
        original: current.prepared,
        width,
        height,
        createdAt: now - index, // keep the on-screen order in the closet
      });
    }
    requestPersistentStorage();
    onSavedCallback();
    nextPhoto();
  } catch (error) {
    console.error(error);
    alert("Couldn't save. Please try again.");
    updateSaveButton(current);
  }
}

function nextPhoto() {
  releaseSession();
  position += 1;
  if (position < queue.length) loadPhoto();
  else dismiss();
}

async function dismiss() {
  releaseSession();
  queue = [];
  await closeSheet(sheet);
}

function releaseSession() {
  const current = session;
  session = null;
  current?.urls.forEach((url) => URL.revokeObjectURL(url));
}

function track(current, url) {
  current.urls.push(url);
  return url;
}
