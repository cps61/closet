import { categoryLabel, displayName } from './categories.js';
import { deleteItem, getAllItems } from './db.js';
import { closeSheet, createCategoryChips, openSheet, setupSheet } from './ui.js';

const $ = (id) => document.getElementById(id);

const filterBar = $('category-filter');
const grid = $('closet-grid');
const emptyState = $('closet-empty');
const filterEmpty = $('filter-empty');

const itemSheet = $('item-sheet');
const itemImage = $('item-image');

let items = [];
let filter = null;
let openItem = null;
const imageUrls = new Map(); // item id → object URL of its cutout

function urlFor(item) {
  let url = imageUrls.get(item.id);
  if (!url) {
    url = URL.createObjectURL(item.cutout);
    imageUrls.set(item.id, url);
  }
  return url;
}

export async function initCloset({ onAddRequested }) {
  createCategoryChips(filterBar, {
    includeAll: true,
    onChange: (category) => {
      filter = category;
      render();
    },
  });
  $('empty-add').addEventListener('click', onAddRequested);

  setupSheet(itemSheet, () => closeSheet(itemSheet));
  $('item-done').addEventListener('click', () => closeSheet(itemSheet));
  $('item-delete').addEventListener('click', confirmDelete);

  await reloadCloset();
}

export async function reloadCloset() {
  items = await getAllItems();
  render();
}

function render() {
  const visible = filter ? items.filter((item) => item.category === filter) : items;
  const hasItems = items.length > 0;

  emptyState.hidden = hasItems;
  filterBar.hidden = !hasItems;
  grid.hidden = !hasItems || visible.length === 0;
  filterEmpty.hidden = !hasItems || visible.length > 0;
  if (filter) filterEmpty.textContent = `No ${categoryLabel(filter).toLowerCase()} yet`;

  grid.replaceChildren(...visible.map(renderTile));
  document.dispatchEvent(new CustomEvent('closet:changed', { detail: { count: items.length } }));
}

function renderTile(item, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'item';
  button.style.animationDelay = `${Math.min(index, 12) * 25}ms`;
  button.addEventListener('click', () => showItem(item));

  const frame = document.createElement('div');
  frame.className = 'item-frame';
  const image = document.createElement('img');
  image.src = urlFor(item);
  image.alt = '';
  image.decoding = 'async';
  image.loading = 'lazy';
  frame.append(image);

  const name = document.createElement('div');
  name.className = 'item-name';
  name.textContent = displayName(item);

  const category = document.createElement('span');
  category.className = 'eyebrow';
  category.textContent = categoryLabel(item.category);

  button.append(frame, name, category);
  return button;
}

function showItem(item) {
  openItem = item;
  itemImage.src = urlFor(item);
  $('item-name').textContent = displayName(item);
  $('item-category').textContent = categoryLabel(item.category);
  $('item-date').textContent = `Added ${new Date(item.createdAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`;
  openSheet(itemSheet);
}

async function confirmDelete() {
  const item = openItem;
  if (!item || !confirm(`Delete "${displayName(item)}" from your closet?`)) return;
  await deleteItem(item.id);
  await closeSheet(itemSheet);
  URL.revokeObjectURL(imageUrls.get(item.id));
  imageUrls.delete(item.id);
  openItem = null;
  await reloadCloset();
}
